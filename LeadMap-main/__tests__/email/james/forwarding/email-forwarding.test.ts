/**
 * Email Forwarding Tests
 * 
 * Comprehensive tests for email forwarding utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailForwardingManager, createEmailForwardingManager } from '@/lib/email/james/forwarding/email-forwarding'

describe('Email Forwarding Manager', () => {
  let manager: EmailForwardingManager

  beforeEach(() => {
    manager = createEmailForwardingManager()
  })

  describe('addRule and removeRule', () => {
    it('should add and remove forwarding rules', () => {
      const rule = {
        id: 'rule1',
        enabled: true,
        toAddresses: ['forward@example.com'],
      }

      manager.addRule(rule)
      expect(manager.getRule('rule1')).toBeDefined()

      manager.removeRule('rule1')
      expect(manager.getRule('rule1')).toBeUndefined()
    })
  })

  describe('shouldForward', () => {
    it('should match forwarding rules', () => {
      manager.addRule({
        id: 'rule1',
        enabled: true,
        toAddresses: ['forward@example.com'],
      })

      const rules = manager.shouldForward({
        from: 'sender@example.com',
      })

      expect(rules).toHaveLength(1)
      expect(rules[0].id).toBe('rule1')
    })

    it('should not match disabled rules', () => {
      manager.addRule({
        id: 'rule1',
        enabled: false,
        toAddresses: ['forward@example.com'],
      })

      const rules = manager.shouldForward({
        from: 'sender@example.com',
      })

      expect(rules).toHaveLength(0)
    })

    it('should respect fromAddress filter', () => {
      manager.addRule({
        id: 'rule1',
        enabled: true,
        fromAddress: 'specific@example.com',
        toAddresses: ['forward@example.com'],
      })

      const rules1 = manager.shouldForward({
        from: 'specific@example.com',
      })
      expect(rules1).toHaveLength(1)

      const rules2 = manager.shouldForward({
        from: 'other@example.com',
      })
      expect(rules2).toHaveLength(0)
    })
  })

  describe('generateForwardedEmail', () => {
    it('should generate forwarded email', () => {
      const rule = {
        id: 'rule1',
        enabled: true,
        toAddresses: ['forward@example.com'],
        subjectPrefix: 'Fwd: ',
      }

      const forwarded = manager.generateForwardedEmail(
        {
          from: 'sender@example.com',
          subject: 'Test',
          body: 'Test body',
          messageId: 'msg-123',
        },
        rule
      )

      expect(forwarded.to).toEqual(['forward@example.com'])
      expect(forwarded.subject).toBe('Fwd: Test')
      expect(forwarded.body).toContain('Test body')
      expect(forwarded.headers?.['X-Original-Message-ID']).toBe('msg-123')
    })
  })
})

