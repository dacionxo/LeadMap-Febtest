'use client'

/**
 * VirtualizedListingsTable Component
 * 
 * A high-performance virtualized table component for displaying large datasets (1M+ listings).
 * Uses @tanstack/react-virtual to only render visible rows for optimal performance.
 * 
 * Key Features:
 * - Server-side pagination via /api/listings/paginated endpoint
 * - Virtualization: Only renders ~5-10 visible rows regardless of total count
 * - Filtering: Search, city, state, price range, status
 * - Sorting: Configurable sortBy and sortOrder
 * - Dual pagination modes: Internal or external pagination controls
 * - Scroll sync: Horizontal scroll synchronization between header and data
 * - CRM integration: Selection, saving, and action handling
 * - Embedded/Standalone: Can be used standalone or embedded in parent
 * 
 * Data Flow:
 * 1. Component receives tableName prop (validated against whitelist)
 * 2. Fetches data from API with filters, sort, pagination params
 * 3. Uses virtualizer to calculate which rows to render
 * 4. Only renders visible rows for performance
 * 5. Reports stats back to parent via onStatsChange callback
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import ApolloContactCard from './ApolloContactCard'
import ApolloPagination from './ApolloPagination'

// ============================================================================
// Type Definitions
// ============================================================================

interface Listing {
  listing_id: string
  property_url?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  list_price?: number | null
  beds?: number | null
  full_baths?: number | null
  sqft?: number | null
  status?: string | null
  agent_name?: string | null
  agent_email?: string | null
  agent_phone?: string | null
  agent_phone_2?: string | null
  listing_agent_phone_2?: string | null
  listing_agent_phone_5?: string | null
  /** Property description text from Supabase 'text' field (fallback) */
  text?: string | null
  /** Other JSONB field containing additional property data including description */
  other?: any
  year_built?: number | null
  last_sale_price?: number | null
  last_sale_date?: string | null
  ai_investment_score?: number | null
  created_at?: string
  lat?: number | null
  lng?: number | null
  active?: boolean
  price_per_sqft?: number | null
}

