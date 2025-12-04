/**
 * SMTP Email Provider
 * Uses Node.js nodemailer to send emails via SMTP
 */

import { Mailbox, EmailPayload, SendResult } from '../types'
import { decryptMailboxTokens } from '../encryption'

/**
 * Decrypt mailbox tokens/passwords for use
 */
function getDecryptedMailbox(mailbox: Mailbox): Mailbox {
  const decrypted = decryptMailboxTokens({
    access_token: mailbox.access_token,
    refresh_token: mailbox.refresh_token,
    smtp_password: mailbox.smtp_password
  })

  return {
    ...mailbox,
    access_token: decrypted.access_token || mailbox.access_token,
    refresh_token: decrypted.refresh_token || mailbox.refresh_token,
    smtp_password: decrypted.smtp_password || mailbox.smtp_password
  }
}

export async function smtpSend(mailbox: Mailbox, email: EmailPayload): Promise<SendResult> {
  try {
    // Decrypt passwords if encrypted
    const decryptedMailbox = getDecryptedMailbox(mailbox)
    
    if (!decryptedMailbox.smtp_host || !decryptedMailbox.smtp_port || !decryptedMailbox.smtp_username || !decryptedMailbox.smtp_password) {
      return {
        success: false,
        error: 'SMTP credentials are incomplete'
      }
    }

    // Try to use nodemailer if available
    try {
      const nodemailer = await import('nodemailer').catch(() => null)
      
      if (nodemailer && nodemailer.default) {
        return await sendViaNodemailer(decryptedMailbox, email, nodemailer.default)
      }
    } catch (error) {
      // Nodemailer not available, fall through to fetch-based SMTP
    }

    // Fallback: Use a simple SMTP implementation via API route
    // For now, we'll use a server-side API endpoint
    return await sendViaSMTPAPI(decryptedMailbox, email)
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via SMTP'
    }
  }
}

async function sendViaNodemailer(
  mailbox: Mailbox,
  email: EmailPayload,
  nodemailer: any
): Promise<SendResult> {
  try {
    const fromEmail = email.fromEmail || mailbox.from_email || mailbox.email
    const fromName = email.fromName || mailbox.from_name || mailbox.display_name || fromEmail

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: mailbox.smtp_host,
      port: mailbox.smtp_port,
      secure: mailbox.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: mailbox.smtp_username,
        pass: mailbox.smtp_password
      },
      // Add TLS options for better compatibility
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates (adjust for production)
      }
    })

    // Verify connection
    await transporter.verify()

    // Send mail
    const mailOptions: any = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email.to,
      subject: email.subject,
      html: email.html,
      headers: {
        ...(email.headers || {}),
        ...(email.inReplyTo ? { 'In-Reply-To': email.inReplyTo } : {}),
        ...(email.references ? { 'References': email.references } : {})
      }
    }
    if (email.cc) mailOptions.cc = email.cc
    if (email.bcc) mailOptions.bcc = email.bcc
    if (email.replyTo) mailOptions.replyTo = email.replyTo
    
    const info = await transporter.sendMail(mailOptions)

    return {
      success: true,
      providerMessageId: info.messageId || `smtp_${Date.now()}`
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via SMTP (nodemailer)'
    }
  }
}

async function sendViaSMTPAPI(mailbox: Mailbox, email: EmailPayload): Promise<SendResult> {
  try {
    // For server-side SMTP, we need to use a dedicated API endpoint
    // This is a simplified approach - in production, you might want to use
    // a proper SMTP library or service
    
    // Since we can't directly send SMTP from client-side code,
    // we'll need to proxy through an API endpoint
    // For now, return an error asking to use nodemailer
    
    return {
      success: false,
      error: 'SMTP sending requires nodemailer package. Install it with: npm install nodemailer'
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via SMTP'
    }
  }
}

