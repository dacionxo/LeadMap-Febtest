'use client'

import { Code, Layout, FileText } from 'lucide-react'
import type { EmailEditorProps } from '../types'

/**
 * Email Editor Basic Component
 * Basic HTML editor (temporary until GrapesJS integration in Phase 3)
 * Following .cursorrules patterns: TailwindCSS, accessibility
 */
export default function EmailEditorBasic({
  content,
  mode,
  onChange,
  onModeChange,
}: EmailEditorProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              HTML Editor
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Mode toggle buttons (disabled until Phase 3) */}
            <button
              disabled
              className="px-2 py-1 text-xs text-gray-400 dark:text-gray-600 cursor-not-allowed flex items-center gap-1"
              title="Builder mode (coming in Phase 3)"
              aria-label="Builder mode (coming soon)"
            >
              <Layout className="w-3 h-3" />
              Builder
            </button>
            <button
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded flex items-center gap-1"
              aria-label="HTML mode (active)"
            >
              <Code className="w-3 h-3" />
              HTML
            </button>
            <button
              disabled
              className="px-2 py-1 text-xs text-gray-400 dark:text-gray-600 cursor-not-allowed flex items-center gap-1"
              title="MJML mode (coming in Phase 3)"
              aria-label="MJML mode (coming soon)"
            >
              <FileText className="w-3 h-3" />
              MJML
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full px-4 py-3 border-0 resize-none focus:outline-none focus:ring-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
          placeholder="Enter your email content in HTML format..."
          aria-label="Email HTML content editor"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Editor Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          HTML editor - Visual builder and MJML editor coming in Phase 3
        </p>
      </div>
    </div>
  )
}

