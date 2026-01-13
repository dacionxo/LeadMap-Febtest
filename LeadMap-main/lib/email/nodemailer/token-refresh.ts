/**
 * OAuth2 Token Refresh for nodemailer
 * 
 * Handles OAuth2 token refresh for nodemailer transporters
 * Following james-project token refresh patterns
 * Following .cursorrules: TypeScript best practices, error handling
 */

import type { Mailbox } from '../types'
import type { OAuth2Config } from './types'
import { createTokenPersistence } from '../token-persistence'
import { TokenExpiredError, TokenRefreshError, AuthenticationError } from '../errors'
import { refreshOutlookToken } from '../unibox/outlook-connector'

/**
 * Token refresh result with database update data
 */
export interface TokenRefreshResult {
  oauth2Config: OAuth2Config
  accessToken: string
  expiresAt: string // ISO date string
  expiresIn: number
}

/**
 * Refresh Gmail OAuth2 token
 */
async function refreshGmailToken(refreshToken: string): Promise<{
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
        error: 'Google OAuth credentials not configured',
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
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error_description || 'Failed to refresh Gmail token',
      }
    }

    const data = await response.json()
    const expiresIn = data.expires_in || 3600

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to refresh Gmail token',
    }
  }
}

/**
 * Refresh OAuth2 token for mailbox
 * 
 * @param mailbox - The mailbox
 * @returns Token refresh result with OAuth2 config and database update data
 * @throws TokenRefreshError if refresh fails
 */
export async function refreshOAuth2Token(mailbox: Mailbox): Promise<TokenRefreshResult> {
  const tokenPersistence = createTokenPersistence(mailbox)
  const decryptedMailbox = tokenPersistence.getDecryptedMailbox()

  // Early return if not OAuth provider
  if (mailbox.provider !== 'gmail' && mailbox.provider !== 'outlook') {
    throw new AuthenticationError(
      `OAuth2 not supported for provider: ${mailbox.provider}`,
      mailbox.provider
    )
  }

  // Get refresh token
  const refreshToken = decryptedMailbox.refresh_token
  if (!refreshToken) {
    throw new TokenRefreshError(
      `Refresh token not found for ${mailbox.provider} mailbox`,
      mailbox.provider
    )
  }

  // Refresh token based on provider
  let refreshResult: { success: boolean; accessToken?: string; expiresIn?: number; error?: string }

  if (mailbox.provider === 'gmail') {
    refreshResult = await refreshGmailToken(refreshToken)
  } else if (mailbox.provider === 'outlook') {
    refreshResult = await refreshOutlookToken(refreshToken)
  } else {
    throw new AuthenticationError(
      `Unknown OAuth provider: ${mailbox.provider}`,
      mailbox.provider
    )
  }

  // Check if refresh succeeded
  if (!refreshResult.success || !refreshResult.accessToken) {
    throw new TokenRefreshError(
      refreshResult.error || 'Failed to refresh OAuth token',
      mailbox.provider
    )
  }

  // Get OAuth credentials
  const clientIdEnv = mailbox.provider === 'gmail' ? 'GOOGLE_CLIENT_ID' : 'MICROSOFT_CLIENT_ID'
  const clientSecretEnv = mailbox.provider === 'gmail' ? 'GOOGLE_CLIENT_SECRET' : 'MICROSOFT_CLIENT_SECRET'

  const clientId = process.env[clientIdEnv]
  const clientSecret = process.env[clientSecretEnv]

  if (!clientId || !clientSecret) {
    throw new AuthenticationError(
      `OAuth credentials not configured for ${mailbox.provider}`,
      mailbox.provider
    )
  }

  // Calculate expiration
  const expiresIn = refreshResult.expiresIn || 3600
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000)
  const expires = Math.floor(expiresAtDate.getTime() / 1000)

  // Build OAuth2 configuration
  const oauth2Config: OAuth2Config = {
    type: 'OAuth2',
    user: mailbox.email,
    clientId: clientId,
    clientSecret: clientSecret,
    refreshToken: refreshToken,
    accessToken: refreshResult.accessToken,
    expires: expires,
  }

  // Add provider-specific access URL
  if (mailbox.provider === 'outlook') {
    oauth2Config.accessUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  }

  // Calculate expiration date (ISO string)
  const expiresAt = expiresAtDate.toISOString()

  return {
    oauth2Config,
    accessToken: refreshResult.accessToken,
    expiresAt,
    expiresIn,
  }
}

/**
 * Check if token needs refresh
 * 
 * @param mailbox - The mailbox
 * @param bufferMinutes - Minutes before expiration to consider token expired (default: 5)
 * @returns true if token needs refresh
 */
export function needsTokenRefresh(mailbox: Mailbox, bufferMinutes: number = 5): boolean {
  const tokenPersistence = createTokenPersistence(mailbox)
  return tokenPersistence.isTokenExpired(bufferMinutes)
}

