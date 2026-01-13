/**
 * Gmail Email Provider
 * Uses Gmail API to send emails
 */

import { Mailbox, EmailPayload, SendResult } from '../types'
import { createTokenPersistence } from '../token-persistence'
import { refreshToken as refreshOAuthToken } from '../token-refresh'
import { 
  TokenExpiredError, 
  TokenRefreshError, 
  AuthenticationError,
  getUserFriendlyErrorMessage,
  classifyError
} from '../errors'

export async function gmailSend(
  mailbox: Mailbox, 
  email: EmailPayload,
  supabase?: any
): Promise<SendResult> {
  try {
    // Create token persistence instance
    const tokenPersistence = createTokenPersistence(mailbox)
    
    // Check if authenticated
    if (!tokenPersistence.isAuthenticated()) {
      return {
        success: false,
        error: 'Gmail mailbox is not authenticated. Please reconnect your Gmail account.'
      }
    }
    
    // Get access token
    let accessToken = tokenPersistence.getAccessToken()
    
    // Check if token is expired and refresh if needed
    if (tokenPersistence.isTokenExpired(5)) {
      const refreshTokenValue = tokenPersistence.getRefreshToken()
      if (!refreshTokenValue) {
        return {
          success: false,
          error: 'Gmail refresh token is missing. Please reconnect your Gmail account.'
        }
      }

      // Refresh the token using unified refresh function
      const refreshed = await refreshOAuthToken(mailbox, {
        supabase,
        persistToDatabase: true
      })
      if (!refreshed.success || !refreshed.accessToken) {
        const refreshError = new TokenRefreshError(
          refreshed.error || 'Failed to refresh Gmail token',
          'gmail',
          { error_code: refreshed.errorCode }
        )

        console.error('Gmail token refresh failed', {
          mailbox_id: mailbox.id,
          errorType: classifyError(refreshError),
          error: refreshed.error
        })

        return {
          success: false,
          error: getUserFriendlyErrorMessage(refreshError)
        }
      }

      accessToken = refreshed.accessToken
      // Token persistence and database update are handled by refreshToken() when persistToDatabase is true
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
    if (response.status === 401 && tokenPersistence.getRefreshToken()) {
      console.warn('Gmail send returned 401, attempting token refresh and retry', {
        mailbox_id: mailbox.id,
        mailbox_email: mailbox.email
      })

      const refreshed = await refreshOAuthToken(mailbox, {
        supabase,
        persistToDatabase: true
      })
      if (refreshed.success && refreshed.accessToken) {
        console.log('Gmail token refreshed successfully, retrying send', {
          mailbox_id: mailbox.id
        })
        accessToken = refreshed.accessToken
        // Token persistence and database update are handled by refreshOAuthToken() when persistToDatabase is true
        
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

      // Enhanced error handling with error classification
      if (response.status === 401) {
        const authError = new AuthenticationError(
          `Gmail authentication failed: ${errorMessage}`,
          'gmail',
          {
            status: response.status,
            error_data: errorData,
            has_refresh_token: !!tokenPersistence.getRefreshToken()
          }
        )

        console.error('Gmail authentication failed after retry', {
          mailbox_id: mailbox.id,
          mailbox_email: mailbox.email,
          errorType: classifyError(authError),
          error_code: errorData.error?.code,
          error_message: errorData.error?.message,
          error_description: errorData.error_description,
          has_refresh_token: !!tokenPersistence.getRefreshToken()
        })

        return {
          success: false,
          error: getUserFriendlyErrorMessage(authError)
        }
      }

      // Classify other errors for better logging
      const errorObj = new Error(errorMessage) as Error & { statusCode?: number }
      errorObj.statusCode = response.status
      const errorType = classifyError(errorObj)
      
      console.error('Gmail send failed', {
        mailbox_id: mailbox.id,
        status: response.status,
        errorType,
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
  // Create token persistence instance to get decrypted refresh token
  const tokenPersistence = createTokenPersistence(mailbox)
  
  const refreshToken = tokenPersistence.getRefreshToken()
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

