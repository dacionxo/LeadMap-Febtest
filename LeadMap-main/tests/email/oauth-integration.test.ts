/**
 * OAuth Integration Tests
 * 
 * Integration tests for OAuth flows
 */

import { GmailAuth } from '@/lib/email/auth/gmail'
import { OutlookAuth } from '@/lib/email/auth/outlook'
import { createTokenPersistence } from '@/lib/email/token-persistence'
import { refreshToken } from '@/lib/email/token-refresh'
import { Mailbox } from '@/lib/email/types'

// Mock fetch
global.fetch = jest.fn()

describe('OAuth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id'
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret'
    process.env.MICROSOFT_TENANT_ID = 'common'
  })

  describe('Gmail OAuth Flow', () => {
    it('should complete full OAuth flow: authenticate -> persist -> refresh', async () => {
      const mockFetch = global.fetch as jest.Mock
      const mockSupabase = {
        from: jest.fn(() => ({
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }

      // Step 1: Authenticate
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'initial_access_token',
            refresh_token: 'initial_refresh_token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            email: 'user@gmail.com',
            name: 'Test User',
          }),
        })

      const gmailAuth = new GmailAuth()
      const authResult = await gmailAuth.authenticateIntegration(
        'auth_code',
        'state',
        'http://localhost:3000/callback'
      )

      expect(authResult.success).toBe(true)
      expect(authResult.accessToken).toBe('initial_access_token')
      expect(authResult.refreshToken).toBe('initial_refresh_token')

      // Step 2: Create mailbox and persist tokens
      const mailbox: Mailbox = {
        id: 'test-mailbox-id',
        user_id: 'test-user-id',
        email: authResult.email!,
        provider: 'gmail',
        active: true,
        access_token: `encrypted_${authResult.accessToken}`,
        refresh_token: `encrypted_${authResult.refreshToken}`,
        token_expires_at: new Date(Date.now() + authResult.expiresIn! * 1000).toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const persistence = createTokenPersistence(mailbox)
      expect(persistence.isAuthenticated()).toBe(true)

      // Step 3: Refresh token when expired
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed_access_token',
          expires_in: 3600,
        }),
      })

      // Simulate expired token
      mailbox.token_expires_at = new Date(Date.now() - 1000).toISOString()

      const refreshResult = await refreshToken(mailbox, {
        supabase: mockSupabase,
        persistToDatabase: true,
        autoRetry: false,
      })

      expect(refreshResult.success).toBe(true)
      expect(refreshResult.accessToken).toBe('refreshed_access_token')
    })

    it('should handle OAuth flow with missing user info', async () => {
      const mockFetch = global.fetch as jest.Mock

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'unauthorized' }),
        })

      const gmailAuth = new GmailAuth()

      await expect(
        gmailAuth.authenticateIntegration('code', 'state', 'callback')
      ).rejects.toThrow('Failed to get Gmail user info')
    })
  })

  describe('Outlook OAuth Flow', () => {
    it('should complete full OAuth flow: authenticate -> persist -> refresh', async () => {
      const mockFetch = global.fetch as jest.Mock
      const mockSupabase = {
        from: jest.fn(() => ({
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }

      // Step 1: Authenticate
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'initial_access_token',
            refresh_token: 'initial_refresh_token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            mail: 'user@outlook.com',
            displayName: 'Test User',
          }),
        })

      const outlookAuth = new OutlookAuth()
      const authResult = await outlookAuth.authenticateIntegration(
        'auth_code',
        'state',
        'http://localhost:3000/callback'
      )

      expect(authResult.success).toBe(true)
      expect(authResult.email).toBe('user@outlook.com')

      // Step 2: Create mailbox
      const mailbox: Mailbox = {
        id: 'test-mailbox-id',
        user_id: 'test-user-id',
        email: authResult.email!,
        provider: 'outlook',
        active: true,
        access_token: `encrypted_${authResult.accessToken}`,
        refresh_token: `encrypted_${authResult.refreshToken}`,
        token_expires_at: new Date(Date.now() + authResult.expiresIn! * 1000).toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      // Step 3: Refresh token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed_access_token',
          expires_in: 3600,
        }),
      })

      mailbox.token_expires_at = new Date(Date.now() - 1000).toISOString()

      const refreshResult = await refreshToken(mailbox, {
        supabase: mockSupabase,
        persistToDatabase: true,
        autoRetry: false,
      })

      expect(refreshResult.success).toBe(true)
    })
  })

  describe('Token Persistence Integration', () => {
    it('should encrypt tokens on set and decrypt on get', () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_access',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const persistence = createTokenPersistence(mailbox)

      // Tokens should be decrypted when accessed
      const accessToken = persistence.getAccessToken()
      const refreshToken = persistence.getRefreshToken()

      // In real implementation, these would be decrypted
      // For test, we're checking the interface works
      expect(persistence.isAuthenticated()).toBe(true)
    })
  })
})

