'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown } from 'lucide-react'

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
  const [mailboxes, setMailboxes] = useState<any[]>([])
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [options, setOptions] = useState<CampaignOptions>({
    stop_on_reply: true,
    open_tracking_enabled: false, // Default to disabled as per image
    link_tracking_enabled: false,
    text_only_mode: false,
    first_email_text_only: false,
    daily_cap: 30,
    hourly_cap: null,
    total_cap: null,
    warmup_enabled: false,
    warmup_schedule: null
  })

  const isDraft = campaignStatus === 'draft'

  useEffect(() => {
    if (mailboxId) {
      setSelectedMailboxId(mailboxId)
    }
    if (initialOptions) {
      setOptions({
        stop_on_reply: initialOptions.stop_on_reply !== undefined ? initialOptions.stop_on_reply : true,
        open_tracking_enabled: initialOptions.open_tracking_enabled !== undefined ? initialOptions.open_tracking_enabled : false,
        link_tracking_enabled: initialOptions.link_tracking_enabled || false,
        text_only_mode: initialOptions.text_only_mode || false,
        first_email_text_only: initialOptions.first_email_text_only || false,
        daily_cap: initialOptions.daily_cap !== undefined ? initialOptions.daily_cap : 30,
        hourly_cap: initialOptions.hourly_cap || null,
        total_cap: initialOptions.total_cap || null,
        warmup_enabled: initialOptions.warmup_enabled || false,
        warmup_schedule: initialOptions.warmup_schedule || null
      })
    }
    fetchMailboxes()
    setLoading(false)
  }, [campaignId, initialOptions, mailboxId])

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

  const handleSave = async () => {
    if (!isDraft) {
      setError('Options can only be changed for draft campaigns')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailbox_id: selectedMailboxId || undefined,
          stop_on_reply: options.stop_on_reply,
          open_tracking_enabled: options.open_tracking_enabled,
          link_tracking_enabled: options.link_tracking_enabled,
          text_only_mode: options.text_only_mode,
          first_email_text_only: options.first_email_text_only,
          daily_cap: options.daily_cap || null,
          hourly_cap: options.hourly_cap || null,
          total_cap: options.total_cap || null,
          warmup_enabled: options.warmup_enabled,
          warmup_schedule: options.warmup_schedule || null
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
            <div className="relative max-w-xs">
              <select
                value={selectedMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                disabled={!isDraft}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-10 disabled:opacity-50"
              >
                <option value="">Select...</option>
                {mailboxes.map(mailbox => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.display_name || mailbox.email} ({mailbox.provider})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => router.push('/dashboard/email/mailboxes')}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
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
              onClick={() => setOptions(prev => ({ ...prev, stop_on_reply: false }))}
              disabled={!isDraft}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                !options.stop_on_reply
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Disable
            </button>
            <button
              onClick={() => setOptions(prev => ({ ...prev, stop_on_reply: true }))}
              disabled={!isDraft}
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
                onChange={(e) => setOptions(prev => ({ ...prev, link_tracking_enabled: e.target.checked }))}
                disabled={!isDraft}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Link tracking</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOptions(prev => ({ ...prev, open_tracking_enabled: false }))}
              disabled={!isDraft}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                !options.open_tracking_enabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Disable
            </button>
            <button
              onClick={() => setOptions(prev => ({ ...prev, open_tracking_enabled: true }))}
              disabled={!isDraft}
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
                  onChange={(e) => setOptions(prev => ({ ...prev, text_only_mode: e.target.checked }))}
                  disabled={!isDraft}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Send emails as text-only (no HTML)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.first_email_text_only || false}
                  onChange={(e) => setOptions(prev => ({ ...prev, first_email_text_only: e.target.checked }))}
                  disabled={!isDraft}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Send first email as text-only</span>
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-full">
                  Pro
                </span>
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
              onChange={(e) => setOptions(prev => ({ ...prev, daily_cap: parseInt(e.target.value) || 30 }))}
              disabled={!isDraft}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={!isDraft}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
          Show advanced options
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'transform rotate-180' : ''}`} />
        </button>
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
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
                  onChange={(e) => setOptions(prev => ({ ...prev, hourly_cap: e.target.value ? parseInt(e.target.value) : null }))}
                  disabled={!isDraft}
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
                  onChange={(e) => setOptions(prev => ({ ...prev, total_cap: e.target.value ? parseInt(e.target.value) : null }))}
                  disabled={!isDraft}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      {isDraft && (
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

      {!isDraft && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Options can only be modified for draft campaigns. Please pause or cancel the campaign to make changes.
          </p>
        </div>
      )}
    </div>
  )
}
