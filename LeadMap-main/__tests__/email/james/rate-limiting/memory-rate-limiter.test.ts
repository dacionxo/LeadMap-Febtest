/**
 * Memory Rate Limiter Tests
 * 
 * Comprehensive tests for james-project memory rate limiter utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { MemoryRateLimiter, createMemoryRateLimiter } from '@/lib/email/james/rate-limiting/memory-rate-limiter'
import type { RateLimitingKey, RateLimitRule } from '@/lib/email/james/rate-limiting/rate-limiter'

describe('Memory Rate Limiter', () => {
  let rateLimiter: MemoryRateLimiter

  beforeEach(() => {
    rateLimiter = createMemoryRateLimiter('test')
  })

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 60000, count: 10 }]

      const result = await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      expect(result.allowed).toBe(true)
    })

    it('should reject requests exceeding count limit', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 60000, count: 2 }]

      await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      const result = await rateLimiter.checkRateLimit(key, { count: 1 }, rules)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('COUNT_EXCEEDED')
        expect(result.limit).toBe(2)
        expect(result.current).toBe(2)
      }
    })

    it('should reject requests exceeding size limit', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 60000, size: 1000 }]

      const result = await rateLimiter.checkRateLimit(key, { size: 1500 }, rules)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('SIZE_EXCEEDED')
      }
    })

    it('should reject requests exceeding total size limit', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 60000, totalSize: 2000 }]

      await rateLimiter.checkRateLimit(key, { size: 1500 }, rules)
      const result = await rateLimiter.checkRateLimit(key, { size: 600 }, rules)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('TOTAL_SIZE_EXCEEDED')
      }
    })

    it('should reset after duration expires', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 100, count: 1 }] // 100ms duration

      await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      
      const result1 = await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      expect(result1.allowed).toBe(false)

      // Wait for duration to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      const result2 = await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      expect(result2.allowed).toBe(true)
    })
  })

  describe('getUsage', () => {
    it('should return current usage', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 60000, count: 10 }]

      await rateLimiter.checkRateLimit(key, { count: 1, size: 500 }, rules)
      await rateLimiter.checkRateLimit(key, { count: 1, size: 300 }, rules)

      const usage = await rateLimiter.getUsage(key, rules)
      expect(usage.count).toBe(2)
      expect(usage.totalSize).toBe(800)
    })
  })

  describe('reset', () => {
    it('should reset rate limit for key', async () => {
      const key: RateLimitingKey = { type: 'sender', identifier: 'test@example.com' }
      const rules: RateLimitRule[] = [{ duration: 60000, count: 2 }]

      await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      await rateLimiter.reset(key)

      const result = await rateLimiter.checkRateLimit(key, { count: 1 }, rules)
      expect(result.allowed).toBe(true)
    })
  })
})

