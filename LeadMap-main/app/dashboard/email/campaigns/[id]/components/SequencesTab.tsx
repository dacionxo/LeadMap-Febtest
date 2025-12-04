'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  ChevronDown as ChevronDownIcon,
  Settings,
  BarChart3,
  TrendingUp,
  Award
} from 'lucide-react'
import PreviewEmailModal from './PreviewEmailModal'

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
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  
  // Editor state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [delayHours, setDelayHours] = useState(0)
  const [delayDays, setDelayDays] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [showSaveDropdown, setShowSaveDropdown] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  
  // Track last saved values to prevent unnecessary saves
  const lastSavedValuesRef = useRef<{
    subject: string
    body: string
    delayHours: number
    delayDays: number
    templateId: string | null
    stepId: string | null
    variantId: string | null
  }>({
    subject: '',
    body: '',
    delayHours: 0,
    delayDays: 0,
    templateId: null,
    stepId: null,
    variantId: null
  })
  
  // Autosave timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Split testing state
  const [showSplitTestPanel, setShowSplitTestPanel] = useState(false)
  const [splitTestConfig, setSplitTestConfig] = useState<any>(null)
  const [splitTestAnalytics, setSplitTestAnalytics] = useState<any>(null)
  const [loadingSplitTest, setLoadingSplitTest] = useState(false)
  const [splitTestEnabled, setSplitTestEnabled] = useState(false)
  const [distributionMethod, setDistributionMethod] = useState<'equal' | 'percentage' | 'weighted'>('equal')
  const [winnerCriteria, setWinnerCriteria] = useState<'open_rate' | 'click_rate' | 'reply_rate' | 'conversion_rate' | 'manual'>('open_rate')
  const [autoSelectWinner, setAutoSelectWinner] = useState(false)

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
        
        // Update last saved values ref to prevent autosave on initial load
        lastSavedValuesRef.current = {
          subject: variant ? (variant.subject || '<Empty subject>') : (step.subject || '<Empty subject>'),
          body: variant ? (variant.html || '') : (step.html || ''),
          delayHours: step.delay_hours || 0,
          delayDays: step.delay_days || 0,
          templateId: step.template_id || null,
          stepId: selectedStepId,
          variantId: selectedVariantId
        }
      }
    }
    
    // Fetch split test config when step changes
    if (selectedStepId) {
      fetchSplitTestConfig()
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

  // Autosave function (debounced)
  const performAutosave = useCallback(async () => {
    if (!selectedStepId || !isDraft) return
    
    const step = steps.find(s => s.id === selectedStepId)
    if (!step) return
    
    // Check if values have actually changed
    const currentValues = {
      subject,
      body,
      delayHours,
      delayDays,
      templateId: selectedTemplateId,
      stepId: selectedStepId,
      variantId: selectedVariantId
    }
    
    const lastSaved = lastSavedValuesRef.current
    const hasChanges = 
      currentValues.subject !== lastSaved.subject ||
      currentValues.body !== lastSaved.body ||
      currentValues.delayHours !== lastSaved.delayHours ||
      currentValues.delayDays !== lastSaved.delayDays ||
      currentValues.templateId !== lastSaved.templateId ||
      currentValues.stepId !== lastSaved.stepId ||
      currentValues.variantId !== lastSaved.variantId
    
    if (!hasChanges) return
    
    setAutoSaving(true)
    try {
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
      
      // Update last saved values
      lastSavedValuesRef.current = { ...currentValues }
      setLastSaved(new Date())
      
      // Refresh steps to get updated data
      await fetchSteps()
    } catch (err) {
      console.error('Error autosaving:', err)
      // Don't show alert for autosave failures - just log
    } finally {
      setAutoSaving(false)
    }
  }, [selectedStepId, selectedVariantId, subject, body, delayHours, delayDays, selectedTemplateId, campaignId, isDraft, steps])

  // Debounced autosave effect
  useEffect(() => {
    // Don't autosave if not in draft mode or no step selected
    if (!isDraft || !selectedStepId) {
      return
    }
    
    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    
    // Don't autosave if values haven't changed from last saved
    const currentValues = {
      subject,
      body,
      delayHours,
      delayDays,
      templateId: selectedTemplateId,
      stepId: selectedStepId,
      variantId: selectedVariantId
    }
    
    const lastSaved = lastSavedValuesRef.current
    const hasChanges = 
      currentValues.subject !== lastSaved.subject ||
      currentValues.body !== lastSaved.body ||
      currentValues.delayHours !== lastSaved.delayHours ||
      currentValues.delayDays !== lastSaved.delayDays ||
      currentValues.templateId !== lastSaved.templateId ||
      currentValues.stepId !== lastSaved.stepId ||
      currentValues.variantId !== lastSaved.variantId
    
    if (!hasChanges) {
      return
    }
    
    // Set new timer (2 seconds after user stops typing/editing)
    autosaveTimerRef.current = setTimeout(() => {
      performAutosave()
    }, 2000)
    
    // Cleanup
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [subject, body, delayHours, delayDays, selectedTemplateId, performAutosave, selectedStepId, selectedVariantId, isDraft])

  // Reset last saved timestamp when step/variant changes
  useEffect(() => {
    setLastSaved(null)
  }, [selectedStepId, selectedVariantId])

  const handleSave = async () => {
    if (!selectedStepId || !isDraft) return
    
    setSaving(true)
    try {
      await performAutosave()
      alert('Saved successfully')
    } catch (err) {
      console.error('Error saving:', err)
      alert('Failed to save')
    } finally {
      setSaving(false)
      setShowSaveDropdown(false)
    }
  }

  const fetchSplitTestConfig = async () => {
    if (!selectedStepId) return
    
    try {
      setLoadingSplitTest(true)
      const response = await fetch(`/api/campaigns/${campaignId}/steps/${selectedStepId}/split-test`)
      if (response.ok) {
        const data = await response.json()
        setSplitTestConfig(data.splitTest)
        setSplitTestEnabled(data.splitTest?.is_enabled || false)
        setDistributionMethod(data.splitTest?.distribution_method || 'equal')
        setWinnerCriteria(data.splitTest?.winner_selection_criteria || 'open_rate')
        setAutoSelectWinner(data.splitTest?.auto_select_winner || false)
        
        // Fetch analytics if split test is enabled
        if (data.splitTest?.is_enabled) {
          fetchSplitTestAnalytics()
        }
      }
    } catch (err) {
      console.error('Error fetching split test config:', err)
    } finally {
      setLoadingSplitTest(false)
    }
  }

  const fetchSplitTestAnalytics = async () => {
    if (!selectedStepId) return
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/steps/${selectedStepId}/split-test/analytics`)
      if (response.ok) {
        const data = await response.json()
        setSplitTestAnalytics(data)
      }
    } catch (err) {
      console.error('Error fetching split test analytics:', err)
    }
  }

  const handleSaveSplitTest = async () => {
    if (!selectedStepId || !isDraft) return
    
    try {
      const step = steps.find(s => s.id === selectedStepId)
      if (!step || !step.variants || step.variants.length < 2) {
        alert('You need at least 2 variants to enable split testing')
        return
      }

      // Prepare distributions
      const distributions = step.variants.map((variant, index) => {
        if (distributionMethod === 'equal') {
          return {
            variant_id: variant.id,
            send_percentage: Math.floor(100 / step.variants.length),
            weight: 1
          }
        } else {
          // For percentage, use equal split by default (user can customize later)
          return {
            variant_id: variant.id,
            send_percentage: Math.floor(100 / step.variants.length),
            weight: 1
          }
        }
      })

      const response = await fetch(`/api/campaigns/${campaignId}/steps/${selectedStepId}/split-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: splitTestEnabled,
          distribution_method: distributionMethod,
          winner_selection_criteria: winnerCriteria,
          auto_select_winner: autoSelectWinner,
          distributions
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save split test')
      }

      await fetchSplitTestConfig()
      if (splitTestEnabled) {
        await fetchSplitTestAnalytics()
      }
      alert('Split test configuration saved')
    } catch (err: any) {
      console.error('Error saving split test:', err)
      alert(err.message || 'Failed to save split test')
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
            
            // Use live subject state if this is the currently selected step being edited
            // Check if we're editing this specific step/variant combination
            const isEditingThisStep = isSelected && (
              (selectedVariantId && displayVariant?.id === selectedVariantId) ||
              (!selectedVariantId && variants.length === 0)
            )
            const displaySubject = isEditingThisStep
              ? (subject || '<Empty subject>')
              : (displayVariant?.subject || step.subject || '<Empty subject>')
            
            return (
              <div
                key={step.id}
                className={`border rounded-lg p-4 bg-white dark:bg-gray-800 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => {
                  setSelectedStepId(step.id)
                  if (variants.length > 0) {
                    setSelectedVariantId(variants[0].id)
                  } else {
                    setSelectedVariantId(null)
                  }
                }}
              >
                {/* Header: Step number and Delete button */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    Step {step.step_number}
                  </h3>
                  {isDraft && step.step_number !== 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteStep(step.id)
                      }}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 transition-colors"
                      title="Delete step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Subject Lines - Show all variants as separate subject lines */}
                <div className="mb-3 space-y-2">
                  {variants.length > 0 ? (
                    // Show each variant as a subject line
                    variants.map((variant, index) => {
                      const isSelectedVariant = isSelected && selectedVariantId === variant.id
                      const variantSubject = isSelectedVariant && step.id === selectedStepId
                        ? (subject || '<Empty subject>')
                        : (variant.subject || '<Empty subject>')
                      const isFirstVariant = variant.variant_number === 1 || index === 0
                      
                      return (
                        <div key={variant.id} className="relative group">
                          <input
                            type="text"
                            value={variantSubject === '<Empty subject>' ? '' : variantSubject}
                            readOnly
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedStepId(step.id)
                              setSelectedVariantId(variant.id)
                            }}
                            className={`w-full px-3 py-2.5 ${!isFirstVariant && isDraft ? 'pr-10' : 'pr-3'} text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors ${
                              isSelectedVariant
                                ? 'border-blue-500 ring-2 ring-blue-500'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                            placeholder="<Empty subject>"
                          />
                          {isDraft && !isFirstVariant && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteVariant(step.id, variant.id)
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 transition-colors"
                              title="Delete variant"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    // Show base step subject if no variants
                    <input
                      type="text"
                      value={isEditingThisStep ? (subject === '<Empty subject>' ? '' : subject) : (step.subject === '<Empty subject>' ? '' : step.subject)}
                      readOnly
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedStepId(step.id)
                        setSelectedVariantId(null)
                      }}
                      className={`w-full px-3 py-2.5 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors ${
                        isSelected && !selectedVariantId
                          ? 'border-blue-500 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      placeholder="<Empty subject>"
                    />
                  )}
                </div>
                
                {/* Add Variant Button - Centered */}
                {isDraft && (
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddVariant(step.id)
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add variant
                    </button>
                  </div>
                )}
                
                {/* Send next message in - Delay Configuration */}
                <div 
                  className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    Send next message in
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={isSelected && step.id === selectedStepId ? delayDays : (step.delay_days || 0)}
                    onChange={(e) => {
                      if (isDraft && step.id === selectedStepId) {
                        setDelayDays(parseInt(e.target.value) || 0)
                      }
                    }}
                    disabled={!isDraft || step.id !== selectedStepId}
                    className="w-12 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Days
                  </span>
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
            {/* Top Section - Subject and Preview */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject === '<Empty subject>' ? '' : subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!isDraft}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="Your subject"
                />
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button 
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Advanced Settings"
                >
                  <Zap className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Main Content Editor Area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
              {showPreview ? (
                <div className="flex-1 p-6 overflow-y-auto">
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
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Advanced Settings - Collapsible (hidden by default, accessible via Zap button) */}
                  {showAdvancedSettings && (
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-4">
                      {/* Delay Configuration */}
                      <div className="grid grid-cols-2 gap-4">
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

                      {/* Split Testing Section */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Split Testing (A/B Testing)
                            </h3>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={splitTestEnabled}
                              onChange={(e) => {
                                setSplitTestEnabled(e.target.checked)
                                if (e.target.checked && selectedStep) {
                                  if (!selectedStep.variants || selectedStep.variants.length < 2) {
                                    alert('You need at least 2 variants to enable split testing. Add a variant first.')
                                    e.target.checked = false
                                    return
                                  }
                                }
                              }}
                              disabled={!isDraft || !selectedStep || (selectedStep.variants?.length || 0) < 2}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        {splitTestEnabled && selectedStep && (selectedStep.variants?.length || 0) >= 2 && (
                          <div className="space-y-4">
                            {/* Distribution Method */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Distribution Method
                              </label>
                              <select
                                value={distributionMethod}
                                onChange={(e) => setDistributionMethod(e.target.value as any)}
                                disabled={!isDraft}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                              >
                                <option value="equal">Equal Split (50/50)</option>
                                <option value="percentage">Custom Percentages</option>
                                <option value="weighted">Weighted Distribution</option>
                              </select>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                How recipients are distributed across variants
                              </p>
                            </div>

                            {/* Winner Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Winner Selection Criteria
                              </label>
                              <select
                                value={winnerCriteria}
                                onChange={(e) => setWinnerCriteria(e.target.value as any)}
                                disabled={!isDraft}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                              >
                                <option value="open_rate">Highest Open Rate</option>
                                <option value="click_rate">Highest Click Rate</option>
                                <option value="reply_rate">Highest Reply Rate</option>
                                <option value="conversion_rate">Highest Conversion Rate</option>
                                <option value="manual">Manual Selection</option>
                              </select>
                            </div>

                            {/* Auto-select Winner */}
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="auto-select-winner"
                                checked={autoSelectWinner}
                                onChange={(e) => setAutoSelectWinner(e.target.checked)}
                                disabled={!isDraft}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="auto-select-winner" className="text-sm text-gray-700 dark:text-gray-300">
                                Automatically select winner based on criteria
                              </label>
                            </div>

                            {/* Save Split Test Button */}
                            <button
                              onClick={handleSaveSplitTest}
                              disabled={!isDraft || loadingSplitTest}
                              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {loadingSplitTest ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                'Save Split Test Configuration'
                              )}
                            </button>

                            {/* Split Test Analytics */}
                            {splitTestAnalytics && splitTestAnalytics.variants && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Performance
                                </h4>
                                <div className="space-y-3">
                                  {splitTestAnalytics.variants.map((variant: any) => (
                                    <div
                                      key={variant.variant_id}
                                      className={`p-3 rounded-lg border ${
                                        splitTestAnalytics.winner?.variant_id === variant.variant_id
                                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                          {variant.variant_name || `Variant ${variant.variant_number}`}
                                        </span>
                                        {splitTestAnalytics.winner?.variant_id === variant.variant_id && (
                                          <Award className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        )}
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Sent:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {variant.total_sent || 0}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Open Rate:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {variant.open_rate?.toFixed(1) || 0}%
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500 dark:text-gray-400">Click Rate:</span>
                                          <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                            {variant.click_rate?.toFixed(1) || 0}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {splitTestEnabled && selectedStep && (selectedStep.variants?.length || 0) < 2 && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              You need at least 2 variants to enable split testing. Add a variant first.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Main Text Editor */}
                  <div className="flex-1 p-6">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={!isDraft}
                      className="w-full h-full px-4 py-3 border-0 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base"
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
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={handleSave}
                    disabled={saving || autoSaving}
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
                {/* Autosave indicator */}
                {autoSaving ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Autosaving...</span>
                  </div>
                ) : lastSaved ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </div>
                ) : null}
              </div>
              
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                  <Sparkles className="w-4 h-4" />
                  AI Tools
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                  <FileText className="w-4 h-4" />
                  Templates
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                  <Tag className="w-4 h-4" />
                  Variables
                </button>
                <button className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Format">
                  <Type className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Link">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Add">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Code">
                  <Code className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Email Modal */}
      {showPreviewModal && (
        <PreviewEmailModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          subject={subject}
          body={body}
          campaignId={campaignId}
        />
      )}
    </div>
  )
}

