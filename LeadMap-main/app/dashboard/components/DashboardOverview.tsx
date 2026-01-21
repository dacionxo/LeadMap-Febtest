'use client'

import React from 'react'
import { Settings2, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import { Card } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'

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
  // Using TailwindAdmin's exact download banner design structure
  // bg-lightprimary equivalent: using blue-50/indigo-50 gradient for lightprimary feel
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 shadow-none pb-0 w-full border-0">
      <div className="grid grid-cols-12 gap-6">
        <div className="md:col-span-6 col-span-12">
          <div className="flex items-center space-x-3 mb-2">
            <h5 className="text-lg mt-2 font-semibold text-gray-900 dark:text-white">
              Dashboard Overview
            </h5>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-sm font-medium py-5 text-gray-600 dark:text-gray-400 opacity-75">
            Track your prospects, campaigns, and deals in one place. Customize your dashboard to see what matters most.
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          {error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {onCustomize && !isEditMode && (
            <Button 
              variant="default"
              onClick={onCustomize}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Customize
            </Button>
          )}
        </div>
        <div className="md:col-span-6 col-span-12">
          <Image
            src="/images/backgrounds/track-bg.png"
            alt="banner"
            width={400}
            height={240}
            className="ms-auto hidden md:block"
          />
        </div>
      </div>
    </Card>
  )
}
