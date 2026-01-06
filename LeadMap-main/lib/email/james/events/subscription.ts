/**
 * Event Subscription System
 * 
 * Real-time event subscription system following james-project patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project JMAP push and event subscription patterns
 */

import type { Event, EventType, EventListener } from './event-bus'

/**
 * Subscription filter
 */
export interface SubscriptionFilter {
  eventTypes?: EventType[]
  metadata?: Record<string, unknown>
  payload?: Record<string, unknown>
}

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string
  filter: SubscriptionFilter
  callback: (event: Event) => void | Promise<void>
  active: boolean
  createdAt: Date
}

/**
 * Subscription manager
 * Manages real-time event subscriptions
 */
export class SubscriptionManager {
  private subscriptions = new Map<string, EventSubscription>()
  private listener: EventListener | null = null

  constructor(private eventBus: { subscribe: (listener: EventListener) => void; unsubscribe: (listener: EventListener) => void }) {
    this.setupListener()
  }

  /**
   * Subscribe to events
   * 
   * @param filter - Subscription filter
   * @param callback - Callback function
   * @returns Subscription ID
   */
  subscribe(filter: SubscriptionFilter, callback: (event: Event) => void | Promise<void>): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const subscription: EventSubscription = {
      id,
      filter,
      callback,
      active: true,
      createdAt: new Date(),
    }
    this.subscriptions.set(id, subscription)
    return id
  }

  /**
   * Unsubscribe from events
   * 
   * @param id - Subscription ID
   */
  unsubscribe(id: string): void {
    this.subscriptions.delete(id)
  }

  /**
   * Get subscription
   * 
   * @param id - Subscription ID
   * @returns Subscription or undefined
   */
  getSubscription(id: string): EventSubscription | undefined {
    return this.subscriptions.get(id)
  }

  /**
   * Get all subscriptions
   * 
   * @returns Array of subscriptions
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values())
  }

  /**
   * Setup event listener
   */
  private setupListener(): void {
    this.listener = {
      getEventTypes: () => {
        const eventTypes = new Set<EventType>()
        for (const subscription of Array.from(this.subscriptions.values())) {
          if (subscription.active && subscription.filter.eventTypes) {
            for (const eventType of subscription.filter.eventTypes) {
              eventTypes.add(eventType)
            }
          }
        }
        return Array.from(eventTypes)
      },
      handle: async (event: Event) => {
        // Find matching subscriptions
        const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(
          subscription => subscription.active && this.matchesFilter(event, subscription.filter)
        )

        // Call callbacks
        for (const subscription of matchingSubscriptions) {
          try {
            await Promise.resolve(subscription.callback(event))
          } catch (error) {
            console.error(`Error in subscription callback ${subscription.id}:`, error)
          }
        }
      },
    }

    this.eventBus.subscribe(this.listener)
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: Event, filter: SubscriptionFilter): boolean {
    // Check event types
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      if (!filter.eventTypes.includes(event.type) && !filter.eventTypes.includes('*')) {
        return false
      }
    }

    // Check metadata
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (event.metadata[key] !== value) {
          return false
        }
      }
    }

    // Check payload
    if (filter.payload) {
      for (const [key, value] of Object.entries(filter.payload)) {
        if (event.payload[key] !== value) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.listener) {
      this.eventBus.unsubscribe(this.listener)
    }
    this.subscriptions.clear()
  }
}

/**
 * Create subscription manager
 * 
 * @param eventBus - Event bus instance
 * @returns Subscription manager instance
 */
export function createSubscriptionManager(eventBus: {
  subscribe: (listener: EventListener) => void
  unsubscribe: (listener: EventListener) => void
}): SubscriptionManager {
  return new SubscriptionManager(eventBus)
}

