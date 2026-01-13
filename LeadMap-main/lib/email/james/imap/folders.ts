/**
 * IMAP Folder Management Utilities
 * 
 * IMAP folder management patterns following james-project implementation
 * Based on CreateProcessor, DeleteProcessor, RenameProcessor, SubscribeProcessor
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/CreateProcessor.java
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/DeleteProcessor.java
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/RenameProcessor.java
 */

/**
 * IMAP folder/mailbox type
 */
export enum MailboxType {
  INBOX = 'INBOX',
  DRAFTS = 'DRAFTS',
  TRASH = 'TRASH',
  SPAM = 'SPAM',
  SENT = 'SENT',
  STARRED = 'STARRED',
  ALLMAIL = 'ALLMAIL',
  ARCHIVE = 'ARCHIVE',
  OTHER = 'OTHER',
}

/**
 * IMAP folder attributes
 */
export interface MailboxAttributes {
  type: MailboxType
  noSelect?: boolean
  noInferiors?: boolean
  marked?: boolean
  unmarked?: boolean
  hasChildren?: boolean
  hasNoChildren?: boolean
}

/**
 * IMAP folder information
 */
export interface MailboxInfo {
  name: string
  delimiter: string
  attributes: MailboxAttributes[]
  exists?: number // Number of messages
  recent?: number // Number of recent messages
  unseen?: number // Number of unseen messages
  uidValidity?: number
  uidNext?: number
  flags?: string[]
  permanentFlags?: string[]
}

/**
 * Folder hierarchy separator
 */
export const HIERARCHY_SEPARATOR = '/'

/**
 * INBOX folder name (case-insensitive)
 */
export const INBOX_NAME = 'INBOX'

/**
 * Validate mailbox name
 * 
 * Following james-project CreateProcessor validation patterns
 * 
 * @param name - Mailbox name to validate
 * @param maxLength - Maximum length (optional)
 * @returns Validation result
 */
export function validateMailboxName(name: string, maxLength?: number): {
  valid: boolean
  error?: string
} {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Mailbox name cannot be empty',
    }
  }

  // Check for invalid patterns
  if (name === '..' || name.startsWith('..')) {
    return {
      valid: false,
      error: 'Invalid mailbox name: cannot start with ..',
    }
  }

  // Check length if specified
  if (maxLength && name.length > maxLength) {
    return {
      valid: false,
      error: `Mailbox name exceeds maximum length of ${maxLength} characters`,
    }
  }

  // Check for invalid characters (basic validation)
  // In full implementation, would check RFC 3501 mailbox name rules
  if (/[\x00-\x1F\x7F]/.test(name)) {
    return {
      valid: false,
      error: 'Mailbox name contains invalid characters',
    }
  }

  return { valid: true }
}

/**
 * Normalize mailbox name
 * 
 * Removes trailing delimiter and normalizes case for INBOX
 * Following james-project PathConverter patterns
 * 
 * @param name - Mailbox name
 * @param delimiter - Hierarchy delimiter (default: /)
 * @returns Normalized mailbox name
 */
export function normalizeMailboxName(name: string, delimiter: string = HIERARCHY_SEPARATOR): string {
  let normalized = name.trim()

  // Remove trailing delimiter (RFC 3501 section 6.3.3)
  if (normalized.endsWith(delimiter)) {
    normalized = normalized.slice(0, -1)
  }

  // INBOX is case-insensitive but typically stored as uppercase
  if (normalized.toUpperCase() === INBOX_NAME) {
    return INBOX_NAME
  }

  return normalized
}

/**
 * Build full mailbox path
 * 
 * Combines namespace, user, and mailbox name
 * Following james-project PathConverter.buildFullPath patterns
 * 
 * @param namespace - Namespace (optional)
 * @param user - User identifier (optional)
 * @param mailboxName - Mailbox name
 * @param delimiter - Hierarchy delimiter (default: /)
 * @returns Full mailbox path
 */
export function buildMailboxPath(
  namespace: string | null,
  user: string | null,
  mailboxName: string,
  delimiter: string = HIERARCHY_SEPARATOR
): string {
  const parts: string[] = []

  if (namespace) {
    parts.push(namespace)
  }

  if (user) {
    parts.push(user)
  }

  const normalized = normalizeMailboxName(mailboxName, delimiter)
  parts.push(normalized)

  return parts.join(delimiter)
}

/**
 * Parse mailbox path
 * 
 * Extracts namespace, user, and mailbox name from full path
 * 
 * @param path - Full mailbox path
 * @param delimiter - Hierarchy delimiter (default: /)
 * @returns Parsed path components
 */
export function parseMailboxPath(
  path: string,
  delimiter: string = HIERARCHY_SEPARATOR
): {
  namespace: string | null
  user: string | null
  mailboxName: string
} {
  const parts = path.split(delimiter)

  if (parts.length === 1) {
    return {
      namespace: null,
      user: null,
      mailboxName: normalizeMailboxName(parts[0], delimiter),
    }
  }

  if (parts.length === 2) {
    return {
      namespace: null,
      user: parts[0] || null,
      mailboxName: normalizeMailboxName(parts[1], delimiter),
    }
  }

  return {
    namespace: parts[0] || null,
    user: parts[1] || null,
    mailboxName: normalizeMailboxName(parts.slice(2).join(delimiter), delimiter),
  }
}

