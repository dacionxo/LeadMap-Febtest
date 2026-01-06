/**
 * Email Compliance and Audit Logging
 * 
 * Audit logging patterns following james-project AuditTrail patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailrepository/mailrepository-memory/src/main/java/org/apache/james/mailrepository/memory/MemoryMailRepository.java
 * @see james-project AuditTrail implementation
 */

/**
 * Audit log entry type
 */
export type AuditLogType =
  | 'message_sent'
  | 'message_received'
  | 'message_deleted'
  | 'message_archived'
  | 'message_restored'
  | 'message_forwarded'
  | 'message_replied'
  | 'mailbox_created'
  | 'mailbox_deleted'
  | 'mailbox_updated'
  | 'folder_created'
  | 'folder_deleted'
  | 'access_granted'
  | 'access_revoked'
  | 'settings_changed'
  | 'filter_created'
  | 'filter_updated'
  | 'filter_deleted'

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  type: AuditLogType
  userId: string
  mailboxId?: string
  messageId?: string
  action: string
  protocol?: string // 'SMTP', 'IMAP', 'JMAP', etc.
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  parameters?: Record<string, unknown>
  result: 'success' | 'failure'
  error?: string
}

/**
 * Audit log query
 */
export interface AuditLogQuery {
  userId?: string
  mailboxId?: string
  messageId?: string
  type?: AuditLogType | AuditLogType[]
  dateFrom?: Date
  dateTo?: Date
  protocol?: string
  result?: 'success' | 'failure'
  limit?: number
  offset?: number
}

/**
 * Audit logger
 * Following james-project AuditTrail patterns
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = []
  private maxLogs = 100000 // Maximum number of logs to keep in memory

  /**
   * Log audit event
   * 
   * @param entry - Audit log entry (without id and timestamp)
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
    }

    this.logs.push(fullEntry)

    // Clean up old logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * Query audit logs
   * 
   * @param query - Query parameters
   * @returns Array of audit log entries
   */
  query(query: AuditLogQuery): AuditLogEntry[] {
    let results = [...this.logs]

    // Filter by userId
    if (query.userId) {
      results = results.filter(log => log.userId === query.userId)
    }

    // Filter by mailboxId
    if (query.mailboxId) {
      results = results.filter(log => log.mailboxId === query.mailboxId)
    }

    // Filter by messageId
    if (query.messageId) {
      results = results.filter(log => log.messageId === query.messageId)
    }

    // Filter by type
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type]
      results = results.filter(log => types.includes(log.type))
    }

    // Filter by date range
    if (query.dateFrom) {
      results = results.filter(log => log.timestamp >= query.dateFrom!)
    }
    if (query.dateTo) {
      results = results.filter(log => log.timestamp <= query.dateTo!)
    }

    // Filter by protocol
    if (query.protocol) {
      results = results.filter(log => log.protocol === query.protocol)
    }

    // Filter by result
    if (query.result) {
      results = results.filter(log => log.result === query.result)
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Apply pagination
    const offset = query.offset || 0
    const limit = query.limit || 100
    results = results.slice(offset, offset + limit)

    return results
  }

  /**
   * Get audit log by ID
   * 
   * @param id - Log ID
   * @returns Audit log entry or undefined
   */
  getLog(id: string): AuditLogEntry | undefined {
    return this.logs.find(log => log.id === id)
  }

  /**
   * Get audit statistics
   * 
   * @param userId - Optional user ID
   * @param dateFrom - Optional start date
   * @param dateTo - Optional end date
   * @returns Audit statistics
   */
  getStatistics(
    userId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): {
    total: number
    byType: Record<AuditLogType, number>
    byResult: { success: number; failure: number }
    byProtocol: Record<string, number>
  } {
    let logs = this.logs

    if (userId) {
      logs = logs.filter(log => log.userId === userId)
    }
    if (dateFrom) {
      logs = logs.filter(log => log.timestamp >= dateFrom)
    }
    if (dateTo) {
      logs = logs.filter(log => log.timestamp <= dateTo)
    }

    const byType: Partial<Record<AuditLogType, number>> = {}
    const byResult = { success: 0, failure: 0 }
    const byProtocol: Record<string, number> = {}

    for (const log of logs) {
      byType[log.type] = (byType[log.type] || 0) + 1
      byResult[log.result]++
      if (log.protocol) {
        byProtocol[log.protocol] = (byProtocol[log.protocol] || 0) + 1
      }
    }

    return {
      total: logs.length,
      byType: byType as Record<AuditLogType, number>,
      byResult,
      byProtocol,
    }
  }

  /**
   * Clear audit logs
   */
  clear(): void {
    this.logs = []
  }

  /**
   * Export audit logs
   * 
   * @param query - Query parameters
   * @returns JSON string
   */
  export(query?: AuditLogQuery): string {
    const logs = query ? this.query(query) : this.logs
    return JSON.stringify(logs, null, 2)
  }
}

/**
 * Create audit logger
 * 
 * @returns Audit logger instance
 */
export function createAuditLogger(): AuditLogger {
  return new AuditLogger()
}

