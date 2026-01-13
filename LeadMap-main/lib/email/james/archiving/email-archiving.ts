/**
 * Email Archiving and Retention System
 * 
 * Email archiving patterns following james-project Deleted Messages Vault implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/src/adr/0075-deleted-message-vault.md
 * @see james-project/server/mailrepository/ MailRepository patterns
 */

/**
 * Retention policy
 */
export interface RetentionPolicy {
  id: string
  name: string
  enabled: boolean
  retentionDays: number // Days to retain messages
  archiveAfterDays?: number // Days before archiving (optional)
  deleteAfterDays?: number // Days before permanent deletion (optional)
  applyToFolders?: string[] // Specific folders (empty = all)
  excludeFolders?: string[] // Folders to exclude
}

/**
 * Archive entry
 */
export interface ArchiveEntry {
  messageId: string
  mailboxId: string
  userId: string
  folder: string
  archivedAt: Date
  expiresAt?: Date // When to delete from archive
  metadata: {
    from?: string
    to?: string[]
    subject?: string
    date?: Date
    size?: number
  }
}

/**
 * Email archiving manager
 * Following james-project Deleted Messages Vault patterns
 */
export class EmailArchivingManager {
  private retentionPolicies: Map<string, RetentionPolicy> = new Map()
  private archiveEntries: Map<string, ArchiveEntry> = new Map()

  /**
   * Add retention policy
   * 
   * @param policy - Retention policy
   */
  addPolicy(policy: RetentionPolicy): void {
    this.retentionPolicies.set(policy.id, policy)
  }

  /**
   * Remove retention policy
   * 
   * @param policyId - Policy ID
   */
  removePolicy(policyId: string): void {
    this.retentionPolicies.delete(policyId)
  }

  /**
   * Get policy
   * 
   * @param policyId - Policy ID
   * @returns Policy or undefined
   */
  getPolicy(policyId: string): RetentionPolicy | undefined {
    return this.retentionPolicies.get(policyId)
  }

  /**
   * Get all policies
   * 
   * @returns Array of policies
   */
  getPolicies(): RetentionPolicy[] {
    return Array.from(this.retentionPolicies.values())
  }

  /**
   * Archive message
   * 
   * @param message - Message to archive
   * @param policy - Retention policy to apply
   * @returns Archive entry
   */
  archiveMessage(
    message: {
      messageId: string
      mailboxId: string
      userId: string
      folder: string
      from?: string
      to?: string[]
      subject?: string
      date?: Date
      size?: number
    },
    policy: RetentionPolicy
  ): ArchiveEntry {
    const now = new Date()
    const expiresAt = policy.deleteAfterDays
      ? new Date(now.getTime() + policy.deleteAfterDays * 24 * 60 * 60 * 1000)
      : undefined

    const entry: ArchiveEntry = {
      messageId: message.messageId,
      mailboxId: message.mailboxId,
      userId: message.userId,
      folder: message.folder,
      archivedAt: now,
      expiresAt,
      metadata: {
        from: message.from,
        to: message.to,
        subject: message.subject,
        date: message.date,
        size: message.size,
      },
    }

    this.archiveEntries.set(message.messageId, entry)
    return entry
  }

  /**
   * Get archive entry
   * 
   * @param messageId - Message ID
   * @returns Archive entry or undefined
   */
  getArchiveEntry(messageId: string): ArchiveEntry | undefined {
    return this.archiveEntries.get(messageId)
  }

  /**
   * Restore message from archive
   * 
   * @param messageId - Message ID
   * @returns Archive entry or undefined
   */
  restoreMessage(messageId: string): ArchiveEntry | undefined {
    const entry = this.archiveEntries.get(messageId)
    if (entry) {
      // Remove from archive (restored)
      this.archiveEntries.delete(messageId)
    }
    return entry
  }

  /**
   * Check if message should be archived
   * 
   * @param message - Message to check
   * @returns Matching policy or null
   */
  shouldArchive(message: {
    folder: string
    date?: Date
  }): RetentionPolicy | null {
    const now = new Date()

    for (const policy of Array.from(this.retentionPolicies.values())) {
      if (!policy.enabled) continue

      // Check folder inclusion
      if (policy.applyToFolders && policy.applyToFolders.length > 0) {
        if (!policy.applyToFolders.includes(message.folder)) {
          continue
        }
      }

      // Check folder exclusion
      if (policy.excludeFolders?.includes(message.folder)) {
        continue
      }

      // Check archive after days
      if (policy.archiveAfterDays && message.date) {
        const daysSince = (now.getTime() - message.date.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince >= policy.archiveAfterDays) {
          return policy
        }
      }
    }

    return null
  }

  /**
   * Clean up expired archive entries
   * 
   * @returns Number of entries cleaned up
   */
  cleanupExpired(): number {
    const now = new Date()
    let cleaned = 0

    for (const [messageId, entry] of Array.from(this.archiveEntries.entries())) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.archiveEntries.delete(messageId)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get archive statistics
   * 
   * @returns Archive statistics
   */
  getStatistics(): {
    totalEntries: number
    totalSize: number
    entriesByFolder: Record<string, number>
    expiredEntries: number
  } {
    const now = new Date()
    let totalSize = 0
    const entriesByFolder: Record<string, number> = {}
    let expiredEntries = 0

    for (const entry of Array.from(this.archiveEntries.values())) {
      totalSize += entry.metadata.size || 0
      entriesByFolder[entry.folder] = (entriesByFolder[entry.folder] || 0) + 1

      if (entry.expiresAt && entry.expiresAt < now) {
        expiredEntries++
      }
    }

    return {
      totalEntries: this.archiveEntries.size,
      totalSize,
      entriesByFolder,
      expiredEntries,
    }
  }
}

/**
 * Create email archiving manager
 * 
 * @returns Email archiving manager instance
 */
export function createEmailArchivingManager(): EmailArchivingManager {
  return new EmailArchivingManager()
}

