'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, MapPin, Tag, FileText, Users } from 'lucide-react'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  initialDate?: Date
  initialEndDate?: Date
  relatedType?: string
  relatedId?: string
  defaultEventType?: string
  onSuccess?: () => void
  eventId?: string // If provided, this is an edit operation
}

export default function CreateEventModal({
  isOpen,
  onClose,
  initialDate,
  initialEndDate,
  relatedType,
  relatedId,
  defaultEventType,
  onSuccess,
  eventId,
}: CreateEventModalProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: defaultEventType || 'call',
    startTime: initialDate ? initialDate.toISOString().slice(0, 16) : '',
    endTime: initialEndDate ? initialEndDate.toISOString().slice(0, 16) : '',
    allDay: false,
    location: '',
    conferencingLink: '',
    notes: '',
    reminderMinutes: [] as number[],
  })
  const isEditMode = !!eventId

  // Load settings and event data on mount
  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      if (isEditMode && eventId) {
        fetchEventData()
      }
    }
  }, [isOpen, eventId, isEditMode])

  const fetchEventData = async () => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        const event = data.event
        
        // Get current timezone setting for proper display
        const currentTimezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        const eventTimezone = event.timezone || currentTimezone
        
        // Convert UTC times to the event's timezone for display in the form
        // The times are stored in UTC, but we need to show them in the event's timezone
        let startTime = ''
        let endTime = ''
        
        if (event.start_time && event.end_time) {
          // Create date objects from UTC times
          const startDate = new Date(event.start_time)
          const endDate = new Date(event.end_time)
          
          // Format in the event's timezone (or current setting timezone)
          startTime = formatDateInTimezone(startDate, eventTimezone)
          endTime = formatDateInTimezone(endDate, eventTimezone)
        }
        
        setFormData({
          title: event.title || '',
          description: event.description || '',
          eventType: event.event_type || 'call',
          startTime,
          endTime,
          allDay: event.all_day || false,
          location: event.location || '',
          conferencingLink: event.conferencing_link || '',
          notes: event.notes || '',
          reminderMinutes: event.reminder_minutes || [],
        })
      }
    } catch (error) {
      console.error('Error fetching event data:', error)
    }
  }

  // Helper function to format date in specific timezone for datetime-local input
  const formatDateInTimezone = (date: Date, timezone: string): string => {
    // Use Intl.DateTimeFormat to get the date/time in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    
    const parts = formatter.formatToParts(date)
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    const hour = parts.find(p => p.type === 'hour')?.value
    const minute = parts.find(p => p.type === 'minute')?.value
    
    return `${year}-${month}-${day}T${hour}:${minute}`
  }

  // Helper function to convert local datetime string to UTC ISO string
  // Treats the input as being in the specified timezone
  const convertLocalToUTC = (localDateTime: string, timezone: string): string => {
    if (!localDateTime) return new Date().toISOString()
    
    // The datetime-local input gives us a string like "2024-01-15T14:30"
    // We need to interpret this as being in the user's timezone, not the browser's local timezone
    
    // Create a date object from the input (this will be interpreted as local time by the browser)
    const localDate = new Date(localDateTime)
    
    // Get what this time would be in UTC if interpreted as local time
    const utcAsLocal = localDate.getTime()
    
    // Get what this same time string would be in the target timezone
    // We'll create a date string with timezone info
    const dateStr = localDateTime.replace('T', ' ')
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    
    // Parse the date components
    const parts = localDateTime.split('T')
    const datePart = parts[0]
    const timePart = parts[1]
    
    // Create a date string that represents this time in the target timezone
    // Format: "YYYY-MM-DD HH:mm" and interpret it in the target timezone
    const dateInTimezone = new Date(`${datePart}T${timePart}:00`)
    
    // Calculate offset between browser timezone and target timezone
    const browserOffset = dateInTimezone.getTimezoneOffset() * 60000
    const targetDateStr = new Date(dateInTimezone.toLocaleString('en-US', { timeZone: timezone }))
    const targetOffset = targetDateStr.getTimezoneOffset() * 60000
    const offsetDiff = browserOffset - targetOffset
    
    // Adjust the date
    const utcDate = new Date(dateInTimezone.getTime() - offsetDiff)
    
    return utcDate.toISOString()
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/calendar/settings', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        // Apply default duration if no initial end date
        if (!initialEndDate && data.settings?.default_event_duration_minutes) {
          const duration = data.settings.default_event_duration_minutes
          if (initialDate) {
            const endDate = new Date(initialDate.getTime() + duration * 60 * 1000)
            setFormData((prev) => ({
              ...prev,
              endTime: endDate.toISOString().slice(0, 16),
            }))
          }
        }
        // Apply default reminders
        if (data.settings?.default_reminders) {
          const reminders = data.settings.default_reminders.map((r: any) => r.minutes)
          setFormData((prev) => ({
            ...prev,
            reminderMinutes: reminders,
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  useEffect(() => {
    if (initialDate) {
      const defaultDuration = settings?.default_event_duration_minutes || 30
      const endDate = initialEndDate || new Date(initialDate.getTime() + defaultDuration * 60 * 1000)
      setFormData((prev) => ({
        ...prev,
        startTime: initialDate.toISOString().slice(0, 16),
        endTime: endDate.toISOString().slice(0, 16),
      }))
    }
  }, [initialDate, initialEndDate, settings])

  const eventTypes = [
    { value: 'call', label: 'Phone Call' },
    { value: 'visit', label: 'Property Visit' },
    { value: 'showing', label: 'Property Showing' },
    { value: 'content', label: 'Content Post' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'other', label: 'Other' },
  ]

  const reminderOptions = [
    { value: 5, label: '5 minutes before' },
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 1440, label: '1 day before' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const timezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      
      // Convert local datetime input to UTC, treating the input as being in the specified timezone
      // The datetime-local input gives us a date string without timezone info
      // We need to interpret it as being in the user's timezone setting
      const startTime = convertLocalToUTC(formData.startTime, timezone)
      const endTime = convertLocalToUTC(formData.endTime, timezone)

      const url = isEditMode ? `/api/calendar/events/${eventId}` : '/api/calendar/events'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          eventType: formData.eventType,
          startTime,
          endTime,
          timezone,
          allDay: formData.allDay,
          location: formData.location,
          conferencingLink: formData.conferencingLink || null,
          relatedType: relatedType || null,
          relatedId: relatedId || null,
          notes: formData.notes,
          reminderMinutes: formData.reminderMinutes.length > 0 ? formData.reminderMinutes : (settings?.default_reminders?.map((r: any) => r.minutes) || [15]),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || (isEditMode ? 'Failed to update event' : 'Failed to create event'))
      }

      if (onSuccess) onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        eventType: defaultEventType || 'call',
        startTime: '',
        endTime: '',
        allDay: false,
        location: '',
        conferencingLink: '',
        notes: '',
        reminderMinutes: [],
      })
    } catch (error: any) {
      alert(error.message || 'Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  const toggleReminder = (minutes: number) => {
    setFormData((prev) => ({
      ...prev,
      reminderMinutes: prev.reminderMinutes.includes(minutes)
        ? prev.reminderMinutes.filter((m) => m !== minutes)
        : [...prev.reminderMinutes, minutes],
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{isEditMode ? 'Edit Event' : 'Create Event'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Event title"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Event Type *
            </label>
            <select
              required
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {eventTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* All Day */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.allDay}
              onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="allDay" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              All day event
            </label>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Event location"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Event description"
            />
          </div>

          {/* Reminders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reminders
            </label>
            <div className="space-y-2">
              {reminderOptions.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.reminderMinutes.includes(option.value)}
                    onChange={() => toggleReminder(option.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Event' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

