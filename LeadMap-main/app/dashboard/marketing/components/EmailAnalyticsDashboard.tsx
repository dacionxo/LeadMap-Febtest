'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import DeviceAnalytics from './DeviceAnalytics'
import HealthMonitoring from './HealthMonitoring'
import EngagementHeatmap from './EngagementHeatmap'
import LocationAnalytics from './LocationAnalytics'
import ABTestingDashboard from './ABTestingDashboard'
import CampaignPerformanceDashboard from './CampaignPerformanceDashboard'
import TemplatePerformanceDashboard from './TemplatePerformanceDashboard'
import ComparativeAnalyticsDashboard from './ComparativeAnalyticsDashboard'
import CampaignSelector from './CampaignSelector'
import EmailSelector from './EmailSelector'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface TimeSeriesData {
  date: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  complaint: number
  failed: number
}

interface EmailStats {
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  spamComplaints: number
  openRate: number
  clickRate: number
  replyRate: number
  bounceRate: number
  perMailbox?: Array<{
    mailboxId: string
    mailboxEmail: string
    mailboxName: string
    delivered: number
    opened: number
    clicked: number
    bounced: number
    openRate: number
    clickRate: number
    bounceRate: number
  }>
}

/**
 * Email Analytics Dashboard Component
 * Comprehensive email performance tracking and visualization
 */
