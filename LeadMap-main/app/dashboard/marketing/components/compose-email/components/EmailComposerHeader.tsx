'use client'

import { Save, Eye, Loader2 } from 'lucide-react'
import type { EmailComposerHeaderProps } from '../types'

/**
 * Email Composer Header Component
 * Header section with title, description, and action buttons
 * Following .cursorrules patterns: TailwindCSS, accessibility, dark mode
 */
function EmailComposerHeader({
  title = 'Compose Email',
  description = 'Create and send professional emails',
  status = 'draft',
  onSaveDraft,
  onPreview,
  saving = false,
}: EmailComposerHeaderProps) {
  const getStatusBadge = () => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
      scheduled: { label: 'Scheduled', className: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
      sending: { label: 'Sending', className: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
      sent: { label: 'Sent', className: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
    }
    const config = statusConfig[status] || statusConfig.draft
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {getStatusBadge()}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSaveDraft && (
          <button
            onClick={onSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Save draft"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Draft
              </>
            )}
          </button>
        )}
        {onPreview && (
          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Preview email"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        )}
      </div>
    </div>
  )
}

export default EmailComposerHeader
