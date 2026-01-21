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
  return (
    <>
      <Card className='bg-lightprimary dark:bg-lightprimary shadow-none pb-0 mt-[30px] rounded-lg'>
        <div className='grid grid-cols-12 gap-6'>
          <div className='md:col-span-6 col-span-12'>
            <h5 className='text-lg mt-2'>
              Dashboard Overview
            </h5>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="ml-2 p-1 text-ld hover:text-primary hover:bg-lightprimary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed align-middle"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <p className='text-ld opacity-75 text-sm font-medium py-5'>
              Track your prospects, campaigns, and deals in one place. Customize your dashboard to see what matters most.
            </p>
            {lastUpdated && (
              <p className='text-xs text-ld opacity-60 mb-2'>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
            {error && (
              <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {onCustomize && !isEditMode && (
              <Button variant={'info'}>Customize</Button>
            )}
          </div>
          <div className='md:col-span-6 col-span-12'>
            <Image
              src='/images/backgrounds/track-bg.png'
              alt='banner'
              width={400}
              height={240}
              className='ms-auto'
            />
          </div>
        </div>
      </Card>
    </>
  )
}
