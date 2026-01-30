'use client'

import { Card } from '@/app/components/ui/card'
import { RefreshCw } from 'lucide-react'
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

  // Calendar always starts on month view (user can switch via toolbar)

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

  // Format event for react-big-calendar; event type drives display color when color_code_by_event_type is on
  const formatEventForCalendar = (event: any): CalendarEvent => {
    const userTimezone = settings?.default_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    
    let eventColor: string
    if (settings?.color_code_by_event_type !== false) {
      eventColor = getEventColor(event.event_type)
    } else {
      eventColor = event.color || settings?.default_calendar_color || '#3b82f6'
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

  // Custom event component: title on left, time on right
  const EventComponent = ({ event: evt }: { event: CalendarEvent }) => (
    <div className="rbc-event-content flex items-center justify-between gap-2 w-full overflow-hidden">
      <span className="rbc-event-label truncate flex-1 min-w-0" title={evt.title}>
        {evt.title}
      </span>
      {!evt.allDay && (
        <span className="rbc-event-time flex-shrink-0 text-right whitespace-nowrap">
          {moment(evt.start).format('h:mm A')} – {moment(evt.end).format('h:mm A')}
        </span>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full w-full min-h-0 m-0 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Calendar Container — 90% size, centered */}
      <div className="flex-1 min-h-0 overflow-auto m-0 bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="w-[90%] h-[90%] min-h-[360px] min-w-0">
          <Card className="h-full min-h-[360px] m-0 p-0">
            <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%', minHeight: '360px' }}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            eventPropGetter={eventStyleGetter}
            components={{ event: EventComponent }}
            defaultDate={new Date()}
            scrollToTime={new Date(1970, 1, 1, 6)}
            showMultiDayTimes
            step={15}
            timeslots={2}
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
      </div>

      <CalendarHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
