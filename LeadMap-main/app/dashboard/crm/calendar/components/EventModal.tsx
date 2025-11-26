'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, MapPin, Users, Tag, FileText } from 'lucide-react'

interface EventModalProps {
  event: {
    id: string
    title: string
    start: string
    end: string
    allDay?: boolean
    extendedProps?: {
      eventType?: string
      location?: string
      description?: string
      relatedType?: string
      relatedId?: string
    }
  } | null
  onClose: () => void
  onEdit?: (eventId: string) => void
  onDelete?: (eventId: string) => void
}

export default function EventModal({ event, onClose, onEdit, onDelete }: EventModalProps) {
  if (!event) return null

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getEventTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      call: 'Phone Call',
      visit: 'Property Visit',
      showing: 'Property Showing',
      content: 'Content Post',
      meeting: 'Meeting',
      follow_up: 'Follow-up',
      other: 'Other',
    }
    return labels[type || 'other'] || 'Other'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{event.title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Event Type */}
          {event.extendedProps?.eventType && (
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {getEventTypeLabel(event.extendedProps.eventType)}
              </span>
            </div>
          )}

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Date & Time</span>
            </div>
            <div className="pl-6 space-y-1">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(event.start)}
              </div>
              {!event.allDay && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    {formatTime(event.start)} - {formatTime(event.end)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {event.extendedProps?.location && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Location</span>
              </div>
              <div className="pl-6 text-sm text-gray-600 dark:text-gray-400">
                {event.extendedProps.location}
              </div>
            </div>
          )}

          {/* Description */}
          {event.extendedProps?.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Description</span>
              </div>
              <div className="pl-6 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {event.extendedProps.description}
              </div>
            </div>
          )}

          {/* Related Entity */}
          {event.extendedProps?.relatedType && event.extendedProps?.relatedId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Related to</span>
              </div>
              <div className="pl-6 text-sm text-gray-600 dark:text-gray-400 capitalize">
                {event.extendedProps.relatedType}: {event.extendedProps.relatedId}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this event?')) {
                  onDelete(event.id)
                  onClose()
                }
              }}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => {
                onEdit(event.id)
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

