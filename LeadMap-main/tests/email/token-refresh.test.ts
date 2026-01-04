/**
 * Token Refresh Unit Tests
 * 
 * Tests for unified token refresh functionality
 */

import { refreshToken, TokenRefreshResult } from '@/lib/email/token-refresh'
import { Mailbox } from '@/lib/email/types'
import { createTokenPersistence } from '@/lib/email/token-persistence'

// Mock fetch
global.fetch = jest.fn()

// Mock token persistence
jest.mock('@/lib/email/token-persistence', () => ({
  createTokenPersistence: jest.fn((mailbox) => ({
    getRefreshToken: jest.fn(() => mailbox.refresh_token?.replace('encrypted_', '') || null),
    getAccessToken: jest.fn(() => mailbox.access_token?.replace('encrypted_', '') || null),
    setTokens: jest.fn((tokens) => ({
      access_token: tokens.access_token ? `encrypted_${tokens.access_token}` : null,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokens.token_expires_at || null,
    })),
  })),
}))

describe('Token Refresh', () => {
  const createMockMailbox = (overrides: Partial<Mailbox> = {}): Mailbox => ({
    id: 'test-mailbox-id',
    user_id: 'test-user-id',
    email: 'test@example.com',
    provider: 'gmail',
    active: true,
    access_token: 'encrypted_access_token',
    refresh_token: 'encrypted_refresh_token',
    token_expires_at: new Date().toISOString(),
    daily_limit: 0,
    hourly_limit: 0,
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id'
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret'
  })

  describe('Gmail Token Refresh', () => {
    it('should successfully refresh Gmail token', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          expires_in: 3600,
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(true)
      expect(result.accessToken).toBe('new_access_token')
      expect(result.expiresIn).toBe(3600)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )
    })

    it('should handle Gmail refresh token missing', async () => {
      const mailbox = createMockMailbox({
        provider: 'gmail',
        refresh_token: null,
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing Gmail refresh token')
      expect(result.errorCode).toBe('MISSING_REFRESH_TOKEN')
      expect(result.shouldRetry).toBe(false)
    })

    it('should handle Gmail OAuth not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      const mailbox = createMockMailbox({ provider: 'gmail' })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Gmail OAuth client not configured')
      expect(result.errorCode).toBe('OAUTH_NOT_CONFIGURED')
    })

    it('should handle Gmail API errors', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been revoked',
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Token has been revoked')
      expect(result.errorCode).toBe('invalid_grant')
      expect(result.shouldRetry).toBe(false)
    })

    it('should retry on transient errors', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock

      // First call fails with 500 (transient)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'server_error' }),
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          expires_in: 3600,
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: true,
        maxRetries: 3,
        persistToDatabase: false,
      })

      expect(result.success).toBe(true)
      expect(result.accessToken).toBe('new_access_token')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Outlook Token Refresh', () => {
    it('should successfully refresh Outlook token', async () => {
      const mailbox = createMockMailbox({ provider: 'outlook' })
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          expires_in: 3600,
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(true)
      expect(result.accessToken).toBe('new_access_token')
      expect(result.expiresIn).toBe(3600)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('login.microsoftonline.com'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should handle Outlook refresh token missing', async () => {
      const mailbox = createMockMailbox({
        provider: 'outlook',
        refresh_token: null,
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing Outlook refresh token')
      expect(result.errorCode).toBe('MISSING_REFRESH_TOKEN')
    })

    it('should use tenant ID from environment', async () => {
      process.env.MICROSOFT_TENANT_ID = 'custom-tenant-id'
      const mailbox = createMockMailbox({ provider: 'outlook' })
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          expires_in: 3600,
        }),
      })

      await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('custom-tenant-id'),
        expect.any(Object)
      )
    })
  })

  describe('Unsupported Providers', () => {
    it('should return error for unsupported provider', async () => {
      const mailbox = createMockMailbox({ provider: 'smtp' })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Token refresh not supported')
      expect(result.errorCode).toBe('UNSUPPORTED_PROVIDER')
      expect(result.shouldRetry).toBe(false)
    })
  })

  describe('Database Persistence', () => {
    it('should persist tokens to database when requested', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock
      const mockSupabase = {
        from: jest.fn(() => ({
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          expires_in: 3600,
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: true,
        supabase: mockSupabase,
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('mailboxes')
    })

    it('should not persist when persistToDatabase is false', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock
      const mockSupabase = {
        from: jest.fn(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          expires_in: 3600,
        }),
      })

      await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
        supabase: mockSupabase,
      })

      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
      expect(result.errorCode).toBe('NETWORK_ERROR')
      expect(result.shouldRetry).toBe(true)
    })

    it('should handle missing access_token in response', async () => {
      const mailbox = createMockMailbox({ provider: 'gmail' })
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          expires_in: 3600,
          // Missing access_token
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('access_token')
      expect(result.errorCode).toBe('INVALID_RESPONSE')
    })
  })
})


