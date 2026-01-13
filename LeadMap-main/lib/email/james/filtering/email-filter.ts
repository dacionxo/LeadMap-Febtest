/**
 * Email Filtering System
 * 
 * Email filtering patterns following james-project Sieve patterns
 * Simplified rule-based filtering system
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/data/data-api/src/main/java/org/apache/james/probe/SieveProbe.java
 * @see james-project server Sieve implementation
 */

/**
 * Filter condition type
 */
export type FilterConditionType =
  | 'header_contains'
  | 'header_equals'
  | 'from_equals'
  | 'from_contains'
  | 'subject_contains'
  | 'subject_equals'
  | 'body_contains'
  | 'size_over'
  | 'size_under'
  | 'has_attachment'
  | 'is_read'
  | 'is_unread'

/**
 * Filter action type
 */
export type FilterActionType =
  | 'fileinto' // Move to folder
  | 'redirect' // Forward to address
  | 'reject' // Reject message
  | 'discard' // Discard silently
  | 'addflag' // Add flag
  | 'removeflag' // Remove flag
  | 'stop' // Stop processing further rules

/**
 * Filter condition
 */
export interface FilterCondition {
  type: FilterConditionType
  field?: string // For header_contains, header_equals
  value: string | number // Value to match
  caseSensitive?: boolean // Case sensitivity (default: false)
}

/**
 * Filter action
 */
export interface FilterAction {
  type: FilterActionType
  value?: string // Folder name, email address, flag name, etc.
}

/**
 * Email filter rule
 */
export interface EmailFilterRule {
  id: string
  name: string
  enabled: boolean
  priority: number // Lower number = higher priority
  conditions: FilterCondition[]
  actions: FilterAction[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Filter result
 */
export interface FilterResult {
  matched: boolean
  ruleId?: string
  actions: FilterAction[]
  stopProcessing: boolean
}

/**
 * Email filter engine
 * Following james-project Sieve patterns
 */
export class EmailFilterEngine {
  private rules: EmailFilterRule[] = []

  /**
   * Add filter rule
   * 
   * @param rule - Filter rule
   */
  addRule(rule: EmailFilterRule): void {
    // Remove existing rule with same ID
    this.rules = this.rules.filter(r => r.id !== rule.id)
    this.rules.push(rule)
    this.sortRules()
  }

  /**
   * Remove filter rule
   * 
   * @param ruleId - Rule ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId)
  }

  /**
   * Get all rules
   * 
   * @returns Array of filter rules
   */
  getRules(): EmailFilterRule[] {
    return [...this.rules]
  }

  /**
   * Get rule by ID
   * 
   * @param ruleId - Rule ID
   * @returns Filter rule or undefined
   */
  getRule(ruleId: string): EmailFilterRule | undefined {
    return this.rules.find(r => r.id === ruleId)
  }

  /**
   * Apply filters to message
   * 
   * @param message - Message to filter
   * @returns Filter result
   */
  applyFilters(message: {
    headers: Record<string, string | string[]>
    from?: string
    subject?: string
    body?: string
    size?: number
    hasAttachments?: boolean
    flags?: string[]
  }): FilterResult {
    // Sort rules by priority
    const enabledRules = this.rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority)

    for (const rule of enabledRules) {
      if (this.matchesRule(message, rule)) {
        const hasStop = rule.actions.some(a => a.type === 'stop')

        return {
          matched: true,
          ruleId: rule.id,
          actions: rule.actions.filter(a => a.type !== 'stop'),
          stopProcessing: hasStop,
        }
      }
    }

    return {
      matched: false,
      actions: [],
      stopProcessing: false,
    }
  }

  /**
   * Check if message matches rule
   */
  private matchesRule(
    message: {
      headers: Record<string, string | string[]>
      from?: string
      subject?: string
      body?: string
      size?: number
      hasAttachments?: boolean
      flags?: string[]
    },
    rule: EmailFilterRule
  ): boolean {
    // All conditions must match (AND logic)
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(message, condition)) {
        return false
      }
    }
    return true
  }

  /**
   * Check if message matches condition
   */
  private matchesCondition(
    message: {
      headers: Record<string, string | string[]>
      from?: string
      subject?: string
      body?: string
      size?: number
      hasAttachments?: boolean
      flags?: string[]
    },
    condition: FilterCondition
  ): boolean {
    const caseSensitive = condition.caseSensitive ?? false

    switch (condition.type) {
      case 'header_contains':
        if (!condition.field) return false
        const headerValue = this.getHeaderValue(message.headers, condition.field)
        return this.contains(headerValue, String(condition.value), caseSensitive)

      case 'header_equals':
        if (!condition.field) return false
        const headerValue2 = this.getHeaderValue(message.headers, condition.field)
        return this.equals(headerValue2, String(condition.value), caseSensitive)

      case 'from_equals':
        return this.equals(message.from || '', String(condition.value), caseSensitive)

      case 'from_contains':
        return this.contains(message.from || '', String(condition.value), caseSensitive)

      case 'subject_contains':
        return this.contains(message.subject || '', String(condition.value), caseSensitive)

      case 'subject_equals':
        return this.equals(message.subject || '', String(condition.value), caseSensitive)

      case 'body_contains':
        return this.contains(message.body || '', String(condition.value), caseSensitive)

      case 'size_over':
        return (message.size || 0) > Number(condition.value)

      case 'size_under':
        return (message.size || 0) < Number(condition.value)

      case 'has_attachment':
        const hasAttachmentValue = condition.value === 'true' || condition.value === 1 || condition.value === '1'
        return message.hasAttachments === hasAttachmentValue

      case 'is_read':
        const isReadValue = condition.value === 'true' || condition.value === 1 || condition.value === '1'
        return message.flags?.includes('\\Seen') === isReadValue

      case 'is_unread':
        const isUnreadValue = condition.value === 'true' || condition.value === 1 || condition.value === '1'
        return !message.flags?.includes('\\Seen') === isUnreadValue

      default:
        return false
    }
  }

  /**
   * Get header value
   */
  private getHeaderValue(headers: Record<string, string | string[]>, name: string): string {
    const header = headers[name.toLowerCase()]
    if (!header) return ''
    if (Array.isArray(header)) {
      return header.join(' ')
    }
    return header
  }

  /**
   * String contains check
   */
  private contains(str: string, value: string, caseSensitive: boolean): boolean {
    if (caseSensitive) {
      return str.includes(value)
    }
    return str.toLowerCase().includes(value.toLowerCase())
  }

  /**
   * String equals check
   */
  private equals(str: string, value: string, caseSensitive: boolean): boolean {
    if (caseSensitive) {
      return str === value
    }
    return str.toLowerCase() === value.toLowerCase()
  }

  /**
   * Sort rules by priority
   */
  private sortRules(): void {
    this.rules.sort((a, b) => a.priority - b.priority)
  }
}

/**
 * Create email filter engine
 * 
 * @returns Email filter engine instance
 */
export function createEmailFilterEngine(): EmailFilterEngine {
  return new EmailFilterEngine()
}

