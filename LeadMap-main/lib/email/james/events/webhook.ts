/**
 * Webhook System
 * 
 * Webhook implementation for email events
 * Following james-project event delivery patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project event delivery patterns
 */

import type { Event, EventListener, EventType } from './event-bus'
import { globalLogger } from '../monitoring/logging'
import { globalMetricFactory } from '../monitoring/metrics'

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string
  secret?: string // For signature verification
  timeout?: number // Request timeout in milliseconds (default: 5000)
  retries?: number // Number of retries (default: 3)
  headers?: Record<string, string> // Custom headers
}

/**
 * Webhook subscription
 */
export interface WebhookSubscription {
  id: string
  config: WebhookConfig
  eventTypes: EventType[]
  active: boolean
  createdAt: Date
  lastTriggeredAt?: Date
  failureCount: number
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
  retries: number
  duration: number
}

/**
 * Webhook listener
 * Listens to events and delivers them via HTTP webhooks
 */
export class WebhookListener implements EventListener {
  private subscriptions = new Map<string, WebhookSubscription>()

  constructor() {}

  /**
   * Subscribe a webhook
   * 
   * @param subscription - Webhook subscription
   */
  subscribe(subscription: Omit<WebhookSubscription, 'id' | 'createdAt' | 'failureCount'>): string {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const fullSubscription: WebhookSubscription = {
      id,
      ...subscription,
      createdAt: new Date(),
      failureCount: 0,
    }
    this.subscriptions.set(id, fullSubscription)
    return id
  }

  /**
   * Unsubscribe a webhook
   * 
   * @param id - Webhook subscription ID
   */
  unsubscribe(id: string): void {
    this.subscriptions.delete(id)
  }

  /**
   * Get webhook subscription
   * 
   * @param id - Webhook subscription ID
   * @returns Webhook subscription or undefined
   */
  getSubscription(id: string): WebhookSubscription | undefined {
    return this.subscriptions.get(id)
  }

  /**
   * Get all subscriptions
   * 
   * @returns Array of webhook subscriptions
   */
  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
  }

  /**
   * Get event types this listener handles
   */
  getEventTypes(): EventType[] {
    const eventTypes = new Set<EventType>()
    for (const subscription of this.subscriptions.values()) {
      if (subscription.active) {
        for (const eventType of subscription.eventTypes) {
          eventTypes.add(eventType)
        }
      }
    }
    return Array.from(eventTypes)
  }

  /**
   * Handle an event
   */
  async handle(event: Event): Promise<void> {
    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(
      subscription =>
        subscription.active &&
        (subscription.eventTypes.includes(event.type) || subscription.eventTypes.includes('*'))
    )

    if (matchingSubscriptions.length === 0) {
      return
    }

    // Deliver to each matching webhook
    const promises = matchingSubscriptions.map(subscription =>
      this.deliverWebhook(subscription, event)
    )

    await Promise.allSettled(promises)
  }

  /**
   * Deliver event to webhook
   */
  private async deliverWebhook(subscription: WebhookSubscription, event: Event): Promise<void> {
    const timer = globalMetricFactory.timer('webhook_delivery_duration', {
      webhookId: subscription.id,
    })
    timer.start()

    const maxRetries = subscription.config.retries || 3
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendWebhookRequest(subscription, event)

        timer.stopAndPublish()
        subscription.lastTriggeredAt = new Date()
        subscription.failureCount = 0

        globalLogger.info('Webhook delivered successfully', {
          protocol: 'WEBHOOK',
          action: 'DELIVER',
          webhookId: subscription.id,
          eventType: event.type,
          statusCode: result.statusCode,
        })

        globalMetricFactory.counter('webhook_delivery_success', { webhookId: subscription.id }).increment()
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        subscription.failureCount++

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    timer.stopAndPublish()

    // All retries failed
    globalLogger.error('Webhook delivery failed after retries', lastError, {
      protocol: 'WEBHOOK',
      action: 'DELIVER',
      webhookId: subscription.id,
      eventType: event.type,
      retries: maxRetries,
    })

    globalMetricFactory.counter('webhook_delivery_failure', { webhookId: subscription.id }).increment()

    // Deactivate subscription if too many failures
    if (subscription.failureCount >= 10) {
      subscription.active = false
      globalLogger.warn('Webhook subscription deactivated due to repeated failures', {
        protocol: 'WEBHOOK',
        action: 'DEACTIVATE',
        webhookId: subscription.id,
        failureCount: subscription.failureCount,
      })
    }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhookRequest(
    subscription: WebhookSubscription,
    event: Event
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now()
    const timeout = subscription.config.timeout || 5000

    const body = JSON.stringify({
      event: {
        type: event.type,
        metadata: event.metadata,
        payload: event.payload,
      },
      timestamp: new Date().toISOString(),
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'LeadMap-Email-Webhook/1.0',
      ...subscription.config.headers,
    }

    // Add signature if secret is provided
    if (subscription.config.secret) {
      // TODO: Implement HMAC signature
      // const signature = createHmac('sha256', subscription.config.secret).update(body).digest('hex')
      // headers['X-Webhook-Signature'] = signature
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(subscription.config.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return {
        success: true,
        statusCode: response.status,
        retries: 0,
        duration,
      }
    } catch (error) {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Webhook request timeout after ${timeout}ms`)
      }

      throw error
    }
  }
}

/**
 * Create webhook listener
 * 
 * @returns Webhook listener instance
 */
export function createWebhookListener(): WebhookListener {
  return new WebhookListener()
}

