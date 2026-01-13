/**
 * Rate Limiting Utilities
 * 
 * Rate limiting patterns following james-project implementation
 * Based on PerSenderRateLimit, PerRecipientRateLimit, and GlobalRateLimit mailets
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/rate-limiter/src/main/java/org/apache/james/rate/limiter/api/
 * @see james-project/src/adr/0053-email-rate-limiting.md
 */

/**
 * Rate limiting key
 */
export interface RateLimitingKey {
  type: 'sender' | 'recipient' | 'global'
  identifier: string // email address or 'global'
}

/**
 * Rate limiting rule
 */
export interface RateLimitRule {
  duration: number // Duration in milliseconds
  precision?: number // Precision in milliseconds (default: same as duration)
  count?: number // Maximum number of emails
  recipients?: number // Maximum number of recipients
  size?: number // Maximum size per email in bytes
  totalSize?: number // Maximum total size in bytes
}

/**
 * Rate limiting result
 */
export type RateLimitingResult = 
  | { allowed: true }
  | { 
      allowed: false
      reason: 'COUNT_EXCEEDED' | 'RECIPIENTS_EXCEEDED' | 'SIZE_EXCEEDED' | 'TOTAL_SIZE_EXCEEDED'
      limit: number
      current: number
      resetAt: Date
    }

/**
 * Rate limiter interface
 * Following james-project RateLimiter interface patterns
 */
export interface RateLimiter {
  /**
   * Check if rate limit allows the operation
   * 
   * @param key - Rate limiting key
   * @param increment - Increment values (count, recipients, size)
   * @param rules - Rate limiting rules
   * @returns Rate limiting result
   */
  checkRateLimit(
    key: RateLimitingKey,
    increment: { count?: number; recipients?: number; size?: number },
    rules: RateLimitRule[]
  ): Promise<RateLimitingResult>

  /**
   * Reset rate limit for a key
   * 
   * @param key - Rate limiting key
   */
  reset(key: RateLimitingKey): Promise<void>

  /**
   * Get current usage for a key
   * 
   * @param key - Rate limiting key
   * @param rules - Rate limiting rules
   * @returns Current usage statistics
   */
  getUsage(
    key: RateLimitingKey,
    rules: RateLimitRule[]
  ): Promise<{
    count: number
    recipients: number
    size: number
    totalSize: number
    resetAt: Date
  }>
}

/**
 * Rate limiter factory
 * Following james-project RateLimiterFactory patterns
 */
export interface RateLimiterFactory {
  /**
   * Create a rate limiter instance
   * 
   * @param config - Rate limiter configuration
   * @returns Rate limiter instance
   */
  create(config?: RateLimiterConfig): RateLimiter
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  storage?: 'memory' | 'redis' // Storage backend (default: memory)
  redisUrl?: string // Redis URL (required if storage is 'redis')
  keyPrefix?: string // Key prefix for storage (default: 'ratelimit')
}

