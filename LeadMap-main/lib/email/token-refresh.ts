/**
 * Unified Token Refresh Strategy
 * 
 * Provides a unified interface for refreshing OAuth tokens across all providers (Gmail, Outlook).
 * Inspired by Mautic's token refresh patterns, adapted for Node.js/TypeScript.
 * 
 * This module:
 * - Consolidates token refresh logic for all OAuth providers
 * - Integrates with token persistence for automatic token management
 * - Provides automatic retry with exponential backoff
 * - Handles errors consistently across providers
 * - Optionally persists refreshed tokens to the database
 * 
 * @see https://github.com/mautic/mautic for the original PHP implementation pattern
 */

import { Mailbox, EmailProvider } from './types'
import { createTokenPersistence, TokenPersistence } from './token-persistence'

/**
 * Result of a token refresh operation
 */
export interface TokenRefreshResult {
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
  errorCode?: string
  shouldRetry?: boolean
}

/**
 * Options for token refresh operations
 */
export interface TokenRefreshOptions {
  /**
   * Whether to automatically retry on transient failures
   * @default true
   */
  autoRetry?: boolean

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelay?: number

  /**
   * Maximum delay in milliseconds between retries
   * @default 10000
   */
  maxDelay?: number

  /**
   * Supabase client for persisting tokens to database
   * If provided, refreshed tokens will be saved automatically
   */
  supabase?: any

  /**
   * Whether to persist tokens to database after refresh
   * @default true (if supabase is provided)
   */
  persistToDatabase?: boolean
}

/**
 * Refresh Gmail OAuth token
 * 
 * @param mailbox - Mailbox with Gmail provider
 * @param options - Refresh options
 * @returns Token refresh result
 */
async function refreshGmailTokenInternal(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence
): Promise<TokenRefreshResult> {
  const refreshToken = tokenPersistence.getRefreshToken()
  const encryptedRefreshToken = mailbox.refresh_token || ''
  
  if (!refreshToken) {
    console.error('Gmail token refresh: Missing refresh token after decryption', {
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email,
      hasEncryptedToken: !!mailbox.refresh_token,
      encryptedTokenLength: mailbox.refresh_token?.length || 0,
      hasEncryptionKey: !!process.env.EMAIL_ENCRYPTION_KEY || !!process.env.ENCRYPTION_KEY
    })
    return {
      success: false,
      error: 'Missing Gmail refresh token (may be encrypted incorrectly or missing from database)',
      errorCode: 'MISSING_REFRESH_TOKEN',
      shouldRetry: false
    }
  }

  // CRITICAL VALIDATION: Check if refresh token is still encrypted
  // Encrypted tokens are typically 200+ hex characters
  // Decrypted Google refresh tokens are typically 50-200 characters and contain non-hex characters
  const isHexOnly = /^[0-9a-f]+$/i.test(refreshToken)
  const looksEncrypted = refreshToken.length > 200 && isHexOnly && refreshToken.length === encryptedRefreshToken.length
  
  if (looksEncrypted) {
    console.error('Gmail token refresh: CRITICAL - Refresh token appears to still be encrypted!', {
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email,
      tokenLength: refreshToken.length,
      encryptedLength: encryptedRefreshToken.length,
      isHexOnly,
      tokenPreview: refreshToken.substring(0, 50) + '...',
      hasEncryptionKey: !!process.env.EMAIL_ENCRYPTION_KEY || !!process.env.ENCRYPTION_KEY,
      encryptionKeySet: !!(process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY)
    })
    return {
      success: false,
      error: 'Gmail refresh token is still encrypted - decryption failed. Check EMAIL_ENCRYPTION_KEY environment variable.',
      errorCode: 'TOKEN_STILL_ENCRYPTED',
      shouldRetry: false
    }
  }

  // Validate refresh token format (should be a plain string, not encrypted)
  // A valid Google refresh token is usually 50-200 characters
  if (refreshToken.length < 20) {
    console.error('Gmail token refresh: Refresh token appears to be invalid (too short)', {
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email,
      tokenLength: refreshToken.length,
      tokenPreview: refreshToken.substring(0, 10) + '...'
    })
    return {
      success: false,
      error: 'Gmail refresh token appears to be invalid (too short - may be encrypted incorrectly)',
      errorCode: 'INVALID_REFRESH_TOKEN_FORMAT',
      shouldRetry: false
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('Gmail token refresh: OAuth credentials missing', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      mailbox_id: mailbox.id
    })
    return {
      success: false,
      error: 'Gmail OAuth client not configured (GOOGLE_CLIENT_ID/SECRET missing)',
      errorCode: 'OAUTH_NOT_CONFIGURED',
      shouldRetry: false
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
      const errorCode = data.error || 'UNKNOWN_ERROR'
      const errorDescription = data.error_description || data.error || `Failed to refresh Gmail token (${resp.status})`
      
      // invalid_grant means refresh token is invalid/expired/revoked - user needs to re-authenticate
      const isInvalidGrant = errorCode === 'invalid_grant'
      
      // Determine if error is retryable (don't retry invalid_grant)
      const shouldRetry = !isInvalidGrant && (resp.status === 429 || resp.status >= 500 || resp.status === 408)
      
      console.error('Gmail token refresh failed:', {
        status: resp.status,
        error: errorCode,
        error_description: errorDescription,
        mailbox_id: mailbox.id,
        mailbox_email: mailbox.email,
        shouldRetry,
        needsReAuth: isInvalidGrant,
        hasRefreshToken: !!tokenPersistence.getRefreshToken(),
        refreshTokenLength: tokenPersistence.getRefreshToken()?.length || 0
      })
      
      // Log additional details for 400 errors (bad request)
      if (resp.status === 400) {
        console.error('Gmail token refresh 400 error details:', {
          errorCode,
          errorDescription,
          possibleCauses: [
            'Refresh token may be invalid/expired/revoked',
            'OAuth client credentials (GOOGLE_CLIENT_ID/SECRET) may be incorrect',
            'Refresh token may be encrypted and not decrypted properly',
            'Token may have been revoked by user'
          ],
          mailbox_id: mailbox.id,
          mailbox_email: mailbox.email
        })
      }

      return {
        success: false,
        error: errorDescription,
        errorCode,
        shouldRetry
      }
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
        error: 'Gmail token refresh response did not include access_token',
        errorCode: 'INVALID_RESPONSE',
        shouldRetry: false
      }
    }

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
      error: error.message || 'Failed to refresh Gmail token',
      errorCode: 'NETWORK_ERROR',
      shouldRetry: true
    }
  }
}

