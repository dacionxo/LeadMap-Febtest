/**
 * Gmail Email Provider
 * Uses Gmail API to send emails
 */

import { Mailbox, EmailPayload, SendResult } from '../types'
import { decryptMailboxTokens } from '../encryption'

/**
 * Decrypt mailbox tokens for use
 */
function getDecryptedMailbox(mailbox: Mailbox): Mailbox {
  const decrypted = decryptMailboxTokens({
    access_token: mailbox.access_token,
    refresh_token: mailbox.refresh_token,
    smtp_password: mailbox.smtp_password
  })

  return {
    ...mailbox,
    access_token: decrypted.access_token || mailbox.access_token,
    refresh_token: decrypted.refresh_token || mailbox.refresh_token,
    smtp_password: decrypted.smtp_password || mailbox.smtp_password
  }
}

export async function gmailSend(mailbox: Mailbox, email: EmailPayload): Promise<SendResult> {
  try {
    // Decrypt tokens if encrypted
    const decryptedMailbox = getDecryptedMailbox(mailbox)
    
    // Check if token needs refresh
    let accessToken = decryptedMailbox.access_token
    if (decryptedMailbox.token_expires_at && decryptedMailbox.refresh_token) {
      const expiresAt = new Date(decryptedMailbox.token_expires_at)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (expiresAt < fiveMinutesFromNow) {
        // Token is expired or about to expire, refresh it
        const refreshed = await refreshGmailToken(decryptedMailbox)
        if (!refreshed.success || !refreshed.accessToken) {
          return {
            success: false,
            error: refreshed.error || 'Failed to refresh Gmail token'
          }
        }
        accessToken = refreshed.accessToken
      }
    }

    if (!accessToken) {
      return {
        success: false,
        error: 'Gmail access token is missing'
      }
    }

    // Create MIME message
    const fromEmail = email.fromEmail || mailbox.email
    const fromName = email.fromName || mailbox.from_name || mailbox.display_name || mailbox.email
    const from = `${fromName} <${fromEmail}>`

    const message = createGmailMimeMessage(from, email.to, email.subject, email.html, {
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo,
      inReplyTo: email.inReplyTo,
      references: email.references
    })

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: message
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `Gmail API error: ${response.status} ${response.statusText}`
      
      // Check for specific error codes
      if (response.status === 401) {
        return {
          success: false,
          error: 'Gmail authentication expired. Please reconnect your mailbox.'
        }
      }

      return {
        success: false,
        error: errorMessage
      }
    }

    const data = await response.json()
    return {
      success: true,
      providerMessageId: data.id
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via Gmail'
    }
  }
}

export async function refreshGmailToken(mailbox: Mailbox): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  // Decrypt refresh token if encrypted
  const decryptedMailbox = getDecryptedMailbox(mailbox)
  
  if (!decryptedMailbox.refresh_token) {
    return {
      success: false,
      error: 'Refresh token is missing'
    }
  }

  try {
    // Use client_id and client_secret from environment
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
        refresh_token: decryptedMailbox.refresh_token,
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
    
    // Return both access token and expiration for caller to save
    return {
      success: true,
      accessToken: data.access_token
      // Note: expires_in is returned by Google but we track expiration via token_expires_at in mailbox
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to refresh Gmail token'
    }
  }
}

function createGmailMimeMessage(
  from: string, 
  to: string, 
  subject: string, 
  html: string,
  options?: {
    cc?: string
    bcc?: string
    replyTo?: string
    inReplyTo?: string
    references?: string
  }
): string {
  // Create a proper MIME message
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36)}`
  
  const headers: string[] = [
    `From: ${from}`,
    `To: ${to}`
  ]

  if (options?.cc) {
    headers.push(`Cc: ${options.cc}`)
  }

  if (options?.bcc) {
    headers.push(`Bcc: ${options.bcc}`)
  }

  headers.push(`Subject: ${subject}`)

  if (options?.replyTo) {
    headers.push(`Reply-To: ${options.replyTo}`)
  }

  if (options?.inReplyTo) {
    headers.push(`In-Reply-To: ${options.inReplyTo}`)
  }

  if (options?.references) {
    headers.push(`References: ${options.references}`)
  }

  headers.push(
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString('base64'),
    `--${boundary}--`
  )
  
  const mimeMessage = headers.join('\r\n')

  // Base64URL encode the message
  return Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

