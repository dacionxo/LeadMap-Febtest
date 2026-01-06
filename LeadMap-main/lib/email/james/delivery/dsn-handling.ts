/**
 * DSN (Delivery Status Notification) Handling
 * 
 * DSN handling patterns following james-project DSN implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/remote-delivery-integration-testing/src/test/java/org/apache/james/smtp/dsn/DSNLocalIntegrationTest.java
 * @see james-project/server/mailet/mailetcontainer-impl/src/main/java/org/apache/james/mailetcontainer/impl/JamesMailetContext.java
 * @see RFC 3461, RFC 3464
 */

/**
 * DSN action type
 */
export type DSNAction = 'failed' | 'delayed' | 'delivered' | 'relayed' | 'expanded'

/**
 * DSN status code
 */
export interface DSNStatus {
  class: '2' | '4' | '5' // 2 = success, 4 = temporary failure, 5 = permanent failure
  subject: string // Subject code (e.g., '0.0', '1.1', '2.0')
  detail: string // Detail code (e.g., '0', '1', '2')
  text?: string // Human-readable text
}

/**
 * DSN notification
 */
export interface DSNNotification {
  messageId: string
  originalRecipient?: string
  finalRecipient: string
  action: DSNAction
  status: DSNStatus
  diagnosticCode?: string
  remoteMta?: string
  reportingMta?: string
  receivedAt: Date
  originalMessageId?: string
}

/**
 * DSN parser
 * Following james-project DSN patterns
 */
export class DSNParser {
  /**
   * Parse DSN from email headers and body
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns DSN notification or null
   */
  parse(headers: Record<string, string | string[]>, body: string): DSNNotification | null {
    // Check for DSN headers
    const contentType = this.getHeader(headers, 'content-type')
    if (!contentType?.includes('multipart/report') || !contentType?.includes('report-type=delivery-status')) {
      return null
    }

    // Extract DSN fields from headers
    const originalRecipient = this.getHeader(headers, 'original-recipient')
    const finalRecipient = this.getHeader(headers, 'final-recipient')
    const action = this.getHeader(headers, 'action') as DSNAction | undefined
    const status = this.getHeader(headers, 'status')
    const diagnosticCode = this.getHeader(headers, 'diagnostic-code')
    const remoteMta = this.getHeader(headers, 'remote-mta')
    const reportingMta = this.getHeader(headers, 'reporting-mta')
    const originalMessageId = this.extractMessageId(headers, body)

    if (!finalRecipient || !action || !status) {
      return null
    }

    const parsedStatus = this.parseStatus(status)

    return {
      messageId: this.getHeader(headers, 'message-id') || `dsn_${Date.now()}`,
      originalRecipient,
      finalRecipient: this.extractEmail(finalRecipient),
      action,
      status: parsedStatus,
      diagnosticCode,
      remoteMta,
      reportingMta,
      receivedAt: new Date(),
      originalMessageId,
    }
  }

  /**
   * Parse status code
   * 
   * @param status - Status string (e.g., "5.0.0")
   * @returns Parsed status
   */
  private parseStatus(status: string): DSNStatus {
    const parts = status.split('.')
    const classCode = parts[0] as '2' | '4' | '5'
    const subject = parts[1] || '0'
    const detail = parts[2] || '0'

    return {
      class: classCode,
      subject,
      detail,
      text: this.getStatusText(classCode, subject, detail),
    }
  }

  /**
   * Get status text
   * 
   * @param classCode - Class code
   * @param subject - Subject code
   * @param detail - Detail code
   * @returns Status text
   */
  private getStatusText(classCode: string, subject: string, detail: string): string {
    const statusMap: Record<string, string> = {
      '2.0.0': 'Success',
      '4.0.0': 'Temporary failure',
      '4.1.0': 'Addressing problem',
      '4.2.0': 'Mailbox full',
      '4.3.0': 'Mail system full',
      '4.4.0': 'Network routing problem',
      '5.0.0': 'Permanent failure',
      '5.1.0': 'Bad destination mailbox address',
      '5.2.0': 'Bad destination system address',
      '5.3.0': 'Bad destination mailbox address syntax',
      '5.4.0': 'Destination mailbox address ambiguous',
      '5.5.0': 'Destination address invalid',
    }

    const key = `${classCode}.${subject}.${detail}`
    return statusMap[key] || `Status ${classCode}.${subject}.${detail}`
  }

  /**
   * Extract email from final recipient
   * 
   * @param finalRecipient - Final recipient string
   * @returns Email address
   */
  private extractEmail(finalRecipient: string): string {
    // Format: "rfc822;user@example.com" or just "user@example.com"
    const match = finalRecipient.match(/rfc822[;\s]+(.+)/i) || finalRecipient.match(/([^\s;]+@[^\s;]+)/)
    return match ? match[1] : finalRecipient
  }

  /**
   * Extract original message ID from headers or body
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns Message ID or undefined
   */
  private extractMessageId(headers: Record<string, string | string[]>, body: string): string | undefined {
    // Try headers first
    const originalMessageId = this.getHeader(headers, 'original-message-id')
    if (originalMessageId) return originalMessageId

    // Try to extract from body
    const messageIdMatch = body.match(/Message-ID:\s*<([^>]+)>/i)
    if (messageIdMatch) return messageIdMatch[1]

    return undefined
  }

  /**
   * Get header value
   * 
   * @param headers - Headers
   * @param name - Header name
   * @returns Header value or undefined
   */
  private getHeader(headers: Record<string, string | string[]>, name: string): string | undefined {
    const value = headers[name.toLowerCase()]
    if (!value) return undefined
    return Array.isArray(value) ? value[0] : value
  }
}

/**
 * DSN handler
 * Following james-project DSNBounce patterns
 */
export class DSNHandler {
  private parser: DSNParser

  constructor() {
    this.parser = new DSNParser()
  }

  /**
   * Process DSN notification
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns DSN notification or null
   */
  process(headers: Record<string, string | string[]>, body: string): DSNNotification | null {
    return this.parser.parse(headers, body)
  }

  /**
   * Check if message is a DSN
   * 
   * @param headers - Email headers
   * @returns True if DSN
   */
  isDSN(headers: Record<string, string | string[]>): boolean {
    const contentType = this.getHeader(headers, 'content-type')
    return contentType?.includes('multipart/report') === true &&
      contentType?.includes('report-type=delivery-status') === true
  }

  /**
   * Classify DSN severity
   * 
   * @param notification - DSN notification
   * @returns Severity level
   */
  classifySeverity(notification: DSNNotification): 'success' | 'temporary' | 'permanent' {
    if (notification.status.class === '2') return 'success'
    if (notification.status.class === '4') return 'temporary'
    return 'permanent'
  }

  /**
   * Get header value
   * 
   * @param headers - Headers
   * @param name - Header name
   * @returns Header value or undefined
   */
  private getHeader(headers: Record<string, string | string[]>, name: string): string | undefined {
    const value = headers[name.toLowerCase()]
    if (!value) return undefined
    return Array.isArray(value) ? value[0] : value
  }
}

/**
 * Create DSN handler
 * 
 * @returns DSN handler instance
 */
export function createDSNHandler(): DSNHandler {
  return new DSNHandler()
}

