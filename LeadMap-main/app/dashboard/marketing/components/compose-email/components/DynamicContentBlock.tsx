'use client'

import { useState } from 'react'
import { Filter, Plus, X, AlertCircle } from 'lucide-react'
import type { DynamicContentBlock, DynamicContentVariant, DynamicContentFilter } from '../types'
import type { TokenCategory } from '../types'

/**
 * Dynamic Content Block Component
 * Manages dynamic content variants with filters (Mautic pattern)
 * Following .cursorrules: TailwindCSS, accessibility, TypeScript interfaces
 */
interface DynamicContentBlockProps {
  block: DynamicContentBlock
  onBlockChange: (block: DynamicContentBlock) => void
  onRemove?: () => void
}

export default function DynamicContentBlockComponent({
  block,
  onBlockChange,
  onRemove,
}: DynamicContentBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleVariantChange = (variantId: string, updates: Partial<DynamicContentVariant>) => {
    const updatedVariants = block.variants.map((v) =>
      v.id === variantId ? { ...v, ...updates } : v
    )
    onBlockChange({
      ...block,
      variants: updatedVariants,
    })
  }

  const handleAddVariant = () => {
    const newVariant: DynamicContentVariant = {
      id: `variant-${Date.now()}`,
      name: `Variant ${block.variants.length + 1}`,
      content: '',
      filters: [],
      isDefault: block.variants.length === 0,
      order: block.variants.length,
    }
    onBlockChange({
      ...block,
      variants: [...block.variants, newVariant],
    })
  }

  const handleRemoveVariant = (variantId: string) => {
    const updatedVariants = block.variants.filter((v) => v.id !== variantId)
    if (updatedVariants.length > 0 && !updatedVariants.some((v) => v.isDefault)) {
      // Set first variant as default if no default exists
      updatedVariants[0].isDefault = true
    }
    onBlockChange({
      ...block,
      variants: updatedVariants,
    })
  }

  const handleSetDefault = (variantId: string) => {
    const updatedVariants = block.variants.map((v) => ({
      ...v,
      isDefault: v.id === variantId,
    }))
    onBlockChange({
      ...block,
      variants: updatedVariants,
    })
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      {/* Header */}
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {block.tokenName || 'Dynamic Content'}
            </span>
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
              {block.variants.length} {block.variants.length === 1 ? 'variant' : 'variants'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Remove dynamic content block"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Token Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token Name
            </label>
            <input
              type="text"
              value={block.tokenName}
              onChange={(e) =>
                onBlockChange({
                  ...block,
                  tokenName: e.target.value,
                })
              }
              placeholder="e.g., greeting"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Token name"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use {`{${block.tokenName || 'token'}}`} in your email content
            </p>
          </div>

          {/* Default Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Content
            </label>
            <textarea
              value={block.defaultContent}
              onChange={(e) =>
                onBlockChange({
                  ...block,
                  defaultContent: e.target.value,
                })
              }
              placeholder="Default content shown when no filters match"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Default content"
            />
          </div>

          {/* Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Variants
              </label>
              <button
                onClick={handleAddVariant}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                aria-label="Add variant"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </button>
            </div>

            {block.variants.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No variants yet. Add a variant to show different content based on filters.</p>
              </div>
            ) : (
              block.variants.map((variant, index) => (
                <VariantCard
                  key={variant.id}
                  variant={variant}
                  index={index}
                  isDefault={variant.isDefault}
                  onChange={(updates) => handleVariantChange(variant.id, updates)}
                  onRemove={() => handleRemoveVariant(variant.id)}
                  onSetDefault={() => handleSetDefault(variant.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Variant Card Component
 */
interface VariantCardProps {
  variant: DynamicContentVariant
  index: number
  isDefault: boolean
  onChange: (updates: Partial<DynamicContentVariant>) => void
  onRemove: () => void
  onSetDefault: () => void
}

function VariantCard({ variant, index, isDefault, onChange, onRemove, onSetDefault }: VariantCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      {/* Variant Header */}
      <div
        className="p-3 border-b border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {variant.name}
            </span>
            {isDefault && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                Default
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {variant.filters.length} {variant.filters.length === 1 ? 'filter' : 'filters'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSetDefault()
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                aria-label="Set as default"
              >
                Set Default
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label="Remove variant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Variant Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Variant Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Variant Name
            </label>
            <input
              type="text"
              value={variant.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Variant name"
            />
          </div>

          {/* Variant Content */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              value={variant.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Content shown when filters match"
              rows={3}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Variant content"
            />
          </div>

          {/* Filters - Simplified for now */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filters
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Advanced filter configuration coming soon. For now, variants are shown based on order.
            </p>
            {variant.filters.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {variant.filters.length} filter{variant.filters.length !== 1 ? 's' : ''} configured
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}









