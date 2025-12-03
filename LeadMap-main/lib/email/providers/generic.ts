/**
 * Generic Email Service Provider
 * For custom email APIs
 */

import { ProviderConfig, EmailPayload, SendResult } from '../types'

export async function genericSend(
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  try {
    const serviceUrl = process.env.EMAIL_SERVICE_URL
    if (!serviceUrl) {
      return {
        success: false,
        error: 'EMAIL_SERVICE_URL is required for generic email provider'
      }
    }

    // Apply tracking domain if configured
    const html = applyTrackingDomain(payload.html, config.trackingDomain)

    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromEmail || payload.fromEmail || 'noreply@example.com',
        to: payload.to,
        subject: payload.subject,
        html,
        cc: payload.cc,
        bcc: payload.bcc,
        replyTo: payload.replyTo,
        inReplyTo: payload.inReplyTo,
        references: payload.references
      }),
    })

    // Check for rate limit
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      return {
        success: false,
        error: `Rate limit exceeded. Retry after ${retryAfter || 'some time'}.`
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Generic email service error: ${response.status} - ${errorText}`
      }
    }

    const result = await response.json().catch(() => ({}))

    return {
      success: true,
      providerMessageId: result.id || result.messageId || result.message_id
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via generic service'
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



