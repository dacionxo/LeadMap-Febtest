/**
 * Token Replacement Service
 * Server and client-side token replacement utilities
 * Following Mautic patterns and .cursorrules guidelines
 */

import type { TokenContext, EmailToken } from '../types'
import { replaceTokens, extractTokens, generateTokenString } from './token-replacement'

/**
 * Server-side token replacement
 * Replaces tokens in email content with actual data from context
 */
export function replaceTokensInContent(
  content: string,
  context: TokenContext
): string {
  if (!content || !context) {
    return content
  }

  try {
    return replaceTokens(content, context)
  } catch (error) {
    console.error('Error replacing tokens:', error)
    return content // Return original content on error
  }
}

/**
 * Client-side token replacement for preview
 * Uses sample data or provided context
 */
export function replaceTokensForPreview(
  content: string,
  context?: Partial<TokenContext>
): string {
  const defaultContext: TokenContext = {
    contactFields: {
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      company: 'Acme Corp',
      phone: '+1-555-0123',
      city: 'New York',
      state: 'NY',
      country: 'United States',
    },
    campaignFields: {
      name: 'Sample Campaign',
      description: 'This is a sample campaign description',
    },
    emailFields: {
      subject: 'Sample Email Subject',
      fromname: 'Marketing Team',
      fromemail: 'marketing@example.com',
    },
    dateFormat: 'YYYY-MM-DD',
    timezone: 'UTC',
    ...context,
  }

  return replaceTokensInContent(content, defaultContext)
}

/**
 * Validate tokens in content
 * Returns list of tokens that may not be replaced
 */
export function validateTokensInContent(
  content: string,
  context: TokenContext
): {
  valid: boolean
  missingTokens: string[]
  allTokens: string[]
} {
  const allTokens = extractTokens(content)
  const missingTokens: string[] = []

  for (const token of allTokens) {
    // Check if token can be replaced
    const testContent = replaceTokens(token, context)
    if (testContent === token) {
      // Token was not replaced, it's missing
      missingTokens.push(token)
    }
  }

  return {
    valid: missingTokens.length === 0,
    missingTokens,
    allTokens,
  }
}

/**
 * Get token context from contact, campaign, and email data
 * Helper to build TokenContext from database records
 */
export function buildTokenContext(options: {
  contactId?: string
  contactData?: Record<string, string | number | boolean | null>
  campaignId?: string
  campaignData?: Record<string, string | number | boolean | null>
  emailId?: string
  emailData?: Record<string, string | number | boolean | null>
  dateFormat?: string
  timezone?: string
}): TokenContext {
  return {
    contactId: options.contactId,
    contactFields: options.contactData
      ? normalizeContactFields(options.contactData)
      : undefined,
    campaignId: options.campaignId,
    campaignFields: options.campaignData
      ? normalizeCampaignFields(options.campaignData)
      : undefined,
    emailId: options.emailId,
    emailFields: options.emailData
      ? normalizeEmailFields(options.emailData)
      : undefined,
    dateFormat: options.dateFormat || 'YYYY-MM-DD',
    timezone: options.timezone || 'UTC',
  }
}

/**
 * Normalize contact fields to lowercase keys for token matching
 */
function normalizeContactFields(
  data: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const normalized: Record<string, string | number | boolean | null> = {}

  for (const [key, value] of Object.entries(data)) {
    // Support both camelCase and snake_case
    const lowerKey = key.toLowerCase()
    normalized[lowerKey] = value

    // Also add common aliases
    if (key === 'first_name' || key === 'firstName') {
      normalized['firstname'] = value
    }
    if (key === 'last_name' || key === 'lastName') {
      normalized['lastname'] = value
    }
  }

  return normalized
}

/**
 * Normalize campaign fields to lowercase keys
 */
function normalizeCampaignFields(
  data: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const normalized: Record<string, string | number | boolean | null> = {}

  for (const [key, value] of Object.entries(data)) {
    normalized[key.toLowerCase()] = value
  }

  return normalized
}

/**
 * Normalize email fields to lowercase keys
 */
function normalizeEmailFields(
  data: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const normalized: Record<string, string | number | boolean | null> = {}

  for (const [key, value] of Object.entries(data)) {
    normalized[key.toLowerCase()] = value
    // Support common aliases
    if (key === 'from_name' || key === 'fromName') {
      normalized['fromname'] = value
    }
    if (key === 'from_email' || key === 'fromEmail') {
      normalized['fromemail'] = value
    }
  }

  return normalized
}



