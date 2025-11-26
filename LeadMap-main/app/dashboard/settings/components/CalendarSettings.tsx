'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

interface CalendarConnection {
  id: string
  provider: 'google' | 'outlook' | 'icloud'
  email: string
  calendar_name: string
  sync_enabled: boolean
  last_sync_at: string | null
}

export default function CalendarSettings() {
  const [connections, setConnections] = useState<CalendarConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/calendar/connections', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch connections')
      }

      const data = await response.json()
      setConnections(data.connections || [])
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGoogle = async () => {
    try {
      setConnecting('google')
      const response = await fetch('/api/calendar/oauth/google', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth')
      }

      const data = await response.json()
      // Redirect to Google OAuth
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Error connecting Google:', error)
      alert('Failed to connect Google Calendar')
      setConnecting(null)
    }
  }

  const handleConnectOutlook = async () => {
    // TODO: Implement Outlook OAuth
    alert('Outlook Calendar integration coming soon!')
  }

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this calendar?')) {
      return
    }

    try {
      const response = await fetch(`/api/calendar/connections/${connectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      await fetchConnections()
    } catch (error) {
      console.error('Error disconnecting:', error)
      alert('Failed to disconnect calendar')
    }
  }

  const handleSync = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/calendar/connections/${connectionId}/sync`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to sync')
      }

      await fetchConnections()
      alert('Calendar synced successfully!')
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Failed to sync calendar')
    }
  }

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      google: 'Google Calendar',
      outlook: 'Microsoft Outlook',
      icloud: 'Apple iCloud',
    }
    return labels[provider] || provider
  }

  const getProviderIcon = (provider: string) => {
    // You can add provider-specific icons here
    return <Calendar className="w-5 h-5" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Calendar Connections
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect your external calendars to sync events and avoid double-booking
        </p>
      </div>

      {/* Connection Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleConnectGoogle}
          disabled={connecting === 'google' || connections.some((c) => c.provider === 'google')}
          className="flex items-center justify-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting === 'google' ? (
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <>
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-white">Connect Google</span>
            </>
          )}
        </button>

        <button
          onClick={handleConnectOutlook}
          disabled={connections.some((c) => c.provider === 'outlook')}
          className="flex items-center justify-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-gray-900 dark:text-white">Connect Outlook</span>
        </button>

        <button
          disabled
          className="flex items-center justify-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg opacity-50 cursor-not-allowed"
        >
          <Calendar className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-500">iCloud (Coming Soon)</span>
        </button>
      </div>

      {/* Connected Calendars */}
      {connections.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Connected Calendars</h3>
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  {getProviderIcon(connection.provider)}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {connection.calendar_name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {connection.email} • {getProviderLabel(connection.provider)}
                    </div>
                    {connection.last_sync_at && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Last synced: {new Date(connection.last_sync_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connection.sync_enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                  <button
                    onClick={() => handleSync(connection.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Sync now"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDisconnect(connection.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Disconnect"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {connections.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No calendars connected yet</p>
          <p className="text-sm mt-2">Connect a calendar to start syncing events</p>
        </div>
      )}
    </div>
  )
}

