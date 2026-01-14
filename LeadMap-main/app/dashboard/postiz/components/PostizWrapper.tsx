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
import { usePostiz } from '../providers/PostizProvider'
import { useApp } from '@/app/providers'

interface PostizWrapperProps {
  children: ReactNode
  workspaceId?: string
}

export function PostizWrapper({ children, workspaceId }: PostizWrapperProps) {
  // Use PostizProvider context instead of useWorkspace directly
  // This ensures consistent workspace state across all Postiz components
  const { workspace, loading: workspaceLoading, refreshWorkspace } = usePostiz()
  const { user } = useApp()
  const [mounted, setMounted] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-refresh workspace if user exists but no workspace found
  // Only retry if we're not already retrying and haven't exceeded retry limit
  useEffect(() => {
    if (!mounted || workspaceLoading || workspace || !user || isRetrying) {
      return
    }

    // If no workspace and user exists, try refreshing (API auto-creates)
    if (retryCount < 3) {
      setIsRetrying(true)
      const timer = setTimeout(async () => {
        try {
          await refreshWorkspace()
        } catch (error) {
          console.error('[PostizWrapper] Error refreshing workspace:', error)
        } finally {
          setIsRetrying(false)
          setRetryCount(prev => prev + 1)
        }
      }, retryCount === 0 ? 500 : 1000 * retryCount) // Progressive delay
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, workspaceLoading, workspace, user?.id, retryCount, isRetrying])

  // Show loading state while mounting, loading workspace, or retrying
  if (!mounted || workspaceLoading || isRetrying) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isRetrying ? 'Setting up workspace...' : 'Loading Postiz...'}
          </p>
        </div>
      </div>
    )
  }

  if (!workspace) {
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
              You need to be a member of a workspace to use Postiz. Please refresh the page if a workspace should have been created automatically.
            </p>
            <button
              onClick={async () => {
                setRetryCount(0)
                setIsRetrying(true)
                try {
                  await refreshWorkspace()
                } catch (error) {
                  console.error('[PostizWrapper] Error retrying workspace setup:', error)
                } finally {
                  setIsRetrying(false)
                }
              }}
              disabled={isRetrying}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              {isRetrying ? 'Setting up...' : 'Retry Workspace Setup'}
            </button>
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
