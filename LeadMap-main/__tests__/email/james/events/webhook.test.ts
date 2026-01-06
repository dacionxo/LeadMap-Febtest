/**
 * Webhook Tests
 * 
 * Comprehensive tests for webhook system
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { WebhookListener, createWebhookListener } from '@/lib/email/james/events/webhook'
import { createEventBuilder, EmailEventType } from '@/lib/email/james/events/email-events'
import { createEventBus } from '@/lib/email/james/events/event-bus'

describe('Webhook Listener', () => {
  let webhookListener: WebhookListener

  beforeEach(() => {
    webhookListener = createWebhookListener()
  })

  describe('subscribe', () => {
    it('should subscribe webhooks', () => {
      const id = webhookListener.subscribe({
        config: {
          url: 'https://example.com/webhook',
        },
        eventTypes: [EmailEventType.MESSAGE_SENT],
        active: true,
      })

      expect(id).toBeDefined()
      const subscription = webhookListener.getSubscription(id)
      expect(subscription).toBeDefined()
      expect(subscription).not.toBeUndefined()
      if (subscription) {
        expect(subscription.config.url).toBe('https://example.com/webhook')
      }
    })
  })

  describe('getEventTypes', () => {
    it('should return event types from active subscriptions', () => {
      webhookListener.subscribe({
        config: {
          url: 'https://example.com/webhook',
        },
        eventTypes: [EmailEventType.MESSAGE_SENT, EmailEventType.MESSAGE_DELIVERED],
        active: true,
      })

      const eventTypes = webhookListener.getEventTypes()
      expect(eventTypes).toContain(EmailEventType.MESSAGE_SENT)
      expect(eventTypes).toContain(EmailEventType.MESSAGE_DELIVERED)
    })

    it('should not return event types from inactive subscriptions', () => {
      const id = webhookListener.subscribe({
        config: {
          url: 'https://example.com/webhook',
        },
        eventTypes: [EmailEventType.MESSAGE_SENT],
        active: true,
      })

      const subscription = webhookListener.getSubscription(id)
      expect(subscription).toBeDefined()
      if (subscription) {
        subscription.active = false
      }

      const eventTypes = webhookListener.getEventTypes()
      expect(eventTypes).not.toContain(EmailEventType.MESSAGE_SENT)
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe webhooks', () => {
      const id = webhookListener.subscribe({
        config: {
          url: 'https://example.com/webhook',
        },
        eventTypes: [EmailEventType.MESSAGE_SENT],
        active: true,
      })

      webhookListener.unsubscribe(id)
      expect(webhookListener.getSubscription(id)).toBeUndefined()
    })
  })
})

