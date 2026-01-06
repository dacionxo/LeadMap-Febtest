/**
 * Email Address Validation
 * 
 * Email address validation utilities following james-project MailAddress patterns
 * Based on RFC 821 SMTP address specification
 * Following .cursorrules: TypeScript best practices, early returns, guard clauses
 * 
 * @see james-project/core/src/main/java/org/apache/james/core/MailAddress.java
 */

/**
 * Special characters in email addresses (RFC 821)
 */
const SPECIAL_CHARS = ['<', '>', '(', ')', '[', ']', '\\', '.', ',', ';', ':', '@', '"']

/**
 * NULL sender address (RFC 5321)
 */
export const NULL_SENDER = '<>'

/**
 * Parsed email address
 */
export interface ParsedEmailAddress {
  localPart: string
  domain: string
  displayName?: string
  fullAddress: string
}

/**
 * Validate email address format
 * 
 * Following james-project MailAddress validation patterns
 * Supports RFC 821 mailbox format with quoted local parts
 * 
 * @param address - Email address to validate
 * @returns true if address is valid
 */
export function isValidEmailAddress(address: string): boolean {
  if (!address || address.trim().length === 0) {
    return false
  }

  // NULL sender is valid
  if (address === NULL_SENDER) {
    return true
  }

  // Remove angle brackets if present
  let cleanAddress = address.trim()
  if (cleanAddress.startsWith('<') && cleanAddress.endsWith('>')) {
    cleanAddress = cleanAddress.slice(1, -1)
  }

  // Extract display name if present
  const displayNameMatch = cleanAddress.match(/^"([^"]+)"\s*<(.+)>$/)
  if (displayNameMatch) {
    cleanAddress = displayNameMatch[2]
  }

  // Must contain @
  if (!cleanAddress.includes('@')) {
    return false
  }

  // Parse local part and domain
  const parts = parseAddressParts(cleanAddress)
  if (!parts) {
    return false
  }

  // Validate local part
  if (!isValidLocalPart(parts.localPart)) {
    return false
  }

  // Validate domain
  if (!isValidDomain(parts.domain)) {
    return false
  }

  return true
}

/**
 * Parse email address into local part and domain
 * 
 * Handles quoted local parts like "serge@home"@lokitech.com
 * Following james-project MailAddress parsing logic
 * 
 * @param address - Email address to parse
 * @returns Parsed address parts or null if invalid
 */
export function parseAddressParts(address: string): { localPart: string; domain: string } | null {
  if (!address || address.trim().length === 0) {
    return null
  }

  // NULL sender
  if (address === NULL_SENDER) {
    return null // NULL sender has no parts
  }

  // Remove angle brackets if present
  let cleanAddress = address.trim()
  if (cleanAddress.startsWith('<') && cleanAddress.endsWith('>')) {
    cleanAddress = cleanAddress.slice(1, -1)
  }

  // Extract display name if present
  const displayNameMatch = cleanAddress.match(/^"([^"]+)"\s*<(.+)>$/)
  if (displayNameMatch) {
    cleanAddress = displayNameMatch[2]
  }

  // Find @ symbol (but handle quoted local parts)
  let atIndex = -1
  let inQuotes = false

  for (let i = 0; i < cleanAddress.length; i++) {
    const char = cleanAddress[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === '@' && !inQuotes) {
      atIndex = i
      break
    }
  }

  if (atIndex === -1) {
    return null
  }

  const localPart = cleanAddress.substring(0, atIndex)
  const domain = cleanAddress.substring(atIndex + 1)

  return { localPart, domain }
}

/**
 * Parse email address with display name
 * 
 * @param address - Email address string (may include display name)
 * @returns Parsed email address or null if invalid
 */
