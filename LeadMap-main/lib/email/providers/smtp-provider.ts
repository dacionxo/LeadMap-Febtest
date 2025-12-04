/**
 * SMTP Email Provider (for ProviderConfig interface)
 * Uses Node.js nodemailer to send emails via SMTP
 */

import { ProviderConfig, EmailPayload, SendResult } from '../types'

export async function smtpSend(
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  try {
    if (!config.host || !config.port || !config.username || !config.password) {
      return {
        success: false,
        error: 'SMTP host, port, username, and password are required'
      }
    }

    // Try to use nodemailer if available
    try {
      const nodemailer = await import('nodemailer').catch(() => null)
      
      if (nodemailer && nodemailer.default) {
        return await sendViaNodemailer(config, payload, nodemailer.default)
      }
    } catch (error) {
      // Nodemailer not available
    }

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

async function sendViaNodemailer(
  config: ProviderConfig,
  payload: EmailPayload,
  nodemailer: any
): Promise<SendResult> {
  try {
    const fromEmail = config.fromEmail || payload.fromEmail || 'noreply@example.com'
    const fromName = payload.fromName || 'LeadMap'

    // Apply tracking domain if configured
    const html = applyTrackingDomain(payload.html, config.trackingDomain)

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.username,
        pass: config.password
      },
      // Add TLS options for better compatibility
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' // Only reject in production
      }
    })

    // Verify connection
    await transporter.verify()

    // Send mail
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html,
      cc: payload.cc,
      bcc: payload.bcc,
      replyTo: payload.replyTo,
      headers: {
        ...(payload.headers || {}),
        ...(payload.inReplyTo ? { 'In-Reply-To': payload.inReplyTo } : {}),
        ...(payload.references ? { 'References': payload.references } : {})
      }
    })

    return {
      success: true,
      providerMessageId: info.messageId || `smtp_${Date.now()}`
    }
  } catch (error: any) {
    // Check for rate limit or connection errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: 'SMTP connection error. Please check your SMTP settings.'
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to send email via SMTP (nodemailer)'
    }
  }
}

/**
 * Apply tracking domain to links in HTML
 */
function applyTrackingDomain(html: string, trackingDomain?: string): string {
  if (!trackingDomain) return html

  return html.replace(
    /href=["'](https?:\/\/[^"']+)["']/g,
    (match, url) => {
      if (url.startsWith('mailto:') || url.startsWith('#')) {
        return match
      }
      return `href="${trackingDomain}/track/click?url=${encodeURIComponent(url)}"`
    }
  )
}



