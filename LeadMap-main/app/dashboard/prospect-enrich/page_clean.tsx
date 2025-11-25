'use client'

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApp } from '@/app/providers'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import LeadsTable from '@/components/LeadsTable'
import GoogleMapsView from '@/components/GoogleMapsView'
import EmailTemplateModal from '@/components/EmailTemplateModal'
import AddToCrmButton from './components/AddToCrmButton'
import ProspectInsights from './components/ProspectInsights'
import ApolloFilterSidebar from './components/ApolloFilterSidebar'
import ApolloActionBar from './components/ApolloActionBar'
import ApolloContactCard from './components/ApolloContactCard'
import ApolloPagination from './components/ApolloPagination'
import dynamic from 'next/dynamic'

// Dynamically import analytics component to avoid SSR issues with recharts
const ProspectAnalytics = dynamic(() => import('./components/ProspectAnalytics'), { 
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-xxl)',
      color: 'var(--color-ui-text-base-tertiary)'
    }}>
      Loading analytics...
    </div>
  )
})
import { postEnrichLeads } from '@/lib/api'
import { 
  Search, 
  Filter, 
  Download, 
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

interface Listing {
  listing_id: string
  property_url: string
  permalink?: string | null
  scrape_date?: string | null
  last_scraped_at?: string | null
  active?: boolean
  street?: string | null
  unit?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  beds?: number | null
  full_baths?: number | null
  half_baths?: number | null
  sqft?: number | null
  year_built?: number | null
  list_price?: number | null
  list_price_min?: number | null
  list_price_max?: number | null
  status?: string | null
  mls?: string | null
  agent_name?: string | null
  agent_email?: string | null
  agent_phone?: string | null
  photos?: string | null
  photos_json?: any
  other?: any
  price_per_sqft?: number | null
  listing_source_name?: string | null
  listing_source_id?: string | null
  monthly_payment_estimate?: string | null
  ai_investment_score?: number | null
  time_listed?: string | null
  created_at?: string
  updated_at?: string
  in_crm?: boolean
}

type FilterType = 'all' | 'expired' | 'probate' | 'geo' | 'enriched' | 'listings' | 'high_value' | 'price_drop' | 'new_listings'
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

function ProspectEnrichContent() {
  const { profile } = useApp()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeView, setActiveView] = useState<ViewType>('table')
  const [selectedFilters, setSelectedFilters] = useState<Set<FilterType>>(new Set<FilterType>(['all']))
  const [apolloFilters, setApolloFilters] = useState<Record<string, any>>({})
  const [filtersVisible, setFiltersVisible] = useState(true)
  const [viewTypeSelector, setViewTypeSelector] = useState<'database_analytics' | 'table' | 'cards' | 'map'>('table')
  const [sortBy, setSortBy] = useState('relevance')
  const [listings, setListings] = useState<Listing[]>([])
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [probateLeads, setProbateLeads] = useState<any[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Listing | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [crmContactIds, setCrmContactIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [showMarketSegments, setShowMarketSegments] = useState(false)
  const [viewType, setViewType] = useState<'total' | 'net_new' | 'saved'>('total')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [savedListings, setSavedListings] = useState<Listing[]>([])
  
  const supabase = useMemo(() => createClientComponentClient(), [])
  const fetchingRef = useRef(false)

  // Market Segments (Apollo.io style)
  const marketSegments = [
    { key: 'all', label: 'All Prospects', count: 0 },
    { key: 'expired', label: 'Expired Listings', count: 0 },
    { key: 'probate', label: 'Probate Leads', count: 0 },
    { key: 'geo', label: 'Geo Leads', count: 0 },
    { key: 'enriched', label: 'Enriched', count: 0 },
    { key: 'listings', label: 'Active Listings', count: 0 },
    { key: 'high_value', label: 'High Value', count: 0 },
    { key: 'price_drop', label: 'Price Drops', count: 0 },
    { key: 'new_listings', label: 'New Listings', count: 0 }
  ]

  // Fetch CRM contacts to exclude from prospecting
  const fetchCrmContacts = useCallback(async () => {
    if (!profile?.id) return
    
    try {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('source_id')
        .eq('user_id', profile.id)
        .eq('source', 'listing')
        .not('source_id', 'is', null)
      
      if (contacts) {
        const ids = new Set(contacts.map(c => c.source_id).filter(Boolean))
        setCrmContactIds(ids)
        
        // Fetch saved listings if we have contact IDs
        if (ids.size > 0) {
          const { data: savedData } = await supabase
            .from('listings')
            .select('*')
            .in('listing_id', Array.from(ids))
          
          if (savedData) {
            setSavedListings(savedData)
          }
        } else {
          setSavedListings([])
        }
      }
    } catch (error) {
      console.error('Error fetching CRM contacts:', error)
    }
  }, [supabase, profile?.id])

  const handleEnrich = async (listingId: string) => {
    try {
      await postEnrichLeads([listingId])
      fetchListings()
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

  const handleAddToCrm = async (lead: Listing) => {
    await fetchCrmContacts()
    await fetchListings()
  }

  const handleBulkAddToCrm = async () => {
    if (selectedIds.size === 0) return
    
    try {
      const selectedListings = listings.filter(l => selectedIds.has(l.listing_id))
      // Add each selected listing to CRM
      for (const listing of selectedListings) {
        await handleAddToCrm(listing)
      }
      setSelectedIds(new Set())
      alert(`Added ${selectedIds.size} leads to CRM`)
    } catch (error) {
      console.error('Bulk add error:', error)
      alert('Failed to add leads to CRM')
    }
  }

  const fetchListings = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    try {
      setListingsLoading(true)
      
      const { data: allData, error: allError } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (allError) throw allError

      const listingsWithCrmFlag = (allData || []).map(listing => ({
        ...listing,
        in_crm: crmContactIds.has(listing.listing_id)
      }))

      const availableListings = listingsWithCrmFlag.filter(l => !l.in_crm)
      setAllListings(availableListings)
      
      // Apply sorting to all available listings
      const sorted = [...availableListings].sort((a, b) => {
        let aValue: any = 0
        let bValue: any = 0

        switch (sortField) {
          case 'price':
            aValue = a.list_price || 0
            bValue = b.list_price || 0
            break
          case 'date':
            aValue = new Date(a.created_at || 0).getTime()
            bValue = new Date(b.created_at || 0).getTime()
            break
          case 'score':
            aValue = a.ai_investment_score || 0
            bValue = b.ai_investment_score || 0
            break
          case 'location':
            aValue = `${a.city || ''} ${a.state || ''}`.toLowerCase()
            bValue = `${b.city || ''} ${b.state || ''}`.toLowerCase()
            break
          case 'status':
            aValue = a.status || ''
            bValue = b.status || ''
            break
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
        }
      })

      setListings(sorted)
      
      // Fetch probate leads if needed
      if (selectedFilters.has('probate')) {
        try {
          const response = await fetch('/api/probate-leads').catch(() => ({ json: async () => ({ leads: [] }) }))
          const result = await response.json()
          setProbateLeads(result.leads || [])
        } catch (error) {
          console.error('Error fetching probate leads:', error)
        }
      }
      
      if (sorted.length > 0) {
        const mostRecent = sorted.reduce((latest, listing) => {
          const listingDate = listing.last_scraped_at ? new Date(listing.last_scraped_at) : null
          const latestDate = latest.last_scraped_at ? new Date(latest.last_scraped_at) : null
          if (!listingDate) return latest
          if (!latestDate) return listing
          return listingDate > latestDate ? listing : latest
        })
        
        if (mostRecent.last_scraped_at) {
          setLastUpdated(mostRecent.last_scraped_at)
        }
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      setListingsLoading(false)
      fetchingRef.current = false
    }
  }, [supabase, selectedFilters, crmContactIds, sortField, sortOrder])

  useEffect(() => {
    fetchCrmContacts()
  }, [fetchCrmContacts])

  useEffect(() => {
    if (profile?.id && !fetchingRef.current) {
      fetchListings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedFilters, crmContactIds, sortField, sortOrder])

  // Reset pagination when filters or view type change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedFilters, searchTerm, statusFilter, priceRange, viewType])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const viewParam = searchParams.get('view')
      if (viewParam === 'map') {
        setActiveView('map')
      }
      const searchParam = searchParams.get('search')
      if (searchParam) {
        setSearchTerm(searchParam)
      }
    } catch (error) {
      console.error('Error accessing search params:', error)
    }
  }, [searchParams])

  const toggleFilter = (filterKey: FilterType) => {
    setSelectedFilters(prev => {
      const newSet = new Set(prev)
      
      if (filterKey === 'all') {
        newSet.clear()
        newSet.add('all')
      } else {
        newSet.delete('all')
        if (newSet.has(filterKey)) {
          newSet.delete(filterKey)
          if (newSet.size === 0) {
            newSet.add('all')
          }
        } else {
          newSet.add(filterKey)
        }
      }
      
      return newSet
    })
  }

  const clearAllFilters = () => {
    setSelectedFilters(new Set<FilterType>(['all']))
    setSearchTerm('')
    setStatusFilter('all')
    setPriceRange({ min: '', max: '' })
    setSelectedIds(new Set())
  }

  const handleExportCSV = () => {
    const headers = ['Listing ID', 'Property URL', 'Street', 'Unit', 'City', 'State', 'Zip Code', 'List Price', 'Beds', 'Baths', 'Sqft', 'Status', 'Agent Name', 'Agent Email', 'Agent Phone', 'MLS', 'AI Score']
    const rows = listings.map(l => [
      l.listing_id || '',
      l.property_url || '',
      l.street || '',
      l.unit || '',
      l.city || '',
      l.state || '',
      l.zip_code || '',
      (l.list_price || 0).toString(),
      (l.beds || '').toString(),
      (l.full_baths || '').toString(),
      (l.sqft || '').toString(),
      l.status || '',
      l.agent_name || '',
      l.agent_email || '',
      l.agent_phone || '',
      l.mls || '',
      (l.ai_investment_score || '').toString()
    ])
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects-${Array.from(selectedFilters).join('-')}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Calculate filter counts based on current view type
  const filterCounts = useMemo(() => {
    const sourceListings = viewType === 'saved' ? savedListings : allListings
    const counts: Record<FilterType, number> = {
      all: sourceListings.length,
      expired: 0,
      probate: probateLeads.length,
      geo: 0,
      enriched: 0,
      listings: 0,
      high_value: 0,
      price_drop: 0,
      new_listings: 0
    }

    sourceListings.forEach(listing => {
      if (listing.status && (
        listing.status.toLowerCase().includes('expired') ||
        listing.status.toLowerCase().includes('sold') ||
        listing.status.toLowerCase().includes('off market')
      )) counts.expired++
      
      if (listing.city && listing.state) counts.geo++
      
      if (listing.agent_email || listing.agent_phone || listing.agent_name || listing.ai_investment_score) counts.enriched++
      
      if (listing.active === true) counts.listings++
      
      if ((listing.list_price || 0) >= 500000) counts.high_value++
      
      if (listing.list_price_min && listing.list_price) {
        const drop = ((listing.list_price_min - listing.list_price) / listing.list_price_min) * 100
        if (drop > 0) counts.price_drop++
      }
      
      if (listing.created_at) {
        const daysSince = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince <= 7) counts.new_listings++
      }
    })

    return counts
  }, [allListings, savedListings, probateLeads.length, viewType])

  const activeFiltersCount = Object.keys(apolloFilters).length

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
        if (apolloFilters.price_range.min && price < apolloFilters.price_range.min) return false
        if (apolloFilters.price_range.max && price > apolloFilters.price_range.max) return false
      }

      // Location
      if (apolloFilters.location && Array.isArray(apolloFilters.location) && apolloFilters.location.length > 0) {
        const locationMatch = apolloFilters.location.some((loc: string) => {
          return listing.city?.toLowerCase().includes(loc.toLowerCase()) ||
                 listing.state?.toLowerCase().includes(loc.toLowerCase()) ||
                 listing.zip_code?.includes(loc)
        })
        if (!locationMatch) return false
      }

      // Beds
      if (apolloFilters.beds && Array.isArray(apolloFilters.beds) && apolloFilters.beds.length > 0) {
        const beds = listing.beds || 0
        const bedsMatch = apolloFilters.beds.some((bed: string) => beds >= parseInt(bed))
        if (!bedsMatch) return false
      }

      // Baths
      if (apolloFilters.baths && Array.isArray(apolloFilters.baths) && apolloFilters.baths.length > 0) {
        const baths = listing.full_baths || 0
        const bathsMatch = apolloFilters.baths.some((bath: string) => baths >= parseInt(bath))
        if (!bathsMatch) return false
      }

      // Square footage
      if (apolloFilters.sqft) {
        const sqft = listing.sqft || 0
        if (apolloFilters.sqft.min && sqft < apolloFilters.sqft.min) return false
        if (apolloFilters.sqft.max && sqft > apolloFilters.sqft.max) return false
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

      // Enriched
      if (apolloFilters.enriched && !(listing.agent_email || listing.agent_phone || listing.agent_name || listing.ai_investment_score)) return false

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

  // Get base listings based on viewType, then apply Apollo filters and sorting
  const baseListings = useMemo(() => {
    let sourceListings: Listing[]
    
    switch (viewType) {
      case 'total':
        sourceListings = listings
        break
      case 'net_new': {
        // Net new = listings created in last 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
        sourceListings = listings.filter(l => {
          if (!l.created_at) return false
          return new Date(l.created_at).getTime() >= thirtyDaysAgo
        })
        break
      }
      case 'saved':
        sourceListings = savedListings
        break
      default:
        sourceListings = listings
    }
    
    // Apply Apollo filters
    let filtered = applyApolloFilters(sourceListings)
    
    // Apply sorting based on sortBy
    return [...filtered].sort((a, b) => {
      let aValue: any = 0
      let bValue: any = 0

      switch (sortBy) {
        case 'price_high':
          aValue = a.list_price || 0
          bValue = b.list_price || 0
          return bValue - aValue
        case 'price_low':
          aValue = a.list_price || 0
          bValue = b.list_price || 0
          return aValue - bValue
        case 'score_high':
          aValue = a.ai_investment_score || 0
          bValue = b.ai_investment_score || 0
          return bValue - aValue
        case 'date_new':
          aValue = new Date(a.created_at || 0).getTime()
          bValue = new Date(b.created_at || 0).getTime()
          return bValue - aValue
        case 'date_old':
          aValue = new Date(a.created_at || 0).getTime()
          bValue = new Date(b.created_at || 0).getTime()
          return aValue - bValue
        case 'relevance':
        default:
          // Relevance: prioritize high AI scores, then recent, then price
          const aScore = a.ai_investment_score || 0
          const bScore = b.ai_investment_score || 0
          if (aScore !== bScore) return bScore - aScore
          const aDate = new Date(a.created_at || 0).getTime()
          const bDate = new Date(b.created_at || 0).getTime()
          if (aDate !== bDate) return bDate - aDate
          return (b.list_price || 0) - (a.list_price || 0)
      }
    })
  }, [listings, savedListings, viewType, applyApolloFilters, sortBy])

  const filteredListings = useMemo(() => {
    return baseListings.filter(l => {
      const address = `${l.street || ''} ${l.city || ''} ${l.state || ''}`.toLowerCase()
      const matchesSearch = !searchTerm || 
        address.includes(searchTerm.toLowerCase()) ||
        (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.state && l.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.zip_code && l.zip_code.includes(searchTerm)) ||
        (l.listing_id && l.listing_id.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && l.active) ||
        (statusFilter === 'expired' && !l.active)
      
      const price = l.list_price || 0
      const matchesPrice = 
        (!priceRange.min || price >= parseInt(priceRange.min)) &&
        (!priceRange.max || price <= parseInt(priceRange.max))
      
      return matchesSearch && matchesStatus && matchesPrice
    })
  }, [baseListings, searchTerm, statusFilter, priceRange])

  // Calculate view-specific counts
  const totalCount = allListings.length
  const netNewCount = useMemo(() => {
    // Net new = listings created in last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    return allListings.filter(l => {
      if (!l.created_at) return false
      return new Date(l.created_at).getTime() >= thirtyDaysAgo
    }).length
  }, [allListings])
  const savedCount = savedListings.length

  // Pagination
  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredListings.slice(start, end)
  }, [filteredListings, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage)

  return (
    <DashboardLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-ui-background-secondary)'
      }}>
        {/* Apollo-Style Action Bar */}
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
          onImport={() => router.push('/admin')}
          onExport={handleExportCSV}
          onSaveSearch={() => alert('Save search functionality coming soon')}
          onCreateWorkflow={() => alert('Create workflow functionality coming soon')}
          onRunAIPrompt={() => setActiveView('insights')}
        />

        {/* Main Content Area */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Apollo Filter Sidebar */}
          {filtersVisible && (
            <ApolloFilterSidebar
              filters={apolloFilters}
              onFiltersChange={setApolloFilters}
              totalCount={totalCount}
              netNewCount={netNewCount}
              savedCount={savedCount}
              isCollapsed={!filtersVisible}
              onToggleCollapse={() => setFiltersVisible(!filtersVisible)}
            />
          )}

          {/* Results Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--color-ui-background-primary)'
          }}>
            {/* View Tabs for Analytics/Insights */}
            {(activeView === 'analytics' || activeView === 'insights') && (
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderBottom: '1px solid var(--color-ui-border-default)',
                background: 'var(--color-ui-background-secondary)'
              }}>
                <button
                  onClick={() => setActiveView('analytics')}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    border: 'none',
                    background: activeView === 'analytics' ? 'var(--color-base-ocean-50)' : 'transparent',
                    color: activeView === 'analytics' ? 'white' : 'var(--color-ui-text-base-primary)',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    fontFamily: 'var(--family-base-body)',
                    fontSize: 'var(--type-size-step-2)',
                    fontWeight: activeView === 'analytics' ? 'var(--weight-medium)' : 'var(--weight-regular)'
                  }}
                >
                  Analytics
                </button>
                <button
                  onClick={() => setActiveView('insights')}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    border: 'none',
                    background: activeView === 'insights' ? 'var(--color-base-ocean-50)' : 'transparent',
                    color: activeView === 'insights' ? 'white' : 'var(--color-ui-text-base-primary)',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    fontFamily: 'var(--family-base-body)',
                    fontSize: 'var(--type-size-step-2)',
                    fontWeight: activeView === 'insights' ? 'var(--weight-medium)' : 'var(--weight-regular)'
                  }}
                >
                  AI Insights
                </button>
              </div>
            )}

            {/* Content based on view */}
            {activeView === 'analytics' && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ProspectAnalytics listings={filteredListings} loading={listingsLoading} />
              </div>
            )}

            {activeView === 'insights' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-lg)' }}>
                <ProspectInsights listings={filteredListings} />
              </div>
            )}

            {activeView === 'map' && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <GoogleMapsView listings={filteredListings} loading={listingsLoading} />
              </div>
            )}

            {(activeView === 'table' || !activeView) && (
              <>
                {/* Contact List Header */}
                <div style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: '1px solid var(--color-ui-border-default)',
                  background: 'var(--color-ui-background-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)'
                }}>
                  <button
                    onClick={() => {
                      const allSelected = paginatedListings.every(l => selectedIds.has(l.listing_id))
                      if (allSelected) {
                        setSelectedIds(new Set())
                      } else {
                        setSelectedIds(new Set(paginatedListings.map(l => l.listing_id)))
                      }
                    }}
                    style={{
                      padding: 'var(--spacing-xs)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {paginatedListings.length > 0 && paginatedListings.every(l => selectedIds.has(l.listing_id)) ? (
                      <CheckSquare style={{ width: '18px', height: '18px', color: 'var(--color-ui-text-base-primary)' }} />
                    ) : (
                      <Square style={{ width: '18px', height: '18px', color: 'var(--color-ui-text-base-primary)' }} />
                    )}
                  </button>
                  {selectedIds.size > 0 && (
                    <>
                      <span style={{
                        fontFamily: 'var(--family-base-body)',
                        fontSize: 'var(--type-size-step-2)',
                        color: 'var(--color-ui-text-base-primary)'
                      }}>
                        {selectedIds.size} selected
                      </span>
                      <button
                        onClick={handleBulkAddToCrm}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-md)',
                          border: '1px solid var(--color-ui-border-default)',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--color-base-ocean-50)',
                          color: 'white',
                          cursor: 'pointer',
                          fontFamily: 'var(--family-base-body)',
                          fontSize: 'var(--type-size-step-2)'
                        }}
                      >
                        Add to CRM
                      </button>
                    </>
                  )}
                </div>

                {/* Contact Cards List */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto'
                }}>
                  {listingsLoading ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 'var(--spacing-xxl)',
                      color: 'var(--color-ui-text-base-tertiary)'
                    }}>
                      Loading prospects...
                    </div>
                  ) : paginatedListings.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 'var(--spacing-xxl)',
                      color: 'var(--color-ui-text-base-tertiary)'
                    }}>
                      No prospects found
                    </div>
                  ) : (
                    paginatedListings.map((listing) => (
                      <ApolloContactCard
                        key={listing.listing_id}
                        listing={listing}
                        isSelected={selectedIds.has(listing.listing_id)}
                        onSelect={(id, selected) => {
                          const newSelected = new Set(selectedIds)
                          if (selected) {
                            newSelected.add(id)
                          } else {
                            newSelected.delete(id)
                          }
                          setSelectedIds(newSelected)
                        }}
                        onAction={(action, listing) => {
                          if (action === 'email') {
                            handleGenerateEmail(listing)
                          } else if (action === 'call') {
                            if (listing.agent_phone) {
                              window.open(`tel:${listing.agent_phone}`)
                            }
                          } else if (action === 'added_to_crm') {
                            handleAddToCrm(listing)
                          }
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <ApolloPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={itemsPerPage}
                    totalItems={filteredListings.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setItemsPerPage}
                  />
                )}
              </>
            )}
          </div>
        </div>

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
      </div>
    </DashboardLayout>
  )
}

export default function ProspectEnrichPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading prospects...</p>
        </div>
      </div>
    }>
      <ProspectEnrichContent />
    </Suspense>
  )
}

        {/* Quick Stats Bar */}
