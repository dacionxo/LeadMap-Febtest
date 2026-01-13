/**
 * Mautic-Style Hash Generation Utilities
 * Following Mautic patterns for contentHash and idHash generation
 */

import { createHash } from 'crypto'

/**
 * Mautic-style contentHash
 * Identifies unique email content including template
 * Generated from: HTML content + subject + from address + template ID
 */
export function generateContentHash(params: {
  emailHtml: string
  emailSubject: string
  fromAddress?: string
  templateId?: string
}): string {
  const content = [
    params.emailHtml || '',
    params.emailSubject || '',
    params.fromAddress || '',
    params.templateId || ''
  ].join('||')

  return createHash('md5').update(content).digest('hex')
}

/**
 * Mautic-style idHash
 * Unique identifier for specific email send to contact
 * Generated from: email_id + recipient_email + send_timestamp
 */
export function generateIdHash(params: {
  emailId: string
  recipientEmail: string
  sendTimestamp: Date | string
}): string {
  const timestamp = params.sendTimestamp instanceof Date
    ? params.sendTimestamp.toISOString()
    : params.sendTimestamp

  const content = [
    params.emailId || '',
    params.recipientEmail.toLowerCase() || '',
    timestamp
  ].join('||')

  return createHash('md5').update(content).digest('hex')
}

/**
 * Parse source component format
 * Mautic format: ['component', id]
 * Examples: ['campaign.event', 1], ['email.send', 123], ['automation.action', 456]
 */
export interface EmailSource {
  component: string
  id: string | number
}

/**
 * Convert source object to Mautic array format
 */
export function formatSource(source: EmailSource): [string, string | number] {
  return [source.component, source.id]
}

/**
 * Parse source from Mautic array format
 */
export function parseSource(source: [string, string | number] | null | undefined): EmailSource | null {
  if (!source || !Array.isArray(source) || source.length !== 2) {
    return null
  }

  return {
    component: source[0],
    id: source[1]
  }
}

/**
 * UTM Tags interface matching Mautic format
 */
export interface UtmTags {
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
}

/**
 * Parse UTM tags from URL or object
 */
export function parseUtmTags(source: URL | Record<string, string> | UtmTags): UtmTags {
  if (source instanceof URL) {
    return {
      utmSource: source.searchParams.get('utm_source') || null,
      utmMedium: source.searchParams.get('utm_medium') || null,
      utmCampaign: source.searchParams.get('utm_campaign') || null,
      utmContent: source.searchParams.get('utm_content') || null,
      utmTerm: source.searchParams.get('utm_term') || null
    }
  }

  // Handle object format - support both camelCase (UtmTags) and snake_case (Record<string, string>)
  const sourceObj = source as UtmTags & Record<string, string>
  return {
    utmSource: sourceObj.utmSource || sourceObj['utm_source'] || null,
    utmMedium: sourceObj.utmMedium || sourceObj['utm_medium'] || null,
    utmCampaign: sourceObj.utmCampaign || sourceObj['utm_campaign'] || null,
    utmContent: sourceObj.utmContent || sourceObj['utm_content'] || null,
    utmTerm: sourceObj.utmTerm || sourceObj['utm_term'] || null
  }
}

