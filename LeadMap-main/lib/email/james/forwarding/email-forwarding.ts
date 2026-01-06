/**
 * Email Forwarding Utilities
 * 
 * Email forwarding patterns following james-project implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project email forwarding patterns
 */

/**
 * Forwarding rule
 */
export interface ForwardingRule {
  id: string
  enabled: boolean
  fromAddress?: string // Forward emails from this address (empty = all)
  toAddresses: string[] // Forward to these addresses
  keepOriginal?: boolean // Keep original in inbox (default: true)
  subjectPrefix?: string // Prefix to add to subject (e.g., "Fwd: ")
  addNote?: boolean // Add forwarding note to body (default: true)
}

/**
 * Forwarding configuration
 */
export interface ForwardingConfig {
  rules: ForwardingRule[]
  defaultKeepOriginal?: boolean // Default: true
}

/**
 * Email forwarding manager
 * Following james-project forwarding patterns
 */
export class EmailForwardingManager {
  private config: ForwardingConfig

  constructor(config: ForwardingConfig = { rules: [] }) {
    this.config = {
      ...config,
      defaultKeepOriginal: config.defaultKeepOriginal ?? true,
    }
  }

  /**
   * Add forwarding rule
   * 
   * @param rule - Forwarding rule
   */
  addRule(rule: ForwardingRule): void {
    this.config.rules = this.config.rules.filter(r => r.id !== rule.id)
    this.config.rules.push(rule)
  }

  /**
   * Remove forwarding rule
   * 
   * @param ruleId - Rule ID
   */
  removeRule(ruleId: string): void {
    this.config.rules = this.config.rules.filter(r => r.id !== ruleId)
  }

  /**
   * Get all rules
   * 
   * @returns Array of forwarding rules
   */
  getRules(): ForwardingRule[] {
    return [...this.config.rules]
  }

  /**
   * Get rule by ID
   * 
   * @param ruleId - Rule ID
   * @returns Forwarding rule or undefined
   */
  getRule(ruleId: string): ForwardingRule | undefined {
    return this.config.rules.find(r => r.id === ruleId)
  }

  /**
   * Check if message should be forwarded
   * 
   * @param message - Message to check
   * @returns Matching forwarding rules
   */
  shouldForward(message: {
    from?: string
    to?: string | string[]
    headers?: Record<string, string | string[]>
  }): ForwardingRule[] {
    const matchingRules: ForwardingRule[] = []

    for (const rule of this.config.rules) {
      if (!rule.enabled) continue

      // Check from address filter
      if (rule.fromAddress) {
        const from = message.from?.toLowerCase() || ''
        if (from !== rule.fromAddress.toLowerCase()) {
          continue
        }
      }

      matchingRules.push(rule)
    }

    return matchingRules
  }

  /**
   * Generate forwarded email
   * 
   * @param originalMessage - Original message
   * @param rule - Forwarding rule
   * @returns Forwarded email details
   */
  generateForwardedEmail(
    originalMessage: {
      from?: string
      to?: string | string[]
      subject?: string
      body?: string
      headers?: Record<string, string | string[]>
      messageId?: string
    },
    rule: ForwardingRule
  ): {
    to: string[]
    subject: string
    body: string
    headers?: Record<string, string>
  } {
    const subject = rule.subjectPrefix
      ? `${rule.subjectPrefix}${originalMessage.subject || ''}`
      : originalMessage.subject || ''

    let body = originalMessage.body || ''

    // Add forwarding note
    if (rule.addNote !== false) {
      const note = `\n\n--- Forwarded message ---\nFrom: ${originalMessage.from || 'Unknown'}\nDate: ${new Date().toISOString()}\nSubject: ${originalMessage.subject || ''}\n\n`
      body = note + body
    }

    const headers: Record<string, string> = {
      'X-Forwarded-By': originalMessage.from || '',
      'X-Original-Message-ID': originalMessage.messageId || '',
    }

    return {
      to: rule.toAddresses,
      subject,
      body,
      headers,
    }
  }
}

/**
 * Create email forwarding manager
 * 
 * @param config - Forwarding configuration
 * @returns Email forwarding manager instance
 */
export function createEmailForwardingManager(config?: ForwardingConfig): EmailForwardingManager {
  return new EmailForwardingManager(config)
}

