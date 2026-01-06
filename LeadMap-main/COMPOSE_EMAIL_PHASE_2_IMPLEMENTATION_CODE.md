# Compose Email System - Phase 2 Implementation Code

**Note**: Due to directory permission issues, this file contains all implementation code. Files should be created in:
`app/dashboard/marketing/components/compose-email/`

---

## File 1: types.ts

Location: `app/dashboard/marketing/components/compose-email/types.ts`

```typescript
/**
 * TypeScript Interfaces for Email Composition System
 * Following Mautic patterns and .cursorrules guidelines (interfaces over types)
 */

export interface EmailComposition {
  id?: string
  mailboxId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  previewText?: string
  htmlContent: string
  mjmlContent?: string
  textContent?: string
  editorMode: 'builder' | 'html' | 'mjml' | 'rich-text'
  replyTo?: string
  fromName?: string
  fromEmail?: string
  scheduledAt?: string
  sendType: 'now' | 'schedule' | 'batch' | 'rss' | 'smart'
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
  createdAt?: string
  updatedAt?: string
}

export interface MailboxSelection {
  id: string
  email: string
  displayName?: string
  provider: 'gmail' | 'outlook' | 'smtp' | 'resend' | 'sendgrid'
  active: boolean
  dailyLimit?: number
  hourlyLimit?: number
}

export interface EmailTemplateSelection {
  id: string
  title: string
  body: string
  html?: string
  mjml?: string
  category?: string
  folderId?: string
  thumbnailUrl?: string
}

export type TokenCategory = 'contact' | 'campaign' | 'email' | 'date' | 'custom'

export interface EmailToken {
  id: string
  category: TokenCategory
  key: string
  label: string
  format: string
  description?: string
  exampleValue?: string
  requiresContact?: boolean
}

export interface TokenContext {
  contactId?: string
  contactFields?: Record<string, string | number | boolean | null>
  campaignId?: string
  campaignFields?: Record<string, string | number | boolean | null>
  emailId?: string
  emailFields?: Record<string, string | number | boolean | null>
  dateFormat?: string
  timezone?: string
}

export type DynamicContentFilterType = 
  | 'contact_field'
  | 'contact_segment'
  | 'contact_tags'
  | 'contact_behavior'
  | 'date_range'
  | 'custom'

export interface DynamicContentFilter {
  id: string
  type: DynamicContentFilterType
  field?: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists'
  value?: string | number | boolean
}

export interface DynamicContentVariant {
  id: string
  name: string
  content: string
  filters: DynamicContentFilter[]
  isDefault: boolean
  order: number
}

export interface DynamicContentBlock {
  id: string
  tokenName: string
  variants: DynamicContentVariant[]
  defaultContent: string
}

export type EmailBuilderMode = 'visual' | 'code' | 'preview'

export interface GrapesJSConfig {
  container: string
  height?: string
  plugins?: string[]
  pluginsOpts?: Record<string, unknown>
  storageManager?: boolean | Record<string, unknown>
  assetManager?: Record<string, unknown>
  blockManager?: Record<string, unknown>
  styleManager?: Record<string, unknown>
}

export interface EmailBuilderState {
  mode: EmailBuilderMode
  htmlContent: string
  mjmlContent?: string
  isDirty: boolean
  lastSaved?: string
  selectedBlockId?: string
}

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile' | 'email-client'
export type EmailClientType = 'gmail' | 'outlook' | 'apple-mail' | 'yahoo' | 'generic'

export interface EmailPreviewConfig {
  device: PreviewDevice
  emailClient?: EmailClientType
  showTokensReplaced: boolean
  tokenContext?: TokenContext
}

export interface EmailScheduleConfig {
  sendType: 'now' | 'schedule' | 'batch' | 'rss' | 'smart'
  scheduledAt?: string
  timezone?: string
  batchSize?: number
  batchInterval?: number
  rssFeedUrl?: string
  smartSendEnabled?: boolean
}

export interface EmailTrackingConfig {
  trackOpens: boolean
  trackClicks: boolean
  trackReplies: boolean
  utmTracking: boolean
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
}

export interface EmailValidationError {
  field: string
  message: string
  code?: string
}

export interface EmailValidationResult {
  isValid: boolean
  errors: EmailValidationError[]
  warnings?: EmailValidationError[]
}

export interface ComposeEmailProps {
  initialData?: Partial<EmailComposition>
  onSend?: (email: EmailComposition) => Promise<void>
  onSave?: (email: EmailComposition) => Promise<void>
  onCancel?: () => void
  mode?: 'create' | 'edit' | 'reply' | 'forward'
}

export interface EmailEditorProps {
  content: string
  mode: 'builder' | 'html' | 'mjml' | 'rich-text'
  onChange: (content: string) => void
  onModeChange?: (mode: 'builder' | 'html' | 'mjml' | 'rich-text') => void
  tokens?: EmailToken[]
  onTokenInsert?: (token: EmailToken) => void
}

export interface TemplateSelectorProps {
  selectedTemplateId?: string
  onTemplateSelect: (template: EmailTemplateSelection | null) => void
  onTemplateLoad?: (template: EmailTemplateSelection) => void
  category?: string
  folderId?: string
}

export interface TokenSelectorProps {
  tokens: EmailToken[]
  categories?: TokenCategory[]
  onTokenSelect: (token: EmailToken) => void
  searchQuery?: string
}

export interface EmailPreviewProps {
  htmlContent: string
  subject: string
  previewText?: string
  config: EmailPreviewConfig
  tokenContext?: TokenContext
}

export interface EmailSettingsPanelProps {
  composition: EmailComposition
  mailboxes: MailboxSelection[]
  onCompositionChange: (updates: Partial<EmailComposition>) => void
  trackingConfig?: EmailTrackingConfig
  onTrackingConfigChange?: (config: EmailTrackingConfig) => void
  scheduleConfig?: EmailScheduleConfig
  onScheduleConfigChange?: (config: EmailScheduleConfig) => void
}

export interface EmailComposerHeaderProps {
  title?: string
  description?: string
  status?: 'draft' | 'scheduled' | 'sending'
  onSaveDraft?: () => void
  onPreview?: () => void
  saving?: boolean
}

export interface EmailComposerFooterProps {
  onSend: () => Promise<void>
  onCancel?: () => void
  sending: boolean
  isValid: boolean
  validationErrors?: EmailValidationError[]
  sendType?: 'now' | 'schedule'
}

export interface EmailSendResponse {
  success: boolean
  messageId?: string
  error?: string
  details?: Record<string, unknown>
}

export interface EmailSaveResponse {
  success: boolean
  emailId?: string
  error?: string
}

export interface TemplateLoadResponse {
  success: boolean
  template?: EmailTemplateSelection
  error?: string
}
```

