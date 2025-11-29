'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, Search, Users, Building2, Filter, Settings, Download, MoreVertical, Info, Trash2, Edit, X, Upload } from 'lucide-react'

interface List {
  id: string
  name: string
  type: 'people' | 'properties'
  description?: string
  created_at?: string
  updated_at?: string
  item_count?: number
}

export default function ListsPage() {
  const router = useRouter()
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<'lastModified' | 'name' | 'created'>('lastModified')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newListType, setNewListType] = useState<'people' | 'properties'>('properties')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deletingListId, setDeletingListId] = useState<string | null>(null)
  const [editingList, setEditingList] = useState<List | null>(null)
  const [editListName, setEditListName] = useState('')
  const [editListType, setEditListType] = useState<'people' | 'properties'>('properties')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchLists()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        setOpenMenuId(null)
      }
    }

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [openMenuId])

  async function fetchLists() {
    try {
      setLoading(true)
      const response = await fetch('/api/lists?includeCount=true')
      const data = await response.json()

      if (response.ok) {
        setLists(data.lists || [])
      } else {
        console.error('Error fetching lists:', data.error)
        setLists([])
      }
    } catch (error) {
      console.error('Error:', error)
      setLists([])
    } finally {
      setLoading(false)
    }
  }

  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateList = (type: 'people' | 'properties') => {
    setNewListType(type)
    setNewListName('')
    setShowCreateModal(true)
  }

  const handleListCreated = async () => {
    if (!newListName.trim()) return

    try {
      setCreating(true)
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName.trim(),
          type: newListType,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        fetchLists()
        setShowCreateModal(false)
        setNewListName('')
      } else {
        alert(data.error || 'Failed to create list')
      }
    } catch (error) {
      console.error('Error creating list:', error)
      alert('Failed to create list')
    } finally {
      setCreating(false)
    }
  }

  // Separate lists by type
  const peopleLists = useMemo(() => {
    return lists.filter(list => list.type === 'people')
  }, [lists])

  const propertiesLists = useMemo(() => {
    return lists.filter(list => list.type === 'properties')
  }, [lists])

  // Filter and sort
  const filteredPeopleLists = useMemo(() => {
    let filtered = peopleLists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(list => 
        list.name.toLowerCase().includes(query)
      )
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'created') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      } else { // lastModified
        return new Date(b.updated_at || b.created_at || 0).getTime() - 
               new Date(a.updated_at || a.created_at || 0).getTime()
      }
    })
    
    return filtered
  }, [peopleLists, searchQuery, sortBy])

  const filteredPropertiesLists = useMemo(() => {
    let filtered = propertiesLists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(list => 
        list.name.toLowerCase().includes(query)
      )
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'created') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      } else { // lastModified
        return new Date(b.updated_at || b.created_at || 0).getTime() - 
               new Date(a.updated_at || a.created_at || 0).getTime()
      }
    })
    
    return filtered
  }, [propertiesLists, searchQuery, sortBy])

  const handleEditList = (list: List) => {
    setEditingList(list)
    setEditListName(list.name)
    setEditListType(list.type)
    setOpenMenuId(null)
  }

  const handleUpdateList = async () => {
    if (!editingList || !editListName.trim()) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/lists/${editingList.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editListName.trim(),
          type: editListType,
        })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchLists()
        setEditingList(null)
        setEditListName('')
      } else {
        alert(data.error || 'Failed to update list')
      }
    } catch (error) {
      console.error('Error updating list:', error)
      alert('Failed to update list')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(`Are you sure you want to delete "${listName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingListId(listId)
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const data = await response.json()

      if (response.ok) {
        // Remove the list from state
        setLists(prevLists => prevLists.filter(list => list.id !== listId))
      } else {
        alert(data.error || 'Failed to delete list')
      }
    } catch (error) {
      console.error('Error deleting list:', error)
      alert('Failed to delete list')
    } finally {
      setDeletingListId(null)
      setOpenMenuId(null)
    }
  }

  const handleExportListCSV = async (listId: string, listName: string) => {
    try {
      // Fetch all list items (we'll get all pages)
      const response = await fetch(`/api/lists/${listId}/paginated?page=1&pageSize=1000`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        alert('Failed to fetch list items for export')
        return
      }

      const data = await response.json()
      const items = data.data || []

      if (items.length === 0) {
        alert('No items to export')
        return
      }

      // Determine headers based on list type
      const list = lists.find(l => l.id === listId)
      const isPropertiesList = list?.type === 'properties'

      let headers: string[]
      let rows: string[][]

      if (isPropertiesList) {
        // Properties list - export listing data
        headers = [
          'Listing ID', 'Address', 'City', 'State', 'Zip Code', 'Price', 
          'Beds', 'Baths', 'Sqft', 'Status', 'Agent Name', 'Agent Email', 
          'Agent Phone', 'Score', 'Year Built', 'Last Sale Price', 'Last Sale Date', 'Property URL'
        ]
        
        rows = items.map((item: any) => [
          item.listing_id || '',
          item.street || '',
          item.city || '',
          item.state || '',
          item.zip_code || '',
          item.list_price?.toString() || '',
          item.beds?.toString() || '',
          item.full_baths?.toString() || '',
          item.sqft?.toString() || '',
          item.status || '',
          item.agent_name || '',
          item.agent_email || '',
          item.agent_phone || '',
          item.ai_investment_score?.toString() || '',
          item.year_built?.toString() || '',
          item.last_sale_price?.toString() || '',
          item.last_sale_date || '',
          item.property_url || ''
        ])
      } else {
        // People list - export contact data
        headers = [
          'Name', 'Email', 'Phone', 'Company', 'Job Title', 
          'Address', 'City', 'State', 'Zip Code', 'Source'
        ]
        
        rows = items.map((item: any) => [
          `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.agent_name || '',
          item.email || item.agent_email || '',
          item.phone || item.agent_phone || '',
          item.company || '',
          item.job_title || '',
          item.address || item.street || '',
          item.city || '',
          item.state || '',
          item.zip_code || '',
          item.source || ''
        ])
      }

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${listName.replace(/[^a-z0-9]/gi, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting CSV:', err)
      alert('Failed to export list')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <DashboardLayout>
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#111827',
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              My lists
            </h1>

            <button
              onClick={() => handleCreateList('properties')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#fbbf24',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f59e0b'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fbbf24'
              }}
            >
              <Plus size={16} />
              Create a list
            </button>
          </div>

          {/* Search and Filters */}
          {lists.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '18px',
                  height: '18px',
                  color: '#9ca3af',
                  pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search lists"
                  style={{
                    width: '100%',
                    paddingLeft: '40px',
                    paddingRight: '12px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: showFilters ? '#f3f4f6' : '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                <Filter size={16} />
                Show Filters
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  cursor: 'pointer'
                }}
              >
                <option value="lastModified">Last Modified</option>
                <option value="name">Name</option>
                <option value="created">Created</option>
              </select>

              <button
                style={{
                  padding: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Settings size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px' }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Loading lists...
            </div>
          ) : lists.length === 0 ? (
            /* Empty State - Apollo Style */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 32px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '120px',
                height: '120px',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px'
              }}>
                📋
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '12px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                Welcome to your lists
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                marginBottom: '32px',
                maxWidth: '500px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                Lists help you organize your prospects and start targeted campaigns. Pick a template below to get started.
              </p>
              <div style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => handleCreateList('people')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    backgroundColor: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1'
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }}
                >
                  <Users size={18} />
                  Create a prospects list
                </button>
                <button
                  onClick={() => handleCreateList('properties')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    backgroundColor: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#6366f1'
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }}
                >
                  <Building2 size={18} />
                  Create a property list
                </button>
              </div>
              <div style={{ marginTop: '24px' }}>
                <a
                  href="#"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#6366f1',
                    fontSize: '14px',
                    textDecoration: 'none',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  <Info size={14} />
                  Learn more about lists
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* People Section */}
              <div style={{ marginBottom: '48px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111827',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Prospects {peopleLists.length}
                  </h2>
                </div>

                {filteredPeopleLists.length === 0 ? (
                  <div style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px'
                  }}>
                    <div style={{ marginBottom: '16px', fontSize: '48px' }}>🔍</div>
                    <div>No lists match your criteria</div>
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      Try adjusting your search, filters or groups to find what you're looking for.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
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
                            <input type="checkbox" style={{ marginRight: '8px' }} />
                            LIST NAME
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
                            # OF RECORDS
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
                            TYPE
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
                            CREATED BY
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
                            LAST MODIFIED
                          </th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                          }}>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPeopleLists.map((list) => (
                          <tr
                            key={list.id}
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
                            onClick={() => router.push(`/dashboard/lists/${list.id}`)}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: '#111827',
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  transition: 'color 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#6366f1'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#111827'
                                }}
                                >
                                  {list.name}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                fontSize: '15px',
                                fontWeight: 600,
                                color: '#111827',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                letterSpacing: '0.025em'
                              }}>
                                {list.item_count || 0}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}>
                                <Users size={12} />
                                Prospects
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                              You
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                              {formatDate(list.updated_at || list.created_at)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '8px'
                              }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleExportListCSV(list.id, list.name)
                                  }}
                                  title="Download CSV"
                                  style={{
                                    padding: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                >
                                  <Download size={16} color="#6b7280" />
                                </button>
                                <div style={{ position: 'relative' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuId(openMenuId === list.id ? null : list.id)
                                    }}
                                    style={{
                                      padding: '6px',
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      borderRadius: '4px'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f3f4f6'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                  >
                                    <MoreVertical size={16} color="#6b7280" />
                                  </button>
                                  {openMenuId === list.id && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        marginTop: '4px',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        zIndex: 1000,
                                        minWidth: '160px',
                                        padding: '4px'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteList(list.id, list.name)
                                        }}
                                        disabled={deletingListId === list.id}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: deletingListId === list.id ? 'not-allowed' : 'pointer',
                                          fontSize: '14px',
                                          color: deletingListId === list.id ? '#9ca3af' : '#dc2626',
                                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                          textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (deletingListId !== list.id) {
                                            e.currentTarget.style.backgroundColor = '#fef2f2'
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent'
                                        }}
                                      >
                                        <Trash2 size={16} />
                                        {deletingListId === list.id ? 'Deleting...' : 'Delete'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Companies Section */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111827',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Properties {propertiesLists.length}
                  </h2>
                </div>

                {filteredPropertiesLists.length === 0 ? (
                  <div style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px'
                  }}>
                    <div style={{ marginBottom: '16px', fontSize: '48px' }}>🔍</div>
                    <div>No lists match your criteria</div>
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      Try adjusting your search, filters or groups to find what you're looking for.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
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
                            <input type="checkbox" style={{ marginRight: '8px' }} />
                            LIST NAME
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
                            # OF RECORDS
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
                            TYPE
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
                            CREATED BY
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
                            LAST MODIFIED
                          </th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                          }}>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPropertiesLists.map((list) => (
                          <tr
                            key={list.id}
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
                            onClick={() => router.push(`/dashboard/lists/${list.id}`)}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: '#111827',
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  transition: 'color 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#6366f1'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#111827'
                                }}
                                >
                                  {list.name}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                fontSize: '15px',
                                fontWeight: 600,
                                color: '#111827',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                letterSpacing: '0.025em'
                              }}>
                                {list.item_count || 0}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}>
                                <Building2 size={12} />
                                Properties
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                              You
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                              {formatDate(list.updated_at || list.created_at)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '8px'
                              }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleExportListCSV(list.id, list.name)
                                  }}
                                  style={{
                                    padding: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                  title="Download CSV"
                                >
                                  <Download size={16} color="#6b7280" />
                                </button>
                                <div style={{ position: 'relative' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuId(openMenuId === list.id ? null : list.id)
                                    }}
                                    style={{
                                      padding: '6px',
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      borderRadius: '4px'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f3f4f6'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                  >
                                    <MoreVertical size={16} color="#6b7280" />
                                  </button>
                                  {openMenuId === list.id && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        marginTop: '4px',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        zIndex: 1000,
                                        minWidth: '160px',
                                        padding: '4px'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEditList(list)
                                        }}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: 'pointer',
                                          fontSize: '14px',
                                          color: '#374151',
                                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                          textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#f9fafb'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent'
                                        }}
                                      >
                                        <Edit size={16} />
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteList(list.id, list.name)
                                        }}
                                        disabled={deletingListId === list.id}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: deletingListId === list.id ? 'not-allowed' : 'pointer',
                                          fontSize: '14px',
                                          color: deletingListId === list.id ? '#9ca3af' : '#dc2626',
                                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                          textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (deletingListId !== list.id) {
                                            e.currentTarget.style.backgroundColor = '#fef2f2'
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent'
                                        }}
                                      >
                                        <Trash2 size={16} />
                                        {deletingListId === list.id ? 'Deleting...' : 'Delete'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* List Settings Modal */}
        {editingList && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            if (!updating) {
              setEditingList(null)
              setEditListName('')
            }
          }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                width: '90%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#111827',
                  margin: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  List Settings
                </h2>
                <button
                  onClick={() => {
                    if (!updating) {
                      setEditingList(null)
                      setEditListName('')
                    }
                  }}
                  disabled={updating}
                  style={{
                    padding: '4px',
                    border: 'none',
                    background: 'transparent',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    if (!updating) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <X size={20} color="#6b7280" />
                </button>
              </div>

              {/* Content */}
              <div style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}>
                {/* List Name */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    List Name
                  </label>
                  <input
                    type="text"
                    value={editListName}
                    onChange={(e) => setEditListName(e.target.value)}
                    placeholder="Enter list name"
                    disabled={updating}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {/* List Target */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    List target
                  </label>
                  <select
                    value={editListType}
                    onChange={(e) => setEditListType(e.target.value as 'people' | 'properties')}
                    disabled={updating}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      backgroundColor: '#ffffff',
                      cursor: updating ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '36px'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <option value="people">People</option>
                    <option value="properties">Properties</option>
                  </select>
                </div>

                {/* Add record from */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '16px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Add record from
                  </label>
                  
                  {/* Filters */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 400,
                      color: '#6b7280',
                      marginBottom: '8px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      Filters
                    </label>
                    <button
                      onClick={() => {
                        // TODO: Implement filter selection
                        alert('Filter selection coming soon')
                      }}
                      disabled={updating}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        cursor: updating ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        color: '#374151',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!updating) {
                          e.currentTarget.style.borderColor = '#6366f1'
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db'
                        e.currentTarget.style.backgroundColor = '#ffffff'
                      }}
                    >
                      <Filter size={16} />
                      Select filters
                    </button>
                  </div>

                  {/* CSV */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 400,
                      color: '#6b7280',
                      marginBottom: '8px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      CSV
                    </label>
                    <button
                      onClick={() => {
                        // TODO: Implement CSV upload
                        alert('CSV upload coming soon')
                      }}
                      disabled={updating}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        cursor: updating ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        color: '#374151',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!updating) {
                          e.currentTarget.style.borderColor = '#6366f1'
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db'
                        e.currentTarget.style.backgroundColor = '#ffffff'
                      }}
                    >
                      <Upload size={16} />
                      Upload CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '24px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    if (!updating) {
                      setEditingList(null)
                      setEditListName('')
                    }
                  }}
                  disabled={updating}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#374151'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateList}
                  disabled={!editListName.trim() || updating}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: (!editListName.trim() || updating) ? '#9ca3af' : '#6366f1',
                    cursor: (!editListName.trim() || updating) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#ffffff',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (editListName.trim() && !updating) {
                      e.currentTarget.style.backgroundColor = '#4f46e5'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (editListName.trim() && !updating) {
                      e.currentTarget.style.backgroundColor = '#6366f1'
                    }
                  }}
                >
                  {updating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create List Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '400px',
                width: '90%'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
                Create {newListType === 'people' ? 'People' : 'Properties'} List
              </h3>
              <input
                type="text"
                placeholder="List name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating && newListName.trim()) {
                    handleListCreated()
                  } else if (e.key === 'Escape') {
                    setShowCreateModal(false)
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleListCreated}
                  disabled={!newListName.trim() || creating}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: creating || !newListName.trim() ? '#9ca3af' : '#6366f1',
                    color: '#ffffff',
                    cursor: creating || !newListName.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
