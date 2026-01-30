'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSidebar } from '../../components/SidebarContext'
import CalendarView from './components/CalendarView'
import CalendarOnboardingView from './components/CalendarOnboardingView'
import EventModal from './components/EventModal'
import CreateEventModal from './components/CreateEventModal'
import CalendarSettingsPanel from './components/CalendarSettingsPanel'
import ConnectCalendarModal from './components/ConnectCalendarModal'

/** Calendar content: full-bleed under navbar, must be inside DashboardLayout (useSidebar). */
function CalendarPageContent() {
  const { isOpen: isSidebarOpen } = useSidebar()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isConnectCalendarModalOpen, setIsConnectCalendarModalOpen] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date | undefined>()
  const [createModalEndDate, setCreateModalEndDate] = useState<Date | undefined>()
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null) // null = loading
  const [calendarType, setCalendarType] = useState<string | null>(null) // 'native', 'google', 'microsoft365', 'outlook', 'exchange', or null

  // Check onboarding status from user settings
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch('/api/calendar/settings', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          // Show onboarding if user hasn't completed it
          // onboarding_complete defaults to false for new users
          const onboardingComplete = data.settings?.calendar_onboarding_complete ?? false
          const calType = data.settings?.calendar_type ?? null
          setShowOnboarding(!onboardingComplete)
          setCalendarType(calType)
        } else {
          // If settings don't exist yet, show onboarding (new user)
          setShowOnboarding(true)
          setCalendarType(null)
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        // Default to showing onboarding on error (safer for new users)
        setShowOnboarding(true)
      }
    }
    checkOnboardingStatus()

    // When user returns from Google OAuth with calendar_connected: sync events into user calendar, then refresh
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('calendar_connected')) {
      checkOnboardingStatus()
      // Trigger manual sync so Google events import into user calendar (safety net if callback sync timed out)
      fetch('/api/calendar/sync/manual', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
        .then((res) => {
          if (res.ok) {
            window.dispatchEvent(new CustomEvent('calendarSyncComplete'))
          }
        })
        .catch((err) => console.error('Calendar sync after connect:', err))
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname)
        })
    }
  }, [])

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

  // Listen for settings updates to check onboarding status
  useEffect(() => {
    const handleSettingsUpdate = (event: CustomEvent) => {
      const settings = event.detail
      if (settings) {
        const onboardingComplete = settings.calendar_onboarding_complete ?? false
        const calType = settings.calendar_type ?? null
        setShowOnboarding(!onboardingComplete)
        setCalendarType(calType)
      }
    }

    window.addEventListener('calendarSettingsUpdated', handleSettingsUpdate as EventListener)
    return () => {
      window.removeEventListener('calendarSettingsUpdated', handleSettingsUpdate as EventListener)
    }
  }, [])

  const handleEventClick = (event: any) => {
    setSelectedEvent(event)
  }

  const handleDateSelect = (start: Date, end: Date) => {
    // Default action: create calendar event (no confirmation needed)
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

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  const handleEventEdit = (eventId: string) => {
    setEditingEventId(eventId)
    setIsEditModalOpen(true)
  }

  const handleOnboardingDateSelect = (date: Date, time: string) => {
    setCreateModalDate(date)
    // Calculate end time (default 30 minutes)
    const endDate = new Date(date)
    endDate.setMinutes(endDate.getMinutes() + 30)
    setCreateModalEndDate(endDate)
    setIsCreateModalOpen(true)
  }

  const handleConnectCalendar = () => {
    // Open the connect calendar modal
    setIsConnectCalendarModalOpen(true)
  }

  // Note: handleCalendarConnected is no longer needed as OAuth callback handles it
  // This function is kept for backward compatibility but won't be called
  const handleCalendarConnected = async (email: string) => {
    // OAuth flow now handles this automatically
    console.log('Calendar connection initiated for:', email)
  }

  const handleUseNativeCalendar = async () => {
    try {
      // Mark onboarding as complete and set calendar type to 'native' when user chooses native calendar
      const response = await fetch('/api/calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          calendar_onboarding_complete: true,
          calendar_type: 'native',
        }),
      })

      if (response.ok) {
        // Update local state to show the FullCalendar view
        setShowOnboarding(false)
        setCalendarType('native')
        console.log('User chose to use native calendar (FullCalendar)')
      } else {
        console.error('Failed to mark onboarding as complete')
      }
    } catch (error) {
      console.error('Error marking onboarding as complete:', error)
    }
  }

  const handleEventCreated = () => {
    // After event is created, refresh the page
    window.location.reload()
  }

  return (
    <div className="-mt-[10px]">
      {/* Fixed full-bleed: top under navbar, bottom to window, left/right to window edges (like deals) */}
      <div
        className="fixed top-[50px] bottom-0 flex flex-col bg-slate-50 dark:bg-gray-900 transition-all duration-300"
        style={{ left: isSidebarOpen ? '274px' : '79px', right: 0 }}
      >
        <div className="h-px w-full shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden="true" role="separator" />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-[84px] pt-[84px] pb-[30px]">
          {showOnboarding === null ? (
            <div className="flex items-center justify-center flex-1">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Loading calendar...</span>
              </div>
            </div>
          ) : showOnboarding ? (
            <CalendarOnboardingView
              onDateSelect={handleOnboardingDateSelect}
              onConnectCalendar={handleConnectCalendar}
            />
          ) : (
            <CalendarView
              onEventClick={handleEventClick}
              onDateSelect={handleDateSelect}
              calendarType={calendarType}
            />
          )}
        </div>
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
        onSuccess={handleEventCreated}
      />

      {/* Edit Event Modal */}
      <CreateEventModal
        isOpen={isEditModalOpen}
        eventId={editingEventId || undefined}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingEventId(null)
        }}
        onSuccess={() => {
          window.location.reload()
        }}
      />

      {/* Calendar Settings Panel */}
      <CalendarSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false)
          const checkOnboarding = async () => {
            try {
              const response = await fetch('/api/calendar/settings', { credentials: 'include' })
              if (response.ok) {
                const data = await response.json()
                const onboardingComplete = data.settings?.calendar_onboarding_complete ?? false
                setShowOnboarding(!onboardingComplete)
              }
            } catch (error) {
              console.error('Error checking onboarding status:', error)
            }
          }
          checkOnboarding()
        }}
      />

      {/* Connect Calendar Modal */}
      <ConnectCalendarModal
        isOpen={isConnectCalendarModalOpen}
        onClose={() => setIsConnectCalendarModalOpen(false)}
        onConnect={handleCalendarConnected}
        onUseNative={handleUseNativeCalendar}
      />
    </div>
  )
}

export default function CalendarPage() {
  return (
    <DashboardLayout>
      <CalendarPageContent />
    </DashboardLayout>
  )
}

