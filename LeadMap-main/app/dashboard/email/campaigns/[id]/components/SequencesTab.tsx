'use client'

import { useState, useEffect } from 'react'
import { 
  Plus, 
  Eye, 
  Zap, 
  Paperclip, 
  Code, 
  Type, 
  Sparkles, 
  FileText, 
  Tag,
  ChevronDown,
  Loader2,
  Trash2,
  X,
  ChevronUp,
  ChevronDown as ChevronDownIcon
} from 'lucide-react'

interface Step {
  id: string
  step_number: number
  delay_hours: number
  delay_days: number
  subject: string
  html: string
  template_id?: string | null
  variants?: Variant[]
}

interface EmailTemplate {
  id: string
  title: string
  subject?: string
  body: string
  category: string
}

interface Variant {
  id: string
  variant_number: number
  name?: string
  subject: string
  html: string
  is_active: boolean
}

interface SequencesTabContentProps {
  campaignId: string
  campaignStatus: string
}

export default function SequencesTabContent({ campaignId, campaignStatus }: SequencesTabContentProps) {
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  
  // Editor state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [delayHours, setDelayHours] = useState(0)
  const [delayDays, setDelayDays] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [showSaveDropdown, setShowSaveDropdown] = useState(false)

  const isDraft = campaignStatus === 'draft'

  useEffect(() => {
    if (campaignId) {
      fetchSteps()
      fetchTemplates()
    }
  }, [campaignId])

  useEffect(() => {
    if (selectedStepId && steps.length > 0) {
      const step = steps.find(s => s.id === selectedStepId)
      if (step) {
        const variant = selectedVariantId 
          ? step.variants?.find(v => v.id === selectedVariantId)
          : step.variants?.[0]
        
        if (variant) {
          setSubject(variant.subject || '<Empty subject>')
          setBody(variant.html || '')
        } else {
          setSubject(step.subject || '<Empty subject>')
          setBody(step.html || '')
        }
        
        // Set delay values
        setDelayHours(step.delay_hours || 0)
        setDelayDays(step.delay_days || 0)
        setSelectedTemplateId(step.template_id || null)
      }
    }
  }, [selectedStepId, selectedVariantId, steps])

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const response = await fetch('/api/email-templates?is_active=true')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (err) {
      console.error('Error loading templates:', err)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId || templateId === 'none') {
      setSelectedTemplateId(null)
      return
    }

    try {
      const response = await fetch(`/api/email-templates/${templateId}`)
      if (response.ok) {
        const data = await response.json()
        const template = data.template
        if (template) {
          setSubject(template.subject || template.title || '')
          setBody(template.body || '')
          setSelectedTemplateId(templateId)
        }
      }
    } catch (err) {
      console.error('Error loading template:', err)
    }
  }

  const fetchSteps = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/steps`)
      if (!response.ok) throw new Error('Failed to fetch steps')
      
      const data = await response.json()
      const stepsData = data.steps || []
      
      // Sort by step_number and ensure variants are sorted
      const sortedSteps = stepsData.map((step: any) => ({
        ...step,
        variants: (step.variants || []).sort((a: Variant, b: Variant) => 
          a.variant_number - b.variant_number
        )
      })).sort((a: Step, b: Step) => a.step_number - b.step_number)
      
      setSteps(sortedSteps)
      
      // Auto-select first step if none selected
      if (!selectedStepId && sortedSteps.length > 0) {
        setSelectedStepId(sortedSteps[0].id)
        if (sortedSteps[0].variants && sortedSteps[0].variants.length > 0) {
          setSelectedVariantId(sortedSteps[0].variants[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading steps:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddStep = async () => {
    if (!isDraft) return
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: '<Empty subject>',
          html: '',
          delay_hours: 0,
          delay_days: 0
        })
      })
      
      if (!response.ok) throw new Error('Failed to create step')
      
      const data = await response.json()
      await fetchSteps()
      setSelectedStepId(data.step.id)
      if (data.step.variants && data.step.variants.length > 0) {
        setSelectedVariantId(data.step.variants[0].id)
      }
    } catch (err) {
      console.error('Error creating step:', err)
      alert('Failed to create step')
    }
  }

  const handleAddVariant = async (stepId: string) => {
    if (!isDraft) return
    
    try {
      const step = steps.find(s => s.id === stepId)
      if (!step) return
      
      const response = await fetch(`/api/campaigns/${campaignId}/steps/${stepId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: step.subject || '<Empty subject>',
          html: step.html || ''
        })
      })
      
      if (!response.ok) throw new Error('Failed to create variant')
      
      const data = await response.json()
      await fetchSteps()
      setSelectedVariantId(data.variant.id)
    } catch (err) {
      console.error('Error creating variant:', err)
      alert('Failed to create variant')
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!isDraft || !confirm('Are you sure you want to delete this step?')) return
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/steps/${stepId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete step')
      
      await fetchSteps()
      if (selectedStepId === stepId) {
        setSelectedStepId(null)
        setSelectedVariantId(null)
      }
    } catch (err) {
      console.error('Error deleting step:', err)
      alert('Failed to delete step')
    }
  }

  const handleDeleteVariant = async (stepId: string, variantId: string) => {
    if (!isDraft || !confirm('Are you sure you want to delete this variant?')) return
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/steps/${stepId}/variants/${variantId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete variant')
      }
      
      await fetchSteps()
      const step = steps.find(s => s.id === stepId)
      if (step && step.variants && step.variants.length > 1) {
        const remainingVariants = step.variants.filter(v => v.id !== variantId)
        if (remainingVariants.length > 0) {
          setSelectedVariantId(remainingVariants[0].id)
        }
      }
    } catch (err: any) {
      console.error('Error deleting variant:', err)
      alert(err.message || 'Failed to delete variant')
    }
  }

  const handleReorder = async (stepId: string, direction: 'up' | 'down') => {
    if (!isDraft) return

    const stepIndex = steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) return

    const newIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1
    if (newIndex < 0 || newIndex >= steps.length) return

    const newSteps = [...steps]
    const [movedStep] = newSteps.splice(stepIndex, 1)
    newSteps.splice(newIndex, 0, movedStep)

    // Update step numbers
    const stepOrders = newSteps.map((step, idx) => ({
      step_id: step.id,
      step_number: idx + 1
    }))

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/steps/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepOrders })
      })

      if (!response.ok) throw new Error('Failed to reorder steps')

      await fetchSteps()
    } catch (err) {
      console.error('Error reordering:', err)
      alert('Failed to reorder steps')
    }
  }

  const handleSave = async () => {
    if (!selectedStepId || !isDraft) return
    
    setSaving(true)
    try {
      const step = steps.find(s => s.id === selectedStepId)
      if (!step) return
      
      if (selectedVariantId) {
        // Update variant
        const response = await fetch(
          `/api/campaigns/${campaignId}/steps/${selectedStepId}/variants/${selectedVariantId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject,
              html: body
            })
          }
        )
        
        if (!response.ok) throw new Error('Failed to save variant')
      } else {
        // Update step
        const response = await fetch(
          `/api/campaigns/${campaignId}/steps/${selectedStepId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject,
              html: body,
              delay_hours: delayHours,
              delay_days: delayDays,
              template_id: selectedTemplateId || null
            })
          }
        )
        
        if (!response.ok) throw new Error('Failed to save step')
      }
      
      await fetchSteps()
      alert('Saved successfully')
    } catch (err) {
      console.error('Error saving:', err)
      alert('Failed to save')
    } finally {
      setSaving(false)
      setShowSaveDropdown(false)
    }
  }

  const selectedStep = steps.find(s => s.id === selectedStepId)
  const selectedVariant = selectedStep && selectedVariantId
    ? selectedStep.variants?.find(v => v.id === selectedVariantId)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-300px)] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Left Panel - Steps List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800">
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {steps.map((step) => {
            const isSelected = step.id === selectedStepId
            const variants = step.variants || []
            const displayVariant = selectedVariantId && variants.find(v => v.id === selectedVariantId)
              ? variants.find(v => v.id === selectedVariantId)
              : variants[0]
            
            return (
              <div
                key={step.id}
                className={`border-2 rounded-lg p-3 bg-white dark:bg-gray-800 transition-all ${
                  isSelected
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedStepId(step.id)
                    if (variants.length > 0) {
                      setSelectedVariantId(variants[0].id)
                    } else {
                      setSelectedVariantId(null)
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Step {step.step_number}
                    </h3>
                    <div className="flex items-center gap-1">
                      {isDraft && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReorder(step.id, 'up')
                            }}
                            disabled={step.step_number === 1}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReorder(step.id, 'down')
                            }}
                            disabled={step.step_number === steps.length}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDownIcon className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteStep(step.id)
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                            title="Delete step"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Delay indicator */}
                  {(step.delay_days > 0 || step.delay_hours > 0) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Delay: {step.delay_days > 0 ? `${step.delay_days}d ` : ''}{step.delay_hours > 0 ? `${step.delay_hours}h` : ''}
                    </div>
                  )}
                  
                  <input
                    type="text"
                    value={displayVariant?.subject || step.subject || '<Empty subject>'}
                    readOnly
                    className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white mb-2"
                    placeholder="<Empty subject>"
                  />
                  
                  {isDraft && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddVariant(step.id)
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Plus className="w-4 h-4" />
                      Add variant
                    </button>
                  )}
                  
                  {/* Variant indicators */}
                  {variants.length > 1 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedStepId(step.id)
                            setSelectedVariantId(variant.id)
                          }}
                          className={`px-2 py-0.5 text-xs rounded ${
                            selectedVariantId === variant.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {variant.name || `V${variant.variant_number}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {isDraft && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleAddStep}
              className="w-full flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium"
            >
              <Plus className="w-4 h-4" />
              Add step
            </button>
          </div>
        )}
      </div>

      {/* Right Panel - Content Editor */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
        {selectedStep ? (
          <>
            {/* Editor Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Step {selectedStep.step_number}
                </h2>
                {selectedVariant && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedVariant.name || `Variant ${selectedVariant.variant_number}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                  <Zap className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {showPreview ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      {subject || '<Empty subject>'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Body
                    </label>
                    <div
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: body || 'Start typing here...' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Delay Configuration */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Delay (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={delayDays}
                        onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                        disabled={!isDraft}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Delay (Hours)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={delayHours}
                        onChange={(e) => setDelayHours(parseInt(e.target.value) || 0)}
                        disabled={!isDraft}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Template Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Template
                    </label>
                    <select
                      value={selectedTemplateId || 'none'}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      disabled={!isDraft || loadingTemplates}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="none">No template (custom content)</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title} {template.category ? `(${template.category})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={!isDraft}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      placeholder="Your subject"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Body
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={!isDraft}
                      rows={15}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                      placeholder="Start typing here..."
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {steps.length === 0 ? 'No steps yet. Click "Add step" to get started.' : 'Select a step to edit'}
          </div>
        )}

        {/* Bottom Toolbar */}
        {selectedStep && isDraft && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Sparkles className="w-4 h-4" />
                  AI Tools
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <FileText className="w-4 h-4" />
                  Templates
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Tag className="w-4 h-4" />
                  Variables
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Type className="w-4 h-4" />
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Code className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

