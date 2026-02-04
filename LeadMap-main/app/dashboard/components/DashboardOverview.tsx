'use client'

import React from 'react'
import { Settings2, RefreshCw } from 'lucide-react'
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
      <Card className='pb-0 mt-[30px] rounded-xl bg-white' style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
        <div className='grid grid-cols-12 gap-6'>
          <div className='md:col-span-6 col-span-12'>
            <div className='flex items-center gap-3 mt-2'>
              <h5 className='text-lg text-black'>
                Dashboard and Reporting
              </h5>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-black"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''} text-black`} />
                </button>
              )}
              {lastUpdated && (
                <p className='text-xs text-black opacity-70'>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
            <p className='text-sm font-medium py-5 text-black opacity-80'>
              Track your prospects, campaigns, and deals in one place. Customize your dashboard to see what matters most.
            </p>
            {error && (
              <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
          <div className='md:col-span-6 col-span-12 flex items-center justify-end gap-2'>
            {onCustomize && !isEditMode && (
              <Button
                variant={'info'}
                onClick={onCustomize}
                className='flex items-center justify-center hover:shadow-lg transition-all duration-200 bg-primary text-white border-primary'
              >
                Customize
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  )
}
