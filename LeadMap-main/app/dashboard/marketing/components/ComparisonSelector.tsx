'use client'

import { useState, useEffect } from 'react'
import { Calendar, Filter, Loader2 } from 'lucide-react'

interface Entity {
  id: string
  name: string
}

interface ComparisonSelectorProps {
  comparisonType: 'campaigns' | 'templates' | 'mailboxes' | 'time_periods'
  availableEntities: Entity[]
  selectedEntities: string[]
  onTypeChange: (type: string) => void
  onEntitiesChange: (ids: string[]) => void
  onDateRangeChange: (start: string, end: string) => void
  onMetricChange: (metric: string) => void
  onApply: () => void
  loading?: boolean
  defaultStartDate?: string
  defaultEndDate?: string
  defaultMetric?: string
}

/**
 * Comparison Selector Component
 * UI for selecting comparison type, entities, date range, and metrics
 * Following Mautic filter patterns
 */
export default function ComparisonSelector({
  comparisonType,
  availableEntities,
  selectedEntities,
  onTypeChange,
  onEntitiesChange,
  onDateRangeChange,
  onMetricChange,
  onApply,
  loading = false,
  defaultStartDate,
  defaultEndDate,
  defaultMetric = 'open_rate',
}: ComparisonSelectorProps) {
  const [startDate, setStartDate] = useState(
    defaultStartDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    defaultEndDate || new Date().toISOString().split('T')[0]
  )
  const [selectedMetric, setSelectedMetric] = useState(defaultMetric)

  useEffect(() => {
    onDateRangeChange(startDate, endDate)
  }, [startDate, endDate])

  useEffect(() => {
    onMetricChange(selectedMetric)
  }, [selectedMetric])

  const handleEntityToggle = (entityId: string) => {
    if (selectedEntities.includes(entityId)) {
      onEntitiesChange(selectedEntities.filter((id) => id !== entityId))
    } else {
      if (selectedEntities.length < 5) {
        // Limit to 5 entities for comparison
        onEntitiesChange([...selectedEntities, entityId])
      }
    }
  }

  const canApply = selectedEntities.length >= 2

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Comparison Settings
        </h3>
      </div>

      {/* Comparison Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Compare By
        </label>
        <select
          value={comparisonType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          aria-label="Comparison type"
        >
          <option value="campaigns">Campaigns</option>
          <option value="templates">Templates</option>
          <option value="mailboxes">Mailboxes</option>
          <option value="time_periods">Time Periods</option>
        </select>
      </div>

      {/* Entity Multi-Select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select {comparisonType.charAt(0).toUpperCase() + comparisonType.slice(1)} (2-5 required)
        </label>
        <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : availableEntities.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No {comparisonType} available
            </p>
          ) : (
            <div className="space-y-2">
              {availableEntities.map((entity) => (
                <label
                  key={entity.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEntities.includes(entity.id)}
                    onChange={() => handleEntityToggle(entity.id)}
                    disabled={!selectedEntities.includes(entity.id) && selectedEntities.length >= 5}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-white flex-1">
                    {entity.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {selectedEntities.length} of {availableEntities.length} selected
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Metric Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Primary Metric
        </label>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="open_rate">Open Rate</option>
          <option value="click_rate">Click Rate</option>
          <option value="reply_rate">Reply Rate</option>
          <option value="delivery_rate">Delivery Rate</option>
          <option value="bounce_rate">Bounce Rate</option>
        </select>
      </div>

      {/* Apply Button */}
      <button
        onClick={onApply}
        disabled={!canApply || loading}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
          canApply && !loading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
        }`}
        aria-label="Apply comparison"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </span>
        ) : (
          'Apply Comparison'
        )}
      </button>

      {!canApply && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center">
          Please select at least 2 {comparisonType} to compare
        </p>
      )}
    </div>
  )
}

