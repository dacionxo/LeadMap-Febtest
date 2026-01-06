/**
 * IMAP Message Flags Utilities
 * 
 * IMAP flag management patterns following james-project implementation
 * Based on MessageFlags, DecoderUtils, and StoreProcessor
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/api/message/MessageFlags.java
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/decode/DecoderUtils.java
 */

/**
 * IMAP system flags (RFC 3501)
 */
export enum SystemFlag {
  SEEN = '\\Seen',
  RECENT = '\\Recent',
  FLAGGED = '\\Flagged',
  DRAFT = '\\Draft',
  DELETED = '\\Deleted',
  ANSWERED = '\\Answered',
}

/**
 * IMAP flag set
 */
export interface FlagSet {
  systemFlags: Set<SystemFlag>
  userFlags: Set<string>
}

/**
 * Create empty flag set
 * 
 * @returns Empty flag set
 */
export function createFlagSet(): FlagSet {
  return {
    systemFlags: new Set(),
    userFlags: new Set(),
  }
}

/**
 * Parse flag string to flag set
 * 
 * Following james-project DecoderUtils.setFlag patterns
 * Handles both system flags and user flags
 * 
 * @param flagString - Flag string (e.g., "\\Seen \\Flagged")
 * @returns Flag set
 */
export function parseFlags(flagString: string): FlagSet {
  const flags = createFlagSet()
  
  if (!flagString || flagString.trim().length === 0) {
    return flags
  }
  
  // Split by whitespace and process each flag
  const flagParts = flagString.trim().split(/\s+/)
  
  for (const flagPart of flagParts) {
    const trimmed = flagPart.trim()
    if (!trimmed) {
      continue
    }
    
    // Try to match system flag
    const systemFlag = parseSystemFlag(trimmed)
    if (systemFlag) {
      flags.systemFlags.add(systemFlag)
    } else {
      // User flag (must not start with \)
      if (!trimmed.startsWith('\\')) {
        flags.userFlags.add(trimmed)
      }
    }
  }
  
  return flags
}

/**
 * Parse system flag from string
 * 
 * Following james-project MessageFlags constants
 * 
 * @param flagString - Flag string
 * @returns System flag or null if not a system flag
 */
export function parseSystemFlag(flagString: string): SystemFlag | null {
  const upper = flagString.toUpperCase()
  
  // Check against all caps versions (james-project pattern)
  switch (upper) {
    case '\\ANSWERED':
    case '\\ANSWERED_OUTPUT_CAPITALISED':
      return SystemFlag.ANSWERED
    
    case '\\DELETED':
    case '\\DELETED_OUTPUT_CAPITALISED':
      return SystemFlag.DELETED
    
    case '\\DRAFT':
    case '\\DRAFT_OUTPUT_CAPITALISED':
      return SystemFlag.DRAFT
    
    case '\\FLAGGED':
    case '\\FLAGGED_OUTPUT_CAPITALISED':
      return SystemFlag.FLAGGED
    
    case '\\SEEN':
    case '\\SEEN_OUTPUT_CAPITALISED':
      return SystemFlag.SEEN
    
    case '\\RECENT':
    case '\\RECENT_OUTPUT_CAPITALISED':
      // RECENT cannot be set by client (RFC 3501)
      return null
    
    default:
      // Check case-insensitive match
      if (flagString.toLowerCase() === '\\answered') {
        return SystemFlag.ANSWERED
      }
      if (flagString.toLowerCase() === '\\deleted') {
        return SystemFlag.DELETED
      }
      if (flagString.toLowerCase() === '\\draft') {
        return SystemFlag.DRAFT
      }
      if (flagString.toLowerCase() === '\\flagged') {
        return SystemFlag.FLAGGED
      }
      if (flagString.toLowerCase() === '\\seen') {
        return SystemFlag.SEEN
      }
      return null
  }
}

/**
 * Format flag set to IMAP flag string
 * 
 * Following james-project MessageFlags.names patterns
 * 
 * @param flags - Flag set
 * @returns IMAP flag string
 */
export function formatFlags(flags: FlagSet): string {
  const parts: string[] = []
  
  // Add system flags in standard order
  if (flags.systemFlags.has(SystemFlag.ANSWERED)) {
    parts.push(SystemFlag.ANSWERED)
  }
  if (flags.systemFlags.has(SystemFlag.DELETED)) {
    parts.push(SystemFlag.DELETED)
  }
  if (flags.systemFlags.has(SystemFlag.DRAFT)) {
    parts.push(SystemFlag.DRAFT)
  }
  if (flags.systemFlags.has(SystemFlag.FLAGGED)) {
    parts.push(SystemFlag.FLAGGED)
  }
  if (flags.systemFlags.has(SystemFlag.RECENT)) {
    parts.push(SystemFlag.RECENT)
  }
  if (flags.systemFlags.has(SystemFlag.SEEN)) {
    parts.push(SystemFlag.SEEN)
  }
  
  // Add user flags
  for (const userFlag of flags.userFlags) {
    parts.push(userFlag)
  }
  
  return parts.join(' ')
}

/**
 * Add flag to flag set
 * 
 * @param flags - Flag set
 * @param flag - Flag to add (system flag or user flag string)
 */
export function addFlag(flags: FlagSet, flag: SystemFlag | string): void {
  if (typeof flag === 'string' && flag.startsWith('\\')) {
    const systemFlag = parseSystemFlag(flag)
    if (systemFlag) {
      flags.systemFlags.add(systemFlag)
    }
  } else if (typeof flag === 'string') {
    flags.userFlags.add(flag)
  } else {
    flags.systemFlags.add(flag)
  }
}

/**
 * Remove flag from flag set
 * 
 * @param flags - Flag set
 * @param flag - Flag to remove
 */
