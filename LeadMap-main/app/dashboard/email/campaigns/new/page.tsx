'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

export default function NewCampaignPage() {
  const router = useRouter()
  const [campaignName, setCampaignName] = useState('My Campaign')
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (!campaignName.trim()) {
      alert('Please enter a campaign name')
      return
    }

    try {
      setLoading(true)
      
      // Create a draft campaign in Supabase with just the name
      const response = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign')
      }

      // Redirect to the campaign detail page
      router.push(`/dashboard/email/campaigns/${data.campaign.id}`)
    } catch (err: any) {
      alert(err.message || 'Failed to create campaign')
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center relative">
      {/* Chat Help Icon - Bottom Right */}
      <button
        className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
        aria-label="Help"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>

      {/* Main Content - Centered */}
      <div className="w-full max-w-md px-6">
        {/* Heading */}
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-2">
          Let's create a new campaign
        </h1>
        
        {/* Subheading */}
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8">
          What would you like to name it?
        </p>

        {/* Input Field */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Campaign Name
          </label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleContinue()
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="My Campaign"
            autoFocus
            disabled={loading}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 justify-center">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={loading || !campaignName.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                Continue &gt;
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
