'use client'

import { Card } from '@/app/components/ui/card'
import { ChevronLeft, ChevronRight, HelpCircle, RefreshCw, Search, Settings, X } from 'lucide-react'
import moment from 'moment'
import { useCallback, useEffect, useState } from 'react'
import { Calendar, momentLocalizer, SlotInfo, View } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import CalendarHelpModal from './CalendarHelpModal'

moment.locale('en')
const localizer = momentLocalizer(moment)

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  resource?: {
    eventType?: string
    location?: string
    description?: string
    relatedType?: string
    relatedId?: string
    status?: string
    backgroundColor?: string
    borderColor?: string
  }
}

interface CalendarViewProps {
  onEventClick?: (event: {
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
      status?: string
    }
  }) => void
  onDateSelect?: (start: Date, end: Date) => void
  calendarType?: string | null
}

export default function CalendarView({ onEventClick, onDateSelect, calendarType }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [view, setView] = useState<View>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)

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
    if (settings?.default_view) {
      const viewMap: Record<string, View> = {
        month: 'month',
        week: 'week',
        day: 'day',
        agenda: 'agenda',
      }
      const mappedView = viewMap[settings.default_view] || 'month'
      setView(mappedView)
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

  // Format event for react-big-calendar
  const formatEventForCalendar = (event: any): CalendarEvent => {
    const userTimezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    
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
      const startDate = new Date(event.start_date)
      const endDate = new Date(event.end_date)
      endDate.setDate(endDate.getDate() + 1) // Exclusive end date
      
      return {
        id: event.id,
        title: event.title,
        start: startDate,
        end: endDate,
        allDay: true,
        resource: {
          eventType: event.event_type,
          location: event.location,
          description: event.description,
          relatedType: event.related_type,
          relatedId: event.related_id,
          status: event.status,
          backgroundColor: eventColor,
          borderColor: eventColor,
        },
      }
    }

    // Timed events: Convert UTC to user's timezone
    let startTime = event.start_time || ''
    let endTime = event.end_time || ''
    
    const convertUtcToUserTimezone = (utcIsoString: string, tz: string): Date => {
      if (!utcIsoString) return new Date()
      
      const utcDate = new Date(utcIsoString)
      if (isNaN(utcDate.getTime())) {
        if (!utcIsoString.endsWith('Z') && !utcIsoString.match(/[+-]\d{2}:\d{2}$/)) {
          const fixed = utcIsoString + (utcIsoString.includes('.') ? '' : '.000') + 'Z'
          const fixedDate = new Date(fixed)
          if (!isNaN(fixedDate.getTime())) {
            return convertUtcToUserTimezone(fixed, tz)
          }
        }
        return new Date()
      }
      
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
      
      return new Date(year, month - 1, day, hour, minute, second)
    }
    
    const startDate = convertUtcToUserTimezone(startTime, userTimezone)
    const endDate = convertUtcToUserTimezone(endTime, userTimezone)
    
    return {
      id: event.id,
      title: event.title,
      start: startDate,
      end: endDate,
      allDay: false,
      resource: {
        eventType: event.event_type,
        location: event.location,
        description: event.description,
        relatedType: event.related_type,
        relatedId: event.related_id,
        status: event.status,
        backgroundColor: eventColor,
        borderColor: eventColor,
      },
    }
  }

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      
      // Get current view date range
      const viewStart = moment(currentDate).startOf(view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate()
      const viewEnd = moment(currentDate).endOf(view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toDate()
      
      const start = viewStart.toISOString()
      const end = viewEnd.toISOString()

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
      
      // Format calendar events
      const formattedEvents: CalendarEvent[] = filteredEvents.map((event: any) => 
        formatEventForCalendar(event)
      )

      // Fetch scheduled email campaigns
      try {
        const emailResponse = await fetch(`/api/campaigns?startDate=${start}&endDate=${end}`, {
          credentials: 'include',
        })
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json()
          const emailEvents: CalendarEvent[] = (emailData.campaigns || [])
            .filter((campaign: any) => {
              return campaign.start_at && 
                     campaign.status !== 'cancelled' && 
                     campaign.status !== 'completed'
            })
            .map((campaign: any) => {
              const userTimezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
              const startDate = new Date(campaign.start_at)
              
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
              const endDate = new Date(localDate.getTime() + 30 * 60 * 1000)
              
              return {
                id: `email-${campaign.id}`,
                title: `📧 ${campaign.name}`,
                start: localDate,
                end: endDate,
                allDay: false,
                resource: {
                  eventType: 'email_campaign',
                  relatedType: 'campaign',
                  relatedId: campaign.id,
                  description: `Email campaign: ${campaign.name}`,
                  status: campaign.status,
                  backgroundColor: '#3b82f6',
                  borderColor: '#2563eb',
                },
              }
            })
          
          const allFormattedEvents = [...formattedEvents, ...emailEvents]
          setAllEvents(allFormattedEvents)
          setEvents(allFormattedEvents)
        }
      } catch (emailError) {
        console.error('Error fetching email campaigns:', emailError)
        setAllEvents(formattedEvents)
        setEvents(formattedEvents)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }, [currentDate, view, settings?.show_declined_events, settings?.color_code_by_event_type, settings?.default_calendar_color, settings?.default_timezone])

  // Filter events based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setEvents(allEvents)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allEvents.filter((event) => {
      const title = event.title?.toLowerCase() || ''
      const description = event.resource?.description?.toLowerCase() || ''
      const location = event.resource?.location?.toLowerCase() || ''
      const eventType = event.resource?.eventType?.toLowerCase() || ''
      
      return (
        title.includes(query) ||
        description.includes(query) ||
        location.includes(query) ||
        eventType.includes(query)
      )
    })

    setEvents(filtered)
  }, [searchQuery, allEvents])

  useEffect(() => {
    if (settingsLoaded) {
      fetchEvents()
    }
  }, [fetchEvents, settingsLoaded])

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    if (onDateSelect) {
      onDateSelect(slotInfo.start, slotInfo.end)
    }
  }

  const handleSelectEvent = (event: CalendarEvent) => {
    if (onEventClick) {
      // Convert to format expected by EventModal
      onEventClick({
        id: event.id,
        title: event.title,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        allDay: event.allDay,
        backgroundColor: event.resource?.backgroundColor,
        borderColor: event.resource?.borderColor,
        extendedProps: {
          eventType: event.resource?.eventType,
          location: event.resource?.location,
          description: event.resource?.description,
          relatedType: event.resource?.relatedType,
          relatedId: event.resource?.relatedId,
          status: event.resource?.status,
        },
      } as any)
    }
  }

  const eventStyleGetter = (event: CalendarEvent) => {
    const backgroundColor = event.resource?.backgroundColor || '#3b82f6'
    const borderColor = event.resource?.borderColor || '#2563eb'
    const isCancelled = event.resource?.status === 'cancelled'
    
    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth: '2px',
        borderRadius: '4px',
        opacity: isCancelled ? 0.5 : 1,
        textDecoration: isCancelled ? 'line-through' : 'none',
        color: '#fff',
        padding: '2px 6px',
      },
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = moment(currentDate)
    if (view === 'month') {
      newDate.add(direction === 'next' ? 1 : -1, 'month')
    } else if (view === 'week') {
      newDate.add(direction === 'next' ? 1 : -1, 'week')
    } else {
      newDate.add(direction === 'next' ? 1 : -1, 'day')
    }
    setCurrentDate(newDate.toDate())
  }

  const changeView = (newView: View) => {
    setView(newView)
  }

  const getCurrentMonthYear = () => {
    return moment(currentDate).format('MMMM YYYY')
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
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

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        goToToday()
      } else if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        navigateDate('prev')
      } else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        navigateDate('next')
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        changeView('month')
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        changeView('week')
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        changeView('day')
      } else if (e.key === '/' && !e.shiftKey) {
        e.preventDefault()
        const calendarSearchInput = document.querySelector('.calendar-search-input') as HTMLInputElement
        if (calendarSearchInput) {
          calendarSearchInput.focus()
          calendarSearchInput.select()
        }
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShowHelp(true)
      }
    }

    window.addEventListener('keydown', handleKeyPress, true)
    return () => window.removeEventListener('keydown', handleKeyPress, true)
  }, [goToToday, navigateDate, changeView])

  const handleSync = async () => {
    try {
      const response = await fetch('/api/calendar/sync/manual', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to sync calendars')
      }

      setTimeout(() => {
        fetchEvents()
      }, 1000)
    } catch (error) {
      console.error('Error syncing calendars:', error)
    }
  }

  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500">Loading calendar...</span>
        </div>
      </div>
    )
  }

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
              onClick={() => navigateDate('prev')}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateDate('next')}
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
              onClick={() => changeView('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'month'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => changeView('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'week'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => changeView('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'day'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => changeView('agenda')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                view === 'agenda'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Agenda
            </button>
          </div>

          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
            title="Refresh events"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSync}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="Sync calendars"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        <Card className="min-h-[900px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%', minHeight: '900px' }}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            eventPropGetter={eventStyleGetter}
            defaultDate={new Date()}
            scrollToTime={new Date(1970, 1, 1, 6)}
            showMultiDayTimes
            step={60}
            timeslots={1}
            formats={{
              dayFormat: 'ddd M/D',
              dayHeaderFormat: 'ddd M/D',
              dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
                `${moment(start).format('MMM D')} - ${moment(end).format('MMM D, YYYY')}`,
              timeGutterFormat: 'h:mm A',
              eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
                `${moment(start).format('h:mm A')} - ${moment(end).format('h:mm A')}`,
            } as any}
          />
        </Card>
      </div>

      <CalendarHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
