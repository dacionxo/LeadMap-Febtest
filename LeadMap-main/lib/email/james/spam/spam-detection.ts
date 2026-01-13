/**
 * Spam Detection System
 * 
 * Spam detection patterns following james-project RSPAMD/SpamAssassin patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/src/adr/0055-rspamd-spam-filtering.md
 * @see james-project spam detection mechanisms
 */

/**
 * Spam detection result
 */
export interface SpamDetectionResult {
  isSpam: boolean
  score: number // Spam score (0-100)
  threshold: number // Threshold for spam classification
  reasons: string[] // Reasons for spam classification
  headers?: Record<string, string> // Additional headers to add
}

/**
 * Spam detection rule
 */
export interface SpamRule {
  id: string
  name: string
  enabled: boolean
  type: 'header' | 'content' | 'sender' | 'url' | 'attachment'
  pattern: string | RegExp
  score: number // Score to add if matched
  description?: string
}

/**
 * Spam detector configuration
 */
export interface SpamDetectorConfig {
  threshold?: number // Default: 5.0
  rules?: SpamRule[]
  blacklist?: string[] // Email addresses or domains
  whitelist?: string[] // Email addresses or domains
}

/**
 * Spam detector
 * Following james-project spam detection patterns
 */
export class SpamDetector {
  private rules: SpamRule[] = []
  private blacklist: Set<string> = new Set()
  private whitelist: Set<string> = new Set()
  private threshold: number

  constructor(config: SpamDetectorConfig = {}) {
    this.threshold = config.threshold || 5.0
    if (config.rules) {
      this.rules = config.rules
    }
    if (config.blacklist) {
      for (const item of config.blacklist) {
        this.blacklist.add(item.toLowerCase())
      }
    }
    if (config.whitelist) {
      for (const item of config.whitelist) {
        this.whitelist.add(item.toLowerCase())
      }
    }
  }

  /**
   * Add spam rule
   * 
   * @param rule - Spam rule
   */
  addRule(rule: SpamRule): void {
    this.rules = this.rules.filter(r => r.id !== rule.id)
    this.rules.push(rule)
  }

  /**
   * Remove spam rule
   * 
   * @param ruleId - Rule ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId)
  }

  /**
   * Add to blacklist
   * 
   * @param item - Email address or domain
   */
  addToBlacklist(item: string): void {
    this.blacklist.add(item.toLowerCase())
  }

  /**
   * Add to whitelist
   * 
   * @param item - Email address or domain
   */
  addToWhitelist(item: string): void {
    this.whitelist.add(item.toLowerCase())
  }

  /**
   * Detect spam in message
   * 
   * @param message - Message to check
   * @returns Spam detection result
   */
  detect(message: {
    headers: Record<string, string | string[]>
    from?: string
    subject?: string
    body?: string
    bodyHtml?: string
    hasAttachments?: boolean
    attachmentNames?: string[]
  }): SpamDetectionResult {
    let score = 0
    const reasons: string[] = []

    // Check whitelist first
    if (this.isWhitelisted(message.from)) {
      return {
        isSpam: false,
        score: 0,
        threshold: this.threshold,
        reasons: ['Whitelisted sender'],
      }
    }

    // Check blacklist
    if (this.isBlacklisted(message.from)) {
      return {
        isSpam: true,
        score: 100,
        threshold: this.threshold,
        reasons: ['Blacklisted sender'],
      }
    }

    // Apply rules
    for (const rule of this.rules) {
      if (!rule.enabled) continue

      const match = this.matchesRule(message, rule)
      if (match) {
        score += rule.score
        reasons.push(rule.name || rule.id)
      }
    }

    // Check common spam patterns
    const commonPatterns = this.checkCommonSpamPatterns(message)
    score += commonPatterns.score
    reasons.push(...commonPatterns.reasons)

    const isSpam = score >= this.threshold

    return {
      isSpam,
      score,
      threshold: this.threshold,
      reasons,
      headers: {
        'X-Spam-Score': score.toFixed(2),
        'X-Spam-Status': isSpam ? 'Yes' : 'No',
        'X-Spam-Threshold': this.threshold.toFixed(2),
      },
    }
  }

  /**
   * Check if sender is whitelisted
   */
  private isWhitelisted(from?: string): boolean {
    if (!from) return false
    const email = from.toLowerCase()
    const domain = email.split('@')[1] || ''

    return this.whitelist.has(email) || this.whitelist.has(domain)
  }

  /**
   * Check if sender is blacklisted
   */
  private isBlacklisted(from?: string): boolean {
    if (!from) return false
    const email = from.toLowerCase()
    const domain = email.split('@')[1] || ''

    return this.blacklist.has(email) || this.blacklist.has(domain)
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
      bodyHtml?: string
      hasAttachments?: boolean
      attachmentNames?: string[]
    },
    rule: SpamRule
  ): boolean {
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'i') : rule.pattern

    switch (rule.type) {
      case 'header':
        for (const [key, value] of Object.entries(message.headers)) {
          const headerValue = Array.isArray(value) ? value.join(' ') : value
          if (pattern.test(headerValue)) {
            return true
          }
        }
        return false

      case 'content':
        const content = (message.body || '') + ' ' + (message.bodyHtml || '')
        return pattern.test(content)

      case 'sender':
        return pattern.test(message.from || '')

      case 'url':
        // Extract URLs from body
        const urlPattern = /https?:\/\/[^\s]+/gi
        const urls = (message.body || '').match(urlPattern) || []
        return urls.some(url => pattern.test(url))

      case 'attachment':
        if (!message.hasAttachments) return false
        const attachmentNames = message.attachmentNames || []
        return attachmentNames.some(name => pattern.test(name))

      default:
        return false
    }
  }

  /**
   * Check common spam patterns
   */
  private checkCommonSpamPatterns(message: {
    subject?: string
    body?: string
    bodyHtml?: string
  }): { score: number; reasons: string[] } {
    let score = 0
    const reasons: string[] = []

    const subject = (message.subject || '').toLowerCase()
    const body = ((message.body || '') + ' ' + (message.bodyHtml || '')).toLowerCase()

    // Common spam keywords
    const spamKeywords = [
      { pattern: /\b(viagra|cialis|pharmacy|pills)\b/i, score: 2.0 },
      { pattern: /\b(free\s+money|make\s+money|earn\s+\$\d+)\b/i, score: 2.0 },
      { pattern: /\b(click\s+here|act\s+now|limited\s+time)\b/i, score: 1.0 },
      { pattern: /\b(winner|congratulations|you\s+won)\b/i, score: 1.5 },
      { pattern: /\b(urgent|asap|immediate)\b/i, score: 0.5 },
    ]

    for (const keyword of spamKeywords) {
      if (keyword.pattern.test(subject) || keyword.pattern.test(body)) {
        score += keyword.score
        reasons.push('Spam keyword detected')
      }
    }

    // Excessive capitalization
    if (subject.length > 0) {
      const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length
      if (capsRatio > 0.5 && subject.length > 10) {
        score += 1.0
        reasons.push('Excessive capitalization')
      }
    }

    // Excessive exclamation marks
    const exclamationCount = (subject.match(/!/g) || []).length
    if (exclamationCount > 2) {
      score += 0.5 * exclamationCount
      reasons.push('Excessive exclamation marks')
    }

    return { score, reasons }
  }
}

/**
 * Create spam detector
 * 
 * @param config - Spam detector configuration
 * @returns Spam detector instance
 */
export function createSpamDetector(config?: SpamDetectorConfig): SpamDetector {
  return new SpamDetector(config)
}