/**
 * Refresh Outlook/Microsoft OAuth token
 * 
 * @param mailbox - Mailbox with Outlook provider
 * @param tokenPersistence - Token persistence instance
 * @returns Token refresh result
 */
async function refreshOutlookTokenInternal(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence
): Promise<TokenRefreshResult> {
  const refreshToken = tokenPersistence.getRefreshToken()
  
  if (!refreshToken) {
    return {
      success: false,
      error: 'Missing Outlook refresh token',
      errorCode: 'MISSING_REFRESH_TOKEN',
      shouldRetry: false
    }
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Microsoft OAuth credentials not configured',
      errorCode: 'OAUTH_NOT_CONFIGURED',
      shouldRetry: false
    }
  }

  try {
    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Send offline_access'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorCode = errorData.error || 'UNKNOWN_ERROR'
      const errorDescription = errorData.error_description || 'Failed to refresh Outlook token'
      
      // invalid_grant means refresh token is invalid/expired/revoked - user needs to re-authenticate
      const isInvalidGrant = errorCode === 'invalid_grant'
      
      // Determine if error is retryable (don't retry invalid_grant)
      const shouldRetry = !isInvalidGrant && (response.status === 429 || response.status >= 500 || response.status === 408)
      
      console.error('Outlook token refresh failed:', {
        status: response.status,
        error: errorCode,
        error_description: errorDescription,
        mailbox_id: mailbox.id,
        mailbox_email: mailbox.email,
        shouldRetry,
        needsReAuth: isInvalidGrant
      })
      
      return {
        success: false,
        error: errorDescription,
        errorCode,
        shouldRetry
      }
    }

    const data = await response.json()
    const newAccessToken = data.access_token as string | undefined
    const expiresIn = data.expires_in as number | undefined

    if (!newAccessToken) {
      return {
        success: false,
        error: 'Outlook token refresh response did not include access_token',
        errorCode: 'INVALID_RESPONSE',
        shouldRetry: false
      }
    }

    return {
      success: true,
      accessToken: newAccessToken,
      expiresIn: expiresIn || 3600 // Default to 1 hour if not provided
    }
  } catch (error: any) {
    console.error('Outlook token refresh exception:', {
      error: error.message,
      stack: error.stack,
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email
    })
    return {
      success: false,
      error: error.message || 'Failed to refresh Outlook token',
      errorCode: 'NETWORK_ERROR',
      shouldRetry: true
    }
  }
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number
    initialDelay: number
    maxDelay: number
  }
): Promise<T> {
  let lastError: any
  const { maxRetries, initialDelay, maxDelay } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      )

      // Add jitter to avoid thundering herd
      const jitteredDelay = delay + Math.random() * 1000

      console.log(`Token refresh retry (attempt ${attempt + 1}/${maxRetries}) after ${jitteredDelay}ms`, {
        error: error.message
      })

      await new Promise(resolve => setTimeout(resolve, jitteredDelay))
    }
  }

  throw lastError
}

/**
 * Persist refreshed tokens to database
 */
