/**
 * MIME Encoding Tests
 * 
 * Comprehensive tests for james-project MIME encoding utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  encodeBase64,
  decodeBase64,
  encodeQuotedPrintable,
  decodeQuotedPrintable,
  encodeHeader,
  decodeHeader,
  detectEncoding,
  getEncodingForContentType,
} from '@/lib/email/james/mime/encoding'

describe('MIME Encoding', () => {
  describe('Base64 Encoding', () => {
    it('should encode and decode strings', () => {
      const original = 'Hello, World!'
      const encoded = encodeBase64(original)
      const decoded = decodeBase64(encoded)

      expect(decoded).toBe(original)
    })

    it('should handle empty strings', () => {
      expect(encodeBase64('')).toBe('')
      expect(decodeBase64('')).toBe('')
    })

    it('should handle special characters', () => {
      const original = 'Hello, 世界!'
      const encoded = encodeBase64(original)
      const decoded = decodeBase64(encoded)

      expect(decoded).toBe(original)
    })
  })

  describe('Quoted-Printable Encoding', () => {
    it('should encode and decode strings', () => {
      const original = 'Hello, World!'
      const encoded = encodeQuotedPrintable(original)
      const decoded = decodeQuotedPrintable(encoded)

      expect(decoded).toBe(original)
    })

    it('should encode special characters', () => {
      const original = 'Hello, 世界!'
      const encoded = encodeQuotedPrintable(original)
      expect(encoded).toContain('=')
    })

    it('should handle soft line breaks', () => {
      const original = 'A'.repeat(100)
      const encoded = encodeQuotedPrintable(original)
      // The implementation uses =\r\n for soft line breaks
      expect(encoded).toMatch(/=\r?\n/)
    })
  })

  describe('Header Encoding (RFC 2047)', () => {
    it('should encode non-ASCII headers', () => {
      const original = 'Hello, 世界!'
      const encoded = encodeHeader(original)
      expect(encoded).toContain('=?UTF-8?B?')
    })

    it('should not encode ASCII headers', () => {
      const original = 'Hello, World!'
      const encoded = encodeHeader(original)
      expect(encoded).toBe(original)
    })

    it('should decode encoded headers', () => {
      const original = 'Hello, 世界!'
      const encoded = encodeHeader(original)
      const decoded = decodeHeader(encoded)
      expect(decoded).toBe(original)
    })

    it('should handle Q-encoding', () => {
      const encoded = '=?UTF-8?Q?Hello=2C_World?='
      const decoded = decodeHeader(encoded)
      expect(decoded).toBe('Hello, World')
    })
  })

  describe('Content Transfer Encoding Detection', () => {
    it('should detect base64 encoding for binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03])
      expect(detectEncoding(binaryData)).toBe('base64')
    })

    it('should detect quoted-printable encoding for non-ASCII text', () => {
      expect(detectEncoding('Hello, 世界!')).toBe('quoted-printable')
    })

    it('should default to 7bit for ASCII text', () => {
      expect(detectEncoding('Hello, World!')).toBe('7bit')
    })

    it('should get encoding for content type', () => {
      expect(getEncodingForContentType('image/png', Buffer.from([0x00]))).toBe('base64')
      expect(getEncodingForContentType('text/plain', 'Hello')).toBe('7bit')
      expect(getEncodingForContentType('text/plain', 'Hello, 世界!')).toBe('quoted-printable')
    })
  })
})

