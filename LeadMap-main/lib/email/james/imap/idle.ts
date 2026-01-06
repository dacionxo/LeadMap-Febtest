/**
 * IMAP IDLE Support Utilities
 * 
 * IMAP IDLE command patterns following james-project implementation
 * Based on IdleProcessor for push notifications and real-time sync
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/IdleProcessor.java
 */

/**
 * IDLE configuration
 */
export interface IdleConfig {
  enabled: boolean
  heartbeatInterval: number // Milliseconds
  timeout?: number // Maximum idle time in milliseconds
}

/**
 * Default IDLE configuration
 */
export const DEFAULT_IDLE_CONFIG: IdleConfig = {
  enabled: true,
  heartbeatInterval: 29 * 60 * 1000, // 29 minutes (RFC 2177 recommends < 30 minutes)
  timeout: 30 * 60 * 1000, // 30 minutes
}

/**
 * IDLE event types
 */
export enum IdleEventType {
  MESSAGE_ADDED = 'MESSAGE_ADDED',
  MESSAGE_EXPUNGED = 'MESSAGE_EXPUNGED',
  FLAGS_UPDATED = 'FLAGS_UPDATED',
  MAILBOX_UPDATED = 'MAILBOX_UPDATED',
}

/**
 * IDLE event
 */
export interface IdleEvent {
  type: IdleEventType
  mailboxId?: string
  messageId?: number
  uid?: number
  flags?: string[]
  timestamp: Date
}

/**
 * IDLE state
 */
