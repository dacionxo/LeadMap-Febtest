/**
 * nodemailer Error Handler
 * 
 * Error handling utilities for nodemailer operations
 * Following james-project error handling patterns adapted for TypeScript
 * Following .cursorrules: Error handling patterns, early returns, guard clauses
 */

import type { EmailError, ErrorCategory } from './types'
import { 
  OAuthError, 
  TokenExpiredError, 
  TokenRefreshError,
  classifyError,
  isRetryableError 
} from '../errors'

/**
 * Extract error code from nodemailer error
 */
function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code)
  }
  if (error instanceof Error) {
    return error.name
  }
  return 'UNKNOWN_ERROR'
}

/**
 * Categorize error based on error code and message
 */
function categorizeError(error: unknown): ErrorCategory {
  const code = getErrorCode(error)
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  // OAuth errors
  if (code === 'EAUTH' || message.includes('oauth') || message.includes('authentication')) {
    return 'oauth'
  }

  // Connection errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    message.includes('connection') ||
    message.includes('timeout')
  ) {
    return 'connection'
  }

  // Rate limit errors
  if (code === 'ERATELIMIT' || message.includes('rate limit') || message.includes('quota')) {
    return 'rate_limit'
  }

  // Network errors
  if (code === 'ENETUNREACH' || message.includes('network')) {
    return 'network'
  }

  // Validation errors
  if (code === 'EINVALID' || message.includes('invalid') || message.includes('validation')) {
    return 'validation'
  }

  return 'unknown'
}

/**
 * Check if error is retryable
 */
function isRetryable(error: unknown): boolean {
  // Check OAuth error classification
  if (isRetryableError(error)) {
    return true
  }

  // Check error category
  const category = categorizeError(error)
  const retryableCategories: ErrorCategory[] = ['connection', 'network', 'rate_limit']
  
  return retryableCategories.includes(category)
}

/**
 * Create structured EmailError from any error
 */
export function createEmailError(error: unknown, context?: string): EmailError {
  const category = categorizeError(error)
  const code = getErrorCode(error)
  const message = error instanceof Error ? error.message : String(error)
  const retryable = isRetryable(error)

  return {
    category,
    code,
    message: context ? `${context}: ${message}` : message,
    retryable,
    details: {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      ...(error instanceof OAuthError && { provider: error.provider }),
    },
  }
}

/**
 * Check if error requires token refresh
 */
export function requiresTokenRefresh(error: unknown): boolean {
  if (error instanceof TokenExpiredError) {
    return true
  }

  if (error instanceof OAuthError && error.statusCode === 401) {
    return true
  }

  const code = getErrorCode(error)
  if (code === 'EAUTH') {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    return message.includes('token') || message.includes('expired')
  }

  return false
}

/**
 * Get retry delay with exponential backoff
 */
export function getRetryDelay(attempt: number, config: {
  initialDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
} = {}): number {
  const {
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
  } = config

  const delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1)
  return Math.min(delay, maxDelayMs)
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}


