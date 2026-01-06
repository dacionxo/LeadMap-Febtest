/**
 * Email Search Tests
 * 
 * Comprehensive tests for email search utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailSearchEngine, createEmailSearchEngine } from '@/lib/email/james/search/email-search'

describe('Email Search Engine', () => {
  let engine: EmailSearchEngine

  beforeEach(() => {
    engine = createEmailSearchEngine()
  })

  describe('indexMessage', () => {
    it('should index email message', () => {
      engine.indexMessage({
        messageId: 'msg-1',
        mailboxId: 'mb-1',
        subject: 'Test',
        from: 'sender@example.com',
        indexedAt: new Date(),
      })

      expect(engine.getIndexSize()).toBe(1)
    })
  })

  describe('search', () => {
    beforeEach(() => {
      engine.indexMessage({
        messageId: 'msg-1',
        mailboxId: 'mb-1',
        subject: 'Test Email',
        from: 'sender@example.com',
        body: 'Test body',
        indexedAt: new Date(),
      })

      engine.indexMessage({
        messageId: 'msg-2',
        mailboxId: 'mb-1',
        subject: 'Another Email',
        from: 'other@example.com',
        body: 'Another body',
        indexedAt: new Date(),
      })
    })

    it('should search by subject', () => {
      const result = engine.search({
        conditions: [
          { field: 'subject', operator: 'contains', value: 'Test' },
        ],
      })

      expect(result.messageIds).toContain('msg-1')
      expect(result.total).toBe(1)
    })

    it('should search by from', () => {
      const result = engine.search({
        conditions: [
          { field: 'from', operator: 'equals', value: 'sender@example.com' },
        ],
      })

      expect(result.messageIds).toContain('msg-1')
      expect(result.total).toBe(1)
    })

    it('should support AND operator', () => {
      const result = engine.search({
        conditions: [
          { field: 'subject', operator: 'contains', value: 'Email' },
          { field: 'from', operator: 'equals', value: 'sender@example.com' },
        ],
        operator: 'AND',
      })

      expect(result.messageIds).toContain('msg-1')
      expect(result.total).toBe(1)
    })

    it('should support OR operator', () => {
      const result = engine.search({
        conditions: [
          { field: 'from', operator: 'equals', value: 'sender@example.com' },
          { field: 'from', operator: 'equals', value: 'other@example.com' },
        ],
        operator: 'OR',
      })

      expect(result.messageIds.length).toBe(2)
      expect(result.total).toBe(2)
    })

    it('should support pagination', () => {
      const result = engine.search({
        conditions: [
          { field: 'subject', operator: 'contains', value: 'Email' },
        ],
        limit: 1,
        offset: 0,
      })

      expect(result.messageIds.length).toBe(1)
      expect(result.total).toBe(2)
      expect(result.limit).toBe(1)
      expect(result.offset).toBe(0)
    })
  })
})

