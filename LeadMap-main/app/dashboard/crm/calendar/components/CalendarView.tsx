'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { EventInput, DateSelectArg, EventClickArg, EventChangeArg } from '@fullcalendar/core'
import { Calendar, Plus, Settings, RefreshCw, ChevronLeft, ChevronRight, Search, HelpCircle, Grid3x3, Check } from 'lucide-react'

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
}

export default function CalendarView({ onEventClick, onDateSelect }: CalendarViewProps) {
  const [events, setEvents] = useState<EventInput[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'>('dayGridMonth')
  const [currentDate, setCurrentDate] = useState(new Date())
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

  // Apply default view from settings on initial load
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

      const response = await fetch(`/api/calendar/events?start=${start}&end=${end}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }

      const data = await response.json()
      const formattedEvents: EventInput[] = (data.events || []).map((event: any) => ({
        id: event.id,
        title: event.title,
        start: event.start_time,
        end: event.end_time,
        allDay: event.all_day,
        backgroundColor: event.color || getEventColor(event.event_type),
        borderColor: event.color || getEventColor(event.event_type),
        extendedProps: {
          eventType: event.event_type,
          location: event.location,
          description: event.description,
          relatedType: event.related_type,
          relatedId: event.related_id,
        },
      }))

      setEvents(formattedEvents)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents, view])

  const getEventColor = (eventType?: string): string => {
    const colors: Record<string, string> = {
      call: '#3b82f6', // Blue
      visit: '#10b981', // Green
      showing: '#f59e0b', // Amber
      content: '#8b5cf6', // Purple
      meeting: '#ec4899', // Pink
      follow_up: '#6366f1', // Indigo
      other: '#6b7280', // Gray
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
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startTime: event.start?.toISOString(),
          endTime: event.end?.toISOString(),
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

  const getCurrentMonthYear = () => {
    if (calendarRef.current) {
      const api = calendarRef.current.getApi()
      const date = api.getDate()
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Modern Header - Matching Reference Image */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        {/* Left: Today & Navigation */}
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

        {/* Right: Actions & View Selector */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <Search className="w-4 h-4" />
          </button>
          
          {/* Help */}
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
          
          {/* Settings */}
          <button
            onClick={() => {
              // This will be handled by parent component
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

          {/* Calendar Icon */}
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors ml-2">
            <Calendar className="w-4 h-4" />
          </button>

          {/* Check Icon */}
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <Check className="w-4 h-4" />
          </button>

          {/* Grid Icon */}
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <Grid3x3 className="w-4 h-4" />
          </button>

          {/* Refresh */}
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
      <div className="flex-1 overflow-auto p-6 bg-white dark:bg-gray-900">
        <style jsx global>{`
          /* FullCalendar Custom Styling - High-Tech Look */
          .fc {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
          }

          .fc-header-toolbar {
            display: none !important;
          }

          .fc-daygrid-day {
            border-color: #e5e7eb;
            transition: background-color 0.2s;
          }

          .fc-daygrid-day:hover {
            background-color: #f9fafb;
          }

          .dark .fc-daygrid-day {
            border-color: #374151;
          }

          .dark .fc-daygrid-day:hover {
            background-color: #1f2937;
          }

          .fc-daygrid-day-number {
            padding: 8px;
            color: #374151;
            font-weight: 500;
            font-size: 14px;
          }

          .dark .fc-daygrid-day-number {
            color: #d1d5db;
          }

          .fc-day-today {
            background-color: #eff6ff !important;
          }

          .dark .fc-day-today {
            background-color: #1e3a8a !important;
          }

          .fc-day-today .fc-daygrid-day-number {
            background-color: #3b82f6;
            color: white;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
          }

          .fc-daygrid-day.fc-day-other {
            opacity: 0.4;
          }

          .fc-col-header-cell {
            padding: 12px 8px;
            background-color: #f9fafb;
            border-color: #e5e7eb;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
          }

          .dark .fc-col-header-cell {
            background-color: #111827;
            border-color: #374151;
            color: #9ca3af;
          }

          .fc-event {
            border-radius: 4px;
            border: none;
            padding: 2px 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          }

          .fc-event:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
            z-index: 10;
          }

          .fc-event-title {
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .fc-timegrid-slot {
            border-color: #f3f4f6;
            height: 48px;
          }

          .dark .fc-timegrid-slot {
            border-color: #374151;
          }

          .fc-timegrid-now-indicator-line {
            border-color: #ef4444;
            border-width: 2px;
          }

          .fc-timegrid-col {
            border-color: #e5e7eb;
          }

          .dark .fc-timegrid-col {
            border-color: #374151;
          }

          .fc-list-day-cushion {
            background-color: #f9fafb;
            padding: 8px 12px;
            font-weight: 600;
            font-size: 13px;
            color: #374151;
          }

          .dark .fc-list-day-cushion {
            background-color: #111827;
            color: #d1d5db;
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

          /* Smooth animations */
          .fc-daygrid-event {
            animation: fadeIn 0.3s ease-in;
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

          /* Loading state */
          .fc-loading {
            opacity: 0.6;
          }

          /* View Density - Compact */
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

          /* View Density - Comfortable (default) */
          .fc-view-harness-comfortable .fc-daygrid-day {
            min-height: 100px;
          }
        `}</style>
        
        <div className={settings?.view_density === 'compact' ? 'fc-view-harness-compact' : 'fc-view-harness-comfortable'}>
          <FullCalendar
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
            height="auto"
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
            timeZone={settings?.default_timezone || 'local'}
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
          />
        </div>
      </div>
    </div>
  )
}
