/**
 * Token Replacement Utilities
 * Following Mautic patterns: {contactfield=firstname}, {campaignfield=name}, etc.
 * Following .cursorrules: TypeScript interfaces, error handling
 */

import type { TokenContext, EmailToken } from '../types'

/**
 * Token regex patterns following Mautic format
 */
export const TOKEN_PATTERNS = {
  contactfield: /({|%7B)contactfield=(.*?)(}|%7D)/g,
  campaignfield: /({|%7B)campaignfield=(.*?)(}|%7D)/g,
  emailfield: /({|%7B)emailfield=(.*?)(}|%7D)/g,
  date: /({|%7B)date(}|%7D)/g,
  time: /({|%7B)time(}|%7D)/g,
  datetime: /({|%7B)datetime(}|%7D)|({|%7B)datetime=(.*?)(}|%7D)/g,
  custom: /({|%7B)([\w]+)(}|%7D)/g,
} as const

/**
 * Extract all tokens from content
 */
export function extractTokens(content: string): string[] {
  const tokens: Set<string> = new Set()

  // Helper function to extract matches using exec (compatible with all targets)
  const extractMatches = (pattern: RegExp, text: string): void => {
    // Reset regex lastIndex to ensure we start from the beginning
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      tokens.add(match[0])
      // Prevent infinite loop if regex has no global flag (shouldn't happen, but safety check)
      if (!pattern.global) {
        break
      }
    }
  }

  // Extract contact field tokens
  extractMatches(TOKEN_PATTERNS.contactfield, content)

  // Extract campaign field tokens
  extractMatches(TOKEN_PATTERNS.campaignfield, content)

  // Extract email field tokens
  extractMatches(TOKEN_PATTERNS.emailfield, content)

  // Extract date/time tokens
  extractMatches(TOKEN_PATTERNS.date, content)
  extractMatches(TOKEN_PATTERNS.time, content)
  extractMatches(TOKEN_PATTERNS.datetime, content)

  return Array.from(tokens)
}

/**
 * Replace tokens in content with actual values
 */
export function replaceTokens(content: string, context: TokenContext): string {
  let result = content

  // Replace contact field tokens
  result = result.replace(TOKEN_PATTERNS.contactfield, (match, open, fieldName) => {
    if (!context.contactFields) {
      return match // Return original if no context
    }
    const field = fieldName.trim().toLowerCase()
    const value = context.contactFields[field] || context.contactFields[fieldName] || ''
    return typeof value === 'string' || typeof value === 'number' ? String(value) : match
  })

  // Replace campaign field tokens
  result = result.replace(TOKEN_PATTERNS.campaignfield, (match, open, fieldName) => {
    if (!context.campaignFields) {
      return match
    }
    const field = fieldName.trim().toLowerCase()
    const value = context.campaignFields[field] || context.campaignFields[fieldName] || ''
    return typeof value === 'string' || typeof value === 'number' ? String(value) : match
  })

  // Replace email field tokens
  result = result.replace(TOKEN_PATTERNS.emailfield, (match, open, fieldName) => {
    if (!context.emailFields) {
      return match
    }
    const field = fieldName.trim().toLowerCase()
    const value = context.emailFields[field] || context.emailFields[fieldName] || ''
    return typeof value === 'string' || typeof value === 'number' ? String(value) : match
  })

  // Replace date/time tokens
  const now = new Date()
  const dateFormat = context.dateFormat || 'YYYY-MM-DD'
  const timezone = context.timezone || 'UTC'

  result = result.replace(TOKEN_PATTERNS.date, () => {
    return formatDate(now, dateFormat, timezone)
  })

  result = result.replace(TOKEN_PATTERNS.time, () => {
    return formatTime(now, timezone)
  })

  result = result.replace(TOKEN_PATTERNS.datetime, (match, open1, formatPart, close1, open2, formatPart2, close2) => {
    const format = formatPart || formatPart2 || dateFormat
    return formatDateTime(now, format, timezone)
  })

  return result
}

/**
 * Format date according to format string
 */
function formatDate(date: Date, format: string, timezone: string): string {
  // Simple date formatting - can be enhanced with date-fns or similar
  if (format === 'YYYY-MM-DD') {
    return date.toISOString().split('T')[0]
  }
  if (format === 'MM/DD/YYYY') {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }
  if (format === 'DD/MM/YYYY') {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }
  // Default to ISO format
  return date.toISOString().split('T')[0]
}

/**
 * Format time
 */
function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-US', { timeZone: timezone })
}

/**
 * Format date and time
 */
function formatDateTime(date: Date, format: string, timezone: string): string {
  const datePart = formatDate(date, format, timezone)
  const timePart = formatTime(date, timezone)
  return `${datePart} ${timePart}`
}

/**
 * Validate token syntax
 */
export function validateToken(token: string): { valid: boolean; error?: string } {
  // Check if token matches any pattern
  for (const pattern of Object.values(TOKEN_PATTERNS)) {
    if (pattern.test(token)) {
      return { valid: true }
    }
  }

  return {
    valid: false,
    error: 'Token does not match any recognized pattern',
  }
}

/**
 * Generate token string from EmailToken object
 */
export function generateTokenString(token: EmailToken): string {
  if (token.category === 'contact') {
    return `{contactfield=${token.key}}`
  }
  if (token.category === 'campaign') {
    return `{campaignfield=${token.key}}`
  }
  if (token.category === 'email') {
    return `{emailfield=${token.key}}`
  }
  if (token.category === 'date') {
    return token.key === 'datetime' && token.format ? `{datetime=${token.format}}` : `{${token.key}}`
  }
  if (token.category === 'custom') {
    return `{${token.key}}`
  }
  return `{${token.key}}`
}


