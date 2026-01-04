'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ErrorBoundary from '../ErrorBoundary'
import LoadingSkeleton from '../LoadingSkeleton'
import EmailComposerHeader from './components/EmailComposerHeader'
import EmailComposerFooter from './components/EmailComposerFooter'
import EmailSettingsPanel from './components/EmailSettingsPanel'
import TemplateSelector from './components/TemplateSelector'
import EmailEditorBasic from './components/EmailEditorBasic'
import { useEmailComposition } from './hooks/useEmailComposition'
import { useEmailValidation } from './hooks/useEmailValidation'
import type {
  ComposeEmailProps,
  EmailComposition,
  MailboxSelection,
  EmailTemplateSelection,
  EmailTrackingConfig,
  EmailScheduleConfig,
  EmailSendResponse,
} from './types'

/**
 * Enhanced Compose Email Component
 * Main container component for email composition
 * Following Mautic patterns, .cursorrules guidelines, and Context7 documentation
 */
export default function ComposeEmailEnhanced({
  initialData,
  onSend,
  onSave,
  onCancel,
  mode = 'create',
}: ComposeEmailProps) {
  const router = useRouter()
  const { composition, updateComposition, resetComposition } = useEmailComposition(initialData)
  const { validate } = useEmailValidation()

  const [mailboxes, setMailboxes] = useState<MailboxSelection[]>([])
  const [templates, setTemplates] = useState<EmailTemplateSelection[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [validationResult, setValidationResult] = useState(validate(composition))
  const [trackingConfig, setTrackingConfig] = useState<EmailTrackingConfig>({
    trackOpens: false,
    trackClicks: false,
    trackReplies: false,
    utmTracking: false,
  })
  const [scheduleConfig, setScheduleConfig] = useState<EmailScheduleConfig>({
    sendType: 'now',
  })

  // Fetch mailboxes and templates on mount
  useEffect(() => {
    fetchMailboxes()
    fetchTemplates()
  }, [])

  // Update validation when composition changes
  useEffect(() => {
    const result = validate(composition)
    setValidationResult(result)
  }, [composition, validate])

  const fetchMailboxes = async () => {
    try {
      const response = await fetch('/api/mailboxes', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch mailboxes')
      }

      const data = await response.json()
      const activeMailboxes: MailboxSelection[] = (data.mailboxes || [])
        .filter((m: MailboxSelection) => m.active)
        .map((m: any) => ({
          id: m.id,
          email: m.email,
          displayName: m.display_name,
          provider: m.provider,
          active: m.active,
          dailyLimit: m.daily_limit,
          hourlyLimit: m.hourly_limit,
        }))

      setMailboxes(activeMailboxes)

      // Set default mailbox if none selected and mailboxes available
      if (activeMailboxes.length > 0 && !composition.mailboxId) {
        updateComposition({
          mailboxId: activeMailboxes[0].id,
          fromEmail: activeMailboxes[0].email,
          fromName: activeMailboxes[0].displayName || activeMailboxes[0].email,
        })
      }
    } catch (error) {
      console.error('Error loading mailboxes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      const fetchedTemplates: EmailTemplateSelection[] = (data.templates || []).map(
        (t: any) => ({
          id: t.id,
          title: t.title,
          body: t.body,
          html: t.html || t.body,
          category: t.category,
          folderId: t.folder_id || t.folderId,
        })
      )

      setTemplates(fetchedTemplates)
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const handleTemplateSelect = useCallback(
    (template: EmailTemplateSelection | null) => {
      if (template) {
        setSelectedTemplateId(template.id)
        updateComposition({
          subject: template.title,
          htmlContent: template.html || template.body,
        })
      } else {
        setSelectedTemplateId(undefined)
      }
    },
    [updateComposition]
  )

  const handleTemplateLoad = useCallback(
    (template: EmailTemplateSelection) => {
      updateComposition({
        subject: template.title,
        htmlContent: template.html || template.body,
      })
    },
    [updateComposition]
  )

  const handleSaveDraft = useCallback(async () => {
    if (onSave) {
      try {
        setSaving(true)
        await onSave(composition)
      } catch (error) {
        console.error('Error saving draft:', error)
        alert('Failed to save draft. Please try again.')
      } finally {
        setSaving(false)
      }
    }
  }, [composition, onSave])

  const handleSend = useCallback(async () => {
    // Validate before sending
    const validation = validate(composition)
    setValidationResult(validation)

    if (!validation.isValid) {
      return
    }

    try {
      setSending(true)
      updateComposition({ status: 'sending' })

      // Prepare payload for API
      const payload: any = {
        mailboxId: composition.mailboxId,
        to: composition.to,
        subject: composition.subject,
        html: composition.htmlContent,
      }

      if (composition.cc && composition.cc.length > 0) {
        payload.cc = composition.cc
      }

      if (composition.bcc && composition.bcc.length > 0) {
        payload.bcc = composition.bcc
      }

      if (composition.replyTo) {
        payload.replyTo = composition.replyTo
      }

      if (composition.fromName) {
        payload.fromName = composition.fromName
      }

      if (composition.sendType === 'schedule' && composition.scheduledAt) {
        payload.scheduleAt = composition.scheduledAt
      }

      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })

      const data: EmailSendResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      updateComposition({ status: 'sent' })

      if (onSend) {
        await onSend(composition)
      } else {
        alert(
          composition.sendType === 'schedule'
            ? 'Email scheduled successfully!'
            : 'Email sent successfully!'
        )
        resetComposition()
      }
    } catch (error: unknown) {
      console.error('Error sending email:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email'
      alert(errorMessage)
      updateComposition({ status: 'draft' })
    } finally {
      setSending(false)
    }
  }, [composition, validate, updateComposition, resetComposition, onSend])

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel()
    } else {
      router.back()
    }
  }, [onCancel, router])

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={3} />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <EmailComposerHeader
          status={composition.status}
          onSaveDraft={onSave ? handleSaveDraft : undefined}
          saving={saving}
        />

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Settings */}
          <div className="lg:col-span-1 space-y-4">
            <EmailSettingsPanel
              composition={composition}
              mailboxes={mailboxes}
              onCompositionChange={updateComposition}
              trackingConfig={trackingConfig}
              onTrackingConfigChange={setTrackingConfig}
              scheduleConfig={scheduleConfig}
              onScheduleConfigChange={setScheduleConfig}
            />
            {templates.length > 0 && (
              <TemplateSelector
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={handleTemplateSelect}
                onTemplateLoad={handleTemplateLoad}
              />
            )}
          </div>

          {/* Main Editor Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* To, Subject, Preview Text Fields */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              {/* To Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={composition.to.join(', ')}
                  onChange={(e) => {
                    const emails = e.target.value
                      .split(',')
                      .map((email) => email.trim())
                      .filter((email) => email.length > 0)
                    updateComposition({ to: emails })
                  }}
                  placeholder="recipient@example.com, another@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Email recipients"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Separate multiple emails with commas
                </p>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={composition.subject}
                  onChange={(e) => updateComposition({ subject: e.target.value })}
                  placeholder="Email subject"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Email subject"
                  required
                />
              </div>

              {/* Preview Text Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview Text (Optional)
                </label>
                <input
                  type="text"
                  value={composition.previewText || ''}
                  onChange={(e) => updateComposition({ previewText: e.target.value })}
                  placeholder="Preview text shown in email clients"
                  maxLength={150}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Email preview text"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {composition.previewText?.length || 0}/150 characters
                </p>
              </div>
            </div>

            {/* Editor */}
            <EmailEditorBasic
              content={composition.htmlContent}
              mode={composition.editorMode}
              onChange={(content) => updateComposition({ htmlContent: content })}
            />
          </div>
        </div>

        {/* Footer */}
        <EmailComposerFooter
          onSend={handleSend}
          onCancel={handleCancel}
          sending={sending}
          isValid={validationResult.isValid}
          validationErrors={validationResult.errors}
          sendType={composition.sendType}
        />
      </div>
    </ErrorBoundary>
  )
}

