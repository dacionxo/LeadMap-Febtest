'use client'

import { useState, useEffect } from 'react'
import { Loader2, FileText, Search, X } from 'lucide-react'
import type { TemplateSelectorProps, EmailTemplateSelection } from '../types'

/**
 * Template Selector Component
 * Fetches and displays email templates for selection
 * Following .cursorrules patterns: TailwindCSS, accessibility, error handling
 */
export default function TemplateSelector({
  selectedTemplateId,
  onTemplateSelect,
  onTemplateLoad,
  category,
  folderId,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplateSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [category, folderId])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/email-templates', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      let fetchedTemplates = data.templates || []

      // Filter by category if provided
      if (category) {
        fetchedTemplates = fetchedTemplates.filter(
          (t: EmailTemplateSelection) => t.category === category
        )
      }

      // Filter by folderId if provided
      if (folderId) {
        fetchedTemplates = fetchedTemplates.filter(
          (t: EmailTemplateSelection) => t.folderId === folderId
        )
      }

      setTemplates(fetchedTemplates)
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      onTemplateSelect(template)
      if (onTemplateLoad) {
        onTemplateLoad(template)
      }
    } else {
      onTemplateSelect(null)
    }
  }

  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      template.title.toLowerCase().includes(query) ||
      (template.category || '').toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading templates...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Templates
        </h3>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search templates"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Template List */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {searchQuery ? 'No templates found' : 'No templates available'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <select
            value={selectedTemplateId || ''}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Select template"
          >
            <option value="">-- Select a template --</option>
            {filteredTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
                {template.category && ` (${template.category})`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}



