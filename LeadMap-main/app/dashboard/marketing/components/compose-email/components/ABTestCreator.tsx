'use client'

import { useState, useCallback } from 'react'
import { Plus, X, Save, TestTube } from 'lucide-react'

/**
 * A/B Test Creator Component
 * Allows creating A/B test variants for emails
 * Following Mautic patterns, .cursorrules guidelines
 */

export type ABTestVariantType = 'subject' | 'content' | 'from' | 'combined'

interface ABTestVariant {
  id: string
  name: string
  subject?: string
  content?: string
  fromName?: string
  fromEmail?: string
}

interface ABTestCreatorProps {
  baseSubject: string
  baseContent: string
  baseFromName?: string
  baseFromEmail?: string
  onSave?: (testConfig: {
    variantType: ABTestVariantType
    variants: ABTestVariant[]
    winnerCriteria: 'open_rate' | 'click_rate' | 'reply_rate'
    minimumSampleSize: number
    confidenceLevel: number
  }) => Promise<void>
  onClose?: () => void
}

export default function ABTestCreator({
  baseSubject,
  baseContent,
  baseFromName,
  baseFromEmail,
  onSave,
  onClose,
}: ABTestCreatorProps) {
  const [variantType, setVariantType] = useState<ABTestVariantType>('subject')
  const [variants, setVariants] = useState<ABTestVariant[]>([
    {
      id: 'variant-1',
      name: 'Variant A',
      subject: baseSubject,
      content: baseContent,
      fromName: baseFromName,
      fromEmail: baseFromEmail,
    },
    {
      id: 'variant-2',
      name: 'Variant B',
      subject: baseSubject,
      content: baseContent,
      fromName: baseFromName,
      fromEmail: baseFromEmail,
    },
  ])
  const [winnerCriteria, setWinnerCriteria] = useState<'open_rate' | 'click_rate' | 'reply_rate'>('open_rate')
  const [minimumSampleSize, setMinimumSampleSize] = useState(100)
  const [confidenceLevel, setConfidenceLevel] = useState(95)
  const [saving, setSaving] = useState(false)

  const handleAddVariant = useCallback(() => {
    const newVariant: ABTestVariant = {
      id: `variant-${variants.length + 1}`,
      name: `Variant ${String.fromCharCode(65 + variants.length)}`,
      subject: baseSubject,
      content: baseContent,
      fromName: baseFromName,
      fromEmail: baseFromEmail,
    }
    setVariants([...variants, newVariant])
  }, [variants, baseSubject, baseContent, baseFromName, baseFromEmail])

  const handleRemoveVariant = useCallback((id: string) => {
    if (variants.length <= 2) {
      alert('You need at least 2 variants for an A/B test')
      return
    }
    setVariants(variants.filter((v) => v.id !== id))
  }, [variants])

  const handleUpdateVariant = useCallback((id: string, updates: Partial<ABTestVariant>) => {
    setVariants(variants.map((v) => (v.id === id ? { ...v, ...updates } : v)))
  }, [variants])

  const handleSave = useCallback(async () => {
    if (!onSave) return

    try {
      setSaving(true)
      await onSave({
        variantType,
        variants,
        winnerCriteria,
        minimumSampleSize,
        confidenceLevel,
      })
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('Error saving A/B test:', error)
      alert('Failed to save A/B test. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [variantType, variants, winnerCriteria, minimumSampleSize, confidenceLevel, onSave, onClose])

  return (
    <div className="space-y-6">
      {/* Variant Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Test Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['subject', 'content', 'from', 'combined'] as ABTestVariantType[]).map((type) => (
            <button
              key={type}
              onClick={() => setVariantType(type)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                variantType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Variants ({variants.length})
          </label>
          <button
            onClick={handleAddVariant}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Variant
          </button>
        </div>

        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div
              key={variant.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {variant.name}
                </h4>
                {variants.length > 2 && (
                  <button
                    onClick={() => handleRemoveVariant(variant.id)}
                    className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded transition-colors"
                    aria-label={`Remove ${variant.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(variantType === 'subject' || variantType === 'combined') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={variant.subject || ''}
                    onChange={(e) => handleUpdateVariant(variant.id, { subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email subject"
                  />
                </div>
              )}

              {(variantType === 'content' || variantType === 'combined') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Content
                  </label>
                  <textarea
                    value={variant.content || ''}
                    onChange={(e) => handleUpdateVariant(variant.id, { content: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email content"
                  />
                </div>
              )}

              {(variantType === 'from' || variantType === 'combined') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={variant.fromName || ''}
                      onChange={(e) => handleUpdateVariant(variant.id, { fromName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="From name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={variant.fromEmail || ''}
                      onChange={(e) => handleUpdateVariant(variant.id, { fromEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="from@example.com"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test Configuration */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Test Configuration</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Winner Criteria
          </label>
          <select
            value={winnerCriteria}
            onChange={(e) => setWinnerCriteria(e.target.value as typeof winnerCriteria)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="open_rate">Open Rate</option>
            <option value="click_rate">Click Rate</option>
            <option value="reply_rate">Reply Rate</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Sample Size
            </label>
            <input
              type="number"
              value={minimumSampleSize}
              onChange={(e) => setMinimumSampleSize(parseInt(e.target.value, 10) || 100)}
              min={10}
              max={10000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confidence Level (%)
            </label>
            <input
              type="number"
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(parseInt(e.target.value, 10) || 95)}
              min={80}
              max={99}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <TestTube className="w-4 h-4" />
          {saving ? 'Saving...' : 'Create A/B Test'}
        </button>
      </div>
    </div>
  )
}

