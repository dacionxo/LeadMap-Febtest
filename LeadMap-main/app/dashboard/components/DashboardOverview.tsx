'use client'

import React from 'react'
import { Settings2, RefreshCw } from 'lucide-react'
import Image from 'next/image'

interface DashboardOverviewProps {
  lastUpdated?: Date | null
  refreshing?: boolean
  error?: string | null
  onRefresh?: () => void
  onCustomize?: () => void
  isEditMode?: boolean
}

export default function DashboardOverview({
  lastUpdated,
  refreshing = false,
  error,
  onRefresh,
  onCustomize,
  isEditMode = false
}: DashboardOverviewProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 w-full">
      <div className="grid grid-cols-12 gap-6 items-center">
        <div className="md:col-span-6 col-span-12">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard Overview
            </h1>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Track your prospects, campaigns, and deals in one place. Customize your dashboard to see what matters most.
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          {error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
        <div className="md:col-span-6 col-span-12 flex items-center justify-end gap-4">
          <div className="hidden md:block flex-1">
            <div className="flex justify-end">
              <Image
                src="/images/backgrounds/track-bg.png"
                alt="banner"
                width={400}
                height={240}
                className="object-contain"
              />
            </div>
          </div>
          {onCustomize && (
            <button
              onClick={onCustomize}
              disabled={isEditMode}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 shrink-0"
            >
              <Settings2 className="w-4 h-4" />
              <span>Customize</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
