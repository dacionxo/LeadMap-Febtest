'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface CampaignOptions {
  stop_on_reply?: boolean
  open_tracking_enabled?: boolean
  link_tracking_enabled?: boolean
  text_only_mode?: boolean
  first_email_text_only?: boolean
  daily_cap?: number | null
  hourly_cap?: number | null
  total_cap?: number | null
  warmup_enabled?: boolean
  warmup_schedule?: Record<string, number> | null
  // CRM
  owner_id?: string | null
  tags?: string[]
  // Sending Pattern
  time_gap_min?: number
  time_gap_random?: number
  max_new_leads_per_day?: number | null
  prioritize_new_leads?: boolean
  // Auto Optimize A/B Testing
  auto_optimize_split_test?: boolean
  split_test_winning_metric?: 'open_rate' | 'click_rate' | 'reply_rate' | 'conversion_rate'
  // Provider Matching
  provider_matching_enabled?: boolean
  esp_routing_rules?: any[]
  // Email Compliance
  stop_company_on_reply?: boolean
  stop_on_auto_reply?: boolean
  unsubscribe_link_header?: boolean
  allow_risky_emails?: boolean
}

interface OptionsTabProps {
  campaignId: string
  campaignStatus: string
  mailboxId?: string | null
  initialOptions?: CampaignOptions
  onUpdate?: () => void
}

