'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import CalendarView from './components/CalendarView'
import EventModal from './components/EventModal'
import CreateEventModal from './components/CreateEventModal'
import CalendarSettingsPanel from './components/CalendarSettingsPanel'
import { Plus } from 'lucide-react'

export default function CalendarPage() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date | undefined>()
  const [createModalEndDate, setCreateModalEndDate] = useState<Date | undefined>()

  // Listen for settings open event
  useEffect(() => {
    const handleOpenSettings = () => {
      setIsSettingsOpen(true)
    }

    window.addEventListener('openCalendarSettings', handleOpenSettings)
    return () => {
      window.removeEventListener('openCalendarSettings', handleOpenSettings)
    }
  }, [])

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
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Floating Action Button */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="fixed bottom-8 right-8 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
          title="Create New Event"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* Calendar Container */}
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

        {/* Calendar Settings Panel */}
        <CalendarSettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </DashboardLayout>
  )
}

