/**
 * Mailgun Email Provider
 */

import { ProviderConfig, EmailPayload, SendResult } from '../types'

export async function mailgunSend(
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  try {
    if (!config.apiKey || !config.domain) {
      return {
        success: false,
        error: 'Mailgun API key and domain are required'
      }
    }

    // Use sandbox domain if in sandbox mode
    const domain = config.sandboxMode && config.sandboxDomain 
      ? config.sandboxDomain 
      : config.domain

    // Apply tracking domain if configured
    const html = applyTrackingDomain(payload.html, config.trackingDomain)

    const auth = Buffer.from(`api:${config.apiKey}`).toString('base64')
    const formData = new URLSearchParams()
    
    formData.append('from', config.fromEmail || payload.fromEmail || `noreply@${domain}`)
    formData.append('to', payload.to)
    formData.append('subject', payload.subject)
    formData.append('html', html)
    
    if (payload.cc) formData.append('cc', payload.cc)
    if (payload.bcc) formData.append('bcc', payload.bcc)
    if (payload.replyTo) formData.append('h:Reply-To', payload.replyTo)
    if (payload.inReplyTo) formData.append('h:In-Reply-To', payload.inReplyTo)
    if (payload.references) formData.append('h:References', payload.references)
    // Add custom headers (e.g., List-Unsubscribe)
    if (payload.headers) {
      for (const [key, value] of Object.entries(payload.headers)) {
        formData.append(`h:${key}`, value)
      }
    }

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        body: formData,
      }
    )

    // Check for rate limit
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      return {
        success: false,
        error: `Rate limit exceeded. Retry after ${retryAfter || 'some time'}.`
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      return {
        success: false,
        error: `Mailgun API error: ${response.status} - ${errorData.message || 'Unknown error'}`
      }
    }

    const result = await response.json()

    return {
      success: true,
      providerMessageId: result.id || result.message?.id
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via Mailgun'
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



