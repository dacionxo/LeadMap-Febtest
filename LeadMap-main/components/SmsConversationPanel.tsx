// components/SmsConversationPanel.tsx
/**
 * SMS Conversation Panel Component
 * 
 * A reusable component for displaying and managing SMS conversations.
 * Can be embedded in dashboard, lead detail pages, or map views.
 * 
 * Features:
 * - Real-time message display (polling)
 * - Send messages
 * - Message status indicators
 * - Auto-scroll to latest message
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { 
  Send, 
  Loader2, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle 
} from 'lucide-react'
import { formatPhoneNumber } from '@/lib/twilio'

type Listing = {
  id: string
  address?: string
  city?: string
  state?: string
  owner_name?: string
  owner_phone?: string
}

type SmsConversationPanelProps = {
  listing: Listing
  conversationId?: string
  leadPhone: string | null
  userId: string
  className?: string
}

type Message = {
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

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function SmsConversationPanel({
  listing,
  conversationId,
  leadPhone,
  userId,
  className = ''
}: SmsConversationPanelProps) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState(conversationId || null)

  const { data, mutate, error } = useSWR(
    currentConversationId ? `/api/sms/messages?conversationId=${currentConversationId}` : null,
    fetcher,
    { 
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: true
    }
  )

  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [data?.messages?.length])

  const messages: Message[] = data?.messages || []

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || pending) return
    
    if (!leadPhone && !currentConversationId) {
      alert('Lead has no phone number.')
      return
    }

    setPending(true)
    try {
      const payload: any = {
        text: text.trim(),
        userId
      }

      if (currentConversationId) {
        payload.conversationId = currentConversationId
      } else {
        payload.listingId = listing.id
        payload.leadPhone = leadPhone
      }

      const res = await fetch('/api/sms/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (!res.ok) {
        console.error(json)
        alert(json.error || 'Failed to send SMS')
      } else {
        if (!currentConversationId && json.conversation?.id) {
          setCurrentConversationId(json.conversation.id)
        }
        setText('')
        mutate() // Refresh messages
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const getMessageStatusIcon = (msg: Message) => {
    if (msg.direction === 'inbound') return null

    if (msg.status === 'delivered') {
      return <CheckCheck className="w-3 h-3 text-blue-500" />
    } else if (msg.status === 'sent') {
      return <Check className="w-3 h-3 text-gray-400" />
    } else if (msg.status === 'failed' || msg.status === 'undelivered') {
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

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex h-full flex-col rounded-lg border border-slate-800 bg-slate-900/70 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-50">
            SMS with {listing.owner_name || 'Owner'}
          </div>
          <div className="text-xs text-slate-400">
            {leadPhone ? formatPhoneNumber(leadPhone) : 'No phone number on file'}
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-400">
            Error loading messages
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  m.direction === 'outbound'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-300/80">
                  <span>{formatTimestamp(m.created_at)}</span>
                  {getMessageStatusIcon(m)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="border-t border-slate-800 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            rows={1}
            className="min-h-[40px] flex-1 resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-blue-500 placeholder-slate-500"
            placeholder="Type an SMS…"
            disabled={pending || !leadPhone}
          />
          <button
            type="submit"
            disabled={pending || !text.trim() || !leadPhone}
            className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {!leadPhone && (
          <p className="text-xs text-slate-500 mt-1 px-1">
            No phone number available for this lead
          </p>
        )}
      </form>
    </div>
  )
}

