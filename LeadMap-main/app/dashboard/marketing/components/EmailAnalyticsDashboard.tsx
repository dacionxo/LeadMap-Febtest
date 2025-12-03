'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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

  useEffect(() => {
    fetchMailboxes()
    fetchStats()
    fetchTimeseries()
    fetchHealth()
  }, [selectedMailbox, selectedPeriod])

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
            onClick={() => handleExport('events')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

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

      {/* Time Series Chart */}
      {timeseries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Email Activity Over Time
          </h2>
          <div className="h-64">
            <TimeSeriesChart data={timeseries} />
          </div>
        </div>
      )}

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

function TimeSeriesChart({ data }: { data: TimeSeriesData[] }) {
  // Simple bar chart implementation
  // In production, you'd use a charting library like recharts or chart.js
  const maxValue = data.length > 0 
    ? Math.max(...data.map(d => Math.max(d.sent || 0, d.opened || 0, d.clicked || 0)))
    : 1
  
  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 800 200" className="w-full h-full">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="50"
            y1={160 - (y / 100) * 140}
            x2="750"
            y2={160 - (y / 100) * 140}
            stroke="#e5e7eb"
            strokeWidth="1"
            className="dark:stroke-gray-700"
          />
        ))}

        {/* Bars for sent, opened, clicked */}
        {data.map((d, i) => {
          const x = 60 + (i * (690 / data.length))
          const width = 690 / data.length - 4
          const sentHeight = (d.sent / maxValue) * 140
          const openedHeight = (d.opened / maxValue) * 140
          const clickedHeight = (d.clicked / maxValue) * 140

          return (
            <g key={i}>
              <rect
                x={x}
                y={160 - sentHeight}
                width={width}
                height={sentHeight}
                fill="#3b82f6"
                opacity="0.3"
              />
              <rect
                x={x}
                y={160 - openedHeight}
                width={width}
                height={openedHeight}
                fill="#10b981"
                opacity="0.6"
              />
              <rect
                x={x}
                y={160 - clickedHeight}
                width={width}
                height={clickedHeight}
                fill="#8b5cf6"
              />
            </g>
          )
        })}

        {/* Labels */}
        {data.map((d, i) => {
          const x = 60 + (i * (690 / data.length)) + (690 / data.length) / 2
          const date = new Date(d.date)
          return (
            <text
              key={i}
              x={x}
              y="190"
              textAnchor="middle"
              className="text-xs fill-gray-600 dark:fill-gray-400"
            >
              {date.getMonth() + 1}/{date.getDate()}
            </text>
          )
        })}
      </svg>
    </div>
  )
}



