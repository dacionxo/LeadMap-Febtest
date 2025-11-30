/**
 * Send Email Via Mailbox
 * Routes emails to the appropriate provider based on mailbox configuration
 * Includes retry logic with exponential backoff for transient failures
 */

import { Mailbox, EmailPayload, SendResult } from './types'
import { gmailSend } from './providers/gmail'
import { outlookSend } from './providers/outlook'
import { smtpSend } from './providers/smtp'
import { retryWithBackoff, isPermanentFailure } from './retry'

export async function sendViaMailbox(
  mailbox: Mailbox,
  email: EmailPayload
): Promise<SendResult> {
  try {
    // Validate mailbox is active
    if (!mailbox.active) {
      return {
        success: false,
        error: 'Mailbox is not active'
      }
    }

    // Send with retry logic for transient failures
    try {
      const result = await retryWithBackoff(async () => {
        // Route to appropriate provider
        let sendResult: SendResult

        switch (mailbox.provider) {
          case 'gmail':
            sendResult = await gmailSend(mailbox, email)
            break
          
          case 'outlook':
            sendResult = await outlookSend(mailbox, email)
            break
          
          case 'smtp':
            sendResult = await smtpSend(mailbox, email)
            break
          
          default:
            throw new Error(`Unsupported provider: ${mailbox.provider}`)
        }

        // If send failed with permanent error, don't retry
        if (!sendResult.success && sendResult.error && isPermanentFailure(sendResult.error)) {
          throw new Error(sendResult.error)
        }

        // If send failed, throw to trigger retry
        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send email')
        }

        return sendResult
      }, {
        maxRetries: 3,
        initialDelay: 2000, // Start with 2 seconds
        maxDelay: 30000, // Max 30 seconds
      })

      return result
    } catch (error: any) {
      // All retries exhausted or permanent failure
      return {
        success: false,
        error: error.message || 'Failed to send email after retries'
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via mailbox'
    }
  }
}

/**
 * Check mailbox rate limits
 * Returns whether sending is allowed and how many can be sent
 */
export async function checkMailboxLimits(
  mailbox: Mailbox,
  sentCounts: { hourly: number; daily: number }
): Promise<{ allowed: boolean; reason?: string; remainingHourly?: number; remainingDaily?: number }> {
  const { hourly, daily } = sentCounts

  // Check hourly limit
  if (hourly >= mailbox.hourly_limit) {
    return {
      allowed: false,
      reason: `Hourly limit of ${mailbox.hourly_limit} emails reached`,
      remainingHourly: 0,
      remainingDaily: Math.max(0, mailbox.daily_limit - daily)
    }
  }

  // Check daily limit
  if (daily >= mailbox.daily_limit) {
    return {
      allowed: false,
      reason: `Daily limit of ${mailbox.daily_limit} emails reached`,
      remainingHourly: Math.max(0, mailbox.hourly_limit - hourly),
      remainingDaily: 0
    }
  }

  return {
    allowed: true,
    remainingHourly: mailbox.hourly_limit - hourly,
    remainingDaily: mailbox.daily_limit - daily
  }
}

