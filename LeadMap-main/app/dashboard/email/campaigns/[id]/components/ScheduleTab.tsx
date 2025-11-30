'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Save, Plus, ChevronDown } from 'lucide-react'

interface ScheduleTabProps {
  campaignId: string
  campaignStatus: string
  initialSchedule?: {
    name?: string
    start_at?: string | null
    timezone?: string
    send_window_start?: string
    send_window_end?: string
    send_days_of_week?: number[]
  }
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' }
]

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada) (UTC-05:00)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada) (UTC-06:00)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada) (UTC-07:00)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada) (UTC-08:00)' },
  { value: 'Europe/London', label: 'London (UTC+00:00)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+01:00)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+09:00)' },
  { value: 'UTC', label: 'UTC (UTC+00:00)' }
]

// Generate time options for dropdown (9:00 AM to 6:00 PM in 30-min increments)
const TIME_OPTIONS = Array.from({ length: 19 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2)
  const minute = i % 2 === 0 ? '00' : '30'
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const time24 = `${hour.toString().padStart(2, '0')}:${minute}`
  return {
    value: time24,
    label: `${displayHour}:${minute} ${period}`
  }
})

export default function ScheduleTab({ campaignId, campaignStatus, initialSchedule }: ScheduleTabProps) {
  const [scheduleName, setScheduleName] = useState(initialSchedule?.name || 'New schedule')
  const [fromTime, setFromTime] = useState('09:00')
  const [toTime, setToTime] = useState('18:00')
  const [timezone, setTimezone] = useState('America/New_York')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [saving, setSaving] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([{ id: 'new', name: 'New schedule' }])
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('new')

  useEffect(() => {
    if (initialSchedule) {
      setScheduleName(initialSchedule.name || 'New schedule')
      
      // Parse time from HH:MM:SS format
      const parseTime = (timeStr?: string) => {
        if (!timeStr) return '09:00'
        return timeStr.includes(':') ? timeStr.substring(0, 5) : '09:00'
      }
      
      setFromTime(parseTime(initialSchedule.send_window_start))
      setToTime(parseTime(initialSchedule.send_window_end))
      setTimezone(initialSchedule.timezone || 'America/New_York')
      setSelectedDays(initialSchedule.send_days_of_week || [1, 2, 3, 4, 5])
    }
  }, [initialSchedule])

  const handleDayToggle = (dayValue: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayValue)) {
        return prev.filter(d => d !== dayValue)
      } else {
        return [...prev, dayValue].sort()
      }
    })
  }

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      alert('Please select at least one day of the week')
      return
    }

    try {
      setSaving(true)

      // Format times properly (HH:MM:SS)
      const fromTimeFormatted = fromTime.includes(':') 
        ? (fromTime.split(':').length === 2 ? `${fromTime}:00` : fromTime)
        : `${fromTime}:00:00`
      const toTimeFormatted = toTime.includes(':')
        ? (toTime.split(':').length === 2 ? `${toTime}:00` : toTime)
        : `${toTime}:00:00`

      const response = await fetch(`/api/campaigns/${campaignId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_name: scheduleName,
          timezone,
          send_window_start: fromTimeFormatted,
          send_window_end: toTimeFormatted,
          send_days_of_week: selectedDays
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save schedule')
      }

      alert('Schedule saved successfully!')
    } catch (err: any) {
      alert(err.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-6">
      {/* Left Sidebar */}
      <div className="w-64 flex-shrink-0 space-y-6">
        {/* Start/End Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4" />
              Start
            </label>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Now
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4" />
              End
            </label>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              No end date
            </div>
          </div>
        </div>

        {/* Schedule List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              onClick={() => setSelectedScheduleId(schedule.id)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedScheduleId === schedule.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{schedule.name}</span>
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              const newSchedule = { id: `schedule-${Date.now()}`, name: `Schedule ${schedules.length}` }
              setSchedules([...schedules, newSchedule])
              setSelectedScheduleId(newSchedule.id)
              setScheduleName(newSchedule.name)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add schedule
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Schedule Name */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Schedule Name</h3>
          <input
            type="text"
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="New schedule"
          />
        </div>

        {/* Timing */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Timing</h3>
          <div className="grid grid-cols-3 gap-4">
            {/* From */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">From</label>
              <div className="relative">
                <select
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-full appearance-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* To */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">To</label>
              <div className="relative">
                <select
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-full appearance-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Timezone</label>
              <div className="relative">
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full appearance-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 text-sm"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Days */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Days</h3>
          <div className="flex flex-wrap gap-3">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.value}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedDays.includes(day.value)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day.value)}
                  onChange={() => handleDayToggle(day.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
