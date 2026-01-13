'use client'

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApp } from '@/app/providers'
import { useTheme } from '@/components/ThemeProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import LeadsTable from '@/components/LeadsTable'
import MapView from '@/components/MapView'
import EmailTemplateModal from '@/components/EmailTemplateModal'
import SaveButton from './components/AddToCrmButton'
import { add_to_list } from './utils/listUtils'
import { normalizeListingIdentifier } from '@/app/dashboard/lists/utils/identifierUtils'
import ProspectInsights from './components/ProspectInsights'
import ApolloFilterSidebar from './components/ApolloFilterSidebar'
import ApolloActionBar from './components/ApolloActionBar'
import ApolloContactCard from './components/ApolloContactCard'
import ApolloPagination from './components/ApolloPagination'
import LeadDetailModal from './components/LeadDetailModal'
import ImportLeadsModal from './components/ImportLeadsModal'
import VirtualizedListingsTable from './components/VirtualizedListingsTable'
import AddToListModal from './components/AddToListModal'
import AddToCampaignModal from './components/AddToCampaignModal'
import { useProspectData, Listing, FilterType, getPrimaryCategory } from './hooks/useProspectData'
import { postEnrichLeads } from '@/lib/api'
import { 
  Search, 
  Filter, 
  Plus, 
  Sparkles, 
  Building2, 
  Clock, 
  FileText, 
  MapPin, 
  Users,
  X,
  CheckSquare,
  Square,
  TrendingUp,
  DollarSign,
  Home,
  Zap,
  Target,
  BarChart3,
  ChevronDown,
  SlidersHorizontal,
  MoreVertical,
  Mail,
  Phone,
  Send,
  Table2,
  Map as MapIcon,
  Lightbulb
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'

type ViewType = 'table' | 'map' | 'analytics' | 'insights'
type SortField = 'price' | 'date' | 'score' | 'location' | 'status'
type SortOrder = 'asc' | 'desc'

interface FilterOption {
  key: FilterType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  color: string
  count?: number
}

const DEFAULT_LISTINGS_TABLE = 'listings'

// Keep constants that are UI-specific or used in multiple places if not in hook
const META_FILTERS = new Set<FilterType>(['all', 'high_value', 'price_drop', 'new_listings'])

// Inner component that uses useSearchParams - must be in Suspense
function ProspectEnrichInner() {
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { profile } = useApp()
  const router = useRouter()
  
  // View State
  const [activeView, setActiveView] = useState<ViewType>('analytics')
  const [selectedFilters, setSelectedFilters] = useState<Set<FilterType>>(new Set<FilterType>(['all']))
  const [apolloFilters, setApolloFilters] = useState<Record<string, any>>({})
  const [filtersVisible, setFiltersVisible] = useState(true)
  const [viewTypeSelector, setViewTypeSelector] = useState<'table' | 'map'>('table')
  const [sortBy, setSortBy] = useState('relevance')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  // UI State
  const [selectedLead, setSelectedLead] = useState<Listing | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMarketSegments, setShowMarketSegments] = useState(false)
  const [viewType, setViewType] = useState<'total' | 'net_new' | 'saved'>('total')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAddToListModal, setShowAddToListModal] = useState(false)
  const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false)
  const [useVirtualizedTable, setUseVirtualizedTable] = useState(true) // Enable virtualized table by default
  const [remoteListingsCount, setRemoteListingsCount] = useState(0)
  
  // Data Hook
  const {
    listings,
    allListings,
    savedListings,
    crmContactIds,
    loading: listingsLoading,
    lastUpdated,
    fetchListingsData,
    fetchCrmContacts,
    getTableName,
    updateListing
  } = useProspectData(profile?.id)
  
  // Track listings that are in lists (to exclude from Net New)
  const [listItemIds, setListItemIds] = useState<Set<string>>(new Set())
  
  const supabase = useMemo(() => createClientComponentClient(), [])
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const dataScrollContainerRef = useRef<HTMLDivElement>(null)

  const activeCategory = useMemo(() => getPrimaryCategory(selectedFilters), [selectedFilters])
  
  // Calculate filter counts - fetch from separate tables
  const [filterCounts, setFilterCounts] = useState<Record<FilterType, number>>({
    all: 0,
    expired: 0,
    probate: 0,
    fsbo: 0,
    frbo: 0,
    imports: 0,
    trash: 0,
    foreclosure: 0,
    high_value: 0,
    price_drop: 0,
    new_listings: 0
  })
  
  // Resolve table name using the hook's logic
  const resolvedTableName = useMemo(() => {
    // If "all" is selected, we return default table but virtualized table shouldn't be used anyway
    return getTableName(activeCategory)
  }, [activeCategory, getTableName])
  
  const shouldUseVirtualizedTable = useMemo(() => {
    // Only use virtualized table for table-based categories that have a valid table name
    // This prevents "all" (which aggregates from multiple tables) from using the virtualized table
    const isNotAllCategory = activeCategory !== 'all' // "all" aggregates from multiple tables, so can't use virtualized table
    return useVirtualizedTable && 
           viewTypeSelector === 'table' && 
           isNotAllCategory
  }, [useVirtualizedTable, viewTypeSelector, activeCategory])

  // Market Segments (Apollo.io style) - only include valid FilterType values
  const marketSegments = useMemo(() => {
    const counts = filterCounts || {
      all: 0,
      expired: 0,
      probate: 0,
      fsbo: 0,
      frbo: 0,
      imports: 0,
      trash: 0,
      foreclosure: 0,
      high_value: 0,
      price_drop: 0,
      new_listings: 0
    }
    return [
      { key: 'all' as FilterType, label: 'All Prospects', count: counts.all || 0 },
      { key: 'expired' as FilterType, label: 'Expired Listings', count: counts.expired || 0 },
      { key: 'probate' as FilterType, label: 'Probate Leads', count: counts.probate || 0 },
      { key: 'fsbo' as FilterType, label: 'FSBO Leads', count: counts.fsbo || 0 },
      { key: 'frbo' as FilterType, label: 'FRBO Leads', count: counts.frbo || 0 },
      { key: 'imports' as FilterType, label: 'Imports', count: counts.imports || 0 },
      { key: 'trash' as FilterType, label: 'Trash', count: counts.trash || 0 },
      { key: 'foreclosure' as FilterType, label: 'Foreclosure', count: counts.foreclosure || 0 },
      { key: 'high_value' as FilterType, label: 'High Value', count: counts.high_value || 0 },
      { key: 'price_drop' as FilterType, label: 'Price Drops', count: counts.price_drop || 0 },
      { key: 'new_listings' as FilterType, label: 'New Listings', count: counts.new_listings || 0 }
  ]
  }, [filterCounts])

  const handleEnrich = async (listingId: string) => {
    try {
      await postEnrichLeads([listingId])
      fetchListingsData(selectedFilters, sortField, sortOrder)
      alert('Lead enriched successfully!')
    } catch (error) {
      console.error('Enrich error:', error)
      alert('Failed to enrich lead')
    }
  }

  const handleGenerateEmail = (lead: Listing) => {
    setSelectedLead(lead)
    setShowEmailModal(true)
  }

  const handleSave = async (lead: Listing, listId?: string) => {
    if (!profile?.id) return
    
    try {
      const sourceId = lead.listing_id || lead.property_url
      if (!sourceId) return

      // Get the current category from selected filters
      const currentCategory = getPrimaryCategory(selectedFilters)
      
      // Use the add_to_list function with category
      await add_to_list(supabase, profile.id, sourceId, lead, listId, currentCategory)
      
      // Refresh the lists
      await fetchCrmContacts(selectedFilters)
    } catch (error) {
      console.error('Error saving prospect:', error)
      alert('Failed to save prospect')
    }
  }

  const handleSaveProspect = async (listing: Listing, saved: boolean) => {
    if (!profile?.id) return
    
    try {
      const sourceId = listing.listing_id || listing.property_url
      if (!sourceId) {
        console.error('Cannot save: missing listing_id and property_url')
        return
      }

      if (saved) {
        // Save the listing
        const currentCategory = getPrimaryCategory(selectedFilters)
        await add_to_list(supabase, profile.id, sourceId, listing, undefined, currentCategory)
      } else {
        // Unsave the listing (remove from contacts)
        // Check both listing_id and property_url since source_id could be either
        const possibleIds = [sourceId]
        if (listing.listing_id && listing.listing_id !== sourceId) {
          possibleIds.push(listing.listing_id)
        }
        if (listing.property_url && listing.property_url !== sourceId) {
          possibleIds.push(listing.property_url)
        }

        // Find and delete any contact matching any of these IDs
        // Use filter to check multiple source_id values
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', profile.id)
          .eq('source', 'listing')
          .in('source_id', possibleIds.filter(id => id)) // Filter out empty strings

        if (existingContacts && existingContacts.length > 0) {
          const contactIds = existingContacts.map(c => c.id)
          await supabase
            .from('contacts')
            .delete()
            .in('id', contactIds)
            .eq('user_id', profile.id)
        }
      }
      
      // Refresh the CRM contacts to update the saved state
      await fetchCrmContacts(selectedFilters)
    } catch (error) {
      console.error('Error toggling save status:', error)
      alert('Failed to update save status')
    }
  }

  const handleBulkAddToList = async (listId: string) => {
    if (!profile?.id || selectedIds.size === 0) return

    try {
      // Get the selected listings
      const selectedListings = listings.filter(l => selectedIds.has(l.listing_id || ''))
      
      if (selectedListings.length === 0) {
        alert('No listings selected')
        return
      }

      // Prepare items for bulk add with normalization
      const items = selectedListings
        .map(listing => {
          const itemId = listing.listing_id || listing.property_url
          if (!itemId) return null
          // Normalize the identifier for consistency
          const normalizedId = normalizeListingIdentifier(itemId)
          if (!normalizedId) {
            console.warn(`⚠️ Skipping invalid listing ID: ${itemId}`)
            return null
          }
          return {
            itemId: normalizedId,
            itemType: 'listing' as const
          }
        })
        .filter((item): item is { itemId: string; itemType: 'listing' } => item !== null)

      if (items.length === 0) {
        alert('No valid listings to add')
        return
      }

      // Use bulk-add API endpoint (Apollo-grade)
      const response = await fetch('/api/lists/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listIds: [listId],
          items: items
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add listings to list')
      }

      // Clear selection
      setSelectedIds(new Set())
      setShowAddToListModal(false)

      // Show success message
      alert(`Successfully added ${items.length} listing${items.length > 1 ? 's' : ''} to list`)

      // Refresh data
      await fetchCrmContacts(selectedFilters)
    } catch (error: any) {
      console.error('Error adding to list:', error)
      alert(error.message || 'Failed to add listings to list')
    }
  }

  const handleBulkAddToCampaign = async () => {
    // This will be handled by the modal itself
    // The modal will call saveListingsToCampaign
  }

  const handleRemoveFromCrm = async (lead: Listing) => {
    if (!profile?.id) return
    
    try {
      const sourceId = lead.listing_id || lead.property_url
      if (!sourceId) return

      // Remove contact from CRM
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', profile.id)
        .eq('source', 'listing')
        .eq('source_id', sourceId)

      if (error) {
        console.error('Error removing from CRM:', error)
        alert('Failed to remove from CRM')
        return
      }

      // Refresh the lists
      await fetchCrmContacts(selectedFilters)
    } catch (error) {
      console.error('Error removing from CRM:', error)
      alert('Failed to remove from CRM')
    }
  }

  const handleBulkSave = async (listId?: string) => {
    if (selectedIds.size === 0) return
    
    try {
      const selectedListings = listings.filter(l => selectedIds.has(l.listing_id))
      
      // Filter out already-saved listings
      const unsavedListings = selectedListings.filter(listing => {
        const sourceId = listing.listing_id || listing.property_url
        return sourceId && !crmContactIds.has(sourceId)
      })
      
      if (unsavedListings.length === 0) {
        alert('All selected prospects are already saved')
        return
      }
      
      let successCount = 0
      // Save each unsaved listing
      // Get the current category from selected filters
      const currentCategory = getPrimaryCategory(selectedFilters)
      
      if (!profile?.id) {
        alert('Please log in to save prospects')
        return
      }
      
      for (const listing of unsavedListings) {
        try {
          const sourceId = listing.listing_id || listing.property_url
          if (sourceId) {
            await add_to_list(supabase, profile.id, sourceId, listing, undefined, currentCategory)
            successCount++
          }
        } catch (error) {
          console.error('Error saving listing:', error)
        }
      }
      
      setSelectedIds(new Set())
      const skippedCount = selectedListings.length - unsavedListings.length
      
      // Refresh CRM contacts after bulk save
      await fetchCrmContacts(selectedFilters)
      
      if (skippedCount > 0) {
        alert(`Saved ${successCount} prospect${successCount > 1 ? 's' : ''}${skippedCount > 0 ? ` (${skippedCount} already saved)` : ''}`)
      } else {
        alert(`Saved ${successCount} prospect${successCount > 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error('Bulk save error:', error)
      alert('Failed to save prospects')
    }
  }


  // No scroll sync needed - header is inside scroll container and scrolls naturally with data

  // Fetch CRM contacts and saved listings when category changes
  useEffect(() => {
    if (profile?.id) {
      fetchCrmContacts(selectedFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedFilters])
  
  // Fetch listings that are in lists (to exclude from Net New)
  useEffect(() => {
    const fetchListItems = async () => {
      if (!profile?.id) {
        setListItemIds(new Set())
        return
      }
      
      try {
        // First, get all lists for this user
        const { data: userLists } = await supabase
          .from('lists')
          .select('id')
          .eq('user_id', profile.id)
        
        if (userLists && userLists.length > 0) {
          const listIds = userLists.map(l => l.id)
          // Then get all list items that are listings from list_memberships table
          const { data: items } = await supabase
            .from('list_memberships')
            .select('item_id')
            .eq('item_type', 'listing')
            .in('list_id', listIds)
          
          if (items) {
            const ids = new Set(items.map(item => item.item_id).filter(Boolean) as string[])
            setListItemIds(ids)
          } else {
            setListItemIds(new Set())
          }
        } else {
          setListItemIds(new Set())
        }
      } catch (error) {
        console.error('Error fetching list items:', error)
        setListItemIds(new Set())
      }
    }
    
    fetchListItems()
  }, [profile?.id, supabase])

  useEffect(() => {
    if (profile?.id) {
      fetchListingsData(selectedFilters, sortField, sortOrder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedFilters, crmContactIds, sortField, sortOrder])

  // Reset pagination when filters or view type change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedFilters, searchTerm, statusFilter, priceRange, viewType])
  
  // Clear selections when switching between view types (total, net_new, saved)
  useEffect(() => {
    setSelectedIds(new Set())
  }, [viewType])

  // Helper to update URL params when filters change
  const updateUrlParams = useCallback((filters: Set<FilterType>, search?: string, view?: string, sort?: string, page?: number, apolloFilters?: Record<string, any>) => {
    const params = new URLSearchParams()
    
    // Add filter param (only if not 'all')
    const primaryCategory = getPrimaryCategory(filters)
    if (primaryCategory !== 'all') {
      params.set('filter', primaryCategory)
    }
    
    // Add meta filters
    const metaFilters = Array.from(filters).filter(f => !['all', 'expired', 'probate', 'fsbo', 'frbo', 'imports', 'trash', 'foreclosure'].includes(f))
    if (metaFilters.length > 0) {
      params.set('meta', metaFilters.join(','))
    }
    
    // Add search
    if (search) {
      params.set('search', search)
    }
    
    // Add view
    if (view) {
      params.set('view', view)
    }
    
    // Add sort
    if (sort) {
      params.set('sort', sort)
    }
    
    // Add page
    if (page && page > 1) {
      params.set('page', page.toString())
    }
    
    // Add Apollo filters (serialize to JSON for complex objects)
    if (apolloFilters && Object.keys(apolloFilters).length > 0) {
      try {
        params.set('apollo', JSON.stringify(apolloFilters))
      } catch (e) {
        console.warn('Failed to serialize Apollo filters:', e)
      }
    }
    
    // Update URL without page reload
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(newUrl, { scroll: false })
  }, [router])

  // Sync search term to URL (only if not from URL itself)
  useEffect(() => {
    const searchParam = searchParams.get('search')
    // Only update URL if the search term differs from URL param (to avoid loops)
    if (searchTerm !== (searchParam || '')) {
      updateUrlParams(selectedFilters, searchTerm, viewTypeSelector, sortBy, currentPage, apolloFilters)
    }
  }, [searchTerm, selectedFilters, viewTypeSelector, sortBy, currentPage, apolloFilters, updateUrlParams, searchParams])

  // Sync sort to URL
  useEffect(() => {
    const sortParam = searchParams.get('sort')
    if (sortBy !== (sortParam || 'relevance')) {
      updateUrlParams(selectedFilters, searchTerm, viewTypeSelector, sortBy, currentPage, apolloFilters)
    }
  }, [sortBy, selectedFilters, searchTerm, viewTypeSelector, currentPage, apolloFilters, updateUrlParams, searchParams])

  // Sync page to URL
  useEffect(() => {
    const pageParam = searchParams.get('page')
    const pageNum = pageParam ? parseInt(pageParam, 10) : 1
    if (currentPage !== pageNum) {
      updateUrlParams(selectedFilters, searchTerm, viewTypeSelector, sortBy, currentPage, apolloFilters)
    }
  }, [currentPage, selectedFilters, searchTerm, viewTypeSelector, sortBy, apolloFilters, updateUrlParams, searchParams])

  // Sync view type to URL
  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewTypeSelector !== (viewParam || 'table')) {
      updateUrlParams(selectedFilters, searchTerm, viewTypeSelector, sortBy, currentPage, apolloFilters)
    }
  }, [viewTypeSelector, selectedFilters, searchTerm, sortBy, currentPage, apolloFilters, updateUrlParams, searchParams])

  // Sync Apollo filters to URL (debounced to avoid too many updates)
  useEffect(() => {
    const apolloParam = searchParams.get('apollo')
    let currentApollo: Record<string, any> = {}
    try {
      if (apolloParam) {
        currentApollo = JSON.parse(apolloParam)
      }
    } catch (e) {
      // Ignore parse errors
    }
    
    // Only update if filters actually changed
    const apolloStr = JSON.stringify(apolloFilters)
    const currentApolloStr = JSON.stringify(currentApollo)
    if (apolloStr !== currentApolloStr) {
      const timeoutId = setTimeout(() => {
        updateUrlParams(selectedFilters, searchTerm, viewTypeSelector, sortBy, currentPage, apolloFilters)
      }, 300) // Debounce by 300ms
      
      return () => clearTimeout(timeoutId)
    }
  }, [apolloFilters, selectedFilters, searchTerm, viewTypeSelector, sortBy, currentPage, updateUrlParams, searchParams])

  // Parse all URL params on mount and when they change
  useEffect(() => {
    try {
      // Parse view
      const viewParam = searchParams.get('view')
      if (viewParam && ['table', 'map'].includes(viewParam)) {
        setViewTypeSelector(viewParam as 'table' | 'map')
      }
      
      // Parse search
      const searchParam = searchParams.get('search')
      if (searchParam !== null) {
        setSearchTerm(searchParam)
      }
      
      // Parse sort
      const sortParam = searchParams.get('sort')
      if (sortParam) {
        setSortBy(sortParam)
      }
      
      // Parse page
      const pageParam = searchParams.get('page')
      if (pageParam) {
        const pageNum = parseInt(pageParam, 10)
        if (!isNaN(pageNum) && pageNum > 0) {
          setCurrentPage(pageNum)
        }
      }
      
      // Parse Apollo filters
      const apolloParam = searchParams.get('apollo')
      if (apolloParam) {
        try {
          const parsed = JSON.parse(apolloParam)
          if (typeof parsed === 'object' && parsed !== null) {
            setApolloFilters(parsed)
          }
        } catch (e) {
          console.warn('Failed to parse Apollo filters from URL:', e)
        }
      }
      
      // Parse meta filters
      const metaParam = searchParams.get('meta')
      if (metaParam) {
        const metaFilters = metaParam.split(',').filter(f => 
          ['high_value', 'price_drop', 'new_listings'].includes(f)
        ) as FilterType[]
        if (metaFilters.length > 0) {
          setSelectedFilters(prev => {
            const newSet = new Set(prev)
            // Remove existing meta filters
            newSet.delete('high_value')
            newSet.delete('price_drop')
            newSet.delete('new_listings')
            // Add URL meta filters
            metaFilters.forEach(f => newSet.add(f))
            return newSet
          })
        }
      }
    } catch (error) {
      console.error('Error accessing search params:', error)
    }
  }, [searchParams])

  const toggleFilter = (filterKey: FilterType) => {
    setSelectedFilters(prev => {
      const newSet = new Set<FilterType>()
      
      // Define mutually exclusive filter groups (only one can be selected at a time)
      const exclusiveFilters: FilterType[] = ['all', 'expired', 'probate', 'fsbo', 'frbo', 'imports', 'trash', 'foreclosure']
      
      if (filterKey === 'all') {
        newSet.add('all')
      } else if (exclusiveFilters.includes(filterKey)) {
        // If clicking an exclusive filter, clear all others and select only this one
        newSet.add(filterKey)
      } else {
        // For non-exclusive filters (high_value, price_drop, etc.), toggle them
        if (prev.has(filterKey)) {
          // Remove it, but keep other exclusive filters
          exclusiveFilters.forEach(f => {
            if (prev.has(f) && f !== filterKey) {
              newSet.add(f)
            }
          })
          // Keep non-exclusive filters except the one being toggled
          prev.forEach(f => {
            if (!exclusiveFilters.includes(f) && f !== filterKey) {
              newSet.add(f)
            }
          })
          // If no filters left, default to 'all'
          if (newSet.size === 0) {
            newSet.add('all')
          }
        } else {
          // Add it, but remove exclusive filters first
          newSet.add(filterKey)
          // Keep non-exclusive filters
          prev.forEach(f => {
            if (!exclusiveFilters.includes(f)) {
              newSet.add(f)
            }
          })
        }
      }
      
      // Update URL params
      updateUrlParams(newSet, searchTerm, viewTypeSelector, sortBy, currentPage, apolloFilters)
      
      return newSet
    })
  }
  
  // Handle primary category filter from URL query parameter - sync with URL
  useEffect(() => {
    const filterParam = searchParams.get('filter')
    const validFilters: FilterType[] = ['expired', 'probate', 'fsbo', 'frbo', 'imports', 'trash', 'foreclosure']
    
    if (filterParam && validFilters.includes(filterParam as FilterType)) {
      // Set the filter from URL
      const filterType = filterParam as FilterType
      const currentPrimary = getPrimaryCategory(selectedFilters)
      if (currentPrimary !== filterType) {
        // Only update if different to avoid loops
        setSelectedFilters(prev => {
          const newSet = new Set<FilterType>()
          newSet.add(filterType)
          // Preserve meta filters from URL (handled in other useEffect)
          return newSet
        })
      }
    } else if (!filterParam && getPrimaryCategory(selectedFilters) !== 'all') {
      // No filter in URL means "All Prospects" - but only update if not already 'all'
      // This prevents clearing meta filters that might be in URL
      setSelectedFilters(prev => {
        const newSet = new Set<FilterType>(['all'])
        // Preserve meta filters
        prev.forEach(f => {
          if (['high_value', 'price_drop', 'new_listings'].includes(f)) {
            newSet.add(f)
      }
        })
        return newSet
      })
    }
  }, [searchParams])

  const clearAllFilters = () => {
    setSelectedFilters(new Set<FilterType>(['all']))
    setSearchTerm('')
    setStatusFilter('all')
    setPriceRange({ min: '', max: '' })
    setSelectedIds(new Set())
    setApolloFilters({})
    setCurrentPage(1)
    
    // Clear URL params
    router.replace(window.location.pathname, { scroll: false })
  }


  // Fetch counts from each table separately to ensure accurate counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!profile?.id) return
      
      try {
        const counts: Record<FilterType, number> = {
          all: 0,
          expired: 0,
          probate: 0,
          fsbo: 0,
          frbo: 0,
          imports: 0,
          trash: 0,
          foreclosure: 0,
          high_value: 0,
          price_drop: 0,
          new_listings: 0
        }

        const tableFilters: FilterType[] = ['expired', 'probate', 'fsbo', 'frbo', 'imports', 'trash', 'foreclosure']
        
        // Fetch counts from individual category tables
        await Promise.all(tableFilters.map(async (filterKey) => {
          const tableName = getTableName(filterKey)
          
          if (!tableName) return
          
          try {
            const { count } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true })
            counts[filterKey] = count || 0
          } catch (e) {
            // Table might not exist yet - ignore
            console.warn(`Table ${tableName} not found or error counting:`, e)
          }
        }))
        
        // Calculate "all" count - deduplicate by listing_id to avoid double-counting
        const allTables = [
          DEFAULT_LISTINGS_TABLE,
          'expired_listings',
          'probate_leads',
          'fsbo_leads',
          'frbo_leads',
          'imports',
          'trash',
          'foreclosure_listings'
        ]
        
        // Fetch all listing_ids from all tables and deduplicate
        const allListingIds = new Set<string>()
        await Promise.all(allTables.map(async (tableName) => {
          try {
            const { data } = await supabase
              .from(tableName)
              .select('listing_id')
              .limit(100000) // Large limit to get all IDs
            
            if (data) {
              data.forEach(item => {
                if (item.listing_id) {
                  allListingIds.add(item.listing_id)
                }
              })
            }
          } catch (e) {
            // Table might not exist yet - ignore
            console.warn(`Table ${tableName} not found or error fetching IDs:`, e)
          }
        }))
        
        counts.all = allListingIds.size

        // Calculate high_value, price_drop, new_listings from current category table
        const currentCategory = getPrimaryCategory(selectedFilters)
        const categoryTableName = getTableName(currentCategory)
        
        // For meta filters, calculate from the current category table, not just 'listings'
        const { data: categoryData } = await supabase
          .from(categoryTableName)
          .select('list_price, list_price_min, created_at, updated_at')
        
        if (categoryData) {
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
          
          categoryData.forEach(listing => {
            if ((listing.list_price || 0) >= 500000) counts.high_value++
            if (listing.list_price_min && listing.list_price) {
              const drop = ((listing.list_price_min - listing.list_price) / listing.list_price_min) * 100
              if (drop > 0) counts.price_drop++
            }
            // Check both created_at and updated_at for new listings
            const createdTime = listing.created_at ? new Date(listing.created_at).getTime() : 0
            const updatedTime = listing.updated_at ? new Date(listing.updated_at).getTime() : 0
            const mostRecentTime = Math.max(createdTime, updatedTime)
            if (mostRecentTime > 0 && mostRecentTime >= sevenDaysAgo) {
              counts.new_listings++
            }
          })
        }

        setFilterCounts(counts)
      } catch (error) {
        console.error('Error fetching filter counts:', error)
      }
    }

    fetchCounts()
    // Refresh counts periodically (every 5 minutes) and on mount
    const interval = setInterval(fetchCounts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [supabase, profile?.id, selectedFilters, getTableName])

  // Apply Apollo filters
  const applyApolloFilters = useCallback((listings: Listing[]) => {
    return listings.filter(listing => {
      // Status filter
      if (apolloFilters.status && Array.isArray(apolloFilters.status) && apolloFilters.status.length > 0) {
        const statusMatch = apolloFilters.status.some((status: string) => {
          if (status === 'active') return listing.active === true
          if (status === 'expired') return listing.status?.toLowerCase().includes('expired')
          if (status === 'sold') return listing.status?.toLowerCase().includes('sold')
          if (status === 'pending') return listing.status?.toLowerCase().includes('pending')
          return false
        })
        if (!statusMatch) return false
      }

      // Price range
      if (apolloFilters.price_range) {
        const price = listing.list_price || 0
        const min = typeof apolloFilters.price_range.min === 'number' 
          ? apolloFilters.price_range.min 
          : (apolloFilters.price_range.min ? parseFloat(apolloFilters.price_range.min) : undefined)
        const max = typeof apolloFilters.price_range.max === 'number'
          ? apolloFilters.price_range.max
          : (apolloFilters.price_range.max ? parseFloat(apolloFilters.price_range.max) : undefined)
        
        if (min !== undefined && !isNaN(min) && price < min) return false
        if (max !== undefined && !isNaN(max) && price > max) return false
      }

      // City filter
      if (apolloFilters.city && Array.isArray(apolloFilters.city) && apolloFilters.city.length > 0) {
        const cityMatch = apolloFilters.city.some((city: string) => {
          return listing.city?.toLowerCase().trim() === city.toLowerCase().trim()
        })
        if (!cityMatch) return false
      }

      // State filter
      if (apolloFilters.state && Array.isArray(apolloFilters.state) && apolloFilters.state.length > 0) {
        const stateMatch = apolloFilters.state.some((state: string) => {
          return listing.state?.toLowerCase().trim() === state.toLowerCase().trim()
        })
        if (!stateMatch) return false
      }

      // Zip code filter
      if (apolloFilters.zip_code && Array.isArray(apolloFilters.zip_code) && apolloFilters.zip_code.length > 0) {
        const zipMatch = apolloFilters.zip_code.some((zip: string) => {
          return String(listing.zip_code || '').trim() === String(zip).trim()
        })
        if (!zipMatch) return false
      }

      // Beds - exact match for 1-4, 5+ for 5 or more
      if (apolloFilters.beds && Array.isArray(apolloFilters.beds) && apolloFilters.beds.length > 0) {
        const beds = listing.beds || 0
        const bedsMatch = apolloFilters.beds.some((bed: string) => {
          if (bed === '5+') {
            return beds >= 5
          } else {
            return beds === parseInt(bed)
          }
        })
        if (!bedsMatch) return false
      }

      // Baths - exact match for 1-3, 4+ for 4 or more
      if (apolloFilters.baths && Array.isArray(apolloFilters.baths) && apolloFilters.baths.length > 0) {
        const baths = listing.full_baths || 0
        const bathsMatch = apolloFilters.baths.some((bath: string) => {
          if (bath === '4+') {
            return baths >= 4
          } else {
            return baths === parseInt(bath)
          }
        })
        if (!bathsMatch) return false
      }

      // Square footage
      if (apolloFilters.sqft) {
        const sqft = listing.sqft || 0
        if (apolloFilters.sqft.min && sqft < apolloFilters.sqft.min) return false
        if (apolloFilters.sqft.max && sqft > apolloFilters.sqft.max) return false
      }

      // Year built
      if (apolloFilters.year_built) {
        const yearBuilt = listing.year_built || 0
        if (apolloFilters.year_built.min && yearBuilt < apolloFilters.year_built.min) return false
        if (apolloFilters.year_built.max && yearBuilt > apolloFilters.year_built.max) return false
      }

      // AI Score
      if (apolloFilters.ai_score) {
        const score = listing.ai_investment_score || 0
        if (apolloFilters.ai_score.min && score < apolloFilters.ai_score.min) return false
        if (apolloFilters.ai_score.max && score > apolloFilters.ai_score.max) return false
      }

      // Agent name
      if (apolloFilters.agent_name && typeof apolloFilters.agent_name === 'string') {
        if (!listing.agent_name?.toLowerCase().includes(apolloFilters.agent_name.toLowerCase())) return false
      }

      // Has agent email
      if (apolloFilters.agent_email && !listing.agent_email) return false

      // Has agent phone
      if (apolloFilters.agent_phone && !listing.agent_phone) return false

      // Enriched - check for any enrichment data (agent info, AI score, or additional phone numbers)
      if (apolloFilters.enriched) {
        const hasEnrichment = !!(
          listing.agent_email || 
          listing.agent_phone || 
          listing.agent_phone_2 ||
          listing.listing_agent_phone_2 ||
          listing.listing_agent_phone_5 ||
          listing.agent_name || 
          listing.ai_investment_score ||
          listing.last_sale_price ||
          listing.last_sale_date
        )
        if (!hasEnrichment) return false
      }

      // High value
      if (apolloFilters.high_value && (listing.list_price || 0) < 500000) return false

      // Price drop
      if (apolloFilters.price_drop) {
        if (!listing.list_price_min || !listing.list_price) return false
        const drop = ((listing.list_price_min - listing.list_price) / listing.list_price_min) * 100
        if (drop <= 0) return false
      }

      return true
    })
  }, [apolloFilters])

  const activeFiltersCount = Object.keys(apolloFilters).length

  // Get base listings based on viewType, then apply Apollo filters and sorting
  const baseListings = useMemo(() => {
    let sourceListings: Listing[]
    
    switch (viewType) {
      case 'total':
        // For "total" view, show all listings including saved ones
        // Use allListings which contains all listings for the current category
        sourceListings = allListings
        break
      case 'net_new': {
        // Net new = listings created or updated in last 30 days, excluding saved listings and listings in lists
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
        sourceListings = listings.filter(l => {
          // Check both created_at and updated_at for "new to user" listings
          const createdTime = l.created_at ? new Date(l.created_at).getTime() : 0
          const updatedTime = l.updated_at ? new Date(l.updated_at).getTime() : 0
          const mostRecentTime = Math.max(createdTime, updatedTime)
          
          // Must have at least one timestamp
          if (mostRecentTime === 0) return false
          
          // Must be created or updated in last 30 days
          if (mostRecentTime < thirtyDaysAgo) return false
          
          // Exclude saved listings (in CRM contacts)
          const sourceId = l.listing_id || l.property_url
          if (sourceId && crmContactIds.has(sourceId)) return false
          
          // Exclude listings that are in any list
          if (sourceId && listItemIds.has(sourceId)) return false
          
          return true
        })
        break
      }
      case 'saved': {
        // Filter saved listings to only show those that exist in the current category
        // This ensures saved listings are properly separated by category
        // Use allListings since it contains all listings for the current category (including saved ones)
        const currentCategoryListingIds = new Set(allListings.map(l => l.listing_id))
        
        // Filter saved listings to only include those in the current category
        // Also deduplicate by listing_id to prevent duplicates
        const savedMap = new Map<string, Listing>()
        savedListings.forEach(listing => {
          const listingId = listing.listing_id
          if (listingId && currentCategoryListingIds.has(listingId)) {
            // Only add if not already in map (deduplication)
            if (!savedMap.has(listingId)) {
              savedMap.set(listingId, listing)
            }
          }
        })
        
        sourceListings = Array.from(savedMap.values())
        break
      }
      default:
        sourceListings = listings
    }
    
    // Apply market segment filters
    // Note: Category filters (expired, fsbo, frbo, probate, imports, trash, foreclosure) 
    // are now handled at the database level by querying separate tables.
    // Only apply non-category filters here (high_value, price_drop, new_listings)
    let filtered = sourceListings
    if (!(selectedFilters.has('all') && selectedFilters.size === 1)) {
      const activeFilters = Array.from(selectedFilters).filter(f => 
        f !== 'all' && 
        f !== 'expired' && 
        f !== 'fsbo' && 
        f !== 'frbo' && 
        f !== 'probate' && 
        f !== 'imports' && 
        f !== 'trash' && 
        f !== 'foreclosure'
      )
      if (activeFilters.length > 0) {
        filtered = sourceListings.filter(listing => {
          return activeFilters.some(filter => {
            switch (filter) {
              case 'high_value':
                return (listing.list_price || 0) >= 500000
              case 'price_drop':
                if (listing.list_price_min && listing.list_price) {
                  const drop = ((listing.list_price_min - listing.list_price) / listing.list_price_min) * 100
                  return drop > 0
                }
                return false
              case 'new_listings':
                if (listing.created_at) {
                  const daysSince = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24)
                  return daysSince <= 7
                }
                return false
              default:
                return true
            }
          })
        })
      }
    }
    
    // Apply Apollo filters
    let apolloFiltered = applyApolloFilters(filtered)
    
    // Apply sorting based on sortBy
    return [...apolloFiltered].sort((a, b) => {
      switch (sortBy) {
        case 'price_high':
          return (b.list_price || 0) - (a.list_price || 0)
        case 'price_low':
          return (a.list_price || 0) - (b.list_price || 0)
        case 'date_new':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'date_old':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        case 'score_high':
          return (b.ai_investment_score || 0) - (a.ai_investment_score || 0)
        case 'relevance':
        default:
          // Default relevance sorting - prioritize high AI scores, then recent listings
          const aScore = a.ai_investment_score || 0
          const bScore = b.ai_investment_score || 0
          if (Math.abs(aScore - bScore) > 10) {
            return bScore - aScore
          }
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })
  }, [listings, allListings, savedListings, viewType, selectedFilters, apolloFilters, sortBy, applyApolloFilters, crmContactIds, listItemIds, activeCategory])

  const filteredListings = useMemo(() => {
    return baseListings.filter(l => {
      // Apply search term filter
      if (searchTerm) {
        const address = `${l.street || ''} ${l.city || ''} ${l.state || ''}`.toLowerCase()
        const matchesSearch = 
          address.includes(searchTerm.toLowerCase()) ||
          (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (l.state && l.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (l.zip_code && l.zip_code.includes(searchTerm)) ||
          (l.listing_id && l.listing_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (l.agent_name && l.agent_name.toLowerCase().includes(searchTerm.toLowerCase()))
        
        if (!matchesSearch) return false
      }
      
      return true
    })
  }, [baseListings, searchTerm])

  // Calculate view-specific counts - these are now category-specific
  // IMPORTANT: These counts are independent of viewType - they always show the complete counts
  // allListings already contains only the current category's listings (excluding CRM contacts)
  const totalCount = allListings.length
  
  const netNewCount = useMemo(() => {
    // Net new = listings created in last 30 days, excluding saved listings and listings in lists
    // Always calculated from allListings, regardless of current viewType
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    return allListings.filter(l => {
      // Must have created_at date
      if (!l.created_at) return false
      
      // Must be created in last 30 days
      if (new Date(l.created_at).getTime() < thirtyDaysAgo) return false
      
      // Exclude saved listings (in CRM contacts)
      const sourceId = l.listing_id || l.property_url
      if (sourceId && crmContactIds.has(sourceId)) return false
      
      // Exclude listings that are in any list
      if (sourceId && listItemIds.has(sourceId)) return false
      
      return true
    }).length
  }, [allListings, crmContactIds, listItemIds])
  
  // Saved count is now category-specific - savedListings is fetched from current category's table
  // Always shows the complete count of saved listings in this category, regardless of viewType
  const savedCount = savedListings.length

  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredListings.slice(start, end)
  }, [filteredListings, currentPage, itemsPerPage])

  const activeTableItemCount = useMemo(() => {
    if (shouldUseVirtualizedTable) {
      return remoteListingsCount
    }
    return filteredListings.length
  }, [shouldUseVirtualizedTable, remoteListingsCount, filteredListings])

  const totalPages = Math.max(1, Math.ceil(Math.max(activeTableItemCount, 1) / itemsPerPage))

  const tableHeaderColumns = useMemo(() => (
    <div style={{
      display: 'flex',
      width: 'max-content',
      minWidth: '100%'
    }}>
      <div style={{ 
        marginRight: '16px', 
        flexShrink: 0, 
        width: '18px',
        display: 'flex',
        alignItems: 'center'
      }} />
      <div style={{ 
        flex: '0 0 280px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Address
        </span>
      </div>
      <div style={{ 
        flex: '0 0 130px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Price
        </span>
      </div>
      <div style={{ 
        flex: '0 0 120px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Status
        </span>
      </div>
      <div style={{ 
        flex: '0 0 100px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          AI Score
        </span>
      </div>
      <div style={{ 
        flex: '0 0 100px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Total Beds
        </span>
      </div>
      <div style={{ 
        flex: '0 0 110px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Total Baths
        </span>
      </div>
      <div style={{ 
        flex: '0 0 140px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Housing Square Feet
        </span>
      </div>
      <div style={{ 
        flex: '0 0 200px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Description
        </span>
      </div>
      <div style={{ 
        flex: '0 0 150px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Agent Name
        </span>
      </div>
      <div style={{ 
        flex: '0 0 180px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Agent Email
        </span>
      </div>
      <div style={{ 
        flex: '0 0 130px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Agent Phone
        </span>
      </div>
      <div style={{ 
        flex: '0 0 130px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Agent Phone 2
        </span>
      </div>
      <div style={{ 
        flex: '0 0 160px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Listing Agent Phone 2
        </span>
      </div>
      <div style={{ 
        flex: '0 0 160px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Listing Agent Phone
        </span>
      </div>
      <div style={{ 
        flex: '0 0 100px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Year Built
        </span>
      </div>
      <div style={{ 
        flex: '0 0 130px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Last Sale Price
        </span>
      </div>
      <div style={{ 
        flex: '0 0 130px', 
        marginRight: '24px',
        minWidth: 0
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Last Sale Date
        </span>
      </div>
      <div style={{ 
        flexShrink: 0,
        width: '120px',
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <span style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? '#ffffff' : '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Actions
        </span>
      </div>
    </div>
  ), [isDark])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [apolloFilters, searchTerm, viewType])

  // Update sortField and sortOrder when sortBy changes
  useEffect(() => {
    switch (sortBy) {
      case 'price_high':
        setSortField('price')
        setSortOrder('desc')
        break
      case 'price_low':
        setSortField('price')
        setSortOrder('asc')
        break
      case 'date_new':
        setSortField('date')
        setSortOrder('desc')
        break
      case 'date_old':
        setSortField('date')
        setSortOrder('asc')
        break
      case 'score_high':
        setSortField('score')
        setSortOrder('desc')
        break
      default:
        setSortField('date')
        setSortOrder('desc')
    }
  }, [sortBy])

  return (
    <>
      <style jsx global>{`
        .header-scroll-container::-webkit-scrollbar {
          height: 8px;
        }
        .header-scroll-container::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(229, 231, 235, 0.5)'};
          border-radius: 4px;
        }
        .header-scroll-container::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(99, 102, 241, 0.5)' : 'rgba(99, 102, 241, 0.3)'};
          border-radius: 4px;
        }
        .header-scroll-container::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(99, 102, 241, 0.7)' : 'rgba(99, 102, 241, 0.5)'};
        }
        .data-scroll-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .data-scroll-container::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(229, 231, 235, 0.5)'};
          border-radius: 4px;
        }
        .data-scroll-container::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(99, 102, 241, 0.5)' : 'rgba(99, 102, 241, 0.3)'};
          border-radius: 4px;
        }
        .data-scroll-container::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(99, 102, 241, 0.7)' : 'rgba(99, 102, 241, 0.5)'};
        }
        .data-scroll-container::-webkit-scrollbar-corner {
          background: ${isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(229, 231, 235, 0.5)'};
        }
      `}</style>
      <DashboardLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: isDark 
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e1b4b 100%)'
          : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f4ff 100%)',
        position: 'relative'
      }}>
        {/* Animated background gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDark
            ? 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(249, 171, 0, 0.1) 0%, transparent 50%)'
            : 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(249, 171, 0, 0.06) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />
        {/* Apollo-Style Action Bar - Top Bar */}
        <ApolloActionBar
          title="Prospects"
          viewType={viewTypeSelector}
          onViewChange={setViewTypeSelector}
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          filtersVisible={filtersVisible}
          onToggleFilters={() => setFiltersVisible(!filtersVisible)}
          activeFiltersCount={activeFiltersCount}
          selectedCount={selectedIds.size}
          totalCount={filteredListings.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onImport={() => setShowImportModal(true)}
          onSaveSearch={() => alert('Save search functionality coming soon')}
          onCreateWorkflow={() => alert('Create workflow functionality coming soon')}
          onRunAIPrompt={() => {
            // AI Insights functionality - can be implemented as a modal or separate view
            alert('AI Insights functionality coming soon')
          }}
          isDark={isDark}
        />

        {/* Summary Stats Bar - Colorful Apollo-style (Total, Net New, Saved) */}
        <div style={{
          padding: '16px 24px',
          borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.1)',
          display: 'flex',
          gap: '12px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)',
          boxShadow: isDark
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1
        }}>
          {[
            { 
              value: 'total', 
              label: 'Total', 
              count: totalCount,
              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              hoverGradient: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
              icon: '📊'
            },
            { 
              value: 'net_new', 
              label: 'Net New', 
              count: netNewCount,
              gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              hoverGradient: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
              icon: '✨'
            },
            { 
              value: 'saved', 
              label: 'Saved', 
              count: savedCount,
              gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              hoverGradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              icon: '⭐'
            }
          ].map((option, index) => {
            const isSelected = viewType === option.value
            return (
              <button
                key={option.value}
                onClick={() => setViewType(option.value as 'total' | 'net_new' | 'saved')}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '12px',
                  background: isSelected ? option.gradient : (isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)'),
                  color: isSelected ? '#ffffff' : (isDark ? '#e2e8f0' : '#374151'),
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: isSelected ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isSelected 
                    ? '0 10px 25px -5px rgba(99, 102, 241, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' 
                    : '0 2px 4px rgba(0, 0, 0, 0.05)',
                  transform: isSelected ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = option.gradient
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(99, 102, 241, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
                  } else {
                    e.currentTarget.style.background = option.hoverGradient
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)'
                    e.currentTarget.style.color = isDark ? '#e2e8f0' : '#374151'
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = isDark ? '0 2px 4px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
                  } else {
                    e.currentTarget.style.background = option.gradient
                  }
                }}
              >
                <span style={{ fontSize: '18px', filter: isSelected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none' }}>
                  {option.icon}
                </span>
                <span>{option.label}</span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(255, 255, 255, 0.25)' : (isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'),
                  color: isSelected ? '#ffffff' : (isDark ? '#818cf8' : '#6366f1'),
                  fontSize: '13px',
                  fontWeight: 700,
                  minWidth: '32px',
                  textAlign: 'center',
                  backdropFilter: 'blur(10px)',
                  border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : (isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)'),
                  transition: 'all 0.3s ease'
                }}>
                  {option.count.toLocaleString()}
                </span>
              </button>
            )
          })}
          
          {/* Select All Button - Only shown when viewing saved listings */}
          {viewType === 'saved' && savedCount > 0 && filteredListings.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => {
                  // When viewing saved listings, filteredListings already contains only saved listings
                  // Select all currently visible saved listings (after filters/search)
                  const allVisibleSavedIds = filteredListings.map(listing => listing.listing_id)
                  
                  if (allVisibleSavedIds.length > 0) {
                    const newSelected = new Set(selectedIds)
                    allVisibleSavedIds.forEach(id => newSelected.add(id))
                    setSelectedIds(newSelected)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  border: isDark ? '2px solid rgba(79, 172, 254, 0.3)' : '2px solid rgba(79, 172, 254, 0.2)',
                  borderRadius: '10px',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(79, 172, 254, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%)'
                    : 'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%)',
                  color: isDark ? '#7dd3fc' : '#0284c7',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 8px rgba(79, 172, 254, 0.2)',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                  e.currentTarget.style.color = '#ffffff'
                  e.currentTarget.style.borderColor = '#4facfe'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(79, 172, 254, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark
                    ? 'linear-gradient(135deg, rgba(79, 172, 254, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%)'
                    : 'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%)'
                  e.currentTarget.style.color = isDark ? '#7dd3fc' : '#0284c7'
                  e.currentTarget.style.borderColor = isDark ? 'rgba(79, 172, 254, 0.3)' : 'rgba(79, 172, 254, 0.2)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 172, 254, 0.2)'
                }}
              >
                <CheckSquare size={16} />
                <span>Select All Saved</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
                  color: isDark ? '#ffffff' : '#0284c7',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginLeft: '4px'
                }}>
                  {filteredListings.length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area - Sidebar + Content */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          {/* Filter Sidebar - Left Side */}
          {filtersVisible && (
            <ApolloFilterSidebar
              filters={apolloFilters}
              onFiltersChange={setApolloFilters}
              totalCount={totalCount}
              netNewCount={netNewCount}
              savedCount={savedCount}
              isCollapsed={!filtersVisible}
              onToggleCollapse={() => setFiltersVisible(!filtersVisible)}
              listings={allListings}
              isDark={isDark}
            />
          )}

          {/* Main Content Area - Right Side */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: isDark ? '#0f172a' : '#ffffff',
            minWidth: 0
          }}>

            {viewTypeSelector === 'map' && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <MapView 
                  isActive={true}
                  listings={filteredListings.map(l => ({
                    id: l.listing_id || l.property_url || '',
                    address: l.street || 'Address not available',
                    city: l.city || '',
                    state: l.state || '',
                    zip: l.zip_code || '',
                    price: l.list_price || 0,
                    price_drop_percent: l.list_price_min && l.list_price 
                      ? ((l.list_price_min - l.list_price) / l.list_price_min) * 100 
                      : 0,
                    days_on_market: l.time_listed ? parseInt(l.time_listed) : (l.created_at ? Math.floor((Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0),
                    url: l.property_url || '',
                    latitude: l.lat ? Number(l.lat) : undefined,
                    longitude: l.lng ? Number(l.lng) : undefined,
                    beds: l.beds || undefined,
                    sqft: l.sqft || undefined,
                    year_built: l.year_built || undefined,
                    description: l.text || undefined,
                    agent_name: l.agent_name || undefined,
                    agent_email: l.agent_email || undefined,
                    expired: l.status?.toLowerCase().includes('expired') || false,
                    geo_source: l.listing_source_name || null,
                    enrichment_confidence: null
                  }))} 
                  loading={listingsLoading} 
                  onStreetViewListingClick={(leadId) => {
                    // Find the listing by listing_id or property_url
                    const listing = filteredListings.find(
                      l => (l.listing_id || l.property_url) === leadId
                    );
                    if (listing) {
                      setSelectedListingId(listing.listing_id || listing.property_url || null);
                      setShowLeadModal(true);
                    }
                  }}
                />
              </div>
            )}

            {/* Table View - Apollo.io Contact List */}
            {viewTypeSelector === 'table' && (
              <>
                {/* Bulk Actions Bar - Shows when items are selected */}
                {selectedIds.size > 0 && (
                  <div style={{
                    padding: '12px 24px',
                    borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e5e7eb',
                    background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '48px'
                  }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '14px',
                      color: isDark ? '#e2e8f0' : '#111827',
                      fontWeight: 500
                    }}>
                      {selectedIds.size} selected
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(() => {
                        // Check how many selected items are already saved
                        const selectedListings = listings.filter(l => selectedIds.has(l.listing_id))
                        const unsavedCount = selectedListings.filter(listing => {
                          const sourceId = listing.listing_id || listing.property_url
                          return sourceId && !crmContactIds.has(sourceId)
                        }).length
                        const allSaved = unsavedCount === 0 && selectedIds.size > 0
                        
                        return (
                          <button
                            onClick={() => handleBulkSave()}
                            disabled={allSaved}
                            style={{
                              padding: '6px 16px',
                              border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #d1d5db',
                              borderRadius: '6px',
                              background: allSaved 
                                ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f3f4f6')
                                : (isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'),
                              color: allSaved
                                ? (isDark ? '#64748b' : '#9ca3af')
                                : (isDark ? '#e2e8f0' : '#374151'),
                              cursor: allSaved ? 'not-allowed' : 'pointer',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '14px',
                              fontWeight: 400,
                              transition: 'all 0.15s ease',
                              opacity: allSaved ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!allSaved) {
                                e.currentTarget.style.background = isDark ? 'rgba(99, 102, 241, 0.2)' : '#f9fafb'
                                e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.5)' : '#9ca3af'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!allSaved) {
                                e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'
                                e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.3)' : '#d1d5db'
                              }
                            }}
                            title={allSaved ? 'All selected prospects are already saved' : 'Save selected prospects'}
                          >
                            Save{allSaved ? ' (All Saved)' : ''}
                          </button>
                        )
                      })()}
                      <button
                        onClick={() => setShowAddToListModal(true)}
                        style={{
                          padding: '6px 16px',
                          border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                          color: isDark ? '#e2e8f0' : '#374151',
                          cursor: 'pointer',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          fontSize: '14px',
                          fontWeight: 400,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(99, 102, 241, 0.2)' : '#f9fafb'
                          e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.5)' : '#9ca3af'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'
                          e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.3)' : '#d1d5db'
                        }}
                      >
                        Add to Lists
                      </button>
                      <button
                        onClick={() => setShowAddToCampaignModal(true)}
                        style={{
                          padding: '6px 16px',
                          border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                          color: isDark ? '#e2e8f0' : '#374151',
                          cursor: 'pointer',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          fontSize: '14px',
                          fontWeight: 400,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(99, 102, 241, 0.2)' : '#f9fafb'
                          e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.5)' : '#9ca3af'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff'
                          e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.3)' : '#d1d5db'
                        }}
                      >
                        Add to Campaigns
                      </button>
                    </div>
                  </div>
                )}

                {/* Contact List Container - Apollo.io Style */}
                <div 
                  className="prospect-table-container"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    background: isDark ? '#0f172a' : '#ffffff',
                    position: 'relative',
                    minHeight: 0,
                    width: '100%',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}>
                  {/* Virtualized Table for Performance (1M+ listings) - Apollo-style Architecture */}
                  {/* Only use virtualized table for table-based categories (all except "all" aggregate) */}
                  {shouldUseVirtualizedTable ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                      {/* Single Scroll Container - Scrolls horizontally and expands vertically */}
                      <div 
                        ref={dataScrollContainerRef}
                        className="data-scroll-container"
                        style={{ 
                          width: '100%',
                          overflowX: 'auto',
                          overflowY: 'auto',
                          position: 'relative',
                          scrollbarWidth: 'thin',
                          scrollbarColor: isDark ? 'rgba(99, 102, 241, 0.5) rgba(15, 23, 42, 0.3)' : 'rgba(99, 102, 241, 0.3) rgba(229, 231, 235, 0.5)'
                        }}
                      >
                        {/* Sticky Header - INSIDE scroll container, scrolls with data */}
                        <div 
                          ref={headerScrollRef}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: isDark ? '2px solid rgba(99, 102, 241, 0.2)' : '2px solid #e5e7eb',
                            background: isDark ? 'rgba(30, 41, 59, 0.95)' : '#f9fafb',
                            position: 'sticky',
                            top: 0,
                            zIndex: 15,
                            minHeight: '48px',
                            width: 'max-content',
                            minWidth: '100%'
                          }}>
                          {/* Checkbox Column */}
                          <div style={{ 
                            marginRight: '16px', 
                            flexShrink: 0, 
                            width: '18px',
                            display: 'flex',
                            alignItems: 'center'
                          }} />
                          
                          {/* Address Column */}
                          <div style={{ 
                            flex: '0 0 280px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Address
                            </span>
                          </div>
                          
                          {/* Price Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Price
                            </span>
                          </div>
                          
                          {/* Status Column */}
                          <div style={{ 
                            flex: '0 0 120px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Status
                            </span>
                          </div>
                          
                          {/* AI Score Column */}
                          <div style={{ 
                            flex: '0 0 100px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              AI Score
                            </span>
                          </div>
                          
                          {/* Total Beds Column */}
                          <div style={{ 
                            flex: '0 0 100px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Total Beds
                            </span>
                          </div>

                          {/* Total Baths Column */}
                          <div style={{ 
                            flex: '0 0 110px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Total Baths
                            </span>
                          </div>

                          {/* Housing Square Feet Column */}
                          <div style={{ 
                            flex: '0 0 140px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Housing Square Feet
                            </span>
                          </div>

                          {/* Description Column */}
                          <div style={{ 
                            flex: '0 0 200px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Description
                            </span>
                          </div>

                          {/* Agent Name Column */}
                          <div style={{ 
                            flex: '0 0 150px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Name
                            </span>
                          </div>

                          {/* Agent Email Column */}
                          <div style={{ 
                            flex: '0 0 180px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Email
                            </span>
                          </div>

                          {/* Agent Phone Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Phone
                            </span>
                          </div>

                          {/* Agent Phone 2 Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Phone 2
                            </span>
                          </div>

                          {/* Listing Agent Phone 2 Column */}
                          <div style={{ 
                            flex: '0 0 160px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Listing Agent Phone 2
                            </span>
                          </div>

                          {/* Listing Agent Phone Column */}
                          <div style={{ 
                            flex: '0 0 160px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Listing Agent Phone
                            </span>
                          </div>

                          {/* Year Built Column */}
                          <div style={{ 
                            flex: '0 0 100px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Year Built
                            </span>
                          </div>

                          {/* Last Sale Price Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Last Sale Price
                            </span>
                          </div>

                          {/* Last Sale Date Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Last Sale Date
                            </span>
                          </div>
                          
                          {/* Actions Column */}
                          <div style={{ 
                            flexShrink: 0,
                            width: '120px',
                            display: 'flex',
                            justifyContent: 'flex-end'
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Actions
                            </span>
                          </div>
                        </div>

                        {/* Virtualized Table Content - Inside scroll container */}
                        {/* When activeCategory is 'all', pass listings prop to use aggregated data instead of fetching from single table */}
                        <VirtualizedListingsTable
                          scrollContainerRef={dataScrollContainerRef}
                          tableName={activeCategory === 'all' ? undefined : resolvedTableName}
                          listings={activeCategory === 'all' ? filteredListings : undefined}
                          filters={{
                            search: searchTerm,
                            city: apolloFilters.city?.[0],
                            state: apolloFilters.state?.[0],
                            minPrice: apolloFilters.price_range?.min?.toString(),
                            maxPrice: apolloFilters.price_range?.max?.toString(),
                            status: apolloFilters.status?.[0]
                          }}
                          sortBy={sortBy === 'price_high' ? 'list_price' : sortBy === 'price_low' ? 'list_price' : sortBy === 'date_new' ? 'created_at' : sortBy === 'date_old' ? 'created_at' : sortBy === 'score_high' ? 'ai_investment_score' : 'created_at'}
                          sortOrder={sortBy === 'price_low' || sortBy === 'date_old' ? 'asc' : 'desc'}
                          pagination={{
                            currentPage,
                            pageSize: itemsPerPage,
                            onPageChange: setCurrentPage,
                            onPageSizeChange: setItemsPerPage
                          }}
                          onStatsChange={(stats) => {
                            setRemoteListingsCount(stats.totalCount)
                            // Update totalPages if needed for proper pagination display
                          }}
                          onListingClick={(listing) => {
                            setSelectedListingId(listing.listing_id)
                            setShowLeadModal(true)
                          }}
                          selectedIds={selectedIds}
                          onSelect={(listingId, selected) => {
                            const newSelected = new Set(selectedIds)
                            if (selected) {
                              newSelected.add(listingId)
                            } else {
                              newSelected.delete(listingId)
                            }
                            setSelectedIds(newSelected)
                          }}
                          crmContactIds={crmContactIds}
                          onSave={handleSaveProspect}
                          category={activeCategory}
                          onAction={(action, listing) => {
                            if (action === 'email') {
                              handleGenerateEmail(listing as any)
                            } else if (action === 'call') {
                              if (listing.agent_phone) {
                                window.open(`tel:${listing.agent_phone}`)
                              }
                            } else if (action === 'save' || action === 'added_to_crm') {
                              handleSave(listing as any)
                            } else if (action === 'unsave' || action === 'removed_from_crm') {
                              handleSaveProspect(listing as any, false)
                            } else if (action === 'view') {
                              setSelectedListingId(listing.listing_id)
                              setShowLeadModal(true)
                            }
                          }}
                          isDark={isDark}
                          showSummary={false}
                          showPagination={false}
                        />
                      </div>

                      {/* Sticky Footer - Pagination (outside scroll container) */}
                      <div style={{
                        position: 'sticky',
                        bottom: 0,
                        background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                        borderTop: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e5e7eb',
                        zIndex: 20,
                        padding: '12px 24px',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <ApolloPagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          pageSize={itemsPerPage}
                          totalItems={activeTableItemCount}
                          onPageChange={setCurrentPage}
                          onPageSizeChange={setItemsPerPage}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                  ) : listingsLoading ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '48px',
                      color: isDark ? '#94a3b8' : '#6b7280',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '14px'
                    }}>
                      Loading prospects...
                    </div>
                  ) : paginatedListings.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '48px',
                      color: isDark ? '#94a3b8' : '#6b7280',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '14px'
                    }}>
                      No prospects found
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
                      {/* Scroll Container with Header Inside */}
                      <div 
                        ref={dataScrollContainerRef}
                        className="data-scroll-container"
                        style={{ 
                          width: '100%',
                          overflowX: 'auto',
                          overflowY: 'auto',
                          position: 'relative',
                          scrollbarWidth: 'thin',
                          scrollbarColor: isDark ? 'rgba(99, 102, 241, 0.5) rgba(15, 23, 42, 0.3)' : 'rgba(99, 102, 241, 0.3) rgba(229, 231, 235, 0.5)'
                        }}
                      >
                        {/* Sticky Header - INSIDE scroll container, scrolls with data */}
                        <div 
                          ref={headerScrollRef}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: isDark ? '2px solid rgba(99, 102, 241, 0.2)' : '2px solid #e5e7eb',
                            background: isDark ? 'rgba(30, 41, 59, 0.95)' : '#f9fafb',
                            position: 'sticky',
                            top: 0,
                            zIndex: 15,
                            minHeight: '48px',
                            width: 'max-content',
                            minWidth: '100%'
                          }}>
                          {/* Checkbox Column */}
                          <div style={{ 
                            marginRight: '16px', 
                            flexShrink: 0, 
                            width: '18px',
                            display: 'flex',
                            alignItems: 'center'
                          }} />
                          
                          {/* Address Column */}
                          <div style={{ 
                            flex: '0 0 280px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Address
                            </span>
                          </div>
                          
                          {/* Price Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Price
                            </span>
                          </div>
                          
                          {/* Status Column */}
                          <div style={{ 
                            flex: '0 0 120px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Status
                            </span>
                          </div>
                          
                          {/* AI Score Column */}
                          <div style={{ 
                            flex: '0 0 100px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              AI Score
                            </span>
                          </div>
                          
                          {/* Total Beds Column */}
                          <div style={{ 
                            flex: '0 0 100px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Total Beds
                            </span>
                          </div>

                          {/* Total Baths Column */}
                          <div style={{ 
                            flex: '0 0 110px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Total Baths
                            </span>
                          </div>

                          {/* Housing Square Feet Column */}
                          <div style={{ 
                            flex: '0 0 140px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Housing Square Feet
                            </span>
                          </div>

                          {/* Description Column */}
                          <div style={{ 
                            flex: '0 0 200px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Description
                            </span>
                          </div>

                          {/* Agent Name Column */}
                          <div style={{ 
                            flex: '0 0 150px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Name
                            </span>
                          </div>

                          {/* Agent Email Column */}
                          <div style={{ 
                            flex: '0 0 180px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Email
                            </span>
                          </div>

                          {/* Agent Phone Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Phone
                            </span>
                          </div>

                          {/* Agent Phone 2 Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Agent Phone 2
                            </span>
                          </div>

                          {/* Listing Agent Phone 2 Column */}
                          <div style={{ 
                            flex: '0 0 160px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Listing Agent Phone 2
                            </span>
                          </div>

                          {/* Listing Agent Phone Column */}
                          <div style={{ 
                            flex: '0 0 160px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Listing Agent Phone
                            </span>
                          </div>

                          {/* Year Built Column */}
                          <div style={{ 
                            flex: '0 0 100px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Year Built
                            </span>
                          </div>

                          {/* Last Sale Price Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Last Sale Price
                            </span>
                          </div>

                          {/* Last Sale Date Column */}
                          <div style={{ 
                            flex: '0 0 130px', 
                            marginRight: '24px',
                            minWidth: 0
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Last Sale Date
                            </span>
                          </div>
                          
                          {/* Actions Column */}
                          <div style={{ 
                            flexShrink: 0,
                            width: '120px',
                            display: 'flex',
                            justifyContent: 'flex-end'
                          }}>
                            <span style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isDark ? '#ffffff' : '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Actions
                            </span>
                          </div>
                        </div>

                        {/* Virtualized Table Content - Inside scroll container */}
                        {/* When activeCategory is 'all', pass listings prop to use aggregated data instead of fetching from single table */}
                        <VirtualizedListingsTable
                          scrollContainerRef={dataScrollContainerRef}
                          tableName={activeCategory === 'all' ? undefined : resolvedTableName}
                          listings={activeCategory === 'all' ? filteredListings : undefined}
                          filters={{
                            search: searchTerm,
                            city: apolloFilters.city?.[0],
                            state: apolloFilters.state?.[0],
                            minPrice: apolloFilters.price_range?.min?.toString(),
                            maxPrice: apolloFilters.price_range?.max?.toString(),
                            status: apolloFilters.status?.[0]
                          }}
                          sortBy={sortBy === 'price_high' ? 'list_price' : sortBy === 'price_low' ? 'list_price' : sortBy === 'date_new' ? 'created_at' : sortBy === 'date_old' ? 'created_at' : sortBy === 'score_high' ? 'ai_investment_score' : 'created_at'}
                          sortOrder={sortBy === 'price_low' || sortBy === 'date_old' ? 'asc' : 'desc'}
                          pagination={{
                            currentPage,
                            pageSize: itemsPerPage,
                            onPageChange: setCurrentPage,
                            onPageSizeChange: setItemsPerPage
                          }}
                          onStatsChange={(stats) => {
                            setRemoteListingsCount(stats.totalCount)
                            // Update totalPages if needed for proper pagination display
                          }}
                          onListingClick={(listing) => {
                            setSelectedListingId(listing.listing_id)
                            setShowLeadModal(true)
                          }}
                          selectedIds={selectedIds}
                          onSelect={(listingId, selected) => {
                            const newSelected = new Set(selectedIds)
                            if (selected) {
                              newSelected.add(listingId)
                            } else {
                              newSelected.delete(listingId)
                            }
                            setSelectedIds(newSelected)
                          }}
                          crmContactIds={crmContactIds}
                          onSave={handleSaveProspect}
                          category={activeCategory}
                          onAction={(action, listing) => {
                            if (action === 'email') {
                              handleGenerateEmail(listing as any)
                            } else if (action === 'call') {
                              if (listing.agent_phone) {
                                window.open(`tel:${listing.agent_phone}`)
                              }
                            } else if (action === 'save' || action === 'added_to_crm') {
                              handleSave(listing as any)
                            } else if (action === 'unsave' || action === 'removed_from_crm') {
                              handleSaveProspect(listing as any, false)
                            } else if (action === 'view') {
                              setSelectedListingId(listing.listing_id)
                              setShowLeadModal(true)
                            }
                          }}
                          isDark={isDark}
                          showSummary={false}
                          showPagination={false}
                        />
                      </div>

                      {/* Sticky Footer - Pagination (outside scroll container) */}
                      <div style={{
                        position: 'sticky',
                        bottom: 0,
                        background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                        borderTop: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e5e7eb',
                        zIndex: 20,
                        padding: '12px 24px',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <ApolloPagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          pageSize={itemsPerPage}
                          totalItems={activeTableItemCount}
                          onPageChange={setCurrentPage}
                          onPageSizeChange={setItemsPerPage}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lead Detail Modal */}
        {showLeadModal && selectedListingId && (
          <LeadDetailModal
            listingId={selectedListingId}
            listingList={paginatedListings}
            onClose={() => {
              setShowLeadModal(false)
              setSelectedListingId(null)
            }}
            onUpdate={(updatedListing) => {
              // Update the listing in the current list via hook
              updateListing(updatedListing)
            }}
          />
        )}

        {/* Import Leads Modal */}
        <ImportLeadsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(count) => {
            // Refresh listings after import
            fetchListingsData(selectedFilters, sortField, sortOrder)
            // Optionally navigate to imports view
            router.push('/dashboard/prospect-enrich?filter=imports')
          }}
        />

        {/* Email Template Modal */}
        {showEmailModal && selectedLead && (
          <EmailTemplateModal
            lead={selectedLead}
            onClose={() => {
              setShowEmailModal(false)
              setSelectedLead(null)
            }}
          />
        )}

        {/* Add to Lists Modal */}
        {showAddToListModal && (
          <AddToListModal
            supabase={supabase}
            profileId={profile?.id}
            selectedCount={selectedIds.size}
            onAddToList={handleBulkAddToList}
            onClose={() => setShowAddToListModal(false)}
            isDark={isDark}
          />
        )}

        {/* Add to Campaigns Modal */}
        {showAddToCampaignModal && profile?.id && (
          <AddToCampaignModal
            supabase={supabase}
            profileId={profile.id}
            selectedListings={listings.filter(l => selectedIds.has(l.listing_id || ''))}
            onClose={() => {
              setShowAddToCampaignModal(false)
              setSelectedIds(new Set()) // Clear selection after adding
            }}
            onSuccess={() => {
              // Refresh data if needed
              fetchCrmContacts(selectedFilters)
            }}
            isDark={isDark}
          />
        )}
      </div>
      </DashboardLayout>
    </>
  )
}

// Wrapper component that doesn't use useSearchParams
function ProspectEnrichContent() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f9fafb'
        }}>
          <div style={{
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <p style={{
              color: '#6b7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px'
            }}>Loading prospects...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              /* Horizontal scrollbar styling for prospect table */
              .prospect-table-container::-webkit-scrollbar {
                height: 12px;
              }
              .prospect-table-container::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 6px;
              }
              .prospect-table-container::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 6px;
              }
              .prospect-table-container::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
              }
              /* Firefox scrollbar */
              .prospect-table-container {
                scrollbar-width: thin;
                scrollbar-color: #cbd5e1 #f1f5f9;
              }
            `}</style>
          </div>
        </div>
      </DashboardLayout>
    }>
      <ProspectEnrichInner />
    </Suspense>
  )
}

// Export as default - must be client component since it uses hooks
export default ProspectEnrichContent
