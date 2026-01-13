/**
 * Email Search and Indexing Utilities
 * 
 * Email search patterns following james-project implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project mailbox indexing and search patterns
 */

/**
 * Search query operator
 */
export type SearchOperator = 'AND' | 'OR' | 'NOT'

/**
 * Search field
 */
export type SearchField =
  | 'subject'
  | 'from'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'body'
  | 'header'
  | 'hasAttachment'
  | 'isRead'
  | 'isUnread'
  | 'isFlagged'
  | 'date'
  | 'size'

/**
 * Search condition
 */
export interface SearchCondition {
  field: SearchField
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'gt' | 'lt' | 'gte' | 'lte'
  value: string | number | boolean | Date
  caseSensitive?: boolean
}

/**
 * Email search query
 */
export interface EmailSearchQuery {
  conditions: SearchCondition[]
  operator?: SearchOperator // Default: AND
  limit?: number
  offset?: number
  sortBy?: SearchField
  sortOrder?: 'asc' | 'desc'
}

/**
 * Email search result
 */
export interface EmailSearchResult {
  messageIds: string[]
  total: number
  limit: number
  offset: number
}

/**
 * Email search index entry
 */
export interface SearchIndexEntry {
  messageId: string
  mailboxId: string
  subject?: string
  from?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  body?: string
  bodyHtml?: string
  headers?: Record<string, string | string[]>
  hasAttachment?: boolean
  isRead?: boolean
  isFlagged?: boolean
  date?: Date
  size?: number
  indexedAt: Date
}

/**
 * Email search engine
 * Following james-project search patterns
 */
export class EmailSearchEngine {
  private index: Map<string, SearchIndexEntry> = new Map()

  /**
   * Index email message
   * 
   * @param entry - Search index entry
   */
  indexMessage(entry: SearchIndexEntry): void {
    this.index.set(entry.messageId, {
      ...entry,
      indexedAt: new Date(),
    })
  }

  /**
   * Remove message from index
   * 
   * @param messageId - Message ID
   */
  removeFromIndex(messageId: string): void {
    this.index.delete(messageId)
  }

  /**
   * Search emails
   * 
   * @param query - Email search query
   * @returns Email search results
   */
  search(query: EmailSearchQuery): EmailSearchResult {
    const operator = query.operator || 'AND'
    const allEntries = Array.from(this.index.values())

    // Filter entries based on conditions
    let matchingEntries = allEntries

    if (query.conditions.length > 0) {
      matchingEntries = allEntries.filter(entry => {
        if (operator === 'AND') {
          return query.conditions.every(condition => this.matchesCondition(entry, condition))
        } else if (operator === 'OR') {
          return query.conditions.some(condition => this.matchesCondition(entry, condition))
        } else {
          // NOT operator
          return !query.conditions.some(condition => this.matchesCondition(entry, condition))
        }
      })
    }

    // Sort results
    if (query.sortBy) {
      matchingEntries.sort((a, b) => {
        const aValue = this.getFieldValue(a, query.sortBy!)
        const bValue = this.getFieldValue(b, query.sortBy!)
        const order = query.sortOrder === 'desc' ? -1 : 1

        // Handle undefined values - treat as less than defined values
        if (aValue === undefined && bValue === undefined) return 0
        if (aValue === undefined) return 1 * order
        if (bValue === undefined) return -1 * order

        if (aValue < bValue) return -1 * order
        if (aValue > bValue) return 1 * order
        return 0
      })
    }

    // Apply pagination
    const offset = query.offset || 0
    const limit = query.limit || 100
    const paginatedEntries = matchingEntries.slice(offset, offset + limit)

    return {
      messageIds: paginatedEntries.map(e => e.messageId),
      total: matchingEntries.length,
      limit,
      offset,
    }
  }

  /**
   * Check if entry matches condition
   */
  private matchesCondition(entry: SearchIndexEntry, condition: SearchCondition): boolean {
    const fieldValue = this.getFieldValue(entry, condition.field)
    const operator = condition.operator || 'contains'
    const caseSensitive = condition.caseSensitive ?? false

    if (fieldValue === undefined || fieldValue === null) {
      return false
    }

    const fieldStr = String(fieldValue)
    const conditionStr = String(condition.value)

    switch (operator) {
      case 'equals':
        return caseSensitive
          ? fieldStr === conditionStr
          : fieldStr.toLowerCase() === conditionStr.toLowerCase()

      case 'contains':
        return caseSensitive
          ? fieldStr.includes(conditionStr)
          : fieldStr.toLowerCase().includes(conditionStr.toLowerCase())

      case 'startsWith':
        return caseSensitive
          ? fieldStr.startsWith(conditionStr)
          : fieldStr.toLowerCase().startsWith(conditionStr.toLowerCase())

      case 'endsWith':
        return caseSensitive
          ? fieldStr.endsWith(conditionStr)
          : fieldStr.toLowerCase().endsWith(conditionStr.toLowerCase())

      case 'matches':
        const regex = new RegExp(conditionStr, caseSensitive ? '' : 'i')
        return regex.test(fieldStr)

      case 'gt':
        return Number(fieldValue) > Number(condition.value)

      case 'lt':
        return Number(fieldValue) < Number(condition.value)

      case 'gte':
        return Number(fieldValue) >= Number(condition.value)

      case 'lte':
        return Number(fieldValue) <= Number(condition.value)

      default:
        return false
    }
  }

  /**
   * Get field value from entry
   */
  private getFieldValue(entry: SearchIndexEntry, field: SearchField): string | number | boolean | Date | undefined {
    switch (field) {
      case 'subject':
        return entry.subject
      case 'from':
        return entry.from
      case 'to':
        return entry.to?.join(', ')
      case 'cc':
        return entry.cc?.join(', ')
      case 'bcc':
        return entry.bcc?.join(', ')
      case 'body':
        return entry.body
      case 'hasAttachment':
        return entry.hasAttachment ?? false
      case 'isRead':
        return entry.isRead ?? false
      case 'isFlagged':
        return entry.isFlagged ?? false
      case 'date':
        return entry.date
      case 'size':
        return entry.size
      case 'header':
        // For header field, would need specific header name
        return undefined
      default:
        return undefined
    }
  }

  /**
   * Clear index
   */
  clearIndex(): void {
    this.index.clear()
  }

  /**
   * Get index size
   * 
   * @returns Number of indexed messages
   */
  getIndexSize(): number {
    return this.index.size
  }
}

/**
 * Create email search engine
 * 
 * @returns Email search engine instance
 */
export function createEmailSearchEngine(): EmailSearchEngine {
  return new EmailSearchEngine()
}

