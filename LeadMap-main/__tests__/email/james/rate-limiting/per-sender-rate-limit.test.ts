/**
 * Per-Sender Rate Limit Tests
 * 
 * Comprehensive tests for james-project per-sender rate limiting
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { PerSenderRateLimit, createPerSenderRateLimit } from '@/lib/email/james/rate-limiting/per-sender-rate-limit'

describe('Per-Sender Rate Limit', () => {
  let rateLimit: PerSenderRateLimit

  beforeEach(() => {
    rateLimit = createPerSenderRateLimit({
      duration: 60000, // 1 minute
      count: 10,
      recipients: 50,
      size: 10 * 1024 * 1024, // 10 MB
      totalSize: 100 * 1024 * 1024, // 100 MB
    })
  })

  describe('checkLimit', () => {
    it('should allow emails within limit', async () => {
      const result = await rateLimit.checkLimit('sender@example.com', 1000, 1)
      expect(result.allowed).toBe(true)
    })

    it('should reject when count limit exceeded', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimit.checkLimit('sender@example.com', 1000, 1)
      }

      const result = await rateLimit.checkLimit('sender@example.com', 1000, 1)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('COUNT_EXCEEDED')
      }
    })

    it('should reject when recipients limit exceeded', async () => {
      const result = await rateLimit.checkLimit('sender@example.com', 1000, 51)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('RECIPIENTS_EXCEEDED')
      }
    })

    it('should reject when size limit exceeded', async () => {
      const result = await rateLimit.checkLimit('sender@example.com', 11 * 1024 * 1024, 1)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('SIZE_EXCEEDED')
      }
    })

    it('should handle different senders independently', async () => {
      // Fill up sender1's limit
      for (let i = 0; i < 10; i++) {
        await rateLimit.checkLimit('sender1@example.com', 1000, 1)
      }

      // sender2 should still be able to send
      const result = await rateLimit.checkLimit('sender2@example.com', 1000, 1)
      expect(result.allowed).toBe(true)
    })
  })

  describe('getUsage', () => {
    it('should return current usage', async () => {
      await rateLimit.checkLimit('sender@example.com', 5000, 2)
      await rateLimit.checkLimit('sender@example.com', 3000, 1)

      const usage = await rateLimit.getUsage('sender@example.com')
      expect(usage.count).toBe(2)
      expect(usage.recipients).toBe(3)
      expect(usage.totalSize).toBe(8000)
    })
  })

  describe('reset', () => {
    it('should reset rate limit', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimit.checkLimit('sender@example.com', 1000, 1)
      }

      await rateLimit.reset('sender@example.com')

      const result = await rateLimit.checkLimit('sender@example.com', 1000, 1)
      expect(result.allowed).toBe(true)
    })
  })
})

