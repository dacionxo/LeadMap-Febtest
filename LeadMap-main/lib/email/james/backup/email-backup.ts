/**
 * Email Backup and Restore Utilities
 * 
 * Email backup patterns following james-project MailRepository patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailrepository/ MailRepository implementation
 */

/**
 * Backup configuration
 */
export interface BackupConfig {
  includeAttachments?: boolean // Default: true
  includeMetadata?: boolean // Default: true
  compression?: boolean // Default: false
  format?: 'json' | 'eml' | 'mbox' // Default: 'json'
}

/**
 * Backup entry
 */
export interface BackupEntry {
  messageId: string
  mailboxId: string
  folder: string
  message: {
    headers: Record<string, string | string[]>
    body?: string
    bodyHtml?: string
    attachments?: Array<{
      filename: string
      contentType: string
      size: number
      data?: string // Base64 encoded
    }>
  }
  metadata: {
    from?: string
    to?: string[]
    subject?: string
    date?: Date
    flags?: string[]
    size?: number
  }
  backedUpAt: Date
}

/**
 * Backup manifest
 */
export interface BackupManifest {
  version: string
  createdAt: Date
  mailboxId: string
  userId: string
  totalMessages: number
  totalSize: number
  entries: Array<{
    messageId: string
    folder: string
    size: number
  }>
}

/**
 * Email backup manager
 * Following james-project MailRepository patterns
 */
export class EmailBackupManager {
  private backups: Map<string, BackupEntry[]> = new Map()

  /**
   * Create backup
   * 
   * @param mailboxId - Mailbox ID
   * @param messages - Messages to backup
   * @param config - Backup configuration
   * @returns Backup manifest
   */
  createBackup(
    mailboxId: string,
    userId: string,
    messages: Array<{
      messageId: string
      folder: string
      headers: Record<string, string | string[]>
      body?: string
      bodyHtml?: string
      attachments?: Array<{
        filename: string
        contentType: string
        size: number
        data?: string
      }>
      from?: string
      to?: string[]
      subject?: string
      date?: Date
      flags?: string[]
      size?: number
    }>,
    config: BackupConfig = {}
  ): BackupManifest {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const entries: BackupEntry[] = []

    let totalSize = 0

    for (const message of messages) {
      const entry: BackupEntry = {
        messageId: message.messageId,
        mailboxId,
        folder: message.folder,
        message: {
          headers: message.headers,
          body: config.includeMetadata !== false ? message.body : undefined,
          bodyHtml: config.includeMetadata !== false ? message.bodyHtml : undefined,
          attachments: config.includeAttachments !== false ? message.attachments : undefined,
        },
        metadata: {
          from: message.from,
          to: message.to,
          subject: message.subject,
          date: message.date,
          flags: message.flags,
          size: message.size,
        },
        backedUpAt: new Date(),
      }

      entries.push(entry)
      totalSize += message.size || 0
    }

    this.backups.set(backupId, entries)

    const manifest: BackupManifest = {
      version: '1.0',
      createdAt: new Date(),
      mailboxId,
      userId,
      totalMessages: entries.length,
      totalSize,
      entries: entries.map(e => ({
        messageId: e.messageId,
        folder: e.folder,
        size: e.metadata.size || 0,
      })),
    }

    return manifest
  }

  /**
   * Get backup entries
   * 
   * @param backupId - Backup ID
   * @returns Backup entries or undefined
   */
  getBackup(backupId: string): BackupEntry[] | undefined {
    return this.backups.get(backupId)
  }

  /**
   * Restore from backup
   * 
   * @param backupId - Backup ID
   * @returns Restored messages
   */
  restoreBackup(backupId: string): BackupEntry[] {
    const entries = this.backups.get(backupId)
    if (!entries) {
      throw new Error(`Backup ${backupId} not found`)
    }
    return entries
  }

  /**
   * Delete backup
   * 
   * @param backupId - Backup ID
   */
  deleteBackup(backupId: string): void {
    this.backups.delete(backupId)
  }

  /**
   * List backups
   * 
   * @returns Array of backup IDs
   */
  listBackups(): string[] {
    return Array.from(this.backups.keys())
  }

  /**
   * Export backup to JSON
   * 
   * @param backupId - Backup ID
   * @returns JSON string
   */
  exportToJSON(backupId: string): string {
    const entries = this.backups.get(backupId)
    if (!entries) {
      throw new Error(`Backup ${backupId} not found`)
    }

    const manifest: BackupManifest = {
      version: '1.0',
      createdAt: new Date(),
      mailboxId: entries[0]?.mailboxId || '',
      userId: '',
      totalMessages: entries.length,
      totalSize: entries.reduce((sum, e) => sum + (e.metadata.size || 0), 0),
      entries: entries.map(e => ({
        messageId: e.messageId,
        folder: e.folder,
        size: e.metadata.size || 0,
      })),
    }

    return JSON.stringify({
      manifest,
      entries,
    }, null, 2)
  }

  /**
   * Import backup from JSON
   * 
   * @param json - JSON string
   * @returns Backup ID
   */
  importFromJSON(json: string): string {
    const data = JSON.parse(json)
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(7)}`

    this.backups.set(backupId, data.entries || data)

    return backupId
  }
}

/**
 * Create email backup manager
 * 
 * @returns Email backup manager instance
 */
export function createEmailBackupManager(): EmailBackupManager {
  return new EmailBackupManager()
}