export enum IdleState {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

/**
 * IDLE session
 */
export interface IdleSession {
  state: IdleState
  mailboxId?: string
  startTime: Date
  lastHeartbeat?: Date
  events: IdleEvent[]
  config: IdleConfig
}

/**
 * Create IDLE session
 * 
 * @param mailboxId - Mailbox ID (optional)
 * @param config - IDLE configuration (optional)
 * @returns IDLE session
 */
export function createIdleSession(mailboxId?: string, config?: Partial<IdleConfig>): IdleSession {
  return {
    state: IdleState.ACTIVE,
    mailboxId,
    startTime: new Date(),
    events: [],
    config: { ...DEFAULT_IDLE_CONFIG, ...config },
  }
}

/**
 * Start IDLE mode
 * 
 * @param session - IDLE session
 * @returns Updated session
 */
export function startIdle(session: IdleSession): IdleSession {
  return {
    ...session,
    state: IdleState.IDLE,
    startTime: new Date(),
  }
}

/**
 * Stop IDLE mode
 * 
 * @param session - IDLE session
 * @returns Updated session
 */
export function stopIdle(session: IdleSession): IdleSession {
  return {
    ...session,
    state: IdleState.DONE,
  }
}

/**
 * Check if IDLE session is active
 * 
 * @param session - IDLE session
 * @returns true if IDLE is active
 */
export function isIdleActive(session: IdleSession): boolean {
  return session.state === IdleState.IDLE
}

/**
 * Check if IDLE session has timed out
 * 
 * @param session - IDLE session
 * @returns true if session has timed out
 */
export function isIdleTimeout(session: IdleSession): boolean {
  if (!session.config.timeout) {
    return false
  }
  
  const elapsed = Date.now() - session.startTime.getTime()
  return elapsed >= session.config.timeout
}

/**
 * Check if heartbeat is needed
 * 
 * Following james-project IdleProcessor heartbeat pattern
 * Heartbeats are sent to prevent connection timeout
 * 
 * @param session - IDLE session
 * @returns true if heartbeat is needed
 */
export function needsHeartbeat(session: IdleSession): boolean {
  if (!isIdleActive(session)) {
    return false
  }
  
  if (!session.lastHeartbeat) {
    // First heartbeat after interval
    const elapsed = Date.now() - session.startTime.getTime()
    return elapsed >= session.config.heartbeatInterval
  }
  
  // Subsequent heartbeats
  const elapsed = Date.now() - session.lastHeartbeat.getTime()
  return elapsed >= session.config.heartbeatInterval
}

/**
 * Update heartbeat timestamp
 * 
 * @param session - IDLE session
 * @returns Updated session
 */
export function updateHeartbeat(session: IdleSession): IdleSession {
  return {
    ...session,
    lastHeartbeat: new Date(),
  }
}

/**
 * Add IDLE event
 * 
 * @param session - IDLE session
 * @param event - IDLE event
 * @returns Updated session
 */
export function addIdleEvent(session: IdleSession, event: IdleEvent): IdleSession {
  return {
    ...session,
    events: [...session.events, event],
  }
}

/**
 * Create message added event
 * 
 * @param mailboxId - Mailbox ID
 * @param messageId - Message ID
 * @param uid - Message UID (optional)
 * @returns IDLE event
 */
export function createMessageAddedEvent(
  mailboxId: string,
  messageId: number,
  uid?: number
): IdleEvent {
  return {
    type: IdleEventType.MESSAGE_ADDED,
    mailboxId,
    messageId,
    uid,
    timestamp: new Date(),
  }
}

/**
 * Create message expunged event
 * 
 * @param mailboxId - Mailbox ID
 * @param messageId - Message ID
 * @param uid - Message UID (optional)
 * @returns IDLE event
 */
export function createMessageExpungedEvent(
  mailboxId: string,
  messageId: number,
  uid?: number
): IdleEvent {
  return {
    type: IdleEventType.MESSAGE_EXPUNGED,
    mailboxId,
    messageId,
    uid,
    timestamp: new Date(),
  }
}

/**
 * Create flags updated event
 * 
 * @param mailboxId - Mailbox ID
 * @param messageId - Message ID
 * @param flags - Updated flags
 * @param uid - Message UID (optional)
 * @returns IDLE event
 */
export function createFlagsUpdatedEvent(
  mailboxId: string,
  messageId: number,
  flags: string[],
  uid?: number
): IdleEvent {
  return {
    type: IdleEventType.FLAGS_UPDATED,
    mailboxId,
    messageId,
    uid,
    flags,
    timestamp: new Date(),
  }
}

/**
 * Format IDLE command
 * 
 * @returns IMAP IDLE command string
 */
export function formatIdleCommand(): string {
  return 'IDLE'
}

/**
 * Format IDLE DONE command
 * 
 * @returns IMAP IDLE DONE command string
 */
export function formatIdleDoneCommand(): string {
  return 'DONE'
}

/**
 * Parse IDLE continuation response
 * 
 * IDLE sends continuation response "+ idling" and waits for "DONE"
 * 
 * @param response - Server response
 * @returns true if response indicates IDLE continuation
 */
export function isIdleContinuation(response: string): boolean {
  const upper = response.toUpperCase().trim()
  return upper.includes('IDLING') || upper.startsWith('+')
}

/**
 * Parse IDLE DONE command
 * 
 * @param command - Client command
 * @returns true if command is DONE
 */
export function isIdleDoneCommand(command: string): boolean {
  return command.trim().toUpperCase() === 'DONE'
}

/**
 * Validate IDLE session
 * 
 * @param session - IDLE session to validate
 * @returns Validation result
 */
export function validateIdleSession(session: IdleSession): {
  valid: boolean
  error?: string
} {
  if (!session.config.enabled) {
    return {
      valid: false,
      error: 'IDLE is not enabled',
    }
  }
  
  if (isIdleTimeout(session)) {
    return {
      valid: false,
      error: 'IDLE session has timed out',
    }
  }
  
  if (session.config.heartbeatInterval <= 0) {
    return {
      valid: false,
      error: 'Invalid heartbeat interval',
    }
  }
  
  return { valid: true }
}

/**
 * Get IDLE session statistics
 * 
 * @param session - IDLE session
 * @returns Session statistics
 */
export function getIdleSessionStats(session: IdleSession): {
  duration: number // Milliseconds
  eventCount: number
  heartbeatCount: number
  state: IdleState
} {
  const duration = Date.now() - session.startTime.getTime()
  const heartbeatCount = session.lastHeartbeat ? 
    Math.floor((Date.now() - session.startTime.getTime()) / session.config.heartbeatInterval) : 0
  
  return {
    duration,
    eventCount: session.events.length,
    heartbeatCount,
    state: session.state,
  }
}


