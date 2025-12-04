'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import DashboardLayout from '../../components/DashboardLayout'
import VirtualizedListingsTable from '../../prospect-enrich/components/VirtualizedListingsTable'
import BulkActions from '../components/BulkActions'
import ApolloPagination from '../../prospect-enrich/components/ApolloPagination'
import { ArrowLeft, Download, Search, RefreshCw, ChevronLeft, ChevronRight, Users, Building2, Filter, Settings, Plus, MoreVertical, CheckCircle, Phone, Link2, MapPin, Sparkles, ChevronDown, Zap, Workflow, X } from 'lucide-react'

// ============================================================================
// Stable Column Configuration (Apollo-style)
// ============================================================================
// Define columns outside component to ensure stability across pagination
// These match the Prospect page columns exactly: Address, Price, Status, AI Score, Beds, Baths, Sqft, Text, Agent Name, Agent Email, Agent Phone, Actions
// Order and column names must match the Prospect page for consistency
const DEFAULT_PROPERTY_COLUMNS = [
  'address',      // Address (280px)
  'price',        // Price (130px)
  'status',       // Status (120px)
  'score',        // AI Score (100px)
  'beds',         // Total Beds (100px)
  'full_baths',   // Total Baths (110px)
  'sqft',         // Housing Square Feet (140px)
  'description',  // Text (200px)
  'agent_name',   // Agent Name (150px)
  'agent_email',  // Agent Email (180px)
  'agent_phone',  // Agent Phone (130px)
  'agent_phone_2',           // Agent Phone 2 (130px)
  'listing_agent_phone_2',   // Listing Agent Phone 2 (160px)
  'listing_agent_phone_5',   // Listing Agent Phone 5 (160px)
  'year_built',   // Year Built (100px)
  'last_sale_price',  // Last Sale Price (130px)
  'last_sale_date',   // Last Sale Date (130px)
  'actions'       // Actions (130px)
] as const

// Visible columns - static array at module scope (no hooks needed)
const VISIBLE_COLUMNS = [...DEFAULT_PROPERTY_COLUMNS]

interface List {
  id: string
  name: string
  type?: 'people' | 'properties'
  description?: string
  created_at?: string
  updated_at?: string
  user_id?: string
}

interface Listing {
  listing_id: string
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  list_price?: number | null
  beds?: number | null
  full_baths?: number | null
  sqft?: number | null
  status?: string | null
  active?: boolean
  ai_investment_score?: number | null
  agent_email?: string | null
  agent_phone?: string | null
  agent_name?: string | null
  agent_phone_2?: string | null
  listing_agent_phone_2?: string | null
  listing_agent_phone_5?: string | null
  text?: string | null
  year_built?: number | null
  last_sale_price?: number | null
  last_sale_date?: string | null
  created_at?: string
  property_url?: string | null
  price_per_sqft?: number | null
  [key: string]: any
}

interface ListItemsResponse {
  listings: Listing[]
  totalCount: number
  page?: number // Legacy - use currentPage instead
  currentPage?: number
  pageSize: number
  totalPages: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
  list: {
    id: string
    name: string
    type: string
  }
}

interface ListPaginatedResponse {
  data: Listing[]
  count: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  list: {
    id: string
    name: string
    type: string
  }
}

