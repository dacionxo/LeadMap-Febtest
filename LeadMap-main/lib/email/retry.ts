/**
 * Email Retry Utility
 * Implements exponential backoff retry policy for transient email failures
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableStatusCodes?: number[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504] // Rate limits and server errors
}

/**
 * Check if an error is retryable based on error message or status code
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
function extractStatusCode(error: string): number | undefined {
  // Try to extract status code from error messages like "HTTP 429" or "status: 503"
  const statusMatch = error.match(/(?:HTTP|status|code)[:\s]+(\d{3})/i)
  if (statusMatch) {
    return parseInt(statusMatch[1], 10)
  }
  return undefined
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || error?.error || String(error)
      const statusCode = error?.statusCode || extractStatusCode(errorMessage)

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break
      }

      // Check if error is retryable
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

      console.log(`Retrying email send (attempt ${attempt + 1}/${opts.maxRetries}) after ${jitteredDelay}ms`, {
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
 */
export function isPermanentFailure(error: string): boolean {
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


