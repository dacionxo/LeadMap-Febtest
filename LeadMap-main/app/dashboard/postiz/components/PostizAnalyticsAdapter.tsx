/**
 * Postiz Analytics Adapter
 * 
 * Adapter component that bridges LeadMap's API structure with Postiz's
 * PlatformAnalytics component structure. This provides a compatible interface
 * for Postiz-style analytics UI.
 * 
 * Phase 6: Analytics & Insights - UI Integration
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import AnalyticsChart from './AnalyticsChart'
import { usePostiz } from '../providers/PostizProvider'

interface Integration {
  id: string
  name: string
  identifier: string
  picture: string | null
  disabled: boolean
  refreshNeeded?: boolean
  inBetweenSteps?: boolean
  internalId: string
  type: string
}

interface AnalyticsMetric {
  label: string
  data: Array<{ total: number; date: string }>
  average?: boolean
}

const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
]

const dateOptions = [
  { key: 7, value: '7 Days' },
  { key: 30, value: '30 Days' },
  { key: 90, value: '90 Days' },
]

export default function PostizAnalyticsAdapter() {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [dateRange, setDateRange] = useState(7)
  const [refresh, setRefresh] = useState(false)

  // Fetch integrations list
  const fetchIntegrations = useCallback(async () => {
    const response = await fetch('/api/postiz/integrations/list')
    const data = await response.json()
    return (data.integrations || []).filter((f: Integration) =>
      allowedIntegrations.includes(f.identifier)
    )
  }, [])

  const { data: integrations = [], isLoading: integrationsLoading } = useSWR(
    'analytics-list',
    fetchIntegrations,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  )

  const currentIntegration = useMemo(() => {
    return integrations[current] || null
  }, [integrations, current])

  // Get available date options for current integration
  const availableDateOptions = useMemo(() => {
    if (!currentIntegration) return []
    return dateOptions.filter((opt) => {
      // All supported providers can show 7 and 30 days
      if ([7, 30].includes(opt.key)) return true
      // Only certain providers support 90 days
      if (opt.key === 90) {
        return ['facebook', 'linkedin-page', 'pinterest', 'youtube', 'x', 'gmb'].includes(
          currentIntegration.identifier
        )
      }
      return false
    })
  }, [currentIntegration])

  // Fetch analytics data for current integration
  const fetchAnalytics = useCallback(async () => {
    if (!currentIntegration) return null
    const response = await fetch(`/api/postiz/analytics/${currentIntegration.id}?date=${dateRange}`)
    if (!response.ok) return []
    return await response.json()
  }, [currentIntegration, dateRange])

  const { data: analytics, isLoading: analyticsLoading } = useSWR(
    currentIntegration
      ? `analytics-${currentIntegration.id}-${dateRange}`
      : null,
    fetchAnalytics,
    {
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      revalidateIfStale: false,
      refreshInterval: 0,
    }
  )

  if (integrationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics...</p>
      </div>
    )
  }

  if (!integrations || integrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="mb-4">
          <svg
            className="w-24 h-24 text-gray-400 dark:text-gray-500 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Can't show analytics yet
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You have to add Social Media channels
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          Supported:{' '}
          {allowedIntegrations.map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')}
        </p>
        <button
          onClick={() => router.push('/dashboard/postiz/launches')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to the calendar to add channels
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Sidebar - Integration List */}
      <div className="w-full lg:w-64 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Channels</h3>
        <div className="space-y-2">
          {integrations.map((integration: Integration, index: number) => (
            <button
              key={integration.id}
              onClick={() => {
                setCurrent(index)
                setRefresh(true)
                setTimeout(() => setRefresh(false), 10)
              }}
              className={clsx(
                'w-full flex items-center gap-3 p-2 rounded-lg transition-colors',
                current === index
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 opacity-60 hover:opacity-100'
              )}
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {integration.picture ? (
                    <Image
                      src={integration.picture}
                      alt={integration.name}
                      width={36}
                      height={36}
                      className="rounded-lg"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                      {integration.identifier.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={clsx(
                  'text-sm font-medium truncate flex-1 text-left',
                  integration.disabled && 'opacity-50',
                  current === index
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                )}
              >
                {integration.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Analytics Charts */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        {availableDateOptions.length > 0 && (
          <div className="mb-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {availableDateOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.value}
                </option>
              ))}
            </select>
          </div>
        )}

        {analyticsLoading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics data...</p>
          </div>
        )}

        {!analyticsLoading && (!analytics || analytics.length === 0) && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              This channel needs to be refreshed.
            </p>
            <button
              onClick={() => router.push(`/dashboard/postiz/integrations/${currentIntegration?.identifier}`)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Click here to refresh
            </button>
          </div>
        )}

        {!analyticsLoading && analytics && analytics.length > 0 && !refresh && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.map((metric: AnalyticsMetric, index: number) => {
              const total = useMemo(() => {
                const value =
                  metric.data.reduce((sum, d) => sum + d.total, 0) /
                  (metric.average ? metric.data.length : 1)
                return metric.average ? `${value.toFixed(2)}%` : value.toLocaleString()
              }, [metric])

              return (
                <div
                  key={`metric-${index}`}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">
                      {metric.label}
                    </div>
                  </div>
                  <div className="flex-1 min-h-[156px] relative">
                    <AnalyticsChart data={metric.data} label={metric.label} />
                  </div>
                  <div className="text-5xl leading-tight font-bold text-gray-900 dark:text-white">
                    {total}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
