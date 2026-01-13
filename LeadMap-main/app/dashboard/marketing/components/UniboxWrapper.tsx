'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Mail, 
  Search,
  RefreshCw
} from 'lucide-react'
import UniboxSidebar from '../../unibox/components/UniboxSidebar'
import ThreadList from '../../unibox/components/ThreadList'
import ThreadView from '../../unibox/components/ThreadView'
import ReplyComposer from '../../unibox/components/ReplyComposer'

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

interface Mailbox {
  id: string
  email: string
  display_name: string | null
  provider: string
  active: boolean
}

type FilterStatus = 'all' | 'open' | 'needs_reply' | 'waiting' | 'closed' | 'ignored'
type FilterFolder = 'inbox' | 'archived' | 'starred'

/**
 * UniboxWrapper - Adapted version of UniboxContent for use within EmailMarketing tabs
 * Removes full-screen layout and adapts to tab context
 */
export default function UniboxWrapper() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [threadDetails, setThreadDetails] = useState<any>(null)
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [folderFilter, setFolderFilter] = useState<FilterFolder>('inbox')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [composerMode, setComposerMode] = useState<'reply' | 'reply-all' | 'forward' | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Fetch mailboxes
  useEffect(() => {
    fetchMailboxes()
  }, [])

  // Fetch threads
  useEffect(() => {
    fetchThreads()
  }, [selectedMailboxId, statusFilter, folderFilter, searchQuery, page])

  const fetchMailboxes = async () => {
    try {
      const response = await fetch('/api/mailboxes')
      if (response.ok) {
        const data = await response.json()
        setMailboxes(data.mailboxes || [])
      }
    } catch (error) {
      console.error('Error fetching mailboxes:', error)
    }
  }

  const fetchThreads = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedMailboxId) params.append('mailboxId', selectedMailboxId)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)
      
      // Add folder filter support
      if (folderFilter === 'archived') {
        params.append('folder', 'archived')
      } else if (folderFilter === 'starred') {
        params.append('folder', 'starred')
      } else if (folderFilter === 'inbox') {
        params.append('folder', 'inbox')
      }
      
      params.append('page', page.toString())
      params.append('pageSize', '50')

      const response = await fetch(`/api/unibox/threads?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setThreads(data.threads || [])
        setHasMore(data.pagination.page < data.pagination.totalPages)
        
        // Auto-select first thread if none selected
        if (!selectedThread && data.threads && data.threads.length > 0) {
          handleThreadSelect(data.threads[0])
        }
      }
    } catch (error) {
      console.error('Error fetching threads:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchThreadDetails = async (threadId: string) => {
    try {
      setLoadingThread(true)
      const response = await fetch(`/api/unibox/threads/${threadId}`)
      if (response.ok) {
        const data = await response.json()
        setThreadDetails(data.thread)
      }
    } catch (error) {
      console.error('Error fetching thread details:', error)
    } finally {
      setLoadingThread(false)
    }
  }

  const handleThreadSelect = useCallback((thread: Thread) => {
    setSelectedThread(thread)
    fetchThreadDetails(thread.id)
  }, [])

  const handleReply = () => {
    setComposerMode('reply')
    setShowComposer(true)
  }

  const handleReplyAll = () => {
    setComposerMode('reply-all')
    setShowComposer(true)
  }

  const handleForward = () => {
    setComposerMode('forward')
    setShowComposer(true)
  }

  const handleComposerClose = () => {
    setShowComposer(false)
    setComposerMode(null)
  }

  const handleComposerSend = async (data: any) => {
    if (!selectedThread) return

    try {
      let endpoint = ''
      let body: any = {}

      if (composerMode === 'reply' || composerMode === 'reply-all') {
        endpoint = `/api/unibox/threads/${selectedThread.id}/reply`
        body = {
          mailboxId: selectedThread.mailbox.id,
          bodyHtml: data.bodyHtml,
          bodyText: data.bodyText,
          replyAll: composerMode === 'reply-all',
          cc: data.cc || [],
          bcc: data.bcc || []
        }
      } else if (composerMode === 'forward') {
        endpoint = `/api/unibox/threads/${selectedThread.id}/forward`
        body = {
          mailboxId: selectedThread.mailbox.id,
          to: data.to,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          bodyText: data.bodyText
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        handleComposerClose()
        if (selectedThread) {
          fetchThreadDetails(selectedThread.id)
          fetchThreads()
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to send'}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to send'}`)
    }
  }

  const handleRefresh = () => {
    fetchThreads()
    if (selectedThread) {
      fetchThreadDetails(selectedThread.id)
    }
  }

  // Get unread count
  const unreadCount = threads.filter(t => t.unread).length

  // Get mailbox for unread counts
  const mailboxUnreadCounts = mailboxes.reduce((acc, mb) => {
    acc[mb.id] = threads.filter(t => t.mailbox.id === mb.id && t.unread).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="h-[calc(100vh-250px)] flex flex-col bg-gray-50 dark:bg-gray-900 -mx-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Unibox</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Unified inbox for all your email conversations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Three Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <UniboxSidebar
          mailboxes={mailboxes}
          selectedMailboxId={selectedMailboxId}
          onMailboxSelect={setSelectedMailboxId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          folderFilter={folderFilter}
          onFolderFilterChange={setFolderFilter}
          mailboxUnreadCounts={mailboxUnreadCounts}
          unreadCount={unreadCount}
        />

        {/* Middle - Thread List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Thread List */}
          <ThreadList
            threads={threads}
            selectedThread={selectedThread}
            onThreadSelect={handleThreadSelect}
            loading={loading}
          />
        </div>

        {/* Right - Thread View */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
          {selectedThread ? (
            <ThreadView
              thread={threadDetails}
              loading={loadingThread}
              onReply={handleReply}
              onReplyAll={handleReplyAll}
              onForward={handleForward}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No thread selected</p>
                <p className="text-sm">Select a thread from the list to view conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply/Forward Composer */}
      {showComposer && selectedThread && threadDetails && (
        <ReplyComposer
          thread={threadDetails}
          mode={composerMode}
          onClose={handleComposerClose}
          onSend={handleComposerSend}
          mailbox={selectedThread.mailbox}
        />
      )}
    </div>
  )
}

