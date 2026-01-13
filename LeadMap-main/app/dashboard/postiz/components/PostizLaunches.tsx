/**
 * Postiz Launches Component
 * 
 * This component will integrate Postiz's native launches.component.tsx
 * Displays scheduled posts, calendars, timelines, and post management UI.
 * 
 * Phase 5: UI Embedding - Preserves Postiz's native UX patterns
 */

'use client'

import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { PostizContext } from '../providers/PostizProvider'

export function PostizLaunches() {
  const context = useContext(PostizContext)
  const router = useRouter()
  
  if (!context) {
    throw new Error('PostizLaunches must be used within PostizProvider')
  }
  
  const { workspace, features, loading } = context

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading launches...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Postiz Native UI - Launches Dashboard */}
      {/* TODO: Import and integrate Postiz's launches.component.tsx from postiz-app/apps/frontend/src/components/launches/launches.component.tsx */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Launches</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Schedule and manage your social media posts with Postiz
            </p>
          </div>
          {features.canSchedule && (
            <button
              onClick={() => router.push('/dashboard/postiz/launches/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Post
            </button>
          )}
        </div>

        {/* Placeholder for Postiz Launches Component */}
        {/* This will be replaced with Postiz's native launches.component.tsx */}
        <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Postiz Launches Dashboard
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">
            The Postiz launches component will be integrated here. This will display the native Postiz UI for
            managing scheduled posts, calendars, timelines, and content creation.
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
            <span>Workspace: {workspace?.workspace_name || 'None'}</span>
            <span>•</span>
            <span>Plan: {workspace?.role || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats - These will be replaced with Postiz's native components */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Scheduled Posts</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">-</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">From queue_jobs</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Connected Accounts</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">-</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">From social_accounts</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Posts This Month</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">-</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">From analytics_events</div>
        </div>
      </div>

      {/* Feature Flags Display (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Feature Flags</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${features.canSchedule ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-gray-600 dark:text-gray-400">Schedule</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${features.canUseEvergreen ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-gray-600 dark:text-gray-400">Evergreen</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${features.canUseRSS ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-gray-600 dark:text-gray-400">RSS</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${features.canUseAI ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-gray-600 dark:text-gray-400">AI</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
