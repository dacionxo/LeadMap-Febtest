'use client'

import { useState } from 'react'
import { Mail, Clock, Calendar, RefreshCw, AlertCircle, Rss } from 'lucide-react'
import type {
  EmailSettingsPanelProps,
  EmailTrackingConfig,
  EmailScheduleConfig,
} from '../types'

/**
 * Email Settings Panel Component
 * Configuration panel for sender, scheduling, and tracking options
 * Following .cursorrules patterns: TailwindCSS, accessibility, error handling
 */
export default function EmailSettingsPanel({
  composition,
  mailboxes,
  onCompositionChange,
  trackingConfig,
  onTrackingConfigChange,
  scheduleConfig,
  onScheduleConfigChange,
}: EmailSettingsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const selectedMailbox = mailboxes.find((m) => m.id === composition.mailboxId)

  const handleMailboxChange = (mailboxId: string) => {
    const mailbox = mailboxes.find((m) => m.id === mailboxId)
    onCompositionChange({
      mailboxId,
      fromEmail: mailbox?.email || '',
      fromName: mailbox?.displayName || mailbox?.email || '',
    })
  }

  const handleSendTypeChange = (sendType: 'now' | 'schedule' | 'batch' | 'rss' | 'smart') => {
    onCompositionChange({ sendType })
    if (onScheduleConfigChange) {
      onScheduleConfigChange({
        ...scheduleConfig,
        sendType,
      } as EmailScheduleConfig)
    }
  }

  const handleTrackingChange = (updates: Partial<EmailTrackingConfig>) => {
    if (onTrackingConfigChange) {
      onTrackingConfigChange({
        trackOpens: false,
        trackClicks: false,
        trackReplies: false,
        utmTracking: false,
        ...trackingConfig,
        ...updates,
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Sender Configuration */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Sender
          </h3>
        </div>

        {/* Mailbox Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Send From <span className="text-red-500">*</span>
          </label>
          <select
            value={composition.mailboxId}
            onChange={(e) => handleMailboxChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Select mailbox"
            required
          >
            <option value="">Select a mailbox</option>
            {mailboxes
              .filter((m) => m.active)
              .map((mailbox) => (
                <option key={mailbox.id} value={mailbox.id}>
                  {mailbox.displayName || mailbox.email} ({mailbox.provider})
                </option>
              ))}
          </select>
          {mailboxes.filter((m) => m.active).length === 0 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              No active mailboxes.{' '}
              <a
                href="/dashboard/settings"
                className="underline hover:text-amber-700 dark:hover:text-amber-300"
              >
                Connect one in Settings
              </a>
            </p>
          )}
        </div>

        {/* From Name */}
        {selectedMailbox && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Name
            </label>
            <input
              type="text"
              value={composition.fromName || selectedMailbox.displayName || selectedMailbox.email}
              onChange={(e) =>
                onCompositionChange({ fromName: e.target.value })
              }
              placeholder="Sender name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="From name"
            />
          </div>
        )}

        {/* Reply-To */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!composition.replyTo}
              onChange={(e) =>
                onCompositionChange({
                  replyTo: e.target.checked
                    ? composition.fromEmail || selectedMailbox?.email || ''
                    : '',
                })
              }
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              aria-label="Use custom reply-to address"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Use custom reply-to address
            </span>
          </label>
          {composition.replyTo && (
            <input
              type="email"
              value={composition.replyTo}
              onChange={(e) => onCompositionChange({ replyTo: e.target.value })}
              placeholder="reply-to@example.com"
              className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Reply-to email address"
            />
          )}
        </div>
      </div>

      {/* Scheduling */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Schedule
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSendTypeChange('now')}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              composition.sendType === 'now'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label="Send now"
          >
            Send Now
          </button>
          <button
            onClick={() => handleSendTypeChange('schedule')}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              composition.sendType === 'schedule'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label="Schedule"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            Schedule
          </button>
          <button
            onClick={() => handleSendTypeChange('batch')}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              composition.sendType === 'batch'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label="Batch schedule"
            title="Send emails in batches over time"
          >
            Batch
          </button>
          <button
            onClick={() => handleSendTypeChange('rss')}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              composition.sendType === 'rss'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label="RSS schedule"
            title="Automatically send from RSS feed"
          >
            <Rss className="w-4 h-4 inline mr-1" />
            RSS
          </button>
        </div>

        {composition.sendType === 'schedule' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scheduled Date & Time
            </label>
            <input
              type="datetime-local"
              value={
                composition.scheduledAt
                  ? new Date(composition.scheduledAt).toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) => {
                const dateTime = e.target.value
                const scheduledAt = dateTime ? new Date(dateTime).toISOString() : ''
                onCompositionChange({ scheduledAt })
                if (onScheduleConfigChange) {
                  onScheduleConfigChange({
                    ...scheduleConfig,
                    scheduledAt,
                  } as EmailScheduleConfig)
                }
              }}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Scheduled date and time"
            />
          </div>
        )}
      </div>

      {/* Tracking Options */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Tracking
          </h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={trackingConfig?.trackOpens || false}
              onChange={(e) => handleTrackingChange({ trackOpens: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              aria-label="Track email opens"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Track opens
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={trackingConfig?.trackClicks || false}
              onChange={(e) => handleTrackingChange({ trackClicks: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              aria-label="Track email clicks"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Track clicks
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={trackingConfig?.trackReplies || false}
              onChange={(e) => handleTrackingChange({ trackReplies: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              aria-label="Track email replies"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Track replies
            </span>
          </label>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={trackingConfig?.utmTracking || false}
                onChange={(e) => handleTrackingChange({ utmTracking: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                aria-label="Enable UTM tracking"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                UTM Parameter Tracking
              </span>
            </label>

            {trackingConfig?.utmTracking && (
              <div className="ml-6 space-y-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    UTM Source
                  </label>
                  <input
                    type="text"
                    value={trackingConfig.utmSource || ''}
                    onChange={(e) => handleTrackingChange({ utmSource: e.target.value })}
                    placeholder="newsletter"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="UTM source parameter"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    UTM Medium
                  </label>
                  <input
                    type="text"
                    value={trackingConfig.utmMedium || ''}
                    onChange={(e) => handleTrackingChange({ utmMedium: e.target.value })}
                    placeholder="email"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="UTM medium parameter"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    UTM Campaign
                  </label>
                  <input
                    type="text"
                    value={trackingConfig.utmCampaign || ''}
                    onChange={(e) => handleTrackingChange({ utmCampaign: e.target.value })}
                    placeholder="summer-sale-2025"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="UTM campaign parameter"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      UTM Content
                    </label>
                    <input
                      type="text"
                      value={trackingConfig.utmContent || ''}
                      onChange={(e) => handleTrackingChange({ utmContent: e.target.value })}
                      placeholder="optional"
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="UTM content parameter"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      UTM Term
                    </label>
                    <input
                      type="text"
                      value={trackingConfig.utmTerm || ''}
                      onChange={(e) => handleTrackingChange({ utmTerm: e.target.value })}
                      placeholder="optional"
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="UTM term parameter"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  UTM parameters will be automatically added to all links in the email
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

