/**
 * Per-Sender Rate Limit
 * 
 * Rate limiting per sender following james-project PerSenderRateLimit mailet patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/rate-limiter/src/main/java/org/apache/james/transport/mailets/PerSenderRateLimit.java
 */

import type { RateLimiter, RateLimitingKey, RateLimitRule, RateLimitingResult } from './rate-limiter'
import { createMemoryRateLimiter, MemoryRateLimiter } from './memory-rate-limiter'

/**
 * Per-sender rate limit configuration
 */
export interface PerSenderRateLimitConfig {
  duration: number // Duration in milliseconds (e.g., 3600000 for 1 hour)
  precision?: number // Precision in milliseconds
  count?: number // Maximum number of emails per sender
  recipients?: number // Maximum number of recipients per sender
  size?: number // Maximum size per email in bytes
  totalSize?: number // Maximum total size in bytes
  keyPrefix?: string // Key prefix for storage
}

/**
 * Per-Sender Rate Limiter
 * Following james-project PerSenderRateLimit patterns
 */
export class PerSenderRateLimit {
  private rateLimiter: RateLimiter
  private config: Required<Omit<PerSenderRateLimitConfig, 'precision'>> & { precision?: number }

  constructor(config: PerSenderRateLimitConfig) {
    this.config = {
      duration: config.duration,
      precision: config.precision,
      count: config.count ?? Infinity,
      recipients: config.recipients ?? Infinity,
      size: config.size ?? Infinity,
      totalSize: config.totalSize ?? Infinity,
      keyPrefix: config.keyPrefix || 'ratelimit:sender',
    }
    this.rateLimiter = createMemoryRateLimiter(this.config.keyPrefix)
  }

  /**
   * Check if sender can send email
   * 
   * @param senderEmail - Sender email address
   * @param messageSize - Message size in bytes
   * @param recipientCount - Number of recipients
   * @returns Rate limiting result
   */
  async checkLimit(
    senderEmail: string,
    messageSize: number = 0,
    recipientCount: number = 1
  ): Promise<RateLimitingResult> {
    const key: RateLimitingKey = {
      type: 'sender',
      identifier: senderEmail.toLowerCase(),
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
   * Get current usage for sender
   * 
   * @param senderEmail - Sender email address
   * @returns Current usage statistics
   */
  async getUsage(senderEmail: string) {
    const key: RateLimitingKey = {
      type: 'sender',
      identifier: senderEmail.toLowerCase(),
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
   * Reset rate limit for sender
   * 
   * @param senderEmail - Sender email address
   */
  async reset(senderEmail: string): Promise<void> {
    const key: RateLimitingKey = {
      type: 'sender',
      identifier: senderEmail.toLowerCase(),
    }
    await this.rateLimiter.reset(key)
  }
}

/**
 * Create per-sender rate limiter
 * 
 * @param config - Rate limit configuration
 * @returns Per-sender rate limiter instance
 */
export function createPerSenderRateLimit(config: PerSenderRateLimitConfig): PerSenderRateLimit {
  return new PerSenderRateLimit(config)
}