export function removeFlag(flags: FlagSet, flag: SystemFlag | string): void {
  if (typeof flag === 'string' && flag.startsWith('\\')) {
    const systemFlag = parseSystemFlag(flag)
    if (systemFlag) {
      flags.systemFlags.delete(systemFlag)
    }
  } else if (typeof flag === 'string') {
    flags.userFlags.delete(flag)
  } else {
    flags.systemFlags.delete(flag)
  }
}

/**
 * Check if flag set contains flag
 * 
 * @param flags - Flag set
 * @param flag - Flag to check
 * @returns true if flag is set
 */
export function hasFlag(flags: FlagSet, flag: SystemFlag | string): boolean {
  if (typeof flag === 'string' && flag.startsWith('\\')) {
    const systemFlag = parseSystemFlag(flag)
    if (systemFlag) {
      return flags.systemFlags.has(systemFlag)
    }
    return false
  } else if (typeof flag === 'string') {
    return flags.userFlags.has(flag)
  } else {
    return flags.systemFlags.has(flag)
  }
}

/**
 * Check if flag can be set by client
 * 
 * RECENT flag cannot be set by client (RFC 3501)
 * Following james-project DecoderUtils.setFlag validation
 * 
 * @param flag - Flag to check
 * @returns true if flag can be set by client
 */
export function canSetFlag(flag: SystemFlag | string): boolean {
  if (flag === SystemFlag.RECENT || flag === '\\Recent' || flag === '\\RECENT') {
    return false
  }
  return true
}

/**
 * Validate flag string
 * 
 * @param flagString - Flag string to validate
 * @returns Validation result
 */
export function validateFlags(flagString: string): {
  valid: boolean
  error?: string
  flags?: FlagSet
} {
  if (!flagString || flagString.trim().length === 0) {
    return { valid: true, flags: createFlagSet() }
  }
  
  const flags = createFlagSet()
  const flagParts = flagString.trim().split(/\s+/)
  
  for (const flagPart of flagParts) {
    const trimmed = flagPart.trim()
    if (!trimmed) {
      continue
    }
    
    // Check if system flag
    if (trimmed.startsWith('\\')) {
      const systemFlag = parseSystemFlag(trimmed)
      if (!systemFlag) {
        return {
          valid: false,
          error: `Invalid system flag: ${trimmed}`,
        }
      }
      
      // Check if can be set
      if (!canSetFlag(systemFlag)) {
        return {
          valid: false,
          error: `Flag cannot be set by client: ${trimmed}`,
        }
      }
      
      flags.systemFlags.add(systemFlag)
    } else {
      // User flag - validate format
      if (trimmed.length === 0) {
        return {
          valid: false,
          error: 'Empty user flag',
        }
      }
      
      // User flags cannot contain certain characters
      if (/[\x00-\x1F\x7F(){%*"\\]/.test(trimmed)) {
        return {
          valid: false,
          error: `Invalid characters in user flag: ${trimmed}`,
        }
      }
      
      flags.userFlags.add(trimmed)
    }
  }
  
  return { valid: true, flags }
}

/**
 * Merge flag sets
 * 
 * Combines two flag sets (union)
 * 
 * @param flags1 - First flag set
 * @param flags2 - Second flag set
 * @returns Merged flag set
 */
export function mergeFlags(flags1: FlagSet, flags2: FlagSet): FlagSet {
  const merged = createFlagSet()
  
  // Merge system flags
  for (const flag of flags1.systemFlags) {
    merged.systemFlags.add(flag)
  }
  for (const flag of flags2.systemFlags) {
    merged.systemFlags.add(flag)
  }
  
  // Merge user flags
  for (const flag of flags1.userFlags) {
    merged.userFlags.add(flag)
  }
  for (const flag of flags2.userFlags) {
    merged.userFlags.add(flag)
  }
  
  return merged
}

/**
 * Get flag update mode
 * 
 * Following james-project MessageManager.FlagsUpdateMode
 * 
 * @param mode - Update mode string
 * @returns Update mode or 'REPLACE' as default
 */
export function getFlagUpdateMode(mode?: string): 'ADD' | 'REMOVE' | 'REPLACE' {
  if (!mode) {
    return 'REPLACE'
  }
  
  const upper = mode.toUpperCase()
  if (upper === 'ADD' || upper === '+FLAGS') {
    return 'ADD'
  }
  if (upper === 'REMOVE' || upper === '-FLAGS') {
    return 'REMOVE'
  }
  return 'REPLACE'
}

/**
 * Apply flag update to flag set
 * 
 * @param currentFlags - Current flag set
 * @param updateFlags - Flags to update
 * @param mode - Update mode
 * @returns Updated flag set
 */
export function applyFlagUpdate(
  currentFlags: FlagSet,
  updateFlags: FlagSet,
  mode: 'ADD' | 'REMOVE' | 'REPLACE' = 'REPLACE'
): FlagSet {
  if (mode === 'REPLACE') {
    return updateFlags
  }
  
  const result = createFlagSet()
  
  // Start with current flags
  for (const flag of currentFlags.systemFlags) {
    result.systemFlags.add(flag)
  }
  for (const flag of currentFlags.userFlags) {
    result.userFlags.add(flag)
  }
  
  if (mode === 'ADD') {
    // Add update flags
    for (const flag of updateFlags.systemFlags) {
      result.systemFlags.add(flag)
    }
    for (const flag of updateFlags.userFlags) {
      result.userFlags.add(flag)
    }
  } else if (mode === 'REMOVE') {
    // Remove update flags
    for (const flag of updateFlags.systemFlags) {
      result.systemFlags.delete(flag)
    }
    for (const flag of updateFlags.userFlags) {
      result.userFlags.delete(flag)
    }
  }
  
  return result
}


