/**
 * React Hook for Workspace Context (Client-side)
 * 
 * Provides workspace context and utilities for Postiz integration
 */

'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/app/providers'

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
  const { supabase, user } = useApp()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkspaces = async (retryCount = 0): Promise<void> => {
    // Use the user from useApp context (same user ID as LeadMap)
    if (!user) {
      setWorkspaces([])
      setCurrentWorkspaceId(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch workspaces using the same user ID that LeadMap uses
      const response = await fetch('/api/postiz/workspaces', {
        cache: 'no-store', // Ensure fresh data
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        // If unauthorized, user session might have expired
        if (response.status === 401) {
          setWorkspaces([])
          setCurrentWorkspaceId(null)
          setLoading(false)
          return
        }
        
        // If server error and we haven't retried, try once more
        if (response.status >= 500 && retryCount < 1) {
          console.warn(`[useWorkspace] Server error ${response.status}, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          return fetchWorkspaces(retryCount + 1)
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || `Failed to fetch workspaces: ${response.status}`)
      }

      const data = await response.json()
      const { workspaces: fetchedWorkspaces, error: apiError } = data
      
      if (apiError) {
        console.error('[useWorkspace] API returned error:', apiError)
        setError(apiError)
      }
      
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
        // No workspaces found - API should have auto-created one
        // If still empty after retry, show error
        if (retryCount < 1) {
          console.warn('[useWorkspace] No workspaces found, retrying after delay...')
          await new Promise(resolve => setTimeout(resolve, 1500))
          return fetchWorkspaces(retryCount + 1)
        }
        
        console.error('[useWorkspace] No workspaces found after retry. User may need to create workspace manually.')
        setCurrentWorkspaceId(null)
        setError('No workspace found. Please contact support if this persists.')
      }
    } catch (err: any) {
      console.error('[useWorkspace] Error fetching workspaces:', err)
      setError(err.message || 'Failed to load workspaces')
      
      // Retry once on network errors
      if (retryCount < 1 && (err.message?.includes('fetch') || err.message?.includes('network'))) {
        console.warn('[useWorkspace] Network error, retrying...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchWorkspaces(retryCount + 1)
      }
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
    // Only fetch workspaces when user is available (from useApp context)
    // Uses the same user.id from Supabase auth that LeadMap uses throughout
    if (!user) {
      setWorkspaces([])
      setCurrentWorkspaceId(null)
      setLoading(false)
      return
    }

    fetchWorkspaces()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Only depend on user.id to avoid unnecessary re-fetches

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
