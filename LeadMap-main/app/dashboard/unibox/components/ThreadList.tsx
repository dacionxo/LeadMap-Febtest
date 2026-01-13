'use client'

import { Mail, RefreshCw } from 'lucide-react'

interface Thread {
  id: string
  subject: string
  mailbox: {
    id: string
    email: string
    display_name: string | null
    provider: string
  }
  status: string // 'open' | 'needs_reply' | 'waiting' | 'closed' | 'ignored'
  unread: boolean
  unreadCount: number
  starred: boolean
  archived: boolean
  lastMessage: {
    direction: 'inbound' | 'outbound'
    snippet: string
    received_at: string | null
    read: boolean
  } | null
  lastMessageAt: string
  contactId: string | null
  listingId: string | null
  campaignId: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface Props {
  threads: Thread[]
  selectedThread: Thread | null
  onThreadSelect: (thread: Thread) => void
  loading: boolean
}

export default function ThreadList({ threads, selectedThread, onThreadSelect, loading }: Props) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No threads found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {threads.map((thread) => {
        const isSelected = selectedThread?.id === thread.id
        const snippet = thread.lastMessage?.snippet || 'No preview'
        const truncatedSnippet = snippet.length > 100 ? snippet.substring(0, 100) + '...' : snippet

        return (
          <button
            key={thread.id}
            onClick={() => onThreadSelect(thread)}
            className={`w-full text-left p-4 border-b border-gray-200 dark:border-gray-700 transition-colors ${
              isSelected
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-semibold truncate ${
                    thread.unread
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {thread.subject || '(No Subject)'}
                  </span>
                  {thread.unread && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {thread.mailbox.display_name || thread.mailbox.email}
                  </span>
                  {thread.messageCount > 1 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ({thread.messageCount})
                    </span>
                  )}
                </div>
              </div>
              {thread.lastMessageAt && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                  {formatDate(thread.lastMessageAt)}
                </span>
              )}
            </div>
            <p className={`text-sm line-clamp-2 ${
              thread.unread
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {truncatedSnippet}
            </p>
            {thread.status !== 'open' && (
              <div className="mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  thread.status === 'needs_reply'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                    : thread.status === 'closed'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {thread.status.replace('_', ' ')}
                </span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

