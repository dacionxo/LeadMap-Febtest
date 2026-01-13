/**
 * Postiz Integration Entry Point
 * 
 * Phase 5: UI Embedding - Main page for Postiz social media planner
 * This page mounts Postiz's native UI components inside LeadMap's DashboardLayout.
 * 
 * Routes:
 * - /dashboard/postiz - Main dashboard (launches/posts overview)
 * - /dashboard/postiz/launches - Post scheduling and management (default)
 * - /dashboard/postiz/analytics - Analytics dashboard
 * - /dashboard/postiz/media - Media library
 * - /dashboard/postiz/settings - Postiz settings
 */

'use client'

import { Suspense } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { PostizProvider } from './providers/PostizProvider'
import { PostizWrapper } from './components/PostizWrapper'
import { PostizLaunches } from './components/PostizLaunches'

export default function PostizPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <PostizWrapper>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading Postiz...</p>
                </div>
              </div>
            }
          >
            <PostizLaunches />
          </Suspense>
        </PostizWrapper>
      </PostizProvider>
    </DashboardLayout>
  )
}
