import type { EmailTemplate, Listing, ProbateLead } from '@/types'
import { renderTemplate as renderTemplateEngine, renderSubject as renderSubjectEngine, previewTemplate, extractTemplateVariables, validateTemplateVariables, type TemplateContext, type TemplateOptions } from '@/lib/email/template-engine'

/**
 * Authenticated fetch wrapper
 */
export async function authedFetch(path: string, init: RequestInit = {}) {
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    credentials: 'include',
  })
}

/**
 * Leads API
 */
export const getExpiredLeads = () =>
  authedFetch('/api/leads/expired').then(r => r.json()) as Promise<{ leads: Listing[] }>

export const postEnrichLeads = (listingIds: string[]) =>
  authedFetch('/api/enrich-leads', {
    method: 'POST',
    body: JSON.stringify({ listingIds }),
  }).then(r => r.json())

/**
 * Email Templates API
 */
export const listEmailTemplates = () =>
  authedFetch('/api/email-templates').then(r => r.json()) as Promise<{ templates: EmailTemplate[] }>

export const getEmailTemplate = (id: string) =>
  authedFetch(`/api/email-templates/${id}`).then(r => r.json()) as Promise<{ template: EmailTemplate }>

export const createEmailTemplate = (template: Partial<EmailTemplate>) =>
  authedFetch('/api/email-templates', {
    method: 'POST',
    body: JSON.stringify(template),
  }).then(r => r.json())

export const updateEmailTemplate = (id: string, template: Partial<EmailTemplate>) =>
  authedFetch(`/api/email-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(template),
  }).then(r => r.json())

export const deleteEmailTemplate = (id: string) =>
  authedFetch(`/api/email-templates/${id}`, {
    method: 'DELETE',
  }).then(r => r.json())

/**
 * Template Test Email API
 */
export interface TestTemplateRequest {
  template_id: string
  test_email: string
  test_context?: Record<string, any>
  mailbox_id: string
}

export const testEmailTemplate = (request: TestTemplateRequest) =>
  authedFetch(`/api/email-templates/${request.template_id}/test`, {
    method: 'POST',
    body: JSON.stringify(request),
  }).then(r => r.json())

/**
 * Template Versions API
 */
export const getTemplateVersions = (templateId: string) =>
  authedFetch(`/api/email-templates/${templateId}/versions`).then(r => r.json()) as Promise<{ versions: any[] }>

export const restoreTemplateVersion = (templateId: string, version: number, changeNotes?: string) =>
  authedFetch(`/api/email-templates/${templateId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ version, change_notes: changeNotes }),
  }).then(r => r.json())

/**
 * Template Stats API
 */
export const getTemplateStats = (templateId: string, version?: number) => {
  const url = version
    ? `/api/email-templates/${templateId}/stats?version=${version}`
    : `/api/email-templates/${templateId}/stats`
  return authedFetch(url).then(r => r.json()) as Promise<{ stats: any[] }>
}

/**
 * Template Folders API
 */
export const listTemplateFolders = () =>
  authedFetch('/api/template-folders').then(r => r.json()) as Promise<{ folders: any[] }>

export const createTemplateFolder = (folder: { name: string; path: string; parent_folder_id?: string; scope?: string }) =>
  authedFetch('/api/template-folders', {
    method: 'POST',
    body: JSON.stringify(folder),
  }).then(r => r.json())

/**
 * Geo Leads API
 */
export const postGeoLeads = (lat: number, lng: number, radius_km: number) =>
  authedFetch('/api/geo-leads', {
    method: 'POST',
    body: JSON.stringify({ lat, lng, radius_km }),
  }).then(r => r.json())

/**
 * Probate Leads API
 */
export const listProbateLeads = () =>
  authedFetch('/api/probate-leads').then(r => r.json()) as Promise<{ leads: ProbateLead[] }>

export const uploadProbateLeads = (leads: Partial<ProbateLead>[]) =>
  authedFetch('/api/probate-leads', {
    method: 'POST',
    body: JSON.stringify({ leads }),
  }).then(r => r.json())