export default function OptionsTab({ 
  campaignId, 
  campaignStatus, 
  mailboxId,
  initialOptions,
  onUpdate 
}: OptionsTabProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [mailboxes, setMailboxes] = useState<any[]>([])
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const dailyCapTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [tagsInput, setTagsInput] = useState('')

  const [options, setOptions] = useState<CampaignOptions>({
    stop_on_reply: true,
    open_tracking_enabled: true,
    link_tracking_enabled: true,
    text_only_mode: false,
    first_email_text_only: false,
    daily_cap: 30,
    hourly_cap: null,
    total_cap: null,
    warmup_enabled: false,
    warmup_schedule: null,
    // CRM
    owner_id: null,
    tags: [],
    // Sending Pattern
    time_gap_min: 9,
    time_gap_random: 5,
    max_new_leads_per_day: null,
    prioritize_new_leads: false,
    // Auto Optimize A/B Testing
    auto_optimize_split_test: false,
    split_test_winning_metric: 'open_rate',
    // Provider Matching
    provider_matching_enabled: false,
    esp_routing_rules: [],
    // Email Compliance
    stop_company_on_reply: false,
    stop_on_auto_reply: false,
    unsubscribe_link_header: true,
    allow_risky_emails: false
  })

  // Allow modifications for draft and paused campaigns, but not running campaigns
  const canModify = campaignStatus === 'draft' || campaignStatus === 'paused'
  const isDraft = campaignStatus === 'draft' // Keep for backward compatibility where needed

  useEffect(() => {
    // Get current user first
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [supabase])

  useEffect(() => {
    if (initialOptions) {
      // If owner_id is null but we have a current user, default to current user
      // This ensures new campaigns show the logged-in user as owner
      const defaultOwnerId = initialOptions.owner_id || currentUserId || null
      
      setOptions({
        stop_on_reply: initialOptions.stop_on_reply !== undefined ? initialOptions.stop_on_reply : true,
        open_tracking_enabled: initialOptions.open_tracking_enabled !== undefined ? initialOptions.open_tracking_enabled : true,
        link_tracking_enabled: initialOptions.link_tracking_enabled !== undefined ? initialOptions.link_tracking_enabled : true,
        text_only_mode: initialOptions.text_only_mode || false,
        first_email_text_only: initialOptions.first_email_text_only || false,
        daily_cap: initialOptions.daily_cap !== undefined ? initialOptions.daily_cap : 30,
        hourly_cap: initialOptions.hourly_cap !== undefined ? initialOptions.hourly_cap : null,
        total_cap: initialOptions.total_cap !== undefined ? initialOptions.total_cap : null,
        warmup_enabled: initialOptions.warmup_enabled || false,
        warmup_schedule: initialOptions.warmup_schedule || null,
        // CRM - default to current user if owner_id is null
        owner_id: defaultOwnerId,
        tags: initialOptions.tags || [],
        // Sending Pattern
        time_gap_min: initialOptions.time_gap_min !== undefined ? initialOptions.time_gap_min : 9,
        time_gap_random: initialOptions.time_gap_random !== undefined ? initialOptions.time_gap_random : 5,
        max_new_leads_per_day: initialOptions.max_new_leads_per_day !== undefined ? initialOptions.max_new_leads_per_day : null,
        prioritize_new_leads: initialOptions.prioritize_new_leads || false,
        // Auto Optimize A/B Testing
        auto_optimize_split_test: initialOptions.auto_optimize_split_test || false,
        split_test_winning_metric: initialOptions.split_test_winning_metric || 'open_rate',
        // Provider Matching
        provider_matching_enabled: initialOptions.provider_matching_enabled || false,
        esp_routing_rules: initialOptions.esp_routing_rules || [],
        // Email Compliance
        stop_company_on_reply: initialOptions.stop_company_on_reply || false,
        stop_on_auto_reply: initialOptions.stop_on_auto_reply || false,
        unsubscribe_link_header: initialOptions.unsubscribe_link_header !== undefined ? initialOptions.unsubscribe_link_header : true,
        allow_risky_emails: initialOptions.allow_risky_emails || false
      })
      // Set tags input from tags array
      if (initialOptions.tags && initialOptions.tags.length > 0) {
        setTagsInput(initialOptions.tags.join(', '))
      } else {
        setTagsInput('')
      }
    }
    fetchMailboxes()
    fetchCampaignMailboxes()
    if (canModify) {
      fetchUsers()
    }
    setLoading(false)
  }, [campaignId, initialOptions, mailboxId, canModify, currentUserId])

  const fetchCampaignMailboxes = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/mailboxes`)
      if (response.ok) {
        const data = await response.json()
        const mailboxIds = (data.mailboxes || []).map((m: any) => m.id).filter(Boolean)
        if (mailboxIds.length > 0) {
          setSelectedMailboxIds(new Set(mailboxIds))
        } else if (mailboxId) {
          // Fallback to single mailbox_id if no campaign_mailboxes found
          setSelectedMailboxIds(new Set([mailboxId]))
        }
      }
    } catch (error) {
      console.error('Error fetching campaign mailboxes:', error)
      // Fallback to single mailbox_id
      if (mailboxId) {
        setSelectedMailboxIds(new Set([mailboxId]))
      }
    }
  }

  const fetchMailboxes = async () => {
    try {
      const response = await fetch('/api/mailboxes')
      if (response.ok) {
        const data = await response.json()
        setMailboxes((data.mailboxes || []).filter((m: any) => m.active))
      }
    } catch (error) {
      console.error('Error fetching mailboxes:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      // Get current user from Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('Error fetching current user:', userError)
        setUsers([])
        return
      }

      // For now, we'll use the current user. In a team setup, this would fetch team members
      // You can extend this to fetch from /api/crm/deals/users or /api/team endpoint
      const userData = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      }
      
      setUsers([userData])
      setCurrentUserId(user.id)
      
      // If owner_id is not set, default to current user
      if (!options.owner_id) {
        setOptions(prev => ({ ...prev, owner_id: user.id }))
        handleImmediateSave({ owner_id: user.id })
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    }
  }

  const handleSave = async () => {
    if (!canModify) {
      setError('Options can only be changed for draft or paused campaigns. Please pause the campaign to make changes.')
      return
    }

    if (selectedMailboxIds.size === 0) {
      setError('Please select at least one mailbox')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      // Save campaign mailboxes
      const mailboxesResponse = await fetch(`/api/campaigns/${campaignId}/mailboxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxIds: Array.from(selectedMailboxIds)
        })
      })

      if (!mailboxesResponse.ok) {
        const data = await mailboxesResponse.json()
        throw new Error(data.error || 'Failed to save mailboxes')
      }

      // Save other campaign options
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stop_on_reply: options.stop_on_reply,
          open_tracking_enabled: options.open_tracking_enabled,
          link_tracking_enabled: options.link_tracking_enabled,
          text_only_mode: options.text_only_mode,
          first_email_text_only: options.first_email_text_only,
          daily_cap: options.daily_cap || null,
          hourly_cap: options.hourly_cap || null,
          total_cap: options.total_cap || null,
          warmup_enabled: options.warmup_enabled,
          warmup_schedule: options.warmup_schedule || null,
          // CRM
          owner_id: options.owner_id || null,
          tags: options.tags || [],
          // Sending Pattern
          time_gap_min: options.time_gap_min,
          time_gap_random: options.time_gap_random,
          max_new_leads_per_day: options.max_new_leads_per_day || null,
          prioritize_new_leads: options.prioritize_new_leads,
          // Auto Optimize A/B Testing
          auto_optimize_split_test: options.auto_optimize_split_test,
          split_test_winning_metric: options.split_test_winning_metric,
          // Provider Matching
          provider_matching_enabled: options.provider_matching_enabled,
          esp_routing_rules: options.esp_routing_rules || [],
          // Email Compliance
          stop_company_on_reply: options.stop_company_on_reply,
          stop_on_auto_reply: options.stop_on_auto_reply,
          unsubscribe_link_header: options.unsubscribe_link_header,
          allow_risky_emails: options.allow_risky_emails
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save options')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (onUpdate) {
        onUpdate()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save options')
    } finally {
      setSaving(false)
    }
  }

  const handleMailboxToggle = (mailboxId: string) => {
    if (!canModify) return
    
    setSelectedMailboxIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mailboxId)) {
        if (newSet.size === 1) {
          // Don't allow unchecking the last mailbox
          return newSet
        }
        newSet.delete(mailboxId)
      } else {
        newSet.add(mailboxId)
      }
      return newSet
    })
  }

  // Generic handler for immediate save to Supabase
  const handleImmediateSave = async (updates: Record<string, any>) => {
    if (!canModify || !campaignId) return
    
    // Save to Supabase immediately
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update setting')
      }
      
      // Refresh campaign data
      if (onUpdate) {
        onUpdate()
      }
    } catch (err: any) {
      console.error('Error updating setting:', err)
      setError(err.message || 'Failed to update setting')
    }
  }

  // Handle stop on reply enable/disable with immediate save
  const handleStopOnReplyToggle = async (enabled: boolean) => {
    // Update local state immediately
    setOptions(prev => ({ ...prev, stop_on_reply: enabled }))
    // Save to Supabase
    await handleImmediateSave({ stop_on_reply: enabled })
  }

  // Handle open tracking enable/disable with immediate save
  const handleOpenTrackingToggle = async (enabled: boolean) => {
    // Update local state immediately
    setOptions(prev => ({ ...prev, open_tracking_enabled: enabled }))
    // Save to Supabase
    await handleImmediateSave({ open_tracking_enabled: enabled })
  }

  // Handle text only mode toggle with immediate save
  const handleTextOnlyModeToggle = async (enabled: boolean) => {
    // Update local state immediately
    setOptions(prev => ({ ...prev, text_only_mode: enabled }))
    // Save to Supabase
    await handleImmediateSave({ text_only_mode: enabled })
  }

  // Handle first email text only toggle with immediate save
  const handleFirstEmailTextOnlyToggle = async (enabled: boolean) => {
    // Update local state immediately
    setOptions(prev => ({ ...prev, first_email_text_only: enabled }))
    // Save to Supabase
    await handleImmediateSave({ first_email_text_only: enabled })
  }

  // Handle link tracking toggle with immediate save
  const handleLinkTrackingToggle = async (enabled: boolean) => {
    // Update local state immediately
    setOptions(prev => ({ ...prev, link_tracking_enabled: enabled }))
    // Save to Supabase
    await handleImmediateSave({ link_tracking_enabled: enabled })
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <span className="text-sm text-green-600 dark:text-green-400">Options saved successfully!</span>
        </div>
      )}

      {/* Accounts to use */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Accounts to use
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select one or more accounts to send emails from
            </p>
            <div className="space-y-2 max-w-md">
              {mailboxes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No active mailboxes found. Connect a mailbox to get started.
                </p>
              ) : (
                mailboxes.map(mailbox => (
                  <label
                    key={mailbox.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedMailboxIds.has(mailbox.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${!canModify ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMailboxIds.has(mailbox.id)}
                      onChange={() => handleMailboxToggle(mailbox.id)}
                      disabled={!canModify || (selectedMailboxIds.size === 1 && selectedMailboxIds.has(mailbox.id))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {mailbox.display_name || mailbox.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {mailbox.email} ({mailbox.provider})
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <button
              onClick={() => router.push('/dashboard/email/mailboxes')}
              className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Connect new email account
            </button>
          </div>
        </div>
      </div>

      {/* Stop sending emails on reply */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Stop sending emails on reply
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stop sending emails to a lead if a response has been received
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStopOnReplyToggle(false)}
              disabled={!canModify}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                !options.stop_on_reply
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Disable
            </button>
            <button
              onClick={() => handleStopOnReplyToggle(true)}
              disabled={!canModify}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                options.stop_on_reply
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Enable
            </button>
          </div>
        </div>
      </div>

      {/* Open Tracking */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Open Tracking
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Track email opens
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.link_tracking_enabled || false}
                onChange={(e) => handleLinkTrackingToggle(e.target.checked)}
                disabled={!canModify}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Link tracking</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenTrackingToggle(false)}
              disabled={!canModify}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                !options.open_tracking_enabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Disable
            </button>
            <button
              onClick={() => handleOpenTrackingToggle(true)}
              disabled={!canModify}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                options.open_tracking_enabled
                  ? 'bg-white text-gray-700 border border-gray-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Enable
            </button>
          </div>
        </div>
      </div>

      {/* Delivery Optimization */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delivery Optimization
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full">
                Recommended
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Disables open tracking
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.text_only_mode || false}
                  onChange={(e) => handleTextOnlyModeToggle(e.target.checked)}
                  disabled={!canModify}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Send emails as text-only (no HTML)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.first_email_text_only || false}
                  onChange={(e) => handleFirstEmailTextOnlyToggle(e.target.checked)}
                  disabled={!canModify}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Send first email as text-only</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Limit */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Daily Limit
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Max number of emails to send per day for this campaign
            </p>
          </div>
          <div className="w-32">
            <input
              type="number"
              min="1"
              value={options.daily_cap || 30}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 30
                setOptions(prev => ({ ...prev, daily_cap: value }))
                // Clear existing timer
                if (dailyCapTimerRef.current) {
                  clearTimeout(dailyCapTimerRef.current)
                }
                // Debounce save
                dailyCapTimerRef.current = setTimeout(() => {
                  handleImmediateSave({ daily_cap: value || null })
                }, 1000)
              }}
              disabled={!canModify}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={!canModify}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
          Show advanced options
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'transform rotate-180' : ''}`} />
        </button>
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-6">
            {/* Hourly Cap */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Hourly Limit
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Max number of emails to send per hour
                </p>
              </div>
              <div className="w-32">
                <input
                  type="number"
                  min="1"
                  value={options.hourly_cap || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    setOptions(prev => ({ ...prev, hourly_cap: value }))
                    if (dailyCapTimerRef.current) {
                      clearTimeout(dailyCapTimerRef.current)
                    }
                    dailyCapTimerRef.current = setTimeout(() => {
                      handleImmediateSave({ hourly_cap: value })
                    }, 1000)
                  }}
                  disabled={!canModify}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="No limit"
                />
              </div>
            </div>
            
            {/* Total Cap */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Total Limit
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Max total emails for this campaign
                </p>
              </div>
              <div className="w-32">
                <input
                  type="number"
                  min="1"
                  value={options.total_cap || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    setOptions(prev => ({ ...prev, total_cap: value }))
                    if (dailyCapTimerRef.current) {
                      clearTimeout(dailyCapTimerRef.current)
                    }
                    dailyCapTimerRef.current = setTimeout(() => {
                      handleImmediateSave({ total_cap: value })
                    }, 1000)
                  }}
                  disabled={!canModify}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="No limit"
                />
              </div>
            </div>

            {/* CRM Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">CRM</h4>
              
              {/* Owner */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Owner
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Select the owner of this campaign
                </p>
                <select
                  value={options.owner_id || ''}
                  onChange={(e) => {
                    const ownerId = e.target.value || null
                    setOptions(prev => ({ ...prev, owner_id: ownerId }))
                    handleImmediateSave({ owner_id: ownerId })
                  }}
                  disabled={!canModify}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">No owner</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email || `User ${user.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Tags
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Tags are used to group your campaigns (comma-separated)
                </p>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value)
                    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    setOptions(prev => ({ ...prev, tags }))
                    // Debounce save
                    if (dailyCapTimerRef.current) {
                      clearTimeout(dailyCapTimerRef.current)
                    }
                    dailyCapTimerRef.current = setTimeout(() => {
                      handleImmediateSave({ tags })
                    }, 1000)
                  }}
                  onBlur={() => {
                    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
                    handleImmediateSave({ tags })
                  }}
                  placeholder="tag1, tag2, tag3"
                  disabled={!canModify}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Sending Pattern Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Sending Pattern</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Specify how you want your emails to go
              </p>
              
              {/* Time gap between emails */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time gap between emails
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Minimum time
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={options.time_gap_min || 9}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 9
                          setOptions(prev => ({ ...prev, time_gap_min: value }))
                          handleImmediateSave({ time_gap_min: value })
                        }}
                        disabled={!canModify}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">minutes</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Random additional time
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={options.time_gap_random || 5}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 5
                          setOptions(prev => ({ ...prev, time_gap_random: value }))
                          handleImmediateSave({ time_gap_random: value })
                        }}
                        disabled={!canModify}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">minutes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Max new leads per day */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max new leads
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={options.max_new_leads_per_day || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null
                      setOptions(prev => ({ ...prev, max_new_leads_per_day: value }))
                      if (dailyCapTimerRef.current) {
                        clearTimeout(dailyCapTimerRef.current)
                      }
                      dailyCapTimerRef.current = setTimeout(() => {
                        handleImmediateSave({ max_new_leads_per_day: value })
                      }, 1000)
                    }}
                    disabled={!canModify}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="No limit"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">per day</span>
                </div>
              </div>

              {/* Prioritize New Leads */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.prioritize_new_leads || false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, prioritize_new_leads: e.target.checked }))
                      handleImmediateSave({ prioritize_new_leads: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Prioritize New Leads</span>
                </label>
              </div>
            </div>

            {/* Auto optimize A/Z Testing */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Auto optimize A/Z Testing</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                When using A/Z testing, the algorithm will automatically select the best performing variant after a certain number of emails have been sent.
              </p>
              
              <div className="mb-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={options.auto_optimize_split_test || false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, auto_optimize_split_test: e.target.checked }))
                      handleImmediateSave({ auto_optimize_split_test: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable auto optimization</span>
                </label>
                
                {options.auto_optimize_split_test && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Choose winning metric
                    </label>
                    <select
                      value={options.split_test_winning_metric || 'open_rate'}
                      onChange={(e) => {
                        const metric = e.target.value as any
                        setOptions(prev => ({ ...prev, split_test_winning_metric: metric }))
                        handleImmediateSave({ split_test_winning_metric: metric })
                      }}
                      disabled={!canModify}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="open_rate">Open Rate</option>
                      <option value="click_rate">Click Rate</option>
                      <option value="reply_rate">Reply Rate</option>
                      <option value="conversion_rate">Conversion Rate</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Provider Matching */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Provider Matching</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Matches your lead's email provider with your mailbox provider for boosted deliverability. (Outlook to Outlook, Google to Google, etc.)
              </p>
              
              <div className="mb-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={options.provider_matching_enabled || false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, provider_matching_enabled: e.target.checked }))
                      handleImmediateSave({ provider_matching_enabled: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable provider matching</span>
                </label>
                
                {options.provider_matching_enabled && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Configure custom rules for email sending based on email service providers
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ESP Routing rules configuration coming soon
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Email Compliance Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Email Compliance & Safety</h4>
              
              {/* Stop Campaign for Company on Reply */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.stop_company_on_reply || false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, stop_company_on_reply: e.target.checked }))
                      handleImmediateSave({ stop_company_on_reply: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stop Campaign for Company on Reply</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Stops the campaign automatically for all leads from a company if a reply is received from any of them.
                    </p>
                  </div>
                </label>
              </div>

              {/* Stop Sending Emails on Auto-Reply */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.stop_on_auto_reply || false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, stop_on_auto_reply: e.target.checked }))
                      handleImmediateSave({ stop_on_auto_reply: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stop Sending Emails on Auto-Reply</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Stop sending emails to a lead if an automatic response has been received, for example for out-of-office replies.
                    </p>
                  </div>
                </label>
              </div>

              {/* Insert Unsubscribe Link Header */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.unsubscribe_link_header !== false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, unsubscribe_link_header: e.target.checked }))
                      handleImmediateSave({ unsubscribe_link_header: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Insert Unsubscribe Link Header</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Automatically adds an unsubscribe link to email headers for one-click unsubscription by supported email providers
                    </p>
                  </div>
                </label>
              </div>

              {/* Allow Risky Emails */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.allow_risky_emails || false}
                    onChange={(e) => {
                      setOptions(prev => ({ ...prev, allow_risky_emails: e.target.checked }))
                      handleImmediateSave({ allow_risky_emails: e.target.checked })
                    }}
                    disabled={!canModify}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow Risky Emails</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      When using verification, allow emails that are marked as risky to be contacted; or disable BounceProtect to allow known risky emails to be contacted.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      {canModify && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Saving...
              </>
            ) : (
              'Save Options'
            )}
          </button>
        </div>
      )}

      {!canModify && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Options can only be modified for draft or paused campaigns. Please pause the campaign to make changes.
          </p>
        </div>
      )}
    </div>
  )
}
