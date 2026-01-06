/**
 * Vacation / Auto-Reply System
 * 
 * Vacation response patterns following james-project VacationMailet implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/ VacationMailet implementation
 * @see RFC 5230: Sieve Email Filtering: Vacation Extension
 */

/**
 * Vacation response configuration
 */
export interface VacationConfig {
  enabled: boolean
  subject?: string // Custom subject (default: "Auto: {original subject}")
  message: string // Vacation message body
  startDate?: Date // Start date for vacation
  endDate?: Date // End date for vacation
  daysBetweenResponses?: number // Minimum days between responses to same sender (default: 1)
  addresses?: string[] // Specific addresses to respond to (empty = all)
  excludeAddresses?: string[] // Addresses to exclude from auto-reply
  replyToAll?: boolean // Reply to all recipients (default: false)
}

/**
 * Vacation response record
 * Tracks sent vacation responses to prevent duplicates
 */
export interface VacationResponseRecord {
  sender: string
  lastSent: Date
  messageId?: string // Original message ID
}

/**
 * Vacation response manager
 * Following james-project VacationMailet patterns
 */
export class VacationResponseManager {
  private config: VacationConfig | null = null
  private responseHistory: Map<string, VacationResponseRecord> = new Map()
  private historyExpirationDays = 30 // Keep history for 30 days

  /**
   * Set vacation configuration
   * 
   * @param config - Vacation configuration
   */
  setConfig(config: VacationConfig): void {
    this.config = config
    // Clean up old history when setting new config
    this.cleanupHistory()
  }

  /**
   * Get vacation configuration
   * 
   * @returns Vacation configuration or null
   */
  getConfig(): VacationConfig | null {
    return this.config
  }

  /**
   * Check if vacation is active
   * 
   * @returns true if vacation is active
   */
  isActive(): boolean {
    if (!this.config || !this.config.enabled) {
      return false
    }

    const now = new Date()

    // Check start date
    if (this.config.startDate && now < this.config.startDate) {
      return false
    }

    // Check end date
    if (this.config.endDate && now > this.config.endDate) {
      return false
    }

    return true
  }

  /**
   * Check if should send vacation response
   * 
   * @param from - Sender email address
   * @param messageId - Original message ID
   * @returns true if should send response
   */
  shouldSendResponse(from: string, messageId?: string): boolean {
    if (!this.isActive()) {
      return false
    }

    if (!this.config) {
      return false
    }

    // Check if sender is excluded
    if (this.config.excludeAddresses?.includes(from.toLowerCase())) {
      return false
    }

    // Check if should only respond to specific addresses
    if (this.config.addresses && this.config.addresses.length > 0) {
      if (!this.config.addresses.includes(from.toLowerCase())) {
        return false
      }
    }

    // Check response history
    const daysBetween = this.config.daysBetweenResponses || 1
    const record = this.responseHistory.get(from.toLowerCase())

    if (record) {
      const daysSince = (Date.now() - record.lastSent.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < daysBetween) {
        return false
      }

      // Check if same message ID (prevent duplicate responses)
      if (messageId && record.messageId === messageId) {
        return false
      }
    }

    return true
  }

  /**
   * Record vacation response sent
   * 
   * @param from - Sender email address
   * @param messageId - Original message ID
   */
  recordResponse(from: string, messageId?: string): void {
    this.responseHistory.set(from.toLowerCase(), {
      sender: from.toLowerCase(),
      lastSent: new Date(),
      messageId,
    })
  }

  /**
   * Generate vacation response email
   * 
   * @param originalMessage - Original message details
   * @returns Vacation response email details
   */
  generateResponse(originalMessage: {
    from: string
    to: string | string[]
    subject?: string
    messageId?: string
  }): {
    to: string | string[]
    subject: string
    body: string
    inReplyTo?: string
    references?: string
  } {
    if (!this.config) {
      throw new Error('Vacation configuration not set')
    }

    const subject = this.config.subject || `Auto: ${originalMessage.subject || 'Re: Your message'}`
    const recipients = this.config.replyToAll && Array.isArray(originalMessage.to)
      ? originalMessage.to
      : originalMessage.from

    return {
      to: recipients,
      subject,
      body: this.config.message,
      inReplyTo: originalMessage.messageId,
      references: originalMessage.messageId,
    }
  }

  /**
   * Clean up old response history
   */
  private cleanupHistory(): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.historyExpirationDays)

    for (const [key, record] of this.responseHistory.entries()) {
      if (record.lastSent < cutoffDate) {
        this.responseHistory.delete(key)
      }
    }
  }

  /**
   * Clear all response history
   */
  clearHistory(): void {
    this.responseHistory.clear()
  }

  /**
   * Get response history
   * 
   * @returns Array of response records
   */
  getHistory(): VacationResponseRecord[] {
    return Array.from(this.responseHistory.values())
  }
}

/**
 * Create vacation response manager
 * 
 * @returns Vacation response manager instance
 */
export function createVacationResponseManager(): VacationResponseManager {
  return new VacationResponseManager()
}

