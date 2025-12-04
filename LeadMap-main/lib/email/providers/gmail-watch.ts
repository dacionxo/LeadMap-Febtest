/**
 * Gmail Watch API Integration
 * Handles Gmail push notifications and email fetching
 */

import { createClient } from '@supabase/supabase-js'

export interface GmailWatchConfig {
  mailboxId: string
  accessToken: string
  refreshToken?: string
  webhookUrl: string
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body: { data?: string; size?: number }
      parts?: Array<{
        mimeType: string
        body: { data?: string }
      }>
    }>
    body?: { data?: string }
  }
  internalDate: string
}

/**
 * Set up Gmail Watch for push notifications
 * Returns watch expiration time and historyId
 */
export async function setupGmailWatch(config: GmailWatchConfig): Promise<{
  success: boolean
  expiration?: number
  historyId?: string
  error?: string
}> {
  try {
    // Gmail Watch expires after 7 days (604800 seconds)
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000)

    // Gmail Watch requires a Google Cloud Pub/Sub topic
    // Set GMAIL_PUBSUB_TOPIC_NAME environment variable (e.g., "projects/your-project/topics/gmail-notifications")
    const topicName = process.env.GMAIL_PUBSUB_TOPIC_NAME
    if (!topicName) {
      return {
        success: false,
        error: 'GMAIL_PUBSUB_TOPIC_NAME environment variable is not set. Please configure Google Cloud Pub/Sub topic first.'
      }
    }

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: topicName,
        labelIds: ['INBOX'], // Watch INBOX for new messages
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Gmail Watch API error: ${response.status}`
      }
    }

    const data = await response.json()

    // Update mailbox with watch expiration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      await supabase
        .from('mailboxes')
        .update({
          watch_expiration: new Date(expiration).toISOString(),
          watch_history_id: data.historyId,
        })
        .eq('id', config.mailboxId)
    }

    return {
      success: true,
      expiration: data.expiration || expiration,
      historyId: data.historyId
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to set up Gmail Watch'
    }
  }
}

/**
 * Fetch email details from Gmail API
 */
export async function fetchGmailMessage(
  messageId: string,
  accessToken: string
): Promise<{ success: boolean; message?: GmailMessage; error?: string }> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Gmail API error: ${response.status}`
      }
    }

    const message = await response.json() as GmailMessage
    return {
      success: true,
      message
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch Gmail message'
    }
  }
}

/**
 * Parse Gmail message to extract email data
 */
export function parseGmailMessage(message: GmailMessage): {
  fromEmail: string
  fromName: string
  toEmail: string
  subject: string
  html: string
  receivedAt: string
  threadId: string
  messageId: string
  inReplyTo?: string
  references?: string
} {
  // Extract headers
  const headers = message.payload.headers
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const fromHeader = getHeader('From')
  const toHeader = getHeader('To')
  const subject = getHeader('Subject') || '(No Subject)'
  const dateHeader = getHeader('Date')
  
  // Parse From header (format: "Name <email>" or just "email")
  let fromName = ''
  let fromEmail = ''
  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/) || fromHeader.match(/^(.+)$/)
  if (fromMatch) {
    if (fromMatch[2]) {
      fromName = fromMatch[1].trim().replace(/"/g, '')
      fromEmail = fromMatch[2]
    } else {
      fromEmail = fromMatch[1]
      fromName = fromMatch[1].split('@')[0]
    }
  }

  // Extract HTML body
  let html = ''
  if (message.payload.body?.data) {
    html = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
  } else if (message.payload.parts) {
    // Find HTML part
    const htmlPart = findHtmlPart(message.payload.parts)
    if (htmlPart) {
      html = Buffer.from(htmlPart, 'base64').toString('utf-8')
    } else {
      // Fallback to plain text
      const textPart = findTextPart(message.payload.parts)
      if (textPart) {
        const text = Buffer.from(textPart, 'base64').toString('utf-8')
        html = `<pre>${text.replace(/\n/g, '<br>')}</pre>`
      }
    }
  }

  // Parse date
  const receivedAt = dateHeader 
    ? new Date(dateHeader).toISOString() 
    : new Date(parseInt(message.internalDate)).toISOString()

  // Extract reply headers
  const inReplyTo = getHeader('In-Reply-To') || undefined
  const referencesHeader = getHeader('References') || ''
  const references = referencesHeader ? referencesHeader.split(/\s+/).filter(Boolean).join(' ') : undefined

  return {
    fromEmail,
    fromName,
    toEmail: toHeader || '',
    subject,
    html: html || message.snippet,
    receivedAt,
    threadId: message.threadId,
    messageId: message.id,
    inReplyTo,
    references
  }
}

function findHtmlPart(parts: any[]): string | null {
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return part.body.data
    }
    if (part.parts) {
      const found = findHtmlPart(part.parts)
      if (found) return found
    }
  }
  return null
}

function findTextPart(parts: any[]): string | null {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return part.body.data
    }
    if (part.parts) {
      const found = findTextPart(part.parts)
      if (found) return found
    }
  }
  return null
}

/**
 * Refresh Gmail access token
 */
export async function refreshGmailToken(refreshToken: string): Promise<{
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
}> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Google OAuth credentials not configured'
      }
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error_description || 'Failed to refresh Gmail token'
      }
    }

    const data = await response.json()
    const expiresIn = data.expires_in || 3600 // Default to 1 hour

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to refresh Gmail token'
    }
  }
}

