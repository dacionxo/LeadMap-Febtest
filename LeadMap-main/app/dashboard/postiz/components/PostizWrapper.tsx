/**
 * Postiz UI Wrapper Component
 * 
 * This component bridges Postiz's native UI with LeadMap's DashboardLayout.
 * It preserves Postiz's UX patterns while integrating with LeadMap's navigation and theming.
 * 
 * Phase 5: UI Embedding - Mounts Postiz components inside DashboardLayout shell
 */

'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'

interface PostizWrapperProps {
  children: ReactNode
  workspaceId?: string
}

export function PostizWrapper({ children, workspaceId }: PostizWrapperProps) {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || workspaceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading Postiz...</p>
        </div>
      </div>
    )
  }

  if (!currentWorkspace) {
    return (
      <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-6">
        <div className="flex items-start space-x-3">
          <svg
            className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
              Workspace Required
            </h3>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              You need to be a member of a workspace to use Postiz. Please create or join a workspace first.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render Postiz UI inside a container that preserves Postiz's native styling
  // The container adapts to LeadMap's theme while allowing Postiz components to maintain their UX patterns
  return (
    <div className="postiz-container h-full w-full">
      {/* Postiz UI preserves its native patterns - calendars, timelines, editors */}
      <div className="postiz-content-wrapper">
        {children}
      </div>
    </div>
  )
}
