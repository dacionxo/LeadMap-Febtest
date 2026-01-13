/**
 * Token Persistence Abstraction
 * 
 * Provides a unified interface for managing OAuth tokens (access_token, refresh_token, expires_at)
 * Inspired by Mautic's TokenPersistenceInterface pattern, adapted for Node.js/TypeScript.
 * 
 * This abstraction:
 * - Handles encryption/decryption of tokens automatically
 * - Provides a consistent interface for token operations
 * - Makes it easy to check authentication status
 * - Simplifies token refresh and update operations
 * 
 * @see https://github.com/mautic/mautic for the original PHP implementation pattern
 */

import { Mailbox } from './types'
import { encryptMailboxTokens, decryptMailboxTokens } from './encryption'

/**
 * Token data structure for persistence operations
 */
export interface TokenData {
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
}

/**
 * Token Persistence Interface
 * Defines the contract for token persistence operations
 */
export interface TokenPersistenceInterface {
  /**
   * Get the decrypted access token
   */
  getAccessToken(): string | null

  /**
   * Get the decrypted refresh token
   */
  getRefreshToken(): string | null

  /**
   * Get the token expiration timestamp
   */
  getTokenExpiresAt(): string | null

  /**
   * Check if the mailbox is authenticated (has valid tokens)
   */
  isAuthenticated(): boolean

  /**
   * Set new tokens (will be encrypted before storing)
   */
  setTokens(tokens: TokenData): TokenData

  /**
   * Clear all tokens
   */
  clearTokens(): void

  /**
   * Get the original mailbox data
   */
  getMailbox(): Mailbox

  /**
   * Get decrypted mailbox with all tokens decrypted
   */
  getDecryptedMailbox(): Mailbox
}

/**
 * Token Persistence Implementation
 * 
 * Manages OAuth tokens for a mailbox with automatic encryption/decryption.
 * Provides a clean interface for token operations without exposing encryption details.
 */
export class TokenPersistence implements TokenPersistenceInterface {
  private mailbox: Mailbox
  private _decryptedCache: {
    access_token?: string | null
    refresh_token?: string | null
    smtp_password?: string | null
  } | null = null

  constructor(mailbox: Mailbox) {
    this.mailbox = { ...mailbox } // Create a copy to avoid mutating original
  }

  /**
   * Get the decrypted access token
   */
  getAccessToken(): string | null {
    const decrypted = this.getDecryptedTokens()
    return decrypted.access_token || null
  }

  /**
   * Get the decrypted refresh token
   */
  getRefreshToken(): string | null {
    const decrypted = this.getDecryptedTokens()
    return decrypted.refresh_token || null
  }

  /**
   * Get the token expiration timestamp
   */
  getTokenExpiresAt(): string | null {
    return this.mailbox.token_expires_at || null
  }

  /**
   * Check if the mailbox is authenticated
   * 
   * Returns true if:
   * - Has an access token (decrypted)
   * - Has a refresh token (decrypted)
   */
  isAuthenticated(): boolean {
    const accessToken = this.getAccessToken()
    const refreshToken = this.getRefreshToken()
    return !!(accessToken && refreshToken)
  }

  /**
   * Set new tokens (encrypts before storing in mailbox)
   * 
   * @param tokens - Token data to set
   * @returns Encrypted token data (ready for database storage)
   */
  setTokens(tokens: TokenData): TokenData {
    // Encrypt the tokens
    const encrypted = encryptMailboxTokens({
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      smtp_password: null // SMTP password is handled separately
    })

    // Update mailbox with encrypted tokens (convert null to undefined for type compatibility)
    this.mailbox.access_token = encrypted.access_token || tokens.access_token || undefined
    this.mailbox.refresh_token = encrypted.refresh_token || tokens.refresh_token || undefined
    
    if (tokens.token_expires_at !== undefined && tokens.token_expires_at !== null) {
      this.mailbox.token_expires_at = tokens.token_expires_at
    } else {
      this.mailbox.token_expires_at = undefined
    }

    // Clear decrypted cache to force re-decryption
    this._decryptedCache = null

    // Return encrypted tokens (for database storage)
    return {
      access_token: this.mailbox.access_token,
      refresh_token: this.mailbox.refresh_token,
      token_expires_at: this.mailbox.token_expires_at || null
    }
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.mailbox.access_token = undefined
    this.mailbox.refresh_token = undefined
    this.mailbox.token_expires_at = undefined
    this._decryptedCache = null
  }

  /**
   * Get the original mailbox data
   */
  getMailbox(): Mailbox {
    return { ...this.mailbox } // Return a copy to prevent mutation
  }

  /**
   * Get decrypted mailbox with all tokens decrypted
   * This is useful for providers that need decrypted tokens
   */
  getDecryptedMailbox(): Mailbox {
    const decrypted = this.getDecryptedTokens()
    
    return {
      ...this.mailbox,
      access_token: decrypted.access_token || this.mailbox.access_token,
      refresh_token: decrypted.refresh_token || this.mailbox.refresh_token,
      smtp_password: decrypted.smtp_password || this.mailbox.smtp_password
    }
  }

  /**
   * Check if access token is expired or about to expire
   * 
   * @param bufferMinutes - Minutes before expiration to consider token expired (default: 5)
   * @returns true if token is expired or will expire within bufferMinutes
   */
  isTokenExpired(bufferMinutes: number = 5): boolean {
    if (!this.mailbox.token_expires_at) {
      return false // No expiration set, assume not expired
    }

    const expiresAt = new Date(this.mailbox.token_expires_at)
    const now = new Date()
    const bufferTime = new Date(now.getTime() + bufferMinutes * 60 * 1000)

    return expiresAt < bufferTime
  }

  /**
   * Get decrypted tokens (with caching to avoid repeated decryption)
   */
  private getDecryptedTokens(): {
    access_token?: string | null
    refresh_token?: string | null
    smtp_password?: string | null
  } {
    // Return cached decrypted tokens if available
    if (this._decryptedCache !== null) {
      return this._decryptedCache
    }

    // Decrypt tokens
    const decrypted = decryptMailboxTokens({
      access_token: this.mailbox.access_token,
      refresh_token: this.mailbox.refresh_token,
      smtp_password: this.mailbox.smtp_password
    })

    // Cache the decrypted tokens
    this._decryptedCache = decrypted

    return decrypted
  }
}

/**
 * Create a TokenPersistence instance from a mailbox
 * 
 * Factory function that creates a TokenPersistence instance.
 * This is the recommended way to create token persistence instances.
 * 
 * @param mailbox - The mailbox to create persistence for
 * @returns TokenPersistence instance
 * 
 * @example
 * ```typescript
 * const persistence = createTokenPersistence(mailbox)
 * 
 * if (persistence.isAuthenticated()) {
 *   const accessToken = persistence.getAccessToken()
 *   // Use access token...
 * }
 * 
 * // Update tokens
 * const encrypted = persistence.setTokens({
 *   access_token: 'new_access_token',
 *   refresh_token: 'new_refresh_token',
 *   token_expires_at: new Date().toISOString()
 * })
 * 
 * // Save encrypted tokens to database
 * await supabase.from('mailboxes').update(encrypted).eq('id', mailbox.id)
 * ```
 */
export function createTokenPersistence(mailbox: Mailbox): TokenPersistence {
  return new TokenPersistence(mailbox)
}

