'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { CreditCard, Copy, CheckCircle2 } from 'lucide-react'

interface SubscriptionGateModalProps {
  userName?: string
  trialEndsAt: string | null
  workspaceId?: string
}

export default function SubscriptionGateModal({
  userName,
  trialEndsAt: trialEndsAtString,
  workspaceId
}: SubscriptionGateModalProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error)
      alert(error.message || 'Failed to start checkout. Please try again.')
      setLoading(false)
    }
  }

  const handleCopyWorkspaceId = async () => {
    if (!workspaceId) return
    
    try {
      await navigator.clipboard.writeText(workspaceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy workspace ID:', err)
    }
  }

  const displayName = userName || 'there'

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 p-8 relative"
        style={{
          animation: 'slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Main Content */}
        <div className="text-center space-y-6">
          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {displayName}, your free trial has expired
          </h1>

          {/* Message */}
          <div className="space-y-3 text-gray-600">
            <p className="text-base leading-relaxed">
              We hope you were able to spend the time exploring how LeadMap can help you save time and grow your business.
            </p>
            <p className="text-base leading-relaxed font-medium">
              Upgrade to one of our plans to continue.
            </p>
          </div>

          {/* Upgrade Button */}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Upgrade to Pro
              </>
            )}
          </button>
        </div>

        {/* Separator */}
        {workspaceId && (
          <>
            <div className="border-t border-gray-200 my-6"></div>
            
            {/* Workspace ID Section */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <span>Workspace ID:</span>
              <code className="bg-gray-50 px-2 py-1 rounded font-mono text-xs">
                {workspaceId}
              </code>
              <button
                onClick={handleCopyWorkspaceId}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Copy Workspace ID"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

