'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

interface OwnerSelectorProps {
  supabase: SupabaseClient
  value: string | null
  onChange: (ownerId: string | null) => void
}

interface User {
  id: string
  name?: string | null
  email?: string | null
  avatar_url?: string | null
}

export default function OwnerSelector({ supabase, value, onChange }: OwnerSelectorProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  // Set default to current user if no value is provided
  useEffect(() => {
    if (!value && currentUserId && !loading) {
      onChange(currentUserId)
    }
  }, [value, currentUserId, loading, onChange])

  async function loadUsers() {
    try {
      setLoading(true)
      
      // Get current logged-in user first
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('Error getting current user:', authError)
        setUsers([])
        setLoading(false)
        return
      }

      // Store user in a const to ensure TypeScript knows it's defined
      const currentUser = user

      // Set current user ID
      setCurrentUserId(currentUser.id)

      // Try to get users from users table
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error loading users:', error)
        // Fallback: use current user from auth
        const currentUserData: User = {
          id: currentUser.id,
          name: currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
          email: currentUser.email || '',
          avatar_url: currentUser.user_metadata?.avatar_url || null
        }
        setUsers([currentUserData])
      } else {
        // Ensure current user is in the list
        const currentUserInList = data?.find(u => u.id === currentUser.id)
        if (!currentUserInList && data) {
          // Add current user if not in list
          const currentUserData: User = {
            id: currentUser.id,
            name: currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
            email: currentUser.email || '',
            avatar_url: currentUser.user_metadata?.avatar_url || null
          }
          setUsers([currentUserData, ...data])
        } else {
          setUsers(data || [])
        }
      }
    } catch (err) {
      console.error('Error:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = users.find(u => u.id === value)

  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          color: '#374151',
          background: loading ? '#f9fafb' : '#ffffff',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#9ca3af'
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#d1d5db'
          }
        }}
      >
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email || `User ${user.id.slice(0, 8)}`}
          </option>
        ))}
      </select>
      {selectedUser && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: '#6b7280'
          }}
        >
          <User size={14} />
          <span>{selectedUser.name || selectedUser.email}</span>
        </div>
      )}
    </div>
  )
}


