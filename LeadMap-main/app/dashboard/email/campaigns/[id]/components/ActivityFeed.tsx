'use client'

import { useState, useEffect } from 'react'
import { Loader2, Mail, Eye, MousePointerClick, Reply, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react'

interface ActivityEvent {
  id: string
  type: string
  email: string
  subject: string
  timestamp: string
  data: Record<string, any>
}

interface ActivityFeedProps {
  campaignId: string
  timeRange: string
}

const EVENT_ICONS: Record<string, any> = {
  sent: Mail,
  opened: Eye,
  clicked: MousePointerClick,
  replied: Reply,
  bounced: XCircle,
  unsubscribed: AlertCircle,
  delivered: CheckCircle2
}

const EVENT_COLORS: Record<string, string> = {
  sent: 'text-blue-600 dark:text-blue-400',
  opened: 'text-green-600 dark:text-green-400',
  clicked: 'text-purple-600 dark:text-purple-400',
  replied: 'text-yellow-600 dark:text-yellow-400',
  bounced: 'text-red-600 dark:text-red-400',
  unsubscribed: 'text-orange-600 dark:text-orange-400',
  delivered: 'text-gray-600 dark:text-gray-400'
}

export default function ActivityFeed({ campaignId, timeRange }: ActivityFeedProps) {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActivity()
  }, [campaignId, timeRange])

  const fetchActivity = async () => {
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
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'Last 4 weeks':
          startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'Last 3 months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
          break
      }

      const url = new URL(`/api/campaigns/${campaignId}/activity`, window.location.origin)
      if (startDate) {
        url.searchParams.set('start_date', startDate)
      }
      if (endDate) {
        url.searchParams.set('end_date', endDate)
      }
      url.searchParams.set('limit', '100')

      const response = await fetch(url.toString())
      if (!response.ok) throw new Error('Failed to fetch activity')

      const data = await response.json()
      setEvents(data.events || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
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

  if (events.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.type] || Mail
          const color = EVENT_COLORS[event.type] || 'text-gray-600 dark:text-gray-400'

          return (
            <div
              key={event.id}
              className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className={`flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      Email {event.type}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {event.email}
                    </p>
                    {event.subject && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                        {event.subject}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


