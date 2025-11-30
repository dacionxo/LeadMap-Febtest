/**
 * Outlook Email Provider
 * Uses Microsoft Graph API to send emails
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

export async function outlookSend(mailbox: Mailbox, email: EmailPayload): Promise<SendResult> {
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
        const refreshed = await refreshOutlookToken(decryptedMailbox)
        if (!refreshed.success || !refreshed.accessToken) {
          return {
            success: false,
            error: refreshed.error || 'Failed to refresh Outlook token'
          }
        }
        accessToken = refreshed.accessToken
      }
    }

    if (!accessToken) {
      return {
        success: false,
        error: 'Outlook access token is missing'
      }
    }

    // Prepare email message for Microsoft Graph API
    const fromEmail = email.fromEmail || mailbox.email
    const fromName = email.fromName || mailbox.from_name || mailbox.display_name || mailbox.email
    const fromAddress = {
      emailAddress: {
        address: fromEmail,
        name: fromName
      }
    }

    const message = {
      message: {
        subject: email.subject,
        body: {
          contentType: 'HTML',
          content: email.html
        },
        from: fromAddress,
        toRecipients: [
          {
            emailAddress: {
              address: email.to
            }
          }
        ]
      }
    }

    // Send via Microsoft Graph API
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorCode = errorData.error?.code || ''
      const errorMessage = errorData.error?.message || `Microsoft Graph API error: ${response.status} ${response.statusText}`
      
      // Check for specific error codes and provide detailed messages
      if (response.status === 401) {
        return {
          success: false,
          error: 'Outlook authentication expired. Please reconnect your mailbox.'
        }
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: `Outlook API permission denied (${errorCode}): ${errorMessage}. Please check your mailbox permissions.`
        }
      }
      
      if (response.status === 429) {
        return {
          success: false,
          error: `Outlook API rate limit exceeded. Please try again later.`
        }
      }
      
      if (response.status >= 500) {
        return {
          success: false,
          error: `Outlook API server error (${errorCode}): ${errorMessage}. This is a temporary issue, please retry.`
        }
      }

      return {
        success: false,
        error: `Outlook API error (${errorCode}): ${errorMessage}`
      }
    }

    // Microsoft Graph sendMail doesn't return message ID in response
    // We need to fetch it from sent items. Create a draft first, then send, or fetch from sent items
    // For now, we'll create a message in drafts, send it, then fetch the sent message ID
    try {
      // Fetch the most recent sent message to get its ID
      const sentResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/sentItems/messages?$top=1&$orderby=createdDateTime desc', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })

      if (sentResponse.ok) {
        const sentData = await sentResponse.json()
        if (sentData.value && sentData.value.length > 0) {
          return {
            success: true,
            providerMessageId: sentData.value[0].id
          }
        }
      }
    } catch (fetchError) {
      console.warn('Could not fetch sent message ID from Outlook, using timestamp-based ID:', fetchError)
    }

    // Fallback: use timestamp-based ID if we can't fetch the real one
    // This is less ideal but better than failing
    return {
      success: true,
      providerMessageId: `outlook-temp-${Date.now()}`
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via Outlook'
    }
  }
}

export async function refreshOutlookToken(mailbox: Mailbox): Promise<{ success: boolean; accessToken?: string; error?: string }> {
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
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Microsoft OAuth credentials not configured'
      }
    }

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: mailbox.refresh_token,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Send offline_access'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error_description || 'Failed to refresh Outlook token'
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      accessToken: data.access_token
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to refresh Outlook token'
    }
  }
}

