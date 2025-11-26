'use client'

import { useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import CalendarView from './components/CalendarView'
import EventModal from './components/EventModal'
import CreateEventModal from './components/CreateEventModal'
import { Plus } from 'lucide-react'

export default function CalendarPage() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date | undefined>()
  const [createModalEndDate, setCreateModalEndDate] = useState<Date | undefined>()

  const handleEventClick = (event: any) => {
    setSelectedEvent(event)
  }

  const handleDateSelect = (start: Date, end: Date) => {
    setCreateModalDate(start)
    setCreateModalEndDate(end)
    setIsCreateModalOpen(true)
  }

  const handleEventDelete = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete event')
      }

      // Refresh calendar
      window.location.reload()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event')
    }
  }

  const handleEventEdit = (eventId: string) => {
    // TODO: Implement edit functionality
    console.log('Edit event:', eventId)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Calendar</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Schedule property viewings, meetings, and follow-ups
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
        
        <div className="flex-1 min-h-0">
          <CalendarView
            onEventClick={handleEventClick}
            onDateSelect={handleDateSelect}
          />
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <EventModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onEdit={handleEventEdit}
            onDelete={handleEventDelete}
          />
        )}

        {/* Create Event Modal */}
        <CreateEventModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false)
            setCreateModalDate(undefined)
            setCreateModalEndDate(undefined)
          }}
          initialDate={createModalDate}
          initialEndDate={createModalEndDate}
          onSuccess={() => {
            window.location.reload()
          }}
        />
      </div>
    </DashboardLayout>
  )
}

