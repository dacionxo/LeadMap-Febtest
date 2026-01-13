/**
 * DLP (Data Loss Prevention) Detection
 * 
 * DLP patterns following james-project implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/integration-testing/src/test/java/org/apache/james/transport/mailets/DlpIntegrationTest.java
 * @see james-project/server/data/data-library/src/main/java/org/apache/james/dlp/
 */

/**
 * DLP rule type
 */
export type DLPRuleType = 'content' | 'header' | 'attachment' | 'sender' | 'recipient'

/**
 * DLP action
 */
export type DLPAction = 'quarantine' | 'reject' | 'log' | 'add_header'

/**
 * DLP rule
 */
export interface DLPRule {
  id: string
  name: string
  enabled: boolean
  type: DLPRuleType
  pattern: string | RegExp
  action: DLPAction
  description?: string
}

/**
 * DLP detection result
 */
export interface DLPDetectionResult {
  matched: boolean
  ruleId?: string
  ruleName?: string
  action: DLPAction
  explanation?: string
}

/**
 * DLP detector
 * Following james-project DLP patterns
 */
export class DLPDetector {
  private rules: DLPRule[] = []

  constructor(rules: DLPRule[] = []) {
    this.rules = rules
  }

  /**
   * Add DLP rule
   * 
   * @param rule - DLP rule
   */
  addRule(rule: DLPRule): void {
    this.rules = this.rules.filter(r => r.id !== rule.id)
    this.rules.push(rule)
  }

  /**
   * Remove DLP rule
   * 
   * @param ruleId - Rule ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId)
  }

  /**
   * Get all rules
   * 
   * @returns Array of DLP rules
   */
  getRules(): DLPRule[] {
    return [...this.rules]
  }

  /**
   * Detect DLP violations in message
   * 
   * @param message - Message to check
   * @returns DLP detection result
   */
  detect(message: {
    headers: Record<string, string | string[]>
    from?: string
    to?: string[]
    subject?: string
    body?: string
    bodyHtml?: string
    hasAttachments?: boolean
    attachmentNames?: string[]
  }): DLPDetectionResult {
    const enabledRules = this.rules.filter(r => r.enabled)

    for (const rule of enabledRules) {
      if (this.matchesRule(message, rule)) {
        return {
          matched: true,
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          explanation: rule.description || `Matched DLP rule: ${rule.name}`,
        }
      }
    }

    return {
      matched: false,
      action: 'log',
    }
  }

  /**
   * Check if message matches rule
   */
  private matchesRule(
    message: {
      headers: Record<string, string | string[]>
      from?: string
      to?: string[]
      subject?: string
      body?: string
      bodyHtml?: string
      hasAttachments?: boolean
      attachmentNames?: string[]
    },
    rule: DLPRule
  ): boolean {
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'i') : rule.pattern

    switch (rule.type) {
      case 'content':
        const content = (message.body || '') + ' ' + (message.bodyHtml || '')
        return pattern.test(content)

      case 'header':
        for (const [key, value] of Object.entries(message.headers)) {
          const headerValue = Array.isArray(value) ? value.join(' ') : value
          if (pattern.test(headerValue)) {
            return true
          }
        }
        return false

      case 'attachment':
        if (!message.hasAttachments) return false
        const attachmentNames = message.attachmentNames || []
        return attachmentNames.some(name => pattern.test(name))

      case 'sender':
        return pattern.test(message.from || '')

      case 'recipient':
        const recipients = message.to || []
        return recipients.some(recipient => pattern.test(recipient))

      default:
        return false
    }
  }
}

/**
 * Create DLP detector
 * 
 * @param rules - Initial DLP rules
 * @returns DLP detector instance
 */
export function createDLPDetector(rules?: DLPRule[]): DLPDetector {
  return new DLPDetector(rules)
}

