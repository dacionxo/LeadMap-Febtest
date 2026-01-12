/**
 * React Hook for Workspace Context (Client-side)
 * 
 * Provides workspace context and utilities for Postiz integration
 */

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export interface Workspace {
  workspace_id: string
  workspace_name: string
  workspace_slug: string | null
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'member'
  joined_at: string
}

export interface WorkspaceContext {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  loading: boolean
  error: string | null
  selectWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
}

export function useWorkspace(): WorkspaceContext {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Create Supabase client with lazy initialization for SSR safety
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserClient> | null>(null)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      setSupabase(client)
    }
  }, [])

  const fetchWorkspaces = async () => {
    if (!supabase) return
    
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setWorkspaces([])
        setCurrentWorkspaceId(null)
        setLoading(false)
        return
      }

      const response = await fetch('/api/postiz/workspaces')
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces')
      }

      const { workspaces: fetchedWorkspaces } = await response.json()
      const workspacesList = fetchedWorkspaces || []
      setWorkspaces(workspacesList)

      // Set current workspace from localStorage or use primary workspace
      if (workspacesList.length > 0) {
        const savedWorkspaceId = localStorage.getItem('postiz_current_workspace_id')
        const savedWorkspace = workspacesList.find((w: Workspace) => w.workspace_id === savedWorkspaceId)
        
        if (savedWorkspace) {
          setCurrentWorkspaceId(savedWorkspace.workspace_id)
        } else {
          // Use primary workspace (owner workspace or first)
          const ownerWorkspace = workspacesList.find((w: Workspace) => w.role === 'owner')
          const primaryWorkspace = ownerWorkspace || workspacesList[0]
          setCurrentWorkspaceId(primaryWorkspace.workspace_id)
          localStorage.setItem('postiz_current_workspace_id', primaryWorkspace.workspace_id)
        }
      } else {
        // No workspaces found - this should be handled by the API route creating one automatically
        // But if it still fails, we'll set to null and let PostizWrapper show the error
        setCurrentWorkspaceId(null)
      }
    } catch (err: any) {
      console.error('Error fetching workspaces:', err)
      setError(err.message || 'Failed to load workspaces')
    } finally {
      setLoading(false)
    }
  }

  const selectWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.workspace_id === workspaceId)
    if (workspace) {
      setCurrentWorkspaceId(workspaceId)
      localStorage.setItem('postiz_current_workspace_id', workspaceId)
    }
  }

  useEffect(() => {
    if (!supabase) return
    
    fetchWorkspaces()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchWorkspaces()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const currentWorkspace = workspaces.find(w => w.workspace_id === currentWorkspaceId) || null

  return {
    workspaces,
    currentWorkspace,
    loading,
    error,
    selectWorkspace,
    refreshWorkspaces: fetchWorkspaces,
  }
}
