'use client'

import { Send, Clock, X, Loader2, AlertCircle } from 'lucide-react'
import type { EmailComposerFooterProps } from '../types'

/**
 * Email Composer Footer Component
 * Footer with send, cancel actions and validation feedback
 * Following .cursorrules patterns: TailwindCSS, accessibility, error handling
 */
export default function EmailComposerFooter({
  onSend,
  onCancel,
  sending,
  isValid,
  validationErrors = [],
  sendType = 'now',
}: EmailComposerFooterProps) {
  const handleSend = async () => {
    if (!isValid) return
    try {
      await onSend()
    } catch (error) {
      console.error('Error sending email:', error)
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {/* Validation Errors */}
      {!isValid && validationErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
                Please fix the following errors:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={sending || !isValid}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={sendType === 'schedule' ? 'Schedule email' : 'Send email'}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {sendType === 'schedule' ? 'Scheduling...' : 'Sending...'}
              </>
            ) : (
              <>
                {sendType === 'schedule' ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {sendType === 'schedule' ? 'Schedule' : 'Send Now'}
              </>
            )}
          </button>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={sending}
            className="flex items-center gap-2 px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

