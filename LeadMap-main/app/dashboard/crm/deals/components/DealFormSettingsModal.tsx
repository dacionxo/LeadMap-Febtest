'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Save, ChevronDown, ChevronRight, Trash2, GripVertical } from 'lucide-react'

export interface FormField {
  id: string
  label: string
  type: 'text' | 'select' | 'date' | 'number' | 'textarea' | 'user'
  required: boolean
  visible: boolean
  order: number
  category?: string
}

interface DealFormSettings {
  fields: FormField[]
}

interface DealFormSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (settings: DealFormSettings) => void
  defaultFields: FormField[]
}

// Categories for fields
const FIELD_CATEGORIES = [
  { id: 'basic', label: 'Basic information', count: 8 },
  { id: 'activity', label: 'Deal activity', count: 6 },
  { id: 'revenue', label: 'Deal revenue', count: 2 },
]

const DEFAULT_FIELDS: FormField[] = [
  // Basic information (8) - ordered as specified
  { id: 'deal_name', label: 'Deal name', type: 'text', required: true, visible: true, order: 1, category: 'basic' },
  { id: 'description', label: 'Description', type: 'textarea', required: false, visible: true, order: 2, category: 'basic' },
  { id: 'company', label: 'Property', type: 'select', required: false, visible: true, order: 3, category: 'basic' },
  { id: 'owner', label: 'Owner', type: 'user', required: false, visible: true, order: 4, category: 'basic' },
  { id: 'pipeline', label: 'Pipeline', type: 'select', required: true, visible: true, order: 5, category: 'basic' },
  { id: 'stage', label: 'Stage', type: 'select', required: true, visible: true, order: 6, category: 'basic' },
  { id: 'source', label: 'Source', type: 'text', required: false, visible: true, order: 7, category: 'basic' },
  { id: 'current_solutions', label: 'Current solutions', type: 'text', required: false, visible: true, order: 8, category: 'basic' },
  // Deal activity (6) - ordered as specified
  { id: 'estimated_close_date', label: 'Estimated close date', type: 'date', required: true, visible: true, order: 9, category: 'activity' },
  { id: 'actual_closed_date', label: 'Actual closed date', type: 'date', required: false, visible: true, order: 10, category: 'activity' },
  { id: 'next_step', label: 'Next step', type: 'text', required: false, visible: true, order: 11, category: 'activity' },
  { id: 'next_step_date', label: 'Next step date', type: 'date', required: false, visible: true, order: 12, category: 'activity' },
  { id: 'closed_won_reason', label: 'Closed won reason', type: 'textarea', required: false, visible: true, order: 13, category: 'activity' },
  { id: 'closed_lost_reason', label: 'Closed lost reason', type: 'textarea', required: false, visible: true, order: 14, category: 'activity' },
  // Deal revenue (2) - ordered as specified
  { id: 'amount', label: 'Amount', type: 'number', required: false, visible: true, order: 15, category: 'revenue' },
  { id: 'currency', label: 'Currency', type: 'select', required: false, visible: true, order: 16, category: 'revenue' },
]