export function parseEmailAddress(address: string): ParsedEmailAddress | null {
  if (!address || address.trim().length === 0) {
    return null
  }

  // NULL sender
  if (address === NULL_SENDER) {
    return {
      localPart: '',
      domain: '',
      fullAddress: NULL_SENDER,
    }
  }

  // Extract display name if present
  let displayName: string | undefined
  let cleanAddress = address.trim()

  const displayNameMatch = cleanAddress.match(/^"([^"]+)"\s*<(.+)>$/)
  if (displayNameMatch) {
    displayName = displayNameMatch[1]
    cleanAddress = displayNameMatch[2]
  } else {
    // Check for format: Display Name <email@domain.com>
    const altMatch = cleanAddress.match(/^(.+?)\s*<(.+)>$/)
    if (altMatch) {
      displayName = altMatch[1].trim()
      cleanAddress = altMatch[2]
    }
  }

  // Remove angle brackets if still present
  if (cleanAddress.startsWith('<') && cleanAddress.endsWith('>')) {
    cleanAddress = cleanAddress.slice(1, -1)
  }

  const parts = parseAddressParts(cleanAddress)
  if (!parts) {
    return null
  }

  return {
    localPart: parts.localPart,
    domain: parts.domain,
    displayName,
    fullAddress: cleanAddress,
  }
}

/**
 * Validate local part of email address
 * 
 * Following james-project MailAddress local part validation
 * Supports quoted strings and unquoted local parts
 * 
 * @param localPart - Local part to validate
 * @returns true if local part is valid
 */
function isValidLocalPart(localPart: string): boolean {
  if (!localPart || localPart.length === 0) {
    return false
  }

  // Quoted string
  if (localPart.startsWith('"') && localPart.endsWith('"')) {
    // Remove quotes and validate
    const quoted = localPart.slice(1, -1)
    // Quoted string can contain any characters except unescaped quotes
    return isValidQuotedString(quoted)
  }

  // Unquoted local part
  // Must not start or end with dot
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return false
  }

  // Must not contain consecutive dots
  if (localPart.includes('..')) {
    return false
  }

  // Check for invalid characters
  for (const char of localPart) {
    if (SPECIAL_CHARS.includes(char) && char !== '.' && char !== '@') {
      return false
    }
  }

  return true
}

/**
 * Validate quoted string (for local part)
 * 
 * @param quoted - Quoted string content (without quotes)
 * @returns true if valid
 */
function isValidQuotedString(quoted: string): boolean {
  let i = 0
  while (i < quoted.length) {
    if (quoted[i] === '\\') {
      // Escaped character
      if (i + 1 >= quoted.length) {
        return false // Escape at end
      }
      i += 2 // Skip escaped character
    } else if (quoted[i] === '"') {
      return false // Unescaped quote
    } else {
      i++
    }
  }
  return true
}

/**
 * Validate domain part of email address
 * 
 * @param domain - Domain to validate
 * @returns true if domain is valid
 */
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length === 0) {
    return false
  }

  // Must not start or end with dot or hyphen
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) {
    return false
  }

  // Must not contain consecutive dots
  if (domain.includes('..')) {
    return false
  }

  // Split by dots and validate each label
  const labels = domain.split('.')
  if (labels.length === 0) {
    return false
  }

  for (const label of labels) {
    if (label.length === 0) {
      return false
    }

    // Label must be valid (alphanumeric and hyphens, not starting/ending with hyphen)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return false
    }
  }

  return true
}

/**
 * Normalize email address
 * 
 * Converts address to lowercase and removes display name
 * 
 * @param address - Email address to normalize
 * @returns Normalized address or null if invalid
 */
export function normalizeEmailAddress(address: string): string | null {
  const parsed = parseEmailAddress(address)
  if (!parsed) {
    return null
  }

  if (parsed.fullAddress === NULL_SENDER) {
    return NULL_SENDER
  }

  return `${parsed.localPart.toLowerCase()}@${parsed.domain.toLowerCase()}`
}

/**
 * Format email address with display name
 * 
 * @param address - Email address
 * @param displayName - Display name (optional)
 * @returns Formatted address string
 */
export function formatEmailAddress(address: string, displayName?: string): string {
  if (address === NULL_SENDER) {
    return NULL_SENDER
  }

  if (displayName) {
    return `"${displayName}" <${address}>`
  }

  return address
}


