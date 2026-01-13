/**
 * MIME Parser Tests
 * 
 * Comprehensive tests for james-project MIME message parsing utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  parseMimeMessage,
  parseContentType,
  parseContentDisposition,
  extractContentPart,
} from '@/lib/email/james/mime/parser'

describe('MIME Parser', () => {
  describe('parseContentType', () => {
    it('should parse simple content type', () => {
      const result = parseContentType('text/plain')
      expect(result.type).toBe('text')
      expect(result.subtype).toBe('plain')
    })

    it('should parse content type with charset', () => {
      const result = parseContentType('text/html; charset=UTF-8')
      expect(result.type).toBe('text')
      expect(result.subtype).toBe('html')
      expect(result.parameters.charset).toBe('UTF-8')
    })

    it('should parse multipart with boundary', () => {
      const result = parseContentType('multipart/mixed; boundary="----=_Part_123"')
      expect(result.type).toBe('multipart')
      expect(result.subtype).toBe('mixed')
      expect(result.parameters.boundary).toBe('----=_Part_123')
    })

    it('should handle quoted parameters', () => {
      const result = parseContentType('text/plain; charset="UTF-8"')
      expect(result.parameters.charset).toBe('UTF-8')
    })
  })

  describe('parseContentDisposition', () => {
    it('should parse attachment disposition', () => {
      const result = parseContentDisposition('attachment; filename="document.pdf"')
      expect(result.disposition).toBe('attachment')
      expect(result.parameters.filename).toBe('document.pdf')
    })

    it('should parse inline disposition', () => {
      const result = parseContentDisposition('inline; filename="image.jpg"')
      expect(result.disposition).toBe('inline')
      expect(result.parameters.filename).toBe('image.jpg')
    })
  })

  describe('parseMimeMessage', () => {
    it('should parse simple text message', () => {
      const rawMessage = `Content-Type: text/plain; charset=UTF-8\r\n\r\nHello, World!`

      const result = parseMimeMessage(rawMessage)

      expect(result.contentType).toBe('text/plain')
      expect(result.body.body).toBe('Hello, World!')
      expect(result.text).toBe('Hello, World!')
    })

    it('should parse multipart message', () => {
      const boundary = '----=_Part_123'
      const rawMessage = `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\nPlain text\r\n--${boundary}\r\nContent-Type: text/html\r\n\r\n<html>HTML</html>\r\n--${boundary}--`

      const result = parseMimeMessage(rawMessage)

      expect(result.contentType).toContain('multipart/alternative')
      expect(result.body.parts).toBeDefined()
      expect(result.body.parts?.length).toBe(2)
    })
  })

  describe('extractTextAndHtml', () => {
    it('should extract text/plain part', () => {
      const rawMessage = `Content-Type: text/plain; charset=UTF-8\r\n\r\nPlain text content`
      const result = parseMimeMessage(rawMessage)

      expect(result.text).toBe('Plain text content')
      expect(result.html).toBeUndefined()
    })

    it('should extract from multipart/alternative', () => {
      const boundary = '----=_Part_123'
      const rawMessage = `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\nPlain text\r\n--${boundary}\r\nContent-Type: text/html\r\n\r\n<html>HTML</html>\r\n--${boundary}--`
      const result = parseMimeMessage(rawMessage)

      expect(result.text).toBe('Plain text')
      expect(result.html).toBe('<html>HTML</html>')
    })
  })
})