export default function DealFormSettingsModal({
  isOpen,
  onClose,
  onSave,
  defaultFields = DEFAULT_FIELDS,
}: DealFormSettingsModalProps) {
  const [fields, setFields] = useState<FormField[]>(defaultFields)
  const [loading, setLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['basic']))
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const [dragOverField, setDragOverField] = useState<string | null>(null)

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('dealFormSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        if (parsed.fields && Array.isArray(parsed.fields)) {
          setFields(parsed.fields.map((f: FormField) => ({
            ...f,
            category: f.category || 'basic'
          })))
        }
      } catch (error) {
        console.error('Error loading form settings:', error)
      }
    }
  }, [])

  // Group fields by category
  const fieldsByCategory = useMemo(() => {
    const grouped: Record<string, FormField[]> = {
      basic: [],
      activity: [],
      revenue: [],
    }
    
    fields.forEach((field) => {
      const category = field.category || 'basic'
      if (grouped[category]) {
        grouped[category].push(field)
      }
    })

    // Sort fields within each category by order
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => a.order - b.order)
    })

    return grouped
  }, [fields])

  // Get visible fields sorted by order
  const visibleFields = useMemo(() => {
    return fields.filter((f) => f.visible).sort((a, b) => a.order - b.order)
  }, [fields])

  // Get visible fields count by category
  const visibleCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = { basic: 0, activity: 0, revenue: 0 }
    fields.forEach((field) => {
      if (field.visible) {
        const category = field.category || 'basic'
        counts[category] = (counts[category] || 0) + 1
      }
    })
    return counts
  }, [fields])

  const handleToggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const handleToggleRequired = (fieldId: string) => {
    setFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, required: !field.required } : field
      )
    )
  }

  const handleDeleteField = (fieldId: string) => {
    setFields((prev) => prev.map((field) => 
      field.id === fieldId ? { ...field, visible: false } : field
    ))
  }

  const handleDragStart = (fieldId: string) => {
    setDraggedField(fieldId)
  }

  const handleDragOver = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault()
    setDragOverField(fieldId)
  }

  const handleDragEnd = () => {
    setDraggedField(null)
    setDragOverField(null)
  }

  const handleDrop = (e: React.DragEvent, targetFieldId: string) => {
    e.preventDefault()
    if (!draggedField || draggedField === targetFieldId) {
      setDragOverField(null)
      return
    }

    const draggedIndex = visibleFields.findIndex((f) => f.id === draggedField)
    const targetIndex = visibleFields.findIndex((f) => f.id === targetFieldId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDragOverField(null)
      return
    }

    setFields((prev) => {
      const newFields = [...prev]
      const draggedFieldData = newFields.find((f) => f.id === draggedField)
      const targetFieldData = newFields.find((f) => f.id === targetFieldId)

      if (!draggedFieldData || !targetFieldData) return prev

      // Swap orders
      const tempOrder = draggedFieldData.order
      draggedFieldData.order = targetFieldData.order
      targetFieldData.order = tempOrder

      // Re-sort all fields by order
      return newFields.sort((a, b) => a.order - b.order)
    })

    setDragOverField(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const settings: DealFormSettings = { fields }
      localStorage.setItem('dealFormSettings', JSON.stringify(settings))
      onSave(settings)
      onClose()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Customize deal form
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Field Categories */}
          <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
            <div className="p-4">
              {FIELD_CATEGORIES.map((category) => {
                const isExpanded = expandedCategories.has(category.id)
                const categoryFields = fieldsByCategory[category.id] || []
                const visibleCount = visibleCountsByCategory[category.id] || 0

                return (
                  <div key={category.id} className="mb-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCategory(category.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      <span>{category.label} ({visibleCount})</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {categoryFields.map((field) => (
                          <label
                            key={field.id}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer ${
                              field.visible
                                ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={field.visible}
                              onChange={(e) => {
                                e.stopPropagation()
                                setFields((prev) =>
                                  prev.map((f) =>
                                    f.id === field.id ? { ...f, visible: e.target.checked } : f
                                  )
                                )
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span>{field.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Main Content */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Instruction Text */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select and sort the fields on this form for when a new deal is created.
              </p>
            </div>

            {/* Fields List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {visibleFields.map((field, index) => {
                const isDragged = draggedField === field.id
                const isDragOver = dragOverField === field.id
                // Fields that are always required and cannot be reordered
                const alwaysRequiredFields = ['deal_name', 'pipeline', 'stage']
                const canReorder = !alwaysRequiredFields.includes(field.id)
                const canSetRequired = !alwaysRequiredFields.includes(field.id)

                return (
                  <div
                    key={field.id}
                    draggable={canReorder}
                    onDragStart={() => canReorder && handleDragStart(field.id)}
                    onDragOver={(e) => canReorder && handleDragOver(e, field.id)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => canReorder && handleDrop(e, field.id)}
                    className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-4 transition-all ${
                      isDragged ? 'opacity-50' : ''
                    } ${isDragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    {/* Drag Handle - Only for fields that can be reordered */}
                    {canReorder && (
                      <div className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <GripVertical className="w-5 h-5" />
                      </div>
                    )}

                    {/* Field Label and Input */}
                    <div className="flex-1 flex items-center gap-4">
                      <label className="text-sm font-medium text-gray-900 dark:text-white min-w-[120px]">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        placeholder=""
                      />
                    </div>

                    {/* Set as Required Checkbox - Only for customizable fields */}
                    {canSetRequired && (
                      <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={() => handleToggleRequired(field.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          Set as required
                        </span>
                      </label>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteField(field.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
                      title="Delete field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
