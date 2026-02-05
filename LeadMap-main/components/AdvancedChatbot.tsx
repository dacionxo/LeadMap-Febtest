'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, RotateCcw, Paperclip } from 'lucide-react'
import AISparkleIcon from './AISparkleIcon'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface AdvancedChatbotProps {
  isOpen: boolean
  onClose: () => void
}

export default function AdvancedChatbot({ isOpen, onClose }: AdvancedChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "👋 Hey there! I'm NextDeal Assistant, your go-to helper for everything about the platform. I can answer questions about features, pricing, how to use tools, lead generation strategies, and more. What would you like to know?",
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const userInput = input.trim()
    setInput('')
    setIsThinking(true)
    setIsTyping(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userInput })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      await new Promise(resolve => setTimeout(resolve, 300))
      setIsTyping(false)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error calling assistant:', error)
      setIsTyping(false)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsThinking(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (date: Date) => {
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const resetConversation = () => {
    setMessages([
      {
        id: '1',
        content: "👋 Hey there! I'm NextDeal Assistant, your go-to helper for everything about the platform. I can answer questions about features, pricing, how to use tools, lead generation strategies, and more. What would you like to know?",
        role: 'assistant',
        timestamp: new Date()
      }
    ])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* Widget container - floating, bottom-right */}
      <div
        className="relative flex w-[400px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30">
              <AISparkleIcon
                size={24}
                variant="full"
                useCurrentColor
                animate={isThinking}
                className="text-white"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
                AI Assistant
              </h2>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetConversation}
              aria-label="Reset conversation"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Chat history */}
        <div className="ai-chat-scroll flex flex-1 flex-col space-y-6 overflow-y-auto bg-slate-50/50 p-5 dark:bg-slate-800/30">
          {/* Date divider */}
          <div className="flex justify-center">
            <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
              {messages.length > 0 ? formatDateLabel(messages[0].timestamp) : 'Today'}
            </span>
          </div>

          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'user'
                  ? 'flex flex-col items-end gap-1'
                  : 'flex max-w-[85%] items-start gap-3'
              }
            >
              {message.role === 'assistant' && (
                <>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 ring-2 ring-white shadow-sm dark:ring-slate-800">
                    <AISparkleIcon size={16} variant="compact" useCurrentColor className="text-white" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      AI Assistant
                    </span>
                    <div className="rounded-2xl rounded-tl-none border border-indigo-100/50 bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-900 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </>
              )}

              {message.role === 'user' && (
                <div className="flex max-w-[85%] flex-col items-end gap-1">
                  <div className="rounded-2xl rounded-tr-none border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <span className="mr-1 text-[10px] text-slate-400 dark:text-slate-500">
                    Read {formatTime(message.timestamp)}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex max-w-[85%] items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 ring-2 ring-white shadow-sm dark:ring-slate-800">
                <AISparkleIcon size={16} variant="compact" useCurrentColor className="text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  AI Assistant
                </span>
                <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-tl-none border border-indigo-100/50 bg-indigo-50 p-3 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] dark:border-slate-700 dark:bg-slate-900">
          <div className="relative flex items-center rounded-xl border border-slate-200 bg-white transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isThinking}
              placeholder={isThinking ? 'Thinking...' : 'Ask a question...'}
              className="w-full border-none bg-transparent px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 disabled:opacity-50 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              <button
                type="button"
                aria-label="Attach file"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || isThinking}
                aria-label="Send message"
                className="rounded-lg bg-indigo-600 p-2 text-white shadow-md shadow-indigo-200 transition-all hover:scale-105 hover:bg-indigo-700 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600 dark:shadow-indigo-900/30"
              >
                {isThinking ? (
                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-5 w-5 rotate-90" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
            AI can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  )
}
