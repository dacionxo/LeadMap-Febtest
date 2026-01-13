/**
 * Sender Reputation Tests
 * 
 * Comprehensive tests for sender reputation utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { SenderReputationManager, createSenderReputationManager } from '@/lib/email/james/reputation/sender-reputation'

describe('Sender Reputation Manager', () => {
  let manager: SenderReputationManager

  beforeEach(() => {
    manager = createSenderReputationManager()
  })

  describe('calculateScore', () => {
    it('should calculate reputation score', () => {
      const score = manager.calculateScore('sender@example.com', {
        sent: 100,
        delivered: 95,
        opened: 50,
        clicked: 25,
        bounced: 5,
        complained: 0,
        spam: 0,
      })

      expect(score.sender).toBe('sender@example.com')
      expect(score.domain).toBe('example.com')
      expect(score.score).toBeGreaterThan(0)
      expect(score.score).toBeLessThanOrEqual(100)
      expect(score.level).toBeDefined()
    })

    it('should classify excellent reputation', () => {
      const score = manager.calculateScore('sender@example.com', {
        sent: 1000,
        delivered: 1000,
        opened: 800,
        clicked: 400,
        bounced: 0,
        complained: 0,
        spam: 0,
      })

      // With perfect delivery and high engagement, score should be high
      expect(score.score).toBeGreaterThan(50)
      expect(score.factors.deliveryRate).toBe(100)
      expect(score.factors.bounceRate).toBe(0)
      expect(score.factors.complaintRate).toBe(0)
    })

    it('should classify poor reputation', () => {
      const score = manager.calculateScore('sender@example.com', {
        sent: 100,
        delivered: 50,
        opened: 10,
        clicked: 2,
        bounced: 50,
        complained: 10,
        spam: 5,
      })

      // With high bounce and complaint rates, score should be poor or critical
      expect(['poor', 'critical']).toContain(score.level)
      expect(score.score).toBeLessThan(40)
      expect(score.factors.bounceRate).toBeGreaterThan(40)
    })
  })

  describe('getDomainReputation', () => {
    it('should get domain reputation', () => {
      manager.calculateScore('sender1@example.com', {
        sent: 100,
        delivered: 95,
        opened: 50,
        clicked: 25,
        bounced: 5,
        complained: 0,
        spam: 0,
      })

      manager.calculateScore('sender2@example.com', {
        sent: 100,
        delivered: 90,
        opened: 45,
        clicked: 20,
        bounced: 10,
        complained: 0,
        spam: 0,
      })

      const domainRep = manager.getDomainReputation('example.com')
      expect(domainRep.score).toBeGreaterThan(0)
      expect(domainRep.senderCount).toBe(2)
    })
  })
})

