/**
 * Symphony Messenger Error Notifications
 * Sends notifications when errors occur
 * Inspired by Mautic notification patterns
 */

import type { MessageEnvelope } from '@/lib/types/symphony'
import { extractErrorInfo, isSymphonyError } from '../errors'

/**
 * Notification channel
 */
export type NotificationChannel = 'webhook' | 'email' | 'log' | 'slack' | 'custom'

/**
 * Error severity
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Error notification
 */
export interface ErrorNotification {
  /** Message envelope */
  envelope: MessageEnvelope
  /** Error that occurred */
  error: Error
  /** Error severity */
  severity: ErrorSeverity
  /** Retry count */
  retryCount: number
  /** Timestamp */
  timestamp: Date
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Notification handler interface
 */
export interface NotificationHandler {
  /**
   * Send notification
   */
  send(notification: ErrorNotification): Promise<void>
}

/**
 * Webhook notification handler
 */
export class WebhookNotificationHandler implements NotificationHandler {
  constructor(
    private url: string,
    private secret?: string
  ) {}

  async send(notification: ErrorNotification): Promise<void> {
    const payload = {
      event: 'symphony_error',
      timestamp: notification.timestamp.toISOString(),
      severity: notification.severity,
      message: {
        id: notification.envelope.id,
        type: notification.envelope.message.type,
        transport: notification.envelope.transportName,
        queue: notification.envelope.queueName,
      },
      error: extractErrorInfo(notification.error),
      retryCount: notification.retryCount,
      context: notification.context,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.secret) {
      headers['X-Symphony-Secret'] = this.secret
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error)
      throw error
    }
  }
}

/**
 * Email notification handler
 */
export class EmailNotificationHandler implements NotificationHandler {
  constructor(
    private recipients: string[],
    private fromEmail?: string
  ) {}

  async send(notification: ErrorNotification): Promise<void> {
    // In a real implementation, this would send an email
    // For now, we'll just log it
    console.log('Email notification:', {
      recipients: this.recipients,
      subject: `Symphony Error: ${notification.severity}`,
      body: this.formatEmailBody(notification),
    })

    // TODO: Integrate with email sending service
  }

  private formatEmailBody(notification: ErrorNotification): string {
    const errorInfo = extractErrorInfo(notification.error)
    return `
Symphony Messenger Error Notification

Severity: ${notification.severity}
Timestamp: ${notification.timestamp.toISOString()}

Message:
  ID: ${notification.envelope.id}
  Type: ${notification.envelope.message.type}
  Transport: ${notification.envelope.transportName}
  Queue: ${notification.envelope.queueName}

Error:
  Name: ${errorInfo.name}
  Message: ${errorInfo.message}
  Code: ${errorInfo.code || 'N/A'}
  Retryable: ${errorInfo.retryable ? 'Yes' : 'No'}

Retry Count: ${notification.retryCount}

Context:
${JSON.stringify(notification.context || {}, null, 2)}
    `.trim()
  }
}

/**
 * Log notification handler
 */
export class LogNotificationHandler implements NotificationHandler {
  async send(notification: ErrorNotification): Promise<void> {
    const errorInfo = extractErrorInfo(notification.error)
    const logLevel =
      notification.severity === 'critical' || notification.severity === 'high'
        ? 'error'
        : notification.severity === 'medium'
        ? 'warn'
        : 'info'

    const logData = {
      severity: notification.severity,
      messageId: notification.envelope.id,
      messageType: notification.envelope.message.type,
      transport: notification.envelope.transportName,
      queue: notification.envelope.queueName,
      error: errorInfo,
      retryCount: notification.retryCount,
      context: notification.context,
    }

    console[logLevel]('Symphony error notification', logData)
  }
}

/**
 * Error notification manager
 */
export class ErrorNotificationManager {
  private handlers: Map<NotificationChannel, NotificationHandler[]> = new Map()
  private severityThreshold: ErrorSeverity = 'medium'

  /**
   * Register a notification handler
   */
  registerHandler(
    channel: NotificationChannel,
    handler: NotificationHandler
  ): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, [])
    }
    this.handlers.get(channel)!.push(handler)
  }

  /**
   * Set severity threshold
   */
  setSeverityThreshold(severity: ErrorSeverity): void {
    this.severityThreshold = severity
  }

  /**
   * Send notification for an error
   */
  async notify(
    envelope: MessageEnvelope,
    error: Error,
    retryCount: number,
    context?: Record<string, unknown>
  ): Promise<void> {
    const severity = this.determineSeverity(error, retryCount)

    // Only notify if severity meets threshold
    if (!this.shouldNotify(severity)) {
      return
    }

    const notification: ErrorNotification = {
      envelope,
      error,
      severity,
      retryCount,
      timestamp: new Date(),
      context,
    }

    // Send to all registered handlers
    const promises: Promise<void>[] = []
    for (const handlers of this.handlers.values()) {
      for (const handler of handlers) {
        promises.push(
          handler.send(notification).catch((err) => {
            console.error('Failed to send notification:', err)
          })
        )
      }
    }

    await Promise.allSettled(promises)
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, retryCount: number): ErrorSeverity {
    if (isSymphonyError(error)) {
      // Critical errors
      if (
        error.code === 'CONFIGURATION_ERROR' ||
        error.code === 'TRANSPORT_ERROR'
      ) {
        return 'critical'
      }

      // High severity
      if (error.code === 'HANDLER_ERROR' && retryCount >= 3) {
        return 'high'
      }

      // Medium severity
      if (error.code === 'HANDLER_ERROR' || error.code === 'RETRY_STRATEGY_ERROR') {
        return 'medium'
      }
    }

    // Default based on retry count
    if (retryCount >= 5) {
      return 'high'
    }
    if (retryCount >= 3) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Check if notification should be sent
   */
  private shouldNotify(severity: ErrorSeverity): boolean {
    const severityLevels: ErrorSeverity[] = ['low', 'medium', 'high', 'critical']
    const thresholdIndex = severityLevels.indexOf(this.severityThreshold)
    const severityIndex = severityLevels.indexOf(severity)

    return severityIndex >= thresholdIndex
  }
}

/**
 * Global notification manager instance
 */
let globalNotificationManager: ErrorNotificationManager | null = null

/**
 * Get global notification manager
 */
export function getNotificationManager(): ErrorNotificationManager {
  if (!globalNotificationManager) {
    globalNotificationManager = new ErrorNotificationManager()
  }
  return globalNotificationManager
}

