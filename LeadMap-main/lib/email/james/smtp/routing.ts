/**
 * SMTP Routing Utilities
 * 
 * SMTP routing patterns following james-project implementation
 * Based on RcptCmdHandler and recipient validation patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/smtp/src/main/java/org/apache/james/protocols/smtp/core/RcptCmdHandler.java
 * @see james-project/protocols/smtp/src/main/java/org/apache/james/protocols/smtp/core/fastfail/AbstractValidRcptHandler.java
 */

import { parseEmailAddress, isValidEmailAddress, normalizeEmailAddress } from '../validation/email-address'

/**
 * Routing result
 */
export interface RoutingResult {
  valid: boolean
  isLocal: boolean
  domain: string
  normalizedAddress: string | null
  error?: string
}

/**
 * Domain resolution result
 */
export interface DomainResolution {
  domain: string
  isLocal: boolean
  mxRecords?: string[]
  error?: string
}

/**
 * Recipient validation configuration
 */
export interface RoutingConfig {
  localDomains: string[]
  defaultDomain?: string
  enforceBrackets?: boolean
  allowRelay?: boolean
}

/**
 * Default routing configuration
 */
const DEFAULT_CONFIG: RoutingConfig = {
  localDomains: [],
  enforceBrackets: false,
  allowRelay: false,
}

/**
 * Validate and route recipient address
 * 
 * Following james-project RcptCmdHandler patterns
 * Handles recipient parsing, domain resolution, and local/remote routing
 * 
 * @param recipient - Recipient address string (may include RCPT TO: prefix)
 * @param config - Routing configuration
 * @returns Routing result
 */
export function routeRecipient(recipient: string, config: Partial<RoutingConfig> = {}): RoutingResult {
  const routingConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Parse recipient from RCPT TO: command format
  let cleanRecipient = recipient.trim()
  
  // Remove RCPT TO: prefix if present
  if (cleanRecipient.toUpperCase().startsWith('RCPT TO:')) {
    cleanRecipient = cleanRecipient.substring(8).trim()
  }
  
  // Handle optional recipient type (TO, CC, BCC)
  if (cleanRecipient.includes(':')) {
    const colonIndex = cleanRecipient.indexOf(':')
    const type = cleanRecipient.substring(0, colonIndex).trim().toUpperCase()
    cleanRecipient = cleanRecipient.substring(colonIndex + 1).trim()
    
    // Only TO is standard for RCPT command
    if (type !== 'TO') {
      return {
        valid: false,
        isLocal: false,
        domain: '',
        normalizedAddress: null,
        error: `Invalid recipient type: ${type}`,
      }
    }
  }
  
  // Remove angle brackets if present (and enforce if configured)
  let address = cleanRecipient
  if (address.startsWith('<') && address.endsWith('>')) {
    address = address.substring(1, address.length - 1).trim()
  } else if (routingConfig.enforceBrackets) {
    return {
      valid: false,
      isLocal: false,
      domain: '',
      normalizedAddress: null,
      error: 'Address must be enclosed in angle brackets',
    }
  }
  
  // Extract options if present (after closing bracket)
  // Format: <address> OPTIONS
  const bracketIndex = cleanRecipient.lastIndexOf('>')
  if (bracketIndex > 0 && bracketIndex < cleanRecipient.length - 1) {
    const afterBracket = cleanRecipient.substring(bracketIndex + 1).trim()
    if (afterBracket && afterBracket.startsWith(' ')) {
      // Options present, but we'll ignore them for now
      // In full implementation, these could be parsed (e.g., NOTIFY, RET)
    }
  }
  
  // Add default domain if no @ present
  if (!address.includes('@')) {
    if (!routingConfig.defaultDomain) {
      return {
        valid: false,
        isLocal: false,
        domain: '',
        normalizedAddress: null,
        error: 'No domain specified and no default domain configured',
      }
    }
    address = `${address}@${routingConfig.defaultDomain}`
  }
  
  // Validate email address format
  if (!isValidEmailAddress(address)) {
    return {
      valid: false,
      isLocal: false,
      domain: '',
      normalizedAddress: null,
      error: 'Invalid email address format',
    }
  }
  
  // Parse address
  const parsed = parseEmailAddress(address)
  if (!parsed) {
    return {
      valid: false,
      isLocal: false,
      domain: '',
      normalizedAddress: null,
      error: 'Failed to parse email address',
    }
  }
  
  // Normalize address
  const normalized = normalizeEmailAddress(address)
  
  // Check if domain is local
  const isLocal = isLocalDomain(parsed.domain, routingConfig.localDomains)
  
  return {
    valid: true,
    isLocal,
    domain: parsed.domain.toLowerCase(),
    normalizedAddress: normalized,
  }
}

