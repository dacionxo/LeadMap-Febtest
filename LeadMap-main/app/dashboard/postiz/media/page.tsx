/**
 * Postiz Media Library Page
 * 
 * Media asset management for posts.
 * This will integrate Postiz's native media.component.tsx
 */

'use client'

import { Suspense } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { PostizProvider } from '../providers/PostizProvider'
import { PostizWrapper } from '../components/PostizWrapper'

function PostizMedia() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Media Library</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your images, videos, and other media assets for social media posts
          </p>
        </div>

        {/* Placeholder for Postiz Media component */}
        {/* TODO: Import and integrate Postiz's media/media.component.tsx and new.uploader.tsx */}
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
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Postiz Media Library
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            The Postiz media component will be integrated here. This will display native Postiz UI for
            uploading, managing, and organizing media assets from Supabase Storage, mapped to media_assets table.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MediaPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <PostizWrapper>
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading media library...</p>
                </div>
              </div>
            }
          >
            <PostizMedia />
          </Suspense>
        </PostizWrapper>
      </PostizProvider>
    </DashboardLayout>
  )
}
