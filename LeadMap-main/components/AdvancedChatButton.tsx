'use client'

import { useState, useId } from 'react'
import AdvancedChatbot from './AdvancedChatbot'
import AISparkleIcon from './AISparkleIcon'
import { useApp } from '@/app/providers'

export default function AdvancedChatButton() {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useApp()
  const gradientId = useId().replace(/:/g, '_')

  if (!user) {
    return null
  }

  return (
    <>
      {/* Floating AI Assistant Button - Sparkle design with glow */}
      <div className="fixed bottom-6 right-6 z-40 group cursor-pointer animate-float">
        {/* Outer glow - stronger on hover */}
        <div
          className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 blur-xl opacity-40 transition-opacity duration-500 group-hover:opacity-60"
          aria-hidden
        />
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 p-3 shadow-glow ring-1 ring-white/20 transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          aria-label="Open AI Assistant"
        >
          {/* Dotted overlay for texture */}
          <div
            className="absolute inset-0 rounded-2xl opacity-10"
            style={{
              backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
              backgroundSize: '8px 8px',
            }}
            aria-hidden
          />
          <div className="relative z-10 flex items-center gap-2 text-white drop-shadow-md">
            <AISparkleIcon
              size={28}
              variant="full"
              gradientId={gradientId}
              useCurrentColor
              className="shrink-0"
            />
            <div className="hidden flex-col sm:flex">
              <span className="text-left text-sm font-semibold leading-none">
                Ask AI
              </span>
              <span className="mt-0.5 text-[10px] font-medium text-white/80">
                Ready to help
              </span>
            </div>
          </div>
          {/* Keyboard hint badge */}
          <span className="absolute -top-1.5 -right-1.5 rounded border border-white/20 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
            ⌘K
          </span>
        </button>
      </div>

      <AdvancedChatbot isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