interface PaginationControls {
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

interface PaginationStats {
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  loading: boolean
}

interface TableFilters {
  search?: string
  city?: string
  state?: string
  minPrice?: string
  maxPrice?: string
  status?: string
}

interface VirtualizedListingsTableProps {
  tableName?: string
  listings?: Listing[] // Optional: If provided, use these listings instead of fetching
  columns?: string[] // Optional: Column configuration for ApolloContactCard
  filters?: TableFilters
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onListingClick?: (listing: Listing) => void
  isDark?: boolean
  selectedIds?: Set<string>
  onSelect?: (listingId: string, selected: boolean) => void
  crmContactIds?: Set<string>
  onSave?: (listing: Listing, saved: boolean) => void
  onAction?: (action: string, listing: Listing) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement>
  variant?: 'standalone' | 'embedded'
  pagination?: PaginationControls
  onStatsChange?: (stats: PaginationStats) => void
  showSummary?: boolean
  showPagination?: boolean
  category?: string // Category to assign saved listings to
}

// ============================================================================
// Constants
// ============================================================================

const ITEMS_PER_PAGE = 50
const ROW_HEIGHT_ESTIMATE = 80
const VIRTUALIZER_OVERSCAN = 5

// Default columns configuration (used when columns prop is not provided)
const DEFAULT_COLUMNS = [
  'address', 'price', 'status', 'score', 'beds', 'full_baths', 
  'sqft', 'description', 'agent_name', 'agent_email', 'agent_phone', 
  'agent_phone_2', 'listing_agent_phone_2', 'listing_agent_phone_5', 
  'year_built', 'last_sale_price', 'last_sale_date', 'actions'
] as const

// Whitelist of valid table names for security
const VALID_TABLE_NAMES = [
  'listings',
  'expired_listings',
  'probate_leads',
  'fsbo_leads',
  'frbo_leads',
  'imports',
  'trash',
  'foreclosure_listings'
] as const

// ============================================================================
// Main Component
// ============================================================================

export default function VirtualizedListingsTable({
  tableName,
  listings: providedListings,
  columns: providedColumns,
  filters = {},
  sortBy = 'created_at',
  sortOrder = 'desc',
  onListingClick,
  isDark = false,
  selectedIds = new Set(),
  onSelect,
  crmContactIds = new Set(),
  onSave,
  onAction,
  scrollContainerRef,
  variant = 'standalone',
  pagination,
  onStatsChange,
  showSummary = true,
  showPagination = true,
  category
}: VirtualizedListingsTableProps) {
  // Use provided columns or default - ensure stability and mutability
  const columns = providedColumns || [...DEFAULT_COLUMNS]
  // ==========================================================================
  // State Management
  // ==========================================================================
  
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  
  // Internal pagination state (used when external pagination not provided)
  const [internalCurrentPage, setInternalCurrentPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(ITEMS_PER_PAGE)
  
  // Reload signal to trigger fetches when filters/sort change
  const [reloadSignal, setReloadSignal] = useState(0)
  
  // ==========================================================================
  // Refs
  // ==========================================================================
  
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false) // Prevents concurrent fetches
  
  // ==========================================================================
  // Computed Values
  // ==========================================================================
  
  const isEmbedded = variant === 'embedded'
  const scrollContainer = scrollContainerRef?.current || internalScrollRef.current
  
  // Use external pagination if provided, otherwise use internal
  // This ensures pagination state is synced with parent component
  const currentPage = pagination?.currentPage ?? internalCurrentPage
  const pageSize = pagination?.pageSize ?? internalPageSize
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  
  // Log pagination state changes for debugging
  useEffect(() => {
    console.log('VirtualizedListingsTable: Pagination state updated', {
      currentPage,
      pageSize,
      totalCount,
      totalPages,
      hasPagination: !!pagination
    })
  }, [currentPage, pageSize, totalCount, totalPages, pagination])
  
  // ==========================================================================
  // Table Name Validation
  // ==========================================================================
  
  const isValidTableName = (name: string): boolean => {
    return VALID_TABLE_NAMES.includes(name as any)
  }
  
  // ==========================================================================
  // Pagination Handlers
  // ==========================================================================
  
  const handlePageChange = useCallback((page: number) => {
    if (pagination) {
      pagination.onPageChange(page)
    } else {
      setInternalCurrentPage(page)
    }
  }, [pagination])
  
  const handlePageSizeChange = useCallback((size: number) => {
    if (pagination) {
      pagination.onPageSizeChange(size)
    } else {
      setInternalPageSize(size)
      setInternalCurrentPage(1) // Reset to first page when page size changes
    }
  }, [pagination])
  
  // ==========================================================================
  // Data Fetching
  // ==========================================================================
  
  /**
   * Fetches listings from the API endpoint with current filters, sort, and pagination
   * Uses loadingRef to prevent concurrent requests
   * If providedListings is provided, skips API fetch and uses those listings instead
   * Ensures 'other' JSONB field is included in the response for description extraction
   */
  const fetchListings = useCallback(async (page: number) => {
    // If listings are provided directly, use them instead of fetching
    if (providedListings !== undefined) {
      // Apply client-side filtering if needed
      let filtered = [...providedListings]
      
      if (filters.search) {
        const query = filters.search.toLowerCase()
        filtered = filtered.filter(listing => {
          const address = `${listing.street || ''} ${listing.city || ''} ${listing.state || ''}`.toLowerCase()
          const agentName = (listing.agent_name || '').toLowerCase()
          const agentEmail = (listing.agent_email || '').toLowerCase()
          const listingId = (listing.listing_id || '').toLowerCase()
          return address.includes(query) || agentName.includes(query) || agentEmail.includes(query) || listingId.includes(query)
        })
      }
      
      if (filters.city) {
        filtered = filtered.filter(l => l.city?.toLowerCase() === filters.city?.toLowerCase())
      }
      
      if (filters.state) {
        filtered = filtered.filter(l => l.state?.toLowerCase() === filters.state?.toLowerCase())
      }
      
      if (filters.minPrice) {
        const min = parseInt(filters.minPrice)
        filtered = filtered.filter(l => l.list_price && l.list_price >= min)
      }
      
      if (filters.maxPrice) {
        const max = parseInt(filters.maxPrice)
        filtered = filtered.filter(l => l.list_price && l.list_price <= max)
      }
      
      if (filters.status) {
        filtered = filtered.filter(l => l.status?.toLowerCase().includes(filters.status?.toLowerCase() || ''))
      }
      
      // Apply sorting
      filtered.sort((a, b) => {
        let aVal: any, bVal: any
        
        switch (sortBy) {
          case 'price':
            aVal = a.list_price || 0
            bVal = b.list_price || 0
            break
          case 'date':
            aVal = new Date(a.created_at || 0).getTime()
            bVal = new Date(b.created_at || 0).getTime()
            break
          case 'score':
            aVal = a.ai_investment_score || 0
            bVal = b.ai_investment_score || 0
            break
          default:
            aVal = new Date(a.created_at || 0).getTime()
            bVal = new Date(b.created_at || 0).getTime()
        }
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        }
      })
      
      // Apply pagination
      const start = (page - 1) * pageSize
      const end = start + pageSize
      const paginated = filtered.slice(start, end)
      
      // Ensure 'other' JSONB field is preserved for client-side pagination
      const paginatedWithOther = paginated.map((listing: any) => ({
        ...listing,
        // Ensure other field is properly structured
        other: listing.other || null
      }))
      
      setListings(paginatedWithOther)
      setTotalCount(filtered.length)
      setLoading(false)
      return
    }
    
    // Prevent concurrent fetches
    if (loadingRef.current || !tableName) {
      return
    }
    
    // Validate table name
    if (!isValidTableName(tableName)) {
      console.warn(`VirtualizedListingsTable: Invalid table name "${tableName}". Expected one of: ${VALID_TABLE_NAMES.join(', ')}`)
      setLoading(false)
      setListings([])
      setTotalCount(0)
      return
    }
    
    loadingRef.current = true
    
    try {
      setLoading(true)
      
      // Build query parameters
      const params = new URLSearchParams({
        table: tableName,
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder
      })
      
      // Add filters to params if provided
      if (filters.search) params.append('search', filters.search)
      if (filters.city) params.append('city', filters.city)
      if (filters.state) params.append('state', filters.state)
      if (filters.minPrice) params.append('minPrice', filters.minPrice)
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice)
      if (filters.status) params.append('status', filters.status)
      
      // Fetch from API
      const response = await fetch(`/api/listings/paginated?${params.toString()}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        throw new Error(`Failed to fetch listings: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      // Log fetch details for debugging
      console.log('VirtualizedListingsTable: Fetched listings', { 
        count: result.count, 
        dataLength: result.data?.length,
        page,
        tableName,
        filters
      })
      
      const { data, count, error } = result
      
      if (error) {
        console.error('API returned error:', error)
        throw new Error(error)
      }
      
      // Update state with fetched data
      // Ensure 'other' JSONB field is preserved and properly parsed in the response
      const listingsWithOther = (data || []).map((listing: any) => {
        let parsedOther = listing.other
        // Safely parse other field if it's a string
        if (listing.other && typeof listing.other === 'string') {
          try {
            parsedOther = JSON.parse(listing.other)
          } catch (parseError) {
            console.warn('Failed to parse other JSONB field for listing:', listing.listing_id, parseError)
            parsedOther = null
          }
        }
        
        return {
          ...listing,
          other: parsedOther
        }
      })
      
      setListings(listingsWithOther)
      setTotalCount(count || 0)
      
      // Log successful fetch for debugging
      console.log('VirtualizedListingsTable: Successfully loaded page', {
        page,
        count: listingsWithOther.length,
        totalCount: count,
        tableName,
        hasOtherField: listingsWithOther.some((l: any) => l.other !== null && l.other !== undefined)
      })
      
    } catch (error: any) {
      console.error('Error fetching listings:', error)
      // On error, clear listings and reset count
      setListings([])
      setTotalCount(0)
      
      // Log detailed error information for debugging
      if (error.message) {
        console.error('Fetch error details:', {
          message: error.message,
          tableName,
          page,
          pageSize,
          filters,
          sortBy,
          sortOrder
        })
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [tableName, providedListings, filters, sortBy, sortOrder, pageSize])
  
  // ==========================================================================
  // Effects
  // ==========================================================================
  
  /**
   * Effect: Reload data when filters, sort, or table name changes
   * Resets to page 1 and triggers a reload signal
   * If providedListings is provided, reloads when those change
   */
  useEffect(() => {
    // If using provided listings, we don't need tableName validation
    if (providedListings !== undefined) {
      // Reset to page 1 when filters/sort change
      if (!pagination) {
        setInternalCurrentPage(1)
      } else {
        pagination.onPageChange(1)
      }
      
      // Trigger reload
      setReloadSignal(prev => prev + 1)
      return
    }
    
    if (!tableName) {
      console.warn('VirtualizedListingsTable: No table name provided')
      setLoading(false)
      return
    }
    
    // Validate table name
    if (!isValidTableName(tableName)) {
      console.warn(`VirtualizedListingsTable: Unexpected table name "${tableName}". Expected one of: ${VALID_TABLE_NAMES.join(', ')}`)
    }
    
    // Log reload for debugging
    console.log('VirtualizedListingsTable: Reloading data', { 
      tableName, 
      sortBy, 
      sortOrder, 
      filters,
      timestamp: new Date().toISOString()
    })
    
    // Reset to page 1 when filters/sort change
    if (!pagination) {
      setInternalCurrentPage(1)
    } else {
      pagination.onPageChange(1)
    }
    
    // Clear current listings and trigger reload
    setListings([])
    setLoading(true)
    setReloadSignal(prev => prev + 1)
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tableName,
    providedListings,
    sortBy,
    sortOrder,
    filters.search,
    filters.city,
    filters.state,
    filters.minPrice,
    filters.maxPrice,
    filters.status,
    pageSize,
    pagination?.onPageChange
  ])
  
  /**
   * Effect: Fetch data when page changes or reload signal is triggered
   * This ensures data is properly loaded when user switches pages
   * Critical: This effect must run whenever currentPage changes to load new page data
   */
  useEffect(() => {
    // Skip if already loading to prevent duplicate requests
    if (loadingRef.current) {
      console.log('VirtualizedListingsTable: Skipping fetch - already loading')
      return
    }
    
    if (providedListings !== undefined) {
      // If using provided listings, always fetch (it handles pagination internally)
      console.log('VirtualizedListingsTable: Fetching from provided listings', { currentPage })
      fetchListings(currentPage)
    } else if (currentPage > 0 && tableName && isValidTableName(tableName)) {
      // Fetch from API when page changes
      console.log('VirtualizedListingsTable: Page changed, fetching data from API', {
        currentPage,
        tableName,
        pageSize,
        timestamp: new Date().toISOString()
      })
      fetchListings(currentPage)
    } else {
      console.warn('VirtualizedListingsTable: Cannot fetch - missing requirements', {
        currentPage,
        tableName,
        isValidTable: tableName ? isValidTableName(tableName) : false,
        hasProvidedListings: providedListings !== undefined
      })
    }
  }, [currentPage, fetchListings, tableName, providedListings, reloadSignal, pageSize])
  
  
  /**
   * Effect: Report stats to parent component
   * Allows parent to track pagination state and loading status
   */
  useEffect(() => {
    onStatsChange?.({
      totalCount,
      totalPages,
      currentPage,
      pageSize,
      loading
    })
  }, [onStatsChange, totalCount, totalPages, currentPage, pageSize, loading])
  
  // ==========================================================================
  // Virtualization
  // ==========================================================================
  
  /**
   * Virtualizer configuration
   * Only renders visible rows + overscan for smooth scrolling
   */
  const rowVirtualizer = useVirtualizer({
    count: listings.length,
    getScrollElement: () => scrollContainer,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: VIRTUALIZER_OVERSCAN,
  })
  
  const virtualItems = rowVirtualizer.getVirtualItems()
  
  // ==========================================================================
  // Render Helpers
  // ==========================================================================
  
  /**
   * Renders loading state
   */
  const renderLoading = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      color: isDark ? '#94a3b8' : '#6b7280',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      height: '100%'
    }}>
      Loading prospects...
    </div>
  )
  
