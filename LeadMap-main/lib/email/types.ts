/**
 * Email Provider Types
 */

export type EmailProvider = 'gmail' | 'outlook' | 'smtp' | 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'generic'

export interface Mailbox {
  id: string
  user_id: string
  provider: EmailProvider
  email: string
  display_name?: string
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_password?: string
  from_name?: string
  from_email?: string
  daily_limit: number
  hourly_limit: number
  active: boolean
  last_error?: string
}

export interface EmailPayload {
  to: string
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
  cc?: string
  bcc?: string
  replyTo?: string  // Message-ID to reply to
  references?: string  // Space-separated Message-IDs for threading
  inReplyTo?: string  // Message-ID this is replying to
}

export interface SendResult {
  success: boolean
  providerMessageId?: string
  error?: string
}

