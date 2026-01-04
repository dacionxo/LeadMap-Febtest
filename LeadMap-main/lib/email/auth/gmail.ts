/**
 * Gmail OAuth Authentication Implementation
 * 
 * Implements OAuthProvider interface for Gmail OAuth2 authentication
 * Handles OAuth code exchange, token retrieval, and user info fetching
 */

import type { Mailbox } from '../types'
import type { OAuthProvider, TokenResult } from './interface'
import { isAuthenticated as checkAuthenticated } from './interface'
import { AuthenticationError } from '../errors'
import { createTokenPersistence } from '../token-persistence'

/**
 * Gmail OAuth Authentication Provider
 * 
 * Handles Gmail OAuth2 authentication flow:
 * 1. Exchange authorization code for tokens
 * 2. Fetch user information from Google
 * 3. Return token result for storage
 */
export class GmailAuth implements OAuthProvider {
  /**
   * Check if a mailbox is authenticated
   * 
   * @param mailbox - The mailbox to check
   * @returns true if the mailbox is authenticated
   */
  isAuthenticated(mailbox: Mailbox): boolean {
    return checkAuthenticated(mailbox)
  }

  /**
   * Authenticate Gmail integration by exchanging OAuth code for tokens
   * 
   * @param code - The OAuth authorization code
   * @param state - The OAuth state parameter (should contain userId)
   * @param redirectUri - The redirect URI used in the OAuth flow
   * @returns Token result with access token, refresh token, expiration, and user info
   * @throws AuthenticationError if authentication fails
   */
  async authenticateIntegration(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<TokenResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new AuthenticationError(
        'Gmail OAuth client not configured (GOOGLE_CLIENT_ID/SECRET missing)',
        'gmail'
      )
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Gmail token exchange error:', errorText)
        
        let errorMessage = 'Failed to exchange authorization code for tokens'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error_description || errorData.error || errorMessage
        } catch {
          // Use default message if parsing fails
        }

        throw new AuthenticationError(
          errorMessage,
          'gmail',
          { status: tokenResponse.status, response: errorText }
        )
      }

      const tokens = await tokenResponse.json()
      const { access_token, refresh_token, expires_in } = tokens

      if (!access_token) {
        throw new AuthenticationError(
          'Gmail token exchange did not return access_token',
          'gmail',
          { response_keys: Object.keys(tokens) }
        )
      }

      if (!refresh_token) {
        throw new AuthenticationError(
          'Gmail token exchange did not return refresh_token',
          'gmail',
          { response_keys: Object.keys(tokens) }
        )
      }

      // Get user email from Google
      const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      })

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text()
        console.error('Gmail userinfo error:', errorText)
        throw new AuthenticationError(
          'Failed to fetch user information from Google',
          'gmail',
          { status: userInfoResponse.status, response: errorText }
        )
      }

      const userInfo = await userInfoResponse.json()
      const email = userInfo.email

      if (!email) {
        throw new AuthenticationError(
          'Google userinfo did not return email',
          'gmail',
          { userinfo_keys: Object.keys(userInfo) }
        )
      }

      return {
        access_token,
        refresh_token,
        expires_in: expires_in || 3600, // Default to 1 hour if not provided
        email,
        display_name: userInfo.name || email,
      }
    } catch (error) {
      // Re-throw AuthenticationError as-is
      if (error instanceof AuthenticationError) {
        throw error
      }

      // Wrap other errors
      if (error instanceof Error) {
        throw new AuthenticationError(
          `Gmail authentication failed: ${error.message}`,
          'gmail',
          { original_error: error.message }
        )
      }

      throw new AuthenticationError(
        'Gmail authentication failed due to unknown error',
        'gmail',
        { error }
      )
    }
  }
}

/**
 * Create a GmailAuth instance
 * 
 * @returns A new GmailAuth instance
 */
export function createGmailAuth(): GmailAuth {
  return new GmailAuth()
}

