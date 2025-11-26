'use client'

import { useState, useEffect } from 'react'
import { Settings, Calendar as CalendarIcon, Bell, Eye, Palette, Clock, Globe, Layout } from 'lucide-react'
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Settings for my calendars
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure individual calendar settings
        </p>
      </div>

      <div className="space-y-3">
        {calendars.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No calendars connected yet</p>
        ) : (
          calendars.map((item: any) => (
            <div
              key={item.connection.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.settings?.color || item.connection.color || '#3b82f6' }}
                  />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {item.settings?.name || item.connection.calendar_name || item.connection.email}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.connection.provider} • {item.connection.email}
                    </p>
                  </div>
                </div>
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Settings
                </button>
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

