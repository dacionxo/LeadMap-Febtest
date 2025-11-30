/**
 * Email Tracking URL Utilities
 * Generates tracking URLs for open pixels and click redirects
 */

/**
 * Generate tracking pixel URL for email open tracking
 */
export function generateOpenTrackingUrl(params: {
  emailId?: string
  recipientId?: string
  campaignId?: string
  baseUrl?: string
}): string {
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = new URL('/api/email/track/open', baseUrl)
  
  if (params.emailId) url.searchParams.set('email_id', params.emailId)
  if (params.recipientId) url.searchParams.set('recipient_id', params.recipientId)
  if (params.campaignId) url.searchParams.set('campaign_id', params.campaignId)
  
  return url.toString()
}

/**
 * Generate click tracking URL (query parameter method)
 */
export function generateClickTrackingUrl(params: {
  originalUrl: string
  emailId?: string
  recipientId?: string
  campaignId?: string
  baseUrl?: string
}): string {
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = new URL('/api/email/track/click', baseUrl)
  
  url.searchParams.set('url', params.originalUrl)
  if (params.emailId) url.searchParams.set('email_id', params.emailId)
  if (params.recipientId) url.searchParams.set('recipient_id', params.recipientId)
  if (params.campaignId) url.searchParams.set('campaign_id', params.campaignId)
  
  return url.toString()
}

/**
 * Generate clean redirect URL using /r/:eventId pattern
 * Creates a base64-encoded event ID containing all tracking parameters
 */
export function generateCleanClickUrl(params: {
  originalUrl: string
  emailId?: string
  recipientId?: string
  campaignId?: string
  baseUrl?: string
}): string {
  const baseUrl = params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  // Create event ID: base64(emailId||recipientId||campaignId||url)
  const eventData = [
    params.emailId || '',
    params.recipientId || '',
    params.campaignId || '',
    params.originalUrl
  ].join('||')
  
  const eventId = Buffer.from(eventData).toString('base64')
  
  return `${baseUrl}/r/${eventId}`
}

/**
 * Add tracking pixel to HTML email
 */
export function injectTrackingPixel(html: string, trackingUrl: string): string {
  const pixelHtml = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`
  
  // Insert before closing </body> tag, or append if no body tag
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelHtml}</body>`)
  } else {
    return html + pixelHtml
  }
}

/**
 * Replace all links in HTML email with tracking URLs
 */
export function replaceLinksWithTracking(
  html: string,
  trackingUrlGenerator: (originalUrl: string) => string
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
        url.includes('/r/')
      ) {
        return match
      }
      
      const trackedUrl = trackingUrlGenerator(url)
      return `<a ${before || ''}href="${trackedUrl}"${after || ''}>`
    }
  )
}

/**
 * Process email HTML to add tracking
 */
export function addEmailTracking(html: string, params: {
  emailId?: string
  recipientId?: string
  campaignId?: string
  baseUrl?: string
  useCleanUrls?: boolean // Use /r/:eventId instead of query params
}): string {
  let trackedHtml = html
  
  // Add open tracking pixel
  const pixelUrl = generateOpenTrackingUrl({
    emailId: params.emailId,
    recipientId: params.recipientId,
    campaignId: params.campaignId,
    baseUrl: params.baseUrl
  })
  trackedHtml = injectTrackingPixel(trackedHtml, pixelUrl)
  
  // Replace links with click tracking
  const urlGenerator = params.useCleanUrls
    ? (url: string) => generateCleanClickUrl({
        originalUrl: url,
        emailId: params.emailId,
        recipientId: params.recipientId,
        campaignId: params.campaignId,
        baseUrl: params.baseUrl
      })
    : (url: string) => generateClickTrackingUrl({
        originalUrl: url,
        emailId: params.emailId,
        recipientId: params.recipientId,
        campaignId: params.campaignId,
        baseUrl: params.baseUrl
      })
  
  trackedHtml = replaceLinksWithTracking(trackedHtml, urlGenerator)
  
  return trackedHtml
}