---

## File 2: hooks/useEmailValidation.ts

Location: `app/dashboard/marketing/components/compose-email/hooks/useEmailValidation.ts`

```typescript
'use client'

import { useMemo } from 'react'
import type { EmailComposition, EmailValidationError, EmailValidationResult } from '../types'

/**
 * Email composition validation hook
 * Provides validation logic for email composition following .cursorrules patterns
 */
export function useEmailValidation() {
  const validate = useMemo(
    () => (composition: EmailComposition): EmailValidationResult => {
      const errors: EmailValidationError[] = []
      const warnings: EmailValidationError[] = []

      // Required field validation
      if (!composition.mailboxId) {
        errors.push({
          field: 'mailboxId',
          message: 'Please select a mailbox',
          code: 'REQUIRED',
        })
      }

      if (!composition.to || composition.to.length === 0) {
        errors.push({
          field: 'to',
          message: 'Please enter at least one recipient',
          code: 'REQUIRED',
        })
      }

      if (!composition.subject || composition.subject.trim().length === 0) {
        errors.push({
          field: 'subject',
          message: 'Please enter an email subject',
          code: 'REQUIRED',
        })
      }

      if (!composition.htmlContent || composition.htmlContent.trim().length === 0) {
        errors.push({
          field: 'htmlContent',
          message: 'Please enter email content',
          code: 'REQUIRED',
        })
      }

      // Email format validation
      if (composition.to && composition.to.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        composition.to.forEach((email, index) => {
          if (!emailRegex.test(email)) {
            errors.push({
              field: `to[${index}]`,
              message: `Invalid email address: ${email}`,
              code: 'INVALID_EMAIL',
            })
          }
        })
      }

      if (composition.cc && composition.cc.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        composition.cc.forEach((email, index) => {
          if (!emailRegex.test(email)) {
            errors.push({
              field: `cc[${index}]`,
              message: `Invalid email address: ${email}`,
              code: 'INVALID_EMAIL',
            })
          }
        })
      }

      if (composition.bcc && composition.bcc.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        composition.bcc.forEach((email, index) => {
          if (!emailRegex.test(email)) {
            errors.push({
              field: `bcc[${index}]`,
              message: `Invalid email address: ${email}`,
              code: 'INVALID_EMAIL',
            })
          }
        })
      }

      // Subject length validation (warning)
      if (composition.subject && composition.subject.length > 78) {
        warnings.push({
          field: 'subject',
          message: 'Email subject is longer than recommended (78 characters)',
          code: 'SUBJECT_TOO_LONG',
        })
      }

      // Scheduled date validation
      if (composition.sendType === 'schedule' && composition.scheduledAt) {
        const scheduledDate = new Date(composition.scheduledAt)
        const now = new Date()
        if (scheduledDate <= now) {
          errors.push({
            field: 'scheduledAt',
            message: 'Scheduled time must be in the future',
            code: 'INVALID_DATE',
          })
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    },
    []
  )

  return { validate }
}
```

