/**
 * OAuth Error Handling
 * 
 * Enhanced error handling patterns for OAuth operations
 * Inspired by Mautic's error handling approach, adapted for Node.js/TypeScript.
 * 
 * Provides:
 * - Clear separation between different error types
 * - Proper error classification (transient, authentication, permanent)
 * - Better logging and monitoring capabilities
 * 
 * @see https://github.com/mautic/mautic for the original PHP implementation pattern
 */

/**
 * Base error class for OAuth-related errors
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode: number = 500,
    public readonly provider?: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'OAuthError'
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OAuthError)
    }
  }
}

/**
 * Token has expired and needs to be refreshed
 * This is a recoverable error - the token refresh should be triggered
 */
export class TokenExpiredError extends OAuthError {
  constructor(
    message: string = 'OAuth token has expired',
    provider?: string,
    details?: unknown
  ) {
    super(message, 'TOKEN_EXPIRED', 401, provider, details)
    this.name = 'TokenExpiredError'
  }
}

/**
 * Token refresh failed
 * This indicates that the refresh token is invalid or revoked
 */
export class TokenRefreshError extends OAuthError {
  constructor(
    message: string = 'Failed to refresh OAuth token',
    provider?: string,
    details?: unknown
  ) {
    super(message, 'TOKEN_REFRESH_ERROR', 401, provider, details)
    this.name = 'TokenRefreshError'
  }
}

/**
 * Authentication failed during OAuth flow
 * This could be due to invalid credentials, rejected authorization, or configuration issues
 */
export class AuthenticationError extends OAuthError {
  constructor(
    message: string = 'OAuth authentication failed',
    provider?: string,
    details?: unknown
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401, provider, details)
    this.name = 'AuthenticationError'
  }
}

/**
 * Error types for classification
 */
export type ErrorType = 'transient' | 'authentication' | 'permanent'

/**
 * Classifies an error to determine how it should be handled
 * 
 * @param error - The error to classify
 * @returns The error type classification
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof TokenExpiredError) {
    return 'authentication' // Trigger token refresh
  }

  if (error instanceof TokenRefreshError) {
    return 'permanent' // Refresh token is invalid, user needs to re-authenticate
  }

  if (error instanceof AuthenticationError) {
    return 'authentication' // Authentication issue, may need re-auth
  }

  if (error instanceof OAuthError) {
    // Check status code for transient errors
    if (error.statusCode === 429 || error.statusCode >= 500 || error.statusCode === 408) {
      return 'transient' // Rate limit, server error, or timeout - can retry
    }
    return 'permanent' // Other OAuth errors are typically permanent
  }

  // Network errors and timeouts are transient
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return 'transient'
    }
  }

  // Default to permanent for unknown errors
  return 'permanent'
}

/**
 * Checks if an error is retryable (transient error)
 * 
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return classifyError(error) === 'transient'
}

/**
 * Checks if an error requires re-authentication
 * 
 * @param error - The error to check
 * @returns true if the error requires re-authentication
 */
export function requiresReAuthentication(error: unknown): boolean {
  const type = classifyError(error)
  return type === 'authentication' && error instanceof TokenRefreshError
}

/**
 * Checks if an error indicates token expiration
 * 
 * @param error - The error to check
 * @returns true if the error indicates token expiration
 */
export function isTokenExpiredError(error: unknown): boolean {
  return error instanceof TokenExpiredError
}

/**
 * Checks if an error is an OAuth error
 * 
 * @param error - The error to check
 * @returns true if the error is an OAuth error
 */
export function isOAuthError(error: unknown): error is OAuthError {
  return error instanceof OAuthError
}

/**
 * Creates a user-friendly error message from an OAuth error
 * 
 * @param error - The error to format
 * @returns A user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof TokenExpiredError) {
    return 'Your session has expired. Please reconnect your account.'
  }

  if (error instanceof TokenRefreshError) {
    return 'Your account connection has expired. Please reconnect your account.'
  }

  if (error instanceof AuthenticationError) {
    return 'Authentication failed. Please try connecting again.'
  }

  if (error instanceof OAuthError) {
    return error.message || 'An authentication error occurred.'
  }

  if (error instanceof Error) {
    return error.message || 'An unexpected error occurred.'
  }

  return 'An unexpected error occurred.'
}


