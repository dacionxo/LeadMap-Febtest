/**
 * Queue Overview Component
 * Shows queue status, depth, and quick stats
 */

'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'

interface QueueStatus {
  transport: string
  queue: {
    depth: number
    pending: number
    processing: number
    completed: number
    failed: number
  }
  failedMessages: number
  scheduledMessages: number
  timestamp: string
}

export default function QueueOverview() {
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transport, setTransport] = useState('default')

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/symphony/status?transport=${transport}`)
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [transport])

  if (loading && !status) {
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

  if (!status) {
    return null
  }

  const stats = [
    {
      label: 'Queue Depth',
      value: status.queue.depth,
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Pending',
      value: status.queue.pending,
      icon: Clock,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      label: 'Processing',
      value: status.queue.processing,
      icon: RefreshCw,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Completed',
      value: status.queue.completed,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Failed',
      value: status.queue.failed,
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      label: 'Dead Letter Queue',
      value: status.failedMessages,
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Transport Selector */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Transport
          </label>
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="default">Default</option>
            <option value="email">Email</option>
            <option value="campaign">Campaign</option>
            <option value="sms">SMS</option>
          </select>
        </div>
        <button
          onClick={fetchStatus}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={`${stat.bgColor} rounded-lg p-6 border border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold ${stat.color} mt-2`}>
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <Icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Additional Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Scheduled Messages: <span className="font-medium">{status.scheduledMessages}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Last Updated: {new Date(status.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  )
}


