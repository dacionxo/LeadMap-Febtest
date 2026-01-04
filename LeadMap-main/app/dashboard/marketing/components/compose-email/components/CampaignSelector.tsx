'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, X, FolderOpen } from 'lucide-react'

/**
 * Campaign Selector Component
 * Allows selecting or creating campaigns for emails
 * Following Mautic patterns, .cursorrules guidelines
 */

interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  created_at: string
}

interface CampaignSelectorProps {
  selectedCampaignId?: string
  onSelect: (campaignId: string | null) => void
  onCreate?: (campaignName: string) => Promise<string>
  onClose?: () => void
}

export default function CampaignSelector({
  selectedCampaignId,
  onSelect,
  onCreate,
  onClose,
}: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }

      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateCampaign = useCallback(async () => {
    if (!onCreate || !newCampaignName.trim()) return

    try {
      setCreating(true)
      const campaignId = await onCreate(newCampaignName.trim())
      await fetchCampaigns()
      onSelect(campaignId)
      setShowCreateForm(false)
      setNewCampaignName('')
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
      alert('Failed to create campaign. Please try again.')
    } finally {
      setCreating(false)
    }
  }, [newCampaignName, onCreate, onSelect, onClose])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-label="Search campaigns"
        />
      </div>

      {/* Create Campaign Form */}
      {showCreateForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Create New Campaign</h4>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setNewCampaignName('')
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              aria-label="Close create form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={newCampaignName}
            onChange={(e) => setNewCampaignName(e.target.value)}
            placeholder="Campaign name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Campaign name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCampaign()
              }
            }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateCampaign}
              disabled={creating || !newCampaignName.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setNewCampaignName('')
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* No Campaign Option */}
        <button
          onClick={() => {
            onSelect(null)
            if (onClose) {
              onClose()
            }
          }}
          className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${
            !selectedCampaignId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">No Campaign</span>
          </div>
        </button>

        {/* Campaign Items */}
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No campaigns found' : 'No campaigns available'}
            </p>
            {!searchQuery && onCreate && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Campaign
              </button>
            )}
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => {
                onSelect(campaign.id)
                if (onClose) {
                  onClose()
                }
              }}
              className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${
                selectedCampaignId === campaign.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {campaign.name}
                  </h4>
                  {campaign.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {campaign.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        campaign.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : campaign.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : campaign.status === 'completed'
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {campaign.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Create Button */}
      {!showCreateForm && onCreate && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Campaign
        </button>
      )}
    </div>
  )
}

