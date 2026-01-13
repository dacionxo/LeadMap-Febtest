/**
 * nodemailer Service Wrapper
 * 
 * Comprehensive nodemailer service with OAuth2 support, connection pooling,
 * error handling, and retry logic
 * 
 * Following james-project patterns for email sending and error handling
 * Following .cursorrules: TypeScript best practices, error handling, early returns
 * 
 * @example
 * ```typescript
 * const service = new NodemailerService()
 * const result = await service.sendEmail(mailbox, emailPayload)
 * ```
 */

import type * as nodemailer from 'nodemailer'
import type { Mailbox, EmailPayload, SendResult } from './types'
import type { SendEmailOptions, SendEmailResult, RetryConfig } from './nodemailer/types'
import { getTransporterPool } from './nodemailer/transporter-pool'
import { createEmailError, requiresTokenRefresh, getRetryDelay, sleep } from './nodemailer/error-handler'
import { createTokenPersistence } from './token-persistence'
import { TokenExpiredError } from './errors'
import { createCircuitBreaker, CircuitBreaker } from './james/error-recovery/circuit-breaker'
import { transporterCache } from './james/performance/cache'
import { createPerSenderRateLimit, PerSenderRateLimit } from './james/rate-limiting/per-sender-rate-limit'
import { createGlobalRateLimit, GlobalRateLimit } from './james/rate-limiting/global-rate-limit'
import { globalMetricFactory } from './james/monitoring/metrics'
import { globalLogger } from './james/monitoring/logging'
import { globalEventBus } from './james/events/event-bus'
import { createMessageSentEvent, EmailEventType } from './james/events/email-events'

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ERATELIMIT'],
}

/**
 * nodemailer Service
 * 
 * Main service for sending emails via nodemailer with OAuth2 support
 * Enhanced with circuit breaker and caching for reliability and performance
 */
export class NodemailerService {
  private pool = getTransporterPool()
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private perSenderRateLimit?: PerSenderRateLimit
  private globalRateLimit?: GlobalRateLimit

  constructor(options?: {
    rateLimitConfig?: {
      perSender?: {
        duration: number
        count?: number
        recipients?: number
        size?: number
        totalSize?: number
      }
      global?: {
        duration: number
        count?: number
        recipients?: number
        size?: number
        totalSize?: number
      }
    }
  }) {
    // Initialize rate limiters if configured
    if (options?.rateLimitConfig?.perSender) {
      this.perSenderRateLimit = createPerSenderRateLimit({
        duration: options.rateLimitConfig.perSender.duration,
        count: options.rateLimitConfig.perSender.count,
        recipients: options.rateLimitConfig.perSender.recipients,
        size: options.rateLimitConfig.perSender.size,
        totalSize: options.rateLimitConfig.perSender.totalSize,
      })
    }

    if (options?.rateLimitConfig?.global) {
      this.globalRateLimit = createGlobalRateLimit({
        duration: options.rateLimitConfig.global.duration,
        count: options.rateLimitConfig.global.count,
        recipients: options.rateLimitConfig.global.recipients,
        size: options.rateLimitConfig.global.size,
        totalSize: options.rateLimitConfig.global.totalSize,
      })
    }
  }