async function persistTokensToDatabase(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence,
  accessToken: string,
  expiresIn: number,
  supabase: any
): Promise<void> {
  if (!supabase || !mailbox.id) {
    return
  }

  try {
    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Update tokens in persistence
    const encryptedTokens = tokenPersistence.setTokens({
      access_token: accessToken,
      refresh_token: null, // Keep existing refresh token (don't update)
      token_expires_at: expiresAt
    })

    // Save to database
    await supabase
      .from('mailboxes')
      .update({
        access_token: encryptedTokens.access_token,
        token_expires_at: encryptedTokens.token_expires_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', mailbox.id)

    console.log('Saved refreshed token to database', {
      mailbox_id: mailbox.id,
      provider: mailbox.provider
    })
  } catch (error: any) {
    console.error('Failed to persist refreshed token to database:', {
      error: error.message,
      mailbox_id: mailbox.id,
      provider: mailbox.provider
    })
    // Don't throw - token refresh was successful, persistence failure is non-critical
  }
}

/**
 * Unified token refresh function for all OAuth providers
 * 
 * This is the main entry point for refreshing tokens. It:
 * - Works for both Gmail and Outlook providers
 * - Integrates with token persistence
 * - Provides automatic retry with exponential backoff
 * - Optionally persists tokens to database
 * 
 * @param mailbox - Mailbox to refresh token for
 * @param options - Refresh options
 * @returns Token refresh result
 * 
 * @example
 * ```typescript
 * const result = await refreshToken(mailbox, {
 *   supabase: supabaseClient,
 *   persistToDatabase: true
 * })
 * 
 * if (result.success) {
 *   console.log('New access token:', result.accessToken)
 *   console.log('Expires in:', result.expiresIn, 'seconds')
 * } else {
 *   console.error('Refresh failed:', result.error)
 * }
 * ```
 */
export async function refreshToken(
  mailbox: Mailbox,
  options: TokenRefreshOptions = {}
): Promise<TokenRefreshResult> {
  const {
    autoRetry = true,
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    supabase,
    persistToDatabase = !!supabase
  } = options

  // Validate provider
  if (mailbox.provider !== 'gmail' && mailbox.provider !== 'outlook') {
    return {
      success: false,
      error: `Token refresh not supported for provider: ${mailbox.provider}`,
      errorCode: 'UNSUPPORTED_PROVIDER',
      shouldRetry: false
    }
  }

  // Create token persistence instance
  const tokenPersistence = createTokenPersistence(mailbox)

  // Internal refresh function that will be retried if needed
  const refreshFunction = async (): Promise<TokenRefreshResult> => {
    let result: TokenRefreshResult

    // Call provider-specific refresh function
    if (mailbox.provider === 'gmail') {
      result = await refreshGmailTokenInternal(mailbox, tokenPersistence)
    } else {
      result = await refreshOutlookTokenInternal(mailbox, tokenPersistence)
    }

    // If refresh was successful and persistence is requested, save to database
    if (result.success && result.accessToken && persistToDatabase && supabase) {
      await persistTokensToDatabase(
        mailbox,
        tokenPersistence,
        result.accessToken,
        result.expiresIn || 3600,
        supabase
      )
    }

    return result
  }

  // Execute with retry if enabled
  if (autoRetry) {
    try {
      const result = await retryWithBackoff(refreshFunction, {
        maxRetries,
        initialDelay,
        maxDelay
      })

      // Only retry on transient errors (network errors, rate limits, server errors)
      // For permanent errors (invalid_grant, missing tokens), return immediately
      if (!result.success && !result.shouldRetry) {
        return result
      }

      // If retry was needed but still failed, return the last result
      if (!result.success) {
        // This should not happen due to retry logic, but handle it gracefully
        return result
      }

      return result
    } catch (error: any) {
      // This handles cases where retry logic throws (shouldn't happen with current implementation)
      return {
        success: false,
        error: error.message || 'Token refresh failed after retries',
        errorCode: 'RETRY_EXHAUSTED',
        shouldRetry: false
      }
    }
  } else {
    // Execute without retry
    return await refreshFunction()
  }
}

/**
 * Legacy function signatures for backward compatibility
 * These delegate to the unified refreshToken function
 */

/**
 * Refresh Gmail token (backward compatible)
 * 
 * @deprecated Use refreshToken() instead
 */
export async function refreshGmailToken(mailbox: Mailbox): Promise<{
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
}> {
  const result = await refreshToken(mailbox, { autoRetry: false })
  return {
    success: result.success,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    error: result.error
  }
}

/**
 * Refresh Outlook token (backward compatible)
 * 
 * @deprecated Use refreshToken() instead
 */
export async function refreshOutlookToken(mailbox: Mailbox): Promise<{
  success: boolean
  accessToken?: string
  error?: string
}> {
  const result = await refreshToken(mailbox, { autoRetry: false })
  return {
    success: result.success,
    accessToken: result.accessToken,
    error: result.error
  }
}




