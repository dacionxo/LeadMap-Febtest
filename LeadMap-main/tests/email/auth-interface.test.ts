/**
 * Authentication Interface Unit Tests
 * 
 * Tests for OAuth authentication interfaces
 */

import { GmailAuth } from '@/lib/email/auth/gmail'
import { OutlookAuth } from '@/lib/email/auth/outlook'
import { Mailbox } from '@/lib/email/types'

// Mock fetch
global.fetch = jest.fn()

describe('Authentication Interfaces', () => {
  const createMockMailbox = (overrides: Partial<Mailbox> = {}): Mailbox => ({
    id: 'test-mailbox-id',
    user_id: 'test-user-id',
    email: 'test@example.com',
    provider: 'gmail',
    active: true,
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
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
    process.env.MICROSOFT_TENANT_ID = 'common'
  })

  describe('GmailAuth', () => {
    const gmailAuth = new GmailAuth()

    describe('isAuthenticated', () => {
      it('should return true for authenticated mailbox', () => {
        const mailbox = createMockMailbox({
          provider: 'gmail',
          access_token: 'token',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })

        expect(gmailAuth.isAuthenticated(mailbox)).toBe(true)
      })

      it('should return false for missing access token', () => {
        const mailbox = createMockMailbox({
          provider: 'gmail',
          access_token: null,
          refresh_token: 'refresh',
        })

        expect(gmailAuth.isAuthenticated(mailbox)).toBe(false)
      })

      it('should return false for missing refresh token', () => {
        const mailbox = createMockMailbox({
          provider: 'gmail',
          access_token: 'token',
          refresh_token: null,
        })

        expect(gmailAuth.isAuthenticated(mailbox)).toBe(false)
      })

      it('should return false for missing expiration', () => {
        const mailbox = createMockMailbox({
          provider: 'gmail',
          access_token: 'token',
          refresh_token: 'refresh',
          token_expires_at: null,
        })

        expect(gmailAuth.isAuthenticated(mailbox)).toBe(false)
      })
    })

    describe('authenticateIntegration', () => {
      it('should successfully authenticate with valid code', async () => {
        const mockFetch = global.fetch as jest.Mock

        // Mock token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
          }),
        })

        // Mock user info
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            email: 'user@gmail.com',
            name: 'Test User',
          }),
        })

        const result = await gmailAuth.authenticateIntegration(
          'auth_code',
          'state',
          'http://localhost:3000/callback'
        )

        expect(result.success).toBe(true)
        expect(result.accessToken).toBe('new_access_token')
        expect(result.refreshToken).toBe('new_refresh_token')
        expect(result.email).toBe('user@gmail.com')
        expect(result.displayName).toBe('Test User')
      })

      it('should throw ConfigurationError when OAuth not configured', async () => {
        delete process.env.GOOGLE_CLIENT_ID

        await expect(
          gmailAuth.authenticateIntegration('code', 'state', 'callback')
        ).rejects.toThrow('Gmail OAuth client not configured')
      })

      it('should throw AuthenticationError when token exchange fails', async () => {
        const mockFetch = global.fetch as jest.Mock

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          }),
        })

        await expect(
          gmailAuth.authenticateIntegration('invalid_code', 'state', 'callback')
        ).rejects.toThrow('Invalid authorization code')
      })

      it('should throw AuthenticationError when user info fetch fails', async () => {
        const mockFetch = global.fetch as jest.Mock

        // Token exchange succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
        })

        // User info fails
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: 'unauthorized',
          }),
        })

        await expect(
          gmailAuth.authenticateIntegration('code', 'state', 'callback')
        ).rejects.toThrow('Failed to get Gmail user info')
      })
    })
  })

  describe('OutlookAuth', () => {
    const outlookAuth = new OutlookAuth()

    describe('isAuthenticated', () => {
      it('should return true for authenticated mailbox', () => {
        const mailbox = createMockMailbox({
          provider: 'outlook',
          access_token: 'token',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })

        expect(outlookAuth.isAuthenticated(mailbox)).toBe(true)
      })

      it('should return false for missing tokens', () => {
        const mailbox = createMockMailbox({
          provider: 'outlook',
          access_token: null,
          refresh_token: null,
        })

        expect(outlookAuth.isAuthenticated(mailbox)).toBe(false)
      })
    })

    describe('authenticateIntegration', () => {
      it('should successfully authenticate with valid code', async () => {
        const mockFetch = global.fetch as jest.Mock

        // Mock token exchange
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
          }),
        })

        // Mock user info
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            mail: 'user@outlook.com',
            displayName: 'Test User',
          }),
        })

        const result = await outlookAuth.authenticateIntegration(
          'auth_code',
          'state',
          'http://localhost:3000/callback'
        )

        expect(result.success).toBe(true)
        expect(result.accessToken).toBe('new_access_token')
        expect(result.refreshToken).toBe('new_refresh_token')
        expect(result.email).toBe('user@outlook.com')
        expect(result.displayName).toBe('Test User')
      })

      it('should use userPrincipalName if mail is missing', async () => {
        const mockFetch = global.fetch as jest.Mock

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
        })

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            userPrincipalName: 'user@outlook.com',
            displayName: 'Test User',
          }),
        })

        const result = await outlookAuth.authenticateIntegration(
          'code',
          'state',
          'callback'
        )

        expect(result.email).toBe('user@outlook.com')
      })

      it('should throw ConfigurationError when OAuth not configured', async () => {
        delete process.env.MICROSOFT_CLIENT_ID

        await expect(
          outlookAuth.authenticateIntegration('code', 'state', 'callback')
        ).rejects.toThrow('Microsoft OAuth client not configured')
      })

      it('should use custom tenant ID when provided', async () => {
        process.env.MICROSOFT_TENANT_ID = 'custom-tenant'
        const mockFetch = global.fetch as jest.Mock

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
        })

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            mail: 'user@outlook.com',
            displayName: 'Test User',
          }),
        })

        await outlookAuth.authenticateIntegration('code', 'state', 'callback')

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('custom-tenant'),
          expect.any(Object)
        )
      })
    })
  })
})

