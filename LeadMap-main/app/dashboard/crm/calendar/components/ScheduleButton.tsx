'use client'

import { useState } from 'react'
import { Calendar, Phone, MapPin } from 'lucide-react'
import CreateEventModal from './CreateEventModal'

interface ScheduleButtonProps {
  relatedType: 'contact' | 'deal' | 'listing' | 'property' | 'lead'
  relatedId: string
  relatedName?: string
  eventType?: 'call' | 'visit' | 'showing' | 'meeting'
  variant?: 'button' | 'icon'
  className?: string
}

export default function ScheduleButton({
  relatedType,
  relatedId,
  relatedName,
  eventType = 'call',
  variant = 'button',
  className = '',
}: ScheduleButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const getEventTypeLabel = () => {
    const labels: Record<string, string> = {
      call: 'Schedule Call',
      visit: 'Schedule Visit',
      showing: 'Schedule Showing',
      meeting: 'Schedule Meeting',
    }
    return labels[eventType] || 'Schedule Event'
  }

  const getEventTypeIcon = () => {
    switch (eventType) {
      case 'call':
        return <Phone className="w-4 h-4" />
      case 'visit':
      case 'showing':
        return <MapPin className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className={`p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors ${className}`}
          title={getEventTypeLabel()}
        >
          {getEventTypeIcon()}
        </button>
        <CreateEventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          relatedType={relatedType}
          relatedId={relatedId}
          defaultEventType={eventType}
          onSuccess={() => {
            setIsModalOpen(false)
            // Optionally show success message or refresh
          }}
        />
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors ${className}`}
      >
        {getEventTypeIcon()}
        <span>{getEventTypeLabel()}</span>
      </button>
      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        relatedType={relatedType}
        relatedId={relatedId}
        defaultEventType={eventType}
        onSuccess={() => {
          setIsModalOpen(false)
        }}
      />
    </>
  )
}

