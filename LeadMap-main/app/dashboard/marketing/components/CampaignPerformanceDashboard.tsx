'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import ROIMetricsCard from './ROIMetricsCard'
import CampaignPerformanceChart from './CampaignPerformanceChart'
import LoadingSkeleton from './LoadingSkeleton'
import ErrorBoundary from './ErrorBoundary'
import DateRangePicker from './DateRangePicker'
import {
  Loader2,
  AlertCircle,
  Mail,
  CheckCircle,
  TrendingUp,
  MousePointerClick,
  MessageSquare,
  DollarSign,
  RefreshCw,
  Calendar,
  Download,
} from 'lucide-react'

interface CampaignPerformanceDashboardProps {
  campaignId: string
  startDate?: string
  endDate?: string
  onDateRangeChange?: (start: string, end: string) => void
}

/**
 * Campaign Performance Dashboard Component
 * Enhanced campaign performance analytics with ROI tracking following Mautic patterns
 */
export default function CampaignPerformanceDashboard({
  campaignId,
  startDate,
  endDate,
  onDateRangeChange,
}: CampaignPerformanceDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<any>(null)
  const [overallStats, setOverallStats] = useState<any>(null)
  const [roiData, setRoiData] = useState<any>(null)
  const [dailyPerformance, setDailyPerformance] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showROI, setShowROI] = useState(true)
  const [chartType, setChartType] = useState<'line' | 'area' | 'composed'>('composed')
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(startDate || '')
  const [localEndDate, setLocalEndDate] = useState(endDate || '')
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (startDate) setLocalStartDate(startDate)
    if (endDate) setLocalEndDate(endDate)
  }, [startDate, endDate])

  useEffect(() => {
    fetchCampaignPerformance()
  }, [campaignId, localStartDate, localEndDate])

  // Set up real-time subscriptions for campaign performance updates
  useEffect(() => {
    if (!realtimeEnabled || !campaignId) return

    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`campaign-performance-realtime-${user.id}-${campaignId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'campaign_reports',
            filter: `campaign_id=eq.${campaignId}`,
          },
          () => {
            // Refresh campaign performance when reports update
            fetchCampaignPerformance()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'email_events',
            filter: `campaign_id=eq.${campaignId}`,
          },
          () => {
            // Refresh when new events occur for this campaign
            fetchCampaignPerformance()
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
  }, [realtimeEnabled, campaignId])

  const fetchCampaignPerformance = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (localStartDate) params.set('startDate', localStartDate)
      if (localEndDate) params.set('endDate', localEndDate)

      const response = await fetch(
        `/api/campaigns/${campaignId}/performance?${params.toString()}`,
        {
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch campaign performance data')
      }

      const data = await response.json()
      setCampaign(data.campaign)
      setOverallStats(data.overallStats)
      setRoiData({
        campaign_cost: data.overallStats?.cost || 0,
        revenue: data.overallStats?.revenue || 0,
        roi_percentage: data.overallStats?.roi || 0,
        cost_per_conversion: data.overallStats?.conversions > 0 
          ? (data.overallStats?.cost || 0) / data.overallStats?.conversions 
          : 0,
        revenue_per_email: data.overallStats?.emails_delivered > 0
          ? (data.overallStats?.revenue || 0) / data.overallStats?.emails_delivered
          : 0,
        conversions: data.overallStats?.conversions || 0,
        conversion_rate: data.overallStats?.conversion_rate || 0,
      })
      setDailyPerformance(data.dailyReports || [])
    } catch (err: any) {
      console.error('Error fetching campaign performance:', err)
      setError(err.message || 'Failed to load campaign performance data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCampaignPerformance()
    setRefreshing(false)
  }

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export campaign performance data')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="metric" count={6} />
        <LoadingSkeleton type="chart" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Campaign Performance</h3>
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

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {campaign?.name || 'Campaign Performance'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive campaign analytics with ROI tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Export campaign data"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
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
            aria-label="Refresh campaign data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <DateRangePicker
          startDate={localStartDate}
          endDate={localEndDate}
          onStartDateChange={(date) => {
            setLocalStartDate(date)
            if (onDateRangeChange) {
              onDateRangeChange(date, localEndDate)
            }
          }}
          onEndDateChange={(date) => {
            setLocalEndDate(date)
            if (onDateRangeChange) {
              onDateRangeChange(localStartDate, date)
            }
          }}
          maxDate={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* ROI Metrics Card */}
      {roiData && (
        <div>
          <ROIMetricsCard roiData={roiData} />
        </div>
      )}

      {/* Overall Stats Grid */}
      {overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Sent</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {overallStats.emails_sent?.toLocaleString() || 0}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Delivered</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {overallStats.emails_delivered?.toLocaleString() || 0}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Opened</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {overallStats.emails_opened?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {overallStats.open_rate?.toFixed(1) || 0}% rate
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MousePointerClick className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Clicked</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {overallStats.emails_clicked?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {overallStats.click_rate?.toFixed(1) || 0}% rate
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Replied</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {overallStats.emails_replied?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {overallStats.reply_rate?.toFixed(1) || 0}% rate
            </div>
          </div>

          {roiData && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Revenue</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${roiData.revenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance Chart */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Performance Trends
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={showROI}
                onChange={(e) => setShowROI(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show ROI
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="composed">Composed</option>
              <option value="area">Area</option>
              <option value="line">Line</option>
            </select>
          </div>
        </div>
        <CampaignPerformanceChart
          dailyPerformance={dailyPerformance}
          showROI={showROI}
          chartType={chartType}
        />
      </div>
      </div>
    </ErrorBoundary>
  )
}

