'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import DashboardLayout from '../../components/DashboardLayout'
import ListsTable from '../../lists/components/ListsTable'
import CreateListModal from '../../lists/components/CreateListModal'
import ApolloListContainer from '../../lists/components/ApolloListContainer'
import { Plus, Users, Home, Search } from 'lucide-react'

interface List {
  id: string
  name: string
  type: 'people' | 'properties'
  count?: number
  created_at?: string
  updated_at?: string
  user_id?: string
}

export default function ContactsPage() {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [listType, setListType] = useState<'people' | 'properties'>('people')
  const [mounted, setMounted] = useState(false)
  
  // Create Supabase client only on client side
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null
    return createClientComponentClient()
  }, [])

  useEffect(() => {
    setMounted(true)
    if (supabase) {
      fetchLists()
    }
  }, [])

  async function fetchLists() {
    if (!supabase) return
    
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLists([])
        return
      }
      
      // Fetch lists with counts, filtering by user_id
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (listsError) {
        console.error('Error loading lists:', listsError)
        setLists([])
        return
      }

      // Fetch counts for each list from list_memberships table
      const listsWithCounts = await Promise.all(
        (listsData || []).map(async (list) => {
          const { count, error: countError } = await supabase
            .from('list_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)

          return {
            ...list,
            type: list.type || 'people',
            count: countError ? 0 : (count || 0)
          }
        })
      )

      setLists(listsWithCounts)
    } catch (err) {
      console.error('Error:', err)
      setLists([])
    } finally {
      setLoading(false)
    }
  }

  const filteredLists = useMemo(() => {
    if (!searchQuery.trim()) return lists
    const query = searchQuery.toLowerCase()
    return lists.filter(list => 
      list.name.toLowerCase().includes(query)
    )
  }, [lists, searchQuery])

  const handleCreateList = (type: 'people' | 'properties') => {
    setListType(type)
    setShowCreateModal(true)
  }

  const handleListCreated = () => {
    fetchLists()
    setShowCreateModal(false)
  }

  if (!mounted || !supabase) {
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

  return (
    <>
      <style jsx>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
      <DashboardLayout>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f4ff 100%)',
          position: 'relative'
        }}>
          {/* Animated background gradient overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(249, 171, 0, 0.06) 0%, transparent 50%)',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {/* Header Section - Apollo Style */}
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
              <h1 style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: '28px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
                letterSpacing: '-0.02em',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 3s ease infinite'
              }}>
                My lists
              </h1>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => handleCreateList('people')}
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
                  <Users size={16} />
                  Create a people list
                </button>

                <button
                  onClick={() => handleCreateList('properties')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    background: '#ffffff',
                    color: '#374151',
                    border: '2px solid rgba(245, 87, 108, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#f5576c'
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 87, 108, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(245, 87, 108, 0.2)'
                    e.currentTarget.style.background = '#ffffff'
                    e.currentTarget.style.color = '#374151'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <Home size={16} />
                  Create a properties list
                </button>
              </div>
            </div>

            {/* Search Bar - Apollo Style (only show when lists exist) */}
            {lists.length > 0 && (
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
                  placeholder="Search for people, companies, sequences, deals and more..."
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
            )}
          </div>

          {/* Content Section */}
          <div style={{
            flex: 1,
            padding: '24px 32px',
            position: 'relative',
            zIndex: 1,
            overflow: 'auto'
          }}>
            {/* Lists Table wrapped in Apollo Container */}
            <ApolloListContainer>
              {loading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '64px',
                  color: '#6b7280',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '14px'
                }}>
                  Loading lists...
                </div>
            ) : (
              <ListsTable 
                lists={filteredLists} 
                onRefresh={fetchLists}
              />
            )}
            </ApolloListContainer>
          </div>

          {/* Create List Modal */}
            {showCreateModal && supabase && (
              <CreateListModal
                type={listType}
                onClose={() => setShowCreateModal(false)}
                onCreated={handleListCreated}
                supabase={supabase}
              />
            )}
        </div>
      </DashboardLayout>
    </>
  )
}
