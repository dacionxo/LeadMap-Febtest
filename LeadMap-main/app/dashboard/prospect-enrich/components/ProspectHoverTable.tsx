'use client'

/**
 * ProspectHoverTable Component
 * 
 * A 1-to-1 visual replica of TailwindAdmin's HoverTable component,
 * adapted for LeadMap's prospect data while preserving all API routes.
 * 
 * Key Features:
 * - Exact visual match to TailwindAdmin's /shadcn-tables/hover
 * - Server-side pagination via /api/listings/paginated endpoint (PRESERVED)
 * - All columns preserved: Address, Price, Status, AI Score, Beds, Baths, Sqft, 
 *   Description, Agent Name, Agent Email, Agent Phone, Agent Phone 2, 
 *   Listing Agent Phone 2, Listing Agent Phone 5, Year Built, Last Sale Price, 
 *   Last Sale Date, Actions
 * - Actions: Email, Call, Save, More
 * - Fully compatible with existing API routes and props
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { Badge } from '@/app/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Checkbox } from '@/app/components/ui/checkbox'
import { MoreVertical, Mail, Phone, Bookmark, BookmarkCheck, ExternalLink, DollarSign, Target, MapPin } from 'lucide-react'
import TailwindAdminPagination from './TailwindAdminPagination'
import SaveButton from './AddToCrmButton'

// ============================================================================
// Type Definitions (PRESERVED FROM ProspectCheckboxTable)
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

interface ProspectHoverTableProps {
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
  'fsbo_leads',
  'frbo_leads',
  'imports',
  'trash',
  'foreclosure_listings',
  'probate_leads'
] as const

const DEFAULT_COLUMNS = [
  'address',
  'price',
  'status',
  'score',
  'beds',
  'full_baths',
  'sqft',
  'description',
  'agent_name',
  'agent_email',
  'agent_phone',
  'agent_phone_2',
  'listing_agent_phone_2',
  'listing_agent_phone_5',
  'year_built',
  'last_sale_price',
  'last_sale_date',
  'actions'
]

const HEADER_CELL_CLASS = 'whitespace-nowrap'

function isValidTableName(tableName: string): boolean {
  return VALID_TABLE_NAMES.includes(tableName as any)
}

// ============================================================================
// Main Component - 1:1 Match to TailwindAdmin's HoverTable
// ============================================================================

export default function ProspectHoverTable({
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
}: ProspectHoverTableProps) {
  const columns = providedColumns || [...DEFAULT_COLUMNS]
  const headerTitle = category
    ? `${category.charAt(0).toUpperCase()}${category.slice(1)} Prospects`
    : 'Prospects'
  
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [internalCurrentPage, setInternalCurrentPage] = useState(1)
  const [internalPageSize, setInternalPageSize] = useState(10)

  const currentPage = pagination?.currentPage ?? internalCurrentPage
  const pageSize = pagination?.pageSize ?? internalPageSize

  const showSelectionColumn = Boolean(onSelect)
  const getListingKey = (listing: Listing) => listing.listing_id || listing.property_url || ''
  const listingKeysOnPage = Array.from(new Set(listings.map(getListingKey))).filter(Boolean) as string[]
  const hasPageListings = listingKeysOnPage.length > 0
  const allPageSelected =
    showSelectionColumn &&
    hasPageListings &&
    listingKeysOnPage.every((key) => selectedIds.has(key))
  const somePageSelected =
    showSelectionColumn &&
    hasPageListings &&
    listingKeysOnPage.some((key) => selectedIds.has(key)) &&
    !allPageSelected

  const handleSelectAll = () => {
    if (!showSelectionColumn || !onSelect || !hasPageListings) return
    listingKeysOnPage.forEach((key) => {
      onSelect(key, !allPageSelected)
    })
  }

  const handleRowSelectionChange = (listing: Listing) => {
    if (!showSelectionColumn || !onSelect) return
    const key = getListingKey(listing)
    if (!key) return
    const alreadySelected = selectedIds.has(key)
    onSelect(key, !alreadySelected)
  }

  const isRowSelected = (listing: Listing) => {
    const key = getListingKey(listing)
    return Boolean(key && selectedIds.has(key))
  }

  // Fetch listings - PRESERVED API ROUTES (/api/listings/paginated)
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
      
      // PRESERVED API ROUTE: /api/listings/paginated
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
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount)

  const formatAddress = (listing: Listing) => {
    const street = listing.street || 'N/A'
    const cityStateZip = [listing.city, listing.state, listing.zip_code]
      .filter(Boolean)
      .join(', ') || ''
    return { street, cityStateZip }
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatBaths = (baths: number | null | undefined) => {
    if (!baths) return '-'
    return baths.toString()
  }

  const getDescription = (listing: Listing) => {
    if (listing.text) return listing.text
    if (listing.other?.description) return listing.other.description
    if (listing.other?.text) return listing.other.text
    return '-'
  }

  if (loading && listings.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading listings...</div>
      </div>
    )
  }

  // EXACT 1:1 MATCH TO TAILWINDADMIN'S HOVERTABLE STRUCTURE
  return (
    <div className="border rounded-lg border-ld overflow-hidden h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-20 flex justify-between items-center border-b border-ld bg-white dark:bg-dark px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-ld dark:text-white">{headerTitle}</p>
            <p className="text-xs text-bodytext dark:text-white/70">
              Showing {startItem.toLocaleString()} - {endItem.toLocaleString()} of {totalCount.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {showSelectionColumn && selectedIds.size > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {selectedIds.size} selected
              </span>
            )}
            <span className="text-xs uppercase tracking-[0.3em] text-bodytext dark:text-white/50">hover</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto">
          <Table className="min-w-full table-auto">
          <TableHeader className="sticky top-[64px] z-10 bg-white/95 dark:bg-dark">
            <TableRow>
              {showSelectionColumn && (
                  <TableHead className="w-[56px] px-3 text-center">
                    <button
                      type="button"
                      className={`flex h-10 w-10 items-center justify-center rounded-md border border-transparent hover:border-ld focus:border-ld focus:outline-none ${
                        somePageSelected && !allPageSelected ? 'border-primary bg-primary/10' : ''
                      }`}
                      onClick={handleSelectAll}
                      aria-label={
                        somePageSelected
                          ? 'Some listings selected. Toggle to select or clear all listings on this page'
                          : allPageSelected
                          ? 'Deselect all listings on this page'
                          : 'Select all listings on this page'
                      }
                    >
                    {somePageSelected && !allPageSelected ? (
                      <span className="h-[2px] w-4 rounded-full bg-primary" />
                    ) : (
                      <Checkbox checked={allPageSelected} />
                    )}
                  </button>
                </TableHead>
              )}
              {columns.includes('address') && <TableHead className={HEADER_CELL_CLASS}>Address</TableHead>}
              {columns.includes('price') && <TableHead className={HEADER_CELL_CLASS}>Price</TableHead>}
              {columns.includes('status') && <TableHead className={HEADER_CELL_CLASS}>Status</TableHead>}
              {columns.includes('score') && <TableHead className={HEADER_CELL_CLASS}>AI Score</TableHead>}
              {columns.includes('beds') && <TableHead className={HEADER_CELL_CLASS}>Beds</TableHead>}
              {columns.includes('full_baths') && <TableHead className={HEADER_CELL_CLASS}>Baths</TableHead>}
              {columns.includes('sqft') && <TableHead className={HEADER_CELL_CLASS}>Sqft</TableHead>}
              {columns.includes('description') && <TableHead className={HEADER_CELL_CLASS}>Description</TableHead>}
              {columns.includes('agent_name') && <TableHead className={HEADER_CELL_CLASS}>Agent Name</TableHead>}
              {columns.includes('agent_email') && <TableHead className={HEADER_CELL_CLASS}>Agent Email</TableHead>}
              {columns.includes('agent_phone') && <TableHead className={HEADER_CELL_CLASS}>Agent Phone</TableHead>}
              {columns.includes('agent_phone_2') && <TableHead className={HEADER_CELL_CLASS}>Agent Phone 2</TableHead>}
              {columns.includes('listing_agent_phone_2') && <TableHead className={HEADER_CELL_CLASS}>Listing Agent Phone 2</TableHead>}
              {columns.includes('listing_agent_phone_5') && <TableHead className={HEADER_CELL_CLASS}>Listing Agent Phone 5</TableHead>}
              {columns.includes('year_built') && <TableHead className={HEADER_CELL_CLASS}>Year Built</TableHead>}
              {columns.includes('last_sale_price') && <TableHead className={HEADER_CELL_CLASS}>Last Sale Price</TableHead>}
              {columns.includes('last_sale_date') && <TableHead className={HEADER_CELL_CLASS}>Last Sale Date</TableHead>}
              {columns.includes('actions') && <TableHead className={HEADER_CELL_CLASS}></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (showSelectionColumn ? 1 : 0)}
                  className="text-center py-8 text-bodytext dark:text-white/70"
                >
                  No listings found
                </TableCell>
              </TableRow>
            ) : (
              listings.map((listing) => {
                const { street, cityStateZip } = formatAddress(listing)
                const isSaved = crmContactIds.has(listing.listing_id) || (listing.property_url ? crmContactIds.has(listing.property_url) : false)
                
                return (
                  <TableRow
                    key={listing.listing_id}
                    className="group/row bg-hover dark:bg-transparent cursor-pointer"
                    onClick={() => onListingClick?.(listing)}
                  >
                    {showSelectionColumn && (
                      <TableCell className="px-3">
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center rounded-md border border-transparent hover:border-ld focus:border-ld focus:outline-none"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRowSelectionChange(listing)
                          }}
                          aria-label={`Select listing ${listing.street || listing.listing_id}`}
                        >
                          <Checkbox checked={isRowSelected(listing)} />
                        </button>
                      </TableCell>
                    )}
                    {columns.includes('address') && (
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-3 items-center">
                          <MapPin className="h-4 w-4 text-bodytext" />
                          <div className="truncat line-clamp-2 max-w-56">
                            <h6 className="text-sm font-medium">{street}</h6>
                            <p className="text-xs text-bodytext">{cityStateZip}</p>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    
                    {columns.includes('price') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">{formatPrice(listing.list_price)}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('status') && (
                      <TableCell className="whitespace-nowrap">
                        {listing.active ? (
                          <Badge variant="lightSuccess">{listing.status || 'Active'}</Badge>
                        ) : listing.status?.toLowerCase().includes('expired') || listing.status?.toLowerCase().includes('sold') ? (
                          <Badge variant="lightError">{listing.status}</Badge>
                        ) : (
                          <Badge variant="lightWarning">{listing.status || 'Pending'}</Badge>
                        )}
                      </TableCell>
                    )}
                    
                    {columns.includes('score') && (
                      <TableCell className="whitespace-nowrap">
                        {listing.ai_investment_score !== null && listing.ai_investment_score !== undefined ? (
                          <p className="text-base">{listing.ai_investment_score.toFixed(1)}</p>
                        ) : (
                          <p className="text-base">-</p>
                        )}
                      </TableCell>
                    )}
                    
                    {columns.includes('beds') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">{listing.beds ?? '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('full_baths') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">{formatBaths(listing.full_baths)}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('sqft') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">{listing.sqft ? listing.sqft.toLocaleString() : '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('description') && (
                      <TableCell>
                        <p className="text-base">{getDescription(listing)}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('agent_name') && (
                      <TableCell className="whitespace-nowrap">
                        {" "}
                        <p className="text-base">{listing.agent_name || '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('agent_email') && (
                      <TableCell className="whitespace-nowrap">
                        {" "}
                        <p className="text-base">{listing.agent_email || '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('agent_phone') && (
                      <TableCell className="whitespace-nowrap">
                        {" "}
                        <p className="text-base">{listing.agent_phone || '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('agent_phone_2') && (
                      <TableCell className="whitespace-nowrap">
                        {" "}
                        <p className="text-base">{listing.agent_phone_2 || '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('listing_agent_phone_2') && (
                      <TableCell className="whitespace-nowrap">
                        {" "}
                        <p className="text-base">{listing.listing_agent_phone_2 || '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('listing_agent_phone_5') && (
                      <TableCell className="whitespace-nowrap">
                        {" "}
                        <p className="text-base">{listing.listing_agent_phone_5 || '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('year_built') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">{listing.year_built ?? '-'}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('last_sale_price') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">{formatPrice(listing.last_sale_price)}</p>
                      </TableCell>
                    )}
                    
                    {columns.includes('last_sale_date') && (
                      <TableCell className="whitespace-nowrap">
                        <p className="text-base">
                          {listing.last_sale_date ? new Date(listing.last_sale_date).toLocaleDateString() : '-'}
                        </p>
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
              })
            )}
          </TableBody>
          </Table>
        </div>
      </div>
      
      {showPagination && (
        <div className="pt-4 p-6">
          <TailwindAdminPagination
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
  )
}
