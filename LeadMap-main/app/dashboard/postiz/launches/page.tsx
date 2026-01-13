/**
 * Postiz Launches Page
 * 
 * Main page for managing scheduled posts and launches.
 * This will integrate Postiz's native launches.component.tsx
 */

'use client'

import { Suspense } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { PostizProvider } from '../providers/PostizProvider'
import PostizLaunchesEnhanced from '../components/PostizLaunchesEnhanced'

export default function LaunchesPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading launches...</p>
              </div>
            </div>
          }
        >
          <PostizLaunchesEnhanced />
        </Suspense>
      </PostizProvider>
    </DashboardLayout>
  )
}
