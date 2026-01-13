/**
 * Email Filter Tests
 * 
 * Comprehensive tests for james-project email filtering utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailFilterEngine, createEmailFilterEngine } from '@/lib/email/james/filtering/email-filter'

describe('Email Filter Engine', () => {
  let filterEngine: EmailFilterEngine

  beforeEach(() => {
    filterEngine = createEmailFilterEngine()
  })

  describe('addRule and removeRule', () => {
    it('should add and remove rules', () => {
      const rule = {
        id: 'rule1',
        name: 'Test Rule',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'subject_contains', value: 'test' },
        ],
        actions: [{ type: 'fileinto', value: 'Test' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      filterEngine.addRule(rule)
      expect(filterEngine.getRule('rule1')).toBeDefined()

      filterEngine.removeRule('rule1')
      expect(filterEngine.getRule('rule1')).toBeUndefined()
    })
  })

  describe('applyFilters', () => {
    it('should match rule and apply actions', () => {
      filterEngine.addRule({
        id: 'rule1',
        name: 'Subject Filter',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'subject_contains', value: 'urgent' },
        ],
        actions: [{ type: 'fileinto', value: 'Urgent' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = filterEngine.applyFilters({
        headers: {},
        subject: 'Urgent: Please review',
        body: '',
      })

      expect(result.matched).toBe(true)
      expect(result.ruleId).toBe('rule1')
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('fileinto')
    })

    it('should not match when conditions are not met', () => {
      filterEngine.addRule({
        id: 'rule1',
        name: 'Subject Filter',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'subject_contains', value: 'urgent' },
        ],
        actions: [{ type: 'fileinto', value: 'Urgent' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = filterEngine.applyFilters({
        headers: {},
        subject: 'Regular email',
        body: '',
      })

      expect(result.matched).toBe(false)
    })

    it('should stop processing on stop action', () => {
      filterEngine.addRule({
        id: 'rule1',
        name: 'Stop Rule',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'subject_contains', value: 'stop' },
        ],
        actions: [
          { type: 'fileinto', value: 'Stopped' },
          { type: 'stop' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      filterEngine.addRule({
        id: 'rule2',
        name: 'Second Rule',
        enabled: true,
        priority: 2,
        conditions: [
          { type: 'subject_contains', value: 'stop' },
        ],
        actions: [{ type: 'fileinto', value: 'Second' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = filterEngine.applyFilters({
        headers: {},
        subject: 'Stop processing',
        body: '',
      })

      expect(result.matched).toBe(true)
      expect(result.stopProcessing).toBe(true)
      expect(result.actions).toHaveLength(1) // stop action is filtered out
    })

    it('should respect rule priority', () => {
      filterEngine.addRule({
        id: 'rule1',
        name: 'Low Priority',
        enabled: true,
        priority: 10,
        conditions: [
          { type: 'subject_contains', value: 'test' },
        ],
        actions: [{ type: 'fileinto', value: 'Low' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      filterEngine.addRule({
        id: 'rule2',
        name: 'High Priority',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'subject_contains', value: 'test' },
        ],
        actions: [{ type: 'fileinto', value: 'High' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = filterEngine.applyFilters({
        headers: {},
        subject: 'Test email',
        body: '',
      })

      expect(result.matched).toBe(true)
      expect(result.ruleId).toBe('rule2') // Higher priority rule matches first
    })
  })

  describe('condition matching', () => {
    it('should match size_over condition', () => {
      filterEngine.addRule({
        id: 'rule1',
        name: 'Size Filter',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'size_over', value: 1000 },
        ],
        actions: [{ type: 'fileinto', value: 'Large' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = filterEngine.applyFilters({
        headers: {},
        size: 2000,
      })

      expect(result.matched).toBe(true)
    })

    it('should match from_equals condition', () => {
      filterEngine.addRule({
        id: 'rule1',
        name: 'From Filter',
        enabled: true,
        priority: 1,
        conditions: [
          { type: 'from_equals', value: 'sender@example.com' },
        ],
        actions: [{ type: 'fileinto', value: 'FromSender' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = filterEngine.applyFilters({
        headers: {},
        from: 'sender@example.com',
      })

      expect(result.matched).toBe(true)
    })
  })
})

