'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, ChevronDown, ChevronUp, Settings, Calendar, ChevronRight, MapPin } from 'lucide-react'
import { useApp } from '@/app/providers'
import DealFormSettingsModal, { FormField } from './DealFormSettingsModal'
import PropertySelectorModal from './PropertySelectorModal'

interface Deal {
  id?: string
  title: string
  description?: string
  value?: number | null
  stage: string
  probability?: number
  expected_close_date?: string | null
  closed_date?: string | null
  contact_id?: string | null
  listing_id?: string | null
  pipeline_id?: string | null
  owner_id?: string | null
  notes?: string
  tags?: string[]
  closed_won_reason?: string | null
  closed_lost_reason?: string | null
}

interface Property {
  id: string
  listing_id: string
  display_name: string
  street?: string
  city?: string
  state?: string
  zip_code?: string
  property_url?: string
  list_price?: number
}

interface Pipeline {
  id: string
  name: string
  stages: string[]
  is_default: boolean
}

interface User {
  id: string
  name: string
  email: string
}

interface DealFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (deal: Partial<Deal>) => Promise<void>
  deal?: Deal | null
  properties?: Property[]
  pipelines?: Pipeline[]
  users?: User[]
}

const DEFAULT_FORM_FIELDS: FormField[] = [
  { id: 'deal_name', label: 'Deal name', type: 'text', required: true, visible: true, order: 1, category: 'basic' },
  { id: 'pipeline', label: 'Pipeline', type: 'select', required: true, visible: true, order: 2, category: 'basic' },
  { id: 'stage', label: 'Stage', type: 'select', required: true, visible: true, order: 3, category: 'basic' },
  { id: 'company', label: 'Property', type: 'select', required: false, visible: true, order: 4, category: 'basic' },
  { id: 'estimated_close_date', label: 'Estimated close date', type: 'date', required: true, visible: true, order: 5, category: 'basic' },
  { id: 'owner', label: 'Owner', type: 'user', required: false, visible: true, order: 6, category: 'basic' },
  { id: 'amount', label: 'Amount ($)', type: 'number', required: false, visible: true, order: 7, category: 'revenue' },
  { id: 'closed_won_reason', label: 'Closed won reason', type: 'textarea', required: false, visible: true, order: 8, category: 'activity' },
  { id: 'closed_lost_reason', label: 'Closed lost reason', type: 'textarea', required: false, visible: true, order: 9, category: 'activity' },
  { id: 'actual_closed_date', label: 'Actual closed date', type: 'date', required: false, visible: true, order: 10, category: 'basic' },
]

