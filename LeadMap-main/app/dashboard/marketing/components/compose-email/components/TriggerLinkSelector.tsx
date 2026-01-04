'use client'

import { useState, useEffect, useMemo } from 'react'
import { Link, Search, X, ExternalLink, Copy, Check } from 'lucide-react'

/**
 * Trigger Link Selector Component
 * Allows users to select and insert trigger links into email content
 * Following Mautic patterns, .cursorrules guidelines
 */

interface TriggerLink {
  id: string
  name: string
  link_key: string
  link_url: string
  description?: string
  click_count?: number
}

interface TriggerLinkSelectorProps {
  onSelect: (linkKey: string, linkUrl: string) => void
  onClose?: () => void
  baseUrl?: string
}

export default function TriggerLinkSelector({
  onSelect,
  onClose,
  baseUrl,
}: TriggerLinkSelectorProps) {
  const [triggerLinks, setTriggerLinks] = useState<TriggerLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  useEffect(() => {
    fetchTriggerLinks()
  }, [])

  const fetchTriggerLinks = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/trigger-links', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch trigger links')
      }

      const data = await response.json()
      setTriggerLinks(data.triggerLinks || [])
    } catch (err) {
      console.error('Error fetching trigger links:', err)
      setError(err instanceof Error ? err.message : 'Failed to load trigger links')
    } finally {
      setLoading(false)
    }
  }

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) {
      return triggerLinks
    }

    const query = searchQuery.toLowerCase()
    return triggerLinks.filter(
      (link) =>
        link.name.toLowerCase().includes(query) ||
        link.link_key.toLowerCase().includes(query) ||
        link.link_url.toLowerCase().includes(query) ||
        (link.description && link.description.toLowerCase().includes(query))
    )
  }, [triggerLinks, searchQuery])

  const handleSelect = (link: TriggerLink) => {
    const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const triggerUrl = `${appUrl}/t/${link.link_key}`
    onSelect(link.link_key, triggerUrl)
    if (onClose) {
      onClose()
    }
  }

  const handleCopyUrl = async (link: TriggerLink) => {
    const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const triggerUrl = `${appUrl}/t/${link.link_key}`
    
    try {
      await navigator.clipboard.writeText(triggerUrl)
      setCopiedLinkId(link.id)
      setTimeout(() => setCopiedLinkId(null), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchTriggerLinks}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Insert Trigger Link</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              aria-label="Close trigger link selector"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search trigger links..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search trigger links"
          />
        </div>
      </div>

      {/* Links List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredLinks.length === 0 ? (
          <div className="text-center py-8">
            <Link className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No trigger links found' : 'No trigger links available'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Create trigger links in Settings to use them in emails
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLinks.map((link) => (
              <div
                key={link.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {link.name}
                    </h4>
                    {link.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                        {link.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {link.link_key}
                      </code>
                      {link.click_count !== undefined && (
                        <span>{link.click_count} clicks</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyUrl(link)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                      aria-label="Copy trigger link URL"
                      title="Copy URL"
                    >
                      {copiedLinkId === link.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleSelect(link)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      aria-label={`Insert ${link.name} trigger link`}
                    >
                      <Link className="w-3 h-3" />
                      Insert
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Trigger links track clicks and can execute actions like adding contacts to segments
        </p>
      </div>
    </div>
  )
}

