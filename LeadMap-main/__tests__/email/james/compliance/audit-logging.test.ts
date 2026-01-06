/**
 * Audit Logging Tests
 * 
 * Comprehensive tests for audit logging utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { AuditLogger, createAuditLogger } from '@/lib/email/james/compliance/audit-logging'

describe('Audit Logger', () => {
  let logger: AuditLogger

  beforeEach(() => {
    logger = createAuditLogger()
  })

  describe('log', () => {
    it('should log audit events', () => {
      logger.log({
        type: 'message_sent',
        userId: 'user-1',
        mailboxId: 'mb-1',
        messageId: 'msg-1',
        action: 'SEND',
        protocol: 'SMTP',
        result: 'success',
      })

      const logs = logger.query({ userId: 'user-1' })
      expect(logs).toHaveLength(1)
      expect(logs[0].type).toBe('message_sent')
    })
  })

  describe('query', () => {
    beforeEach(() => {
      logger.log({
        type: 'message_sent',
        userId: 'user-1',
        mailboxId: 'mb-1',
        messageId: 'msg-1',
        action: 'SEND',
        protocol: 'SMTP',
        result: 'success',
      })

      logger.log({
        type: 'message_received',
        userId: 'user-1',
        mailboxId: 'mb-1',
        messageId: 'msg-2',
        action: 'RECEIVE',
        protocol: 'IMAP',
        result: 'success',
      })

      logger.log({
        type: 'message_deleted',
        userId: 'user-2',
        mailboxId: 'mb-2',
        messageId: 'msg-3',
        action: 'DELETE',
        result: 'success',
      })
    })

    it('should filter by userId', () => {
      const logs = logger.query({ userId: 'user-1' })
      expect(logs).toHaveLength(2)
    })

    it('should filter by type', () => {
      const logs = logger.query({ type: 'message_sent' })
      expect(logs).toHaveLength(1)
      expect(logs[0].type).toBe('message_sent')
    })

    it('should filter by protocol', () => {
      const logs = logger.query({ protocol: 'SMTP' })
      expect(logs).toHaveLength(1)
      expect(logs[0].protocol).toBe('SMTP')
    })

    it('should filter by result', () => {
      const logs = logger.query({ result: 'success' })
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.every(log => log.result === 'success')).toBe(true)
    })

    it('should support pagination', () => {
      const logs = logger.query({ limit: 1, offset: 0 })
      expect(logs).toHaveLength(1)
    })
  })

  describe('getStatistics', () => {
    beforeEach(() => {
      logger.log({
        type: 'message_sent',
        userId: 'user-1',
        action: 'SEND',
        protocol: 'SMTP',
        result: 'success',
      })

      logger.log({
        type: 'message_received',
        userId: 'user-1',
        action: 'RECEIVE',
        protocol: 'IMAP',
        result: 'success',
      })
    })

    it('should get audit statistics', () => {
      const stats = logger.getStatistics('user-1')
      expect(stats.total).toBe(2)
      expect(stats.byType.message_sent).toBe(1)
      expect(stats.byType.message_received).toBe(1)
      expect(stats.byResult.success).toBe(2)
    })
  })

  describe('export', () => {
    it('should export audit logs', () => {
      logger.log({
        type: 'message_sent',
        userId: 'user-1',
        action: 'SEND',
        result: 'success',
      })

      const exported = logger.export()
      const parsed = JSON.parse(exported)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBeGreaterThan(0)
    })
  })
})

