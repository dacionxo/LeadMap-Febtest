/**
 * Token Persistence Unit Tests
 * 
 * Tests for token persistence abstraction layer
 */

import { createTokenPersistence, TokenPersistence } from '@/lib/email/token-persistence'
import { Mailbox } from '@/lib/email/types'
import { encryptMailboxTokens, decryptMailboxTokens } from '@/lib/email/encryption'

// Mock encryption functions
jest.mock('@/lib/email/encryption', () => ({
  encryptMailboxTokens: jest.fn((tokens) => ({
    access_token: tokens.access_token ? `encrypted_${tokens.access_token}` : null,
    refresh_token: tokens.refresh_token ? `encrypted_${tokens.refresh_token}` : null,
    smtp_password: tokens.smtp_password ? `encrypted_${tokens.smtp_password}` : null,
  })),
  decryptMailboxTokens: jest.fn((tokens) => ({
    access_token: tokens.access_token?.replace('encrypted_', '') || null,
    refresh_token: tokens.refresh_token?.replace('encrypted_', '') || null,
    smtp_password: tokens.smtp_password?.replace('encrypted_', '') || null,
  })),
}))

describe('Token Persistence', () => {
  const createMockMailbox = (overrides: Partial<Mailbox> = {}): Mailbox => ({
    id: 'test-mailbox-id',
    user_id: 'test-user-id',
    email: 'test@example.com',
    provider: 'gmail',
    active: true,
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    daily_limit: 0,
    hourly_limit: 0,
    ...overrides,
  })

  describe('createTokenPersistence', () => {
    it('should create a TokenPersistence instance', () => {
      const mailbox = createMockMailbox()
      const persistence = createTokenPersistence(mailbox)

      expect(persistence).toBeInstanceOf(TokenPersistence)
    })

    it('should not mutate the original mailbox', () => {
      const mailbox = createMockMailbox({
        access_token: 'original_token',
      })
      const persistence = createTokenPersistence(mailbox)

      persistence.setTokens({
        access_token: 'new_token',
        refresh_token: 'new_refresh_token',
        token_expires_at: new Date().toISOString(),
      })

      expect(mailbox.access_token).toBe('original_token')
    })
  })

  describe('getAccessToken', () => {
    it('should return decrypted access token', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_access_token',
      })
      const persistence = createTokenPersistence(mailbox)

      const token = persistence.getAccessToken()

      expect(token).toBe('access_token')
      expect(decryptMailboxTokens).toHaveBeenCalled()
    })

    it('should return null if no access token', () => {
      const mailbox = createMockMailbox({
        access_token: null,
      })
      const persistence = createTokenPersistence(mailbox)

      const token = persistence.getAccessToken()

      expect(token).toBeNull()
    })
  })

  describe('getRefreshToken', () => {
    it('should return decrypted refresh token', () => {
      const mailbox = createMockMailbox({
        refresh_token: 'encrypted_refresh_token',
      })
      const persistence = createTokenPersistence(mailbox)

      const token = persistence.getRefreshToken()

      expect(token).toBe('refresh_token')
    })

    it('should return null if no refresh token', () => {
      const mailbox = createMockMailbox({
        refresh_token: null,
      })
      const persistence = createTokenPersistence(mailbox)

      const token = persistence.getRefreshToken()

      expect(token).toBeNull()
    })
  })

  describe('getTokenExpiresAt', () => {
    it('should return token expiration timestamp', () => {
      const expiresAt = new Date().toISOString()
      const mailbox = createMockMailbox({
        token_expires_at: expiresAt,
      })
      const persistence = createTokenPersistence(mailbox)

      const expiration = persistence.getTokenExpiresAt()

      expect(expiration).toBe(expiresAt)
    })

    it('should return null if no expiration set', () => {
      const mailbox = createMockMailbox({
        token_expires_at: null,
      })
      const persistence = createTokenPersistence(mailbox)

      const expiration = persistence.getTokenExpiresAt()

      expect(expiration).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return true if both access and refresh tokens exist', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_access_token',
        refresh_token: 'encrypted_refresh_token',
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isAuthenticated()).toBe(true)
    })

    it('should return false if access token is missing', () => {
      const mailbox = createMockMailbox({
        access_token: null,
        refresh_token: 'encrypted_refresh_token',
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isAuthenticated()).toBe(false)
    })

    it('should return false if refresh token is missing', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_access_token',
        refresh_token: null,
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isAuthenticated()).toBe(false)
    })

    it('should return false if both tokens are missing', () => {
      const mailbox = createMockMailbox({
        access_token: null,
        refresh_token: null,
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isAuthenticated()).toBe(false)
    })
  })

  describe('isTokenExpired', () => {
    it('should return false if token is not expired', () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
      const mailbox = createMockMailbox({
        token_expires_at: expiresAt,
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isTokenExpired(5)).toBe(false)
    })

    it('should return true if token is expired', () => {
      const expiresAt = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      const mailbox = createMockMailbox({
        token_expires_at: expiresAt,
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isTokenExpired(5)).toBe(true)
    })

    it('should return true if token expires within buffer time', () => {
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3 minutes from now
      const mailbox = createMockMailbox({
        token_expires_at: expiresAt,
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isTokenExpired(5)).toBe(true) // Buffer is 5 minutes
    })

    it('should return false if no expiration is set', () => {
      const mailbox = createMockMailbox({
        token_expires_at: null,
      })
      const persistence = createTokenPersistence(mailbox)

      expect(persistence.isTokenExpired(5)).toBe(false)
    })
  })

  describe('setTokens', () => {
    it('should encrypt tokens before storing', () => {
      const mailbox = createMockMailbox()
      const persistence = createTokenPersistence(mailbox)

      const encrypted = persistence.setTokens({
        access_token: 'plain_access_token',
        refresh_token: 'plain_refresh_token',
        token_expires_at: new Date().toISOString(),
      })

      expect(encryptMailboxTokens).toHaveBeenCalledWith({
        access_token: 'plain_access_token',
        refresh_token: 'plain_refresh_token',
        smtp_password: null,
      })

      expect(encrypted.access_token).toBe('encrypted_plain_access_token')
      expect(encrypted.refresh_token).toBe('encrypted_plain_refresh_token')
    })

    it('should update token expiration', () => {
      const mailbox = createMockMailbox()
      const persistence = createTokenPersistence(mailbox)
      const expiresAt = new Date().toISOString()

      const encrypted = persistence.setTokens({
        access_token: 'token',
        refresh_token: 'refresh',
        token_expires_at: expiresAt,
      })

      expect(encrypted.token_expires_at).toBe(expiresAt)
    })

    it('should clear decrypted cache after setting tokens', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_old_token',
      })
      const persistence = createTokenPersistence(mailbox)

      // Access token to populate cache
      persistence.getAccessToken()

      // Set new tokens
      persistence.setTokens({
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        token_expires_at: new Date().toISOString(),
      })

      // Cache should be cleared, so decrypt should be called again
      persistence.getAccessToken()

      expect(decryptMailboxTokens).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearTokens', () => {
    it('should clear all tokens', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_access_token',
        refresh_token: 'encrypted_refresh_token',
        token_expires_at: new Date().toISOString(),
      })
      const persistence = createTokenPersistence(mailbox)

      persistence.clearTokens()

      const updatedMailbox = persistence.getMailbox()
      expect(updatedMailbox.access_token).toBeNull()
      expect(updatedMailbox.refresh_token).toBeNull()
      expect(updatedMailbox.token_expires_at).toBeNull()
    })

    it('should clear decrypted cache', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_token',
      })
      const persistence = createTokenPersistence(mailbox)

      // Access token to populate cache
      persistence.getAccessToken()

      // Clear tokens
      persistence.clearTokens()

      // Access token again - should not use cache
      persistence.getAccessToken()

      // Should have been called twice (once before clear, once after)
      expect(decryptMailboxTokens).toHaveBeenCalledTimes(2)
    })
  })

  describe('getMailbox', () => {
    it('should return a copy of the mailbox', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_token',
      })
      const persistence = createTokenPersistence(mailbox)

      const returnedMailbox = persistence.getMailbox()

      expect(returnedMailbox).not.toBe(mailbox)
      expect(returnedMailbox).toEqual(expect.objectContaining({
        id: mailbox.id,
        email: mailbox.email,
        access_token: 'encrypted_token',
      }))
    })

    it('should not allow mutation of original mailbox', () => {
      const mailbox = createMockMailbox()
      const persistence = createTokenPersistence(mailbox)

      const returnedMailbox = persistence.getMailbox()
      returnedMailbox.access_token = 'mutated'

      expect(mailbox.access_token).toBeNull()
    })
  })

  describe('getDecryptedMailbox', () => {
    it('should return mailbox with decrypted tokens', () => {
      const mailbox = createMockMailbox({
        access_token: 'encrypted_access_token',
        refresh_token: 'encrypted_refresh_token',
      })
      const persistence = createTokenPersistence(mailbox)

      const decrypted = persistence.getDecryptedMailbox()

      expect(decrypted.access_token).toBe('access_token')
      expect(decrypted.refresh_token).toBe('refresh_token')
    })

    it('should preserve other mailbox properties', () => {
      const mailbox = createMockMailbox({
        id: 'test-id',
        email: 'test@example.com',
        provider: 'outlook',
      })
      const persistence = createTokenPersistence(mailbox)

      const decrypted = persistence.getDecryptedMailbox()

      expect(decrypted.id).toBe('test-id')
      expect(decrypted.email).toBe('test@example.com')
      expect(decrypted.provider).toBe('outlook')
    })
  })
})

