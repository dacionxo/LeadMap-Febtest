/**
 * Bounce Handling Tests
 * 
 * Comprehensive tests for bounce handling utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { BounceHandler, createBounceHandler } from '@/lib/email/james/delivery/bounce-handling'

describe('Bounce Handler', () => {
  let handler: BounceHandler

  beforeEach(() => {
    handler = createBounceHandler()
  })

  describe('process', () => {
    it('should process DSN bounce', () => {
      const headers = {
        'content-type': 'multipart/report; report-type=delivery-status',
        'final-recipient': 'rfc822;user@example.com',
        'action': 'failed',
        'status': '5.1.1',
      }

      const body = 'DSN body'

      const bounce = handler.process(headers, body, 'sender@example.com')
      expect(bounce).toBeDefined()
      expect(bounce?.recipient).toBe('user@example.com')
      expect(bounce?.classification.type).toBe('hard')
      expect(bounce?.classification.shouldSuppress).toBe(true)
    })

    it('should classify hard bounce from body', () => {
      const headers = {
        'to': 'sender@example.com',
      }

      const body = 'User not found: user@example.com'

      const bounce = handler.process(headers, body)
      expect(bounce).toBeDefined()
      expect(bounce?.classification.type).toBe('hard')
      expect(bounce?.classification.category).toBe('mailbox_not_found')
    })

    it('should classify soft bounce from body', () => {
      const headers = {
        'to': 'sender@example.com',
      }

      const body = 'Mailbox full: user@example.com'

      const bounce = handler.process(headers, body)
      expect(bounce).toBeDefined()
      expect(bounce?.classification.type).toBe('soft')
      expect(bounce?.classification.category).toBe('mailbox_full')
      expect(bounce?.classification.retryable).toBe(true)
    })
  })
})

