'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { EventInput, DateSelectArg, EventClickArg, EventChangeArg } from '@fullcalendar/core'
import { Calendar, Plus, Settings, RefreshCw, ChevronLeft, ChevronRight, Search, HelpCircle, Grid3x3, Check, X } from 'lucide-react'
import CalendarHelpModal from './CalendarHelpModal'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay?: boolean
  backgroundColor?: string
  borderColor?: string
  extendedProps?: {
    eventType?: string
    location?: string
    description?: string
    relatedType?: string
    relatedId?: string
  }
}

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  onDateSelect?: (start: Date, end: Date) => void
  calendarType?: string | null // 'native', 'google', 'microsoft365', 'outlook', 'exchange', or null
}

export default function CalendarView({ onEventClick, onDateSelect, calendarType }: CalendarViewProps) {
  const [events, setEvents] = useState<EventInput[]>([])
  const [allEvents, setAllEvents] = useState<EventInput[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'>('dayGridMonth')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const calendarRef = useRef<FullCalendar>(null)

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event: CustomEvent) => {
      setSettings(event.detail)
    }

    window.addEventListener('calendarSettingsUpdated', handleSettingsUpdate as EventListener)
    return () => {
      window.removeEventListener('calendarSettingsUpdated', handleSettingsUpdate as EventListener)
    }
  }, [])

  // Apply default view from settings
  useEffect(() => {
    if (settings?.default_view && calendarRef.current) {
      const viewMap: Record<string, 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'> = {
        month: 'dayGridMonth',
        week: 'timeGridWeek',
        day: 'timeGridDay',
        agenda: 'listWeek',
      }
      const mappedView = viewMap[settings.default_view] || 'dayGridMonth'
      if (mappedView !== view) {
        setView(mappedView)
        calendarRef.current.getApi().changeView(mappedView)
      }
    }
  }, [settings?.default_view])

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
      setSettingsLoaded(true)
    }
  }

  // Get font family based on calendar provider
  const getCalendarFontFamily = (type: string | null) => {
    switch (type) {
      case 'google':
        return "'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      case 'microsoft365':
      case 'outlook':
        return "'Segoe UI', 'Segoe UI Web', -apple-system, BlinkMacSystemFont, sans-serif"
      case 'exchange':
        return "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
      default:
        return "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif"
    }
  }

  // Get theme colors based on calendar provider
  const getCalendarTheme = (type: string | null) => {
    switch (type) {
      case 'google':
        return {
          primary: '#1a73e8',
          primaryHover: '#1557b0',
          todayBg: '#e8f0fe',
          todayText: '#1a73e8',
          headerBg: '#ffffff',
          headerText: '#3c4043',
          border: '#dadce0',
          eventBorderRadius: '4px',
          eventShadow: '0 1px 2px rgba(60, 64, 67, 0.3)',
        }
      case 'microsoft365':
      case 'outlook':
        return {
          primary: '#0078d4',
          primaryHover: '#106ebe',
          todayBg: '#deecf9',
          todayText: '#0078d4',
          headerBg: '#faf9f8',
          headerText: '#323130',
          border: '#edebe9',
          eventBorderRadius: '2px',
          eventShadow: '0 1.6px 3.6px rgba(0, 0, 0, 0.13), 0 0.3px 0.9px rgba(0, 0, 0, 0.11)',
        }
      case 'exchange':
        return {
          primary: '#0078d4',
          primaryHover: '#106ebe',
          todayBg: '#deecf9',
          todayText: '#0078d4',
          headerBg: '#faf9f8',
          headerText: '#323130',
          border: '#edebe9',
          eventBorderRadius: '2px',
          eventShadow: '0 1.6px 3.6px rgba(0, 0, 0, 0.13)',
        }
      default: // native
        return {
          primary: '#3b82f6',
          primaryHover: '#2563eb',
          todayBg: '#eff6ff',
          todayText: '#3b82f6',
          headerBg: '#f9fafb',
          headerText: '#374151',
          border: '#e5e7eb',
          eventBorderRadius: '4px',
          eventShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        }
    }
  }

  // Get calendar type from settings if not passed as prop (computed in render)
  const effectiveCalendarType = calendarType || settings?.calendar_type || 'native'
  const theme = getCalendarTheme(effectiveCalendarType)

  // Format event for FullCalendar - uses user's timezone from settings
  const formatEventForCalendar = (event: any): EventInput => {
    // Get user's timezone from settings
    const userTimezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Apply color coding
    let eventColor = event.color
    if (!eventColor) {
      if (settings?.color_code_by_event_type !== false) {
        eventColor = getEventColor(event.event_type)
      } else {
        eventColor = settings?.default_calendar_color || '#3b82f6'
      }
    }

    // Handle all-day events
    if (event.all_day && event.start_date && event.end_date) {
      // All-day: use dates, FullCalendar expects exclusive end date
      const endDate = new Date(event.end_date)
      endDate.setDate(endDate.getDate() + 1)
      const endDateStr = endDate.toISOString().split('T')[0]
      
      return {
        id: event.id,
        title: event.title,
        start: event.start_date,
        end: endDateStr,
        allDay: true,
        backgroundColor: eventColor,
        borderColor: eventColor,
        extendedProps: {
          eventType: event.event_type,
          location: event.location,
          description: event.description,
          relatedType: event.related_type,
          relatedId: event.related_id,
          status: event.status,
        },
      }
    }

    // Timed events: Convert UTC to user's timezone BEFORE passing to FullCalendar
    // This ensures FullCalendar NEVER sees UTC times - only times in user's timezone
    let startTime = event.start_time || ''
    let endTime = event.end_time || ''
    
    // Helper to convert UTC ISO string to user's timezone
    // Returns an ISO string that represents the time in user's timezone
    const convertUtcToUserTimezone = (utcIsoString: string, tz: string): string => {
      if (!utcIsoString) return ''
      
      // Parse UTC time
      const utcDate = new Date(utcIsoString)
      if (isNaN(utcDate.getTime())) {
        // If parsing fails, try to fix common issues
        if (!utcIsoString.endsWith('Z') && !utcIsoString.match(/[+-]\d{2}:\d{2}$/)) {
          // Assume UTC and add 'Z'
          const fixed = utcIsoString + (utcIsoString.includes('.') ? '' : '.000') + 'Z'
          const fixedDate = new Date(fixed)
          if (!isNaN(fixedDate.getTime())) {
            return convertUtcToUserTimezone(fixed, tz)
          }
        }
        return utcIsoString
      }
      
      // Get the time components in the user's timezone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      
      const parts = formatter.formatToParts(utcDate)
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '1')
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '1')
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
      const second = parseInt(parts.find(p => p.type === 'second')?.value || '0')
      
      // Create a Date object using these components (will be in browser's local time)
      // This represents the same moment but interpreted in the user's timezone
      const localDate = new Date(year, month - 1, day, hour, minute, second)
      
      // Return as ISO string - FullCalendar with timeZone='local' will display this correctly
      // The ISO string represents the time in the user's timezone
      return localDate.toISOString()
    }
    
    // Convert both times from UTC to user's timezone
    startTime = convertUtcToUserTimezone(startTime, userTimezone)
    endTime = convertUtcToUserTimezone(endTime, userTimezone)
    
    return {
      id: event.id,
      title: event.title,
      start: startTime,
      end: endTime,
      allDay: false,
      backgroundColor: eventColor,
      borderColor: eventColor,
      extendedProps: {
        eventType: event.event_type,
        location: event.location,
        description: event.description,
        relatedType: event.related_type,
        relatedId: event.related_id,
        status: event.status,
        // Store timezone info for reference
        eventTimezone: event.event_timezone || userTimezone,
      },
    }
  }

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      const calendar = calendarRef.current?.getApi()
      if (!calendar) return

      const view = calendar.view
      const start = view.activeStart.toISOString()
      const end = view.activeEnd.toISOString()

      // Fetch calendar events
      const response = await fetch(`/api/calendar/events?start=${start}&end=${end}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }

      const data = await response.json()
      
      // Filter events based on settings
      let filteredEvents = data.events || []
      
      if (settings?.show_declined_events === false) {
        filteredEvents = filteredEvents.filter((event: any) => event.status !== 'cancelled')
      }
      
      // Format calendar events using user's timezone from settings
      const formattedEvents: EventInput[] = filteredEvents.map((event: any) => 
        formatEventForCalendar(event)
      )

      // Fetch scheduled email campaigns
      try {
        const emailResponse = await fetch(`/api/campaigns?startDate=${start}&endDate=${end}`, {
          credentials: 'include',
        })
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json()
          const emailEvents: EventInput[] = (emailData.campaigns || [])
            .filter((campaign: any) => {
              // Only show scheduled campaigns with start_at
              return campaign.start_at && 
                     campaign.status !== 'cancelled' && 
                     campaign.status !== 'completed'
            })
            .map((campaign: any) => {
              const userTimezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
              const startDate = new Date(campaign.start_at)
              
              // Convert to user's timezone
              const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: userTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
              
              const parts = formatter.formatToParts(startDate)
              const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
              const month = parseInt(parts.find(p => p.type === 'month')?.value || '1')
              const day = parseInt(parts.find(p => p.type === 'day')?.value || '1')
              const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
              const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
              
              const localDate = new Date(year, month - 1, day, hour, minute)
              const endDate = new Date(localDate.getTime() + 30 * 60 * 1000) // 30 min duration
              
              return {
                id: `email-${campaign.id}`,
                title: `📧 ${campaign.name}`,
                start: localDate.toISOString(),
                end: endDate.toISOString(),
                allDay: false,
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                extendedProps: {
                  eventType: 'email_campaign',
                  relatedType: 'campaign',
                  relatedId: campaign.id,
                  description: `Email campaign: ${campaign.name}`,
                  status: campaign.status,
                },
              }
            })
          
          // Combine calendar events and email events
          const allFormattedEvents = [...formattedEvents, ...emailEvents]
          setAllEvents(allFormattedEvents)
          setEvents(allFormattedEvents)
        }
      } catch (emailError) {
        console.error('Error fetching email campaigns:', emailError)
        // If email fetch fails, just use calendar events
        setAllEvents(formattedEvents)
        setEvents(formattedEvents)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }, [settings?.show_declined_events, settings?.color_code_by_event_type, settings?.default_calendar_color, settings?.default_timezone])

  // Filter events based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setEvents(allEvents)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allEvents.filter((event) => {
      const title = event.title?.toLowerCase() || ''
      const description = event.extendedProps?.description?.toLowerCase() || ''
      const location = event.extendedProps?.location?.toLowerCase() || ''
      const eventType = event.extendedProps?.eventType?.toLowerCase() || ''
      
      return (
        title.includes(query) ||
        description.includes(query) ||
        location.includes(query) ||
        eventType.includes(query)
      )
    })

    setEvents(filtered)
    
    if (filtered.length > 0 && calendarRef.current) {
      const firstEvent = filtered[0]
      if (firstEvent.start) {
        calendarRef.current.getApi().gotoDate(new Date(firstEvent.start as string))
      }
    }
  }, [searchQuery, allEvents])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents, view])


  const getEventColor = (eventType?: string): string => {
    const colors: Record<string, string> = {
      call: '#3b82f6',
      visit: '#10b981',
      showing: '#f59e0b',
      content: '#8b5cf6',
      meeting: '#ec4899',
      follow_up: '#6366f1',
      other: '#6b7280',
    }
    return colors[eventType || 'other'] || colors.other
  }

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect(selectInfo.start, selectInfo.end)
    }
    selectInfo.view.calendar.unselect()
  }

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (onEventClick) {
      const event = clickInfo.event
      onEventClick({
        id: event.id,
        title: event.title,
        start: event.start?.toISOString() || '',
        end: event.end?.toISOString() || '',
        allDay: event.allDay,
        backgroundColor: event.backgroundColor,
        borderColor: event.borderColor,
        extendedProps: event.extendedProps as any,
      })
    }
  }

  const handleEventChange = async (changeInfo: EventChangeArg) => {
    try {
      const event = changeInfo.event
      const userTimezone = settings?.default_timezone || 'local'
      
      // Helper to format Date to datetime-local in user's timezone
      const formatToLocalInput = (date: Date | null, tz: string): string => {
        if (!date) return ''
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        const parts = formatter.formatToParts(date)
        const year = parts.find(p => p.type === 'year')?.value || ''
        const month = parts.find(p => p.type === 'month')?.value || ''
        const day = parts.find(p => p.type === 'day')?.value || ''
        const hour = parts.find(p => p.type === 'hour')?.value || '00'
        const minute = parts.find(p => p.type === 'minute')?.value || '00'
        return `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
      }
      
      // FullCalendar provides times in the configured timezone
      // Format as datetime-local in user's timezone for backend conversion
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startTime: formatToLocalInput(event.start, userTimezone),
          endTime: formatToLocalInput(event.end, userTimezone),
          timezone: userTimezone, // Tell backend which timezone to use for conversion
        }),
      })

      if (!response.ok) {
        changeInfo.revert()
        throw new Error('Failed to update event')
      }
    } catch (error) {
      console.error('Error updating event:', error)
      changeInfo.revert()
    }
  }

  const changeView = (newView: typeof view) => {
    setView(newView)
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(newView)
    }
  }

  const goToToday = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today()
      setCurrentDate(new Date())
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (calendarRef.current) {
      const api = calendarRef.current.getApi()
      if (direction === 'prev') {
        api.prev()
      } else {
        api.next()
      }
      setCurrentDate(api.getDate())
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      ) {
        return
      }

      // Today - T
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        e.stopPropagation()
        goToToday()
      } 
      // Previous - ← (Left Arrow)
      else if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        navigateMonth('prev')
      } 
      // Next - → (Right Arrow)
      else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        navigateMonth('next')
      } 
      // Month View - M
      else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        e.stopPropagation()
        changeView('dayGridMonth')
      } 
      // Week View - W
      else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        e.stopPropagation()
        changeView('timeGridWeek')
      } 
      // Day View - D
      else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        e.stopPropagation()
        changeView('timeGridDay')
      } 
      // Search - /
      else if (e.key === '/' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        const calendarSearchInput = document.querySelector('.calendar-search-input') as HTMLInputElement
        if (calendarSearchInput) {
          calendarSearchInput.focus()
          calendarSearchInput.select()
        }
      } 
      // Help - ?
      else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        setShowHelp(true)
      }
    }

    window.addEventListener('keydown', handleKeyPress, true) // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyPress, true)
  }, [goToToday, navigateMonth, changeView]) // Add dependencies

  const getCurrentMonthYear = () => {
    if (calendarRef.current) {
      const api = calendarRef.current.getApi()
      const date = api.getDate()
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Get user timezone - use settings or browser default
  const getUserTimezone = (): string => {
    const tz = settings?.default_timezone
    if (tz && typeof tz === 'string' && tz.length > 0) {
      return tz
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  
  // Memoize timezone to detect changes
  const currentTimezone = getUserTimezone()

  return (
    <div className="flex flex-col h-full min-h-[800px] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={goToToday}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Today
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[180px]">
            {getCurrentMonthYear()}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            {searchQuery ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search calendar events..."
                  className="calendar-search-input px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  const input = document.querySelector('.calendar-search-input') as HTMLInputElement
                  if (input) {
                    input.focus()
                  } else {
                    setSearchQuery('')
                    setTimeout(() => {
                      const newInput = document.querySelector('.calendar-search-input') as HTMLInputElement
                      if (newInput) {
                        newInput.focus()
                      }
                    }, 0)
                  }
                }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="Search calendar events (Press /)"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="Help (Press ?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('openCalendarSettings'))
              }
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* View Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ml-2">
            <button
              onClick={() => changeView('dayGridMonth')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'dayGridMonth'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => changeView('timeGridWeek')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'timeGridWeek'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => changeView('timeGridDay')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'timeGridDay'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => changeView('listWeek')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'listWeek'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              List
            </button>
          </div>

          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Calendar Container */}
      <div className={`flex-1 overflow-auto p-6 bg-white dark:bg-gray-900 calendar-theme-${effectiveCalendarType}`}>
        <style jsx global>{`
          .fc {
            font-family: ${getCalendarFontFamily(effectiveCalendarType)};
          }

          .fc-header-toolbar {
            display: none !important;
          }

          .fc-daygrid-day {
            border-color: ${theme.border};
            transition: background-color 0.2s;
          }

          .fc-daygrid-day:hover {
            background-color: ${effectiveCalendarType === 'google' ? '#f8f9fa' : effectiveCalendarType === 'microsoft365' || effectiveCalendarType === 'outlook' ? '#f3f2f1' : '#f9fafb'};
          }

          .dark .fc-daygrid-day {
            border-color: ${effectiveCalendarType === 'google' ? '#5f6368' : '#374151'};
          }

          .dark .fc-daygrid-day:hover {
            background-color: ${effectiveCalendarType === 'google' ? '#202124' : '#1f2937'};
          }

          .fc-daygrid-day-number {
            padding: 8px;
            color: ${theme.headerText};
            font-weight: ${effectiveCalendarType === 'google' ? 400 : 500};
            font-size: 14px;
          }

          .dark .fc-daygrid-day-number {
            color: ${effectiveCalendarType === 'google' ? '#e8eaed' : '#d1d5db'};
          }

          .fc-day-today {
            background-color: ${theme.todayBg} !important;
          }

          .dark .fc-day-today {
            background-color: ${effectiveCalendarType === 'google' ? '#1e3a8a' : '#1e3a8a'} !important;
          }

          .fc-day-today .fc-daygrid-day-number {
            background-color: ${theme.primary};
            color: white;
            border-radius: 50%;
            width: ${effectiveCalendarType === 'google' ? '28px' : '32px'};
            height: ${effectiveCalendarType === 'google' ? '28px' : '32px'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: ${effectiveCalendarType === 'google' ? 500 : 600};
          }

          .fc-daygrid-day.fc-day-other {
            opacity: 0.4;
          }

          .fc-col-header-cell {
            padding: 12px 8px;
            background-color: ${theme.headerBg};
            border-color: ${theme.border};
            font-weight: ${effectiveCalendarType === 'google' ? 500 : 600};
            font-size: ${effectiveCalendarType === 'google' ? '11px' : '12px'};
            text-transform: ${effectiveCalendarType === 'google' ? 'none' : 'uppercase'};
            letter-spacing: ${effectiveCalendarType === 'google' ? '0' : '0.05em'};
            color: ${theme.headerText};
          }

          .dark .fc-col-header-cell {
            background-color: ${effectiveCalendarType === 'google' ? '#202124' : '#111827'};
            border-color: ${effectiveCalendarType === 'google' ? '#5f6368' : '#374151'};
            color: ${effectiveCalendarType === 'google' ? '#9aa0a6' : '#9ca3af'};
          }

          .fc-event {
            border-radius: ${theme.eventBorderRadius};
            border: none;
            padding: ${effectiveCalendarType === 'google' ? '2px 6px' : '1px 4px'};
            font-size: ${effectiveCalendarType === 'google' ? '12px' : '11px'};
            font-weight: ${effectiveCalendarType === 'google' ? 400 : 500};
            margin: 1px 0;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: ${theme.eventShadow};
          }

          .fc-event:hover {
            transform: translateY(-1px);
            box-shadow: ${effectiveCalendarType === 'google' 
              ? '0 2px 4px rgba(60, 64, 67, 0.4)' 
              : effectiveCalendarType === 'microsoft365' || effectiveCalendarType === 'outlook'
              ? '0 3.2px 7.2px rgba(0, 0, 0, 0.18), 0 0.6px 1.8px rgba(0, 0, 0, 0.13)'
              : '0 2px 4px rgba(0, 0, 0, 0.15)'};
            z-index: 10;
          }

          .fc-event-title {
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .fc-timegrid-slot {
            border-color: ${theme.border};
            height: ${effectiveCalendarType === 'google' ? '52px' : '48px'};
          }

          .dark .fc-timegrid-slot {
            border-color: ${effectiveCalendarType === 'google' ? '#5f6368' : '#374151'};
          }

          .fc-timegrid-now-indicator-line {
            border-color: #ef4444;
            border-width: 2px;
          }

          .fc-timegrid-col {
            border-color: ${theme.border};
          }

          .dark .fc-timegrid-col {
            border-color: ${effectiveCalendarType === 'google' ? '#5f6368' : '#374151'};
          }

          .fc-list-day-cushion {
            background-color: ${theme.headerBg};
            padding: 8px 12px;
            font-weight: ${effectiveCalendarType === 'google' ? 500 : 600};
            font-size: ${effectiveCalendarType === 'google' ? '14px' : '13px'};
            color: ${theme.headerText};
          }

          .dark .fc-list-day-cushion {
            background-color: ${effectiveCalendarType === 'google' ? '#202124' : '#111827'};
            color: ${effectiveCalendarType === 'google' ? '#e8eaed' : '#d1d5db'};
          }

          .fc-list-event {
            padding: 10px 12px;
            border-left: 3px solid;
            margin-bottom: 4px;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .fc-list-event:hover {
            background-color: #f9fafb;
            transform: translateX(2px);
          }

          .dark .fc-list-event:hover {
            background-color: #1f2937;
          }

          .fc-button {
            display: none !important;
          }

          .fc-scrollgrid {
            border: none;
          }

          .fc-scrollgrid-section-header {
            border: none;
          }

          .fc-scrollgrid-section-body {
            border: none;
          }

          .fc-daygrid-event {
            animation: fadeIn 0.3s ease-in;
            font-size: 11px;
            padding: 1px 4px;
            line-height: 1.2;
          }

          .fc-daygrid-event-dot {
            width: 6px;
            height: 6px;
            margin-right: 4px;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .fc-loading {
            opacity: 0.6;
          }

          .fc-view-harness-compact .fc-daygrid-day {
            min-height: 60px;
          }

          .fc-view-harness-compact .fc-daygrid-day-number {
            padding: 4px;
            font-size: 12px;
          }

          .fc-view-harness-compact .fc-event {
            font-size: 11px;
            padding: 1px 4px;
          }

          .fc-view-harness-compact .fc-timegrid-slot {
            height: 36px;
          }

          .fc-view-harness-comfortable .fc-daygrid-day {
            min-height: 100px;
          }

          [data-color-code="false"] .fc-event {
            background-color: var(--default-calendar-color, #3b82f6) !important;
            border-color: var(--default-calendar-color, #3b82f6) !important;
          }

          .fc-event[data-status="cancelled"] {
            opacity: 0.5;
            text-decoration: line-through;
          }
        `}</style>
        
        <div className={settings?.view_density === 'compact' ? 'fc-view-harness-compact' : 'fc-view-harness-comfortable'}>
          {/* Wait for settings to load before rendering calendar with correct timezone */}
          {!settingsLoaded ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-500">Loading calendar...</span>
              </div>
            </div>
          ) : (
          <FullCalendar
            key={`calendar-${currentTimezone}`}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={view}
            headerToolbar={false}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={settings?.show_weekends !== false}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventChange={handleEventChange}
            height="100%"
            contentHeight="auto"
            eventDisplay="block"
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={true}
            nowIndicator={true}
            locale="en"
            firstDay={0}
            // Set to 'local' since we've already converted times to user's timezone
            // FullCalendar will display times as-is (already in user's timezone)
            timeZone="local"
            // List view configuration - ensures times display in user's timezone
            listDayFormat={{ 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            }}
            listDaySideFormat={{ 
              weekday: 'short' 
            }}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: '09:00',
              endTime: '17:00',
            }}
            dayHeaderFormat={{ weekday: 'short' }}
            dayHeaderContent={(args) => {
              return args.text.toUpperCase()
            }}
            loading={(isLoading) => {
              setLoading(isLoading)
            }}
            eventDidMount={(info) => {
              if (settings?.color_code_by_event_type === false) {
                const defaultColor = settings?.default_calendar_color || '#3b82f6'
                info.event.setProp('backgroundColor', defaultColor)
                info.event.setProp('borderColor', defaultColor)
              }
              
              if (info.event.extendedProps.status === 'cancelled') {
                info.el.style.opacity = '0.5'
                info.el.style.textDecoration = 'line-through'
                info.el.setAttribute('data-status', 'cancelled')
              }
            }}
          />
          )}
        </div>
      </div>

      <CalendarHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