  /**
   * Get or create circuit breaker for mailbox
   * 
   * @param mailboxId - Mailbox ID
   * @returns Circuit breaker instance
   */
  private getCircuitBreaker(mailboxId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(mailboxId)) {
      this.circuitBreakers.set(
        mailboxId,
        createCircuitBreaker({
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000, // 1 minute
          resetTimeout: 300000, // 5 minutes
        })
      )
    }
    return this.circuitBreakers.get(mailboxId)!
  }

  /**
   * Send email with retry logic and error handling
   * 
   * @param mailbox - The mailbox to send from
   * @param email - Email payload
   * @param options - Optional send options
   * @returns Send result
   */
  async sendEmail(
    mailbox: Mailbox,
    email: EmailPayload,
    options: Partial<SendEmailOptions> = {}
  ): Promise<SendEmailResult> {
    // Early validation
    if (!mailbox.active) {
      return {
        success: false,
        error: 'Mailbox is not active',
      }
    }

    // Get nodemailer module
    let nodemailerModule: typeof import('nodemailer')
    try {
      nodemailerModule = await import('nodemailer')
    } catch (error) {
      return {
        success: false,
        error: 'nodemailer package not available',
      }
    }

    // Get transporter from pool (with caching)
    let transporter: nodemailer.Transporter
    const cacheKey = `transporter_${mailbox.id}`
    
    try {
      // Check cache first
      const cached = transporterCache.get(cacheKey) as nodemailer.Transporter | undefined
      if (cached) {
        transporter = cached
      } else {
        transporter = await this.pool.getTransporter(mailbox, nodemailerModule)
        transporterCache.set(cacheKey, transporter, 10 * 60 * 1000) // Cache for 10 minutes
      }
    } catch (error) {
      const emailError = createEmailError(error, 'Failed to get transporter')
      return {
        success: false,
        error: emailError.message,
      }
    }

    // Build mail options
    const mailOptions = this.buildMailOptions(mailbox, email)

    // Calculate message size (approximate)
    const messageSize = this.calculateMessageSize(mailOptions)
    const recipientCount = this.countRecipients(mailOptions)

    // Check rate limits
    const senderEmail = mailbox.from_email || mailbox.email

    // Check per-sender rate limit
    if (this.perSenderRateLimit) {
      const senderLimitResult = await this.perSenderRateLimit.checkLimit(
        senderEmail,
        messageSize,
        recipientCount
      )
      if (!senderLimitResult.allowed) {
        // TypeScript narrowing: when allowed is false, reason and resetAt are guaranteed to exist
        const rateLimitError = senderLimitResult as { allowed: false; reason: string; resetAt: Date }
        globalLogger.warn('Per-sender rate limit exceeded', {
          protocol: 'SMTP',
          action: 'SEND',
          mailboxId: mailbox.id,
          senderEmail,
          reason: rateLimitError.reason,
        })
        return {
          success: false,
          error: `Rate limit exceeded: ${rateLimitError.reason}. Reset at ${rateLimitError.resetAt.toISOString()}`,
          attempts: 0,
        }
      }
    }

    // Check global rate limit
    if (this.globalRateLimit) {
      const globalLimitResult = await this.globalRateLimit.checkLimit(messageSize, recipientCount)
      if (!globalLimitResult.allowed) {
        // TypeScript narrowing: when allowed is false, reason and resetAt are guaranteed to exist
        const rateLimitError = globalLimitResult as { allowed: false; reason: string; resetAt: Date }
        globalLogger.warn('Global rate limit exceeded', {
          protocol: 'SMTP',
          action: 'SEND',
          mailboxId: mailbox.id,
          reason: rateLimitError.reason,
        })
        return {
          success: false,
          error: `Global rate limit exceeded: ${rateLimitError.reason}. Reset at ${rateLimitError.resetAt.toISOString()}`,
          attempts: 0,
        }
      }
    }

    // Retry configuration
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig }

    // Get circuit breaker for mailbox
    const circuitBreaker = this.getCircuitBreaker(mailbox.id)

    // Create timer metric
    const timer = globalMetricFactory.timer('email_send_duration', {
      mailboxId: mailbox.id,
      provider: mailbox.provider || 'unknown',
    })

    timer.start()

    // Send with circuit breaker protection and retry logic
    try {
      const result = await circuitBreaker.execute(async () => {
        return await this.sendWithRetry(transporter, mailOptions, mailbox, retryConfig)
      })

      timer.stopAndPublish()

      // Log success and publish event
      if (result.success) {
        globalLogger.info('Email sent successfully', {
          protocol: 'SMTP',
          action: 'SEND',
          mailboxId: mailbox.id,
          messageId: result.providerMessageId,
        })
        globalMetricFactory.counter('email_send_success', { provider: mailbox.provider || 'unknown' }).increment()

        // Publish message sent event
        // Convert Address objects to strings (nodemailer can use string | { name?: string; address: string })
        const normalizeAddress = (addr: string | { name?: string; address: string }): string => {
          if (typeof addr === 'string') return addr
          return addr.address || ''
        }
        const toAddresses = Array.isArray(mailOptions.to)
          ? mailOptions.to.map(normalizeAddress)
          : mailOptions.to
          ? [normalizeAddress(mailOptions.to)]
          : []
        
        const event = createMessageSentEvent({
          messageId: result.providerMessageId || `msg_${Date.now()}`,
          mailboxId: mailbox.id,
          userId: mailbox.user_id || '',
          from: senderEmail,
          to: toAddresses,
          subject: mailOptions.subject || '',
          provider: mailbox.provider || 'unknown',
          providerMessageId: result.providerMessageId,
        })

        // Publish asynchronously (don't wait)
        globalEventBus.publish(event).catch(error => {
          globalLogger.error('Failed to publish message sent event', error, {
            protocol: 'EVENT',
            action: 'PUBLISH',
            eventType: EmailEventType.MESSAGE_SENT,
          })
        })
      } else {
        globalLogger.error('Email send failed', undefined, {
          protocol: 'SMTP',
          action: 'SEND',
          mailboxId: mailbox.id,
          error: result.error,
        })
        globalMetricFactory.counter('email_send_failure', { provider: mailbox.provider || 'unknown' }).increment()
      }

      return result
    } catch (error) {
      timer.stopAndPublish()
      // Circuit breaker rejected the request
      globalLogger.error('Circuit breaker rejected request', error instanceof Error ? error : undefined, {
        protocol: 'SMTP',
        action: 'SEND',
        mailboxId: mailbox.id,
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Circuit breaker is open',
        attempts: 0,
      }
    }
  }

  /**
   * Build nodemailer mail options from email payload
   * 
   * Supports:
   * - HTML and plain text alternatives
   * - Attachments (files, buffers, streams, URLs)
   * - Threading headers (In-Reply-To, References)
   * - Custom headers
   */
  private buildMailOptions(
    mailbox: Mailbox,
    email: EmailPayload
  ): nodemailer.SendMailOptions {
    const fromEmail = email.fromEmail || mailbox.from_email || mailbox.email
    const fromName = email.fromName || mailbox.from_name || mailbox.display_name || fromEmail

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email.to,
      subject: email.subject,
      html: email.html,
    }

    // Add plain text alternative if provided
    if (email.text) {
      mailOptions.text = email.text
    }

    // Add optional fields
    if (email.cc) {
      mailOptions.cc = email.cc
    }

    if (email.bcc) {
      mailOptions.bcc = email.bcc
    }

    if (email.replyTo) {
      mailOptions.replyTo = email.replyTo
    }

    // Add attachments if provided
    if (email.attachments && email.attachments.length > 0) {
      mailOptions.attachments = email.attachments
        .filter((att) => {
          // Filter out attachments with incompatible stream types (ReadableStream from Web Streams API)
          // nodemailer expects Readable from Node.js streams, not ReadableStream
          if (att.content && typeof att.content !== 'string' && !Buffer.isBuffer(att.content)) {
            // Check if it's a Node.js Readable stream (has readable property)
            const stream = att.content as any
            if (stream && typeof stream.readable === 'boolean') {
              return true // It's a Node.js Readable stream
            }
            // If it's a Web ReadableStream, we can't use it directly
            // In a real implementation, we'd need to convert it
            return false
          }
          return true
        })
        .map((att) => ({
          filename: att.filename,
          content: att.content as string | Buffer | undefined,
          path: att.path,
          href: att.href,
          contentType: att.contentType,
          contentDisposition: att.contentDisposition,
          cid: att.cid,
          encoding: att.encoding,
          headers: att.headers,
        }))
    }

    // Add threading headers (following james-project patterns)
    mailOptions.headers = {
      ...(email.headers || {}),
    }

    if (email.inReplyTo) {
      mailOptions.headers['In-Reply-To'] = email.inReplyTo
    }

    if (email.references) {
      mailOptions.headers['References'] = email.references
    }

    return mailOptions
  }

  /**
   * Calculate approximate message size
   * 
   * @param mailOptions - Mail options
   * @returns Approximate size in bytes
   */
  private calculateMessageSize(mailOptions: nodemailer.SendMailOptions): number {
    let size = 0

    // Headers
    // FROM: Can be string | Address | Address[]
    if (mailOptions.from) {
      if (typeof mailOptions.from === 'string') {
        size += mailOptions.from.length
      } else if (Array.isArray(mailOptions.from)) {
        for (const f of mailOptions.from) {
          if (typeof f === 'string') {
            size += f.length
          } else if (typeof f === 'object' && f !== null && 'address' in f && typeof f.address === 'string') {
            if ('name' in f && typeof f.name === 'string') size += f.name.length
            size += f.address.length
          }
        }
      } else if (typeof mailOptions.from === 'object' && mailOptions.from !== null && 'address' in mailOptions.from && typeof mailOptions.from.address === 'string') {
        if ('name' in mailOptions.from && typeof mailOptions.from.name === 'string') size += mailOptions.from.name.length
        size += mailOptions.from.address.length
      }
    }

    // TO: Can be string | Address | (Array<string|Address>)
    if (mailOptions.to) {
      const tos = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]
      for (const t of tos) {
        if (typeof t === 'string') {
          size += t.length
        } else if (typeof t === 'object' && t !== null && 'address' in t && typeof t.address === 'string') {
          if ('name' in t && typeof t.name === 'string') size += t.name.length
          size += t.address.length
        }
      }
    }

    // CC: Can be string | Address | (Array<string|Address>)
    if (mailOptions.cc) {
      const ccs = Array.isArray(mailOptions.cc) ? mailOptions.cc : [mailOptions.cc]
      for (const c of ccs) {
        if (typeof c === 'string') {
          size += c.length
        } else if (typeof c === 'object' && c !== null && 'address' in c && typeof c.address === 'string') {
          if ('name' in c && typeof c.name === 'string') size += c.name.length
          size += c.address.length
        }
      }
    }
    // BCC: Can be string | Address | (Array<string|Address>)
    if (mailOptions.bcc) {
      const bccs = Array.isArray(mailOptions.bcc) ? mailOptions.bcc : [mailOptions.bcc]
      for (const b of bccs) {
        if (typeof b === 'string') {
          size += b.length
        } else if (typeof b === 'object' && b !== null && 'address' in b && typeof b.address === 'string') {
          if ('name' in b && typeof b.name === 'string') size += b.name.length
          size += b.address.length
        }
      }
    }
    if (mailOptions.subject) size += mailOptions.subject.length
    if (mailOptions.headers) {
      size += JSON.stringify(mailOptions.headers).length
    }

    // Body
    if (mailOptions.html && typeof mailOptions.html === 'string') {
      size += mailOptions.html.length
    }
    if (mailOptions.text && typeof mailOptions.text === 'string') {
      size += mailOptions.text.length
    }

    // Attachments
    if (mailOptions.attachments) {
      for (const attachment of mailOptions.attachments) {
        if (attachment.content) {
          if (typeof attachment.content === 'string') {
            size += Buffer.byteLength(attachment.content, 'utf-8')
          } else if (Buffer.isBuffer(attachment.content)) {
            size += attachment.content.length
          }
          // Skip Readable streams - cannot determine size without reading
          // Skip AttachmentLike (path/href) - size calculation would require file system access
        }
        if (attachment.path) {
          // Approximate - actual file size would require filesystem access
          size += 10000 // Estimate
        }
      }
    }

    return size
  }

  /**
   * Count recipients
   * 
   * @param mailOptions - Mail options
   * @returns Recipient count
   */
  private countRecipients(mailOptions: nodemailer.SendMailOptions): number {
    let count = 0

    if (mailOptions.to) {
      count += Array.isArray(mailOptions.to) ? mailOptions.to.length : 1
    }
    if (mailOptions.cc) {
      count += Array.isArray(mailOptions.cc) ? mailOptions.cc.length : 1
    }
    if (mailOptions.bcc) {
      count += Array.isArray(mailOptions.bcc) ? mailOptions.bcc.length : 1
    }

    return count || 1 // At least 1 recipient
  }

  /**
   * Send email with retry logic and exponential backoff
   */
  private async sendWithRetry(
    transporter: nodemailer.Transporter,
    mailOptions: nodemailer.SendMailOptions,
    mailbox: Mailbox,
    retryConfig: RetryConfig
  ): Promise<SendEmailResult> {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const info = await transporter.sendMail(mailOptions)

        return {
          success: true,
          providerMessageId: info.messageId || `smtp_${Date.now()}`,
          attempts: attempt,
        }
      } catch (error) {
        lastError = error
        const emailError = createEmailError(error, `Send attempt ${attempt}`)

        // Check if error requires token refresh
        if (requiresTokenRefresh(error) && attempt < retryConfig.maxRetries) {
          try {
            await this.refreshTransporterAuth(transporter, mailbox)
            // Retry immediately after token refresh
            continue
          } catch (refreshError) {
            // Token refresh failed, return error
            return {
              success: false,
              error: `Token refresh failed: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
              attempts: attempt,
            }
          }
        }

        // Check if error is retryable
        if (!emailError.retryable || attempt >= retryConfig.maxRetries) {
          return {
            success: false,
            error: emailError.message,
            attempts: attempt,
          }
        }

        // Calculate delay and wait
        const delay = getRetryDelay(attempt, {
          initialDelayMs: retryConfig.initialDelayMs,
          maxDelayMs: retryConfig.maxDelayMs,
          backoffFactor: retryConfig.backoffFactor,
        })

        await sleep(delay)
      }
    }

    // All retries exhausted
    const finalError = createEmailError(lastError, 'All retry attempts exhausted')
    return {
      success: false,
      error: finalError.message,
      attempts: retryConfig.maxRetries,
    }
  }

  /**
   * Refresh OAuth2 token for transporter
   * 
   * Note: This method refreshes the token and updates the transporter pool,
   * but does not persist tokens to database. Token persistence should be
   * handled by the caller (e.g., unified OAuth service in Phase 4).
   */
  private async refreshTransporterAuth(
    transporter: nodemailer.Transporter,
    mailbox: Mailbox
  ): Promise<void> {
    // Import token refresh utility
    const { refreshOAuth2Token } = await import('./nodemailer/token-refresh')
    
    // Refresh token
    const refreshResult = await refreshOAuth2Token(mailbox)
    
    // Update transporter auth
    // Note: nodemailer doesn't support updating auth after creation,
    // so we need to remove the old transporter and create a new one
    this.pool.removeTransporter(mailbox.id)
    
    // Update mailbox with new token (temporary, for transporter creation)
    // The actual database update should be done by the OAuth service
    const updatedMailbox: Mailbox = {
      ...mailbox,
      access_token: refreshResult.accessToken,
      token_expires_at: refreshResult.expiresAt,
    }
    
    // Get nodemailer module
    const nodemailerModule = await import('nodemailer')
    
    // Create new transporter with refreshed token
    await this.pool.getTransporter(updatedMailbox, nodemailerModule)
  }

  /**
   * Verify transporter connection
   * 
   * @param mailbox - The mailbox
   * @returns true if transporter is healthy
   */
  async verifyTransporter(mailbox: Mailbox): Promise<boolean> {
    try {
      const health = await this.pool.verifyTransporter(mailbox.id)
      return health.healthy
    } catch (error) {
      console.error('Transporter verification error:', error)
      return false
    }
  }

  /**
   * Get transporter health status
   */
  getTransporterHealth(mailboxId: string) {
    return this.pool.getTransporterHealth(mailboxId)
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return this.pool.getStats()
  }
}

/**
 * Create nodemailer service instance
 */
export function createNodemailerService(): NodemailerService {
  return new NodemailerService()
}

/**
 * Send email using nodemailer service (convenience function)
 */
export async function sendEmailViaNodemailer(
  mailbox: Mailbox,
  email: EmailPayload,
  options?: Partial<SendEmailOptions>
): Promise<SendResult> {
  const service = createNodemailerService()
  return await service.sendEmail(mailbox, email, options)
}

