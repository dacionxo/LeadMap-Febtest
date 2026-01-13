/**
 * MDN (Message Disposition Notification) Handling
 * 
 * MDN handling patterns following james-project MDN implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project CHANGELOG.md: JAMES-3520 JMAP - Implement MDN - RFC-9007
 * @see RFC 3798, RFC 9007
 */

/**
 * MDN disposition type
 */
export type MDNDisposition = 'automatic-action' | 'manual-action'

/**
 * MDN disposition mode
 */
export type MDNDispositionMode = 'MDN-sent-automatically' | 'MDN-sent-manually'

/**
 * MDN disposition modifier
 */
export type MDNDispositionModifier = 'error' | 'warning' | 'failure' | 'expired' | 'mailbox-terminated' | 'mailbox-not-supported'

/**
 * MDN notification
 */
export interface MDNNotification {
  messageId: string
  originalMessageId: string
  originalRecipient: string
  finalRecipient: string
  disposition: {
    type: MDNDisposition
    mode: MDNDispositionMode
    modifier?: MDNDispositionModifier
  }
  reportingUA?: string
  originalRecipientAddress?: string
  finalRecipientAddress?: string
  originalMessageIdHeader?: string
  receivedAt: Date
}

/**
 * MDN parser
 * Following james-project MDN patterns
 */
export class MDNParser {
  /**
   * Parse MDN from email headers and body
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns MDN notification or null
   */
  parse(headers: Record<string, string | string[]>, body: string): MDNNotification | null {
    // Check for MDN headers
    const contentType = this.getHeader(headers, 'content-type')
    if (!contentType?.includes('multipart/report') || !contentType?.includes('report-type=disposition-notification')) {
      return null
    }

    // Extract MDN fields
    const originalRecipient = this.getHeader(headers, 'original-recipient')
    const finalRecipient = this.getHeader(headers, 'final-recipient')
    const originalMessageId = this.extractOriginalMessageId(headers, body)
    const disposition = this.parseDisposition(headers, body)
    const reportingUA = this.getHeader(headers, 'reporting-ua')

    if (!originalRecipient || !finalRecipient || !disposition) {
      return null
    }

    return {
      messageId: this.getHeader(headers, 'message-id') || `mdn_${Date.now()}`,
      originalMessageId: originalMessageId || '',
      originalRecipient,
      finalRecipient,
      disposition,
      reportingUA,
      originalRecipientAddress: this.extractEmail(originalRecipient),
      finalRecipientAddress: this.extractEmail(finalRecipient),
      originalMessageIdHeader: originalMessageId,
      receivedAt: new Date(),
    }
  }

  /**
   * Parse disposition from headers and body
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns Disposition or null
   */
  private parseDisposition(
    headers: Record<string, string | string[]>,
    body: string
  ): { type: MDNDisposition; mode: MDNDispositionMode; modifier?: MDNDispositionModifier } | null {
    // Try to extract from body first (more reliable)
    const dispositionMatch = body.match(/Disposition:\s*([^;]+)(?:;\s*([^;]+))?(?:;\s*([^;]+))?/i)
    if (dispositionMatch) {
      const type = dispositionMatch[1].trim() as MDNDisposition
      const mode = dispositionMatch[2]?.trim() as MDNDispositionMode | undefined
      const modifier = dispositionMatch[3]?.trim() as MDNDispositionModifier | undefined

      if (type && mode) {
        return {
          type,
          mode,
          modifier,
        }
      }
    }

    // Fallback to headers
    const disposition = this.getHeader(headers, 'disposition')
    if (disposition) {
      const parts = disposition.split(';').map(p => p.trim())
      return {
        type: parts[0] as MDNDisposition,
        mode: parts[1] as MDNDispositionMode,
        modifier: parts[2] as MDNDispositionModifier | undefined,
      }
    }

    return null
  }

  /**
   * Extract original message ID
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns Message ID or undefined
   */
  private extractOriginalMessageId(headers: Record<string, string | string[]>, body: string): string | undefined {
    // Try headers first
    const originalMessageId = this.getHeader(headers, 'original-message-id')
    if (originalMessageId) return originalMessageId

    // Try to extract from body
    const messageIdMatch = body.match(/Original-Message-ID:\s*<([^>]+)>/i) || body.match(/Message-ID:\s*<([^>]+)>/i)
    if (messageIdMatch) return messageIdMatch[1]

    return undefined
  }

  /**
   * Extract email from recipient string
   * 
   * @param recipient - Recipient string
   * @returns Email address
   */
  private extractEmail(recipient: string): string {
    // Format: "rfc822;user@example.com" or just "user@example.com"
    const match = recipient.match(/rfc822[;\s]+(.+)/i) || recipient.match(/([^\s;]+@[^\s;]+)/)
    return match ? match[1] : recipient
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
 * MDN handler
 * Following james-project MDN patterns
 */
export class MDNHandler {
  private parser: MDNParser

  constructor() {
    this.parser = new MDNParser()
  }

  /**
   * Process MDN notification
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns MDN notification or null
   */
  process(headers: Record<string, string | string[]>, body: string): MDNNotification | null {
    return this.parser.parse(headers, body)
  }

  /**
   * Check if message is an MDN
   * 
   * @param headers - Email headers
   * @returns True if MDN
   */
  isMDN(headers: Record<string, string | string[]>): boolean {
    const contentType = this.getHeader(headers, 'content-type')
    return contentType?.includes('multipart/report') === true &&
      contentType?.includes('report-type=disposition-notification') === true
  }

  /**
   * Check if MDN indicates read receipt
   * 
   * @param notification - MDN notification
   * @returns True if read receipt
   */
  isReadReceipt(notification: MDNNotification): boolean {
    return notification.disposition.mode === 'MDN-sent-automatically' &&
      notification.disposition.type === 'automatic-action'
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
 * Create MDN handler
 * 
 * @returns MDN handler instance
 */
export function createMDNHandler(): MDNHandler {
  return new MDNHandler()
}

