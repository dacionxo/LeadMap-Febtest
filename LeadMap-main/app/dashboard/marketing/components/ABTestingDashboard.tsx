'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import VariantPerformanceCard from './VariantPerformanceCard'
import VariantComparisonChart from './VariantComparisonChart'
import LoadingSkeleton from './LoadingSkeleton'
import ErrorBoundary from './ErrorBoundary'
import { Loader2, AlertCircle, Trophy, BarChart3, Settings, RefreshCw } from 'lucide-react'

interface Variant {
  id: string
  variant_name: string
  variant_type: string
  status: string
  is_winner: boolean
  winner_criteria?: string
  minimum_sample_size?: number
  confidence_level?: number
  performance: {
    sent_count: number
    delivered_count: number
    opened_count: number
    clicked_count: number
    replied_count: number
    open_rate: number
    click_rate: number
    reply_rate: number
  }
}

interface ABTestingDashboardProps {
  parentEmailId: string
  onVariantSelect?: (variantId: string) => void
  showDetails?: boolean
}

/**
 * A/B Testing Dashboard Component
 * Comprehensive A/B test variant performance visualization following Mautic patterns
 */
export default function ABTestingDashboard({
  parentEmailId,
  onVariantSelect,
  showDetails = true,
}: ABTestingDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [variants, setVariants] = useState<Variant[]>([])
  const [parentEmail, setParentEmail] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<('open_rate' | 'click_rate' | 'reply_rate')[]>([
    'open_rate',
    'click_rate',
    'reply_rate',
  ])
  const [refreshing, setRefreshing] = useState(false)
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchVariantData()
  }, [parentEmailId])

  // Set up real-time subscriptions for variant performance updates
  useEffect(() => {
    if (!realtimeEnabled || !parentEmailId) return

    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`variant-performance-realtime-${user.id}-${parentEmailId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_variant_performance',
            filter: `variant_id=in.(SELECT id FROM email_variants WHERE parent_email_id=eq.${parentEmailId})`,
          },
          () => {
            // Refresh variant data when performance updates
            fetchVariantData()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_events',
            filter: `email_id=in.(SELECT variant_email_id FROM email_variants WHERE parent_email_id=eq.${parentEmailId})`,
          },
          () => {
            // Refresh when new events occur for variants
            fetchVariantData()
          }
        )
        .subscribe()

      return () => {
        if (channel) {
          supabase.removeChannel(channel)
        }
      }
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [realtimeEnabled, parentEmailId])

  const fetchVariantData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/email/analytics/variants?parentEmailId=${parentEmailId}`,
        {
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch variant data')
      }

      const data = await response.json()
      setVariants(data.variants || [])
      setParentEmail(data.parentEmailId)
    } catch (err: any) {
      console.error('Error fetching variant data:', err)
      setError(err.message || 'Failed to load A/B test data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchVariantData()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading A/B Test Data</h3>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  if (variants.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No A/B Test Variants Found
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create variants for this email to start A/B testing.
        </p>
      </div>
    )
  }

  const winner = variants.find((v) => v.is_winner)
  const runningVariants = variants.filter((v) => v.status === 'running')
  const completedVariants = variants.filter((v) => v.status === 'completed')

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            A/B Test Performance
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Compare variant performance and identify winners
          </p>
        </div>
        <button
          onClick={() => setRealtimeEnabled(!realtimeEnabled)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            realtimeEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-label={realtimeEnabled ? 'Disable real-time updates' : 'Enable real-time updates'}
        >
          {realtimeEnabled ? '● Live' : '○ Paused'}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
          aria-label="Refresh variant data"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Test Configuration */}
      {showDetails && variants.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-200">Test Configuration</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700 dark:text-blue-300 font-medium">Winner Criteria:</span>
              <span className="ml-2 text-blue-900 dark:text-blue-100 capitalize">
                {variants[0]?.winner_criteria?.replace('_', ' ') || 'Open Rate'}
              </span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300 font-medium">Min Sample Size:</span>
              <span className="ml-2 text-blue-900 dark:text-blue-100">
                {variants[0]?.minimum_sample_size || 100}
              </span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300 font-medium">Confidence Level:</span>
              <span className="ml-2 text-blue-900 dark:text-blue-100">
                {variants[0]?.confidence_level || 95}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Winner Announcement */}
      {winner && (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 rounded-full p-3">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-200">
                Winner: Variant {winner.variant_name}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                This variant performed best based on {winner.winner_criteria?.replace('_', ' ') || 'selected criteria'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Chart */}
      {variants.length > 1 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Performance Comparison
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Metrics:</label>
              <div className="flex gap-2">
                {(['open_rate', 'click_rate', 'reply_rate'] as const).map((metric) => (
                  <label key={metric} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMetrics([...selectedMetrics, metric])
                        } else {
                          setSelectedMetrics(selectedMetrics.filter((m) => m !== metric))
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 capitalize">
                      {metric.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <VariantComparisonChart variants={variants} metrics={selectedMetrics} />
        </div>
      )}

      {/* Variant Cards */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Variant Details
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {runningVariants.length > 0 && (
              <span className="mr-4">
                {runningVariants.length} Running
              </span>
            )}
            {completedVariants.length > 0 && (
              <span>{completedVariants.length} Completed</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {variants.map((variant) => (
            <VariantPerformanceCard
              key={variant.id}
              variant={variant}
              minimumSampleSize={variant.minimum_sample_size}
              onSelect={onVariantSelect ? () => onVariantSelect(variant.id) : undefined}
            />
          ))}
        </div>
      </div>
      </div>
    </ErrorBoundary>
  )
}

