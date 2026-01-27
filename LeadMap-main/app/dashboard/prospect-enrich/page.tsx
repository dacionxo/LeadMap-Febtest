'use client'

import { normalizeListingIdentifier } from '@/app/dashboard/lists/utils/identifierUtils'
import { useApp } from '@/app/providers'
import EmailTemplateModal from '@/components/EmailTemplateModal'
import { useTheme } from '@/components/ThemeProvider'
import { postEnrichLeads } from '@/lib/api'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useSidebar } from '../components/SidebarContext'
import AddToCampaignModal from './components/AddToCampaignModal'
import AddToListModal from './components/AddToListModal'
import ImportLeadsModal from './components/ImportLeadsModal'
import LeadDetailModal from './components/LeadDetailModal'
import ProspectHoverTable from './components/ProspectHoverTable'
import ProspectSearchHeader from './components/ProspectSearchHeader'
import ProspectFilterSidebar from './components/ProspectFilterSidebar'
import SelectionActionBar from './components/SelectionActionBar'
import MapView from '@/components/MapView'
import { FilterType, getPrimaryCategory, Listing, useProspectData } from './hooks/useProspectData'
import { add_to_list } from './utils/listUtils'

type ViewType = 'table' | 'map' | 'analytics' | 'insights'
type SortField = 'price' | 'date' | 'score' | 'location' | 'status'
type SortOrder = 'asc' | 'desc'

// MapView lead type (structural match to MapView's Lead interface)
type MapLead = {
  id: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  price_drop_percent: number
  days_on_market: number
  url: string
  latitude?: number
  longitude?: number
  property_type?: string
  beds?: number
  sqft?: number
  year_built?: number
  description?: string
  agent_name?: string
  agent_email?: string
  primary_photo?: string
  expired?: boolean
  geo_source?: string | null
  owner_email?: string
  enrichment_confidence?: number | null
}

const listingToMapLead = (listing: Listing): MapLead => {
  const hasValue = (val: any): boolean => val != null && String(val).trim().length > 0

  // Address
  let address = (listing as any).address || listing.street || ''
  if (!address || address.trim() === '') {
    const addressParts = [listing.street, (listing as any).unit]
      .filter((val) => hasValue(val))
      .map((val) => String(val).trim())
    if (addressParts.length > 0) {
      address = addressParts.join(' ')
    }
  }

  const city = listing.city || ''
  const state = listing.state || ''
  const zip = (listing as any).zip || listing.zip_code || ''

  // Price drop percent
  let priceDropPercent = 0
  if (listing.list_price_min && listing.list_price && listing.list_price_min > listing.list_price) {
    priceDropPercent = ((listing.list_price_min - listing.list_price) / listing.list_price_min) * 100
  }

  // Days on market
  let daysOnMarket = 0
  if ((listing as any).time_listed) {
    daysOnMarket = parseInt((listing as any).time_listed as any) || 0
  } else if (listing.created_at) {
    const createdDate = new Date(listing.created_at)
    const now = new Date()
    daysOnMarket = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    id: listing.listing_id || listing.property_url || '',
    address:
      address ||
      ([city, state, zip].filter((val) => hasValue(val)).join(', ')
        ? `Property in ${[city, state, zip].filter((val) => hasValue(val)).join(', ')}`
        : 'Address not available'),
    city,
    state,
    zip,
    price: listing.list_price || 0,
    price_drop_percent: priceDropPercent,
    days_on_market: daysOnMarket,
    url: (listing as any).url || listing.property_url || '',
    latitude: (listing as any).latitude || (listing.lat ? Number(listing.lat) : undefined),
    longitude: (listing as any).longitude || (listing.lng ? Number(listing.lng) : undefined),
    property_type: (listing as any).property_type,
    beds: listing.beds || undefined,
    sqft: listing.sqft || undefined,
    year_built: listing.year_built || undefined,
    description: listing.text || (listing as any).description,
    agent_name: listing.agent_name || undefined,
    agent_email: listing.agent_email || undefined,
    expired: (listing as any).expired || false,
    geo_source: (listing as any).geo_source || (listing as any).listing_source_name || null,
    owner_email: (listing as any).owner_email,
    enrichment_confidence: (listing as any).enrichment_confidence || null,
    primary_photo: (listing as any).primary_photo,
  }
}

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

