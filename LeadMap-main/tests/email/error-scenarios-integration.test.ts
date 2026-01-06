/**
 * Error Scenarios Integration Tests
 * 
 * Integration tests for error handling scenarios
 */

import { refreshToken } from '@/lib/email/token-refresh'
import { GmailAuth } from '@/lib/email/auth/gmail'
import {
  TokenExpiredError,
  TokenRefreshError,
  AuthenticationError,
  classifyError,
  isRetryableError,
  getUserFriendlyErrorMessage,
} from '@/lib/email/errors'
import { Mailbox } from '@/lib/email/types'

// Mock fetch
global.fetch = jest.fn()

describe('Error Scenarios Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
  })

  describe('Authentication Error Scenarios', () => {
    it('should handle invalid authorization code', async () => {
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      })

      const gmailAuth = new GmailAuth()

      await expect(
        gmailAuth.authenticateIntegration('invalid_code', 'state', 'callback')
      ).rejects.toThrow(AuthenticationError)
    })

    it('should handle expired authorization code', async () => {
      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Authorization code has expired',
        }),
      })

      const gmailAuth = new GmailAuth()

      try {
        await gmailAuth.authenticateIntegration('expired_code', 'state', 'callback')
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError)
        expect(classifyError(error)).toBe('authentication')
      }
    })
  })

  describe('Token Refresh Error Scenarios', () => {
    it('should handle revoked refresh token', async () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_token',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

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
      expect(result.errorCode).toBe('invalid_grant')
      expect(result.shouldRetry).toBe(false)
      expect(classifyError({ message: result.error || '', statusCode: 400 })).toBe('permanent')
    })

    it('should handle rate limit errors with retry', async () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_token',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const mockFetch = global.fetch as jest.Mock

      // First attempt: rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'rate_limit_exceeded',
        }),
      })

      // Second attempt: success
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

    it('should handle network errors with retry', async () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_token',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const mockFetch = global.fetch as jest.Mock

      // First attempt: network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Second attempt: success
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
    })
  })

  describe('Error Classification and Handling', () => {
    it('should classify and handle errors correctly in workflow', async () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_token',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: false,
        persistToDatabase: false,
      })

      // Classify the error
      const errorType = classifyError({
        message: result.error || '',
        statusCode: 400,
      })

      expect(errorType).toBe('permanent')
      expect(isRetryableError({ message: result.error || '', statusCode: 400 })).toBe(false)

      // Get user-friendly message
      const userMessage = getUserFriendlyErrorMessage({
        message: result.error || '',
        statusCode: 400,
      })

      expect(userMessage).toBeTruthy()
    })

    it('should provide appropriate error messages for different error types', () => {
      const expiredError = new TokenExpiredError()
      expect(getUserFriendlyErrorMessage(expiredError)).toContain('session has expired')

      const refreshError = new TokenRefreshError()
      expect(getUserFriendlyErrorMessage(refreshError)).toContain('connection has expired')

      const authError = new AuthenticationError()
      expect(getUserFriendlyErrorMessage(authError)).toContain('Authentication failed')
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should recover from transient errors', async () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_token',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const mockFetch = global.fetch as jest.Mock

      // Simulate transient failures followed by success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'server_error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'server_error' }),
        })
        .mockResolvedValueOnce({
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
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should not retry permanent errors', async () => {
      const mailbox: Mailbox = {
        id: 'test-id',
        user_id: 'user-id',
        email: 'test@example.com',
        provider: 'gmail',
        active: true,
        access_token: 'encrypted_token',
        refresh_token: 'encrypted_refresh',
        token_expires_at: new Date().toISOString(),
        daily_limit: 0,
        hourly_limit: 0,
      }

      const mockFetch = global.fetch as jest.Mock

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token revoked',
        }),
      })

      const result = await refreshToken(mailbox, {
        autoRetry: true,
        maxRetries: 3,
        persistToDatabase: false,
      })

      expect(result.success).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retries
    })
  })
})




