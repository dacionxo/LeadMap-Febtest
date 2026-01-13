/**
 * Email Tracking Tests
 * 
 * Comprehensive tests for email tracking utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailTrackingManager, createEmailTrackingManager } from '@/lib/email/james/tracking/email-tracking'

describe('Email Tracking Manager', () => {
  let manager: EmailTrackingManager

  beforeEach(() => {
    manager = createEmailTrackingManager()
  })

  describe('recordEvent', () => {
    it('should record tracking events', () => {
      manager.recordEvent({
        eventId: 'event-1',
        messageId: 'msg-1',
        recipient: 'user@example.com',
        eventType: 'sent',
        timestamp: new Date(),
      })

      const events = manager.getEvents('msg-1')
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('sent')
    })
  })

  describe('getStatistics', () => {
    it('should calculate tracking statistics', () => {
      manager.recordEvent({
        eventId: 'event-1',
        messageId: 'msg-1',
        recipient: 'user@example.com',
        eventType: 'sent',
        timestamp: new Date(),
      })

      manager.recordEvent({
        eventId: 'event-2',
        messageId: 'msg-1',
        recipient: 'user@example.com',
        eventType: 'delivered',
        timestamp: new Date(),
      })

      manager.recordEvent({
        eventId: 'event-3',
        messageId: 'msg-1',
        recipient: 'user@example.com',
        eventType: 'opened',
        timestamp: new Date(),
      })

      const stats = manager.getStatistics('msg-1')
      expect(stats.sent).toBe(1)
      expect(stats.delivered).toBe(1)
      expect(stats.opened).toBe(1)
      expect(stats.openRate).toBe(100)
    })
  })

  describe('getRecipientProfile', () => {
    it('should get recipient engagement profile', () => {
      manager.recordEvent({
        eventId: 'event-1',
        messageId: 'msg-1',
        recipient: 'user@example.com',
        eventType: 'sent',
        timestamp: new Date(),
      })

      manager.recordEvent({
        eventId: 'event-2',
        messageId: 'msg-1',
        recipient: 'user@example.com',
        eventType: 'opened',
        timestamp: new Date(),
      })

      const profile = manager.getRecipientProfile('user@example.com')
      expect(profile.totalSent).toBe(1)
      expect(profile.totalOpened).toBe(1)
      expect(profile.openRate).toBe(100)
    })
  })

  describe('generateTrackingPixel', () => {
    it('should generate tracking pixel URL', () => {
      const url = manager.generateTrackingPixel('msg-1', 'user@example.com')
      expect(url).toContain('messageId=msg-1')
      expect(url).toContain('recipient=user%40example.com')
    })
  })

  describe('generateTrackingLink', () => {
    it('should generate tracking link URL', () => {
      const url = manager.generateTrackingLink('msg-1', 'user@example.com', 'https://example.com')
      expect(url).toContain('messageId=msg-1')
      expect(url).toContain('url=https%3A%2F%2Fexample.com')
    })
  })
})

