'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, Clock, Save, Plus, ChevronDown, ChevronRight, CalendarPlus } from 'lucide-react'

interface ScheduleTabProps {
  campaignId: string
  campaignStatus: string
  initialSchedule?: {
    name?: string
    start_at?: string | null
    end_at?: string | null
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
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  
  // Date picker states
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const startPickerRef = useRef<HTMLDivElement>(null)
  const endPickerRef = useRef<HTMLDivElement>(null)

  // Close date pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startPickerRef.current && !startPickerRef.current.contains(event.target as Node)) {
        setShowStartPicker(false)
      }
      if (endPickerRef.current && !endPickerRef.current.contains(event.target as Node)) {
        setShowEndPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch schedule from API on mount
  const fetchSchedule = useCallback(async () => {
    if (!campaignId) return
    
    try {
      setLoadingSchedule(true)
      const response = await fetch(`/api/campaigns/${campaignId}/schedule`)
      if (response.ok) {
        const data = await response.json()
        const schedule = data.schedule
        
        if (schedule) {
          // Update form fields
          setScheduleName(schedule.name || 'New schedule')
          
          // Parse time from HH:MM:SS format
          const parseTime = (timeStr?: string) => {
            if (!timeStr) return '09:00'
            return timeStr.includes(':') ? timeStr.substring(0, 5) : '09:00'
          }
          
          setFromTime(parseTime(schedule.send_window_start))
          setToTime(parseTime(schedule.send_window_end))
          setTimezone(schedule.timezone || 'America/New_York')
          setSelectedDays(schedule.send_days_of_week || [1, 2, 3, 4, 5])
          
          // Parse dates
          if (schedule.start_at) {
            const start = new Date(schedule.start_at)
            setStartDate(start.toISOString().split('T')[0])
          } else {
            setStartDate('')
          }
          if (schedule.end_at) {
            const end = new Date(schedule.end_at)
            setEndDate(end.toISOString().split('T')[0])
          } else {
            setEndDate('')
          }
          
          // Add to schedules list if it has a name and schedule data
          const scheduleName = schedule.name || 'New schedule'
          const hasScheduleData = schedule.send_window_start || schedule.send_window_end || schedule.start_at || schedule.end_at
          
          if (hasScheduleData || scheduleName !== 'New schedule') {
            const scheduleEntry = {
              id: campaignId, // Use campaign ID as schedule ID since we only have one schedule per campaign
              name: scheduleName,
              ...schedule
            }
            setSchedules([scheduleEntry])
            setSelectedScheduleId(campaignId)
          } else {
            // No saved schedule yet, show empty state
            setSchedules([])
            setSelectedScheduleId('')
          }
        }
      }
    } catch (err) {
      console.error('Error fetching schedule:', err)
    } finally {
      setLoadingSchedule(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

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
      
      // Parse dates
      if (initialSchedule.start_at) {
        const start = new Date(initialSchedule.start_at)
        setStartDate(start.toISOString().split('T')[0])
      }
      if (initialSchedule.end_at) {
        const end = new Date(initialSchedule.end_at)
        setEndDate(end.toISOString().split('T')[0])
      }
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

  const formatDateForAPI = (dateStr: string): string | null => {
    if (!dateStr) return null
    // Convert YYYY-MM-DD to ISO string with time (start of day in UTC)
    const date = new Date(dateStr)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  const formatDateForDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      alert('Please select at least one day of the week')
      return
    }

    // Validate end date is after start date if both are set
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      alert('End date must be after start date')
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
          start_at: formatDateForAPI(startDate),
          end_at: formatDateForAPI(endDate),
          timezone,
          send_window_start: fromTimeFormatted,
          send_window_end: toTimeFormatted,
          send_days_of_week: selectedDays
        })
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = data.error || 'Failed to save schedule'
        const errorDetails = data.details ? `\n\nDetails: ${data.details}` : ''
        throw new Error(`${errorMessage}${errorDetails}`)
      }

      // Refresh the schedule list after saving
      await fetchSchedule()
      
      alert('Schedule saved successfully!')
    } catch (err: any) {
      console.error('Schedule save error:', err)
      const errorMessage = err.message || 'Failed to save schedule'
      alert(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-6">
      {/* Left Sidebar */}
      <div className="w-64 flex-shrink-0 space-y-6">
        {/* Start/End Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="relative" ref={startPickerRef}>
            <div 
              className="flex items-center gap-3 cursor-pointer border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-3 transition-all duration-200 shadow-sm hover:shadow-md group"
              onClick={() => {
                setShowStartPicker(!showStartPicker)
                setShowEndPicker(false)
              }}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Start</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {startDate ? new Date(startDate).toLocaleDateString() : 'Now'}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </div>
            {showStartPicker && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setShowStartPicker(false)
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => {
                    setStartDate('')
                    setShowStartPicker(false)
                  }}
                  className="mt-2 w-full px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="relative" ref={endPickerRef}>
            <div 
              className="flex items-center gap-3 cursor-pointer border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-3 transition-all duration-200 shadow-sm hover:shadow-md group"
              onClick={() => {
                setShowEndPicker(!showEndPicker)
                setShowStartPicker(false)
              }}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">End</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {endDate ? new Date(endDate).toLocaleDateString() : 'No end date'}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </div>
            {showEndPicker && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setShowEndPicker(false)
                  }}
                  min={startDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => {
                    setEndDate('')
                    setShowEndPicker(false)
                  }}
                  className="mt-2 w-full px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Schedule List */}
        <div className="space-y-2">
          {loadingSchedule ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading schedules...
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No saved schedules yet. Save a schedule to see it here.
            </div>
          ) : (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                onClick={() => {
                  setSelectedScheduleId(schedule.id)
                  setScheduleName(schedule.name)
                  
                  // Load schedule data into form
                  const parseTime = (timeStr?: string) => {
                    if (!timeStr) return '09:00'
                    return timeStr.includes(':') ? timeStr.substring(0, 5) : '09:00'
                  }
                  
                  setFromTime(parseTime(schedule.send_window_start))
                  setToTime(parseTime(schedule.send_window_end))
                  setTimezone(schedule.timezone || 'America/New_York')
                  setSelectedDays(schedule.send_days_of_week || [1, 2, 3, 4, 5])
                  
                  if (schedule.start_at) {
                    const start = new Date(schedule.start_at)
                    setStartDate(start.toISOString().split('T')[0])
                  } else {
                    setStartDate('')
                  }
                  if (schedule.end_at) {
                    const end = new Date(schedule.end_at)
                    setEndDate(end.toISOString().split('T')[0])
                  } else {
                    setEndDate('')
                  }
                }}
                className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
                  selectedScheduleId === schedule.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{schedule.name}</span>
                </div>
              </div>
            ))
          )}
          <button
            onClick={() => {
              // Create a new schedule entry (will be saved when user clicks Save)
              const newScheduleName = `Schedule ${schedules.length + 1}`
              setScheduleName(newScheduleName)
              setSelectedScheduleId('new')
              // Reset form to defaults
              setFromTime('09:00')
              setToTime('18:00')
              setTimezone('America/New_York')
              setSelectedDays([1, 2, 3, 4, 5])
              setStartDate('')
              setEndDate('')
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium border border-blue-200 dark:border-blue-800"
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
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Schedule Name</label>
          <input
            type="text"
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="New schedule"
          />
        </div>

        {/* Timing */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-4">Timing</label>
          <div className="grid grid-cols-3 gap-4">
            {/* From */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">From</label>
              <div className="relative">
                <select
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 text-sm"
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* To */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">To</label>
              <div className="relative">
                <select
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 text-sm"
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Timezone</label>
              <div className="relative">
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 text-sm"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Days */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-4">Days</label>
          <div className="flex flex-wrap gap-3">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.value}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedDays.includes(day.value)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day.value)}
                  onChange={() => handleDayToggle(day.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button and Push to Calendar */}
        <div className="pt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          
          {/* Push to Calendar Button */}
          {startDate && (
            <PushToCalendarButton
              campaignId={campaignId}
              campaignName={scheduleName}
              startDate={startDate}
              endDate={endDate}
              timezone={timezone}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Push to Calendar Button Component
function PushToCalendarButton({ 
  campaignId, 
  campaignName, 
  startDate, 
  endDate, 
  timezone 
}: { 
  campaignId: string
  campaignName: string
  startDate: string
  endDate?: string
  timezone: string
}) {
  const [pushing, setPushing] = useState(false)
  const [hasCalendar, setHasCalendar] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check if user has calendar connected
    const checkCalendar = async () => {
      try {
        const response = await fetch('/api/calendar/connections', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setHasCalendar(data.connections && data.connections.length > 0)
        }
      } catch (error) {
        console.error('Error checking calendar connection:', error)
      } finally {
        setChecking(false)
      }
    }
    checkCalendar()
  }, [])

  const handlePushToCalendar = async () => {
    if (!startDate) {
      alert('Please set a start date for the campaign')
      return
    }

    setPushing(true)
    try {
      // Create calendar event for campaign start
      const startDateTime = new Date(startDate)
      startDateTime.setHours(9, 0, 0, 0) // Default to 9 AM
      
      const endDateTime = endDate ? new Date(endDate) : new Date(startDateTime)
      if (!endDate) {
        endDateTime.setHours(17, 0, 0, 0) // Default to 5 PM if no end date
      }

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `Campaign: ${campaignName}`,
          description: `Email campaign "${campaignName}" starts on ${new Date(startDate).toLocaleDateString()}`,
          eventType: 'other',
          startTime: startDateTime.toISOString().split('T')[0] + 'T09:00',
          endTime: endDateTime.toISOString().split('T')[0] + 'T17:00',
          timezone: timezone,
          allDay: false,
          relatedType: 'campaign',
          relatedId: campaignId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create calendar event')
      }

      alert('Campaign added to calendar successfully!')
    } catch (error: any) {
      console.error('Error pushing to calendar:', error)
      alert(error.message || 'Failed to add campaign to calendar')
    } finally {
      setPushing(false)
    }
  }

  if (checking) {
    return null
  }

  if (!hasCalendar) {
    return (
      <button
        onClick={() => {
          if (confirm('You need to connect a calendar first. Would you like to go to calendar settings?')) {
            window.open('/dashboard/crm/calendar', '_blank')
          }
        }}
        className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
        title="Connect a calendar to enable this feature"
      >
        <CalendarPlus className="w-4 h-4" />
        Push to Calendar
      </button>
    )
  }

  return (
    <button
      onClick={handlePushToCalendar}
      disabled={pushing || !startDate}
      className="px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      title="Add campaign start date to your calendar"
    >
      <CalendarPlus className="w-4 h-4" />
      {pushing ? 'Adding...' : 'Push to Calendar'}
    </button>
  )
}
