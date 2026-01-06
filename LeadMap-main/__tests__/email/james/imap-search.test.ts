/**
 * IMAP Search Tests
 * 
 * Comprehensive tests for james-project IMAP search utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  buildSearchQuery,
  parseSearchQuery,
  evaluateSearchQuery,
  SearchCriterion,
} from '@/lib/email/james/imap/search'
import { createFlagSet, parseFlags, SystemFlag } from '@/lib/email/james/imap/flags'

describe('IMAP Search', () => {
  describe('buildSearchQuery', () => {
    it('should build search query from criteria', () => {
      const criteria: SearchCriterion[] = [
        { type: 'FROM', value: 'user@example.com' },
        { type: 'SUBJECT', value: 'Test' },
      ]

      const query = buildSearchQuery(criteria)

      expect(query.criteria).toHaveLength(2)
      expect(query.criteria[0].type).toBe('FROM')
      expect(query.criteria[1].type).toBe('SUBJECT')
    })

    it('should handle empty criteria', () => {
      const query = buildSearchQuery([])
      expect(query.criteria).toHaveLength(0)
    })
  })

  describe('parseSearchQuery', () => {
    it('should parse simple search string', () => {
      const query = parseSearchQuery('FROM "user@example.com"')
      expect(query.criteria).toHaveLength(1)
      expect(query.criteria[0].type).toBe('FROM')
    })

    it('should parse multiple criteria', () => {
      const query = parseSearchQuery('FROM "user@example.com" SUBJECT "Test"')
      expect(query.criteria.length).toBeGreaterThan(1)
    })

    it('should parse flag searches', () => {
      const query = parseSearchQuery('SEEN UNSEEN')
      expect(query.criteria.some(c => c.type === 'SEEN')).toBe(true)
      expect(query.criteria.some(c => c.type === 'UNSEEN')).toBe(true)
    })

    it('should parse date searches', () => {
      const query = parseSearchQuery('SINCE "2024-01-01"')
      expect(query.criteria[0].type).toBe('SINCE')
    })
  })

  describe('evaluateSearchQuery', () => {
    const createMockMessage = (overrides: any = {}) => {
      let flags
      if (overrides.flags) {
        if (Array.isArray(overrides.flags)) {
          flags = parseFlags(overrides.flags.join(' '))
        } else {
          flags = parseFlags(overrides.flags)
        }
      } else {
        flags = createFlagSet()
      }
      
      return {
        flags,
        from: overrides.from || 'user@example.com',
        to: overrides.to || 'recipient@example.com',
        subject: overrides.subject || 'Test Subject',
        body: overrides.body || 'Test body',
        size: overrides.size || 1024,
        internalDate: overrides.internalDate || new Date('2024-01-01'),
        sentDate: overrides.sentDate || new Date('2024-01-01'),
        uid: overrides.uid || 1,
        headers: overrides.headers || {},
      }
    }

    it('should match ALL criteria', () => {
      const query = buildSearchQuery([{ type: 'ALL' }])
      const messages = [
        createMockMessage(),
        createMockMessage({ from: 'other@example.com' }),
      ]

      const results = evaluateSearchQuery(query, messages)
      expect(results).toHaveLength(2)
    })

    it('should match FROM criteria', () => {
      const query = buildSearchQuery([{ type: 'FROM', value: 'user@example.com' }])
      const messages = [
        createMockMessage({ from: 'user@example.com' }),
        createMockMessage({ from: 'other@example.com' }),
      ]

      const results = evaluateSearchQuery(query, messages)
      expect(results).toHaveLength(1)
      expect(results[0].from).toBe('user@example.com')
    })

    it('should match SEEN flag', () => {
      const query = buildSearchQuery([{ type: 'SEEN' }])
      const messages = [
        createMockMessage({ flags: '\\Seen' }),
        createMockMessage({ flags: '' }),
      ]

      const results = evaluateSearchQuery(query, messages)
      expect(results).toHaveLength(1)
    })

    it('should match UNSEEN flag', () => {
      const query = buildSearchQuery([{ type: 'UNSEEN' }])
      const messages = [
        createMockMessage({ flags: '\\Seen' }),
        createMockMessage({ flags: '' }),
      ]

      const results = evaluateSearchQuery(query, messages)
      expect(results).toHaveLength(1)
    })

    it('should match SUBJECT criteria', () => {
      const query = buildSearchQuery([{ type: 'SUBJECT', value: 'Test' }])
      const messages = [
        createMockMessage({ subject: 'Test Subject' }),
        createMockMessage({ subject: 'Other Subject' }),
      ]

      const results = evaluateSearchQuery(query, messages)
      expect(results).toHaveLength(1)
    })
  })
})

