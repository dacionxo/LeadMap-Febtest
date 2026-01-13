/**
 * DSN Handling Tests
 * 
 * Comprehensive tests for DSN handling utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { DSNHandler, createDSNHandler } from '@/lib/email/james/delivery/dsn-handling'

describe('DSN Handler', () => {
  let handler: DSNHandler

  beforeEach(() => {
    handler = createDSNHandler()
  })

  describe('isDSN', () => {
    it('should identify DSN messages', () => {
      const headers = {
        'content-type': 'multipart/report; report-type=delivery-status',
      }

      expect(handler.isDSN(headers)).toBe(true)
    })

    it('should not identify non-DSN messages', () => {
      const headers = {
        'content-type': 'text/plain',
      }

      expect(handler.isDSN(headers)).toBe(false)
    })
  })

  describe('process', () => {
    it('should parse DSN notification', () => {
      const headers = {
        'content-type': 'multipart/report; report-type=delivery-status',
        'final-recipient': 'rfc822;user@example.com',
        'action': 'failed',
        'status': '5.1.1',
      }

      const body = 'DSN body content'

      const dsn = handler.process(headers, body)
      expect(dsn).toBeDefined()
      expect(dsn?.finalRecipient).toBe('user@example.com')
      expect(dsn?.action).toBe('failed')
      expect(dsn?.status.class).toBe('5')
    })

    it('should return null for non-DSN messages', () => {
      const headers = {
        'content-type': 'text/plain',
      }

      const dsn = handler.process(headers, 'body')
      expect(dsn).toBeNull()
    })
  })

  describe('classifySeverity', () => {
    it('should classify permanent failure', () => {
      const dsn = {
        messageId: 'dsn-1',
        finalRecipient: 'user@example.com',
        action: 'failed' as const,
        status: {
          class: '5' as const,
          subject: '1',
          detail: '1',
        },
        receivedAt: new Date(),
      }

      expect(handler.classifySeverity(dsn)).toBe('permanent')
    })

    it('should classify temporary failure', () => {
      const dsn = {
        messageId: 'dsn-1',
        finalRecipient: 'user@example.com',
        action: 'delayed' as const,
        status: {
          class: '4' as const,
          subject: '2',
          detail: '0',
        },
        receivedAt: new Date(),
      }

      expect(handler.classifySeverity(dsn)).toBe('temporary')
    })
  })
})

