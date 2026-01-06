/**
 * Email Bounce Handling and Classification
 * 
 * Bounce handling patterns following james-project bounce implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/mailetcontainer-impl/src/main/java/org/apache/james/mailetcontainer/impl/JamesMailetContext.java
 * @see james-project/server/mailet/integration-testing/src/test/java/org/apache/james/mailets/BounceIntegrationTest.java
 */

import { DSNHandler, DSNNotification } from './dsn-handling'

/**
 * Bounce type
 */
export type BounceType = 'hard' | 'soft' | 'transient' | 'unknown'

/**
 * Bounce category
 */
export type BounceCategory =
  | 'mailbox_full'
  | 'mailbox_not_found'
  | 'domain_not_found'
  | 'relay_denied'
  | 'content_rejected'
  | 'spam_detected'
  | 'quota_exceeded'
  | 'message_too_large'
  | 'temporary_failure'
  | 'permanent_failure'
  | 'unknown'

/**
 * Bounce classification
 */
export interface BounceClassification {
  type: BounceType
  category: BounceCategory
  reason: string
  retryable: boolean
  shouldSuppress: boolean // Should suppress future emails to this address
}

/**
 * Bounce record
 */
export interface BounceRecord {
  messageId: string
  recipient: string
  sender?: string
  classification: BounceClassification
  dsn?: DSNNotification
  rawMessage?: string
  receivedAt: Date
}

/**
 * Bounce handler
 * Following james-project bounce patterns
 */
export class BounceHandler {
  private dsnHandler: DSNHandler

  constructor() {
    this.dsnHandler = new DSNHandler()
  }

  /**
   * Process bounce message
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @param sender - Original sender (if known)
   * @returns Bounce record or null
   */
  process(
    headers: Record<string, string | string[]>,
    body: string,
    sender?: string
  ): BounceRecord | null {
    // Try DSN first
    const dsn = this.dsnHandler.process(headers, body)
    if (dsn) {
      const classification = this.classifyDSN(dsn)
      return {
        messageId: dsn.messageId,
        recipient: dsn.finalRecipient,
        sender,
        classification,
        dsn,
        receivedAt: new Date(),
      }
    }

    // Try to classify from body
    const classification = this.classifyFromBody(body)
    if (classification) {
      const recipient = this.extractRecipient(headers, body)
      if (recipient) {
        return {
          messageId: this.getHeader(headers, 'message-id') || `bounce_${Date.now()}`,
          recipient,
          sender,
          classification,
          rawMessage: body,
          receivedAt: new Date(),
        }
      }
    }

    return null
  }

  /**
   * Classify DSN bounce
   * 
   * @param dsn - DSN notification
   * @returns Bounce classification
   */
  private classifyDSN(dsn: DSNNotification): BounceClassification {
    const status = dsn.status
    const diagnosticCode = dsn.diagnosticCode?.toLowerCase() || ''

    // Permanent failure (hard bounce)
    if (status.class === '5') {
      return this.classifyPermanentFailure(status, diagnosticCode)
    }

    // Temporary failure (soft bounce)
    if (status.class === '4') {
      return this.classifyTemporaryFailure(status, diagnosticCode)
    }

    // Success (shouldn't be a bounce, but handle it)
    return {
      type: 'unknown',
      category: 'unknown',
      reason: 'DSN indicates success',
      retryable: false,
      shouldSuppress: false,
    }
  }