  /**
   * Renders empty state
   */
  const renderEmpty = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      color: isDark ? '#94a3b8' : '#6b7280',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      height: '100%'
    }}>
      No listings found
    </div>
  )
  
  /**
   * Renders summary bar showing current page range
   */
  const renderSummary = () => {
    if (isEmbedded || !showSummary || totalCount === 0) return null
    
    const start = ((currentPage - 1) * pageSize + 1)
    const end = Math.min(currentPage * pageSize, totalCount)
    
    return (
      <div style={{ 
        padding: '8px 16px', 
        fontSize: '13px',
        color: isDark ? '#94a3b8' : '#6b7280',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff'
      }}>
        Showing {start.toLocaleString()} - {end.toLocaleString()} of {totalCount.toLocaleString()} listings
      </div>
    )
  }
  
  /**
   * Renders pagination controls
   */
  const renderPagination = () => {
    if (isEmbedded || !showPagination || totalCount === 0) return null
    
    return (
      <div style={{
        padding: '16px',
        borderTop: isDark ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid #e5e7eb',
        background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff'
      }}>
        <ApolloPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isDark={isDark}
        />
      </div>
    )
  }
  
  // ==========================================================================
  // Early Returns
  // ==========================================================================
  
  if (loading && listings.length === 0) {
    return renderLoading()
  }
  
  if (!loading && listings.length === 0) {
    return renderEmpty()
  }
  
  // ==========================================================================
  // Main Render
  // ==========================================================================
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 'max-content', minWidth: '100%' }}>
      {/* Summary Bar */}
      {renderSummary()}
      
      {/* Virtualized List Container */}
      <div
        ref={scrollContainerRef ? undefined : internalScrollRef}
        style={{ 
          width: '100%',
          position: 'relative',
          minHeight: `${rowVirtualizer.getTotalSize()}px`
        }}
      >
        {/* Virtualized Content Container */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Render only visible virtual items */}
          {virtualItems.map((virtualRow) => {
            const listing = listings[virtualRow.index]
            if (!listing) return null
            
            // Use stable key: prefer _membership_id for Apollo-style reconstruction, fallback to listing_id or property_url
            const stableKey = (listing as any)._membership_id ?? listing.listing_id ?? listing.property_url ?? virtualRow.key
            
            return (
              <div
                key={stableKey}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ApolloContactCard
                  listing={listing}
                  isSelected={selectedIds.has(listing.listing_id)}
                  onSelect={onSelect || (() => {})}
                  columns={columns}
                  onAction={onAction}
                  onClick={() => onListingClick?.(listing)}
                  isSaved={crmContactIds.has(listing.listing_id) || (listing.property_url ? crmContactIds.has(listing.property_url) : false)}
                  onSave={onSave}
                  isDark={isDark}
                  category={category}
                />
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Pagination Controls */}
      {renderPagination()}
    </div>
  )
}
