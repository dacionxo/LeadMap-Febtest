/**
 * Email Provider Types
 */

export type EmailProvider = 'gmail' | 'outlook' | 'smtp' | 'imap_smtp' | 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'generic'

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

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename?: string
  content?: string | Buffer | NodeJS.ReadableStream
  path?: string
  href?: string
  contentType?: string
  contentDisposition?: 'attachment' | 'inline'
  cid?: string  // Content-ID for inline images
  encoding?: 'base64' | 'hex' | 'binary'
  headers?: Record<string, string>
}

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string  // Plain text alternative
  fromName?: string
  fromEmail?: string
  cc?: string
  bcc?: string
  replyTo?: string  // Message-ID to reply to
  references?: string  // Space-separated Message-IDs for threading
  inReplyTo?: string  // Message-ID this is replying to
  headers?: Record<string, string>  // Custom email headers (e.g., List-Unsubscribe)
  attachments?: EmailAttachment[]  // Email attachments
}

export interface SendResult {
  success: boolean
  providerMessageId?: string
  error?: string
}

export type EmailProviderType = 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'generic'

export interface ProviderConfig {
  type: EmailProviderType
  apiKey?: string
  secretKey?: string
  region?: string
  domain?: string
  host?: string
  port?: number
  username?: string
  password?: string
  fromEmail?: string
  sandboxMode?: boolean
  sandboxDomain?: string
  trackingDomain?: string
}

