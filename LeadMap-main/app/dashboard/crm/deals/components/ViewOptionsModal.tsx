'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Table2, LayoutGrid, Layers3, List, Filter, Check, ChevronRight } from 'lucide-react'

interface ViewOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  viewMode: 'kanban' | 'table'
  onViewModeChange: (mode: 'kanban' | 'table') => void
  groupBy?: string | null
  onGroupByChange?: (groupBy: string | null) => void
  visibleFields?: string[]
  onFieldsChange?: (fields: string[]) => void
  appliedFiltersCount?: number
  onFiltersClick?: () => void
  availableGroupByOptions?: Array<{ value: string; label: string }>
  availableFields?: Array<{ id: string; label: string; visible: boolean }>
}

const DEFAULT_GROUP_BY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'stage', label: 'Stage' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'owner', label: 'Owner' },
  { value: 'source', label: 'Source' },
  { value: 'created_at', label: 'Created date' },
]

const DEFAULT_FIELDS = [
  { id: 'title', label: 'Deal name', visible: true },
  { id: 'value', label: 'Amount', visible: true },
  { id: 'stage', label: 'Stage', visible: true },
  { id: 'pipeline', label: 'Pipeline', visible: true },
  { id: 'owner', label: 'Owner', visible: true },
  { id: 'expected_close_date', label: 'Expected close date', visible: true },
  { id: 'property', label: 'Property', visible: true },
  { id: 'contact', label: 'Contact', visible: true },
]

export default function ViewOptionsModal({
  isOpen,
  onClose,
  viewMode,
  onViewModeChange,
  groupBy = 'none',
  onGroupByChange,
  visibleFields,
  onFieldsChange,
  appliedFiltersCount = 0,
  onFiltersClick,
  availableGroupByOptions = DEFAULT_GROUP_BY_OPTIONS,
  availableFields = DEFAULT_FIELDS,
}: ViewOptionsModalProps) {
  const [localGroupBy, setLocalGroupBy] = useState<string | null>(groupBy || 'none')
  const [showGroupByOptions, setShowGroupByOptions] = useState(false)
  const [showFieldsOptions, setShowFieldsOptions] = useState(false)
  const [localFields, setLocalFields] = useState(
    availableFields.map((f) => ({
      ...f,
      visible: visibleFields?.includes(f.id) ?? f.visible,
    }))
  )

  // Sync local state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalGroupBy(groupBy || 'none')
      setLocalFields(
        availableFields.map((f) => ({
          ...f,
          visible: visibleFields?.includes(f.id) ?? f.visible,
        }))
      )
      setShowGroupByOptions(false)
      setShowFieldsOptions(false)
    }
  }, [isOpen, groupBy, visibleFields, availableFields])
  const modalRef = useRef<HTMLDivElement>(null)
  const groupByRef = useRef<HTMLDivElement>(null)
  const fieldsRef = useRef<HTMLDivElement>(null)

  const visibleFieldsCount = localFields.filter((f) => f.visible).length

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupByRef.current && !groupByRef.current.contains(event.target as Node)) {
        setShowGroupByOptions(false)
      }
      if (fieldsRef.current && !fieldsRef.current.contains(event.target as Node)) {
        setShowFieldsOptions(false)
      }
    }

    if (showGroupByOptions || showFieldsOptions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showGroupByOptions, showFieldsOptions])

  const handleGroupBySelect = (value: string) => {
    const newGroupBy = value === 'none' ? null : value
    setLocalGroupBy(value)
    setShowGroupByOptions(false)
    if (onGroupByChange) {
      onGroupByChange(newGroupBy)
    }
  }

  const handleFieldToggle = (fieldId: string) => {
    setLocalFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, visible: !f.visible } : f))
    )
  }

  const handleFieldsSave = () => {
    if (onFieldsChange) {
      const visibleFieldIds = localFields.filter((f) => f.visible).map((f) => f.id)
      onFieldsChange(visibleFieldIds)
    }
    setShowFieldsOptions(false)
  }

  const handleFiltersClick = () => {
    if (onFiltersClick) {
      onFiltersClick()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">View options</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Layout Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Layout</h3>
            <div className="space-y-2">
              <button
                onClick={() => onViewModeChange('table')}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  viewMode === 'table'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Table2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Table</span>
                </div>
                {viewMode === 'table' && <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              </button>
              <button
                onClick={() => onViewModeChange('kanban')}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                  viewMode === 'kanban'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutGrid className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Kanban board</span>
                </div>
                {viewMode === 'kanban' && <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              </button>
            </div>
          </div>

          {/* Group by Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Group by</h3>
            <div className="relative" ref={groupByRef}>
              <button
                onClick={() => setShowGroupByOptions(!showGroupByOptions)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Layers3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Group by</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {availableGroupByOptions.find((opt) => opt.value === localGroupBy)?.label || 'None'}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showGroupByOptions ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {showGroupByOptions && (
                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                  {availableGroupByOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleGroupBySelect(option.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        localGroupBy === option.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      } ${option.value === 'none' ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}
                    >
                      <span className="text-sm text-gray-900 dark:text-white">{option.label}</span>
                      {localGroupBy === option.value && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fields Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Fields</h3>
            <div className="relative" ref={fieldsRef}>
              <button
                onClick={() => setShowFieldsOptions(!showFieldsOptions)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
              >
                <div className="flex items-center gap-3">
                  <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Fields</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{visibleFieldsCount}</span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showFieldsOptions ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {showFieldsOptions && (
                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <div className="p-4 space-y-2">
                    {localFields.map((field) => (
                      <label
                        key={field.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={field.visible}
                          onChange={() => handleFieldToggle(field.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">{field.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleFieldsSave}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Applied filters Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Applied filters</h3>
            <button
              onClick={handleFiltersClick}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
            >
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Filters</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{appliedFiltersCount}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

