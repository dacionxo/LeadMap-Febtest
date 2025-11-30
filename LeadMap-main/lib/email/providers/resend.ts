/**
 * Resend Email Provider
 */

import { ProviderConfig, EmailPayload, SendResult } from '../types'

export async function resendSend(
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        error: 'Resend API key is required'
      }
    }

    // Dynamic import - resend is optional
    let Resend: any
    try {
      const resendModule = await import('resend')
      Resend = resendModule.Resend
    } catch (error) {
      return {
        success: false,
        error: 'Resend package not installed. Run: npm install resend'
      }
    }

    const resend = new Resend(config.apiKey)

    // Apply tracking domain if configured
    const html = applyTrackingDomain(payload.html, config.trackingDomain)

    const result = await resend.emails.send({
      from: config.fromEmail || payload.fromEmail || 'noreply@resend.dev',
      to: payload.to,
      subject: payload.subject,
      html,
      cc: payload.cc,
      bcc: payload.bcc,
      reply_to: payload.replyTo,
      headers: {
        'In-Reply-To': payload.inReplyTo,
        'References': payload.references
      }
    })

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Resend API error'
      }
    }

    return {
      success: true,
      providerMessageId: result.data?.id
    }
  } catch (error: any) {
    // Check for rate limit errors
    if (error.message?.includes('rate limit') || error.status === 429) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to send email via Resend'
    }
  }
}

/**
 * Apply tracking domain to links in HTML
 */
function applyTrackingDomain(html: string, trackingDomain?: string): string {
  if (!trackingDomain) return html

  // Replace links with tracking domain
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

