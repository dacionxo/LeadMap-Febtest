/**
 * Event Handler Tests
 * 
 * Comprehensive tests for email event handlers
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  EmailAnalyticsHandler,
  EmailLoggingHandler,
  SyncEventHandler,
  OAuthEventHandler,
} from '@/lib/email/james/events/event-handlers'
import { EmailEventType, createMessageSentEvent } from '@/lib/email/james/events/email-events'

describe('Event Handlers', () => {
  describe('EmailAnalyticsHandler', () => {
    it('should handle message sent events', async () => {
      const handler = new EmailAnalyticsHandler()
      const event = createMessageSentEvent({
        messageId: 'msg-123',
        mailboxId: 'mb-123',
        userId: 'user-123',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        provider: 'gmail',
      })

      await expect(handler.handle(event)).resolves.not.toThrow()
    })

    it('should return correct event types', () => {
      const handler = new EmailAnalyticsHandler()
      const eventTypes = handler.getEventTypes()

      expect(eventTypes).toContain(EmailEventType.MESSAGE_SENT)
      expect(eventTypes).toContain(EmailEventType.MESSAGE_DELIVERED)
      expect(eventTypes).toContain(EmailEventType.MESSAGE_OPENED)
      expect(eventTypes).toContain(EmailEventType.MESSAGE_CLICKED)
      expect(eventTypes).toContain(EmailEventType.MESSAGE_BOUNCED)
    })
  })

  describe('EmailLoggingHandler', () => {
    it('should handle all events', async () => {
      const handler = new EmailLoggingHandler()
      const event = createMessageSentEvent({
        messageId: 'msg-123',
        mailboxId: 'mb-123',
        userId: 'user-123',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        provider: 'gmail',
      })

      await expect(handler.handle(event)).resolves.not.toThrow()
    })

    it('should return wildcard event type', () => {
      const handler = new EmailLoggingHandler()
      const eventTypes = handler.getEventTypes()

      expect(eventTypes).toContain('*')
    })
  })

  describe('SyncEventHandler', () => {
    it('should handle sync events', async () => {
      const handler = new SyncEventHandler()
      const event = {
        type: EmailEventType.SYNC_COMPLETED,
        metadata: {
          eventId: 'event-123',
          timestamp: new Date(),
        },
        payload: {
          mailboxId: 'mb-123',
          messagesProcessed: 10,
          duration: 1000,
        },
      }

      await expect(handler.handle(event)).resolves.not.toThrow()
    })

    it('should return sync event types', () => {
      const handler = new SyncEventHandler()
      const eventTypes = handler.getEventTypes()

      expect(eventTypes).toContain(EmailEventType.SYNC_STARTED)
      expect(eventTypes).toContain(EmailEventType.SYNC_COMPLETED)
      expect(eventTypes).toContain(EmailEventType.SYNC_FAILED)
    })
  })

  describe('OAuthEventHandler', () => {
    it('should handle OAuth events', async () => {
      const handler = new OAuthEventHandler()
      const event = {
        type: EmailEventType.OAUTH_TOKEN_REFRESHED,
        metadata: {
          eventId: 'event-123',
          timestamp: new Date(),
        },
        payload: {
          mailboxId: 'mb-123',
          userId: 'user-123',
          provider: 'gmail',
        },
      }

      await expect(handler.handle(event)).resolves.not.toThrow()
    })

    it('should return OAuth event types', () => {
      const handler = new OAuthEventHandler()
      const eventTypes = handler.getEventTypes()

      expect(eventTypes).toContain(EmailEventType.OAUTH_TOKEN_REFRESHED)
      expect(eventTypes).toContain(EmailEventType.OAUTH_TOKEN_EXPIRED)
    })
  })
})

