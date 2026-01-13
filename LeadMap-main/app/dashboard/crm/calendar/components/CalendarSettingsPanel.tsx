'use client'

import { useState, useEffect } from 'react'
import { Settings, Calendar as CalendarIcon, Bell, Eye, Palette, Clock, Globe, Layout, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

interface CalendarSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function CalendarSettingsPanel({ isOpen, onClose }: CalendarSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'calendars' | 'notifications' | 'appearance'>('general')
  const [settings, setSettings] = useState<any>(null)
  const [calendars, setCalendars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      fetchCalendars()
    }
  }, [isOpen])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/calendar/settings', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/calendar/settings/calendars', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setCalendars(data.calendars || [])
      }
    } catch (error) {
      console.error('Error fetching calendars:', error)
    }
  }

  const updateSettings = async (updates: any) => {
    setSaving(true)
    try {
      const response = await fetch('/api/calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        // Trigger settings update event for calendar view
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('calendarSettingsUpdated', { detail: data.settings }))
        }
        // Show success feedback (subtle, no alert)
        console.log('Settings updated successfully')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update settings')
      }
    } catch (error: any) {
      console.error('Error updating settings:', error)
      alert(error.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'calendars', label: 'Settings for my calendars', icon: CalendarIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Eye },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar - Google Calendar Style */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <GeneralSettings settings={settings} onUpdate={updateSettings} saving={saving} />
              )}
              {activeTab === 'calendars' && (
                <CalendarListSettings calendars={calendars} onUpdate={fetchCalendars} />
              )}
              {activeTab === 'notifications' && (
                <NotificationSettings settings={settings} onUpdate={updateSettings} saving={saving} />
              )}
              {activeTab === 'appearance' && (
                <AppearanceSettings settings={settings} onUpdate={updateSettings} saving={saving} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// General Settings Component
function GeneralSettings({ settings, onUpdate, saving }: any) {
  const [formData, setFormData] = useState({
    defaultTimezone: settings?.default_timezone || 'America/New_York',
    defaultEventDurationMinutes: settings?.default_event_duration_minutes || 30,
    defaultEventVisibility: settings?.default_event_visibility || 'private',
    defaultCalendarColor: settings?.default_calendar_color || '#3b82f6',
    language: settings?.language || 'en',
    defaultView: settings?.default_view || 'month',
    showWeekends: settings?.show_weekends ?? true,
    viewDensity: settings?.view_density || 'comfortable',
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        defaultTimezone: settings.default_timezone || 'America/New_York',
        defaultEventDurationMinutes: settings.default_event_duration_minutes || 30,
        defaultEventVisibility: settings.default_event_visibility || 'private',
        defaultCalendarColor: settings.default_calendar_color || '#3b82f6',
        language: settings.language || 'en',
        defaultView: settings.default_view || 'month',
        showWeekends: settings.show_weekends ?? true,
        viewDensity: settings.view_density || 'comfortable',
      })
    }
  }, [settings])

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    onUpdate({ [field]: value })
  }

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">General</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Configure your default calendar preferences</p>
      </div>

      <div className="space-y-4">
        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Time zone
          </label>
          <select
            value={formData.defaultTimezone}
            onChange={(e) => handleChange('defaultTimezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {/* Default Event Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default event duration
          </label>
          <select
            value={formData.defaultEventDurationMinutes}
            onChange={(e) => handleChange('defaultEventDurationMinutes', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {/* Default View */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default view
          </label>
          <select
            value={formData.defaultView}
            onChange={(e) => handleChange('defaultView', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
            <option value="agenda">Agenda</option>
          </select>
        </div>

        {/* Show Weekends */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Show weekends
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">Display Saturday and Sunday in calendar views</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.showWeekends}
              onChange={(e) => handleChange('showWeekends', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* View Density */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            View density
          </label>
          <select
            value={formData.viewDensity}
            onChange={(e) => handleChange('viewDensity', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>
      </div>
    </div>
  )
}

// Calendar List Settings Component
function CalendarListSettings({ calendars, onUpdate }: any) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncStatus(null)
    
    try {
      const response = await fetch('/api/calendar/sync/manual', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync calendars')
      }

      // Show success with details
      setSyncStatus({
        success: true,
        message: data.message || 'Calendar sync completed successfully',
        details: {
          synced: data.synced || 0,
          updated: data.updated || 0,
          skipped: data.skipped || 0,
          total: data.total || 0,
          results: data.results || [],
        },
      })

      // Refresh calendar list to update last_sync_at
      await onUpdate()

      // Clear status after 5 seconds
      setTimeout(() => {
        setSyncStatus(null)
      }, 5000)
    } catch (error: any) {
      console.error('Error syncing calendars:', error)
      setSyncStatus({
        success: false,
        message: error.message || 'Failed to sync calendars. Please try again.',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async (connectionId: string, calendarName: string) => {
    if (!confirm(`Are you sure you want to disconnect "${calendarName}"?\n\nThis will stop syncing events from this calendar.`)) {
      return
    }

    setDisconnecting(connectionId)
    try {
      const response = await fetch(`/api/calendar/connections/${connectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to disconnect calendar')
      }

      // Refresh calendar list
      await onUpdate()
      
      // Show success message
      alert('Calendar disconnected successfully')
    } catch (error: any) {
      console.error('Error disconnecting calendar:', error)
      alert(error.message || 'Failed to disconnect calendar')
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Settings for my calendars
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure individual calendar settings and manage connections
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || calendars.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title="Sync all calendars now"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Sync Status Message */}
        {syncStatus && (
          <div
            className={`mb-4 p-4 rounded-lg border ${
              syncStatus.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {syncStatus.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    syncStatus.success
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-red-800 dark:text-red-300'
                  }`}
                >
                  {syncStatus.message}
                </p>
                {syncStatus.success && syncStatus.details && (
                  <div className="mt-2 text-xs text-green-700 dark:text-green-400 space-y-1">
                    <div className="flex gap-4 flex-wrap">
                      <span>✅ Synced: <strong>{syncStatus.details.synced}</strong></span>
                      <span>🔄 Updated: <strong>{syncStatus.details.updated}</strong></span>
                      <span>⏭️ Skipped: <strong>{syncStatus.details.skipped}</strong></span>
                      <span>📊 Total: <strong>{syncStatus.details.total}</strong></span>
                    </div>
                    {syncStatus.details.results && syncStatus.details.results.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                        <p className="font-medium mb-1">Calendar Results:</p>
                        {syncStatus.details.results.map((result: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            {result.status === 'success' ? (
                              <span>
                                ✓ {result.calendarName || result.email}: {result.synced} synced, {result.updated} updated
                              </span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">
                                ✗ {result.calendarName || result.email}: {result.error || 'Failed'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {calendars.length === 0 ? (
          <div className="p-6 text-center border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">No calendars connected yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Connect a calendar to start syncing events
            </p>
          </div>
        ) : (
          calendars.map((item: any) => (
            <div
              key={item.connection.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.settings?.color || item.connection.color || '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {item.settings?.name || item.connection.calendar_name || item.connection.email}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {item.connection.provider} • {item.connection.email}
                    </p>
                    {item.connection.last_sync_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Last synced: {new Date(item.connection.last_sync_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDisconnect(item.connection.id, item.settings?.name || item.connection.calendar_name || item.connection.email)}
                    disabled={disconnecting === item.connection.id}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Disconnect calendar"
                  >
                    {disconnecting === item.connection.id ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Notification Settings Component
function NotificationSettings({ settings, onUpdate, saving }: any) {
  const [formData, setFormData] = useState({
    notificationsEmail: settings?.notifications_email ?? true,
    notificationsInApp: settings?.notifications_in_app ?? true,
    notificationsSms: settings?.notifications_sms ?? false,
    notificationSoundEnabled: settings?.notification_sound_enabled ?? true,
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        notificationsEmail: settings.notifications_email ?? true,
        notificationsInApp: settings.notifications_in_app ?? true,
        notificationsSms: settings.notifications_sms ?? false,
        notificationSoundEnabled: settings.notification_sound_enabled ?? true,
      })
    }
  }, [settings])

  const handleToggle = (field: string) => {
    const newValue = !formData[field as keyof typeof formData]
    setFormData((prev) => ({ ...prev, [field]: newValue }))
    onUpdate({ [field]: newValue })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Notifications</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Configure how you receive notifications</p>
      </div>

      <div className="space-y-4">
        {[
          { key: 'notificationsEmail', label: 'Email notifications', desc: 'Receive event notifications via email' },
          { key: 'notificationsInApp', label: 'In-app notifications', desc: 'Show notifications in the application' },
          { key: 'notificationsSms', label: 'SMS notifications', desc: 'Receive notifications via text message' },
          { key: 'notificationSoundEnabled', label: 'Notification sound', desc: 'Play sound when notifications arrive' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.label}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData[item.key as keyof typeof formData] as boolean}
                onChange={() => handleToggle(item.key)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

// Appearance Settings Component
function AppearanceSettings({ settings, onUpdate, saving }: any) {
  const { theme, setTheme } = useTheme()
  const [formData, setFormData] = useState({
    appearance: settings?.appearance || theme || 'system',
    colorCodeByEventType: settings?.color_code_by_event_type ?? true,
    showDeclinedEvents: settings?.show_declined_events ?? false,
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        appearance: settings.appearance || theme || 'system',
        colorCodeByEventType: settings.color_code_by_event_type ?? true,
        showDeclinedEvents: settings.show_declined_events ?? false,
      })
    }
  }, [settings, theme])

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    
    // If changing theme, also update the global theme
    if (field === 'appearance') {
      setTheme(value as 'light' | 'dark' | 'system')
    }
    
    onUpdate({ [field]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Appearance</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Customize the look and feel of your calendar</p>
      </div>

      <div className="space-y-4">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Theme
          </label>
          <select
            value={formData.appearance}
            onChange={(e) => handleChange('appearance', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System default</option>
          </select>
        </div>

        {/* Color Code by Event Type */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Color code by event type
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">Use different colors for different event types</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.colorCodeByEventType}
              onChange={(e) => handleChange('colorCodeByEventType', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Show Declined Events */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Show declined events
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">Display events you've declined in calendar views</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.showDeclinedEvents}
              onChange={(e) => handleChange('showDeclinedEvents', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  )
}

