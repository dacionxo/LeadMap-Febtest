'use client'

import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { EventInput, DateSelectArg, EventClickArg, EventChangeArg } from '@fullcalendar/core'
import { Calendar, Plus, Settings, RefreshCw } from 'lucide-react'

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
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'>('dayGridMonth')
  const calendarRef = useRef<FullCalendar>(null)

  // Fetch events
  const fetchEvents = async () => {
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
  }

  useEffect(() => {
    fetchEvents()
  }, [view])

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
    // Clear selection
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
        // Revert on error
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calendar</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Buttons */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => changeView('dayGridMonth')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                view === 'dayGridMonth'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => changeView('timeGridWeek')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                view === 'timeGridWeek'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => changeView('timeGridDay')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                view === 'timeGridDay'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => changeView('listWeek')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
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
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 overflow-auto">
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
          weekends={true}
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
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '17:00',
          }}
        />
      </div>
    </div>
  )
}