/**
 * Assistant API (Ollama)
 */
export const askAssistant = async (
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
) => {
  const response = await authedFetch('/api/assistant', {
    method: 'POST',
    body: JSON.stringify({ message, conversationHistory }),
  })

  if (!response.ok) {
    throw new Error('Assistant API error')
  }

  const data = await response.json()
  return data.response
}

/**
 * Template rendering helper (enhanced with advanced engine)
 */
export function renderTemplate(body: string, lead: Partial<Listing>, options?: TemplateOptions): string {
  const context: TemplateContext = {
    address: lead.address || '',
    city: lead.city || '',
    state: lead.state || '',
    zip: lead.zip || '',
    owner_name: lead.owner_name || 'Owner',
    price: lead.price,
    price_drop_percent: lead.price_drop_percent || 0,
    days_on_market: lead.days_on_market || 0,
    url: lead.url || '',
    source: lead.source || '',
    owner_email: lead.owner_email || '',
    owner_phone: lead.owner_phone || '',
    // Nested structure for advanced templates
    listing: {
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      zip: lead.zip || '',
      price: lead.price,
      price_drop_percent: lead.price_drop_percent || 0,
      days_on_market: lead.days_on_market || 0,
      url: lead.url || '',
    },
    owner: {
      name: lead.owner_name || 'Owner',
      email: lead.owner_email || '',
      phone: lead.owner_phone || '',
    },
  }

  return renderTemplateEngine(body, context, options)
}

/**
 * Render subject line with template variables
 */
export function renderSubject(subject: string, lead: Partial<Listing>, options?: TemplateOptions): string {
  const context: TemplateContext = {
    address: lead.address || '',
    city: lead.city || '',
    state: lead.state || '',
    zip: lead.zip || '',
    owner_name: lead.owner_name || 'Owner',
    price: lead.price,
    price_drop_percent: lead.price_drop_percent || 0,
    days_on_market: lead.days_on_market || 0,
    listing: {
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      zip: lead.zip || '',
      price: lead.price,
    },
    owner: {
      name: lead.owner_name || 'Owner',
    },
  }

  return renderSubjectEngine(subject, context, options)
}

/**
 * Preview template with sample data
 */
export { previewTemplate, extractTemplateVariables, validateTemplateVariables }

/**
 * Email Sending API
 */
export interface SendEmailRequest {
  mailboxId: string
  to: string
  subject: string
  html: string
  scheduleAt?: string
  type?: 'transactional' | 'campaign'
}

export interface SendEmailResponse {
  success: boolean
  email?: {
    id: string
    status: string
    sent_at?: string
    provider_message_id?: string
  }
  error?: string
  message?: string
}

export const sendEmail = (request: SendEmailRequest) =>
  authedFetch('/api/emails/send', {
    method: 'POST',
    body: JSON.stringify(request),
  }).then(r => r.json()) as Promise<SendEmailResponse>

export const queueEmail = (request: SendEmailRequest) =>
  authedFetch('/api/emails/queue', {
    method: 'POST',
    body: JSON.stringify(request),
  }).then(r => r.json()) as Promise<SendEmailResponse>

/**
 * Email Settings API
 */
export interface EmailSettings {
  from_name: string
  reply_to: string
  default_footer: string
}

export const getEmailSettings = () =>
  authedFetch('/api/emails/settings').then(r => r.json()) as Promise<{ settings: EmailSettings }>

export const updateEmailSettings = (settings: Partial<EmailSettings>) =>
  authedFetch('/api/emails/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }).then(r => r.json())

/**
 * Mailbox Health Check API
 */
export const checkMailboxHealth = (mailboxId: string) =>
  authedFetch(`/api/mailboxes/${mailboxId}/health`).then(r => r.json()) as Promise<{
    healthy: boolean
    status: string
    last_checked?: string
    error?: string
  }>

