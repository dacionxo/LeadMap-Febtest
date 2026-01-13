/**
 * SMTP Parser Tests
 * 
 * Comprehensive tests for james-project SMTP message parsing utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  parseSMTPMessage,
  isMessageTerminated,
  validateSMTPMessage,
} from '@/lib/email/james/smtp/parser'

describe('SMTP Parser', () => {
  describe('parseSMTPMessage', () => {
    it('should parse complete SMTP message', () => {
      const rawMessage = `From: user@example.com\r\nTo: recipient@example.com\r\nSubject: Test\r\n\r\nThis is the message body.`

      const result = parseSMTPMessage(rawMessage)

      expect(result.headers).toHaveProperty('from')
      expect(result.headers).toHaveProperty('to')
      expect(result.headers).toHaveProperty('subject')
      expect(result.body).toBe('This is the message body.')
    })

    it('should handle dot-stuffing in body', () => {
      const rawMessage = `From: user@example.com\r\nSubject: Test\r\n\r\n..This line has dot-stuffing.`

      const result = parseSMTPMessage(rawMessage)

      expect(result.body).toBe('.This line has dot-stuffing.')
    })

    it('should handle empty body', () => {
      const rawMessage = `From: user@example.com\r\nSubject: Test\r\n\r\n`

      const result = parseSMTPMessage(rawMessage)

      expect(result.headers).toHaveProperty('from')
      expect(result.body).toBe('')
    })

    it('should handle headers only (no body)', () => {
      const rawMessage = `From: user@example.com
Subject: Test`

      const result = parseSMTPMessage(rawMessage)

      expect(result.headers).toHaveProperty('from')
      expect(result.body).toBe('')
    })

    it('should handle continuation lines in headers', () => {
      const rawMessage = `From: user@example.com\r\nSubject: This is a very long subject that\r\n continues on the next line\r\n\r\nBody text`

      const result = parseSMTPMessage(rawMessage)

      // Headers with continuation lines may be arrays or concatenated strings
      const subject = result.headers['subject']
      if (Array.isArray(subject)) {
        expect(subject.join(' ')).toBe('This is a very long subject that continues on the next line')
      } else {
        expect(subject).toBe('This is a very long subject that continues on the next line')
      }
    })

    it('should normalize header names to lowercase', () => {
      const rawMessage = `From: user@example.com\r\nTO: recipient@example.com\r\n\r\nBody`

      const result = parseSMTPMessage(rawMessage)

      expect(result.headers['from']).toBe('user@example.com')
      expect(result.headers['to']).toBe('recipient@example.com')
    })

    it('should handle Buffer input', () => {
      const rawMessage = Buffer.from(`From: user@example.com\r\nSubject: Test\r\n\r\nBody`)
      const result = parseSMTPMessage(rawMessage)

      expect(result.headers).toHaveProperty('from')
      expect(result.body).toBe('Body')
    })
  })

  describe('isMessageTerminated', () => {
    it('should detect message termination with .\\r\\n', () => {
      expect(isMessageTerminated('.\r\n')).toBe(true)
    })

    it('should detect message termination with .\\n', () => {
      expect(isMessageTerminated('.\n')).toBe(true)
    })

    it('should detect standalone . line', () => {
      expect(isMessageTerminated('.\r')).toBe(true)
      expect(isMessageTerminated('.')).toBe(true)
    })

    it('should return false for non-terminated message', () => {
      expect(isMessageTerminated('Not terminated')).toBe(false)
    })
  })

  describe('validateSMTPMessage', () => {
    it('should validate message with required headers', () => {
      const message = {
        headers: {
          from: 'user@example.com',
          to: 'recipient@example.com',
        },
        body: 'Body',
        raw: 'raw',
      }

      const result = validateSMTPMessage(message)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject message without From header', () => {
      const message = {
        headers: {
          to: 'recipient@example.com',
        },
        body: 'Body',
        raw: 'raw',
      }

      const result = validateSMTPMessage(message)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing From header')
    })

    it('should reject message without recipient headers', () => {
      const message = {
        headers: {
          from: 'user@example.com',
        },
        body: 'Body',
        raw: 'raw',
      }

      const result = validateSMTPMessage(message)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing recipient header (To, Cc, or Bcc)')
    })

    it('should accept message with Cc header', () => {
      const message = {
        headers: {
          from: 'user@example.com',
          cc: 'recipient@example.com',
        },
        body: 'Body',
        raw: 'raw',
      }

      const result = validateSMTPMessage(message)
      expect(result.valid).toBe(true)
    })
  })
})

