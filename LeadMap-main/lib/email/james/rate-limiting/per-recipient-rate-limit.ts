/**
 * Per-Recipient Rate Limit
 * 
 * Rate limiting per recipient following james-project PerRecipientRateLimit mailet patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/rate-limiter/src/main/java/org/apache/james/transport/mailets/PerRecipientRateLimit.java
 */

import type { RateLimiter, RateLimitingKey, RateLimitRule, RateLimitingResult } from './rate-limiter'
import { createMemoryRateLimiter } from './memory-rate-limiter'

/**
 * Per-recipient rate limit configuration
 */
export interface PerRecipientRateLimitConfig {
  duration: number // Duration in milliseconds
  precision?: number // Precision in milliseconds
  count?: number // Maximum number of emails per recipient
  size?: number // Maximum size per email in bytes
  totalSize?: number // Maximum total size in bytes
  keyPrefix?: string // Key prefix for storage
}

/**
 * Per-Recipient Rate Limiter
 * Following james-project PerRecipientRateLimit patterns
 */
export class PerRecipientRateLimit {
  private rateLimiter: RateLimiter
  private config: Required<Omit<PerRecipientRateLimitConfig, 'precision'>> & { precision?: number }

  constructor(config: PerRecipientRateLimitConfig) {
    this.config = {
      duration: config.duration,
      precision: config.precision,
      count: config.count ?? Infinity,
      size: config.size ?? Infinity,
      totalSize: config.totalSize ?? Infinity,
      keyPrefix: config.keyPrefix || 'ratelimit:recipient',
    }
    this.rateLimiter = createMemoryRateLimiter(this.config.keyPrefix)
  }

  /**
   * Check if recipient can receive email
   * 
   * @param recipientEmail - Recipient email address
   * @param messageSize - Message size in bytes
   * @returns Rate limiting result
   */
  async checkLimit(
    recipientEmail: string,
    messageSize: number = 0
  ): Promise<RateLimitingResult> {
    const key: RateLimitingKey = {
      type: 'recipient',
      identifier: recipientEmail.toLowerCase(),
    }

    const rules: RateLimitRule[] = [
      {
        duration: this.config.duration,
        precision: this.config.precision,
        count: this.config.count === Infinity ? undefined : this.config.count,
        size: this.config.size === Infinity ? undefined : this.config.size,
        totalSize: this.config.totalSize === Infinity ? undefined : this.config.totalSize,
      },
    ]

    return await this.rateLimiter.checkRateLimit(
      key,
      {
        count: 1,
        size: messageSize,
      },
      rules
    )
  }

  /**
   * Check multiple recipients
   * 
   * @param recipientEmails - Recipient email addresses
   * @param messageSize - Message size in bytes
   * @returns Rate limiting result (fails if any recipient exceeds limit)
   */
  async checkLimits(
    recipientEmails: string[],
    messageSize: number = 0
  ): Promise<RateLimitingResult> {
    for (const recipientEmail of recipientEmails) {
      const result = await this.checkLimit(recipientEmail, messageSize)
      if (!result.allowed) {
        return result
      }
    }
    return { allowed: true }
  }

  /**
   * Get current usage for recipient
   * 
   * @param recipientEmail - Recipient email address
   * @returns Current usage statistics
   */
  async getUsage(recipientEmail: string) {
    const key: RateLimitingKey = {
      type: 'recipient',
      identifier: recipientEmail.toLowerCase(),
    }

    const rules: RateLimitRule[] = [
      {
        duration: this.config.duration,
        precision: this.config.precision,
        count: this.config.count === Infinity ? undefined : this.config.count,
        size: this.config.size === Infinity ? undefined : this.config.size,
        totalSize: this.config.totalSize === Infinity ? undefined : this.config.totalSize,
      },
    ]

    return await this.rateLimiter.getUsage(key, rules)
  }

  /**
   * Reset rate limit for recipient
   * 
   * @param recipientEmail - Recipient email address
   */
  async reset(recipientEmail: string): Promise<void> {
    const key: RateLimitingKey = {
      type: 'recipient',
      identifier: recipientEmail.toLowerCase(),
    }
    await this.rateLimiter.reset(key)
  }
}

/**
 * Create per-recipient rate limiter
 * 
 * @param config - Rate limit configuration
 * @returns Per-recipient rate limiter instance
 */
export function createPerRecipientRateLimit(
  config: PerRecipientRateLimitConfig
): PerRecipientRateLimit {
  return new PerRecipientRateLimit(config)
}

