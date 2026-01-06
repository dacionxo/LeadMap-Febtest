/**
 * SMTP Routing Tests
 * 
 * Comprehensive tests for james-project SMTP routing utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  isLocalDomain,
  routeRecipient,
  resolveDomain,
  isValidLocalRecipient,
  canRelay,
  extractRecipientFromRcptCommand,
  classifyRecipient,
} from '@/lib/email/james/smtp/routing'

describe('SMTP Routing', () => {
  describe('isLocalDomain', () => {
    it('should identify local domains', () => {
      const localDomains = ['lokitech.com', 'example.com', 'localhost']
      expect(isLocalDomain('lokitech.com', localDomains)).toBe(true)
      expect(isLocalDomain('example.com', localDomains)).toBe(true)
      expect(isLocalDomain('localhost', localDomains)).toBe(true)
    })

    it('should reject remote domains', () => {
      const localDomains = ['lokitech.com']
      expect(isLocalDomain('gmail.com', localDomains)).toBe(false)
      expect(isLocalDomain('outlook.com', localDomains)).toBe(false)
    })

    it('should be case-insensitive', () => {
      const localDomains = ['lokitech.com']
      expect(isLocalDomain('LOKITECH.COM', localDomains)).toBe(true)
      expect(isLocalDomain('Example.Com', localDomains)).toBe(false)
    })

    it('should match subdomains', () => {
      const localDomains = ['example.com']
      expect(isLocalDomain('mail.example.com', localDomains)).toBe(true)
    })
  })

  describe('routeRecipient', () => {
    it('should route local recipients', () => {
      const result = routeRecipient('user@lokitech.com', {
        localDomains: ['lokitech.com'],
      })
      expect(result.valid).toBe(true)
      expect(result.isLocal).toBe(true)
    })

    it('should route remote recipients', () => {
      const result = routeRecipient('user@gmail.com', {
        localDomains: ['lokitech.com'],
      })
      expect(result.valid).toBe(true)
      expect(result.isLocal).toBe(false)
    })

    it('should handle invalid addresses', () => {
      const result = routeRecipient('invalid-email', {
        localDomains: ['lokitech.com'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle RCPT TO: command format', () => {
      const result = routeRecipient('RCPT TO: <user@example.com>', {
        localDomains: ['example.com'],
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('resolveDomain', () => {
    it('should resolve local domain', () => {
      const result = resolveDomain('lokitech.com', {
        localDomains: ['lokitech.com'],
      })
      expect(result.isLocal).toBe(true)
    })

    it('should resolve remote domain', () => {
      const result = resolveDomain('gmail.com', {
        localDomains: ['lokitech.com'],
      })
      expect(result.isLocal).toBe(false)
    })
  })

  describe('isValidLocalRecipient', () => {
    it('should validate local recipients', () => {
      expect(isValidLocalRecipient('user@lokitech.com', {
        localDomains: ['lokitech.com'],
      })).toBe(true)
    })

    it('should reject remote recipients', () => {
      expect(isValidLocalRecipient('user@gmail.com', {
        localDomains: ['lokitech.com'],
      })).toBe(false)
    })

    it('should reject invalid addresses', () => {
      expect(isValidLocalRecipient('invalid', {
        localDomains: ['lokitech.com'],
      })).toBe(false)
    })
  })

  describe('canRelay', () => {
    it('should allow relay when configured', () => {
      expect(canRelay('user@gmail.com', {
        localDomains: ['lokitech.com'],
        allowRelay: true,
      })).toBe(true)
    })

    it('should deny relay when not configured', () => {
      expect(canRelay('user@gmail.com', {
        localDomains: ['lokitech.com'],
        allowRelay: false,
      })).toBe(false)
    })

    it('should deny relay to local domains', () => {
      expect(canRelay('user@lokitech.com', {
        localDomains: ['lokitech.com'],
        allowRelay: true,
      })).toBe(false)
    })
  })

  describe('extractRecipientFromRcptCommand', () => {
    it('should extract recipient from RCPT command', () => {
      const recipient = extractRecipientFromRcptCommand('RCPT TO: <user@example.com>')
      expect(recipient).toBe('user@example.com')
    })

    it('should return null for invalid command', () => {
      const recipient = extractRecipientFromRcptCommand('invalid')
      expect(recipient).toBeNull()
    })
  })

  describe('classifyRecipient', () => {
    it('should classify local recipients', () => {
      expect(classifyRecipient('user@lokitech.com', {
        localDomains: ['lokitech.com'],
      })).toBe('local')
    })

    it('should classify remote recipients', () => {
      expect(classifyRecipient('user@gmail.com', {
        localDomains: ['lokitech.com'],
      })).toBe('remote')
    })

    it('should classify invalid addresses', () => {
      expect(classifyRecipient('invalid', {
        localDomains: ['lokitech.com'],
      })).toBe('invalid')
    })
  })
})

