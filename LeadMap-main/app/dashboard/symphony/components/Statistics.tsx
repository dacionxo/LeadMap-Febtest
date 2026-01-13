/**
 * Statistics Component
 * Visualizes queue statistics and metrics
 */

'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, BarChart3, TrendingUp, AlertCircle } from 'lucide-react'

interface Stats {
  statusCounts: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
  priorityDistribution: Record<number, number>
  typeDistribution: Record<string, number>
  transportDistribution: Record<string, number>
  averageProcessingTime: number
  totalProcessed: number
  totalSucceeded: number
  totalFailed: number
  failedMessages: number
  scheduledMessages: number
  successRate: number
}

export default function Statistics() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hours, setHours] = useState(24)
  const [transport, setTransport] = useState('')

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('hours', hours.toString())
      if (transport) params.append('transport', transport)

      const response = await fetch(`/api/symphony/admin/stats?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch statistics')
      }
      const data = await response.json()
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [hours, transport])

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
          <span className="text-red-800 dark:text-red-200">{error}</span>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Range
            </label>
            <select
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last Week</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Transport
            </label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              <option value="default">Default</option>
              <option value="email">Email</option>
              <option value="campaign">Campaign</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Processed
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalProcessed.toLocaleString()}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Success Rate
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                {(stats.successRate * 100).toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Processing Time
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.averageProcessingTime > 0
                  ? `${(stats.averageProcessingTime / 1000).toFixed(2)}s`
                  : 'N/A'}
              </p>
            </div>
            <RefreshCw className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Failed Messages
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                {stats.totalFailed.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Status Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.statusCounts).map(([status, count]) => (
            <div key={status} className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {status}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Message Type Distribution */}
      {Object.keys(stats.typeDistribution).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Message Type Distribution
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.typeDistribution)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-white">{type}</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Priority Distribution */}
      {Object.keys(stats.priorityDistribution).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Priority Distribution
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((priority) => (
              <div key={priority} className="text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {stats.priorityDistribution[priority] || 0}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">P{priority}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


