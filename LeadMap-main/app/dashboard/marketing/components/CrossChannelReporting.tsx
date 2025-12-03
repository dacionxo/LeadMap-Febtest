'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Mail, MessageCircle, Eye, MousePointerClick, TrendingUp } from 'lucide-react'

interface EmailMetrics {
  delivered: number
  opened: number
  clicked: number
  replied: number
  openRate: number
  clickRate: number
  replyRate: number
}

interface SocialMetrics {
  impressions: number
  engagement: number
  clicks: number
  engagementRate: number
}

interface CrossChannelData {
  email: EmailMetrics
  social: SocialMetrics
  timeseries: Array<{
    date: string
    email_sent: number
    email_opens: number
    email_clicks: number
    social_impressions: number
    social_engagement: number
  }>
}

export default function CrossChannelReporting() {
  const [data, setData] = useState<CrossChannelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch email metrics
      const emailResponse = await fetch(`/api/email/analytics/stats?period=${period}`, {
        credentials: 'include',
      })
      
      // Fetch social metrics (placeholder - replace with actual API)
      const socialResponse = await fetch(`/api/social/analytics?period=${period}`, {
        credentials: 'include',
      }).catch(() => ({ ok: false })) // Gracefully handle if social API doesn't exist

      const emailData = emailResponse.ok ? await emailResponse.json() : null
      const socialData = socialResponse.ok ? await socialResponse.json() : null

      // Fetch timeseries data
      const timeseriesResponse = await fetch(`/api/email/analytics/timeseries?period=${period}`, {
        credentials: 'include',
      })
      const timeseriesData = timeseriesResponse.ok ? await timeseriesResponse.json() : { data: [] }

      setData({
        email: emailData?.stats || {
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
        },
        social: socialData?.stats || {
          impressions: 0,
          engagement: 0,
          clicks: 0,
          engagementRate: 0,
        },
        timeseries: timeseriesData.data || [],
      })
    } catch (error) {
      console.error('Error fetching cross-channel data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No data available for cross-channel reporting.
      </div>
    )
  }

  const maxValue = Math.max(
    data.email.delivered || 0,
    data.social.impressions || 0,
    ...(data.timeseries.map(d => Math.max(d.email_sent || 0, d.social_impressions || 0)) || [])
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cross-Channel Performance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Compare email and social media metrics side by side
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Email Delivered"
          value={data.email.delivered.toLocaleString()}
          icon={Mail}
          color="blue"
          subtitle={`${data.email.openRate.toFixed(1)}% open rate`}
        />
        <MetricCard
          title="Social Impressions"
          value={data.social.impressions.toLocaleString()}
          icon={Eye}
          color="purple"
          subtitle={`${data.social.engagementRate.toFixed(1)}% engagement`}
        />
        <MetricCard
          title="Email Clicks"
          value={data.email.clicked.toLocaleString()}
          icon={MousePointerClick}
          color="green"
          subtitle={`${data.email.clickRate.toFixed(1)}% click rate`}
        />
        <MetricCard
          title="Social Engagement"
          value={data.social.engagement.toLocaleString()}
          icon={MessageCircle}
          color="orange"
          subtitle={`${data.social.engagementRate.toFixed(1)}% rate`}
        />
      </div>

      {/* Comparison Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Email vs Social Performance
        </h3>
        <div className="space-y-4">
          {data.timeseries.length > 0 ? (
            <div className="space-y-2">
              {data.timeseries.slice(-14).map((day, index) => {
                const emailSent = day.email_sent || 0
                const socialImpressions = day.social_impressions || 0
                const emailOpens = day.email_opens || 0
                const socialEngagement = day.social_engagement || 0

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>{new Date(day.date).toLocaleDateString()}</span>
                      <span>Email: {emailSent} sent, {emailOpens} opens | Social: {socialImpressions} impressions, {socialEngagement} engagement</span>
                    </div>
                    <div className="flex gap-2 h-4">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${maxValue > 0 ? (emailSent / maxValue) * 100 : 0}%` }}
                          title={`Email: ${emailSent} sent`}
                        />
                      </div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${maxValue > 0 ? (socialImpressions / maxValue) * 100 : 0}%` }}
                          title={`Social: ${socialImpressions} impressions`}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No timeseries data available
            </div>
          )}
        </div>
      </div>

      {/* Rate Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            Email Engagement Rates
          </h3>
          <div className="space-y-3">
            <RateBar label="Open Rate" value={data.email.openRate} color="blue" />
            <RateBar label="Click Rate" value={data.email.clickRate} color="green" />
            <RateBar label="Reply Rate" value={data.email.replyRate} color="orange" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-500" />
            Social Engagement Rates
          </h3>
          <div className="space-y-3">
            <RateBar label="Engagement Rate" value={data.social.engagementRate} color="purple" />
            <RateBar label="Click Rate" value={data.social.clicks > 0 && data.social.impressions > 0 ? (data.social.clicks / data.social.impressions) * 100 : 0} color="blue" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string
  value: string
  icon: any
  color: string
  subtitle?: string
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

