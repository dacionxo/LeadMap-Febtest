/**
 * In-Memory Rate Limiter
 * 
 * In-memory rate limiting implementation following james-project patterns
 * Suitable for single instance deployments
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/rate-limiter/src/main/java/org/apache/james/rate/limiter/memory/
 */

import type {
  RateLimiter,
  RateLimitingKey,
  RateLimitRule,
  RateLimitingResult,
} from './rate-limiter'

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number
  recipients: number
  size: number
  totalSize: number
  windowStart: number
  windowEnd: number
}

/**
 * In-memory rate limiter
 * Following james-project MemoryRateLimiter patterns
 */
export class MemoryRateLimiter implements RateLimiter {
  private storage = new Map<string, RateLimitEntry>()
  private keyPrefix: string

  constructor(keyPrefix: string = 'ratelimit') {
    this.keyPrefix = keyPrefix
  }

  /**
   * Generate storage key
   */
  private getStorageKey(key: RateLimitingKey, rule: RateLimitRule): string {
    const precision = rule.precision || rule.duration
    const windowStart = Math.floor(Date.now() / precision) * precision
    return `${this.keyPrefix}:${key.type}:${key.identifier}:${rule.duration}:${windowStart}`
  }

  /**
   * Check if rate limit allows the operation
   */
  async checkRateLimit(
    key: RateLimitingKey,
    increment: { count?: number; recipients?: number; size?: number },
    rules: RateLimitRule[]
  ): Promise<RateLimitingResult> {
    const now = Date.now()

    // Check each rule
    for (const rule of rules) {
      const storageKey = this.getStorageKey(key, rule)
      let entry = this.storage.get(storageKey)

      // Clean expired entries
      if (entry && entry.windowEnd < now) {
        this.storage.delete(storageKey)
        entry = undefined
      }

      // Initialize entry if needed
      if (!entry) {
        const precision = rule.precision || rule.duration
        const windowStart = Math.floor(now / precision) * precision
        entry = {
          count: 0,
          recipients: 0,
          size: 0,
          totalSize: 0,
          windowStart,
          windowEnd: windowStart + rule.duration,
        }
        this.storage.set(storageKey, entry)
      }

      // Check count limit
      if (rule.count !== undefined) {
        const newCount = entry.count + (increment.count || 1)
        if (newCount > rule.count) {
          return {
            allowed: false,
            reason: 'COUNT_EXCEEDED',
            limit: rule.count,
            current: entry.count,
            resetAt: new Date(entry.windowEnd),
          }
        }
        entry.count = newCount
      }

      // Check recipients limit
      if (rule.recipients !== undefined) {
        const newRecipients = entry.recipients + (increment.recipients || 0)
        if (newRecipients > rule.recipients) {
          return {
            allowed: false,
            reason: 'RECIPIENTS_EXCEEDED',
            limit: rule.recipients,
            current: entry.recipients,
            resetAt: new Date(entry.windowEnd),
          }
        }
        entry.recipients = newRecipients
      }

      // Check size limit
      if (rule.size !== undefined && increment.size !== undefined) {
        if (increment.size > rule.size) {
          return {
            allowed: false,
            reason: 'SIZE_EXCEEDED',
            limit: rule.size,
            current: increment.size,
            resetAt: new Date(entry.windowEnd),
          }
        }
      }

      // Update entry size tracking
      if (increment.size !== undefined) {
        entry.size = Math.max(entry.size, increment.size)
        entry.totalSize += increment.size
      }

      // Check total size limit
      if (rule.totalSize !== undefined) {
        if (entry.totalSize > rule.totalSize) {
          return {
            allowed: false,
            reason: 'TOTAL_SIZE_EXCEEDED',
            limit: rule.totalSize,
            current: entry.totalSize,
            resetAt: new Date(entry.windowEnd),
          }
        }
      }

      this.storage.set(storageKey, entry)
    }

    return { allowed: true }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: RateLimitingKey): Promise<void> {
    const keysToDelete: string[] = []
    for (const storageKey of Array.from(this.storage.keys())) {
      if (storageKey.startsWith(`${this.keyPrefix}:${key.type}:${key.identifier}:`)) {
        keysToDelete.push(storageKey)
      }
    }
    for (const keyToDelete of keysToDelete) {
      this.storage.delete(keyToDelete)
    }
  }

  /**
   * Get current usage for a key
   */
  async getUsage(
    key: RateLimitingKey,
    rules: RateLimitRule[]
  ): Promise<{
    count: number
    recipients: number
    size: number
    totalSize: number
    resetAt: Date
  }> {
    const now = Date.now()
    let maxCount = 0
    let maxRecipients = 0
    let maxSize = 0
    let maxTotalSize = 0
    let latestResetAt = new Date(now + 3600000) // Default: 1 hour from now

    for (const rule of rules) {
      const storageKey = this.getStorageKey(key, rule)
      const entry = this.storage.get(storageKey)

      if (entry && entry.windowEnd >= now) {
        maxCount = Math.max(maxCount, entry.count)
        maxRecipients = Math.max(maxRecipients, entry.recipients)
        maxSize = Math.max(maxSize, entry.size)
        maxTotalSize = Math.max(maxTotalSize, entry.totalSize)
        if (entry.windowEnd > latestResetAt.getTime()) {
          latestResetAt = new Date(entry.windowEnd)
        }
      }
    }

    return {
      count: maxCount,
      recipients: maxRecipients,
      size: maxSize,
      totalSize: maxTotalSize,
      resetAt: latestResetAt,
    }
  }

  /**
   * Clean expired entries (should be called periodically)
   */
  cleanExpired(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of Array.from(this.storage.entries())) {
      if (entry.windowEnd < now) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.storage.delete(key)
    }
  }

  /**
   * Get storage size (for monitoring)
   */
  getStorageSize(): number {
    return this.storage.size
  }
}

/**
 * Create in-memory rate limiter
 * 
 * @param keyPrefix - Key prefix for storage
 * @returns In-memory rate limiter instance
 */
export function createMemoryRateLimiter(keyPrefix?: string): MemoryRateLimiter {
  return new MemoryRateLimiter(keyPrefix)
}

