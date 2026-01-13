/**
 * Event Bus System
 * 
 * Event bus implementation following james-project EventBus patterns
 * Based on ADR 0037 (Event Bus) and ADR 0038 (Distributed Event Bus)
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/src/adr/0037-eventbus.md
 * @see james-project/src/adr/0038-distributed-eventbus.md
 */

/**
 * Event type
 */
export type EventType = string

/**
 * Event metadata
 */
export interface EventMetadata {
  eventId: string
  timestamp: Date
  source?: string
  correlationId?: string
  [key: string]: unknown
}

/**
 * Base event interface
 */
export interface Event {
  type: EventType
  metadata: EventMetadata
  payload: Record<string, unknown>
}

/**
 * Event listener interface
 * Following james-project MailboxListener patterns
 */
export interface EventListener {
  /**
   * Get event types this listener handles
   */
  getEventTypes(): EventType[]

  /**
   * Handle an event
   * 
   * @param event - Event to handle
   * @returns Promise that resolves when handling is complete
   */
  handle(event: Event): Promise<void>

  /**
   * Get listener group (for distributed execution)
   */
  getGroup?(): string | undefined

  /**
   * Get registration key (for entity-specific listeners)
   */
  getRegistrationKey?(): string | null
}

/**
 * Event bus interface
 * Following james-project EventBus patterns
 */
export interface EventBus {
  /**
   * Publish an event
   * 
   * @param event - Event to publish
   * @returns Promise that resolves when event is published
   */
  publish(event: Event): Promise<void>

  /**
   * Subscribe an event listener
   * 
   * @param listener - Event listener to subscribe
   */
  subscribe(listener: EventListener): void

  /**
   * Unsubscribe an event listener
   * 
   * @param listener - Event listener to unsubscribe
   */
  unsubscribe(listener: EventListener): void

  /**
   * Get all subscribed listeners
   * 
   * @returns Array of subscribed listeners
   */
  getListeners(): EventListener[]
}

/**
 * In-memory event bus implementation
 * Following james-project In-VM EventBus patterns
 * Suitable for single instance deployments
 */
export class InMemoryEventBus implements EventBus {
  private listeners: EventListener[] = []
  private eventQueue: Event[] = []
  private processing = false

  /**
   * Publish an event
   */
  async publish(event: Event): Promise<void> {
    // Add metadata if not present
    if (!event.metadata.eventId) {
      event.metadata.eventId = `event_${Date.now()}_${Math.random().toString(36).substring(7)}`
    }
    if (!event.metadata.timestamp) {
      event.metadata.timestamp = new Date()
    }

    // Add to queue
    this.eventQueue.push(event)

    // Process queue if not already processing
    if (!this.processing) {
      await this.processQueue()
    }
  }

  /**
   * Subscribe an event listener
   */
  subscribe(listener: EventListener): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener)
    }
  }

  /**
   * Unsubscribe an event listener
   */
  unsubscribe(listener: EventListener): void {
    const index = this.listeners.indexOf(listener)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Get all subscribed listeners
   */
  getListeners(): EventListener[] {
    return [...this.listeners]
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    this.processing = true

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()
      if (!event) {
        continue
      }

      // Find matching listeners
      const matchingListeners = this.listeners.filter(listener => {
        const eventTypes = listener.getEventTypes()
        return eventTypes.includes(event.type) || eventTypes.includes('*')
      })

      // Handle event with each matching listener
      const promises = matchingListeners.map(listener => this.handleEvent(listener, event))
      await Promise.allSettled(promises)
    }

    this.processing = false
  }

  /**
   * Handle event with a listener
   */
  private async handleEvent(listener: EventListener, event: Event): Promise<void> {
    try {
      await listener.handle(event)
    } catch (error) {
      // Log error but don't throw (at-least-once delivery)
      console.error(`Error handling event ${event.type} with listener:`, error)
      // TODO: Implement retry logic and DeadLetter queue
    }
  }

  /**
   * Wait for all events to be processed
   * Useful for testing
   */
  async waitForProcessing(): Promise<void> {
    while (this.processing || this.eventQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}

/**
 * Create in-memory event bus
 * 
 * @returns In-memory event bus instance
 */
export function createEventBus(): EventBus {
  return new InMemoryEventBus()
}

/**
 * Global event bus instance
 */
export const globalEventBus = createEventBus()

/**
 * Event builder helper
 */
export class EventBuilder {
  private type: EventType = ''
  private payload: Record<string, unknown> = {}
  private metadata: Partial<EventMetadata> = {}

  /**
   * Set event type
   */
  withType(type: EventType): this {
    this.type = type
    return this
  }

  /**
   * Set event payload
   */
  withPayload(payload: Record<string, unknown>): this {
    this.payload = { ...this.payload, ...payload }
    return this
  }

  /**
   * Set event metadata
   */
  withMetadata(metadata: Partial<EventMetadata>): this {
    this.metadata = { ...this.metadata, ...metadata }
    return this
  }

  /**
   * Build event
   */
  build(): Event {
    return {
      type: this.type,
      metadata: {
        eventId: this.metadata.eventId || `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: this.metadata.timestamp || new Date(),
        ...this.metadata,
      },
      payload: this.payload,
    }
  }
}

/**
 * Create event builder
 * 
 * @returns Event builder instance
 */
export function createEventBuilder(): EventBuilder {
  return new EventBuilder()
}

