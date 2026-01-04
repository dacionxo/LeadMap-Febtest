/**
 * OAuth Authentication Interface
 * 
 * Standardized authentication patterns for OAuth providers (Gmail, Outlook)
 * Inspired by Mautic's AuthenticationInterface pattern, adapted for Node.js/TypeScript.
 * 
 * This interface provides:
 * - Consistent authentication checking across providers
 * - Unified OAuth flow handling
 * - Better testability and maintainability
 * 
 * @see https://github.com/mautic/mautic for the original PHP implementation pattern
 */

import type { Mailbox } from '../types'

/**
 * Result of an OAuth token exchange
 */
export interface TokenResult {
  access_token: string
  refresh_token: string
  expires_in: number
  email: string
  display_name?: string
}

/**
 * OAuth Provider Interface
 * Defines the contract for OAuth provider implementations
 */
export interface OAuthProvider {
  /**
   * Check if a mailbox is authenticated (has valid tokens)
   * 
   * @param mailbox - The mailbox to check
   * @returns true if the mailbox is authenticated
   */
  isAuthenticated(mailbox: Mailbox): boolean

  /**
   * Authenticate an integration by exchanging an OAuth code for tokens
   * 
   * @param code - The OAuth authorization code
   * @param state - The OAuth state parameter (should contain userId)
   * @param redirectUri - The redirect URI used in the OAuth flow
   * @returns Token result with access token, refresh token, expiration, and user info
   * @throws AuthenticationError if authentication fails
   */
  authenticateIntegration(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<TokenResult>
}

/**
 * Helper function to check if a mailbox is authenticated
 * Uses token persistence to check for valid tokens
 * 
 * @param mailbox - The mailbox to check
 * @returns true if the mailbox has valid authentication tokens
 */
export function isAuthenticated(mailbox: Mailbox): boolean {
  if (!mailbox.access_token && !mailbox.refresh_token) {
    return false
  }

  // If we have a refresh token, we can always get a new access token
  if (mailbox.refresh_token) {
    return true
  }

  // If we only have an access token, check if it's expired
  if (mailbox.access_token && mailbox.token_expires_at) {
    const expiresAt = new Date(mailbox.token_expires_at)
    const now = new Date()
    // Consider token valid if it expires more than 1 minute from now
    return expiresAt > new Date(now.getTime() + 60 * 1000)
  }

  // If we have an access token but no expiration, assume it's valid
  // (some providers don't provide expiration for access tokens)
  return !!mailbox.access_token
}

