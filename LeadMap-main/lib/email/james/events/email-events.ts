/**
 * Email Event Types and Definitions
 * 
 * Email event types following james-project mailbox event patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project mailbox event system
 */

import type { Event, EventType } from './event-bus'

/**
 * Email event types
 */
export enum EmailEventType {
  // Message events
  MESSAGE_SENT = 'email.message.sent',
  MESSAGE_DELIVERED = 'email.message.delivered',
  MESSAGE_OPENED = 'email.message.opened',
  MESSAGE_CLICKED = 'email.message.clicked',
  MESSAGE_BOUNCED = 'email.message.bounced',
  MESSAGE_SPAM = 'email.message.spam',
  MESSAGE_UNSUBSCRIBED = 'email.message.unsubscribed',
  
  // Mailbox events
  MAILBOX_CREATED = 'email.mailbox.created',
  MAILBOX_UPDATED = 'email.mailbox.updated',
  MAILBOX_DELETED = 'email.mailbox.deleted',
  
  // Thread events
  THREAD_CREATED = 'email.thread.created',
  THREAD_UPDATED = 'email.thread.updated',
  
  // Sync events
  SYNC_STARTED = 'email.sync.started',
  SYNC_COMPLETED = 'email.sync.completed',
  SYNC_FAILED = 'email.sync.failed',
  
  // OAuth events
  OAUTH_TOKEN_REFRESHED = 'email.oauth.token_refreshed',
  OAUTH_TOKEN_EXPIRED = 'email.oauth.token_expired',
}

/**
 * Message sent event payload
 */
export interface MessageSentEventPayload {
  messageId: string
  mailboxId: string
  userId: string
  from: string
  to: string[]
  subject: string
  provider: string
  providerMessageId?: string
}

/**
 * Message delivered event payload
 */
export interface MessageDeliveredEventPayload {
  messageId: string
  mailboxId: string
  recipient: string
  provider: string
  deliveredAt: Date
}

/**
 * Message opened event payload
 */
export interface MessageOpenedEventPayload {
  messageId: string
  mailboxId: string
  recipient: string
  openedAt: Date
  userAgent?: string
  ipAddress?: string
}

/**
 * Message clicked event payload
 */
export interface MessageClickedEventPayload {
  messageId: string
  mailboxId: string
  recipient: string
  url: string
  clickedAt: Date
  userAgent?: string
  ipAddress?: string
}

/**
 * Message bounced event payload
 */
export interface MessageBouncedEventPayload {
  messageId: string
  mailboxId: string
  recipient: string
  bounceType: 'hard' | 'soft' | 'transient'
  bounceReason: string
  bouncedAt: Date
}

/**
 * Message spam event payload
 */
export interface MessageSpamEventPayload {
  messageId: string
  mailboxId: string
  from: string
  spamScore?: number
  detectedAt: Date
}

/**
 * Sync completed event payload
 */
export interface SyncCompletedEventPayload {
  mailboxId: string
  userId: string
  provider: string
  messagesProcessed: number
  threadsCreated: number
  duration: number
  completedAt: Date
}

/**
 * OAuth token refreshed event payload
 */
export interface OAuthTokenRefreshedEventPayload {
  mailboxId: string
  userId: string
  provider: string
  refreshedAt: Date
}

/**
 * Create message sent event
 */
export function createMessageSentEvent(payload: MessageSentEventPayload): Event {
  return {
    type: EmailEventType.MESSAGE_SENT,
    metadata: {
      eventId: `msg_sent_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

/**
 * Create message delivered event
 */
export function createMessageDeliveredEvent(payload: MessageDeliveredEventPayload): Event {
  return {
    type: EmailEventType.MESSAGE_DELIVERED,
    metadata: {
      eventId: `msg_delivered_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

/**
 * Create message opened event
 */
export function createMessageOpenedEvent(payload: MessageOpenedEventPayload): Event {
  return {
    type: EmailEventType.MESSAGE_OPENED,
    metadata: {
      eventId: `msg_opened_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

/**
 * Create message clicked event
 */
export function createMessageClickedEvent(payload: MessageClickedEventPayload): Event {
  return {
    type: EmailEventType.MESSAGE_CLICKED,
    metadata: {
      eventId: `msg_clicked_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

/**
 * Create message bounced event
 */
export function createMessageBouncedEvent(payload: MessageBouncedEventPayload): Event {
  return {
    type: EmailEventType.MESSAGE_BOUNCED,
    metadata: {
      eventId: `msg_bounced_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

/**
 * Create sync completed event
 */
export function createSyncCompletedEvent(payload: SyncCompletedEventPayload): Event {
  return {
    type: EmailEventType.SYNC_COMPLETED,
    metadata: {
      eventId: `sync_completed_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

/**
 * Create OAuth token refreshed event
 */
export function createOAuthTokenRefreshedEvent(payload: OAuthTokenRefreshedEventPayload): Event {
  return {
    type: EmailEventType.OAUTH_TOKEN_REFRESHED,
    metadata: {
      eventId: `oauth_refreshed_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      source: 'email-service',
    },
    payload: payload as unknown as Record<string, unknown>,
  }
}