export default function DealFormModal({
  isOpen,
  onClose,
  onSave,
  deal,
  properties = [],
  pipelines = [],
  users = [],
}: DealFormModalProps) {
  const { profile, user } = useApp()
  const [formData, setFormData] = useState<Partial<Deal>>({
    title: '',
    value: null,
    stage: '',
    probability: 0,
    expected_close_date: null,
    closed_date: null,
    listing_id: null,
    pipeline_id: null,
    owner_id: null,
    closed_won_reason: null,
    closed_lost_reason: null,
  })
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>(DEFAULT_FORM_FIELDS)
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [showPropertySelector, setShowPropertySelector] = useState(false)

  // Load form customization settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('dealFormSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        if (parsed.fields && Array.isArray(parsed.fields)) {
          setFormFields(parsed.fields)
        }
      } catch (error) {
        console.error('Error loading form settings:', error)
      }
    }
  }, [])

  // Initialize form data
  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        value: deal.value || null,
        stage: deal.stage || '',
        probability: deal.probability || 0,
        expected_close_date: deal.expected_close_date || null,
        closed_date: deal.closed_date || null,
        listing_id: deal.listing_id || null,
        pipeline_id: deal.pipeline_id || null,
        owner_id: deal.owner_id || (user?.id || null),
        closed_won_reason: deal.closed_won_reason || null,
        closed_lost_reason: deal.closed_lost_reason || null,
      })
    } else {
      // Set default owner to current user
      setFormData({
        title: '',
        value: null,
        stage: '',
        probability: 0,
        expected_close_date: null,
        closed_date: null,
        listing_id: null,
        pipeline_id: pipelines.find((p) => p.is_default)?.id || pipelines[0]?.id || null,
        owner_id: user?.id || null,
        closed_won_reason: null,
        closed_lost_reason: null,
      })
    }
  }, [deal, isOpen, user, pipelines])

  // Properties are already formatted with display names

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
  const parseDateInput = (dateString: string): string | null => {
    if (!dateString) return null
    const parts = dateString.split('/')
    if (parts.length !== 3) return null
    const [month, day, year] = parts.map((p) => parseInt(p, 10))
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null
    const date = new Date(year, month - 1, day)
    if (isNaN(date.getTime())) return null
    return date.toISOString()
  }

  // Handle date input change (accepts mm/dd/yyyy format)
  const handleDateChange = (field: 'expected_close_date' | 'closed_date', value: string) => {
    // Allow partial input while typing
    if (value.length <= 10) {
      setFormData((prev) => ({
        ...prev,
        [field]: value.length === 10 ? parseDateInput(value) : null,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent, createAnother: boolean = false) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(formData)
      if (!createAnother) {
        onClose()
      } else {
        // Reset form for another deal
        setFormData({
          title: '',
          value: null,
          stage: '',
          probability: 0,
          expected_close_date: null,
          closed_date: null,
          listing_id: null,
          pipeline_id: pipelines.find((p) => p.is_default)?.id || pipelines[0]?.id || null,
          owner_id: user?.id || null,
          closed_won_reason: null,
          closed_lost_reason: null,
        })
      }
    } catch (error) {
      console.error('Error saving deal:', error)
      alert('Failed to save deal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === formData.pipeline_id)
  const availableStages = selectedPipeline?.stages || []
  const currentOwner = users.find((u) => u.id === formData.owner_id) || 
    (formData.owner_id === user?.id && profile && user ? { id: user.id, name: profile.name, email: profile.email } : null)

  // Get visible fields in order
  const visibleFields = formFields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)

  // Separate fields into main fields and more fields
  const moreFieldIds = ['amount', 'closed_won_reason', 'closed_lost_reason', 'actual_closed_date']
  const mainFields = visibleFields.filter((f) => !moreFieldIds.includes(f.id))
  const moreFields = visibleFields.filter((f) => moreFieldIds.includes(f.id))

  // Helper function to render a field
  const renderField = (field: FormField) => {
    switch (field.id) {
      case 'deal_name':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              required={field.required}
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Deal name"
            />
          </div>
        )
      case 'pipeline':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              required={field.required}
              value={formData.pipeline_id || ''}
              onChange={(e) => setFormData({ ...formData, pipeline_id: e.target.value || null, stage: '' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:20px] bg-[right_0.5rem_center] bg-no-repeat pr-10"
            >
              <option value="">Select...</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>
        )
      case 'stage':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              required={field.required}
              value={formData.stage || ''}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:20px] bg-[right_0.5rem_center] bg-no-repeat pr-10"
              disabled={!formData.pipeline_id}
            >
              <option value="">Select...</option>
              {availableStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>
        )
      case 'company':
        const selectedProperty = properties.find((p) => p.listing_id === formData.listing_id)
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPropertySelector(true)}
                className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between ${
                  selectedProperty
                    ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                } hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  {selectedProperty ? (
                    <>
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{selectedProperty.display_name}</span>
                    </>
                  ) : (
                    <span>Select property...</span>
                  )}
                </span>
                {selectedProperty && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFormData({ ...formData, listing_id: null })
                    }}
                    className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
              </button>
            </div>
          </div>
        )
      case 'estimated_close_date':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                required={field.required}
                value={formatDateForInput(formData.expected_close_date)}
                onChange={(e) => handleDateChange('expected_close_date', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="mm/dd/yyyy"
                maxLength={10}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )
      case 'owner':
        return (
          <div key={field.id} className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={currentOwner ? `${currentOwner.name} (You)` : ''}
                onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Select owner..."
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {currentOwner && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFormData({ ...formData, owner_id: null })
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
              {showOwnerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={() => {
                      setFormData({ ...formData, owner_id: user?.id || null })
                      setShowOwnerDropdown(false)
                    }}
                  >
                    {profile?.name || user?.email} (You)
                  </div>
                  {users
                    .filter((u) => u.id !== user?.id)
                    .map((u) => (
                      <div
                        key={u.id}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                        onClick={() => {
                          setFormData({ ...formData, owner_id: u.id })
                          setShowOwnerDropdown(false)
                        }}
                      >
                        {u.name || u.email}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )
      case 'amount':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type="number"
                required={field.required}
                value={formData.value || ''}
                onChange={(e) =>
                  setFormData({ ...formData, value: e.target.value ? parseFloat(e.target.value) : null })
                }
                className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, value: (formData.value || 0) + 1 })
                  }
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <ChevronUp className="w-3 h-3 text-gray-400" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, value: Math.max(0, (formData.value || 0) - 1) })
                  }
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        )
      case 'closed_won_reason':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              required={field.required}
              value={formData.closed_won_reason || ''}
              onChange={(e) => setFormData({ ...formData, closed_won_reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Closed won reason"
            />
          </div>
        )
      case 'closed_lost_reason':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              required={field.required}
              value={formData.closed_lost_reason || ''}
              onChange={(e) => setFormData({ ...formData, closed_lost_reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Closed lost reason"
            />
          </div>
        )
      case 'actual_closed_date':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                required={field.required}
                value={formatDateForInput(formData.closed_date)}
                onChange={(e) => handleDateChange('closed_date', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="mm/dd/yyyy"
                maxLength={10}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // Handle settings save
  const handleSettingsSave = (settings: { fields: FormField[] }) => {
    setFormFields(settings.fields)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="w-full h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {deal ? 'Edit Deal' : 'Create deal'}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <Settings className="w-4 h-4" />
              <span>Customize deal form</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Render Main Fields */}
          {mainFields.map((field) => {
            return renderField(field)
          })}

          {/* More Fields Toggle */}
          {moreFields.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowMoreFields(!showMoreFields)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {showMoreFields ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Hide more fields
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    More fields ({moreFields.length})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Render More Fields */}
          {showMoreFields && moreFields.map((field) => {
            return renderField(field)
          })}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save and create another'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
      </div>

      {/* Settings Modal */}
      <DealFormSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
        defaultFields={DEFAULT_FORM_FIELDS}
      />

      {/* Property Selector Modal */}
      <PropertySelectorModal
        isOpen={showPropertySelector}
        onClose={() => setShowPropertySelector(false)}
        onSelect={(property) => {
          setFormData({ ...formData, listing_id: property.listing_id })
        }}
        selectedPropertyId={formData.listing_id || null}
      />
    </>
  )
}
