'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tag, Eye, AlertCircle, Save, FolderOpen, Link2, TestTube, X } from 'lucide-react'
import ErrorBoundary from '../ErrorBoundary'
import LoadingSkeleton from '../LoadingSkeleton'
import EmailComposerHeader from './components/EmailComposerHeader'
import EmailComposerFooter from './components/EmailComposerFooter'
import EmailSettingsPanel from './components/EmailSettingsPanel'
import TemplateSelector from './components/TemplateSelector'
import EmailEditorBasic from './components/EmailEditorBasic'
import EmailBuilder from './components/EmailBuilder'
import EmailPreview from './components/EmailPreview'
import ValidationPanel from './components/ValidationPanel'
import TriggerLinkSelector from './components/TriggerLinkSelector'
import TokenSelector from './components/TokenSelector'
import ABTestCreator from './components/ABTestCreator'
import CampaignSelector from './components/CampaignSelector'
import { useEmailComposition } from './hooks/useEmailComposition'
import { useEmailValidation } from './hooks/useEmailValidation'
import { useEmailCache } from './hooks/useEmailCache'
import { useDraftAutoSave } from './hooks/useDraftAutoSave'
import { validateEmail } from './utils/email-validation'
import { getAllDefaultTokens } from './utils/token-definitions'
import { generateTokenString } from './utils/token-replacement'
import { COMPOSER_SHORTCUTS, registerKeyboardShortcuts } from './utils/keyboard-shortcuts'
import {
  trackEmailComposed,
  trackEmailSent,
  trackEmailSaved,
  trackEmailPreviewed,
  trackEmailValidated,
  trackTemplateUsed,
  trackTokenInserted,
  trackTriggerLinkInserted,
  trackABTestCreated,
  trackCampaignLinked,
  trackDraftLoaded,
  trackDraftAutosaved,
  trackEditorModeChanged,
  trackTestEmailSent,
} from './utils/email-analytics'
import type {
  ComposeEmailProps,
  EmailComposition,
  MailboxSelection,
  EmailTemplateSelection,
  EmailTrackingConfig,
  EmailScheduleConfig,
  EmailSendResponse,
  EmailToken,
  TokenContext,
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
  const {
    getCachedMailboxes,
    getCachedTemplates,
    getCachedTokens,
    setCachedMailboxes,
    setCachedTemplates,
    setCachedTokens,
  } = useEmailCache()

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
  const [availableTokens] = useState<EmailToken[]>(getAllDefaultTokens())
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showTriggerLinkSelector, setShowTriggerLinkSelector] = useState(false)
  const [showDraftSelector, setShowDraftSelector] = useState(false)
  const [showABTestCreator, setShowABTestCreator] = useState(false)
  const [showCampaignSelector, setShowCampaignSelector] = useState(false)
  const [testEmailRecipient, setTestEmailRecipient] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [emailValidation, setEmailValidation] = useState(validateEmail(composition.htmlContent || ''))
  
  // Update email validation when content changes
  useEffect(() => {
    const validation = validateEmail(composition.htmlContent || '')
    setEmailValidation(validation)
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      trackEmailValidated({
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
      })
    }
  }, [composition.htmlContent])

  // Fetch mailboxes and templates on mount (with cache)
  useEffect(() => {
    fetchMailboxes()
    fetchTemplates()
    trackEmailComposed({ mode })
  }, [mode])

  // Update validation when composition changes (memoized)
  useEffect(() => {
    const result = validate(composition)
    setValidationResult(result)
  }, [composition, validate])

  // Register keyboard shortcuts
  useEffect(() => {
    const shortcuts = COMPOSER_SHORTCUTS.map((shortcut) => {
      if (shortcut.key === 's' && shortcut.ctrl) {
        return {
          ...shortcut,
          handler: () => {
            if (onSave) {
              handleSaveDraft()
            }
          },
        }
      }
      if (shortcut.key === 'Enter' && shortcut.ctrl) {
        return {
          ...shortcut,
          handler: () => {
            handleSend()
          },
        }
      }
      if (shortcut.key === 'Escape') {
        return {
          ...shortcut,
          handler: () => {
            handleCancel()
          },
        }
      }
      return shortcut
    })

    const cleanup = registerKeyboardShortcuts(shortcuts)
    return cleanup
  }, [onSave, onCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMailboxes = async () => {
    try {
      // Check cache first
      const cached = getCachedMailboxes()
      if (cached) {
        setMailboxes(cached)
        if (cached.length > 0 && !composition.mailboxId) {
          updateComposition({
            mailboxId: cached[0].id,
            fromEmail: cached[0].email,
            fromName: cached[0].displayName || cached[0].email,
          })
        }
        setLoading(false)
        return
      }

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
      setCachedMailboxes(activeMailboxes)

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
      // Check cache first
      const cached = getCachedTemplates()
      if (cached) {
        setTemplates(cached)
        return
      }

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
      setCachedTemplates(fetchedTemplates)
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const handleTemplateSelect = useCallback(
    (template: EmailTemplateSelection | null) => {
      if (template) {
        setSelectedTemplateId(template.id)
        trackTemplateUsed(template.id)
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

  // Draft management handlers
  const handleSaveDraft = useCallback(async () => {
    try {
      setSaving(true)
      
      const draftData = {
        subject: composition.subject,
        htmlContent: composition.htmlContent,
        to: composition.to,
        mailboxId: composition.mailboxId,
        fromName: composition.fromName,
        fromEmail: composition.fromEmail,
        replyTo: composition.replyTo,
        previewText: composition.previewText,
        editorMode: composition.editorMode,
        trackingConfig,
        scheduleConfig,
      }

      const url = currentDraftId 
        ? `/api/emails/drafts/${currentDraftId}`
        : '/api/emails/drafts'
      
      const method = currentDraftId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to save draft')
      }

      const data = await response.json()
      if (data.draft) {
        setCurrentDraftId(data.draft.id)
        trackEmailSaved({ draftId: data.draft.id, isAutoSave: false })
        if (onSave) {
          await onSave(composition)
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Failed to save draft. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [composition, currentDraftId, trackingConfig, scheduleConfig, onSave])

  // Auto-save draft hook
  useDraftAutoSave({
    composition,
    enabled: true,
    debounceMs: 3000,
    onSave: handleSaveDraft,
  })

  // Load drafts
  const fetchDrafts = useCallback(async () => {
    try {
      setLoadingDrafts(true)
      const response = await fetch('/api/emails/drafts?limit=20', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch drafts')
      }

      const data = await response.json()
      setDrafts(data.drafts || [])
    } catch (error) {
      console.error('Error loading drafts:', error)
    } finally {
      setLoadingDrafts(false)
    }
  }, [])

  // Load a draft
  const handleLoadDraft = useCallback(async (draftId: string) => {
    try {
      const response = await fetch(`/api/emails/drafts/${draftId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load draft')
      }

      const data = await response.json()
      const draft = data.draft

      updateComposition({
        subject: draft.subject || '',
        htmlContent: draft.html_content || '',
        to: draft.to_emails || [],
        mailboxId: draft.mailbox_id || '',
        fromName: draft.from_name || '',
        fromEmail: draft.from_email || '',
        replyTo: draft.reply_to || '',
        previewText: draft.preview_text || '',
        editorMode: draft.editor_mode || 'html',
      })

      if (draft.tracking_config) {
        setTrackingConfig(draft.tracking_config)
      }
      if (draft.schedule_config) {
        setScheduleConfig(draft.schedule_config)
      }

      setCurrentDraftId(draft.id)
      trackDraftLoaded(draft.id)
      setShowDraftSelector(false)
    } catch (error) {
      console.error('Error loading draft:', error)
      alert('Failed to load draft. Please try again.')
    }
  }, [updateComposition])

  // Test email handler
  const handleSendTestEmail = useCallback(async () => {
    if (!testEmailRecipient.trim()) {
      alert('Please enter a test email recipient')
      return
    }

    try {
      setSendingTestEmail(true)
      
      const payload = {
        mailboxId: composition.mailboxId,
        to: [testEmailRecipient.trim()],
        subject: `[TEST] ${composition.subject}`,
        html: composition.htmlContent,
        fromName: composition.fromName,
        fromEmail: composition.fromEmail,
      }

      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      trackTestEmailSent({ recipient: testEmailRecipient })
      alert('Test email sent successfully!')
      setTestEmailRecipient('')
      setShowPreview(false)
    } catch (error) {
      console.error('Error sending test email:', error)
      alert(error instanceof Error ? error.message : 'Failed to send test email')
    } finally {
      setSendingTestEmail(false)
    }
  }, [composition, testEmailRecipient])

  // Trigger link insertion handler
  const handleTriggerLinkInsert = useCallback((linkKey: string, linkUrl: string) => {
    const linkHtml = `<a href="${linkUrl}">Click here</a>`
    const currentContent = composition.htmlContent || ''
    updateComposition({ htmlContent: currentContent + linkHtml })
    trackTriggerLinkInserted(linkKey)
    setShowTriggerLinkSelector(false)
  }, [composition.htmlContent, updateComposition])

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
      trackEmailSent({
        recipientCount: composition.to.length,
        hasCc: !!composition.cc?.length,
        hasBcc: !!composition.bcc?.length,
        sendType: composition.sendType,
      })

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

  const handleTokenInsert = useCallback(
    (token: EmailToken) => {
      const tokenString = generateTokenString(token)
      trackTokenInserted(token.id, { category: token.category })
      const textarea = document.querySelector('textarea[aria-label="Email HTML content editor"]') as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart || 0
        const end = textarea.selectionEnd || 0
        const currentContent = composition.htmlContent
        const newContent = currentContent.slice(0, start) + tokenString + currentContent.slice(end)
        updateComposition({ htmlContent: newContent })
        
        // Set cursor position after inserted token
        setTimeout(() => {
          textarea.focus()
          const newPosition = start + tokenString.length
          textarea.setSelectionRange(newPosition, newPosition)
        }, 0)
      }
    },
    [composition.htmlContent, updateComposition]
  )

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
          onSaveDraft={handleSaveDraft}
          saving={saving}
        />

        {/* Action Buttons Bar */}
        <div className="flex items-center gap-2 flex-wrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <button
            onClick={() => {
              setShowPreview(!showPreview)
              if (!showPreview) {
                trackEmailPreviewed()
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            aria-label="Preview email"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          
          <button
            onClick={() => setShowValidation(!showValidation)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            aria-label="Show validation"
          >
            <AlertCircle className="w-4 h-4" />
            Validate
            {emailValidation.errors.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold text-white bg-red-600 rounded-full">
                {emailValidation.errors.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setShowDraftSelector(!showDraftSelector)
              if (!showDraftSelector) {
                fetchDrafts()
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            aria-label="Load draft"
          >
            <FolderOpen className="w-4 h-4" />
            Load Draft
          </button>

          <button
            onClick={() => setShowTriggerLinkSelector(!showTriggerLinkSelector)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            aria-label="Insert trigger link"
          >
            <Link2 className="w-4 h-4" />
            Trigger Link
          </button>

          <button
            onClick={() => setShowABTestCreator(!showABTestCreator)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            aria-label="Create A/B test"
          >
            <TestTube className="w-4 h-4" />
            A/B Test
          </button>

          <button
            onClick={() => setShowCampaignSelector(!showCampaignSelector)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            aria-label="Select campaign"
          >
            <FolderOpen className="w-4 h-4" />
            Campaign
            {selectedCampaignId && (
              <span className="px-1.5 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                ✓
              </span>
            )}
          </button>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Settings */}
          <div className="lg:col-span-3 space-y-4">
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
            {/* Token Selector */}
            <div>
              <button
                onClick={() => setShowTokenSelector(!showTokenSelector)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                aria-label={showTokenSelector ? 'Hide token selector' : 'Show token selector'}
              >
                <Tag className="w-4 h-4" />
                {showTokenSelector ? 'Hide' : 'Show'} Personalization Tokens
              </button>
              {showTokenSelector && (
                <div className="mt-2">
                  <TokenSelector
                    tokens={availableTokens}
                    onTokenSelect={handleTokenInsert}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="lg:col-span-9 space-y-4">
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
            {composition.editorMode === 'builder' ? (
              <EmailBuilder
                content={composition.htmlContent}
                mode={composition.editorMode}
                onChange={(content) => updateComposition({ htmlContent: content })}
                onModeChange={(mode) => {
                  trackEditorModeChanged(composition.editorMode, mode)
                  updateComposition({ editorMode: mode })
                }}
              />
            ) : (
              <EmailEditorBasic
                content={composition.htmlContent}
                mode={composition.editorMode}
                onChange={(content) => updateComposition({ htmlContent: content })}
                tokens={availableTokens}
                onTokenInsert={handleTokenInsert}
              />
            )}
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

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <EmailPreview
                  htmlContent={composition.htmlContent}
                  subject={composition.subject}
                  fromName={composition.fromName}
                  fromEmail={composition.fromEmail}
                  previewText={composition.previewText}
                  tokenContext={{}}
                  onClose={() => setShowPreview(false)}
                  onSendTest={handleSendTestEmail}
                />
              </div>
              {/* Test Email Input */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Test email recipient"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={sendingTestEmail || !testEmailRecipient.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendingTestEmail ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation Panel */}
        {showValidation && (
          <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Validation</h2>
                <button
                  onClick={() => setShowValidation(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close validation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <ValidationPanel validationResult={emailValidation} />
              </div>
            </div>
          </div>
        )}

        {/* Draft Selector Modal */}
        {showDraftSelector && (
          <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Load Draft</h2>
                <button
                  onClick={() => setShowDraftSelector(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close draft selector"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {loadingDrafts ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No drafts found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        onClick={() => handleLoadDraft(draft.id)}
                      >
                        <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                          {draft.subject || '(No subject)'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Updated: {new Date(draft.updated_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trigger Link Selector Modal */}
        {showTriggerLinkSelector && (
          <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Insert Trigger Link</h2>
                <button
                  onClick={() => setShowTriggerLinkSelector(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close trigger link selector"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <TriggerLinkSelector
                  onSelect={handleTriggerLinkInsert}
                  onClose={() => setShowTriggerLinkSelector(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* A/B Test Creator Modal */}
        {showABTestCreator && (
          <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create A/B Test</h2>
                <button
                  onClick={() => setShowABTestCreator(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close A/B test creator"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <ABTestCreator
                  baseSubject={composition.subject}
                  baseContent={composition.htmlContent}
                  baseFromName={composition.fromName}
                  baseFromEmail={composition.fromEmail}
                  onSave={async (testConfig) => {
                    trackABTestCreated({
                      variantType: testConfig.variantType,
                      variantCount: testConfig.variants.length,
                      winnerCriteria: testConfig.winnerCriteria,
                    })
                    // TODO: Integrate with A/B test API
                    console.log('A/B test config:', testConfig)
                    alert('A/B test creation will be integrated with backend API')
                  }}
                  onClose={() => setShowABTestCreator(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Campaign Selector Modal */}
        {showCampaignSelector && (
          <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select Campaign</h2>
                <button
                  onClick={() => setShowCampaignSelector(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close campaign selector"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <CampaignSelector
                  selectedCampaignId={selectedCampaignId || undefined}
                  onSelect={(campaignId) => {
                    setSelectedCampaignId(campaignId)
                    if (campaignId) {
                      trackCampaignLinked(campaignId)
                    }
                    setShowCampaignSelector(false)
                  }}
                  onCreate={async (campaignName) => {
                    // TODO: Integrate with campaign creation API
                    const response = await fetch('/api/campaigns', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: campaignName }),
                      credentials: 'include',
                    })
                    const data = await response.json()
                    if (!response.ok) {
                      throw new Error(data.error || 'Failed to create campaign')
                    }
                    return data.campaign.id
                  }}
                  onClose={() => setShowCampaignSelector(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

