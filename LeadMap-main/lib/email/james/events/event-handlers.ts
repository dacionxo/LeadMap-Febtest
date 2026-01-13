/**
 * Email Event Handlers
 * 
 * Event handlers for email events following james-project listener patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project mailbox listener patterns
 */

import type { Event, EventListener, EventType } from './event-bus'
import { EmailEventType } from './email-events'
import { globalLogger } from '../monitoring/logging'
import { globalMetricFactory } from '../monitoring/metrics'

/**
 * Base event handler
 * Following james-project MailboxListener patterns
 */
export abstract class BaseEventHandler implements EventListener {
  abstract getEventTypes(): EventType[]
  abstract handle(event: Event): Promise<void>

  /**
   * Get listener group (for distributed execution)
   * Optional - returns undefined if not implemented
   */
  getGroup?(): string | undefined {
    return undefined
  }

  /**
   * Get registration key (for entity-specific listeners)
   */
  getRegistrationKey?(): string | null {
    return null
  }
}

/**
 * Email analytics handler
 * Tracks email metrics and analytics
 */
export class EmailAnalyticsHandler extends BaseEventHandler {
  getEventTypes(): EventType[] {
    return [
      EmailEventType.MESSAGE_SENT,
      EmailEventType.MESSAGE_DELIVERED,
      EmailEventType.MESSAGE_OPENED,
      EmailEventType.MESSAGE_CLICKED,
      EmailEventType.MESSAGE_BOUNCED,
    ]
  }

  async handle(event: Event): Promise<void> {
    const timer = globalMetricFactory.timer('event_handler_duration', {
      handler: 'EmailAnalyticsHandler',
      eventType: event.type,
    })
    timer.start()

    try {
      // Update metrics based on event type
      switch (event.type) {
        case EmailEventType.MESSAGE_SENT:
          globalMetricFactory.counter('email_sent_total').increment()
          break
        case EmailEventType.MESSAGE_DELIVERED:
          globalMetricFactory.counter('email_delivered_total').increment()
          break
        case EmailEventType.MESSAGE_OPENED:
          globalMetricFactory.counter('email_opened_total').increment()
          break
        case EmailEventType.MESSAGE_CLICKED:
          globalMetricFactory.counter('email_clicked_total').increment()
          break
        case EmailEventType.MESSAGE_BOUNCED:
          globalMetricFactory.counter('email_bounced_total').increment()
          const payload = event.payload as { bounceType?: string }
          if (payload.bounceType) {
            globalMetricFactory
              .counter('email_bounced_by_type', { bounceType: payload.bounceType })
              .increment()
          }
          break
      }

      timer.stopAndPublish()

      globalLogger.debug('Email analytics event processed', {
        protocol: 'EVENT',
        action: 'ANALYTICS',
        eventType: event.type,
      })
    } catch (error) {
      timer.stopAndPublish()
      globalLogger.error('Error processing email analytics event', error instanceof Error ? error : undefined, {
        protocol: 'EVENT',
        action: 'ANALYTICS',
        eventType: event.type,
      })
      throw error
    }
  }
}

/**
 * Email logging handler
 * Logs email events for audit and debugging
 */
export class EmailLoggingHandler extends BaseEventHandler {
  getEventTypes(): EventType[] {
    return ['*'] // Handle all events
  }

  async handle(event: Event): Promise<void> {
    const logLevel = this.getLogLevel(event.type)
    const context = {
      protocol: 'EVENT',
      action: 'LOG',
      eventType: event.type,
      eventId: event.metadata.eventId,
      ...event.payload,
    }

    // Call appropriate logger method based on level
    switch (logLevel) {
      case 'debug':
        globalLogger.debug(`Email event: ${event.type}`, context)
        break
      case 'info':
        globalLogger.info(`Email event: ${event.type}`, context)
        break
      case 'warn':
        globalLogger.warn(`Email event: ${event.type}`, context)
        break
      case 'error':
        globalLogger.error(`Email event: ${event.type}`, undefined, context)
        break
    }
  }

  private getLogLevel(eventType: EventType): 'debug' | 'info' | 'warn' | 'error' {
    if (eventType.includes('bounced') || eventType.includes('failed') || eventType.includes('expired')) {
      return 'warn'
    }
    if (eventType.includes('error') || eventType.includes('spam')) {
      return 'error'
    }
    return 'info'
  }
}

/**
 * Sync event handler
 * Handles sync-related events
 */
export class SyncEventHandler extends BaseEventHandler {
  getEventTypes(): EventType[] {
    return [
      EmailEventType.SYNC_STARTED,
      EmailEventType.SYNC_COMPLETED,
      EmailEventType.SYNC_FAILED,
    ]
  }

  async handle(event: Event): Promise<void> {
    const timer = globalMetricFactory.timer('sync_event_duration', {
      eventType: event.type,
    })
    timer.start()

    try {
      switch (event.type) {
        case EmailEventType.SYNC_STARTED:
          globalMetricFactory.counter('sync_started_total').increment()
          break
        case EmailEventType.SYNC_COMPLETED:
          globalMetricFactory.counter('sync_completed_total').increment()
          const payload = event.payload as { messagesProcessed?: number; duration?: number }
          if (payload.messagesProcessed) {
            globalMetricFactory
              .histogram('sync_messages_processed')
              .observe(payload.messagesProcessed)
          }
          if (payload.duration) {
            globalMetricFactory.histogram('sync_duration_ms').observe(payload.duration)
          }
          break
        case EmailEventType.SYNC_FAILED:
          globalMetricFactory.counter('sync_failed_total').increment()
          break
      }

      timer.stopAndPublish()

      globalLogger.info('Sync event processed', {
        protocol: 'EVENT',
        action: 'SYNC',
        eventType: event.type,
      })
    } catch (error) {
      timer.stopAndPublish()
      globalLogger.error('Error processing sync event', error instanceof Error ? error : undefined, {
        protocol: 'EVENT',
        action: 'SYNC',
        eventType: event.type,
      })
      throw error
    }
  }
}

/**
 * OAuth event handler
 * Handles OAuth-related events
 */
export class OAuthEventHandler extends BaseEventHandler {
  getEventTypes(): EventType[] {
    return [
      EmailEventType.OAUTH_TOKEN_REFRESHED,
      EmailEventType.OAUTH_TOKEN_EXPIRED,
    ]
  }

  async handle(event: Event): Promise<void> {
    try {
      switch (event.type) {
        case EmailEventType.OAUTH_TOKEN_REFRESHED:
          globalMetricFactory.counter('oauth_token_refreshed_total').increment()
          break
        case EmailEventType.OAUTH_TOKEN_EXPIRED:
          globalMetricFactory.counter('oauth_token_expired_total').increment()
          break
      }

      globalLogger.info('OAuth event processed', {
        protocol: 'EVENT',
        action: 'OAUTH',
        eventType: event.type,
      })
    } catch (error) {
      globalLogger.error('Error processing OAuth event', error instanceof Error ? error : undefined, {
        protocol: 'EVENT',
        action: 'OAUTH',
        eventType: event.type,
      })
      throw error
    }
  }
}

/**
 * Create default event handlers
 * 
 * @returns Array of default event handlers
 */
export function createDefaultEventHandlers(): EventListener[] {
  return [
    new EmailAnalyticsHandler(),
    new EmailLoggingHandler(),
    new SyncEventHandler(),
    new OAuthEventHandler(),
  ]
}

