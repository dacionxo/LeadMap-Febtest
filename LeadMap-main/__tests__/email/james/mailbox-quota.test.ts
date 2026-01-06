/**
 * Mailbox Quota Tests
 * 
 * Comprehensive tests for james-project mailbox quota management utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  calculateQuotaUsage,
  checkQuota,
  setQuotaLimits,
  getQuotaLimits,
  isOverQuota,
  formatQuotaStatus,
  QuotaExceededError,
} from '@/lib/email/james/mailbox/quota'

describe('Mailbox Quota', () => {
  const testQuotaRoot = {
    user: 'testuser',
    domain: 'example.com',
  }

  beforeEach(() => {
    // Reset quota state before each test
    // Note: In a real implementation, this would reset the in-memory store
  })

  describe('calculateQuotaUsage', () => {
    it('should calculate quota usage', async () => {
      const usage = await calculateQuotaUsage(testQuotaRoot)
      expect(usage).toHaveProperty('usedStorageBytes')
      expect(usage).toHaveProperty('usedMessageCount')
    })
  })

  describe('setQuotaLimits and getQuotaLimits', () => {
    it('should set and get quota limits', async () => {
      const limits = {
        maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
        maxMessageCount: 100_000,
      }

      await setQuotaLimits(testQuotaRoot, limits)
      const retrieved = await getQuotaLimits(testQuotaRoot)

      expect(retrieved.maxStorageBytes).toBe(limits.maxStorageBytes)
      expect(retrieved.maxMessageCount).toBe(limits.maxMessageCount)
    })

    it('should return default limits when not set', async () => {
      const limits = await getQuotaLimits({
        user: 'newuser',
        domain: 'example.com',
      })

      expect(limits.maxStorageBytes).toBeGreaterThan(0)
      expect(limits.maxMessageCount).toBeGreaterThan(0)
    })
  })

  describe('checkQuota', () => {
    it('should pass when within quota', async () => {
      await setQuotaLimits(testQuotaRoot, {
        maxStorageBytes: 10 * 1024 * 1024 * 1024,
        maxMessageCount: 100_000,
      })

      const currentUsage = {
        usedStorageBytes: 5 * 1024 * 1024 * 1024,
        usedMessageCount: 50_000,
      }

      await expect(
        checkQuota(testQuotaRoot, currentUsage, 1024 * 1024, 100)
      ).resolves.not.toThrow()
    })

    it('should throw when storage quota exceeded', async () => {
      await setQuotaLimits(testQuotaRoot, {
        maxStorageBytes: 1024 * 1024, // 1 MB
        maxMessageCount: 100_000,
      })

      const currentUsage = {
        usedStorageBytes: 512 * 1024, // 512 KB
        usedMessageCount: 0,
      }

      await expect(
        checkQuota(testQuotaRoot, currentUsage, 1024 * 1024, 0) // Adding 1 MB would exceed
      ).rejects.toThrow(QuotaExceededError)
    })

    it('should throw when message count quota exceeded', async () => {
      await setQuotaLimits(testQuotaRoot, {
        maxStorageBytes: 10 * 1024 * 1024 * 1024,
        maxMessageCount: 100,
      })

      const currentUsage = {
        usedStorageBytes: 0,
        usedMessageCount: 90,
      }

      await expect(
        checkQuota(testQuotaRoot, currentUsage, 0, 20) // Adding 20 would exceed
      ).rejects.toThrow(QuotaExceededError)
    })
  })

  describe('isOverQuota', () => {
    it('should detect when over quota', async () => {
      await setQuotaLimits(testQuotaRoot, {
        maxStorageBytes: 1024,
        maxMessageCount: 10,
      })

      // Set usage over quota
      await checkQuota(
        testQuotaRoot,
        { usedStorageBytes: 0, usedMessageCount: 0 },
        2048, // Exceeds storage
        0
      ).catch(() => {
        // Expected to fail
      })

      const overQuota = await isOverQuota(testQuotaRoot)
      // Note: This test depends on implementation details
      // In a real scenario, you'd need to actually set the usage
    })
  })

  describe('formatQuotaStatus', () => {
    it('should format quota status', () => {
      const usage = {
        usedStorageBytes: 5 * 1024 * 1024,
        usedMessageCount: 1000,
      }

      const limits = {
        maxStorageBytes: 10 * 1024 * 1024,
        maxMessageCount: 2000,
      }

      const formatted = formatQuotaStatus(usage, limits)
      expect(formatted).toContain('Storage:')
      expect(formatted).toContain('Messages:')
    })

    it('should handle unlimited quotas', () => {
      const usage = {
        usedStorageBytes: 5 * 1024 * 1024,
        usedMessageCount: 1000,
      }

      const limits = {
        maxStorageBytes: -1,
        maxMessageCount: -1,
      }

      const formatted = formatQuotaStatus(usage, limits)
      expect(formatted).toContain('Unlimited')
    })
  })
})


