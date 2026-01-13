/**
 * Email Archiving Tests
 * 
 * Comprehensive tests for email archiving utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailArchivingManager, createEmailArchivingManager } from '@/lib/email/james/archiving/email-archiving'

describe('Email Archiving Manager', () => {
  let manager: EmailArchivingManager

  beforeEach(() => {
    manager = createEmailArchivingManager()
  })

  describe('addPolicy and removePolicy', () => {
    it('should add and remove retention policies', () => {
      const policy = {
        id: 'policy1',
        name: '30 Day Retention',
        enabled: true,
        retentionDays: 30,
      }

      manager.addPolicy(policy)
      expect(manager.getPolicy('policy1')).toBeDefined()

      manager.removePolicy('policy1')
      expect(manager.getPolicy('policy1')).toBeUndefined()
    })
  })

  describe('archiveMessage', () => {
    it('should archive message', () => {
      const policy = {
        id: 'policy1',
        name: 'Test Policy',
        enabled: true,
        retentionDays: 30,
        deleteAfterDays: 60,
      }

      manager.addPolicy(policy)

      const entry = manager.archiveMessage(
        {
          messageId: 'msg-1',
          mailboxId: 'mb-1',
          userId: 'user-1',
          folder: 'INBOX',
          subject: 'Test',
        },
        policy
      )

      expect(entry.messageId).toBe('msg-1')
      expect(entry.archivedAt).toBeDefined()
      expect(entry.expiresAt).toBeDefined()
    })
  })

  describe('shouldArchive', () => {
    it('should determine if message should be archived', () => {
      const policy = {
        id: 'policy1',
        name: 'Archive Old Messages',
        enabled: true,
        retentionDays: 30,
        archiveAfterDays: 7,
      }

      manager.addPolicy(policy)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 10) // 10 days ago

      const result = manager.shouldArchive({
        folder: 'INBOX',
        date: oldDate,
      })

      expect(result).toBeDefined()
      expect(result?.id).toBe('policy1')
    })

    it('should respect folder filters', () => {
      const policy = {
        id: 'policy1',
        name: 'Archive Sent',
        enabled: true,
        retentionDays: 30,
        archiveAfterDays: 7,
        applyToFolders: ['Sent'],
      }

      manager.addPolicy(policy)

      const result1 = manager.shouldArchive({ folder: 'Sent' })
      expect(result1).toBeDefined()

      const result2 = manager.shouldArchive({ folder: 'INBOX' })
      expect(result2).toBeNull()
    })
  })

  describe('restoreMessage', () => {
    it('should restore message from archive', () => {
      const policy = {
        id: 'policy1',
        name: 'Test',
        enabled: true,
        retentionDays: 30,
      }

      manager.addPolicy(policy)

      const entry = manager.archiveMessage(
        {
          messageId: 'msg-1',
          mailboxId: 'mb-1',
          userId: 'user-1',
          folder: 'INBOX',
        },
        policy
      )

      const restored = manager.restoreMessage('msg-1')
      expect(restored).toBeDefined()
      expect(manager.getArchiveEntry('msg-1')).toBeUndefined()
    })
  })

  describe('cleanupExpired', () => {
    it('should clean up expired archive entries', () => {
      const policy = {
        id: 'policy1',
        name: 'Test',
        enabled: true,
        retentionDays: 30,
        deleteAfterDays: 1, // Delete after 1 day
      }

      manager.addPolicy(policy)

      // Create entry with expired date
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 2) // 2 days ago

      const entry = manager.archiveMessage(
        {
          messageId: 'msg-1',
          mailboxId: 'mb-1',
          userId: 'user-1',
          folder: 'INBOX',
        },
        policy
      )

      // Manually set expired date
      entry.expiresAt = oldDate

      const cleaned = manager.cleanupExpired()
      expect(cleaned).toBeGreaterThan(0)
    })
  })
})

