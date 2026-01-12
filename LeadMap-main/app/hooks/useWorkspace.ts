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

  const fetchWorkspaces = async () => {
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
      const response = await fetch('/api/postiz/workspaces')
      if (!response.ok) {
        // If unauthorized, user session might have expired
        if (response.status === 401) {
          setWorkspaces([])
          setCurrentWorkspaceId(null)
          setLoading(false)
          return
        }
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
