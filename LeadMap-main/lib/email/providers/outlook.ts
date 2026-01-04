/**
 * Outlook Email Provider
 * Uses Microsoft Graph API to send emails
 */

import { Mailbox, EmailPayload, SendResult } from '../types'
import { createTokenPersistence } from '../token-persistence'
import { refreshToken as refreshOAuthToken } from '../token-refresh'
import { 
  TokenRefreshError, 
  AuthenticationError,
  getUserFriendlyErrorMessage,
  classifyError
} from '../errors'

export async function outlookSend(mailbox: Mailbox, email: EmailPayload): Promise<SendResult> {
  try {
    // Create token persistence instance
    const tokenPersistence = createTokenPersistence(mailbox)
    
    // Check if authenticated
    if (!tokenPersistence.isAuthenticated()) {
      return {
        success: false,
        error: 'Outlook mailbox is not authenticated. Please reconnect your Outlook account.'
      }
    }
    
    // Get access token
    let accessToken = tokenPersistence.getAccessToken()
    
    // Check if token is expired and refresh if needed
    if (tokenPersistence.isTokenExpired(5)) {
      const refreshToken = tokenPersistence.getRefreshToken()
      if (!refreshToken) {
        return {
          success: false,
          error: 'Outlook refresh token is missing. Please reconnect your Outlook account.'
        }
      }

      // Token is expired or about to expire, refresh it using unified refresh function
      const refreshed = await refreshOAuthToken(mailbox, {
        persistToDatabase: false // Outlook provider doesn't have supabase in signature
      })
      if (!refreshed.success || !refreshed.accessToken) {
        const refreshError = new TokenRefreshError(
          refreshed.error || 'Failed to refresh Outlook token',
          'outlook',
          { error_code: refreshed.errorCode }
        )

        console.error('Outlook token refresh failed', {
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

    const message: any = {
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

    // Add custom headers (e.g., List-Unsubscribe) if provided
    if (email.headers && Object.keys(email.headers).length > 0) {
      message.message.internetMessageHeaders = Object.entries(email.headers).map(([name, value]) => ({
        name,
        value
      }))
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
      
      // Enhanced error handling with error classification
      if (response.status === 401) {
        const authError = new AuthenticationError(
          `Outlook authentication failed: ${errorMessage}`,
          'outlook',
          {
            status: response.status,
            error_code: errorCode,
            error_data: errorData
          }
        )

        console.error('Outlook authentication failed', {
          mailbox_id: mailbox.id,
          errorType: classifyError(authError),
          error_code: errorCode
        })

        return {
          success: false,
          error: getUserFriendlyErrorMessage(authError)
        }
      }
      
      if (response.status === 403) {
        // Permission error - permanent
        const errorObj = new Error(errorMessage) as Error & { statusCode?: number }
        errorObj.statusCode = 403
        const errorType = classifyError(errorObj)
        console.error('Outlook permission denied', {
          mailbox_id: mailbox.id,
          errorType,
          error_code: errorCode
        })

        return {
          success: false,
          error: `Outlook API permission denied (${errorCode}): ${errorMessage}. Please check your mailbox permissions.`
        }
      }
      
      if (response.status === 429) {
        // Rate limit - transient
        const errorObj = new Error(errorMessage) as Error & { statusCode?: number }
        errorObj.statusCode = 429
        const errorType = classifyError(errorObj)
        console.warn('Outlook rate limit exceeded', {
          mailbox_id: mailbox.id,
          errorType
        })

        return {
          success: false,
          error: `Outlook API rate limit exceeded. Please try again later.`
        }
      }
      
      if (response.status >= 500) {
        // Server error - transient
        const errorObj = new Error(errorMessage) as Error & { statusCode?: number }
        errorObj.statusCode = response.status
        const errorType = classifyError(errorObj)
        console.error('Outlook server error', {
          mailbox_id: mailbox.id,
          errorType,
          error_code: errorCode
        })

        return {
          success: false,
          error: `Outlook API server error (${errorCode}): ${errorMessage}. This is a temporary issue, please retry.`
        }
      }

      // Other errors
      const errorObj = new Error(errorMessage) as Error & { statusCode?: number }
      errorObj.statusCode = response.status
      const errorType = classifyError(errorObj)
      console.error('Outlook API error', {
        mailbox_id: mailbox.id,
        status: response.status,
        errorType,
        error_code: errorCode
      })

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

/**
 * Refresh Outlook token
 * 
 * @deprecated Use refreshToken() from '../token-refresh' instead
 * This function is kept for backward compatibility and re-exports the unified refresh function
 */
export { refreshOutlookToken } from '../token-refresh'