---

## File 3: hooks/useEmailComposition.ts

Location: `app/dashboard/marketing/components/compose-email/hooks/useEmailComposition.ts`

```typescript
'use client'

import { useState, useCallback } from 'react'
import type { EmailComposition } from '../types'

/**
 * Email composition state management hook
 * Manages composition state and provides update/reset functionality
 */
export function useEmailComposition(initialData?: Partial<EmailComposition>) {
  const [composition, setComposition] = useState<EmailComposition>({
    mailboxId: '',
    to: [],
    subject: '',
    htmlContent: '<p>Hi There!</p>',
    editorMode: 'html',
    sendType: 'now',
    status: 'draft',
    ...initialData,
  })

  const updateComposition = useCallback((updates: Partial<EmailComposition>) => {
    setComposition((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  const resetComposition = useCallback(() => {
    setComposition({
      mailboxId: composition.mailboxId, // Keep mailbox selection
      to: [],
      subject: '',
      htmlContent: '<p>Hi There!</p>',
      editorMode: 'html',
      sendType: 'now',
      status: 'draft',
    })
  }, [composition.mailboxId])

  return {
    composition,
    updateComposition,
    resetComposition,
    setComposition,
  }
}
```

---

## File 4: components/EmailComposerHeader.tsx

Location: `app/dashboard/marketing/components/compose-email/components/EmailComposerHeader.tsx`

```typescript
'use client'

import { Save, Eye, Loader2 } from 'lucide-react'
import type { EmailComposerHeaderProps } from '../types'

/**
 * Email Composer Header Component
 * Header section with title, description, and action buttons
 * Following .cursorrules patterns: TailwindCSS, accessibility, dark mode
 */
export default function EmailComposerHeader({
  title = 'Compose Email',
  description = 'Create and send professional emails',
  status = 'draft',
  onSaveDraft,
  onPreview,
  saving = false,
}: EmailComposerHeaderProps) {
  const getStatusBadge = () => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
      scheduled: { label: 'Scheduled', className: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
      sending: { label: 'Sending', className: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
    }
    const config = statusConfig[status] || statusConfig.draft
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {getStatusBadge()}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSaveDraft && (
          <button
            onClick={onSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Save draft"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Draft
              </>
            )}
          </button>
        )}
        {onPreview && (
          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Preview email"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## File 5: components/EmailComposerFooter.tsx

Location: `app/dashboard/marketing/components/compose-email/components/EmailComposerFooter.tsx`

```typescript
'use client'

import { Send, Clock, X, Loader2, AlertCircle } from 'lucide-react'
import type { EmailComposerFooterProps } from '../types'

/**
 * Email Composer Footer Component
 * Footer with send, cancel actions and validation feedback
 * Following .cursorrules patterns: TailwindCSS, accessibility, error handling
 */
export default function EmailComposerFooter({
  onSend,
  onCancel,
  sending,
  isValid,
  validationErrors = [],
  sendType = 'now',
}: EmailComposerFooterProps) {
  const handleSend = async () => {
    if (!isValid) return
    try {
      await onSend()
    } catch (error) {
      console.error('Error sending email:', error)
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {/* Validation Errors */}
      {!isValid && validationErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
                Please fix the following errors:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={sending || !isValid}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={sendType === 'schedule' ? 'Schedule email' : 'Send email'}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {sendType === 'schedule' ? 'Scheduling...' : 'Sending...'}
              </>
            ) : (
              <>
                {sendType === 'schedule' ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {sendType === 'schedule' ? 'Schedule' : 'Send Now'}
              </>
            )}
          </button>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={sending}
            className="flex items-center gap-2 px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
```

---

This file continues with more components. Due to length, I'll create them in separate files or continue in the next message.



