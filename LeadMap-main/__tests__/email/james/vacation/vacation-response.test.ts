/**
 * Vacation Response Tests
 * 
 * Comprehensive tests for vacation/auto-reply utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { VacationResponseManager, createVacationResponseManager } from '@/lib/email/james/vacation/vacation-response'

describe('Vacation Response Manager', () => {
  let manager: VacationResponseManager

  beforeEach(() => {
    manager = createVacationResponseManager()
  })

  describe('setConfig and getConfig', () => {
    it('should set and get vacation configuration', () => {
      const config = {
        enabled: true,
        message: 'I am on vacation',
        subject: 'Auto-reply',
      }

      manager.setConfig(config)
      expect(manager.getConfig()).toEqual(config)
    })
  })

  describe('isActive', () => {
    it('should return false when disabled', () => {
      manager.setConfig({
        enabled: false,
        message: 'Test',
      })
      expect(manager.isActive()).toBe(false)
    })

    it('should return true when enabled and within date range', () => {
      const now = new Date()
      manager.setConfig({
        enabled: true,
        message: 'Test',
        startDate: new Date(now.getTime() - 86400000), // Yesterday
        endDate: new Date(now.getTime() + 86400000), // Tomorrow
      })
      expect(manager.isActive()).toBe(true)
    })

    it('should return false when before start date', () => {
      const now = new Date()
      manager.setConfig({
        enabled: true,
        message: 'Test',
        startDate: new Date(now.getTime() + 86400000), // Tomorrow
      })
      expect(manager.isActive()).toBe(false)
    })
  })

  describe('shouldSendResponse', () => {
    it('should return true for new sender', () => {
      manager.setConfig({
        enabled: true,
        message: 'Test',
      })
      expect(manager.shouldSendResponse('sender@example.com')).toBe(true)
    })

    it('should return false if already sent recently', () => {
      manager.setConfig({
        enabled: true,
        message: 'Test',
        daysBetweenResponses: 1,
      })
      manager.recordResponse('sender@example.com')
      expect(manager.shouldSendResponse('sender@example.com')).toBe(false)
    })

    it('should respect excludeAddresses', () => {
      manager.setConfig({
        enabled: true,
        message: 'Test',
        excludeAddresses: ['excluded@example.com'],
      })
      expect(manager.shouldSendResponse('excluded@example.com')).toBe(false)
    })
  })

  describe('generateResponse', () => {
    it('should generate vacation response', () => {
      manager.setConfig({
        enabled: true,
        message: 'I am on vacation',
        subject: 'Auto-reply',
      })

      const response = manager.generateResponse({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        messageId: 'msg-123',
      })

      expect(response.to).toBe('sender@example.com')
      expect(response.subject).toBe('Auto-reply')
      expect(response.body).toBe('I am on vacation')
      expect(response.inReplyTo).toBe('msg-123')
    })
  })
})

