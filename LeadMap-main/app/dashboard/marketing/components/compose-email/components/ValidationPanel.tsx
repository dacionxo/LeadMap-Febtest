'use client'

import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ValidationResult } from '../utils/email-validation'

/**
 * Validation Panel Component
 * Displays email validation errors, warnings, and info messages
 * Following .cursorrules: TailwindCSS, accessibility, TypeScript interfaces
 */

interface ValidationPanelProps {
  validationResult: ValidationResult
  onClose?: () => void
  className?: string
}

export default function ValidationPanel({
  validationResult,
  onClose,
  className = '',
}: ValidationPanelProps) {
  const hasIssues = validationResult.errors.length > 0 || validationResult.warnings.length > 0

  if (!hasIssues && validationResult.info.length === 0) {
    return (
      <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <Info className="w-5 h-5" />
          <p className="text-sm font-medium">Email validation passed</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Email Validation</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
            aria-label="Close validation panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Errors */}
        {validationResult.errors.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Errors ({validationResult.errors.length})
            </h4>
            <ul className="space-y-2">
              {validationResult.errors.map((error, index) => (
                <li
                  key={index}
                  className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2"
                >
                  <span className="mt-0.5">•</span>
                  <span>{error.message}</span>
                  {error.element && (
                    <span className="text-xs text-red-500 dark:text-red-500 opacity-75">
                      ({error.element})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {validationResult.warnings.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Warnings ({validationResult.warnings.length})
            </h4>
            <ul className="space-y-2">
              {validationResult.warnings.map((warning, index) => (
                <li
                  key={index}
                  className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2"
                >
                  <span className="mt-0.5">•</span>
                  <span>{warning.message}</span>
                  {warning.element && (
                    <span className="text-xs text-amber-500 dark:text-amber-500 opacity-75">
                      ({warning.element})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Info */}
        {validationResult.info.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
              <Info className="w-4 h-4" />
              Recommendations ({validationResult.info.length})
            </h4>
            <ul className="space-y-2">
              {validationResult.info.map((info, index) => (
                <li
                  key={index}
                  className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2"
                >
                  <span className="mt-0.5">•</span>
                  <span>{info.message}</span>
                  {info.element && (
                    <span className="text-xs text-blue-500 dark:text-blue-500 opacity-75">
                      ({info.element})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}









