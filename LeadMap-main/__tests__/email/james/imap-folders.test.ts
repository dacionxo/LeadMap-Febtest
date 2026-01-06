/**
 * IMAP Folders Tests
 * 
 * Comprehensive tests for james-project IMAP folder management utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  normalizeMailboxName,
  buildMailboxPath,
  parseMailboxPath,
  getMailboxType,
  canDeleteMailbox,
  canCreateMailbox,
  canRenameMailbox,
  getParentMailbox,
  getMailboxDepth,
  isSubscribed,
  validateMailboxName,
  MailboxType,
  HIERARCHY_SEPARATOR,
  INBOX_NAME,
} from '@/lib/email/james/imap/folders'

describe('IMAP Folders', () => {
  describe('normalizeMailboxName', () => {
    it('should trim whitespace', () => {
      expect(normalizeMailboxName('  INBOX  ')).toBe('INBOX')
    })

    it('should remove trailing delimiters', () => {
      expect(normalizeMailboxName('MyFolder/')).toBe('MyFolder')
    })

    it('should normalize INBOX to uppercase', () => {
      expect(normalizeMailboxName('inbox')).toBe('INBOX')
      expect(normalizeMailboxName('Inbox')).toBe('INBOX')
    })

    it('should handle empty strings', () => {
      expect(normalizeMailboxName('')).toBe('')
    })
  })

  describe('buildMailboxPath', () => {
    it('should build simple mailbox path', () => {
      const path = buildMailboxPath(null, null, 'INBOX')
      expect(path).toBe('INBOX')
    })

    it('should build path with user', () => {
      const path = buildMailboxPath(null, 'user', 'INBOX')
      expect(path).toBe('user/INBOX')
    })

    it('should build path with namespace', () => {
      const path = buildMailboxPath('#shared', 'user', 'MyFolder')
      expect(path).toBe('#shared/user/MyFolder')
    })

    it('should handle custom delimiter', () => {
      const path = buildMailboxPath(null, null, 'INBOX', '.')
      expect(path).toBe('INBOX')
    })
  })

  describe('parseMailboxPath', () => {
    it('should parse simple path', () => {
      const parsed = parseMailboxPath('INBOX')
      expect(parsed.mailboxName).toBe('INBOX')
      expect(parsed.namespace).toBeNull()
      expect(parsed.user).toBeNull()
    })

    it('should parse path with user', () => {
      const parsed = parseMailboxPath('user/INBOX')
      expect(parsed.mailboxName).toBe('INBOX')
      expect(parsed.user).toBe('user')
    })

    it('should parse path with namespace', () => {
      const parsed = parseMailboxPath('#shared/user/MyFolder')
      expect(parsed.mailboxName).toBe('MyFolder')
      expect(parsed.namespace).toBe('#shared')
      expect(parsed.user).toBe('user')
    })
  })

  describe('getMailboxType', () => {
    it('should identify INBOX', () => {
      expect(getMailboxType('INBOX')).toBe(MailboxType.INBOX)
      expect(getMailboxType('inbox')).toBe(MailboxType.INBOX)
    })

    it('should identify DRAFTS', () => {
      expect(getMailboxType('Drafts')).toBe(MailboxType.DRAFTS)
    })

    it('should identify TRASH', () => {
      expect(getMailboxType('Trash')).toBe(MailboxType.TRASH)
    })

    it('should identify SENT', () => {
      expect(getMailboxType('Sent Items')).toBe(MailboxType.SENT)
    })

    it('should return OTHER for unknown types', () => {
      expect(getMailboxType('MyFolder')).toBe(MailboxType.OTHER)
    })
  })

  describe('canDeleteMailbox', () => {
    it('should allow deleting non-INBOX mailboxes', () => {
      expect(canDeleteMailbox('MyFolder')).toBe(true)
      expect(canDeleteMailbox('Sent')).toBe(true)
    })

    it('should disallow deleting INBOX', () => {
      expect(canDeleteMailbox('INBOX')).toBe(false)
      expect(canDeleteMailbox('inbox')).toBe(false)
    })
  })

  describe('canCreateMailbox', () => {
    it('should allow creating valid mailbox', () => {
      const result = canCreateMailbox('MyFolder', [])
      expect(result.valid).toBe(true)
    })

    it('should reject duplicate mailbox', () => {
      const result = canCreateMailbox('MyFolder', ['MyFolder'])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('should validate mailbox name', () => {
      const result = canCreateMailbox('', [])
      expect(result.valid).toBe(false)
    })
  })

  describe('canRenameMailbox', () => {
    it('should allow renaming existing mailbox', () => {
      const result = canRenameMailbox('OldFolder', 'NewFolder', ['OldFolder'])
      expect(result.valid).toBe(true)
    })

    it('should reject if source does not exist', () => {
      const result = canRenameMailbox('OldFolder', 'NewFolder', [])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('does not exist')
    })

    it('should reject if target already exists', () => {
      const result = canRenameMailbox('OldFolder', 'NewFolder', ['OldFolder', 'NewFolder'])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('already exists')
    })
  })

  describe('getParentMailbox', () => {
    it('should get parent path', () => {
      expect(getParentMailbox('user/INBOX/SubFolder')).toBe('user/INBOX')
      expect(getParentMailbox('INBOX/SubFolder')).toBe('INBOX')
    })

    it('should return null for root level', () => {
      expect(getParentMailbox('INBOX')).toBeNull()
    })
  })

  describe('getMailboxDepth', () => {
    it('should calculate depth correctly', () => {
      expect(getMailboxDepth('INBOX')).toBe(0)
      expect(getMailboxDepth('INBOX/SubFolder')).toBe(1)
      expect(getMailboxDepth('INBOX/SubFolder/SubSubFolder')).toBe(2)
    })
  })

  describe('isSubscribed', () => {
    it('should check subscription status', () => {
      expect(isSubscribed('INBOX', ['INBOX', 'Sent'])).toBe(true)
      expect(isSubscribed('Drafts', ['INBOX', 'Sent'])).toBe(false)
    })
  })

  describe('validateMailboxName', () => {
    it('should validate valid mailbox names', () => {
      const result = validateMailboxName('MyFolder')
      expect(result.valid).toBe(true)
    })

    it('should reject empty names', () => {
      const result = validateMailboxName('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('cannot be empty')
    })

    it('should reject names starting with ..', () => {
      const result = validateMailboxName('..Invalid')
      expect(result.valid).toBe(false)
    })

    it('should enforce max length if specified', () => {
      const result = validateMailboxName('A'.repeat(201), 200)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('maximum length')
    })
  })

  describe('MailboxType enum', () => {
    it('should have all standard mailbox types', () => {
      expect(MailboxType.INBOX).toBe('INBOX')
      expect(MailboxType.DRAFTS).toBe('DRAFTS')
      expect(MailboxType.TRASH).toBe('TRASH')
      expect(MailboxType.SPAM).toBe('SPAM')
      expect(MailboxType.SENT).toBe('SENT')
    })
  })
})

