'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { X, Plus, Users, Home, Search, Loader2 } from 'lucide-react'
import { useApp } from '@/app/providers'

interface List {
  id: string
  name: string
  type?: 'people' | 'properties' // Optional for backward compatibility
  count?: number
  created_at?: string
  updated_at?: string
}

interface ListSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (listId: string, listName: string) => Promise<void>
  onCreateNew: (name: string) => Promise<string>
  listingIds?: string[]
  isDark?: boolean
}

export default function ListSelectorModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  listingIds = [],
  isDark = false
}: ListSelectorModalProps) {
  const { profile } = useApp()
  const supabase = createClientComponentClient()
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch user's lists
  const fetchLists = useCallback(async () => {
    if (!profile?.id) return

    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all user's lists (no type filtering)
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (listsError) {
        console.error('Error loading lists:', listsError)
        setError('Failed to load lists')
        return
      }

      // Fetch counts for each list
      const listsWithCounts = await Promise.all(
        (listsData || []).map(async (list) => {
          try {
            const { count } = await supabase
              .from('list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id)

            return {
              ...list,
              count: count || 0
            }
          } catch (err) {
            return {
              ...list,
              count: 0
            }
          }
        })
      )

      setLists(listsWithCounts)
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load lists')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, supabase])

  useEffect(() => {
    if (isOpen && profile?.id) {
      fetchLists()
      setShowCreateForm(false)
      setNewListName('')
      setSearchQuery('')
    }
  }, [isOpen, profile?.id, fetchLists])

  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError('List name is required')
      return
    }

    try {
      setCreating(true)
      setError(null)

      const listId = await onCreateNew(newListName.trim())
      
      // Refresh lists
      await fetchLists()
      
      // Select the newly created list
      const newList = lists.find(l => l.id === listId) || { id: listId, name: newListName.trim() }
      await handleSelectList(listId, newListName.trim())
      
      setShowCreateForm(false)
      setNewListName('')
    } catch (err: any) {
      console.error('Error creating list:', err)
      setError(err.message || 'Failed to create list')
    } finally {
      setCreating(false)
    }
  }

  const handleSelectList = async (listId: string, listName: string) => {
    try {
      setAddingToList(listId)
      setError(null)
      await onSelect(listId, listName)
      onClose()
    } catch (err: any) {
      console.error('Error adding to list:', err)
      setError(err.message || 'Failed to add to list')
    } finally {
      setAddingToList(null)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          background: isDark
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)'
            : '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '20px',
            fontWeight: 600,
            color: isDark ? '#e2e8f0' : '#1e293b',
            margin: 0
          }}>
            Select a List
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#64748b',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(99, 102, 241, 0.1)' : '#f1f5f9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e2e8f0'
        }}>
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '18px',
              height: '18px',
              color: isDark ? '#64748b' : '#9ca3af',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lists..."
              style={{
                width: '100%',
                paddingLeft: '40px',
                paddingRight: '12px',
                paddingTop: '10px',
                paddingBottom: '10px',
                border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #d1d5db',
                borderRadius: '8px',
                background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
                color: isDark ? '#e2e8f0' : '#1e293b',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#6366f1'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.3)' : '#d1d5db'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 24px'
        }}>
          {error && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px',
              color: isDark ? '#94a3b8' : '#64748b'
            }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : showCreateForm ? (
            /* Create New List Form */
            <div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => {
                    setNewListName(e.target.value)
                    setError(null)
                  }}
                  placeholder="Enter list name"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '16px',
                    outline: 'none',
                    marginBottom: '12px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateList()
                    } else if (e.key === 'Escape') {
                      setShowCreateForm(false)
                    }
                  }}
                />
                <select
                  value={newListType}
                  onChange={(e) => setNewListType(e.target.value as 'people' | 'properties')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="people">People</option>
                  <option value="properties">Properties</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewListName('')
                    setError(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: isDark ? '#e2e8f0' : '#64748b',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={creating || !newListName.trim()}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: 'none',
                    borderRadius: '8px',
                    background: creating || !newListName.trim()
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#ffffff',
                    cursor: creating || !newListName.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: creating || !newListName.trim() ? 0.6 : 1
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            /* Lists */
            <>
              {filteredLists.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  {searchQuery ? 'No lists found' : 'No lists yet'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleSelectList(list.id, list.name)}
                      disabled={addingToList === list.id}
                      style={{
                        padding: '16px',
                        border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: isDark
                          ? addingToList === list.id
                            ? 'rgba(99, 102, 241, 0.2)'
                            : 'rgba(30, 41, 59, 0.5)'
                          : addingToList === list.id
                            ? '#f3f4f6'
                            : '#ffffff',
                        color: isDark ? '#e2e8f0' : '#1e293b',
                        cursor: addingToList === list.id ? 'wait' : 'pointer',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: addingToList === list.id ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (addingToList !== list.id) {
                          e.currentTarget.style.background = isDark
                            ? 'rgba(99, 102, 241, 0.15)'
                            : '#f9fafb'
                          e.currentTarget.style.borderColor = '#6366f1'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (addingToList !== list.id) {
                          e.currentTarget.style.background = isDark
                            ? 'rgba(30, 41, 59, 0.5)'
                            : '#ffffff'
                          e.currentTarget.style.borderColor = isDark
                            ? 'rgba(99, 102, 241, 0.2)'
                            : '#e2e8f0'
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {list.type === 'people' ? (
                          <Users size={20} color={isDark ? '#818cf8' : '#6366f1'} />
                        ) : (
                          <Home size={20} color={isDark ? '#f472b6' : '#ec4899'} />
                        )}
                        <div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            marginBottom: '4px'
                          }}>
                            {list.name}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: isDark ? '#64748b' : '#6b7280'
                          }}>
                            {list.count || 0} items
                          </div>
                        </div>
                      </div>
                      {addingToList === list.id && (
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e2e8f0',
          display: 'flex',
          gap: '8px'
        }}>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                flex: 1,
                padding: '12px',
                border: '2px dashed rgba(99, 102, 241, 0.3)',
                borderRadius: '8px',
                background: 'transparent',
                color: isDark ? '#818cf8' : '#6366f1',
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6366f1'
                e.currentTarget.style.background = isDark
                  ? 'rgba(99, 102, 241, 0.1)'
                  : 'rgba(99, 102, 241, 0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Plus size={16} />
              Create New List
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

