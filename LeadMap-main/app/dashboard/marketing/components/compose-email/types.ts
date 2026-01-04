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

