'use client'

/**
 * ProspectCheckboxTable Component
 * 
 * A modern table component using shadcn/ui Table with Checkbox functionality.
 * Based on TailwindAdmin's CheckboxTable design, adapted for LeadMap's prospect data.
 * 
 * Key Features:
 * - Server-side pagination via /api/listings/paginated endpoint
 * - Checkbox selection with select all functionality
 * - All columns preserved: Address, Price, Status, AI Score, Beds, Baths, Sqft, 
 *   Description, Agent Name, Agent Email, Agent Phone, Agent Phone 2, 
 *   Listing Agent Phone 2, Listing Agent Phone 5, Year Built, Last Sale Price, 
 *   Last Sale Date, Actions
 * - Actions: Email, Call, Save, More
 * - Fully compatible with existing API routes and props
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { Checkbox } from '@/app/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { MoreVertical, Mail, Phone, Bookmark, BookmarkCheck, ExternalLink, DollarSign, Target, MapPin } from 'lucide-react'
import ApolloPagination from './ApolloPagination'
import SaveButton from './AddToCrmButton'

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
  text?: string | null
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
  in_crm?: boolean
}

interface TableFilters {
  search?: string
  city?: string
  state?: string
  minPrice?: string
  maxPrice?: string
  status?: string
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

interface ProspectCheckboxTableProps {
  tableName?: string
  listings?: Listing[]
  columns?: string[]
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
  pagination?: PaginationControls
  onStatsChange?: (stats: PaginationStats) => void
  showSummary?: boolean
  showPagination?: boolean
  category?: string
}

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

const DEFAULT_COLUMNS = [
  'address', 'price', 'status', 'score', 'beds', 'full_baths', 
  'sqft', 'description', 'agent_name', 'agent_email', 'agent_phone', 
  'agent_phone_2', 'listing_agent_phone_2', 'listing_agent_phone_5', 
  'year_built', 'last_sale_price', 'last_sale_date', 'actions'
] as const

const ROW_HEIGHT_ESTIMATE = 80
const VIRTUALIZER_OVERSCAN = 5

// Helper functions
function formatPrice(price: number | null | undefined): string {
  if (!price) return 'N/A'
  return `$${price.toLocaleString()}`
}

function formatBaths(baths: number | null | undefined): string {
  if (baths === null || baths === undefined) return '-'
  const numBaths = typeof baths === 'string' ? parseFloat(baths) : baths
  if (isNaN(numBaths)) return '-'
  return numBaths % 1 === 0 ? numBaths.toString() : numBaths.toFixed(1)
}

function getDescription(listing: Listing): string {
  if (listing.other) {
    try {
      const other = typeof listing.other === 'string' ? JSON.parse(listing.other) : listing.other
      const description = other?.description || other?.Description || other?.listing_description || other?.property_description || other?.text
      if (description && typeof description === 'string' && description.trim()) {
        return description
      }
    } catch (error) {
      console.warn('Failed to parse other JSONB field:', error)
    }
  }
  return listing.text || '-'
}

function isValidTableName(tableName: string): boolean {
  return VALID_TABLE_NAMES.includes(tableName as any)
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProspectCheckboxTable({
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
  pagination,
  onStatsChange,
  showSummary = true,
  showPagination = true,
  category
}: ProspectCheckboxTableProps) {
  const columns = providedColumns || [...DEFAULT_COLUMNS]
  
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [internalCurrentPage, setInternalCurrentPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(10)

  const currentPage = pagination?.currentPage ?? internalCurrentPage
  const pageSize = pagination?.pageSize ?? internalPageSize

  // Fetch listings
  const fetchListings = useCallback(async (page: number) => {
    if (providedListings !== undefined) {
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
      
      filtered.sort((a, b) => {
        let aVal: any, bVal: any
        
        switch (sortBy) {
          case 'price':
          case 'list_price':
            aVal = a.list_price || 0
            bVal = b.list_price || 0
            break
          case 'date':
          case 'created_at':
            aVal = new Date(a.created_at || 0).getTime()
            bVal = new Date(b.created_at || 0).getTime()
            break
          case 'score':
          case 'ai_investment_score':
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
      
      const start = (page - 1) * pageSize
      const end = start + pageSize
      const paginated = filtered.slice(start, end)
      
      setListings(paginated)
      setTotalCount(filtered.length)
      setLoading(false)
      return
    }
    
    if (!tableName || !isValidTableName(tableName)) {
      setLoading(false)
      setListings([])
      setTotalCount(0)
      return
    }
    
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        table: tableName,
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder
      })
      
      if (filters.search) params.append('search', filters.search)
      if (filters.city) params.append('city', filters.city)
      if (filters.state) params.append('state', filters.state)
      if (filters.minPrice) params.append('minPrice', filters.minPrice)
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice)
      if (filters.status) params.append('status', filters.status)
      
      const response = await fetch(`/api/listings/paginated?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch listings: ${response.statusText}`)
      }
      
      const result = await response.json()
      const { data, count, error } = result
      
      if (error) {
        throw new Error(error)
      }
      
      const listingsWithOther = (data || []).map((listing: any) => {
        let parsedOther = listing.other
        if (listing.other && typeof listing.other === 'string') {
          try {
            parsedOther = JSON.parse(listing.other)
          } catch (parseError) {
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
      
      if (onStatsChange) {
        onStatsChange({
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
          currentPage: page,
          pageSize,
          loading: false
        })
      }
      
    } catch (error: any) {
      console.error('Error fetching listings:', error)
      setListings([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [providedListings, tableName, filters, sortBy, sortOrder, pageSize, onStatsChange])

  useEffect(() => {
    fetchListings(currentPage)
  }, [fetchListings, currentPage])

  const totalPages = Math.ceil(totalCount / pageSize)
  const allSelected = listings.length > 0 && listings.every(l => selectedIds.has(l.listing_id))
  const someSelected = listings.some(l => selectedIds.has(l.listing_id))

  const handleSelectAll = (checked: boolean) => {
    if (!onSelect) return
    listings.forEach(listing => {
      onSelect(listing.listing_id, checked)
    })
  }

  const handleSelect = (listingId: string, checked: boolean) => {
    onSelect?.(listingId, checked)
  }

  const formatAddress = (listing: Listing) => {
    const street = listing.street || 'N/A'
    const cityStateZip = [listing.city, listing.state, listing.zip_code]
      .filter(Boolean)
      .join(', ') || ''
    return { street, cityStateZip }
  }

  // Virtualization setup - use table container as scroll element
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: listings.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: VIRTUALIZER_OVERSCAN,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  // Render row helper function
  const renderRow = (listing: Listing, index: number) => {
    const { street, cityStateZip } = formatAddress(listing)
    const isSelected = selectedIds.has(listing.listing_id)
    const isSaved = crmContactIds.has(listing.listing_id) || (listing.property_url ? crmContactIds.has(listing.property_url) : false)
    
    return (
      <TableRow 
        key={listing.listing_id}
        className={`group/row bg-hover dark:bg-transparent cursor-pointer ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        onClick={() => onListingClick?.(listing)}
      >
        <TableCell className="whitespace-nowrap">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => handleSelect(listing.listing_id, checked === true)}
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
        
        {columns.includes('address') && (
          <TableCell className="whitespace-nowrap">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium">{street}</div>
                {cityStateZip && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{cityStateZip}</div>
                )}
                {listing.property_url && (
                  <a
                    href={listing.property_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                  >
                    View Property
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </TableCell>
        )}
        
        {columns.includes('price') && (
          <TableCell className="whitespace-nowrap">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium">{formatPrice(listing.list_price)}</div>
                {listing.price_per_sqft && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ${listing.price_per_sqft.toLocaleString()}/sqft
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        )}
        
        {columns.includes('status') && (
          <TableCell className="whitespace-nowrap">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                listing.active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : listing.status?.toLowerCase().includes('expired') || listing.status?.toLowerCase().includes('sold')
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {listing.status || (listing.active ? 'Active' : 'Inactive')}
            </span>
          </TableCell>
        )}
        
        {columns.includes('score') && (
          <TableCell className="whitespace-nowrap">
            {listing.ai_investment_score !== null && listing.ai_investment_score !== undefined ? (
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4 text-blue-500" />
                <span
                  className={`text-sm font-medium ${
                    listing.ai_investment_score >= 70
                      ? 'text-green-600 dark:text-green-400'
                      : listing.ai_investment_score >= 50
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {listing.ai_investment_score.toFixed(1)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            )}
          </TableCell>
        )}
        
        {columns.includes('beds') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm">{listing.beds ?? '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('full_baths') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm">{formatBaths(listing.full_baths)}</span>
          </TableCell>
        )}
        
        {columns.includes('sqft') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm">{listing.sqft ? listing.sqft.toLocaleString() : '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('description') && (
          <TableCell>
            <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 max-w-xs">
              {getDescription(listing)}
            </div>
          </TableCell>
        )}
        
        {columns.includes('agent_name') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm">{listing.agent_name || '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('agent_email') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">{listing.agent_email || '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('agent_phone') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">{listing.agent_phone || '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('agent_phone_2') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">{listing.agent_phone_2 || '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('listing_agent_phone_2') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">{listing.listing_agent_phone_2 || '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('listing_agent_phone_5') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">{listing.listing_agent_phone_5 || '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('year_built') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm">{listing.year_built ?? '-'}</span>
          </TableCell>
        )}
        
        {columns.includes('last_sale_price') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm">{formatPrice(listing.last_sale_price)}</span>
          </TableCell>
        )}
        
        {columns.includes('last_sale_date') && (
          <TableCell className="whitespace-nowrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {listing.last_sale_date ? new Date(listing.last_sale_date).toLocaleDateString() : '-'}
            </span>
          </TableCell>
        )}
        
        {columns.includes('actions') && (
          <TableCell className="whitespace-nowrap">
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {listing.agent_email && (
                <button
                  onClick={() => onAction?.('email', listing)}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  title="Send Email"
                >
                  <Mail className="h-4 w-4" />
                </button>
              )}
              {listing.agent_phone && (
                <button
                  onClick={() => onAction?.('call', listing)}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  title="Call"
                >
                  <Phone className="h-4 w-4" />
                </button>
              )}
              {onSave && (
                <button
                  onClick={() => onSave(listing, !isSaved)}
                  className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isSaved ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title={isSaved ? 'Unsave prospect' : 'Save prospect'}
                >
                  {isSaved ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </button>
              )}
              <SaveButton
                listing={listing}
                saved={listing.in_crm || isSaved}
                onSaved={() => {
                  onSave?.(listing, true)
                  onAction?.('save', listing)
                }}
                onUnsaved={() => {
                  onSave?.(listing, false)
                  onAction?.('unsave', listing)
                }}
                variant="icon"
                category={category}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    title="More Actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onListingClick?.(listing)}>
                    View Details
                  </DropdownMenuItem>
                  {listing.property_url && (
                    <DropdownMenuItem onClick={() => window.open(listing.property_url || '', '_blank')}>
                      Open Property URL
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
        )}
      </TableRow>
    )
  }

  if (loading && listings.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading listings...</div>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="border rounded-md border-gray-200 dark:border-gray-700 overflow-hidden bg-white" style={{ backgroundColor: '#FFFFFF' }}>
        <div 
          ref={tableScrollRef}
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 400px)' }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base font-semibold py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    className={someSelected && !allSelected ? 'data-[state=checked]:bg-blue-600' : ''}
                  />
                </TableHead>
                {columns.includes('address') && (
                  <TableHead className="text-base font-semibold py-3">Address</TableHead>
                )}
                {columns.includes('price') && (
                  <TableHead className="text-base font-semibold py-3">Price</TableHead>
                )}
                {columns.includes('status') && (
                  <TableHead className="text-base font-semibold py-3">Status</TableHead>
                )}
                {columns.includes('score') && (
                  <TableHead className="text-base font-semibold py-3">AI Score</TableHead>
                )}
                {columns.includes('beds') && (
                  <TableHead className="text-base font-semibold py-3">Beds</TableHead>
                )}
                {columns.includes('full_baths') && (
                  <TableHead className="text-base font-semibold py-3">Baths</TableHead>
                )}
                {columns.includes('sqft') && (
                  <TableHead className="text-base font-semibold py-3">Sqft</TableHead>
                )}
                {columns.includes('description') && (
                  <TableHead className="text-base font-semibold py-3">Description</TableHead>
                )}
                {columns.includes('agent_name') && (
                  <TableHead className="text-base font-semibold py-3">Agent Name</TableHead>
                )}
                {columns.includes('agent_email') && (
                  <TableHead className="text-base font-semibold py-3">Agent Email</TableHead>
                )}
                {columns.includes('agent_phone') && (
                  <TableHead className="text-base font-semibold py-3">Agent Phone</TableHead>
                )}
                {columns.includes('agent_phone_2') && (
                  <TableHead className="text-base font-semibold py-3">Agent Phone 2</TableHead>
                )}
                {columns.includes('listing_agent_phone_2') && (
                  <TableHead className="text-base font-semibold py-3">Listing Agent Phone 2</TableHead>
                )}
                {columns.includes('listing_agent_phone_5') && (
                  <TableHead className="text-base font-semibold py-3">Listing Agent Phone 5</TableHead>
                )}
                {columns.includes('year_built') && (
                  <TableHead className="text-base font-semibold py-3">Year Built</TableHead>
                )}
                {columns.includes('last_sale_price') && (
                  <TableHead className="text-base font-semibold py-3">Last Sale Price</TableHead>
                )}
                {columns.includes('last_sale_date') && (
                  <TableHead className="text-base font-semibold py-3">Last Sale Date</TableHead>
                )}
                {columns.includes('actions') && (
                  <TableHead className="text-base font-semibold py-3"></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
              {listings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No listings found
                  </TableCell>
                </TableRow>
              ) : (
                // Render virtualized rows directly in TableBody
                // Note: Virtualization still works as we only render visible items
                virtualItems.map((virtualRow) => {
                  const listing = listings[virtualRow.index]
                  if (!listing) return null
                  return renderRow(listing, virtualRow.index)
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {showPagination && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white" style={{ backgroundColor: '#FFFFFF' }}>
            <ApolloPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalCount}
              onPageChange={(page) => {
                pagination?.onPageChange(page) || setInternalCurrentPage(page)
              }}
              onPageSizeChange={(size) => {
                pagination?.onPageSizeChange(size) || setInternalPageSize(size)
              }}
              isDark={isDark}
            />
          </div>
        )}
      </div>
    </div>
  )
}
