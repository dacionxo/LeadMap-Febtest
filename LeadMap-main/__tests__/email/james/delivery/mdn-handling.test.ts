/**
 * MDN Handling Tests
 * 
 * Comprehensive tests for MDN handling utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { MDNHandler, createMDNHandler } from '@/lib/email/james/delivery/mdn-handling'

describe('MDN Handler', () => {
  let handler: MDNHandler

  beforeEach(() => {
    handler = createMDNHandler()
  })

  describe('isMDN', () => {
    it('should identify MDN messages', () => {
      const headers = {
        'content-type': 'multipart/report; report-type=disposition-notification',
      }

      expect(handler.isMDN(headers)).toBe(true)
    })

    it('should not identify non-MDN messages', () => {
      const headers = {
        'content-type': 'text/plain',
      }

      expect(handler.isMDN(headers)).toBe(false)
    })
  })

  describe('process', () => {
    it('should parse MDN notification', () => {
      const headers = {
        'content-type': 'multipart/report; report-type=disposition-notification',
        'original-recipient': 'rfc822;user@example.com',
        'final-recipient': 'rfc822;user@example.com',
      }

      const body = 'Disposition: automatic-action; MDN-sent-automatically'

      const mdn = handler.process(headers, body)
      expect(mdn).toBeDefined()
      expect(mdn?.originalRecipient).toBe('rfc822;user@example.com')
      expect(mdn?.disposition.type).toBe('automatic-action')
      expect(mdn?.disposition.mode).toBe('MDN-sent-automatically')
    })
  })

  describe('isReadReceipt', () => {
    it('should identify read receipts', () => {
      const mdn = {
        messageId: 'mdn-1',
        originalMessageId: 'msg-1',
        originalRecipient: 'user@example.com',
        finalRecipient: 'user@example.com',
        disposition: {
          type: 'automatic-action' as const,
          mode: 'MDN-sent-automatically' as const,
        },
        receivedAt: new Date(),
      }

      expect(handler.isReadReceipt(mdn)).toBe(true)
    })
  })
})

