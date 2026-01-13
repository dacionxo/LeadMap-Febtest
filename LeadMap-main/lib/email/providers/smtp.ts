/**
 * SMTP Email Provider
 * Uses nodemailer service wrapper to send emails via SMTP with OAuth2 support
 * 
 * Enhanced with james-project SMTP validation and routing patterns
 * Following .cursorrules: TypeScript best practices, error handling, early returns
 */

import type { Mailbox, EmailPayload, SendResult } from '../types'
import { sendEmailViaNodemailer } from '../nodemailer-service'
import { supportsOAuth2, hasOAuth2Tokens } from '../nodemailer/oauth2-config'
import { createTokenPersistence } from '../token-persistence'
import { isValidEmailAddress, parseEmailAddress } from '../james/validation/email-address'
import { validateRecipient, resolveRecipientRoute } from '../james/smtp/routing'

/**
 * Send email via SMTP using nodemailer service
 * 
 * Supports:
 * - OAuth2 authentication (Gmail, Outlook)
 * - Username/password authentication (generic SMTP)
 * - Connection pooling
 * - Automatic token refresh
 * - Retry logic with exponential backoff
 * 
 * @param mailbox - The mailbox to send from
 * @param email - Email payload
 * @returns Send result
 */
export async function smtpSend(mailbox: Mailbox, email: EmailPayload): Promise<SendResult> {
  try {
    // Early validation
    if (!mailbox.active) {
      return {
        success: false,
        error: 'Mailbox is not active',
      }
    }

    // Validate recipient email addresses using james-project patterns
    if (!isValidEmailAddress(email.to)) {
      return {
        success: false,
        error: `Invalid recipient email address: ${email.to}`,
      }
    }

    // Validate CC and BCC if provided
    if (email.cc) {
      const ccAddresses = email.cc.split(',').map(addr => addr.trim())
      for (const addr of ccAddresses) {
        if (!isValidEmailAddress(addr)) {
          return {
            success: false,
            error: `Invalid CC email address: ${addr}`,
          }
        }
      }
    }

    if (email.bcc) {
      const bccAddresses = email.bcc.split(',').map(addr => addr.trim())
      for (const addr of bccAddresses) {
        if (!isValidEmailAddress(addr)) {
          return {
            success: false,
            error: `Invalid BCC email address: ${addr}`,
          }
        }
      }
    }

    // Validate sender email address
    const senderEmail = email.fromEmail || mailbox.from_email || mailbox.email
    if (!isValidEmailAddress(senderEmail)) {
      return {
        success: false,
        error: `Invalid sender email address: ${senderEmail}`,
      }
    }

    // Validate recipient routing using james-project patterns
    const recipientRoute = resolveRecipientRoute(email.to)
    if (recipientRoute.route === 'error') {
      return {
        success: false,
        error: recipientRoute.errorMessage || 'Invalid recipient routing',
      }
    }

    // Validate recipient (check if relay is allowed for remote recipients)
    const senderIsAuthenticated = supportsOAuth2(mailbox) || !!mailbox.smtp_username
    const recipientValidation = validateRecipient(email.to, senderIsAuthenticated)
    if (recipientValidation.route === 'error') {
      return {
        success: false,
        error: recipientValidation.errorMessage || 'Recipient validation failed',
      }
    }

    // Check if OAuth2 is supported and available
    const useOAuth2 = supportsOAuth2(mailbox) && hasOAuth2Tokens(mailbox)

    // For non-OAuth providers, check SMTP credentials
    if (!useOAuth2) {
      const tokenPersistence = createTokenPersistence(mailbox)
      const decryptedMailbox = tokenPersistence.getDecryptedMailbox()

      if (
        !decryptedMailbox.smtp_host ||
        !decryptedMailbox.smtp_port ||
        !decryptedMailbox.smtp_username ||
        !decryptedMailbox.smtp_password
      ) {
        return {
          success: false,
          error: 'SMTP credentials are incomplete',
        }
      }
    }

    // Use nodemailer service to send email
    // The service handles OAuth2, connection pooling, retry logic, etc.
    return await sendEmailViaNodemailer(mailbox, email)
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via SMTP',
    }
  }
}

