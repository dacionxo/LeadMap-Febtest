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
      <Card className='shadow-[0_0.125rem_0.25rem_rgba(0,0,0,0.075)] pb-0 mt-[30px] rounded-xl' style={{ backgroundColor: '#4F7CFF' }}>
        <div className='grid grid-cols-12 gap-6'>
          <div className='md:col-span-6 col-span-12'>
            <div className='flex items-center gap-3 mt-2'>
              <h5 className='text-lg' style={{ color: '#FFFFFF', textShadow: '0.2px 0.2px 0.2px rgba(0, 0, 0, 0.4)' }}>
                Dashboard Overview
              </h5>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: '#FFFFFF' }}
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: '#FFFFFF' }} />
                </button>
              )}
              {lastUpdated && (
                <p className='text-xs' style={{ color: '#FFFFFF', opacity: 0.9, textShadow: '0.2px 0.2px 0.2px rgba(0, 0, 0, 0.4)' }}>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
            <p className='text-sm font-medium py-5' style={{ color: '#FFFFFF', opacity: 0.9, textShadow: '0.2px 0.2px 0.2px rgba(0, 0, 0, 0.4)' }}>
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
                style={{ backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', color: '#1C2536' }}
                className='flex items-center justify-center'
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
