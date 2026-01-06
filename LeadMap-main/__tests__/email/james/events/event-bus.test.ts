/**
 * Event Bus Tests
 * 
 * Comprehensive tests for james-project event bus utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  InMemoryEventBus,
  createEventBus,
  createEventBuilder,
  type EventListener,
} from '@/lib/email/james/events/event-bus'

describe('Event Bus', () => {
  let eventBus: InMemoryEventBus

  beforeEach(() => {
    eventBus = createEventBus() as InMemoryEventBus
  })

  describe('publish', () => {
    it('should publish events', async () => {
      const event = createEventBuilder()
        .withType('test.event')
        .withPayload({ test: 'value' })
        .build()

      await eventBus.publish(event)
      // Event should be processed asynchronously
      expect(event.metadata.eventId).toBeDefined()
      expect(event.metadata.timestamp).toBeDefined()
    })

    it('should add metadata if not present', async () => {
      const event = {
        type: 'test.event',
        metadata: {},
        payload: {},
      }

      await eventBus.publish(event)
      expect(event.metadata.eventId).toBeDefined()
      expect(event.metadata.timestamp).toBeDefined()
    })
  })

  describe('subscribe and unsubscribe', () => {
    it('should subscribe listeners', () => {
      const listener: EventListener = {
        getEventTypes: () => ['test.event'],
        handle: async () => {},
      }

      eventBus.subscribe(listener)
      expect(eventBus.getListeners()).toContain(listener)
    })

    it('should unsubscribe listeners', () => {
      const listener: EventListener = {
        getEventTypes: () => ['test.event'],
        handle: async () => {},
      }

      eventBus.subscribe(listener)
      eventBus.unsubscribe(listener)
      expect(eventBus.getListeners()).not.toContain(listener)
    })
  })

  describe('event handling', () => {
    it('should call matching listeners', async () => {
      let handled = false
      const listener: EventListener = {
        getEventTypes: () => ['test.event'],
        handle: async () => {
          handled = true
        },
      }

      eventBus.subscribe(listener)

      const event = createEventBuilder().withType('test.event').build()
      await eventBus.publish(event)

      // Wait for async processing with retries
      for (let i = 0; i < 10 && !handled; i++) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      expect(handled).toBe(true)
    }, 10000)

    it('should not call non-matching listeners', async () => {
      let handled = false
      const listener: EventListener = {
        getEventTypes: () => ['other.event'],
        handle: async () => {
          handled = true
        },
      }

      eventBus.subscribe(listener)

      const event = createEventBuilder().withType('test.event').build()
      await eventBus.publish(event)

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(handled).toBe(false)
    })

    it('should call wildcard listeners', async () => {
      let handled = false
      const listener: EventListener = {
        getEventTypes: () => ['*'],
        handle: async () => {
          handled = true
        },
      }

      eventBus.subscribe(listener)

      const event = createEventBuilder().withType('test.event').build()
      await eventBus.publish(event)

      // Wait for async processing with retries
      for (let i = 0; i < 10 && !handled; i++) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      expect(handled).toBe(true)
    }, 10000)
  })
})

