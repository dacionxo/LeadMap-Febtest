/**
 * Postiz Analytics Page
 * 
 * Analytics dashboard for social media performance.
 * This will integrate Postiz's native PlatformAnalytics component
 */

'use client'

import { Suspense } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { PostizProvider } from '../providers/PostizProvider'
import { PostizWrapper } from '../components/PostizWrapper'
import PostizAnalyticsAdapter from '../components/PostizAnalyticsAdapter'

function PostizAnalytics() {
  return (
    <div className="space-y-6 h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          View performance metrics and insights for your social media posts
        </p>
      </div>

      {/* Postiz Analytics Adapter - Native Postiz-style UI */}
      <PostizAnalyticsAdapter />
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <PostizWrapper>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading analytics...</p>
                </div>
              </div>
            }
          >
            <PostizAnalytics />
          </Suspense>
        </PostizWrapper>
      </PostizProvider>
    </DashboardLayout>
  )
}