export default function ListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string

  // Validate listId
  useEffect(() => {
    if (listId && typeof listId === 'string') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('📋 List detail page loaded with listId:', listId)
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Invalid listId:', listId)
      }
      router.push('/dashboard/lists')
    }
  }, [listId, router])
  
  const [list, setList] = useState<List | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [crmContactIds, setCrmContactIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20) // Match Apollo.io default
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [groupBy, setGroupBy] = useState('type')
  const viewOptionsRef = useRef<HTMLDivElement>(null)
  
  // Handler for page size changes
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1) // Reset to first page when page size changes
  }, [])
  
  const [supabase, setSupabase] = useState<ReturnType<typeof createClientComponentClient> | null>(null)
  const dataScrollContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)

  // Only create Supabase client on client side after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabase(createClientComponentClient())
    }
  }, [])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch list items from API
  const fetchListData = useCallback(async () => {
    if (!listId) return

    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(debouncedSearch && { search: debouncedSearch })
      })

      // Use the new /paginated endpoint which has proper Apollo-style reconstruction
      const response = await fetch(`/api/lists/${listId}/paginated?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          // If response is not JSON, use status text
          errorData = { error: response.statusText || 'Unknown error' }
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ API Error:', { 
            status: response.status, 
            statusText: response.statusText,
            error: errorData.error,
            details: errorData.details
          })
        }
        
        if (response.status === 401) {
          // Unauthorized - redirect to login
          if (process.env.NODE_ENV !== 'production') {
            console.error('Unauthorized - redirecting to login')
          }
          router.push('/login?redirect=' + encodeURIComponent(window.location.pathname))
          return
        }
        
        if (response.status === 404) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('List not found. Details:', errorData)
          }
          alert(`List not found: ${errorData.details || errorData.error || 'Unknown error'}`)
          router.push('/dashboard/lists')
          return
        }
        
        // Don't throw error, just set empty state
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to fetch list items:', errorData.error || 'Unknown error')
        }
        setListings([])
        setTotalCount(0)
        setTotalPages(0)
        return
      }

      const data: ListPaginatedResponse = await response.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ List data fetched (paginated):', { 
          listId, 
          listName: data.list?.name, 
          itemCount: data.count,
          totalPages: data.totalPages,
          currentPage: data.page,
          listingsReceived: data.data?.length || 0
        })
      }
      
      setList({
        id: data.list.id,
        name: data.list.name,
        type: data.list.type as 'people' | 'properties'
      })
      
      // Update pagination metadata (map from paginated response shape)
      setTotalCount(data.count)
      setTotalPages(data.totalPages)
      
      // Use server-provided page (it's already clamped)
      const serverPage = data.page || currentPage
      
      // Clamp current page if it's out of range (e.g., items were deleted)
      if (data.totalPages > 0 && serverPage > data.totalPages) {
        const clampedPage = data.totalPages
        console.warn(`⚠️ Current page ${serverPage} exceeds total pages ${data.totalPages}. Clamping to page ${clampedPage}`)
        setCurrentPage(clampedPage)
        // Don't set listings here - let the refetch handle it
        return // Exit early, useEffect will trigger refetch with new currentPage
      }
      
      // Use server-provided page if it differs from current (server has clamped it)
      if (serverPage !== currentPage) {
        setCurrentPage(serverPage)
        return // Exit early, useEffect will trigger refetch with corrected currentPage
      }
      
      // Set listings from data.data (Apollo-style reconstructed rows in membership order)
      if (data.data && data.data.length > 0) {
        setListings(data.data)
      } else if (data.count > 0) {
        // Empty page but items exist - this shouldn't happen, but handle gracefully
        console.warn('⚠️ Empty listings array but count > 0. This may indicate a pagination issue.')
        setListings([])
      } else {
        // Truly empty list
        setListings([])
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error fetching list data:', err)
      }
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [listId, currentPage, pageSize, sortBy, sortOrder, debouncedSearch, router])

  // Fetch list data when dependencies change
  useEffect(() => {
    fetchListData()
  }, [fetchListData])

  // Close view options dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewOptionsRef.current && !viewOptionsRef.current.contains(event.target as Node)) {
        setShowViewOptions(false)
      }
    }

    if (showViewOptions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showViewOptions])

  // Fetch CRM contacts for save status
  useEffect(() => {
    if (!supabase) return
    
    const client = supabase!
    
    async function fetchCrmContacts() {
      try {
        const { data: { user } } = await client.auth.getUser()
        if (!user) return

        const { data: contacts } = await client
          .from('contacts')
          .select('id, source_id')
          .eq('user_id', user.id)
          .eq('source', 'listing')

        if (contacts && Array.isArray(contacts)) {
          const contactIds = new Set<string>()
          const typedContacts = contacts as Array<{ id?: string; source_id?: string | null }>
          typedContacts.forEach(contact => {
            if (contact.source_id) {
              contactIds.add(contact.source_id)
            }
          })
          setCrmContactIds(contactIds)
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error fetching CRM contacts:', err)
        }
      }
    }

    fetchCrmContacts()
  }, [supabase])

  // Header scrolls naturally with data since it's inside the scroll container
  // No manual sync needed - sticky positioning handles vertical stickiness

  const handleExportCSV = useCallback(() => {
    try {
      const headers = [
        'Listing ID', 'Address', 'City', 'State', 'Zip Code', 'Price', 
        'Beds', 'Baths', 'Sqft', 'Status', 'Agent Name', 'Agent Email', 
        'Agent Phone', 'Score', 'Year Built', 'Last Sale Price', 'Last Sale Date'
      ]
      
      const rows = listings.map(listing => [
        listing.listing_id || '',
        listing.street || '',
        listing.city || '',
        listing.state || '',
        listing.zip_code || '',
        listing.list_price?.toString() || '',
        listing.beds?.toString() || '',
        listing.full_baths?.toString() || '',
        listing.sqft?.toString() || '',
        listing.status || '',
        listing.agent_name || '',
        listing.agent_email || '',
        listing.agent_phone || '',
        listing.ai_investment_score?.toString() || '',
        listing.year_built?.toString() || '',
        listing.last_sale_price?.toString() || '',
        listing.last_sale_date || ''
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(list?.name || 'list').replace(/[^a-z0-9]/gi, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error exporting CSV:', err)
      }
      alert('Failed to export list')
    }
  }, [listings, list])

  const handleBulkExportCSV = useCallback(() => {
    const selectedListings = listings.filter(l => selectedIds.has(l.listing_id))
    if (selectedListings.length === 0) {
      alert('Please select items to export')
      return
    }

    try {
      const headers = [
        'Listing ID', 'Address', 'City', 'State', 'Zip Code', 'Price', 
        'Beds', 'Baths', 'Sqft', 'Status', 'Agent Name', 'Agent Email', 
        'Agent Phone', 'Score', 'Year Built', 'Last Sale Price', 'Last Sale Date'
      ]
      
      const rows = selectedListings.map(listing => [
        listing.listing_id || '',
        listing.street || '',
        listing.city || '',
        listing.state || '',
        listing.zip_code || '',
        listing.list_price?.toString() || '',
        listing.beds?.toString() || '',
        listing.full_baths?.toString() || '',
        listing.sqft?.toString() || '',
        listing.status || '',
        listing.agent_name || '',
        listing.agent_email || '',
        listing.agent_phone || '',
        listing.ai_investment_score?.toString() || '',
        listing.year_built?.toString() || '',
        listing.last_sale_price?.toString() || '',
        listing.last_sale_date || ''
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(list?.name || 'list').replace(/[^a-z0-9]/gi, '_')}_selected.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      setSelectedIds(new Set())
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error exporting CSV:', err)
      }
      alert('Failed to export selected items')
    }
  }, [listings, selectedIds, list])

  const handleEmailOwners = useCallback(() => {
    const selectedListings = listings.filter(l => selectedIds.has(l.listing_id))
    const emails = selectedListings
      .map(l => l.agent_email)
      .filter(Boolean)
      .join(', ')
    
    if (emails) {
      window.location.href = `mailto:${emails}?subject=Regarding your property listing`
    } else {
      alert('No email addresses found for selected items')
    }
  }, [listings, selectedIds])

  const handleBulkRemove = useCallback(async () => {
    const client = supabase
    if (!client || selectedIds.size === 0) return

    if (!confirm(`Remove ${selectedIds.size} item(s) from this list?`)) {
      return
    }

    try {
      // Get the list_membership IDs for the selected listings
      // We need to fetch list_memberships to get their IDs
      const selectedListingIds = Array.from(selectedIds)
      const { data: listItems } = await client
        .from('list_memberships')
        .select('id')
        .eq('list_id', listId)
        .in('item_id', selectedListingIds)

      if (!listItems || listItems.length === 0) {
        alert('Could not find items to remove')
        return
      }

      const typedListItems = listItems as Array<{ id: string }>
      const itemIds = typedListItems.map(item => item.id)

      const response = await fetch(`/api/lists/${listId}/items/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          itemIds
        })
      })

      if (!response.ok) {
        throw new Error('Failed to remove items')
      }

      setSelectedIds(new Set())
      await fetchListData()
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error removing items:', err)
      }
      alert('Failed to remove items from list')
    }
  }, [selectedIds, listId, supabase, fetchListData])

  const handleListingClick = (listing: Listing) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Listing clicked:', listing)
    }
  }

  const handleSelect = (listingId: string, selected: boolean) => {
    const newSet = new Set(selectedIds)
    if (selected) {
      newSet.add(listingId)
    } else {
      newSet.delete(listingId)
    }
    setSelectedIds(newSet)
  }

  const handleSave = async (listing: Listing, saved: boolean) => {
    const client = supabase
    if (!client) return
    
    try {
      const { data: { user } } = await client.auth.getUser()
      if (!user) return

      const sourceId = listing.listing_id || listing.property_url
      if (!sourceId) return

      if (saved) {
        if (crmContactIds.has(sourceId)) {
          return
        }

        const nameParts = listing.agent_name?.split(' ') || []
        const firstName = nameParts[0] || null
        const lastName = nameParts.slice(1).join(' ') || 'Property Owner'

        const contactData = {
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          email: listing.agent_email || null,
          phone: listing.agent_phone || null,
          address: listing.street || null,
          city: listing.city || null,
          state: listing.state || null,
          zip_code: listing.zip_code || null,
          source: 'listing',
          source_id: sourceId,
          status: 'new',
          notes: `Saved from list: ${list?.name || 'N/A'}\nList Price: ${listing.list_price ? `$${listing.list_price.toLocaleString()}` : 'N/A'}`
        }

        const { error } = await (client
          .from('contacts') as any)
          .insert([contactData])

        if (!error) {
          setCrmContactIds(prev => new Set([...Array.from(prev), sourceId]))
        }
      } else {
        const { error } = await client
          .from('contacts')
          .delete()
          .eq('user_id', user.id)
          .eq('source', 'listing')
          .eq('source_id', sourceId)

        if (!error) {
          const newSet = new Set(crmContactIds)
          newSet.delete(sourceId)
          setCrmContactIds(newSet)
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error saving listing:', err)
      }
    }
  }

  const handleRemoveFromList = async (listing: Listing) => {
    const client = supabase
    if (!client) return
    
    try {
      const sourceId = listing.listing_id || listing.property_url
      if (!sourceId || !listId) return

      const { error } = await client
        .from('list_memberships')
        .delete()
        .eq('list_id', listId)
        .eq('item_type', 'listing')
        .eq('item_id', sourceId)

      if (!error) {
        await fetchListData()
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error removing from list:', error)
        }
        alert('Failed to remove item from list')
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error removing from list:', err)
      }
      alert('Failed to remove item from list')
    }
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setCurrentPage(1) // Reset to first page on sort
  }

  // Don't render until Supabase client is ready (client-side only)
  if (typeof window === 'undefined' || !supabase) {
    return (
      <DashboardLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: '#64748b',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Loading...
        </div>
      </DashboardLayout>
    )
  }

  if (loading && !list) {
    return (
      <DashboardLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: '#64748b',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Loading list...
        </div>
      </DashboardLayout>
    )
  }

  if (!list) {
    return (
      <DashboardLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: '#64748b',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          List not found
        </div>
      </DashboardLayout>
    )
  }

  const listTypeLabel = list.type === 'people' ? 'Prospects' : 'Properties'
  const listTypeIcon = list.type === 'people' ? Users : Building2
  const ListIcon = listTypeIcon

  // Display range helpers for "Showing X–Y of Z" text
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount)

  // Use static columns configuration from module scope (no hooks needed)
  const visibleColumns = VISIBLE_COLUMNS

  return (
    <DashboardLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#ffffff'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '24px 32px'
        }}>
          {/* Breadcrumbs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#6b7280',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            <span 
              onClick={() => router.push('/dashboard/lists')}
              style={{ cursor: 'pointer', color: '#6366f1' }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              Lists
            </span>
            <span style={{ color: '#9ca3af' }}>›</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>{list.name}</span>
          </div>

          {/* Title and Record Count */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '24px',
                fontWeight: 600,
                color: '#111827',
                margin: 0
              }}>
                {list.name}
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
                color: '#6b7280',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                <ListIcon size={16} />
                <span>{listTypeLabel}</span>
              </div>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                {totalCount} {totalCount === 1 ? 'record' : 'records'}
              </div>
            </div>
          </div>

          {/* Action Bar - Apollo Style (Reorganized) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* First Row: Left side controls and search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
              {/* Left side controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              Default view
                  <ChevronDown size={14} />
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              <Filter size={14} />
              Show Filters
            </button>
              </div>
              
              {/* Search bar */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <Search style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: '#9ca3af',
                pointerEvents: 'none'
              }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                style={{
                  width: '100%',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              />
            </div>
            </div>

            {/* Second Row: Right side action buttons */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              justifyContent: 'flex-start'
            }}>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleExportCSV()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
              title="Export to CSV"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                alert('Import functionality coming soon')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
              title="Import records"
            >
              Import
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                alert('Add records functionality coming soon')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#fbbf24',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#ffffff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f59e0b'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fbbf24'
                  e.currentTarget.style.transform = 'translateY(0)'
              }}
              title="Add records to list"
            >
              <Plus size={14} />
              Add records to list
            </button>
            <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  alert('Research with AI functionality coming soon')
                }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                  backgroundColor: '#8b5cf6',
                  border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                  fontWeight: 500,
                  color: '#ffffff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  transition: 'all 0.2s'
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#7c3aed'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#8b5cf6'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                title="Research with AI"
              >
                <Sparkles size={14} />
              Research with AI
            </button>
            <button
              style={{
                padding: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
                title="More options"
            >
              <MoreVertical size={16} color="#6b7280" />
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
                <Zap size={14} />
              Create workflow
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              Save as new view
            </button>
              <div style={{ position: 'relative' }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
                  ↑↓ {listTypeLabel} Auto-Score
                  <ChevronDown size={14} />
            </button>
              </div>
            <div style={{ position: 'relative' }} ref={viewOptionsRef}>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowViewOptions(!showViewOptions)
                }}
                style={{
                  padding: '6px',
                  backgroundColor: showViewOptions ? '#f3f4f6' : '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s'
                }}
                title="View options"
              >
                <Settings size={16} color="#6b7280" />
              </button>
              
              {showViewOptions && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 1000,
                    width: '320px',
                    minWidth: '280px',
                    padding: 0,
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#111827',
                      margin: 0,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      View options
                    </h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowViewOptions(false)
                      }}
                      style={{
                        padding: '4px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        color: '#6b7280'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Content */}
                  <div style={{
                    padding: '20px'
                  }}>
                    {/* Group by section */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 400,
                        color: '#6b7280',
                        marginBottom: '8px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        Group by
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          border: '1px solid #3b82f6',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}>
                              <div style={{
                                width: '100%',
                                height: '2px',
                                backgroundColor: '#6b7280',
                                borderRadius: '1px'
                              }} />
                              <div style={{
                                width: '80%',
                                height: '2px',
                                backgroundColor: '#6b7280',
                                borderRadius: '1px'
                              }} />
                              <div style={{
                                width: '60%',
                                height: '2px',
                                backgroundColor: '#6b7280',
                                borderRadius: '1px'
                              }} />
                            </div>
                          </div>
                          <span style={{
                            flex: 1,
                            color: '#374151',
                            fontSize: '14px'
                          }}>
                            Group By
                          </span>
                          <select
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              opacity: 0,
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            <option value="none">None</option>
                            <option value="type">Type</option>
                            <option value="status">Status</option>
                            <option value="city">City</option>
                            <option value="state">State</option>
                            <option value="agent_name">Agent Name</option>
                          </select>
                          <span style={{
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: 500,
                            marginLeft: 'auto'
                          }}>
                            {groupBy === 'type' ? 'Type' : 
                             groupBy === 'status' ? 'Status' :
                             groupBy === 'city' ? 'City' :
                             groupBy === 'state' ? 'State' :
                             groupBy === 'agent_name' ? 'Agent Name' : 'None'}
                          </span>
                          <ChevronDown size={16} color="#6b7280" style={{ flexShrink: 0 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div style={{
          flex: 1,
          padding: '24px 32px',
          backgroundColor: '#ffffff',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: selectedIds.size > 0 ? '100px' : '24px'
        }}>
          {loading ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '64px',
              textAlign: 'center',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                color: '#111827',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '16px',
                fontWeight: 500
              }}>
                Loading list items...
              </div>
            </div>
          ) : listings.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '64px',
              textAlign: 'center',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                color: '#111827',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '16px',
                fontWeight: 500,
                marginBottom: '8px'
              }}>
                {searchQuery ? 'No items match your search' : 'No items in this list'}
              </div>
              <div style={{
                color: '#6b7280',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px'
              }}>
                {searchQuery ? 'Try adjusting your search terms' : 'Add items to this list to get started'}
              </div>
            </div>
          ) : list.type === 'people' ? (
            /* People/Prospects Table - Apollo Style */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: '40px' }}>
                      <input type="checkbox" />
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      NAME
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      JOB TITLE
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      COMPANY
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      EMAILS
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      PHONE NUMBERS
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      ACTIONS
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      LINKS
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      LOCATION
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing: any) => {
                    // Handle both contact and listing data
                    const name = listing.agent_name || listing.first_name && listing.last_name 
                      ? `${listing.first_name} ${listing.last_name}` 
                      : listing.first_name || listing.last_name || 'Unknown'
                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    const email = listing.agent_email || listing.email || null
                    const phone = listing.agent_phone || listing.phone || null
                    const company = listing.company || '—'
                    const jobTitle = listing.job_title || listing.title || '—'
                    const location = [listing.city, listing.state].filter(Boolean).join(', ') || '—'
                    
                    return (
                      <tr
                        key={listing.listing_id}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff'
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(listing.listing_id)}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleSelect(listing.listing_id, e.target.checked)
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#6366f1',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 600,
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              flexShrink: 0
                            }}>
                              {initials}
                            </div>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: '#111827',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            }}>
                              {name}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                          {jobTitle}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                          {company}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {email ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14px', color: '#111827' }}>{email}</span>
                              <CheckCircle size={14} color="#10b981" />
                            </div>
                          ) : (
                            <span style={{ fontSize: '14px', color: '#9ca3af' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {phone ? (
                            <span style={{ fontSize: '14px', color: '#111827' }}>{phone}</span>
                          ) : (
                            <span style={{ fontSize: '14px', color: '#9ca3af' }}>Request phone number</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              style={{
                                padding: '4px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <CheckCircle size={16} color="#10b981" />
                            </button>
                            <button
                              style={{
                                padding: '4px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Phone size={16} color="#6b7280" />
                            </button>
                            <button
                              style={{
                                padding: '4px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <MoreVertical size={16} color="#6b7280" />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Link2 size={16} color="#6b7280" />
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                          {location}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {/* Add Row Button */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px dashed #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#6b7280',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  <Plus size={14} />
                  Add a row
                </button>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderTop: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                    </div>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const newPageSize = Number(e.target.value)
                        if (newPageSize > 0 && newPageSize <= 100) {
                          handlePageSizeChange(newPageSize)
                        }
                      }}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        cursor: 'pointer',
                        backgroundColor: '#ffffff'
                      }}
                      aria-label="Items per page"
                    >
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (currentPage > 1) {
                          setCurrentPage(prev => Math.max(1, prev - 1))
                        }
                      }}
                      style={{
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: currentPage === 1 ? '#f3f4f6' : '#ffffff',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: currentPage === 1 ? 'none' : 'auto'
                      }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <select
                      value={currentPage}
                      onChange={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const newPage = Number(e.target.value)
                        if (newPage >= 1 && newPage <= totalPages) {
                          setCurrentPage(newPage)
                        }
                      }}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        cursor: 'pointer',
                        backgroundColor: '#ffffff'
                      }}
                      aria-label="Select page"
                    >
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (currentPage < totalPages) {
                          setCurrentPage(prev => Math.min(totalPages, prev + 1))
                        }
                      }}
                      style={{
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#ffffff',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: currentPage === totalPages ? 'none' : 'auto'
                      }}
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Properties Table - Apollo Style with VirtualizedListingsTable */
            <div
              style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
                padding: '16px 32px 24px',
                gap: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Bulk actions + range text (Apollo-style) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <BulkActions
                  selectedCount={selectedIds.size}
                  onEmailOwners={handleEmailOwners}
                  onExportCSV={handleBulkExportCSV}
                  onRemoveFromList={handleBulkRemove}
                />

                <div
                  style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {totalCount > 0
                    ? `Showing ${startRecord.toLocaleString()}–${endRecord.toLocaleString()} of ${totalCount.toLocaleString()} records`
                    : 'No records to display'}
                </div>
              </div>

              {/* Scrollable virtualized table */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
              borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  overflow: 'hidden',
                }}
              >
                {/* Scrollable container - header is inside so it scrolls horizontally with data */}
                <div
                  ref={dataScrollContainerRef}
                  style={{
                    flex: 1,
                    overflowX: 'auto',
                    overflowY: 'auto',
                    position: 'relative',
                  }}
                >
                  {/* Sticky Header Row - INSIDE scroll container, scrolls horizontally with data */}
              <div 
                ref={headerScrollRef}
                style={{
                  display: 'flex',
                  width: 'max-content',
                  minWidth: '100%',
                  padding: '16px 18px',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}
              >
                  {/* Checkbox column */}
                  <div style={{ 
                    marginRight: '16px', 
                    flexShrink: 0, 
                    width: '18px',
                    display: 'flex',
                    alignItems: 'center'
                  }} />
                  {/* Address */}
                  <div style={{ 
                    flex: '0 0 280px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Address
                  </span>
                </div>
                  {/* Price */}
                  <div style={{ 
                    flex: '0 0 130px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Price
                  </span>
                </div>
                  {/* Status */}
                  <div style={{ 
                    flex: '0 0 120px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Status
                  </span>
                </div>
                  {/* AI Score */}
                  <div style={{ 
                    flex: '0 0 100px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      AI Score
                  </span>
                </div>
                  {/* Total Beds */}
                  <div style={{ 
                    flex: '0 0 100px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Total Beds
                  </span>
                </div>
                  {/* Total Baths */}
                  <div style={{ 
                    flex: '0 0 110px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Total Baths
                  </span>
                </div>
                  {/* Housing Square Feet */}
                  <div style={{ 
                    flex: '0 0 140px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Housing Square Feet
                  </span>
                </div>
                  {/* Text */}
                  <div style={{ 
                    flex: '0 0 200px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Text
                  </span>
                </div>
                  {/* Agent Name */}
                  <div style={{ 
                    flex: '0 0 150px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Agent Name
                  </span>
                </div>
                  {/* Agent Email */}
                  <div style={{ 
                    flex: '0 0 180px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Agent Email
                  </span>
                </div>
                  {/* Agent Phone */}
                  <div style={{ 
                    flex: '0 0 130px', 
                    marginRight: '24px',
                    minWidth: 0
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Agent Phone
                  </span>
                </div>
                  {/* Agent Phone 2 */}
                  {visibleColumns.includes('agent_phone_2') && (
                    <div style={{ 
                      flex: '0 0 130px', 
                      marginRight: '24px',
                      minWidth: 0
                    }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Agent Phone 2
                    </span>
                  </div>
                  )}
                  {/* Listing Agent Phone 2 */}
                  {visibleColumns.includes('listing_agent_phone_2') && (
                    <div style={{ 
                      flex: '0 0 160px', 
                      marginRight: '24px',
                      minWidth: 0
                    }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Listing Agent Phone 2
                    </span>
                  </div>
                  )}
                  {/* Listing Agent Phone 5 */}
                  {visibleColumns.includes('listing_agent_phone_5') && (
                    <div style={{ 
                      flex: '0 0 160px', 
                      marginRight: '24px',
                      minWidth: 0
                    }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Listing Agent Phone 5
                    </span>
                  </div>
                  )}
                  {/* Year Built */}
                  {visibleColumns.includes('year_built') && (
                    <div style={{ 
                      flex: '0 0 100px', 
                      marginRight: '24px',
                      minWidth: 0
                    }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Year Built
                    </span>
                  </div>
                  )}
                  {/* Last Sale Price */}
                  {visibleColumns.includes('last_sale_price') && (
                    <div style={{ 
                      flex: '0 0 130px', 
                      marginRight: '24px',
                      minWidth: 0
                    }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Last Sale Price
                    </span>
                  </div>
                  )}
                  {/* Last Sale Date */}
                  {visibleColumns.includes('last_sale_date') && (
                    <div style={{ 
                      flex: '0 0 130px', 
                      marginRight: '24px',
                      minWidth: 0
                    }}>
                    <span style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Last Sale Date
                    </span>
                  </div>
                  )}
                  {/* Actions */}
                  <div style={{ 
                    flexShrink: 0, 
                    width: '130px', 
                    display: 'flex', 
                    justifyContent: 'flex-end' 
                  }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Actions
                  </span>
                </div>
              </div>

                  {/* Virtualized table content - inside same scroll container as header */}
                <VirtualizedListingsTable
                    // **Key part:** this actually displays your reconstructed rows
                  listings={listings}
                    columns={visibleColumns}
                    variant="embedded"
                    scrollContainerRef={dataScrollContainerRef}
                  filters={{ search: debouncedSearch }}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                    onListingClick={handleListingClick}
                  crmContactIds={crmContactIds}
                  onSave={handleSave}
                  onAction={(action, listing) => {
                      if (action === 'remove') {
                      handleRemoveFromList(listing)
                      } else if (action === 'call') {
                        const phone =
                          listing.agent_phone ||
                          listing.agent_phone_2 ||
                          listing.listing_agent_phone_2 ||
                          listing.listing_agent_phone_5

                        if (phone) {
                          window.location.href = `tel:${phone}`
                        }
                      } else if (action === 'email') {
                        if (listing.agent_email) {
                          window.location.href = `mailto:${listing.agent_email}`
                        }
                      } else if (action === 'open' && listing.property_url) {
                        window.open(listing.property_url, '_blank')
                      }
                    }}
                  />
                  </div>
                </div>

              {/* Apollo-style pagination footer */}
              <div style={{ marginTop: '8px' }}>
                <ApolloPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalCount}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        <BulkActions
          selectedCount={selectedIds.size}
          onEmailOwners={handleEmailOwners}
          onExportCSV={handleBulkExportCSV}
          onRemoveFromList={handleBulkRemove}
        />
      </div>
    </DashboardLayout>
  )
}
