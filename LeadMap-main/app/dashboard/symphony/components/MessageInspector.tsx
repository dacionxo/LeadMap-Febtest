/**
 * Message Inspector Component
 * Detailed view of a single message
 */

'use client'

import { useState, useEffect } from 'react'
import { Search, RefreshCw, Copy, Check, X } from 'lucide-react'

interface MessageInspectorProps {
  messageId: string | null
  onMessageIdChange?: (messageId: string) => void
}

export default function MessageInspector({
  messageId,
  onMessageIdChange,
}: MessageInspectorProps) {
  const [searchId, setSearchId] = useState(messageId || '')
  const [message, setMessage] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (messageId) {
      setSearchId(messageId)
      fetchMessage(messageId)
    }
  }, [messageId])

  const fetchMessage = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/symphony/admin/messages/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Message not found')
        }
        throw new Error('Failed to fetch message')
      }
      const data = await response.json()
      setMessage(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setMessage(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchId) {
      fetchMessage(searchId)
      onMessageIdChange?.(searchId)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter message ID..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <X className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {/* Message Details */}
      {message && (
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Message Details
              </h3>
              <button
                onClick={() => copyToClipboard(message.id)}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">
                  {message.id}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{message.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Transport</p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">
                  {message.transport_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Queue</p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">
                  {message.queue_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Priority</p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{message.priority}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Created At
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
              {message.processed_at && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Processed At
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {new Date(message.processed_at).toLocaleString()}
                  </p>
                </div>
              )}
              {message.available_at && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Available At
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {new Date(message.available_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Message Body */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Message Body
              </h3>
              <button
                onClick={() => copyToClipboard(formatJSON(message.body))}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 overflow-x-auto text-sm text-gray-900 dark:text-white">
              {formatJSON(message.body)}
            </pre>
          </div>

          {/* Headers */}
          {message.headers && Object.keys(message.headers).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Headers</h3>
                <button
                  onClick={() => copyToClipboard(formatJSON(message.headers))}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 overflow-x-auto text-sm text-gray-900 dark:text-white">
                {formatJSON(message.headers)}
              </pre>
            </div>
          )}

          {/* Metadata */}
          {message.metadata && Object.keys(message.metadata).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Metadata</h3>
                <button
                  onClick={() => copyToClipboard(formatJSON(message.metadata))}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 overflow-x-auto text-sm text-gray-900 dark:text-white">
                {formatJSON(message.metadata)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


