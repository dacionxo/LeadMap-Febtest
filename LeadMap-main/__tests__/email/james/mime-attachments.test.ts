/**
 * MIME Attachments Tests
 * 
 * Comprehensive tests for james-project MIME attachment utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  findAttachmentByFilenameFromArray,
  findAttachmentByContentId,
  validateAttachmentSizeFromInfo,
} from '@/lib/email/james/mime/attachments'
import { parseMimeMessage, extractAttachments, extractInlineAttachments } from '@/lib/email/james/mime/parser'

describe('MIME Attachments', () => {
  describe('extractAttachments', () => {
    it('should extract attachment from multipart message', () => {
      const boundary = '----=_Part_123'
      const rawMessage = `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\nBody text\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="document.pdf"\r\n\r\nPDF content\r\n--${boundary}--`

      const mimeContent = parseMimeMessage(rawMessage)
      const attachments = extractAttachments(mimeContent.body)

      expect(attachments.length).toBeGreaterThan(0)
      const attachment = attachments[0]
      expect(attachment.filename).toBe('document.pdf')
      expect(attachment.contentType).toBe('application/pdf')
    })

    it('should not extract inline text parts', () => {
      const rawMessage = `Content-Type: text/plain; charset=UTF-8\r\n\r\nPlain text content`

      const mimeContent = parseMimeMessage(rawMessage)
      const attachments = extractAttachments(mimeContent.body)

      expect(attachments).toHaveLength(0)
    })
  })

  describe('findAttachmentByFilename', () => {
    it('should find attachment by filename', () => {
      const boundary = '----=_Part_123'
      const rawMessage = `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="document.pdf"\r\n\r\nPDF content\r\n--${boundary}--`

      const mimeContent = parseMimeMessage(rawMessage)
      const attachments = extractAttachments(mimeContent.body)

      const found = findAttachmentByFilenameFromArray(attachments, 'document.pdf')
      expect(found).toBeDefined()
      expect(found?.filename).toBe('document.pdf')
    })

    it('should return null if not found', () => {
      const attachments: any[] = []
      const found = findAttachmentByFilenameFromArray(attachments, 'nonexistent.pdf')
      expect(found).toBeNull()
    })
  })

  describe('findAttachmentByContentId', () => {
    it('should find attachment by Content-ID', () => {
      const boundary = '----=_Part_123'
      const rawMessage = `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Disposition: inline; filename="image.jpg"\r\nContent-ID: <image123>\r\n\r\nImage content\r\n--${boundary}--`

      const mimeContent = parseMimeMessage(rawMessage)
      // Inline attachments have Content-ID
      const inlineAttachments = extractInlineAttachments(mimeContent.body)

      const found = findAttachmentByContentId(inlineAttachments, 'image123')
      expect(found).toBeDefined()
      expect(found?.contentId).toBe('image123')
    })
  })

  describe('validateAttachmentSize', () => {
    it('should validate attachment size', () => {
      const attachment = {
        size: 1024 * 1024, // 1 MB
      }

      expect(validateAttachmentSizeFromInfo(attachment, 10 * 1024 * 1024)).toBe(true) // 10 MB limit
      expect(validateAttachmentSizeFromInfo(attachment, 512 * 1024)).toBe(false) // 512 KB limit
    })
  })
})