// Component that uses sidebar - must be inside DashboardLayout
function ProspectContentInner(props: any) {
  const { isOpen: isSidebarOpen } = useSidebar()
  return <ProspectContentWithSidebar {...props} isSidebarOpen={isSidebarOpen} />
}

function ProspectContentWithSidebar({ isSidebarOpen, ...props }: any) {
  return (
    <>
    {/* TailwindAdmin Hover Table - 1:1 Match to /shadcn-tables/hover */}
    <div className="fixed top-[80px] bottom-0 flex flex-col transition-all duration-300" style={{ left: isSidebarOpen ? '270px' : '75px', right: 0, marginTop: 0 }}>
      <div className="border-0 bg-white dark:bg-dark card no-inset no-ring undefined dark:shadow-dark-md shadow-md p-0 m-0 flex-1 flex flex-col overflow-hidden h-full w-full">
        {/* Prospect Search Header */}
        <ProspectSearchHeader
          searchQuery={props.searchTerm || ''}
          onSearchChange={props.setSearchTerm}
          filtersVisible={props.filtersVisible}
          onToggleFilters={() => props.setFiltersVisible(!props.filtersVisible)}
          onImport={() => props.setShowImportModal(true)}
          onResearchWithAI={() => {
            // Research with AI - can be implemented later
            console.log('Research with AI clicked')
          }}
          onCreateWorkflow={() => {
            // Create workflow - can be implemented later
            console.log('Create workflow clicked')
          }}
          onSaveSearch={() => {
            // Save search - can be implemented later
            console.log('Save search clicked')
          }}
          onAutoScore={() => {
            // Auto score - can be implemented later
            console.log('Auto score clicked')
          }}
          onSearchSettings={() => {
            // Search settings - can be implemented later
            console.log('Search settings clicked')
          }}
          isDark={props.isDark}
          displayView={props.displayView}
          onDisplayViewChange={props.setDisplayView}
        />
        {/* Main Content Area with Filter Sidebar and Table */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Filter Sidebar */}
          {props.filtersVisible && (
            <ProspectFilterSidebar
              filters={props.apolloFilters}
              onFiltersChange={props.setApolloFilters}
              totalCount={props.totalCount || 0}
              netNewCount={props.netNewCount || 0}
              savedCount={props.savedCount || 0}
              isCollapsed={!props.filtersVisible}
              onToggleCollapse={() => props.setFiltersVisible(!props.filtersVisible)}
              listings={props.allListings || []}
              isDark={props.isDark}
              viewType={props.viewType}
              onViewTypeChange={props.setViewType}
            />
          )}
          {/* Right Side - Table or Map */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {props.displayView === 'map' ? (
              <div className="flex-1 flex flex-col bg-white dark:bg-dark">
                <MapView
                  isActive={true}
                  listings={(props.allListings || []).map(listingToMapLead)}
                  loading={false}
                  onStreetViewListingClick={(leadId) => {
                    // Open lead detail modal for the clicked marker
                    props.setSelectedListingId(leadId)
                    props.setShowLeadModal(true)
                  }}
                />
              </div>
            ) : (
              <ProspectHoverTable
          tableName={props.activeCategory === 'all' ? undefined : props.resolvedTableName}
          listings={props.activeCategory === 'all' ? props.filteredListings : undefined}
          filters={{
            search: props.searchTerm,
            city: props.apolloFilters.city?.[0],
            state: props.apolloFilters.state?.[0],
            minPrice: props.apolloFilters.price_range?.min?.toString(),
            maxPrice: props.apolloFilters.price_range?.max?.toString(),
            status: props.apolloFilters.status?.[0]
          }}
          sortBy={props.sortBy === 'price_high' ? 'list_price' : props.sortBy === 'price_low' ? 'list_price' : props.sortBy === 'date_new' ? 'created_at' : props.sortBy === 'date_old' ? 'created_at' : props.sortBy === 'score_high' ? 'ai_investment_score' : 'created_at'}
          sortOrder={props.sortBy === 'price_low' || props.sortBy === 'date_old' ? 'asc' : 'desc'}
          pagination={{
            currentPage: props.currentPage,
            pageSize: props.itemsPerPage,
            onPageChange: props.setCurrentPage,
            onPageSizeChange: props.setItemsPerPage
          }}
          onStatsChange={(stats) => {
            props.setRemoteListingsCount(stats.totalCount)
          }}
          onListingClick={(listing) => {
            props.setSelectedListingId(listing.listing_id)
            props.setShowLeadModal(true)
          }}
          selectedIds={props.selectedIds}
          onSelect={(listingId, selected) => {
            const newSelected = new Set(props.selectedIds)
            if (selected) {
              newSelected.add(listingId)
            } else {
              newSelected.delete(listingId)
            }
            props.setSelectedIds(newSelected)
          }}
          crmContactIds={props.crmContactIds}
          onSave={props.handleSaveProspect}
          category={props.activeCategory}
          onAction={(action, listing) => {
            if (action === 'email') {
              props.handleGenerateEmail(listing as any)
            } else if (action === 'call') {
              if (listing.agent_phone) {
                window.open(`tel:${listing.agent_phone}`)
              }
            } else if (action === 'save' || action === 'added_to_crm') {
              props.handleSave(listing as any)
            } else if (action === 'unsave' || action === 'removed_from_crm') {
              props.handleSaveProspect(listing as any, false)
            } else if (action === 'view') {
              props.setSelectedListingId(listing.listing_id)
              props.setShowLeadModal(true)
            }
          }}
          isDark={props.isDark}
          showSummary={false}
          showPagination={true}
            />
            )}
          </div>
        </div>
      </div>
      {/* SelectionActionBar: fixed at bottom when one or more prospects selected */}
      {props.selectedIds.size > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <SelectionActionBar
            selectedCount={props.selectedIds.size}
            onClose={() => props.setSelectedIds(new Set())}
            onMassEmail={() => {
              const list = props.filteredListings || props.listings || []
              const first = list.find((l: any) =>
                props.selectedIds.has(l.listing_id || '') ||
                (l.property_url && props.selectedIds.has(l.property_url))
              )
              if (first) props.handleGenerateEmail(first)
            }}
            onAddToSequence={() => props.setShowAddToCampaignModal(true)}
            onAddToList={() => props.setShowAddToListModal(true)}
            onAddToCrm={props.handleBulkSave}
            onDuplicate={() => {}}
            onExport={() => {}}
            onArchive={() => {}}
            onDelete={() => {}}
            onConvert={() => {}}
            onMoveTo={() => {}}
            onSidekick={() => {}}
            onApps={() => {}}
            isDark={props.isDark}
          />
        </div>
      )}
    </div>
    {/* Lead Detail Modal */}
    {props.showLeadModal && props.selectedListingId && (
      <LeadDetailModal
        listingId={props.selectedListingId}
        listingList={props.paginatedListings}
        onClose={() => {
          props.setShowLeadModal(false)
          props.setSelectedListingId(null)
        }}
        onUpdate={(updatedListing) => {
          props.updateListing(updatedListing)
        }}
      />
    )}

    {/* Import Leads Modal */}
    <ImportLeadsModal
      isOpen={props.showImportModal}
      onClose={() => props.setShowImportModal(false)}
      onImportComplete={(count) => {
        props.fetchListingsData(props.selectedFilters, props.sortField, props.sortOrder)
        props.router.push('/dashboard/prospect-enrich?filter=imports')
      }}
    />

    {/* Email Template Modal */}
    {props.showEmailModal && props.selectedLead && (
      <EmailTemplateModal
        lead={props.selectedLead}
        onClose={() => {
          props.setShowEmailModal(false)
          props.setSelectedLead(null)
        }}
      />
    )}

    {/* Add to Lists Modal */}
    {props.showAddToListModal && (
      <AddToListModal
        supabase={props.supabase}
        profileId={props.profile?.id}
        selectedCount={props.selectedIds.size}
        onAddToList={props.handleBulkAddToList}
        onClose={() => props.setShowAddToListModal(false)}
        isDark={props.isDark}
      />
    )}

    {/* Add to Campaigns Modal */}
    {props.showAddToCampaignModal && props.profile?.id && (
      <AddToCampaignModal
        supabase={props.supabase}
        profileId={props.profile.id}
        selectedListings={props.listings.filter((l: any) => props.selectedIds.has(l.listing_id || ''))}
        onClose={() => {
          props.setShowAddToCampaignModal(false)
          props.setSelectedIds(new Set())
        }}
        onSuccess={() => {
          props.fetchCrmContacts(props.selectedFilters)
        }}
        isDark={props.isDark}
      />
    )}
    </>
  )
}

