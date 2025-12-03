'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { 
  Search, 
  Filter, 
  Edit3, 
  ChevronDown,
  Phone,
  MessageCircle,
  Bell,
  HelpCircle,
  User,
  Send,
  Paperclip,
  MoreVertical,
  Star,
  Trash2,
  Archive,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react'
// Twilio is server-side only, so we'll use a local utility function
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.substring(1, 4)
    const prefix = digits.substring(4, 7)
    const line = digits.substring(7, 11)
    return `(${area}) ${prefix}-${line}`
  } else if (digits.length === 10) {
    const area = digits.substring(0, 3)
    const prefix = digits.substring(3, 6)
    const line = digits.substring(6, 10)
    return `(${area}) ${prefix}-${line}`
  }
  return phone
}

interface Conversation {
  id: string
  lead_phone: string
  twilio_conversation_sid: string
  listing_id: string | null
  status: string
  last_message_at: string | null
  last_inbound_at: string | null
  last_outbound_at: string | null
  unread_count: number
  created_at: string
  listings: {
    listing_id: string
    street: string | null
    city: string | null
    state: string | null
    agent_name: string | null
  } | null
  message_count: number
  last_message: {
    body: string
    direction: 'inbound' | 'outbound'
    created_at: string
  } | null
}

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export default function ConversationsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'conversations' | 'manual-actions' | 'snippets' | 'trigger-links'>('conversations')
  const [activeSidebarTab, setActiveSidebarTab] = useState<'unread' | 'recents' | 'starred' | 'all'>('all')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessage, setNewMessage] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations()
  }, [activeSidebarTab, searchQuery])

  // Poll for new messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id)
      
      // Start polling for new messages every 5 seconds
      pollIntervalRef.current = setInterval(() => {
        fetchMessages(selectedConversation.id, true)
      }, 5000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [selectedConversation])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversations = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (activeSidebarTab === 'unread') {
        params.set('unread', 'true')
      }
      if (activeSidebarTab === 'recents') {
        params.set('status', 'active')
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const response = await fetch(`/api/sms/conversations?${params}`)
      if (!response.ok) throw new Error('Failed to fetch conversations')

      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true)

      const response = await fetch(`/api/sms/messages?conversationId=${conversationId}`)
      if (!response.ok) throw new Error('Failed to fetch messages')

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConversation || !newMessage.trim() || sending) return

    try {
      setSending(true)

      const response = await fetch('/api/sms/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          text: newMessage
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      setNewMessage('')
      await fetchMessages(selectedConversation.id)
      await fetchConversations() // Refresh conversation list
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const getMessageStatusIcon = (msg: Message) => {
    if (msg.direction === 'inbound') return null

    if (msg.status === 'delivered') {
      return <CheckCheck className="w-3 h-3 text-blue-500" />
    } else if (msg.status === 'sent') {
      return <Check className="w-3 h-3 text-gray-400" />
    } else if (msg.status === 'failed') {
      return <AlertCircle className="w-3 h-3 text-red-500" />
    } else {
      return <Clock className="w-3 h-3 text-gray-400" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] bg-white dark:bg-gray-900">
        {/* Top Header Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          {/* Left: Title and Main Tabs */}
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">SMS Conversations</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveMainTab('conversations')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === 'conversations'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Conversations
              </button>
              <button
                onClick={() => setActiveMainTab('manual-actions')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === 'manual-actions'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Manual Actions
              </button>
              <button
                onClick={() => setActiveMainTab('snippets')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === 'snippets'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Snippets
              </button>
            </div>
          </div>

          {/* Right: Status Icons */}
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Twilio Connected</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Conversations List */}
          <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Sidebar Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-4 pt-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveSidebarTab('unread')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'unread'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setActiveSidebarTab('recents')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'recents'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Recents
                </button>
                <button
                  onClick={() => setActiveSidebarTab('all')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'all'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search phone number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Results Count */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {conversations.length} {conversations.length === 1 ? 'CONVERSATION' : 'CONVERSATIONS'}
              </span>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 px-4">
                  <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    No conversations found
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {conversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => setSelectedConversation(convo)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedConversation?.id === convo.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {convo.listings?.agent_name?.[0] || convo.lead_phone.slice(-4)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {convo.listings?.agent_name || formatPhoneNumber(convo.lead_phone)}
                            </div>
                            {convo.last_message_at && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                                {formatTimestamp(convo.last_message_at)}
                              </span>
                            )}
                          </div>
                          {convo.listings && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                              {convo.listings.street}, {convo.listings.city}
                            </div>
                          )}
                          {convo.last_message && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {convo.last_message.direction === 'outbound' ? 'You: ' : ''}
                              {convo.last_message.body}
                            </div>
                          )}
                          {convo.unread_count > 0 && (
                            <div className="mt-2">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                                {convo.unread_count}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center - Messages View */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
            {selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                        {selectedConversation.listings?.agent_name?.[0] || selectedConversation.lead_phone.slice(-4)}
                      </div>
                      <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                          {selectedConversation.listings?.agent_name || 'Contact'}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatPhoneNumber(selectedConversation.lead_phone)}
                        </p>
                        {selectedConversation.listings && (
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {selectedConversation.listings.street}, {selectedConversation.listings.city}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <Archive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            msg.direction === 'outbound'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <div className={`flex items-center gap-1 mt-1 text-xs ${
                            msg.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {getMessageStatusIcon(msg)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
                  <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage(e)
                          }
                        }}
                        placeholder="Type a message..."
                        rows={1}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                        Press Enter to send, Shift+Enter for new line
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Select a conversation to start messaging
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right - Contact Details */}
          {selectedConversation && (
            <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-2xl mx-auto mb-3">
                  {selectedConversation.listings?.agent_name?.[0] || selectedConversation.lead_phone.slice(-4)}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {selectedConversation.listings?.agent_name || 'Contact'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatPhoneNumber(selectedConversation.lead_phone)}
                </p>
              </div>

              {selectedConversation.listings && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Property</h4>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedConversation.listings.street}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedConversation.listings.city}, {selectedConversation.listings.state}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Conversation Stats</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Messages</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedConversation.message_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">{selectedConversation.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Started</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedConversation.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
