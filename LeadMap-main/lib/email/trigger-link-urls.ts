/**
 * Trigger Link URL Utilities
 * Generates trigger link URLs for use in emails
 * Based on Mautic patterns for actionable tracking links
 */

/**
 * Generate trigger link URL
 * Creates a URL that tracks clicks and executes configured actions
 * 
 * @param params - Parameters for generating the trigger link URL
 * @returns The full trigger link URL
 */
export function generateTriggerLinkUrl(params: {
  linkKey: string
  baseUrl?: string
  emailId?: string
  recipientId?: string
  campaignId?: string
  recipientEmail?: string
  preserveUtm?: boolean // Whether to preserve UTM tags from original URL
  originalUrl?: string // Original URL if this is wrapping an existing link
}): string {
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = new URL(`/t/${params.linkKey}`, baseUrl)
  
  // Add tracking parameters
  if (params.emailId) url.searchParams.set('email_id', params.emailId)
  if (params.recipientId) url.searchParams.set('recipient_id', params.recipientId)
  if (params.campaignId) url.searchParams.set('campaign_id', params.campaignId)
  if (params.recipientEmail) url.searchParams.set('email', params.recipientEmail)
  
  // Preserve UTM tags from original URL if requested
  if (params.preserveUtm && params.originalUrl) {
    try {
      const originalUrl = new URL(params.originalUrl)
      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
      
      for (const param of utmParams) {
        const value = originalUrl.searchParams.get(param)
        if (value) {
          url.searchParams.set(param, value)
        }
      }
    } catch {
      // Invalid URL, skip UTM preservation
    }
  }
  
  return url.toString()
}

/**
 * Replace links in HTML with trigger link URLs
 * Similar to Mautic's link replacement but uses trigger links
 * 
 * @param html - HTML content
 * @param linkKey - Trigger link key to use
 * @param trackingParams - Tracking parameters
 * @returns HTML with links replaced
 */
export function replaceLinksWithTriggerLink(
  html: string,
  linkKey: string,
  trackingParams: {
    emailId?: string
    recipientId?: string
    campaignId?: string
    recipientEmail?: string
    baseUrl?: string
  }
): string {
  // Match all href attributes in anchor tags
  return html.replace(
    /<a\s+([^>]*\s+)?href=["']([^"']+)["']([^>]*)>/gi,
    (match, before, url, after) => {
      // Skip tracking URLs, mailto:, tel:, etc.
      if (
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('#') ||
        url.includes('/api/email/track/') ||
        url.includes('/t/') ||
        url.includes('/r/')
      ) {
        return match
      }
      
      const triggerUrl = generateTriggerLinkUrl({
        linkKey,
        originalUrl: url,
        preserveUtm: true,
        ...trackingParams
      })
      
      return `<a ${before || ''}href="${triggerUrl}"${after || ''}>`
    }
  )
}

/**
 * Inject trigger link into HTML
 * Adds a trigger link as a button or link element
 * 
 * @param html - HTML content
 * @param linkKey - Trigger link key
 * @param linkText - Text for the link
 * @param trackingParams - Tracking parameters
 * @param position - Where to inject ('before-body-close' | 'after-body-open' | 'replace-placeholder')
 * @param placeholder - Placeholder text to replace (if position is 'replace-placeholder')
 * @returns HTML with trigger link injected
 */
export function injectTriggerLink(
  html: string,
  linkKey: string,
  linkText: string,
  trackingParams: {
    emailId?: string
    recipientId?: string
    campaignId?: string
    recipientEmail?: string
    baseUrl?: string
  },
  position: 'before-body-close' | 'after-body-open' | 'replace-placeholder' = 'before-body-close',
  placeholder?: string
): string {
  const triggerUrl = generateTriggerLinkUrl({
    linkKey,
    ...trackingParams
  })
  
  const linkHtml = `<a href="${triggerUrl}" style="display:inline-block;padding:12px 24px;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:4px;">${linkText}</a>`
  
  if (position === 'replace-placeholder' && placeholder) {
    return html.replace(placeholder, linkHtml)
  } else if (position === 'before-body-close') {
    if (html.includes('</body>')) {
      return html.replace('</body>', `${linkHtml}</body>`)
    } else {
      return html + linkHtml
    }
  } else if (position === 'after-body-open') {
    if (html.includes('<body')) {
      const bodyMatch = html.match(/<body[^>]*>/i)
      if (bodyMatch) {
        return html.replace(bodyMatch[0], `${bodyMatch[0]}${linkHtml}`)
      }
    }
    return linkHtml + html
  }
  
  return html
}

/**
 * Process email HTML to add trigger link tracking
 * Wraps existing links with trigger link URLs
 * 
 * @param html - Email HTML content
 * @param linkKey - Trigger link key to use
 * @param trackingParams - Tracking parameters
 * @returns Processed HTML with trigger link URLs
 */
export function addTriggerLinkTracking(
  html: string,
  linkKey: string,
  trackingParams: {
    emailId?: string
    recipientId?: string
    campaignId?: string
    recipientEmail?: string
    baseUrl?: string
  }
): string {
  return replaceLinksWithTriggerLink(html, linkKey, trackingParams)
}