  /**
   * Classify permanent failure
   * 
   * @param status - DSN status
   * @param diagnosticCode - Diagnostic code
   * @returns Bounce classification
   */
  private classifyPermanentFailure(status: DSNStatus, diagnosticCode: string): BounceClassification {
    // 5.1.x - Bad destination mailbox address
    if (status.subject === '1') {
      if (diagnosticCode.includes('user not found') || diagnosticCode.includes('no such user')) {
        return {
          type: 'hard',
          category: 'mailbox_not_found',
          reason: 'Mailbox does not exist',
          retryable: false,
          shouldSuppress: true,
        }
      }
      return {
        type: 'hard',
        category: 'mailbox_not_found',
        reason: 'Invalid mailbox address',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // 5.2.x - Bad destination system address
    if (status.subject === '2') {
      return {
        type: 'hard',
        category: 'domain_not_found',
        reason: 'Domain does not exist',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // 5.3.x - Bad destination mailbox address syntax
    if (status.subject === '3') {
      return {
        type: 'hard',
        category: 'mailbox_not_found',
        reason: 'Invalid email address syntax',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // 5.4.x - Destination mailbox address ambiguous
    if (status.subject === '4') {
      return {
        type: 'hard',
        category: 'mailbox_not_found',
        reason: 'Ambiguous mailbox address',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // 5.5.x - Destination address invalid
    if (status.subject === '5') {
      return {
        type: 'hard',
        category: 'mailbox_not_found',
        reason: 'Invalid destination address',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // Default permanent failure
    return {
      type: 'hard',
      category: 'permanent_failure',
      reason: 'Permanent delivery failure',
      retryable: false,
      shouldSuppress: true,
    }
  }

  /**
   * Classify temporary failure
   * 
   * @param status - DSN status
   * @param diagnosticCode - Diagnostic code
   * @returns Bounce classification
   */
  private classifyTemporaryFailure(status: DSNStatus, diagnosticCode: string): BounceClassification {
    // 4.1.x - Addressing problem
    if (status.subject === '1') {
      return {
        type: 'soft',
        category: 'temporary_failure',
        reason: 'Addressing problem',
        retryable: true,
        shouldSuppress: false,
      }
    }

    // 4.2.x - Mailbox full
    if (status.subject === '2') {
      return {
        type: 'soft',
        category: 'mailbox_full',
        reason: 'Mailbox is full',
        retryable: true,
        shouldSuppress: false,
      }
    }

    // 4.3.x - Mail system full
    if (status.subject === '3') {
      return {
        type: 'soft',
        category: 'quota_exceeded',
        reason: 'Mail system quota exceeded',
        retryable: true,
        shouldSuppress: false,
      }
    }

    // 4.4.x - Network routing problem
    if (status.subject === '4') {
      return {
        type: 'transient',
        category: 'temporary_failure',
        reason: 'Network routing problem',
        retryable: true,
        shouldSuppress: false,
      }
    }

    // Default temporary failure
    return {
      type: 'soft',
      category: 'temporary_failure',
      reason: 'Temporary delivery failure',
      retryable: true,
      shouldSuppress: false,
    }
  }

  /**
   * Classify bounce from body text
   * 
   * @param body - Email body
   * @returns Bounce classification or null
   */
  private classifyFromBody(body: string): BounceClassification | null {
    const lowerBody = body.toLowerCase()

    // Hard bounce indicators
    if (
      lowerBody.includes('user not found') ||
      lowerBody.includes('no such user') ||
      lowerBody.includes('mailbox not found') ||
      lowerBody.includes('invalid recipient') ||
      lowerBody.includes('address not found') ||
      lowerBody.includes('does not exist')
    ) {
      return {
        type: 'hard',
        category: 'mailbox_not_found',
        reason: 'Mailbox does not exist',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // Domain not found
    if (lowerBody.includes('domain not found') || lowerBody.includes('no such domain')) {
      return {
        type: 'hard',
        category: 'domain_not_found',
        reason: 'Domain does not exist',
        retryable: false,
        shouldSuppress: true,
      }
    }

    // Mailbox full
    if (lowerBody.includes('mailbox full') || lowerBody.includes('quota exceeded')) {
      return {
        type: 'soft',
        category: 'mailbox_full',
        reason: 'Mailbox is full',
        retryable: true,
        shouldSuppress: false,
      }
    }

    // Message too large
    if (lowerBody.includes('message too large') || lowerBody.includes('size limit exceeded')) {
      return {
        type: 'soft',
        category: 'message_too_large',
        reason: 'Message size exceeds limit',
        retryable: false,
        shouldSuppress: false,
      }
    }

    // Spam detected
    if (lowerBody.includes('spam') || lowerBody.includes('blocked') || lowerBody.includes('rejected')) {
      return {
        type: 'soft',
        category: 'spam_detected',
        reason: 'Message rejected as spam',
        retryable: false,
        shouldSuppress: false,
      }
    }

    return null
  }

  /**
   * Extract recipient from headers or body
   * 
   * @param headers - Email headers
   * @param body - Email body
   * @returns Recipient email or undefined
   */
  private extractRecipient(headers: Record<string, string | string[]>, body: string): string | undefined {
    // Try headers
    const to = this.getHeader(headers, 'to')
    if (to) {
      const emailMatch = to.match(/([^\s<>]+@[^\s<>]+)/)
      if (emailMatch) return emailMatch[1]
    }

    // Try body
    const recipientMatch = body.match(/(?:to|recipient):\s*([^\s<>]+@[^\s<>]+)/i)
    if (recipientMatch) return recipientMatch[1]

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
 * DSN status type (for bounce classification)
 */
interface DSNStatus {
  class: '2' | '4' | '5'
  subject: string
  detail: string
  text?: string
}

/**
 * Create bounce handler
 * 
 * @returns Bounce handler instance
 */
export function createBounceHandler(): BounceHandler {
  return new BounceHandler()
}

