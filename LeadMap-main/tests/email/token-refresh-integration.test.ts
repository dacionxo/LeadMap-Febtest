/**
 * Token Refresh Integration Tests
 * 
 * Integration tests for token refresh scenarios
 */

import { refreshToken } from '@/lib/email/token-refresh'
import { createTokenPersistence } from '@/lib/email/token-persistence'
import { Mailbox } from '@/lib/email/types'

// Mock fetch
global.fetch = jest.fn()

describe('Token Refresh Integration', () => {
  const createMockMailbox = (overrides: Partial<Mailbox> = {}): Mailbox => ({
    id: 'test-mailbox-id',
    user_id: 'test-user-id',
    email: 'test@example.com',
    provider: 'gmail',
    active: true,
    access_token: 'encrypted_access_token',
    refresh_token: 'encrypted_refresh_token',
    token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
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

  describe('Token Refresh Scenarios', () => {
    it('should refresh token before expiration (proactive refresh)', async () => {
      const mailbox = createMockMailbox({
        token_expires_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(), // 4 minutes
      })
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
          access_token: 'new_token',
          expires_in: 3600,
        }),
      })

      const persistence = createTokenPersistence(mailbox)
      
      // Check if token needs refresh (5 minute buffer)
      if (persistence.isTokenExpired(5)) {
        const result = await refreshToken(mailbox, {
          supabase: mockSupabase,
          persistToDatabase: true,
          autoRetry: false,
        })

        expect(result.success).toBe(true)
        expect(result.accessToken).toBe('new_token')
      }
    })

    it('should handle token refresh with retry on transient failure', async () => {
      const mailbox = createMockMailbox()
      const mockFetch = global.fetch as jest.Mock

      // First attempt fails with 500 (transient)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'server_error' }),
      })

      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_token',
          expires_in: 3600,
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: true,
        maxRetries: 3,
        persistToDatabase: false,
      })

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on permanent failure (invalid_grant)', async () => {
      const mailbox = createMockMailbox()
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
        autoRetry: true,
        maxRetries: 3,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('invalid_grant')
      expect(result.shouldRetry).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retries
    })

    it('should persist refreshed token to database', async () => {
      const mailbox = createMockMailbox()
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
          access_token: 'new_token',
          expires_in: 3600,
        }),
      })

      const result = await refreshToken(mailbox, {
        supabase: mockSupabase,
        persistToDatabase: true,
        autoRetry: false,
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('mailboxes')
    })

    it('should handle multiple mailboxes refresh', async () => {
      const mailboxes = [
        createMockMailbox({ id: 'mailbox-1', email: 'user1@gmail.com' }),
        createMockMailbox({ id: 'mailbox-2', email: 'user2@gmail.com' }),
        createMockMailbox({ id: 'mailbox-3', email: 'user3@gmail.com' }),
      ]
      const mockFetch = global.fetch as jest.Mock

      // All succeed
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new_token',
          expires_in: 3600,
        }),
      })

      const results = await Promise.all(
        mailboxes.map(mailbox =>
          refreshToken(mailbox, {
            autoRetry: false,
            persistToDatabase: false,
          })
        )
      )

      expect(results.every(r => r.success)).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('Token Expiration Scenarios', () => {
    it('should detect expired token', () => {
      const mailbox = createMockMailbox({
        token_expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      })

      const persistence = createTokenPersistence(mailbox)
      expect(persistence.isTokenExpired(5)).toBe(true)
    })

    it('should detect token expiring soon', () => {
      const mailbox = createMockMailbox({
        token_expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes
      })

      const persistence = createTokenPersistence(mailbox)
      expect(persistence.isTokenExpired(5)).toBe(true) // Buffer is 5 minutes
    })

    it('should detect valid token', () => {
      const mailbox = createMockMailbox({
        token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })

      const persistence = createTokenPersistence(mailbox)
      expect(persistence.isTokenExpired(5)).toBe(false)
    })
  })
})