export default function EmailAnalyticsDashboard() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [timeseries, setTimeseries] = useState<TimeSeriesData[]>([])
  const [selectedMailbox, setSelectedMailbox] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [mailboxes, setMailboxes] = useState<Array<{ id: string; email: string; display_name?: string }>>([])
  const [health, setHealth] = useState<any>(null)
  const [optimalSendTime, setOptimalSendTime] = useState<any>(null)
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const [activeView, setActiveView] = useState<'overview' | 'ab-testing' | 'campaign-performance' | 'template-performance' | 'comparative'>('overview')
  const [selectedParentEmailId, setSelectedParentEmailId] = useState<string | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // Check for URL parameters to set initial view and IDs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const campaignId = urlParams.get('campaignId')
      const emailId = urlParams.get('emailId')
      const view = urlParams.get('view') as 'overview' | 'ab-testing' | 'campaign-performance' | 'template-performance' | 'comparative' | null

      // Set view first, then IDs (view takes priority)
      if (view && ['overview', 'ab-testing', 'campaign-performance', 'template-performance', 'comparative'].includes(view)) {
        setActiveView(view as any)
      }

      // Set IDs based on parameters
      if (campaignId) {
        setSelectedCampaignId(campaignId)
        if (!view) {
          setActiveView('campaign-performance')
        }
      }
      if (emailId) {
        setSelectedParentEmailId(emailId)
        if (!view) {
          setActiveView('ab-testing')
        }
      }
    }
  }, [])

  useEffect(() => {
    fetchMailboxes()
    fetchStats()
    fetchTimeseries()
    fetchHealth()
    fetchOptimalSendTime()
  }, [selectedMailbox, selectedPeriod])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!realtimeEnabled) return

    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`email-events-realtime-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'email_events',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            // Refresh stats when new events arrive
            fetchStats()
            fetchTimeseries()
            fetchHealth()
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [realtimeEnabled, selectedMailbox, selectedPeriod])

  const fetchMailboxes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('mailboxes')
        .select('id, email, display_name')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMailboxes(data || [])
    } catch (error) {
      console.error('Error fetching mailboxes:', error)
    }
  }

  const fetchStats = async () => {
    try {
      setLoading(true)
      const startDate = getStartDate(selectedPeriod)
      const params = new URLSearchParams({
        mailboxId: selectedMailbox,
        ...(startDate && { startDate })
      })

      const response = await fetch(`/api/emails/stats?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTimeseries = async () => {
    try {
      const startDate = getStartDate(selectedPeriod)
      const params = new URLSearchParams({
        mailboxId: selectedMailbox,
        groupBy: 'day',
        ...(startDate && { startDate })
      })

      const response = await fetch(`/api/email/analytics/timeseries?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setTimeseries(data.timeseries || [])
      }
    } catch (error) {
      console.error('Error fetching timeseries:', error)
    }
  }

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/email/health?hours=24', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setHealth(data.health)
      }
    } catch (error) {
      console.error('Error fetching health:', error)
    }
  }

  const fetchOptimalSendTime = async () => {
    try {
      const startDate = getStartDate(selectedPeriod)
      const params = new URLSearchParams({
        days: selectedPeriod === '7d' ? '7' : selectedPeriod === '30d' ? '30' : selectedPeriod === '90d' ? '90' : '90',
        ...(selectedMailbox !== 'all' && { recipientEmail: selectedMailbox })
      })

      const response = await fetch(`/api/email/analytics/optimal-send-time?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setOptimalSendTime(data)
      }
    } catch (error) {
      console.error('Error fetching optimal send time:', error)
    }
  }

  const getStartDate = (period: string): string | null => {
    const now = new Date()
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return null
    }
  }

  const handleExport = async (type: 'events' | 'timeseries' | 'recipients') => {
    try {
      const startDate = getStartDate(selectedPeriod)
      const params = new URLSearchParams({
        format: 'csv',
        type,
        mailboxId: selectedMailbox,
        ...(startDate && { startDate })
      })

      const response = await fetch(`/api/email/analytics/export?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `email-analytics-${type}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Failed to export data')
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No email data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track email performance, engagement, and deliverability
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMailbox}
            onChange={(e) => setSelectedMailbox(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="all">All Mailboxes</option>
            {mailboxes.map((mb) => (
              <option key={mb.id} value={mb.id}>
                {mb.display_name || mb.email}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={() => setRealtimeEnabled(!realtimeEnabled)}
            className={`px-4 py-2 rounded-md text-sm ${
              realtimeEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {realtimeEnabled ? '● Live' : '○ Paused'}
          </button>
          <button
            onClick={() => handleExport('events')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'ab-testing', label: 'A/B Testing', icon: '🧪' },
            { id: 'campaign-performance', label: 'Campaign Performance', icon: '📈' },
            { id: 'template-performance', label: 'Template Performance', icon: '📧' },
            { id: 'comparative', label: 'Comparative Analytics', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeView === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
              aria-label={`Switch to ${tab.label} view`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* A/B Testing View */}
      {activeView === 'ab-testing' && (
        <div className="space-y-6">
          {/* Email Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Email with A/B Test Variants
            </label>
            <EmailSelector
              selectedEmailId={selectedParentEmailId}
              onEmailSelect={setSelectedParentEmailId}
              filterWithVariants={true}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Only emails with A/B test variants will appear here
            </p>
          </div>

          {selectedParentEmailId ? (
            <ABTestingDashboard
              parentEmailId={selectedParentEmailId}
              onVariantSelect={(variantId) => {
                console.log('Selected variant:', variantId)
              }}
            />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select an email with A/B test variants to view performance
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                A/B testing data will appear here when you have variants configured
              </p>
            </div>
          )}
        </div>
      )}

      {/* Campaign Performance View */}
      {activeView === 'campaign-performance' && (
        <div className="space-y-6">
          {/* Campaign Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Campaign
            </label>
            <CampaignSelector
              selectedCampaignId={selectedCampaignId}
              onCampaignSelect={setSelectedCampaignId}
            />
          </div>

          {selectedCampaignId ? (
            <CampaignPerformanceDashboard
              campaignId={selectedCampaignId}
              startDate={getStartDate(selectedPeriod) || undefined}
              endDate={new Date().toISOString()}
            />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select a campaign to view performance analytics
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Campaign performance data will appear here when you select a campaign
              </p>
            </div>
          )}
        </div>
      )}

      {/* Template Performance View */}
      {activeView === 'template-performance' && (
        <TemplatePerformanceDashboard
          startDate={getStartDate(selectedPeriod) || undefined}
          endDate={new Date().toISOString()}
          showAll={true}
        />
      )}

      {/* Comparative Analytics View */}
      {activeView === 'comparative' && (
        <ComparativeAnalyticsDashboard
          defaultMetric="open_rate"
        />
      )}

      {/* Overview View (Default) */}
      {activeView === 'overview' && (
        <>
          {/* Health Widget */}
      {health && (
        <div className={`border rounded-lg p-4 ${
          health.isHealthy 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Email Health</h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              health.isHealthy 
                ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' 
                : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
            }`}>
              {health.isHealthy ? 'Healthy' : 'Needs Attention'}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Last 24h Failures</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {health.last24hFailures}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Bounce Rate</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {health.bounceRate}%
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Complaint Rate</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {health.complaintRate}%
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Emails Sent</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {health.sentCount}
              </div>
            </div>
          </div>
          {health.topFailureReasons && health.topFailureReasons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top Failure Reasons:
              </div>
              <div className="space-y-1">
                {health.topFailureReasons.slice(0, 3).map((reason: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                    <span className="truncate flex-1">{reason.message}</span>
                    <span className="ml-2 font-medium">{reason.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Delivered"
          value={(stats.delivered || 0).toLocaleString()}
          subtitle={`${stats.delivered > 0 ? ((stats.delivered / (stats.delivered + (stats.bounced || 0))) * 100).toFixed(1) : 0}% delivery rate`}
          color="blue"
        />
        <MetricCard
          title="Open Rate"
          value={`${(stats.openRate || 0).toFixed(1)}%`}
          subtitle={`${(stats.opened || 0).toLocaleString()} opens`}
          color="green"
        />
        <MetricCard
          title="Click Rate"
          value={`${(stats.clickRate || 0).toFixed(1)}%`}
          subtitle={`${(stats.clicked || 0).toLocaleString()} clicks`}
          color="purple"
        />
        <MetricCard
          title="Reply Rate"
          value={`${(stats.replyRate || 0).toFixed(1)}%`}
          subtitle={`${stats.replied || 0} replies`}
          color="orange"
        />
      </div>

      {/* Performance Issues */}
      {(stats.bounced > 0 || stats.spamComplaints > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Performance Issues</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {stats.bounced > 0 && `${stats.bounced} bounced emails`}
                {stats.bounced > 0 && stats.spamComplaints > 0 && ' • '}
                {stats.spamComplaints > 0 && `${stats.spamComplaints} spam complaints`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                {(stats.bounceRate || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-300">Bounce Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Time Series Chart - Enhanced with Recharts */}
      {timeseries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Email Activity Over Time
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="sent"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorSent)"
                name="Sent"
              />
              <Area
                type="monotone"
                dataKey="opened"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorOpened)"
                name="Opened"
              />
              <Area
                type="monotone"
                dataKey="clicked"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorClicked)"
                name="Clicked"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Optimal Send Time Recommendations */}
      {optimalSendTime && optimalSendTime.recommendations && optimalSendTime.recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Optimal Send Time Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {optimalSendTime.recommendations.map((rec: any, index: number) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {rec.formattedHour}
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      rec.confidence === 'high'
                        ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200'
                        : rec.confidence === 'medium'
                        ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {rec.confidence}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {rec.dayName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">{rec.reason}</div>
                <div className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                  Score: {rec.score}/100
                </div>
              </div>
            ))}
          </div>
          {optimalSendTime.hourlyPattern && optimalSendTime.hourlyPattern.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                Engagement by Hour of Day
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={optimalSendTime.hourlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="formattedHour"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="opens" fill="#10b981" name="Opens" />
                  <Bar dataKey="clicks" fill="#8b5cf6" name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Engagement Heatmap */}
      <EngagementHeatmap mailboxId={selectedMailbox} period={selectedPeriod} />

      {/* Device Analytics */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Device & Browser Analytics
        </h2>
        <DeviceAnalytics mailboxId={selectedMailbox} period={selectedPeriod} />
      </div>

      {/* Location Analytics */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Location Analytics
        </h2>
        <LocationAnalytics mailboxId={selectedMailbox} period={selectedPeriod} />
      </div>

      {/* Health Monitoring */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Email Health Monitoring
        </h2>
        <HealthMonitoring mailboxId={selectedMailbox} hours={24} />
      </div>

      {/* Per-Mailbox Performance */}
      {stats.perMailbox && stats.perMailbox.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance by Mailbox
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Mailbox</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Delivered</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Open Rate</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Click Rate</th>
                  <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.perMailbox.map((mb) => (
                  <tr key={mb.mailboxId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{mb.mailboxName}</td>
                    <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                      {(mb.delivered || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                      {(mb.openRate || 0).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                      {(mb.clickRate || 0).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                      {(mb.bounceRate || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  color = 'blue'
}: {
  title: string
  value: string
  subtitle: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  }

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{subtitle}</div>
    </div>
  )
}