/**
 * Get mailbox type from name
 * 
 * Determines mailbox type based on name and attributes
 * Following james-project MailboxType enum
 * 
 * @param name - Mailbox name
 * @param attributes - Mailbox attributes (optional)
 * @returns Mailbox type
 */
export function getMailboxType(name: string, attributes?: MailboxAttributes[]): MailboxType {
  const upperName = name.toUpperCase()

  // Check attributes first
  if (attributes) {
    for (const attr of attributes) {
      if (attr.type !== MailboxType.OTHER) {
        return attr.type
      }
    }
  }

  // Check name patterns
  if (upperName === INBOX_NAME || upperName.startsWith(`${INBOX_NAME}/`)) {
    return MailboxType.INBOX
  }

  if (upperName.includes('DRAFT') || upperName.includes('DRAFTS')) {
    return MailboxType.DRAFTS
  }

  if (upperName.includes('TRASH') || upperName.includes('DELETED')) {
    return MailboxType.TRASH
  }

  if (upperName.includes('SPAM') || upperName.includes('JUNK')) {
    return MailboxType.SPAM
  }

  if (upperName.includes('SENT')) {
    return MailboxType.SENT
  }

  if (upperName.includes('STARRED') || upperName.includes('FLAGGED') || upperName.includes('IMPORTANT')) {
    return MailboxType.STARRED
  }

  if (upperName.includes('ALL') || upperName.includes('ALLMAIL')) {
    return MailboxType.ALLMAIL
  }

  if (upperName.includes('ARCHIVE')) {
    return MailboxType.ARCHIVE
  }

  return MailboxType.OTHER
}

/**
 * Check if mailbox can be deleted
 * 
 * INBOX cannot be deleted (following james-project DeleteProcessor)
 * 
 * @param name - Mailbox name
 * @returns true if mailbox can be deleted
 */
export function canDeleteMailbox(name: string): boolean {
  const normalized = normalizeMailboxName(name)
  return normalized.toUpperCase() !== INBOX_NAME
}

/**
 * Check if mailbox name is valid for creation
 * 
 * @param name - Mailbox name
 * @param existingNames - List of existing mailbox names
 * @param maxLength - Maximum length (optional)
 * @returns Validation result
 */
export function canCreateMailbox(
  name: string,
  existingNames: string[] = [],
  maxLength?: number
): {
  valid: boolean
  error?: string
} {
  // Basic validation
  const validation = validateMailboxName(name, maxLength)
  if (!validation.valid) {
    return validation
  }

  // Check if already exists
  const normalized = normalizeMailboxName(name)
  const normalizedExisting = existingNames.map(n => normalizeMailboxName(n))
  
  if (normalizedExisting.includes(normalized)) {
    return {
      valid: false,
      error: 'Mailbox already exists',
    }
  }

  return { valid: true }
}

/**
 * Check if mailbox name is valid for rename
 * 
 * @param oldName - Current mailbox name
 * @param newName - New mailbox name
 * @param existingNames - List of existing mailbox names
 * @param maxLength - Maximum length (optional)
 * @returns Validation result
 */
export function canRenameMailbox(
  oldName: string,
  newName: string,
  existingNames: string[] = [],
  maxLength?: number
): {
  valid: boolean
  error?: string
} {
  // Check if old mailbox exists
  const normalizedOld = normalizeMailboxName(oldName)
  const normalizedExisting = existingNames.map(n => normalizeMailboxName(n))
  
  if (!normalizedExisting.includes(normalizedOld)) {
    return {
      valid: false,
      error: 'Source mailbox does not exist',
    }
  }

  // Check if new name is valid
  const validation = validateMailboxName(newName, maxLength)
  if (!validation.valid) {
    return validation
  }

  // Check if new name already exists (and is different from old)
  const normalizedNew = normalizeMailboxName(newName)
  if (normalizedNew !== normalizedOld && normalizedExisting.includes(normalizedNew)) {
    return {
      valid: false,
      error: 'Target mailbox already exists',
    }
  }

  return { valid: true }
}

/**
 * Get parent mailbox path
 * 
 * @param path - Mailbox path
 * @param delimiter - Hierarchy delimiter (default: /)
 * @returns Parent path or null if root
 */
export function getParentMailbox(path: string, delimiter: string = HIERARCHY_SEPARATOR): string | null {
  const lastIndex = path.lastIndexOf(delimiter)
  if (lastIndex === -1) {
    return null
  }

  return path.substring(0, lastIndex)
}

/**
 * Get mailbox hierarchy depth
 * 
 * @param path - Mailbox path
 * @param delimiter - Hierarchy delimiter (default: /)
 * @returns Depth (0 for root level)
 */
export function getMailboxDepth(path: string, delimiter: string = HIERARCHY_SEPARATOR): number {
  if (!path || path.length === 0) {
    return 0
  }

  const parts = path.split(delimiter)
  return parts.length - 1
}

/**
 * Check if mailbox is subscribed
 * 
 * In IMAP, subscription is separate from existence
 * This is a placeholder for subscription checking logic
 * 
 * @param name - Mailbox name
 * @param subscribedNames - List of subscribed mailbox names
 * @returns true if subscribed
 */
export function isSubscribed(name: string, subscribedNames: string[]): boolean {
  const normalized = normalizeMailboxName(name)
  const normalizedSubscribed = subscribedNames.map(n => normalizeMailboxName(n))
  return normalizedSubscribed.includes(normalized)
}


