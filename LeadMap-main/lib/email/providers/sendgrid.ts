/**
 * SendGrid Email Provider
 */

import { ProviderConfig, EmailPayload, SendResult } from '../types'

export async function sendgridSend(
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        error: 'SendGrid API key is required'
      }
    }

    // Apply tracking domain if configured
    const html = applyTrackingDomain(payload.html, config.trackingDomain)

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: payload.to }],
          cc: payload.cc ? [{ email: payload.cc }] : undefined,
          bcc: payload.bcc ? [{ email: payload.bcc }] : undefined,
          subject: payload.subject
        }],
        from: {
          email: config.fromEmail || payload.fromEmail || 'noreply@sendgrid.com',
          name: payload.fromName
        },
        reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
        subject: payload.subject,
        content: [{
          type: 'text/html',
          value: html
        }],
        headers: {
          'In-Reply-To': payload.inReplyTo,
          'References': payload.references
        },
        mail_settings: {
          sandbox_mode: {
            enable: config.sandboxMode || false
          }
        }
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
        error: `SendGrid API error: ${response.status} - ${errorText}`
      }
    }

    // SendGrid doesn't return message ID in v3 API, but we can extract from headers
    const messageId = response.headers.get('X-Message-Id')

    return {
      success: true,
      providerMessageId: messageId || undefined
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via SendGrid'
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


