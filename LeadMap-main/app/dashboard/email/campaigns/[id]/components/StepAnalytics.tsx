'use client'

import { useState, useEffect } from 'react'
import { Loader2, TrendingUp, Mail, Eye, MousePointerClick } from 'lucide-react'

interface StepMetrics {
  step_id: string
  step_number: number
  subject: string
  metrics: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    open_rate: string
    click_rate: string
  }
}

interface StepAnalyticsProps {
  campaignId: string
  timeRange: string
}

export default function StepAnalytics({ campaignId, timeRange }: StepAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [stepAnalytics, setStepAnalytics] = useState<StepMetrics[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStepAnalytics()
  }, [campaignId, timeRange])

  const fetchStepAnalytics = async () => {
    if (!campaignId) return

    try {
      setLoading(true)
      setError(null)

      // Calculate date range
      const now = new Date()
      let startDate: string | null = null
      let endDate: string | null = null

      switch (timeRange) {
        case 'Last 7 days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          break
        case 'Last 4 weeks':
          startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          break
        case 'Last 3 months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          break
      }

      const url = new URL(`/api/campaigns/${campaignId}/steps/analytics`, window.location.origin)
      if (startDate) {
        url.searchParams.set('start_date', startDate)
      }
      if (endDate) {
        url.searchParams.set('end_date', endDate)
      }

      const response = await fetch(url.toString())
      if (!response.ok) throw new Error('Failed to fetch step analytics')

      const data = await response.json()
      setStepAnalytics(data.step_analytics || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load step analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (stepAnalytics.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">No step analytics available yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Step</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Opened</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clicked</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Open Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Click Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {stepAnalytics.map((step) => (
              <tr key={step.step_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Step {step.step_number}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                    {step.subject || '<Empty subject>'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    {step.metrics.sent}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Eye className="w-4 h-4" />
                    {step.metrics.opened}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MousePointerClick className="w-4 h-4" />
                    {step.metrics.clicked}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {parseFloat(step.metrics.open_rate).toFixed(1)}%
                    </span>
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(parseFloat(step.metrics.open_rate), 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {parseFloat(step.metrics.click_rate).toFixed(1)}%
                    </span>
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${Math.min(parseFloat(step.metrics.click_rate), 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