// Inner component that uses useSearchParams - must be in Suspense
function ProspectEnrichInner() {
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { profile } = useApp()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
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
  const [displayView, setDisplayView] = useState<'default' | 'compact' | 'detailed' | 'map'>('default')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(30)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAddToListModal, setShowAddToListModal] = useState(false)
  const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false)
  // Removed useVirtualizedTable - only using ProspectHoverTable now
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
  // Removed dataScrollContainerRef - no longer needed

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
  
  // Removed shouldUseVirtualizedTable - only using ProspectHoverTable now

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
    // Net new = listings created or updated in last 30 days, excluding saved listings and listings in lists
    // Must match the exact logic used in baseListings for 'net_new' viewType
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    return listings.filter(l => {
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
    }).length
  }, [listings, crmContactIds, listItemIds])
  
  // Saved count is now category-specific - savedListings is fetched from current category's table
  // Always shows the complete count of saved listings in this category, regardless of viewType
  const savedCount = savedListings.length

  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredListings.slice(start, end)
  }, [filteredListings, currentPage, itemsPerPage])

  const activeTableItemCount = useMemo(() => {
    return remoteListingsCount || filteredListings.length
  }, [remoteListingsCount, filteredListings.length])

  const totalPages = Math.max(1, Math.ceil(Math.max(activeTableItemCount, 1) / itemsPerPage))

  // Removed tableHeaderColumns - ProspectHoverTable handles its own header

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

  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-80px)]" />
      </DashboardLayout>
    )
  }
  
  return (
    <DashboardLayout>
      <ProspectContentInner 
        activeCategory={activeCategory}
        resolvedTableName={resolvedTableName}
        filteredListings={filteredListings}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        apolloFilters={apolloFilters}
        setApolloFilters={setApolloFilters}
        sortBy={sortBy}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        setCurrentPage={setCurrentPage}
        setItemsPerPage={setItemsPerPage}
        setRemoteListingsCount={setRemoteListingsCount}
        setSelectedListingId={setSelectedListingId}
        setShowLeadModal={setShowLeadModal}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        crmContactIds={crmContactIds}
        handleSaveProspect={handleSaveProspect}
        handleGenerateEmail={handleGenerateEmail}
        handleSave={handleSave}
        isDark={isDark}
        showLeadModal={showLeadModal}
        selectedListingId={selectedListingId}
        paginatedListings={paginatedListings}
        updateListing={updateListing}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        fetchListingsData={fetchListingsData}
        selectedFilters={selectedFilters}
        sortField={sortField}
        sortOrder={sortOrder}
        router={router}
        showEmailModal={showEmailModal}
        selectedLead={selectedLead}
        setShowEmailModal={setShowEmailModal}
        setSelectedLead={setSelectedLead}
        showAddToListModal={showAddToListModal}
        setShowAddToListModal={setShowAddToListModal}
        handleBulkAddToList={handleBulkAddToList}
        handleBulkSave={handleBulkSave}
        profile={profile}
        showAddToCampaignModal={showAddToCampaignModal}
        setShowAddToCampaignModal={setShowAddToCampaignModal}
        listings={listings}
        fetchCrmContacts={fetchCrmContacts}
        supabase={supabase}
        filtersVisible={filtersVisible}
        setFiltersVisible={setFiltersVisible}
        totalCount={totalCount}
        netNewCount={netNewCount}
        savedCount={savedCount}
        allListings={allListings}
        viewType={viewType}
        setViewType={setViewType}
        displayView={displayView}
        setDisplayView={setDisplayView}
      />
    </DashboardLayout>
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
