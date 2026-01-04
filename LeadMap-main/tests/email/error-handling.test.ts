/**
 * Error Handling Unit Tests
 * 
 * Tests for OAuth error handling and classification
 */

import {
  OAuthError,
  TokenExpiredError,
  TokenRefreshError,
  AuthenticationError,
  classifyError,
  isRetryableError,
  requiresReAuthentication,
  isTokenExpiredError,
  getUserFriendlyErrorMessage,
} from '@/lib/email/errors'

describe('Error Handling', () => {
  describe('Error Classes', () => {
    describe('OAuthError', () => {
      it('should create OAuthError with message', () => {
        const error = new OAuthError('Test error')
        expect(error.message).toBe('Test error')
        expect(error.name).toBe('OAuthError')
      })

      it('should create OAuthError with code and status', () => {
        const error = new OAuthError('Test error', 'TEST_CODE', 400)
        expect(error.code).toBe('TEST_CODE')
        expect(error.statusCode).toBe(400)
      })

      it('should include provider and details', () => {
        const error = new OAuthError('Test error', 'CODE', 400, 'gmail', { key: 'value' })
        expect(error.provider).toBe('gmail')
        expect(error.details).toEqual({ key: 'value' })
      })
    })

    describe('TokenExpiredError', () => {
      it('should create TokenExpiredError with default message', () => {
        const error = new TokenExpiredError()
        expect(error.message).toBe('OAuth token has expired')
        expect(error.name).toBe('TokenExpiredError')
        expect(error.code).toBe('TOKEN_EXPIRED')
        expect(error.statusCode).toBe(401)
      })

      it('should accept custom message and provider', () => {
        const error = new TokenExpiredError('Custom message', 'gmail')
        expect(error.message).toBe('Custom message')
        expect(error.provider).toBe('gmail')
      })
    })

    describe('TokenRefreshError', () => {
      it('should create TokenRefreshError with default message', () => {
        const error = new TokenRefreshError()
        expect(error.message).toBe('Failed to refresh OAuth token')
        expect(error.name).toBe('TokenRefreshError')
        expect(error.code).toBe('TOKEN_REFRESH_ERROR')
        expect(error.statusCode).toBe(401)
      })
    })

    describe('AuthenticationError', () => {
      it('should create AuthenticationError with default message', () => {
        const error = new AuthenticationError()
        expect(error.message).toBe('OAuth authentication failed')
        expect(error.name).toBe('AuthenticationError')
        expect(error.code).toBe('AUTHENTICATION_ERROR')
        expect(error.statusCode).toBe(401)
      })
    })
  })

  describe('classifyError', () => {
    it('should classify TokenExpiredError as authentication', () => {
      const error = new TokenExpiredError()
      expect(classifyError(error)).toBe('authentication')
    })

    it('should classify TokenRefreshError as permanent', () => {
      const error = new TokenRefreshError()
      expect(classifyError(error)).toBe('permanent')
    })

    it('should classify AuthenticationError as authentication', () => {
      const error = new AuthenticationError()
      expect(classifyError(error)).toBe('authentication')
    })

    it('should classify rate limit errors as transient', () => {
      const error = new OAuthError('Rate limit', 'RATE_LIMIT', 429)
      expect(classifyError(error)).toBe('transient')
    })

    it('should classify server errors as transient', () => {
      const error = new OAuthError('Server error', 'SERVER_ERROR', 500)
      expect(classifyError(error)).toBe('transient')
    })

    it('should classify timeout errors as transient', () => {
      const error = new OAuthError('Timeout', 'TIMEOUT', 408)
      expect(classifyError(error)).toBe('transient')
    })

    it('should classify network errors as transient', () => {
      const error = new Error('Network error')
      expect(classifyError(error)).toBe('transient')
    })

    it('should classify unknown errors as permanent', () => {
      const error = new Error('Unknown error')
      expect(classifyError(error)).toBe('permanent')
    })
  })

  describe('isRetryableError', () => {
    it('should return true for transient errors', () => {
      const error = new OAuthError('Rate limit', 'RATE_LIMIT', 429)
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return false for authentication errors', () => {
      const error = new TokenExpiredError()
      expect(isRetryableError(error)).toBe(false)
    })

    it('should return false for permanent errors', () => {
      const error = new TokenRefreshError()
      expect(isRetryableError(error)).toBe(false)
    })
  })

  describe('requiresReAuthentication', () => {
    it('should return true for TokenRefreshError', () => {
      const error = new TokenRefreshError()
      expect(requiresReAuthentication(error)).toBe(true)
    })

    it('should return false for TokenExpiredError', () => {
      const error = new TokenExpiredError()
      expect(requiresReAuthentication(error)).toBe(false)
    })

    it('should return false for other errors', () => {
      const error = new AuthenticationError()
      expect(requiresReAuthentication(error)).toBe(false)
    })
  })

  describe('isTokenExpiredError', () => {
    it('should return true for TokenExpiredError', () => {
      const error = new TokenExpiredError()
      expect(isTokenExpiredError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = new TokenRefreshError()
      expect(isTokenExpiredError(error)).toBe(false)
    })
  })

  describe('getUserFriendlyErrorMessage', () => {
    it('should return user-friendly message for TokenExpiredError', () => {
      const error = new TokenExpiredError()
      const message = getUserFriendlyErrorMessage(error)
      expect(message).toContain('session has expired')
      expect(message).toContain('reconnect')
    })

    it('should return user-friendly message for TokenRefreshError', () => {
      const error = new TokenRefreshError()
      const message = getUserFriendlyErrorMessage(error)
      expect(message).toContain('connection has expired')
      expect(message).toContain('reconnect')
    })

    it('should return user-friendly message for AuthenticationError', () => {
      const error = new AuthenticationError()
      const message = getUserFriendlyErrorMessage(error)
      expect(message).toContain('Authentication failed')
      expect(message).toContain('try connecting again')
    })

    it('should return error message for OAuthError', () => {
      const error = new OAuthError('Custom error message')
      const message = getUserFriendlyErrorMessage(error)
      expect(message).toBe('Custom error message')
    })

    it('should return error message for generic Error', () => {
      const error = new Error('Generic error')
      const message = getUserFriendlyErrorMessage(error)
      expect(message).toBe('Generic error')
    })

    it('should return default message for unknown errors', () => {
      const error = { message: '' }
      const message = getUserFriendlyErrorMessage(error)
      expect(message).toBe('An unexpected error occurred.')
    })
  })
})


