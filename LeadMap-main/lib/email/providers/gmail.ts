/**
 * Gmail Email Provider
 * Uses Gmail API to send emails
 */

import { Mailbox, EmailPayload, SendResult } from '../types'
import { decryptMailboxTokens, encryptMailboxTokens } from '../encryption'

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

export async function gmailSend(
  mailbox: Mailbox, 
  email: EmailPayload,
  supabase?: any
): Promise<SendResult> {
  try {
    // Decrypt tokens if encrypted
    const decryptedMailbox = getDecryptedMailbox(mailbox)
    
    // --- 1. Compute initial access token as you already do ---
    let accessToken = decryptedMailbox.access_token
    if (decryptedMailbox.token_expires_at && decryptedMailbox.refresh_token) {
      const expiresAt = new Date(decryptedMailbox.token_expires_at)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (expiresAt < fiveMinutesFromNow) {
        const refreshed = await refreshGmailToken(decryptedMailbox)
        if (!refreshed.success || !refreshed.accessToken) {
          return {
            success: false,
            error: refreshed.error || 'Failed to refresh Gmail token'
          }
        }
        accessToken = refreshed.accessToken
        
        // Save refreshed token to database if supabase is available
        if (supabase && mailbox.id) {
          try {
            const encrypted = encryptMailboxTokens({
              access_token: refreshed.accessToken,
              refresh_token: null, // Keep existing refresh token
              smtp_password: null
            })
            
            const expiresInSeconds = refreshed.expiresIn || 3600 // Default to 1 hour
            const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
            
            await supabase
              .from('mailboxes')
              .update({
                access_token: encrypted.access_token || refreshed.accessToken,
                token_expires_at: newExpiresAt,
                updated_at: new Date().toISOString()
              })
              .eq('id', mailbox.id)
            
            console.log('Saved refreshed Gmail token to database', {
              mailbox_id: mailbox.id
            })
          } catch (error: any) {
            console.error('Failed to save refreshed token to database:', error)
            // Continue anyway - token is valid for this send
          }
        }
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
      headers: email.headers,
      inReplyTo: email.inReplyTo,
      references: email.references
    })

    // Helper to actually send
    const sendOnce = async (token: string) => {
      return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: message })
      })
    }

    // --- 2. First attempt ---
    let response = await sendOnce(accessToken)

    // --- 3. If 401 and we *can* refresh, try once more ---
    if (response.status === 401 && decryptedMailbox.refresh_token) {
      console.warn('Gmail send returned 401, attempting token refresh and retry', {
        mailbox_id: mailbox.id,
        mailbox_email: mailbox.email
      })

      const refreshed = await refreshGmailToken(decryptedMailbox)
      if (refreshed.success && refreshed.accessToken) {
        console.log('Gmail token refreshed successfully, retrying send', {
          mailbox_id: mailbox.id
        })
        accessToken = refreshed.accessToken
        
        // Save refreshed token to database if supabase is available
        if (supabase && mailbox.id) {
          try {
            const encrypted = encryptMailboxTokens({
              access_token: refreshed.accessToken,
              refresh_token: null, // Keep existing refresh token
              smtp_password: null
            })
            
            const expiresInSeconds = refreshed.expiresIn || 3600 // Default to 1 hour
            const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
            
            await supabase
              .from('mailboxes')
              .update({
                access_token: encrypted.access_token || refreshed.accessToken,
                token_expires_at: newExpiresAt,
                updated_at: new Date().toISOString()
              })
              .eq('id', mailbox.id)
            
            console.log('Saved refreshed Gmail token to database after 401 retry', {
              mailbox_id: mailbox.id
            })
          } catch (error: any) {
            console.error('Failed to save refreshed token to database:', error)
            // Continue anyway - token is valid for this send
          }
        }
        
        response = await sendOnce(refreshed.accessToken)
      } else {
        console.error('Gmail token refresh failed during 401 retry', {
          mailbox_id: mailbox.id,
          error: refreshed.error
        })
      }
    }

    // --- 4. Handle response as before ---
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        errorData.error?.message ||
        `Gmail API error: ${response.status} ${response.statusText}`

      // Enhanced error logging for 401 failures
      if (response.status === 401) {
        console.error('Gmail authentication failed after retry', {
          mailbox_id: mailbox.id,
          mailbox_email: mailbox.email,
          error_data: errorData,
          error_code: errorData.error?.code,
          error_message: errorData.error?.message,
          error_description: errorData.error_description,
          has_refresh_token: !!decryptedMailbox.refresh_token
        })

        return {
          success: false,
          error: 'Gmail authentication expired. Please reconnect your mailbox.'
        }
      }

      console.error('Gmail send failed', {
        mailbox_id: mailbox.id,
        status: response.status,
        error_data: errorData
      })

      return { success: false, error: errorMessage }
    }

    const data = await response.json()
    return {
      success: true,
      providerMessageId: data.id
    }
  } catch (error: any) {
    console.error('Gmail send exception', {
      error: error.message,
      stack: error.stack,
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email
    })
    return {
      success: false,
      error: error.message || 'Failed to send email via Gmail'
    }
  }
}

export async function refreshGmailToken(mailbox: Mailbox): Promise<{ 
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string 
}> {
  // Decrypt refresh token if encrypted
  const decryptedMailbox = getDecryptedMailbox(mailbox)
  
  const refreshToken = decryptedMailbox.refresh_token
  if (!refreshToken) {
    return {
      success: false,
      error: 'Missing Gmail refresh token'
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Gmail OAuth client not configured (GOOGLE_CLIENT_ID/SECRET missing)'
    }
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({} as any))
      const msg =
        data.error_description ||
        data.error ||
        `Failed to refresh Gmail token (${resp.status})`

      console.error('Gmail token refresh failed:', {
        status: resp.status,
        error: data.error,
        error_description: data.error_description,
        mailbox_id: mailbox.id,
        mailbox_email: mailbox.email
      })

      return { success: false, error: msg }
    }

    const data = await resp.json()
    const newAccessToken = data.access_token as string | undefined
    const expiresIn = data.expires_in as number | undefined

    if (!newAccessToken) {
      console.error('Gmail token refresh response missing access_token', {
        response_keys: Object.keys(data),
        mailbox_id: mailbox.id
      })
      return {
        success: false,
        error: 'Gmail token refresh response did not include access_token'
      }
    }

    // Return token and expiration info for callers to persist
    return {
      success: true,
      accessToken: newAccessToken,
      expiresIn: expiresIn || 3600 // Default to 1 hour if not provided
    }
  } catch (error: any) {
    console.error('Gmail token refresh exception:', {
      error: error.message,
      stack: error.stack,
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email
    })
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
    headers?: Record<string, string>
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

  // Add custom headers (e.g., List-Unsubscribe)
  if (options?.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.push(`${key}: ${value}`)
    }
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

