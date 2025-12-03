'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Eye, MousePointerClick, Reply, Calendar, TrendingUp } from 'lucide-react'

interface RecipientEngagement {
  recipientEmail: string
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  openRate: number
  clickRate: number
  replyRate: number
  lastOpenedAt?: string
  lastClickedAt?: string
  lastRepliedAt?: string
  recentEvents?: Array<{
    eventType: string
    timestamp: string
    metadata?: any
  }>
}

interface RecipientEngagementModalProps {
  contactId?: string
  email?: string
  onClose: () => void
}

export default function RecipientEngagementModal({
  contactId,
  email,
  onClose
}: RecipientEngagementModalProps) {
  const [loading, setLoading] = useState(true)
  const [engagement, setEngagement] = useState<RecipientEngagement | null>(null)

  useEffect(() => {
    fetchEngagement()
  }, [contactId, email])

  const fetchEngagement = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (contactId) params.append('contactId', contactId)
      if (email) params.append('email', email)

      const response = await fetch(`/api/email/analytics/recipient?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setEngagement(data.engagement)
      }
    } catch (error) {
      console.error('Error fetching recipient engagement:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Email Engagement
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading engagement data...</div>
            </div>
          ) : engagement ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Sent</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {engagement.totalSent || 0}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="text-sm text-green-700 dark:text-green-300 mb-1">Opened</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {engagement.totalOpened || 0}
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Clicked</div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {engagement.totalClicked || 0}
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Replied</div>
                  <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {engagement.totalReplied || 0}
                  </div>
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Open Rate</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(engagement.openRate || 0).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Click Rate</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(engagement.clickRate || 0).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Reply Rate</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(engagement.replyRate || 0).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Last Activity */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">Last Activity</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Last Opened</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(engagement.lastOpenedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Last Clicked</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(engagement.lastClickedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Reply className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Last Replied</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(engagement.lastRepliedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Events Timeline */}
              {engagement.recentEvents && engagement.recentEvents.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Events</h3>
                  <div className="space-y-2">
                    {engagement.recentEvents.map((event, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex-shrink-0">
                          {event.eventType === 'opened' && <Eye className="w-4 h-4 text-green-500" />}
                          {event.eventType === 'clicked' && <MousePointerClick className="w-4 h-4 text-purple-500" />}
                          {event.eventType === 'replied' && <Reply className="w-4 h-4 text-orange-500" />}
                          {event.eventType === 'sent' && <Mail className="w-4 h-4 text-blue-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {event.eventType}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(event.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!engagement.recentEvents || engagement.recentEvents.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No recent events
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No engagement data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

