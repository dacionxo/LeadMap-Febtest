'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string | null | undefined
  onChange: (date: string | null) => void
  placeholder?: string
  required?: boolean
  id?: string
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'mm/dd/yyyy',
  required = false,
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const datePickerRef = useRef<HTMLDivElement>(null)

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Parse the current value to get the selected date
  const selectedDate = value ? new Date(value) : null
  if (selectedDate && isNaN(selectedDate.getTime())) {
    // Invalid date
  }

  // Initialize current month to selected date if available
  useEffect(() => {
    if (selectedDate && !isNaN(selectedDate.getTime())) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    } else {
      setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    }
  }, [isOpen])

  // Format date for display (mm/dd/yyyy)
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }

  // Parse date from mm/dd/yyyy format
  const parseDateInput = (dateString: string): Date | null => {
    if (!dateString) return null
    const parts = dateString.split('/')
    if (parts.length !== 3) return null
    const [month, day, year] = parts.map((p) => parseInt(p, 10))
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null
    const date = new Date(year, month - 1, day)
    if (isNaN(date.getTime())) return null
    return date
  }

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  // Navigate to today and select today's date
  const goToToday = () => {
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth()
    const todayDay = today.getDate()
    
    // Navigate to today's month
    setCurrentMonth(new Date(todayYear, todayMonth, 1))
    
    // Select today's date
    const todayDate = new Date(todayYear, todayMonth, todayDay)
    const isoString = todayDate.toISOString()
    onChange(isoString)
    setIsOpen(false)
  }

  // Handle date selection
  const handleDateSelect = (day: number) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const isoString = selected.toISOString()
    onChange(isoString)
    setIsOpen(false)
  }

  // Handle manual input change
  const handleInputChange = (value: string) => {
    // Allow partial input while typing
    if (value.length <= 10) {
      const date = parseDateInput(value)
      if (date) {
        onChange(date.toISOString())
      } else if (value.length === 10) {
        // Invalid date but complete - clear it
        onChange(null)
      }
    }
  }

  // Generate calendar days
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const days: (number | null)[] = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get today's date (calculate fresh each time to ensure accuracy)
  const getToday = (): Date => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }

  const isToday = (day: number) => {
    const today = getToday()
    const dateToCheck = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    
    // Compare year, month, and day
    return dateToCheck.getFullYear() === today.getFullYear() &&
           dateToCheck.getMonth() === today.getMonth() &&
           dateToCheck.getDate() === today.getDate()
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return day === selectedDate.getDate() &&
           currentMonth.getMonth() === selectedDate.getMonth() &&
           currentMonth.getFullYear() === selectedDate.getFullYear()
  }

  return (
    <div className="relative" ref={datePickerRef}>
      <div className="relative">
        <input
          type="text"
          id={id}
          required={required}
          value={formatDateForInput(value)}
          onChange={(e) => handleInputChange(e.target.value)}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={placeholder}
          maxLength={10}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-72">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={goToToday}
                className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              >
                Today
              </button>
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                    isSelected(day)
                      ? 'bg-blue-600 text-white font-semibold'
                      : isToday(day)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Clear Button */}
          {selectedDate && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setIsOpen(false)
                }}
                className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

