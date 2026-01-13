/**
 * Email Backup Tests
 * 
 * Comprehensive tests for email backup utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { EmailBackupManager, createEmailBackupManager } from '@/lib/email/james/backup/email-backup'

describe('Email Backup Manager', () => {
  let manager: EmailBackupManager

  beforeEach(() => {
    manager = createEmailBackupManager()
  })

  describe('createBackup', () => {
    it('should create backup', () => {
      const manifest = manager.createBackup(
        'mb-1',
        'user-1',
        [
          {
            messageId: 'msg-1',
            folder: 'INBOX',
            headers: {},
            subject: 'Test',
            size: 1000,
          },
        ],
        { includeAttachments: true }
      )

      expect(manifest.mailboxId).toBe('mb-1')
      expect(manifest.totalMessages).toBe(1)
      expect(manifest.totalSize).toBe(1000)
    })
  })

  describe('restoreBackup', () => {
    it('should restore backup', () => {
      const manifest = manager.createBackup(
        'mb-1',
        'user-1',
        [
          {
            messageId: 'msg-1',
            folder: 'INBOX',
            headers: {},
            subject: 'Test',
          },
        ]
      )

      const backups = manager.listBackups()
      const backupId = backups[0]

      const restored = manager.restoreBackup(backupId)
      expect(restored).toHaveLength(1)
      expect(restored[0].messageId).toBe('msg-1')
    })

    it('should throw error for non-existent backup', () => {
      expect(() => manager.restoreBackup('non-existent')).toThrow()
    })
  })

  describe('exportToJSON and importFromJSON', () => {
    it('should export and import backup', () => {
      manager.createBackup(
        'mb-1',
        'user-1',
        [
          {
            messageId: 'msg-1',
            folder: 'INBOX',
            headers: {},
            subject: 'Test',
          },
        ]
      )

      const backups = manager.listBackups()
      const backupId = backups[0]

      const json = manager.exportToJSON(backupId)
      expect(json).toBeDefined()
      expect(JSON.parse(json)).toBeDefined()

      const importedId = manager.importFromJSON(json)
      expect(importedId).toBeDefined()

      const restored = manager.restoreBackup(importedId)
      expect(restored).toHaveLength(1)
    })
  })
})

