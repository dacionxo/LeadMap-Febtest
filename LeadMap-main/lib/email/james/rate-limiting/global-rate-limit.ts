/**
 * Global Rate Limit
 * 
 * Global rate limiting following james-project GlobalRateLimit mailet patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/rate-limiter/src/main/java/org/apache/james/transport/mailets/GlobalRateLimit.java
 */

import type { RateLimiter, RateLimitingKey, RateLimitRule, RateLimitingResult } from './rate-limiter'
import { createMemoryRateLimiter } from './memory-rate-limiter'

/**
 * Global rate limit configuration
 */
export interface GlobalRateLimitConfig {
  duration: number // Duration in milliseconds
  precision?: number // Precision in milliseconds
  count?: number // Maximum number of emails globally
  recipients?: number // Maximum number of recipients globally
  size?: number // Maximum size per email in bytes
  totalSize?: number // Maximum total size in bytes
  keyPrefix?: string // Key prefix for storage
}

/**
 * Global Rate Limiter
 * Following james-project GlobalRateLimit patterns
 */
export class GlobalRateLimit {
  private rateLimiter: RateLimiter
  private config: Required<Omit<GlobalRateLimitConfig, 'precision'>> & { precision?: number }

  constructor(config: GlobalRateLimitConfig) {
    this.config = {
      duration: config.duration,
      precision: config.precision,
      count: config.count ?? Infinity,
      recipients: config.recipients ?? Infinity,
      size: config.size ?? Infinity,
      totalSize: config.totalSize ?? Infinity,
      keyPrefix: config.keyPrefix || 'ratelimit:global',
    }
    this.rateLimiter = createMemoryRateLimiter(this.config.keyPrefix)
  }

  /**
   * Check if global limit allows the operation
   * 
   * @param messageSize - Message size in bytes
   * @param recipientCount - Number of recipients
   * @returns Rate limiting result
   */
  async checkLimit(
    messageSize: number = 0,
    recipientCount: number = 1
  ): Promise<RateLimitingResult> {
    const key: RateLimitingKey = {
      type: 'global',
      identifier: 'global',
    }

    const rules: RateLimitRule[] = [
      {
        duration: this.config.duration,
        precision: this.config.precision,
        count: this.config.count === Infinity ? undefined : this.config.count,
        recipients: this.config.recipients === Infinity ? undefined : this.config.recipients,
        size: this.config.size === Infinity ? undefined : this.config.size,
        totalSize: this.config.totalSize === Infinity ? undefined : this.config.totalSize,
      },
    ]

    return await this.rateLimiter.checkRateLimit(
      key,
      {
        count: 1,
        recipients: recipientCount,
        size: messageSize,
      },
      rules
    )
  }

  /**
   * Get current global usage
   * 
   * @returns Current usage statistics
   */
  async getUsage() {
    const key: RateLimitingKey = {
      type: 'global',
      identifier: 'global',
    }

    const rules: RateLimitRule[] = [
      {
        duration: this.config.duration,
        precision: this.config.precision,
        count: this.config.count === Infinity ? undefined : this.config.count,
        recipients: this.config.recipients === Infinity ? undefined : this.config.recipients,
        size: this.config.size === Infinity ? undefined : this.config.size,
        totalSize: this.config.totalSize === Infinity ? undefined : this.config.totalSize,
      },
    ]

    return await this.rateLimiter.getUsage(key, rules)
  }

  /**
   * Reset global rate limit
   */
  async reset(): Promise<void> {
    const key: RateLimitingKey = {
      type: 'global',
      identifier: 'global',
    }
    await this.rateLimiter.reset(key)
  }
}

/**
 * Create global rate limiter
 * 
 * @param config - Rate limit configuration
 * @returns Global rate limiter instance
 */
export function createGlobalRateLimit(config: GlobalRateLimitConfig): GlobalRateLimit {
  return new GlobalRateLimit(config)
}

