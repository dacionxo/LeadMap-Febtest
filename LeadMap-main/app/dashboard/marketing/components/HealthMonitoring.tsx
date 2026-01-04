'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react'

interface HealthMonitoringProps {
  mailboxId?: string
  hours?: number
}

interface HealthData {
  isHealthy: boolean
  last24hFailures: number
  bounceRate: string
  complaintRate: string
  sentCount: number
  bouncedCount: number
  complaintCount: number
  failureCounts: Record<string, number>
  topFailureReasons: Array<{
    message: string
    count: number
  }>
}

interface HealthTrend {
  date: string
  failures: number
  bounceRate: number
  complaintRate: number
  sent: number
}

/**
 * Email Health Monitoring Component
 * Comprehensive health dashboard with Mautic-style monitoring
 * Tracks bounce rates, complaint rates, failures, and trends
 */
export default function HealthMonitoring({ mailboxId = 'all', hours = 24 }: HealthMonitoringProps) {
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [trend, setTrend] = useState<HealthTrend[]>([])

  useEffect(() => {
    fetchHealth()
    fetchHealthTrend()
  }, [mailboxId, hours])

  const fetchHealth = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        hours: hours.toString(),
        ...(mailboxId !== 'all' && { mailboxId })
      })

      const response = await fetch(`/api/email/health?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setHealth(data.health)
      }
    } catch (error) {
      console.error('Error fetching health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHealthTrend = async () => {
    try {
      // Fetch last 7 days of health data for trend
      const now = new Date()
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      // This would ideally be a separate endpoint, but for now we'll calculate from events
      // In production, create a dedicated health trend endpoint
      const response = await fetch(
        `/api/email/analytics/timeseries?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}&groupBy=day${mailboxId !== 'all' ? `&mailboxId=${mailboxId}` : ''}`,
        { credentials: 'include' }
      )

      if (response.ok) {
        const data = await response.json()
        // Transform timeseries data into health trend
        const trendData: HealthTrend[] = (data.timeseries || []).map((day: any) => ({
          date: day.date,
          failures: day.failed || 0,
          bounceRate: day.delivered > 0 ? ((day.bounced || 0) / day.delivered) * 100 : 0,
          complaintRate: day.delivered > 0 ? ((day.complaint || 0) / day.delivered) * 100 : 0,
          sent: day.sent || 0
        }))
        setTrend(trendData)
      }
    } catch (error) {
      console.error('Error fetching health trend:', error)
    }
  }

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading health data...</div>
      </div>
    )
  }

  if (!health) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No health data available</p>
      </div>
    )
  }

  const bounceRateNum = parseFloat(health.bounceRate)
  const complaintRateNum = parseFloat(health.complaintRate)

  return (
    <div className="space-y-6">
      {/* Health Status Card */}
      <div
        className={`border rounded-lg p-6 ${
          health.isHealthy
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {health.isHealthy ? (
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Email Health Status
            </h3>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              health.isHealthy
                ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200'
                : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
            }`}
          >
            {health.isHealthy ? 'Healthy' : 'Needs Attention'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthMetric
            label="Last 24h Failures"
            value={health.last24hFailures.toString()}
            status={health.last24hFailures < 10 ? 'good' : health.last24hFailures < 50 ? 'warning' : 'bad'}
          />
          <HealthMetric
            label="Bounce Rate"
            value={`${bounceRateNum.toFixed(2)}%`}
            status={bounceRateNum < 2 ? 'good' : bounceRateNum < 5 ? 'warning' : 'bad'}
          />
          <HealthMetric
            label="Complaint Rate"
            value={`${complaintRateNum.toFixed(3)}%`}
            status={complaintRateNum < 0.1 ? 'good' : complaintRateNum < 0.5 ? 'warning' : 'bad'}
          />
          <HealthMetric
            label="Emails Sent"
            value={health.sentCount.toLocaleString()}
            status="neutral"
          />
        </div>
      </div>

      {/* Health Trend Chart */}
      {trend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            7-Day Health Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="colorBounceRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorComplaintRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
                formatter={(value: number, name: string) => {
                  if (name === 'bounceRate' || name === 'complaintRate') {
                    return [`${value.toFixed(2)}%`, name === 'bounceRate' ? 'Bounce Rate' : 'Complaint Rate']
                  }
                  return [value, name]
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="bounceRate"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorBounceRate)"
                name="Bounce Rate"
              />
              <Area
                type="monotone"
                dataKey="complaintRate"
                stroke="#f59e0b"
                fillOpacity={1}
                fill="url(#colorComplaintRate)"
                name="Complaint Rate"
              />
              <Line
                type="monotone"
                dataKey="failures"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Failures"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Failure Breakdown */}
      {Object.keys(health.failureCounts).length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Failure Breakdown
          </h3>
          <div className="space-y-2">
            {Object.entries(health.failureCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Top Failure Reasons */}
      {health.topFailureReasons && health.topFailureReasons.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Failure Reasons
          </h3>
          <div className="space-y-2">
            {health.topFailureReasons.map((reason, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                  {reason.message}
                </span>
                <span className="ml-4 font-semibold text-gray-900 dark:text-white">
                  {reason.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Recommendations */}
      {!health.isHealthy && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
            Recommendations
          </h3>
          <ul className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
            {bounceRateNum >= 5 && (
              <li className="flex items-start gap-2">
                <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  High bounce rate ({bounceRateNum.toFixed(2)}%). Review your email list quality
                  and remove invalid addresses.
                </span>
              </li>
            )}
            {complaintRateNum >= 0.1 && (
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Spam complaints detected ({complaintRateNum.toFixed(3)}%). Review email content
                  and ensure proper unsubscribe links.
                </span>
              </li>
            )}
            {health.last24hFailures >= 10 && (
              <li className="flex items-start gap-2">
                <Activity className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Multiple failures detected ({health.last24hFailures}). Check provider
                  configuration and authentication.
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function HealthMetric({
  label,
  value,
  status
}: {
  label: string
  value: string
  status: 'good' | 'warning' | 'bad' | 'neutral'
}) {
  const statusColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    bad: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-900 dark:text-white'
  }

  return (
    <div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${statusColors[status]}`}>{value}</div>
    </div>
  )
}


