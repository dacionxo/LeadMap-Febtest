'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  created_at: string
}

interface CampaignSelectorProps {
  selectedCampaignId: string | null
  onCampaignSelect: (campaignId: string | null) => void
}

/**
 * Campaign Selector Component
 * Fetches and displays campaigns for selection
 */
export default function CampaignSelector({
  selectedCampaignId,
  onCampaignSelect,
}: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading campaigns...</span>
      </div>
    )
  }

  return (
    <select
      value={selectedCampaignId || ''}
      onChange={(e) => onCampaignSelect(e.target.value || null)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      aria-label="Select campaign"
    >
      <option value="">-- Select a campaign --</option>
      {campaigns.map((campaign) => (
        <option key={campaign.id} value={campaign.id}>
          {campaign.name} ({campaign.status})
        </option>
      ))}
    </select>
  )
}










