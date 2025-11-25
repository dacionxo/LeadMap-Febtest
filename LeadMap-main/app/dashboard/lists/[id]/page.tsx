'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import DashboardLayout from '../../components/DashboardLayout'
import VirtualizedListingsTable from '../../prospect-enrich/components/VirtualizedListingsTable'
import BulkActions from '../components/BulkActions'
import { ArrowLeft, Download, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [pageSize] = useState(20) // Match Apollo.io default
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
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

      const response = await fetch(`/api/lists/${listId}/items?${params}`)
      
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

      const data: ListItemsResponse = await response.json()
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ List data fetched:', { 
          listId, 
          listName: data.list?.name, 
          itemCount: data.totalCount 
        })
      }
      
      setList({
        id: data.list.id,
        name: data.list.name,
        type: data.list.type as 'people' | 'properties'
      })
      setListings(data.listings)
      setTotalCount(data.totalCount)
      setTotalPages(data.totalPages)
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

  // Sync header scroll with data container
  useEffect(() => {
    const headerEl = headerScrollRef.current
    const scrollContainer = dataScrollContainerRef.current
    
    if (!headerEl || !scrollContainer) return
    
    const syncHeaderPosition = () => {
      headerEl.style.transform = `translateX(${scrollContainer.scrollLeft}px)`
    }
    
    syncHeaderPosition()
    scrollContainer.addEventListener('scroll', syncHeaderPosition, { passive: true })
    
    return () => {
      scrollContainer.removeEventListener('scroll', syncHeaderPosition)
    }
  }, [])

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
      // Get the list_item IDs for the selected listings
      // We need to fetch list_items to get their IDs
      const selectedListingIds = Array.from(selectedIds)
      const { data: listItems } = await client
        .from('list_items')
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

        const { error } = await client
          .from('contacts')
          .insert([{
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
          }])

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
        .from('list_items')
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

  return (
    <DashboardLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f4ff 100%)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
          padding: '24px 32px',
          boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => router.push('/dashboard/lists')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9'
                  e.currentTarget.style.color = '#1e293b'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#64748b'
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <h1 style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: '28px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
                letterSpacing: '-0.02em'
              }}>
                {list.name}
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                color: '#64748b',
                fontWeight: 500
              }}>
                {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </div>
              <button
                onClick={fetchListData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#374151',
                  border: '2px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1'
                  e.currentTarget.style.background = '#f8fafc'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                  e.currentTarget.style.background = '#ffffff'
                }}
                title="Refresh list data"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#374151',
                  border: '2px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  e.currentTarget.style.color = '#ffffff'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.color = '#374151'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{
            position: 'relative',
            maxWidth: '600px'
          }}>
            <Search style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '18px',
              height: '18px',
              color: '#9ca3af',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by address, agent name, email, or listing ID..."
              style={{
                width: '100%',
                paddingLeft: '42px',
                paddingRight: '16px',
                paddingTop: '10px',
                paddingBottom: '10px',
                border: '2px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
                color: '#111827',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.1)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#6366f1'
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.15), 0 8px 16px rgba(99, 102, 241, 0.2)'
                e.currentTarget.style.transform = 'scale(1.01)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.1)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            />
          </div>
        </div>

        {/* Content Section */}
        <div style={{
          flex: 1,
          padding: '24px 32px',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: selectedIds.size > 0 ? '100px' : '24px'
        }}>
          {loading ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
              borderRadius: '12px',
              padding: '64px',
              textAlign: 'center',
              boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.1)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                color: '#000000',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '16px',
                fontWeight: 500
              }}>
                Loading list items...
              </div>
            </div>
          ) : listings.length === 0 ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
              borderRadius: '12px',
              padding: '64px',
              textAlign: 'center',
              boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.1)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                color: '#000000',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '16px',
                fontWeight: 500,
                marginBottom: '8px'
              }}>
                {searchQuery ? 'No items match your search' : 'No items in this list'}
              </div>
              <div style={{
                color: '#000000',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                opacity: 0.7
              }}>
                {searchQuery ? 'Try adjusting your search terms' : 'Add items to this list to get started'}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.1)',
              overflow: 'hidden',
              height: '100%'
            }}>
              {/* Table Header */}
              <div 
                ref={headerScrollRef}
                style={{
                  display: 'flex',
                  width: 'max-content',
                  minWidth: '100%',
                  padding: '16px 18px',
                  borderBottom: '2px solid rgba(99, 102, 241, 0.1)',
                  background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.98) 0%, rgba(241, 245, 249, 0.95) 100%)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  willChange: 'transform'
                }}
              >
                <div style={{ marginRight: '16px', flexShrink: 0, width: '18px', display: 'flex', alignItems: 'center' }} />
                <div style={{ flex: '0 0 280px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('street')}>
                    Address {sortBy === 'street' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 130px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('list_price')}>
                    Price {sortBy === 'list_price' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 120px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('status')}>
                    Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 100px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('ai_investment_score')}>
                    AI Score {sortBy === 'ai_investment_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 100px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('beds')}>
                    Beds {sortBy === 'beds' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 110px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('full_baths')}>
                    Baths {sortBy === 'full_baths' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 140px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('sqft')}>
                    Sqft {sortBy === 'sqft' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 200px', marginRight: '24px', minWidth: 0 }}>
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
                <div style={{ flex: '0 0 150px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('agent_name')}>
                    Agent Name {sortBy === 'agent_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 180px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('agent_email')}>
                    Agent Email {sortBy === 'agent_email' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flex: '0 0 130px', marginRight: '24px', minWidth: 0 }}>
                  <span style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }} onClick={() => handleSort('agent_phone')}>
                    Agent Phone {sortBy === 'agent_phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </span>
                </div>
                <div style={{ flexShrink: 0, width: '120px', display: 'flex', justifyContent: 'flex-end' }}>
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

              {/* Virtualized Table */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <VirtualizedListingsTable
                  listings={listings}
                  filters={{ search: debouncedSearch }}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onListingClick={handleListingClick}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  crmContactIds={crmContactIds}
                  onSave={handleSave}
                  onAction={(action, listing) => {
                    if (action === 'remove_from_list') {
                      handleRemoveFromList(listing)
                    }
                  }}
                  scrollContainerRef={dataScrollContainerRef}
                  variant="standalone"
                  showSummary={true}
                  showPagination={false}
                  isDark={false}
                />
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  borderTop: '1px solid rgba(99, 102, 241, 0.1)',
                  background: 'rgba(248, 250, 252, 0.5)'
                }}>
                  <div style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    color: '#64748b'
                  }}>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} items
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: currentPage === 1 ? '#f3f4f6' : '#ffffff',
                        color: currentPage === 1 ? '#9ca3af' : '#374151',
                        border: `1px solid ${currentPage === 1 ? '#e5e7eb' : 'rgba(99, 102, 241, 0.2)'}`,
                        borderRadius: '8px',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        opacity: currentPage === 1 ? 0.5 : 1
                      }}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <div style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '14px',
                      color: '#374151',
                      fontWeight: 500,
                      padding: '0 12px'
                    }}>
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: currentPage === totalPages ? '#f3f4f6' : '#ffffff',
                        color: currentPage === totalPages ? '#9ca3af' : '#374151',
                        border: `1px solid ${currentPage === totalPages ? '#e5e7eb' : 'rgba(99, 102, 241, 0.2)'}`,
                        borderRadius: '8px',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        opacity: currentPage === totalPages ? 0.5 : 1
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
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
