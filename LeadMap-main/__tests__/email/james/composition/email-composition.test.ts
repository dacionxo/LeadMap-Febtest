/**
 * Email Composition Tests
 * 
 * Comprehensive tests for email composition utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailComposer, createEmailComposer } from '@/lib/email/james/composition/email-composition'

describe('Email Composer', () => {
  let composer: EmailComposer

  beforeEach(() => {
    composer = createEmailComposer()
  })

  describe('composeFromTemplate', () => {
    it('should compose email from template', () => {
      const template = {
        id: 'template1',
        name: 'Welcome',
        subject: 'Welcome {{name}}',
        body: 'Hello {{name}}, welcome to our service!',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const email = composer.composeFromTemplate(template, { name: 'John' })

      expect(email.subject).toBe('Welcome John')
      expect(email.body).toBe('Hello John, welcome to our service!')
    })
  })

  describe('composeReply', () => {
    it('should compose reply email', () => {
      const original = {
        from: 'sender@example.com',
        subject: 'Test',
        messageId: 'msg-123',
      }

      const reply = composer.composeReply(original, 'Reply body')

      expect(reply.to).toBe('sender@example.com')
      expect(reply.subject).toBe('Re: Test')
      expect(reply.body).toBe('Reply body')
      expect(reply.inReplyTo).toBe('msg-123')
    })
  })

  describe('composeForward', () => {
    it('should compose forward email', () => {
      const original = {
        from: 'sender@example.com',
        subject: 'Test',
        body: 'Original body',
        messageId: 'msg-123',
      }

      const forward = composer.composeForward(original, 'forward@example.com')

      expect(forward.to).toBe('forward@example.com')
      expect(forward.subject).toBe('Fwd: Test')
      expect(forward.body).toContain('Original body')
      expect(forward.headers?.['X-Original-Message-ID']).toBe('msg-123')
    })
  })

  describe('validate', () => {
    it('should validate composition options', () => {
      const valid = {
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body',
      }

      const result = composer.validate(valid)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalid = {
        to: '',
        subject: '',
      }

      const result = composer.validate(invalid as any)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})

