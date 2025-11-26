'use client'

import { X, Calendar, Clock, MapPin, Users, Bell, Settings, Search, MousePointerClick, Drag } from 'lucide-react'

interface CalendarHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CalendarHelpModal({ isOpen, onClose }: CalendarHelpModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar Help</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Getting Started */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Getting Started
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Click on any date to create a new event</p>
              <p>• Click on an existing event to view or edit details</p>
              <p>• Drag events to reschedule them</p>
              <p>• Use the view buttons to switch between Month, Week, Day, and Agenda views</p>
            </div>
          </section>

          {/* Creating Events */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-green-600" />
              Creating Events
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Click the <span className="font-semibold text-gray-900 dark:text-white">+</span> button in the bottom right corner</p>
              <p>• Or click and drag on the calendar to select a time range</p>
              <p>• Fill in event details: title, description, location, and reminders</p>
              <p>• Link events to leads or properties for better tracking</p>
            </div>
          </section>

          {/* Searching */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              Searching Events
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Click the search icon in the toolbar</p>
              <p>• Type keywords to search by event title, description, or location</p>
              <p>• Matching events will be highlighted on the calendar</p>
              <p>• Clear the search to show all events again</p>
            </div>
          </section>

          {/* Managing Events */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Drag className="w-5 h-5 text-orange-600" />
              Managing Events
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• <span className="font-semibold text-gray-900 dark:text-white">Drag and drop</span> events to change their time</p>
              <p>• <span className="font-semibold text-gray-900 dark:text-white">Resize</span> events by dragging the bottom edge</p>
              <p>• <span className="font-semibold text-gray-900 dark:text-white">Click</span> an event to view full details</p>
              <p>• Edit or delete events from the event detail modal</p>
            </div>
          </section>

          {/* Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Calendar Settings
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Access settings via the settings icon in the toolbar</p>
              <p>• Configure timezone, default event duration, and view preferences</p>
              <p>• Customize appearance: theme, colors, and view density</p>
              <p>• Set up notifications and reminders</p>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400">Today</span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">T</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400">Previous</span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">←</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400">Next</span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">→</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400">Month View</span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">M</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400">Week View</span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">W</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-600 dark:text-gray-400">Day View</span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">D</kbd>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-600" />
              Tips & Tricks
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Connect external calendars (Google, Outlook) for unified scheduling</p>
              <p>• Use event types to color-code your calendar</p>
              <p>• Set up automated follow-ups after events</p>
              <p>• Link events to leads or properties for better CRM integration</p>
              <p>• Use the free/busy feature to avoid double-booking</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}

