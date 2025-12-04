'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/DashboardLayout'
import { 
  Mail, 
  Plus, 
  Loader2,
  Search,
  Zap,
  ChevronDown,
  Download,
  Trash2,
  Tag,
  X
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  send_strategy: string
  start_at?: string
  total_recipients: number
  sent_count: number
  completed_count: number
  pending_count: number
  failed_count: number
  click_count?: number
  reply_count?: number
  open_count?: number
  opportunities?: number
  tags?: string[]
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [sortOrder, setSortOrder] = useState('Newest first')
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set())
  const [editingTags, setEditingTags] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns')
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      
      const data = await response.json()
      // Enhance campaigns with analytics data (fetch in background, don't block)
      const campaignsList = data.campaigns || []
      setCampaigns(campaignsList.map((campaign: Campaign) => ({
        ...campaign,
        click_count: 0,
        reply_count: 0,
        open_count: 0,
        opportunities: 0
      })))

      // Fetch analytics in background and update
      Promise.all(
        campaignsList.map(async (campaign: Campaign) => {
          try {
            const reportResponse = await fetch(`/api/campaigns/${campaign.id}/report`)
            if (reportResponse.ok) {
              const reportData = await reportResponse.json()
              const stats = reportData.overall_stats || {}
              return {
                id: campaign.id,
                click_count: stats.emails_clicked || 0,
                reply_count: stats.emails_replied || 0,
                open_count: stats.emails_opened || 0
              }
            }
          } catch (err) {
            // Silently fail - analytics are optional
          }
          return null
        })
      ).then(results => {
        setCampaigns(prev => prev.map(campaign => {
          const analytics = results.find(r => r && r.id === campaign.id)
          if (analytics) {
            return { ...campaign, ...analytics }
          }
          return campaign
        }))
      })
    } catch (err) {
      console.error('Error loading campaigns:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-800 text-white',
      scheduled: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      running: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      paused: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
      completed: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      cancelled: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    }

    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'All statuses' || campaign.status.toLowerCase() === statusFilter.toLowerCase()
    return matchesSearch && matchesStatus
  })

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (sortOrder === 'Newest first') {
      return new Date(b.start_at || b.id).getTime() - new Date(a.start_at || a.id).getTime()
    }
    return new Date(a.start_at || a.id).getTime() - new Date(b.start_at || b.id).getTime()
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCampaigns(new Set(sortedCampaigns.map(c => c.id)))
    } else {
      setSelectedCampaigns(new Set())
    }
  }

  const handleSelectCampaign = (campaignId: string, checked: boolean) => {
    const newSelected = new Set(selectedCampaigns)
    if (checked) {
      newSelected.add(campaignId)
    } else {
      newSelected.delete(campaignId)
    }
    setSelectedCampaigns(newSelected)
  }

  const formatMetric = (value: number | undefined, isDraft: boolean) => {
    if (isDraft || value === undefined || value === 0) return '-'
    return value.toString()
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return
    }

    try {
      setDeleting(true)
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete campaign')
      }

      // Remove from local state
      setCampaigns(prev => prev.filter(c => c.id !== campaignId))
      setSelectedCampaigns(prev => {
        const newSet = new Set(prev)
        newSet.delete(campaignId)
        return newSet
      })
    } catch (err: any) {
      alert(err.message || 'Failed to delete campaign')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCampaigns.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedCampaigns.size} campaign(s)? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(true)
      const deletePromises = Array.from(selectedCampaigns).map(campaignId =>
        fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
      )

      const results = await Promise.allSettled(deletePromises)
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))

      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} campaign(s)`)
      }

      // Refresh campaigns
      await fetchCampaigns()
      setSelectedCampaigns(new Set())
    } catch (err: any) {
      alert(err.message || 'Failed to delete campaigns')
    } finally {
      setDeleting(false)
    }
  }

  const handleStartTagging = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId)
    setEditingTags(campaignId)
    setTagInput(campaign?.tags?.join(', ') || '')
  }

  const handleBulkTag = async () => {
    if (selectedCampaigns.size === 0) return

    // For bulk tagging, we'll tag all selected campaigns with the same tags
    // First, get tags from the first selected campaign or use empty
    const firstCampaign = campaigns.find(c => selectedCampaigns.has(c.id))
    const initialTags = firstCampaign?.tags?.join(', ') || ''
    
    // Prompt user for tags
    const tagsInput = prompt('Enter tags (comma-separated):', initialTags)
    if (tagsInput === null) return // User cancelled

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)

    try {
      const updatePromises = Array.from(selectedCampaigns).map(campaignId =>
        fetch(`/api/campaigns/${campaignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags })
        })
      )

      const results = await Promise.allSettled(updatePromises)
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))

      if (failed.length > 0) {
        alert(`Failed to update tags for ${failed.length} campaign(s)`)
      } else {
        // Refresh campaigns
        await fetchCampaigns()
        setSelectedCampaigns(new Set())
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update tags')
    }
  }

  const handleSaveTags = async (campaignId: string) => {
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update tags')
      }

      // Update local state
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, tags } : c
      ))
      setEditingTags(null)
      setTagInput('')
    } catch (err: any) {
      alert(err.message || 'Failed to update tags')
    }
  }

  const handleCancelTagging = () => {
    setEditingTags(null)
    setTagInput('')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All statuses</option>
              <option>Draft</option>
              <option>Scheduled</option>
              <option>Running</option>
              <option>Paused</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
            <Zap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Newest first</option>
              <option>Oldest first</option>
              <option>Name A-Z</option>
              <option>Name Z-A</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Download Button */}
          <button
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Export campaigns"
          >
            <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Bulk Actions */}
          {selectedCampaigns.size > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedCampaigns.size})
              </button>
              <button
                onClick={handleBulkTag}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Tag className="w-4 h-4" />
                Add Tags ({selectedCampaigns.size})
              </button>
            </>
          )}

          {/* Add New Button */}
          <button
            onClick={() => router.push('/dashboard/email/campaigns/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        </div>

        {/* Campaigns Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : sortedCampaigns.length === 0 ? (
          <div className="p-12 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No campaigns found
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery ? 'Try adjusting your search or filters' : 'Create your first email campaign to start sending'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/dashboard/email/campaigns/new')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Create Campaign
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCampaigns.size === sortedCampaigns.length && sortedCampaigns.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">NAME</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PROGRESS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SENT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CLICK</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">REPLIED</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">OPPORTUNITIES</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TAGS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedCampaigns.map((campaign) => {
                    const isDraft = campaign.status === 'draft'
                    const isSelected = selectedCampaigns.has(campaign.id)
                    return (
                      <tr 
                        key={campaign.id} 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectCampaign(campaign.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => router.push(`/dashboard/email/campaigns/${campaign.id}`)}
                            className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left"
                          >
                            {campaign.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(campaign.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {isDraft ? '-' : `${Math.round((campaign.sent_count / campaign.total_recipients) * 100)}%`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatMetric(campaign.sent_count, isDraft)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatMetric(campaign.click_count, isDraft)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatMetric(campaign.reply_count, isDraft)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatMetric(campaign.opportunities, isDraft)}
                        </td>
                        <td className="px-6 py-4">
                          {editingTags === campaign.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveTags(campaign.id)
                                  } else if (e.key === 'Escape') {
                                    handleCancelTagging()
                                  }
                                }}
                                placeholder="tag1, tag2, tag3"
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveTags(campaign.id)}
                                className="p-1 text-green-600 hover:text-green-700"
                                title="Save"
                              >
                                <Tag className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelTagging}
                                className="p-1 text-gray-600 hover:text-gray-700"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {campaign.tags && campaign.tags.length > 0 ? (
                                campaign.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded"
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400 italic">No tags</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
