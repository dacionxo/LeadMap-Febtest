/**
 * Mailbox Management Utilities
 * 
 * Mailbox management patterns following james-project implementation
 * Based on MailboxManager interface and mailbox lifecycle patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/mailbox/api/src/main/java/org/apache/james/mailbox/MailboxManager.java
 */

import { QuotaUsage, QuotaLimit, QuotaComponent } from './quota'

/**
 * Mailbox capabilities
 */
export enum MailboxCapability {
  ANNOTATION = 'Annotation',
  MOVE = 'Move',
  NAMESPACE = 'Namespace',
  USER_FLAG = 'UserFlag',
  ACL = 'ACL',
  QUOTA = 'Quota',
}

/**
 * Message capabilities
 */
export enum MessageCapability {
  UNIQUE_ID = 'UniqueID',
}

/**
 * Search capabilities
 */
export enum SearchCapability {
  MULTIMAILBOX_SEARCH = 'MultimailboxSearch',
  PARTIAL_EMAIL_MATCH = 'PartialEmailMatch',
  TEXT = 'Text',
  FULL_TEXT = 'FullText',
  ATTACHMENT = 'Attachment',
  ATTACHMENT_FILE_NAME = 'AttachmentFileName',
  HIGHLIGHT_SEARCH = 'HighlightSearch',
}

/**
 * Mailbox metadata
 */
export interface MailboxMetadata {
  id: string
  name: string
  path: string
  namespace?: string
  user?: string
  messageCount: number
  unreadCount: number
  recentCount: number
  uidValidity?: number
  uidNext?: number
  highestModSeq?: number
  quota?: QuotaUsage
}

/**
 * Mailbox session
 */
export interface MailboxSession {
  sessionId: string
  userId: string
  username: string
  loggedInUser?: string
  capabilities: {
    mailbox: MailboxCapability[]
    message: MessageCapability[]
    search: SearchCapability[]
  }
  createdAt: Date
}

/**
 * Create mailbox session
 * 
 * @param userId - User ID
 * @param username - Username
 * @param capabilities - Session capabilities
 * @returns Mailbox session
 */
export function createMailboxSession(
  userId: string,
  username: string,
  capabilities?: {
    mailbox?: MailboxCapability[]
    message?: MessageCapability[]
    search?: SearchCapability[]
  }
): MailboxSession {
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    userId,
    username,
    capabilities: {
      mailbox: capabilities?.mailbox || [],
      message: capabilities?.message || [],
      search: capabilities?.search || [],
    },
    createdAt: new Date(),
  }
}

/**
 * Check if session has mailbox capability
 * 
 * @param session - Mailbox session
 * @param capability - Capability to check
 * @returns true if session has capability
 */
export function hasMailboxCapability(
  session: MailboxSession,
  capability: MailboxCapability
): boolean {
  return session.capabilities.mailbox.includes(capability)
}

/**
 * Check if session has message capability
 * 
 * @param session - Mailbox session
 * @param capability - Capability to check
 * @returns true if session has capability
 */
export function hasMessageCapability(
  session: MailboxSession,
  capability: MessageCapability
): boolean {
  return session.capabilities.message.includes(capability)
}

/**
 * Check if session has search capability
 * 
 * @param session - Mailbox session
 * @param capability - Capability to check
 * @returns true if session has capability
 */
export function hasSearchCapability(
  session: MailboxSession,
  capability: SearchCapability
): boolean {
  return session.capabilities.search.includes(capability)
}

/**
 * Validate mailbox metadata
 * 
 * @param metadata - Mailbox metadata to validate
 * @returns Validation result
 */
export function validateMailboxMetadata(metadata: MailboxMetadata): {
  valid: boolean
  error?: string
} {
  if (!metadata.id || metadata.id.trim().length === 0) {
    return {
      valid: false,
      error: 'Mailbox ID is required',
    }
  }
  
  if (!metadata.name || metadata.name.trim().length === 0) {
    return {
      valid: false,
      error: 'Mailbox name is required',
    }
  }
  
  if (metadata.messageCount < 0) {
    return {
      valid: false,
      error: 'Message count cannot be negative',
    }
  }
  
  if (metadata.unreadCount < 0) {
    return {
      valid: false,
      error: 'Unread count cannot be negative',
    }
  }
  
  if (metadata.recentCount < 0) {
    return {
      valid: false,
      error: 'Recent count cannot be negative',
    }
  }
  
  return { valid: true }
}



/**
 * Get default mailbox capabilities
 * 
 * @returns Default capabilities
 */
export function getDefaultMailboxCapabilities(): MailboxCapability[] {
  return [
    MailboxCapability.NAMESPACE,
    MailboxCapability.USER_FLAG,
  ]
}

/**
 * Get default message capabilities
 * 
 * @returns Default capabilities
 */
export function getDefaultMessageCapabilities(): MessageCapability[] {
  return [
    MessageCapability.UNIQUE_ID,
  ]
}

/**
 * Get default search capabilities
 * 
 * @returns Default capabilities
 */
export function getDefaultSearchCapabilities(): SearchCapability[] {
  return [
    SearchCapability.TEXT,
  ]
}

/**
 * Check if mailbox supports quota
 * 
 * @param session - Mailbox session
 * @returns true if quota is supported
 */
export function supportsQuota(session: MailboxSession): boolean {
  return hasMailboxCapability(session, MailboxCapability.QUOTA)
}

/**
 * Check if mailbox supports ACL
 * 
 * @param session - Mailbox session
 * @returns true if ACL is supported
 */
export function supportsACL(session: MailboxSession): boolean {
  return hasMailboxCapability(session, MailboxCapability.ACL)
}

/**
 * Check if mailbox supports annotations
 * 
 * @param session - Mailbox session
 * @returns true if annotations are supported
 */
export function supportsAnnotations(session: MailboxSession): boolean {
  return hasMailboxCapability(session, MailboxCapability.ANNOTATION)
}

/**
 * Get mailbox quota info
 * 
 * @param metadata - Mailbox metadata
 * @param component - Quota component
 * @returns Quota info or null if not available
 */
export function getMailboxQuotaInfo(
  metadata: MailboxMetadata,
  component: QuotaComponent = QuotaComponent.MAILBOX
): QuotaUsage | null {
  return metadata.quota || null
}


