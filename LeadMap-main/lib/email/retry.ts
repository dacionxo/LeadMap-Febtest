/**
 * Email Retry Utility
 * Implements exponential backoff retry policy for transient email failures
 * Enhanced with error classification to distinguish between transient, authentication, and permanent errors
 * 
 * Inspired by Mautic's error handling patterns, adapted for Node.js/TypeScript.
 */

import { 
  classifyError, 
  isRetryableError as isRetryableErrorClass,
  requiresReAuthentication,
  isOAuthError,
  type ErrorType
} from './errors'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableStatusCodes?: number[]
  /**
   * Whether to automatically handle authentication errors (token refresh)
   * If false, authentication errors will be thrown immediately
   */
  handleAuthenticationErrors?: boolean
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'handleAuthenticationErrors'>> & { handleAuthenticationErrors: boolean } = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504], // Rate limits and server errors
  handleAuthenticationErrors: false, // Don't auto-handle auth errors in retry logic (handled by providers)
}

/**
 * Check if an error is retryable based on error message or status code
 * @deprecated Use classifyError from './errors' instead
 */
function isRetryableError(error: string, statusCode?: number): boolean {
  const retryableMessages = [
    'rate limit',
    'rateLimitExceeded',
    'quota exceeded',
    'temporary',
    'server error',
    'timeout',
    'network error',
    'connection',
    'service unavailable'
  ]

  const lowerError = error.toLowerCase()
  
  // Check status codes first
  if (statusCode && DEFAULT_OPTIONS.retryableStatusCodes.includes(statusCode)) {
    return true
  }

  // Check error messages
  return retryableMessages.some(msg => lowerError.includes(msg))
}

/**
 * Extract HTTP status code from error message if possible
 */
function extractStatusCode(error: string | Error | unknown): number | undefined {
  if (isOAuthError(error)) {
    return error.statusCode
  }

  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error)

  // Try to extract status code from error messages like "HTTP 429" or "status: 503"
  const statusMatch = errorMessage.match(/(?:HTTP|status|code)[:\s]+(\d{3})/i)
  if (statusMatch) {
    return parseInt(statusMatch[1], 10)
  }
  return undefined
}

/**
 * Retry a function with exponential backoff
 * Enhanced to use error classification for better error handling
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break
      }

      // Use enhanced error classification
      const errorType = classifyError(error)

      // Authentication errors: Don't retry (require re-authentication)
      if (errorType === 'authentication') {
        if (requiresReAuthentication(error)) {
          // Token refresh failed - user needs to re-authenticate
          throw error
        }
        // Token expired - don't retry here (provider should handle refresh)
        throw error
      }

      // Permanent errors: Don't retry
      if (errorType === 'permanent') {
        throw error
      }

      // Transient errors: Retry with exponential backoff
      if (errorType === 'transient') {
        const delay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelay
        )

        // Add jitter to avoid thundering herd
        const jitteredDelay = delay + Math.random() * 1000

        const errorMessage = error instanceof Error 
          ? error.message 
          : String(error)

        console.log(`Retrying email operation (attempt ${attempt + 1}/${opts.maxRetries}) after ${jitteredDelay}ms`, {
          error: errorMessage,
          errorType,
          statusCode: extractStatusCode(error)
        })

        await new Promise(resolve => setTimeout(resolve, jitteredDelay))
        continue
      }

      // Fallback to legacy logic for non-OAuth errors
      const errorMessage = error instanceof Error 
        ? error.message 
        : String(error)
      const statusCode = extractStatusCode(error)

      if (!isRetryableError(errorMessage, statusCode)) {
        throw error // Non-retryable error, throw immediately
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      )

      // Add jitter to avoid thundering herd
      const jitteredDelay = delay + Math.random() * 1000

      console.log(`Retrying email operation (attempt ${attempt + 1}/${opts.maxRetries}) after ${jitteredDelay}ms`, {
        error: errorMessage,
        statusCode
      })

      await new Promise(resolve => setTimeout(resolve, jitteredDelay))
    }
  }

  throw lastError
}

/**
 * Check if error indicates a permanent failure (should not retry)
 * @deprecated Use classifyError from './errors' instead
 */
export function isPermanentFailure(error: string | unknown): boolean {
  if (typeof error !== 'string') {
    const errorType = classifyError(error)
    return errorType === 'permanent'
  }

  const permanentMessages = [
    'authentication expired',
    'permission denied',
    'invalid',
    'not found',
    'unauthorized',
    'forbidden',
    'bad request',
    'malformed'
  ]

  const lowerError = error.toLowerCase()
  return permanentMessages.some(msg => lowerError.includes(msg))
}

/**
 * Get error type classification for logging/monitoring
 * 
 * @param error - The error to classify
 * @returns The error type classification
 */
export function getErrorType(error: unknown): ErrorType {
  return classifyError(error)
}



