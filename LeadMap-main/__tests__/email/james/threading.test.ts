/**
 * Email Threading Tests
 * 
 * Comprehensive tests for james-project email threading utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  parseMessageId,
  parseInReplyTo,
  parseReferences,
  extractThreadHeaders,
  normalizeSubject,
  subjectsMatch,
  buildThreads,
  findThreadForMessage,
  getThreadRoot,
  getThreadMessageIds,
  mergeThreadsBySubject,
  validateThread,
} from '@/lib/email/james/threading/thread-reconstruction'

describe('Email Threading', () => {
  describe('parseMessageId', () => {
    it('should parse message-id with angle brackets', () => {
      expect(parseMessageId('<message@example.com>')).toBe('message@example.com')
    })

    it('should parse message-id without angle brackets', () => {
      expect(parseMessageId('message@example.com')).toBe('message@example.com')
    })

    it('should return null for invalid message-ids', () => {
      expect(parseMessageId('')).toBeNull()
      expect(parseMessageId('invalid')).toBeNull()
      expect(parseMessageId(null)).toBeNull()
    })
  })

  describe('parseInReplyTo', () => {
    it('should parse single in-reply-to', () => {
      const result = parseInReplyTo('<message@example.com>')
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('message@example.com')
    })

    it('should parse multiple in-reply-to values', () => {
      const result = parseInReplyTo('<msg1@example.com> <msg2@example.com>')
      expect(result).toHaveLength(2)
    })

    it('should return empty array for invalid input', () => {
      expect(parseInReplyTo('')).toEqual([])
      expect(parseInReplyTo(null)).toEqual([])
    })
  })

  describe('parseReferences', () => {
    it('should parse space-separated references', () => {
      const result = parseReferences('<msg1@example.com> <msg2@example.com>')
      expect(result).toHaveLength(2)
    })

    it('should handle array input', () => {
      const result = parseReferences(['<msg1@example.com>', '<msg2@example.com>'])
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return empty array for invalid input', () => {
      expect(parseReferences('')).toEqual([])
      expect(parseReferences(null)).toEqual([])
    })
  })

  describe('extractThreadHeaders', () => {
    it('should extract all threading headers', () => {
      const headers = {
        'message-id': '<msg1@example.com>',
        'in-reply-to': '<msg0@example.com>',
        'references': '<msg0@example.com>',
        'subject': 'Test Subject',
        'date': 'Mon, 1 Jan 2024 00:00:00 +0000',
      }

      const result = extractThreadHeaders(headers)

      expect(result.messageId).toBe('msg1@example.com')
      expect(result.inReplyTo).toBe('<msg0@example.com>')
      expect(result.subject).toBe('Test Subject')
      expect(result.date).toBeInstanceOf(Date)
    })

    it('should handle missing headers', () => {
      const headers = { 'message-id': '<msg1@example.com>' }
      const result = extractThreadHeaders(headers)

      expect(result.messageId).toBe('msg1@example.com')
      expect(result.inReplyTo).toBeUndefined()
    })
  })

  describe('normalizeSubject', () => {
    it('should remove Re: prefix', () => {
      expect(normalizeSubject('Re: Test Subject')).toBe('Test Subject')
      expect(normalizeSubject('RE: Test Subject')).toBe('Test Subject')
    })

    it('should remove Fwd: prefix', () => {
      expect(normalizeSubject('Fwd: Test Subject')).toBe('Test Subject')
      expect(normalizeSubject('Fw: Test Subject')).toBe('Test Subject')
    })

    it('should remove [tag] prefixes', () => {
      expect(normalizeSubject('[External] Test Subject')).toBe('Test Subject')
    })

    it('should handle empty subjects', () => {
      expect(normalizeSubject('')).toBe('')
      expect(normalizeSubject(null as any)).toBe('')
    })
  })

  describe('subjectsMatch', () => {
    it('should match normalized subjects', () => {
      expect(subjectsMatch('Re: Test', 'Test')).toBe(true)
      expect(subjectsMatch('Test', 'Re: Test')).toBe(true)
    })

    it('should not match different subjects', () => {
      expect(subjectsMatch('Subject 1', 'Subject 2')).toBe(false)
    })

    it('should not match empty subjects', () => {
      expect(subjectsMatch('', 'Test')).toBe(false)
    })
  })

  describe('buildThreads', () => {
    it('should build simple thread', () => {
      const messages = [
        {
          id: 'msg1',
          headers: {
            messageId: 'msg1@example.com',
            subject: 'Test',
            date: new Date('2024-01-01'),
          },
        },
        {
          id: 'msg2',
          headers: {
            messageId: 'msg2@example.com',
            inReplyTo: 'msg1@example.com',
            subject: 'Re: Test',
            date: new Date('2024-01-02'),
          },
        },
      ]

      const threads = buildThreads(messages)

      expect(threads.size).toBe(1)
      const thread = Array.from(threads.values())[0]
      expect(thread.rootMessageId).toBe('msg1@example.com')
      expect(thread.messageCount).toBe(2)
    })

    it('should handle orphaned messages', () => {
      const messages = [
        {
          id: 'msg1',
          headers: {
            messageId: 'msg1@example.com',
            inReplyTo: 'nonexistent@example.com',
            subject: 'Test',
          },
        },
      ]

      const threads = buildThreads(messages)

      expect(threads.size).toBe(1)
    })
  })

  describe('findThreadForMessage', () => {
    it('should find thread for message', () => {
      const messages = [
        {
          id: 'msg1',
          headers: { messageId: 'msg1@example.com', subject: 'Test' },
        },
        {
          id: 'msg2',
          headers: {
            messageId: 'msg2@example.com',
            inReplyTo: 'msg1@example.com',
            subject: 'Re: Test',
          },
        },
      ]

      const threads = buildThreads(messages)
      const thread = findThreadForMessage('msg2@example.com', threads)

      expect(thread).not.toBeNull()
      expect(thread?.rootMessageId).toBe('msg1@example.com')
    })

    it('should return null for message not in thread', () => {
      const threads = new Map()
      expect(findThreadForMessage('nonexistent@example.com', threads)).toBeNull()
    })
  })

  describe('getThreadRoot', () => {
    it('should get root message-id', () => {
      const messages = [
        {
          id: 'msg1',
          headers: { messageId: 'msg1@example.com', subject: 'Test' },
        },
        {
          id: 'msg2',
          headers: {
            messageId: 'msg2@example.com',
            inReplyTo: 'msg1@example.com',
            subject: 'Re: Test',
          },
        },
      ]

      const threads = buildThreads(messages)
      const root = getThreadRoot('msg2@example.com', threads)

      expect(root).toBe('msg1@example.com')
    })
  })

  describe('validateThread', () => {
    it('should validate valid thread', () => {
      const messages = [
        {
          id: 'msg1',
          headers: { messageId: 'msg1@example.com', subject: 'Test' },
        },
      ]

      const threads = buildThreads(messages)
      const thread = Array.from(threads.values())[0]
      const validation = validateThread(thread)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect invalid threads', () => {
      const invalidThread = {
        rootMessageId: '',
        root: null as any,
        allMessageIds: new Set(),
        messageCount: 0,
      }

      const validation = validateThread(invalidThread)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })
})


