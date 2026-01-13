/**
 * IMAP IDLE Tests
 * 
 * Comprehensive tests for james-project IMAP IDLE support utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  createIdleSession,
  startIdle,
  stopIdle,
  isIdleActive,
  isIdleTimeout,
  needsHeartbeat,
  updateHeartbeat,
  addIdleEvent,
  createMessageAddedEvent,
  createMessageExpungedEvent,
  createFlagsUpdatedEvent,
  formatIdleCommand,
  formatIdleDoneCommand,
  isIdleContinuation,
  isIdleDoneCommand,
  validateIdleSession,
  getIdleSessionStats,
  IdleState,
  IdleEventType,
} from '@/lib/email/james/imap/idle'

describe('IMAP IDLE', () => {
  describe('createIdleSession', () => {
    it('should create IDLE session with default config', () => {
      const session = createIdleSession()
      expect(session.state).toBe(IdleState.ACTIVE)
      expect(session.config.enabled).toBe(true)
      expect(session.events).toHaveLength(0)
    })

    it('should create IDLE session with custom config', () => {
      const session = createIdleSession('mailbox123', {
        heartbeatInterval: 1000,
        timeout: 5000,
      })
      expect(session.mailboxId).toBe('mailbox123')
      expect(session.config.heartbeatInterval).toBe(1000)
      expect(session.config.timeout).toBe(5000)
    })
  })

  describe('startIdle', () => {
    it('should start IDLE mode', () => {
      const session = createIdleSession()
      const updated = startIdle(session)
      expect(updated.state).toBe(IdleState.IDLE)
      expect(updated.startTime).toBeInstanceOf(Date)
    })
  })

  describe('stopIdle', () => {
    it('should stop IDLE mode', () => {
      const session = createIdleSession()
      const started = startIdle(session)
      const stopped = stopIdle(started)
      expect(stopped.state).toBe(IdleState.DONE)
    })
  })

  describe('isIdleActive', () => {
    it('should check if IDLE is active', () => {
      const session = createIdleSession()
      expect(isIdleActive(session)).toBe(false)
      
      const started = startIdle(session)
      expect(isIdleActive(started)).toBe(true)
    })
  })

  describe('isIdleTimeout', () => {
    it('should check if session has timed out', () => {
      const session = createIdleSession(undefined, {
        timeout: 100,
      })
      const started = startIdle(session)
      
      // Wait for timeout
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(isIdleTimeout(started)).toBe(true)
          resolve()
        }, 150)
      })
    })

    it('should return false if no timeout configured', () => {
      const session = createIdleSession(undefined, {
        timeout: undefined,
      })
      expect(isIdleTimeout(session)).toBe(false)
    })
  })

  describe('needsHeartbeat', () => {
    it('should return false if not active', () => {
      const session = createIdleSession()
      expect(needsHeartbeat(session)).toBe(false)
    })

    it('should return true if heartbeat interval elapsed', () => {
      const session = createIdleSession(undefined, {
        heartbeatInterval: 100,
      })
      const started = startIdle(session)
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(needsHeartbeat(started)).toBe(true)
          resolve()
        }, 150)
      })
    })
  })

  describe('updateHeartbeat', () => {
    it('should update heartbeat timestamp', () => {
      const session = createIdleSession()
      const updated = updateHeartbeat(session)
      expect(updated.lastHeartbeat).toBeInstanceOf(Date)
    })
  })

  describe('addIdleEvent', () => {
    it('should add event to session', () => {
      const session = createIdleSession()
      const event = createMessageAddedEvent('mailbox1', 123, 456)
      const updated = addIdleEvent(session, event)
      expect(updated.events).toHaveLength(1)
      expect(updated.events[0]).toBe(event)
    })
  })

  describe('createMessageAddedEvent', () => {
    it('should create message added event', () => {
      const event = createMessageAddedEvent('mailbox1', 123, 456)
      expect(event.type).toBe(IdleEventType.MESSAGE_ADDED)
      expect(event.mailboxId).toBe('mailbox1')
      expect(event.messageId).toBe(123)
      expect(event.uid).toBe(456)
    })
  })

  describe('createMessageExpungedEvent', () => {
    it('should create message expunged event', () => {
      const event = createMessageExpungedEvent('mailbox1', 123, 456)
      expect(event.type).toBe(IdleEventType.MESSAGE_EXPUNGED)
      expect(event.mailboxId).toBe('mailbox1')
      expect(event.messageId).toBe(123)
    })
  })

  describe('createFlagsUpdatedEvent', () => {
    it('should create flags updated event', () => {
      const event = createFlagsUpdatedEvent('mailbox1', 123, ['\\Seen', '\\Flagged'], 456)
      expect(event.type).toBe(IdleEventType.FLAGS_UPDATED)
      expect(event.mailboxId).toBe('mailbox1')
      expect(event.messageId).toBe(123)
      expect(event.flags).toEqual(['\\Seen', '\\Flagged'])
    })
  })

  describe('formatIdleCommand', () => {
    it('should format IDLE command', () => {
      expect(formatIdleCommand()).toBe('IDLE')
    })
  })

  describe('formatIdleDoneCommand', () => {
    it('should format IDLE DONE command', () => {
      expect(formatIdleDoneCommand()).toBe('DONE')
    })
  })

  describe('isIdleContinuation', () => {
    it('should detect IDLE continuation response', () => {
      expect(isIdleContinuation('+ idling')).toBe(true)
      expect(isIdleContinuation('+')).toBe(true)
      expect(isIdleContinuation('OK')).toBe(false)
    })
  })

  describe('isIdleDoneCommand', () => {
    it('should detect DONE command', () => {
      expect(isIdleDoneCommand('DONE')).toBe(true)
      expect(isIdleDoneCommand('done')).toBe(true)
      expect(isIdleDoneCommand('  DONE  ')).toBe(true)
      expect(isIdleDoneCommand('IDLE')).toBe(false)
    })
  })

  describe('validateIdleSession', () => {
    it('should validate enabled session', () => {
      const session = createIdleSession()
      const result = validateIdleSession(session)
      expect(result.valid).toBe(true)
    })

    it('should reject disabled session', () => {
      const session = createIdleSession(undefined, {
        enabled: false,
      })
      const result = validateIdleSession(session)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not enabled')
    })

    it('should reject session with invalid heartbeat interval', () => {
      const session = createIdleSession(undefined, {
        heartbeatInterval: 0,
      })
      const result = validateIdleSession(session)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid heartbeat interval')
    })
  })

  describe('getIdleSessionStats', () => {
    it('should get session statistics', () => {
      const session = createIdleSession()
      const started = startIdle(session)
      const stats = getIdleSessionStats(started)
      
      expect(stats.duration).toBeGreaterThanOrEqual(0)
      expect(stats.eventCount).toBe(0)
      expect(stats.state).toBe(IdleState.IDLE)
    })
  })
})