/**
 * Check if domain is local
 * 
 * @param domain - Domain to check
 * @param localDomains - List of local domains
 * @returns true if domain is local
 */
export function isLocalDomain(domain: string, localDomains: string[]): boolean {
  const normalizedDomain = domain.toLowerCase()
  
  for (const localDomain of localDomains) {
    const normalizedLocal = localDomain.toLowerCase()
    
    // Exact match
    if (normalizedDomain === normalizedLocal) {
      return true
    }
    
    // Subdomain match (e.g., mail.example.com matches example.com)
    if (normalizedDomain.endsWith(`.${normalizedLocal}`)) {
      return true
    }
  }
  
  return false
}

/**
 * Resolve domain for routing
 * 
 * Determines if domain is local or requires remote delivery
 * 
 * @param domain - Domain to resolve
 * @param config - Routing configuration
 * @returns Domain resolution result
 */
export function resolveDomain(domain: string, config: Partial<RoutingConfig> = {}): DomainResolution {
  const routingConfig = { ...DEFAULT_CONFIG, ...config }
  const normalizedDomain = domain.toLowerCase()
  
  // Check if local
  const isLocal = isLocalDomain(normalizedDomain, routingConfig.localDomains)
  
  if (isLocal) {
    return {
      domain: normalizedDomain,
      isLocal: true,
    }
  }
  
  // Remote domain - would need MX record lookup in full implementation
  // For now, return as remote
  return {
    domain: normalizedDomain,
    isLocal: false,
  }
}

/**
 * Validate recipient for local delivery
 * 
 * Checks if recipient exists and is valid for local delivery
 * Following james-project AbstractValidRcptHandler patterns
 * 
 * @param address - Email address
 * @param config - Routing configuration
 * @returns true if valid for local delivery
 */
export function isValidLocalRecipient(address: string, config: Partial<RoutingConfig> = {}): boolean {
  const routingConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Parse address
  const parsed = parseEmailAddress(address)
  if (!parsed) {
    return false
  }
  
  // Check if domain is local
  if (!isLocalDomain(parsed.domain, routingConfig.localDomains)) {
    return false
  }
  
  // Address format is valid and domain is local
  // In full implementation, would check if user exists
  return true
}

/**
 * Validate recipient for relay
 * 
 * Checks if recipient can be relayed (sent to remote domain)
 * 
 * @param address - Email address
 * @param config - Routing configuration
 * @returns true if relay is allowed
 */
export function canRelay(address: string, config: Partial<RoutingConfig> = {}): boolean {
  const routingConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Relay must be explicitly allowed
  if (!routingConfig.allowRelay) {
    return false
  }
  
  // Parse address
  const parsed = parseEmailAddress(address)
  if (!parsed) {
    return false
  }
  
  // Cannot relay to local domains
  if (isLocalDomain(parsed.domain, routingConfig.localDomains)) {
    return false
  }
  
  return true
}

/**
 * Extract recipient from RCPT command
 * 
 * Parses RCPT TO: command format
 * 
 * @param rcptCommand - RCPT command string
 * @returns Recipient address or null if invalid
 */
export function extractRecipientFromRcptCommand(rcptCommand: string): string | null {
  const routeResult = routeRecipient(rcptCommand)
  
  if (!routeResult.valid || !routeResult.normalizedAddress) {
    return null
  }
  
  return routeResult.normalizedAddress
}

/**
 * Classify recipient (local vs remote)
 * 
 * @param address - Email address
 * @param config - Routing configuration
 * @returns 'local' | 'remote' | 'invalid'
 */
export function classifyRecipient(address: string, config: Partial<RoutingConfig> = {}): 'local' | 'remote' | 'invalid' {
  const routeResult = routeRecipient(address, config)
  
  if (!routeResult.valid) {
    return 'invalid'
  }
  
  return routeResult.isLocal ? 'local' : 'remote'
}


