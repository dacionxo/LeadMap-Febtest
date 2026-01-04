/**
 * Authentication Rate Limiting Utility
 * 
 * Implements scalable authentication request handling with:
 * - Exponential backoff with jitter
 * - Request deduplication
 * - Client-side rate limiting
 * - Retry logic for transient errors
 * 
 * Designed to handle 1,000+ concurrent authentication requests
 * Following Mautic patterns for authentication throttling and scalability
 * 
 * @see https://github.com/mautic/mautic for Mautic authentication patterns
 */

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum number of requests per window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Initial retry delay in milliseconds */
  initialDelay: number
  /** Maximum retry delay in milliseconds */
  maxDelay: number
  /** Backoff multiplier */
  backoffMultiplier: number
  /** Maximum number of retries */
  maxRetries: number
}

/**
 * Default rate limit configuration for authentication
 * Conservative limits to prevent overwhelming Supabase Auth
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100, // Allow 100 requests per window
  windowMs: 60000, // 1 minute window
  initialDelay: 1000, // 1 second initial delay
  maxDelay: 30000, // 30 seconds max delay
  backoffMultiplier: 2,
  maxRetries: 3,
}

/**
 * Request tracking for deduplication
 */
interface RequestTracker {
  key: string
  timestamp: number
  resolve: (value: any) => void
  reject: (error: any) => void
}

/**
 * In-memory request tracker for deduplication
 * Prevents duplicate simultaneous requests for the same operation
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, RequestTracker[]>()

  /**
   * Execute a request with deduplication
   * If a request with the same key is already pending, it will wait for that request to complete
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 5000 // 5 second TTL for deduplication
  ): Promise<T> {
    // Check if there's a pending request
    const pending = this.pendingRequests.get(key)
    if (pending && pending.length > 0) {
      // Wait for the existing request to complete
      return new Promise<T>((resolve, reject) => {
        pending.push({
          key,
          timestamp: Date.now(),
          resolve: resolve as (value: any) => void,
          reject,
        })
      })
    }

    // Create new request tracker
    const tracker: RequestTracker = {
      key,
      timestamp: Date.now(),
      resolve: () => {},
      reject: () => {},
    }

    this.pendingRequests.set(key, [tracker])

    try {
      // Execute the actual request
      const result = await fn()

      // Resolve all pending requests with the same key
      const pendingList = this.pendingRequests.get(key) || []
      pendingList.forEach((t) => t.resolve(result))
      this.pendingRequests.delete(key)

      return result
    } catch (error) {
      // Reject all pending requests with the same key
      const pendingList = this.pendingRequests.get(key) || []
      pendingList.forEach((t) => t.reject(error))
      this.pendingRequests.delete(key)

      throw error
    } finally {
      // Cleanup expired requests
      setTimeout(() => {
        const pendingList = this.pendingRequests.get(key)
        if (pendingList) {
          const now = Date.now()
          const valid = pendingList.filter((t) => now - t.timestamp < ttl)
          if (valid.length === 0) {
            this.pendingRequests.delete(key)
          } else {
            this.pendingRequests.set(key, valid)
          }
        }
      }, ttl)
    }
  }
}

/**
 * Client-side rate limiter
 * Tracks requests and enforces rate limits
 */
class ClientRateLimiter {
  private requests: number[] = []
  private config: RateLimitConfig

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config
  }

  /**
   * Check if a request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    // Remove old requests outside the window
    this.requests = this.requests.filter((timestamp) => timestamp > windowStart)

    // Check if we're under the limit
    return this.requests.length < this.config.maxRequests
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.requests.push(Date.now())
  }

  /**
   * Get the time until the next request is allowed (in milliseconds)
   */
  getTimeUntilNextAllowed(): number {
    if (this.isAllowed()) {
      return 0
    }

    const now = Date.now()
    const windowStart = now - this.config.windowMs
    const oldestRequest = Math.min(...this.requests.filter((t) => t > windowStart))

    if (oldestRequest) {
      return oldestRequest + this.config.windowMs - now
    }

    return this.config.initialDelay
  }
}

/**
 * Global instances
 */
const deduplicator = new RequestDeduplicator()
const rateLimiter = new ClientRateLimiter(DEFAULT_CONFIG)

/**
 * Check if an error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const errorObj = error as any

  // Check status code
  if (errorObj.status === 429) return true

  // Check error message
  const message = errorObj.message?.toLowerCase() || ''
  return (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('request rate limit')
  )
}

/**
 * Execute an authentication request with rate limiting, deduplication, and retry logic
 * 
 * @param key - Unique key for deduplication (e.g., email address)
 * @param fn - Function to execute
 * @param config - Optional rate limit configuration
 * @returns Promise with the result
 */
export async function executeWithRateLimit<T>(
  key: string,
  fn: () => Promise<T>,
  config: Partial<RateLimitConfig> = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // Execute with deduplication
  return deduplicator.execute(key, async () => {
    let lastError: unknown

    for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
      // Check client-side rate limit
      if (!rateLimiter.isAllowed()) {
        const waitTime = rateLimiter.getTimeUntilNextAllowed()
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }

      // Record the request
      rateLimiter.recordRequest()

      try {
        // Execute the request
        return await fn()
      } catch (error: unknown) {
        lastError = error

        // Don't retry on last attempt
        if (attempt === mergedConfig.maxRetries) {
          break
        }

        // Only retry on rate limit errors
        if (!isRateLimitError(error)) {
          throw error
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          mergedConfig.initialDelay * Math.pow(mergedConfig.backoffMultiplier, attempt),
          mergedConfig.maxDelay
        )

        // Add jitter (0-1000ms) to prevent thundering herd
        const jitter = Math.random() * 1000
        const delay = baseDelay + jitter

        console.warn(
          `Authentication rate limit hit (attempt ${attempt + 1}/${mergedConfig.maxRetries}), retrying after ${Math.round(delay)}ms`,
          { key }
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  })
}

/**
 * Create a rate-limited authentication function
 * 
 * @param config - Rate limit configuration
 * @returns Rate-limited function
 */
export function createRateLimitedAuth<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  getKey: (...args: TArgs) => string,
  config: Partial<RateLimitConfig> = {}
) {
  return async (...args: TArgs): Promise<TResult> => {
    const key = getKey(...args)
    return executeWithRateLimit(key, () => fn(...args), config)
  }
}

