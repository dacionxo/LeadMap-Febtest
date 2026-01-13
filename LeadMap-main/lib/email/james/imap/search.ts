/**
 * IMAP Search Utilities
 * 
 * IMAP search capabilities following james-project implementation
 * Based on SearchProcessor and SearchCommandParser
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/SearchProcessor.java
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/decode/parser/SearchCommandParser.java
 */

import { SystemFlag, FlagSet, parseFlags, parseSystemFlag, hasFlag } from './flags'

/**
 * Search criterion type
 */
export type SearchCriterionType =
  | 'ALL'
  | 'AND'
  | 'ANSWERED'
  | 'BCC'
  | 'BEFORE'
  | 'BODY'
  | 'CC'
  | 'DELETED'
  | 'DRAFT'
  | 'FLAGGED'
  | 'FROM'
  | 'HEADER'
  | 'KEYWORD'
  | 'LARGER'
  | 'NEW'
  | 'NOT'
  | 'OLD'
  | 'ON'
  | 'OR'
  | 'RECENT'
  | 'SEEN'
  | 'SENTBEFORE'
  | 'SENTON'
  | 'SENTSINCE'
  | 'SINCE'
  | 'SMALLER'
  | 'SUBJECT'
  | 'TEXT'
  | 'TO'
  | 'UID'
  | 'UNANSWERED'
  | 'UNDELETED'
  | 'UNDRAFT'
  | 'UNFLAGGED'
  | 'UNKEYWORD'
  | 'UNSEEN'

/**
 * Search criterion
 */
export interface SearchCriterion {
  type: SearchCriterionType
  value?: string | number | Date
  headerName?: string
  date?: Date
  size?: number
  flags?: FlagSet
  criteria?: SearchCriterion[] // For AND, OR, NOT
}

/**
 * Search query
 */
export interface SearchQuery {
  criteria: SearchCriterion[]
  useUids?: boolean
  charset?: string
}

/**
 * Search result
 */
export interface SearchResult {
  messageIds: number[]
  count?: number
  min?: number
  max?: number
  all?: boolean
}

/**
 * Create ALL search criterion
 * 
 * Matches all messages
 * 
 * @returns Search criterion
 */
export function searchAll(): SearchCriterion {
  return { type: 'ALL' }
}

/**
 * Create flag-based search criterion
 * 
 * @param flag - System flag to search for
 * @param negated - If true, search for messages without flag
 * @returns Search criterion
 */
export function searchByFlag(flag: SystemFlag, negated: boolean = false): SearchCriterion {
  const flagSet = parseFlags(flag)
  
  if (negated) {
    switch (flag) {
      case SystemFlag.ANSWERED:
        return { type: 'UNANSWERED' }
      case SystemFlag.DELETED:
        return { type: 'UNDELETED' }
      case SystemFlag.DRAFT:
        return { type: 'UNDRAFT' }
      case SystemFlag.FLAGGED:
        return { type: 'UNFLAGGED' }
      case SystemFlag.SEEN:
        return { type: 'UNSEEN' }
      default:
        return { type: 'NOT', criteria: [{ type: 'FLAGGED', flags: flagSet }] }
    }
  }
  
  switch (flag) {
    case SystemFlag.ANSWERED:
      return { type: 'ANSWERED' }
    case SystemFlag.DELETED:
      return { type: 'DELETED' }
    case SystemFlag.DRAFT:
      return { type: 'DRAFT' }
    case SystemFlag.FLAGGED:
      return { type: 'FLAGGED' }
    case SystemFlag.SEEN:
      return { type: 'SEEN' }
    case SystemFlag.RECENT:
      return { type: 'RECENT' }
    default:
      return { type: 'FLAGGED', flags: flagSet }
  }
}

/**
 * Create address-based search criterion
 * 
 * @param field - Address field (FROM, TO, CC, BCC)
 * @param address - Email address or pattern
 * @returns Search criterion
 */
export function searchByAddress(
  field: 'FROM' | 'TO' | 'CC' | 'BCC',
  address: string
): SearchCriterion {
  return {
    type: field,
    value: address,
  }
}

/**
 * Create header-based search criterion
 * 
 * @param headerName - Header name
 * @param value - Header value (optional, if empty searches for header existence)
 * @returns Search criterion
 */
export function searchByHeader(headerName: string, value?: string): SearchCriterion {
  return {
    type: 'HEADER',
    headerName,
    value,
  }
}

/**
 * Create subject search criterion
 * 
 * @param text - Text to search for in subject
 * @returns Search criterion
 */
export function searchBySubject(text: string): SearchCriterion {
  return {
    type: 'SUBJECT',
    value: text,
  }
}

/**
 * Create body search criterion
 * 
 * @param text - Text to search for in body
 * @returns Search criterion
 */
export function searchByBody(text: string): SearchCriterion {
  return {
    type: 'BODY',
    value: text,
  }
}

/**
 * Create text search criterion
 * 
 * Searches in headers and body
 * 
 * @param text - Text to search for
 * @returns Search criterion
 */
export function searchByText(text: string): SearchCriterion {
  return {
    type: 'TEXT',
    value: text,
  }
}

/**
 * Create date-based search criterion
 * 
 * @param field - Date field (BEFORE, ON, SINCE, SENTBEFORE, SENTON, SENTSINCE)
 * @param date - Date to search for
 * @returns Search criterion
 */
export function searchByDate(
  field: 'BEFORE' | 'ON' | 'SINCE' | 'SENTBEFORE' | 'SENTON' | 'SENTSINCE',
  date: Date
): SearchCriterion {
  return {
    type: field,
    date,
  }
}

/**
 * Create size-based search criterion
 * 
 * @param field - Size field (LARGER, SMALLER)
 * @param size - Size in bytes
 * @returns Search criterion
 */
export function searchBySize(field: 'LARGER' | 'SMALLER', size: number): SearchCriterion {
  return {
    type: field,
    size,
  }
}

/**
 * Create UID range search criterion
 * 
 * @param range - UID range (e.g., "1:10" or "1,3,5")
 * @returns Search criterion
 */
export function searchByUid(range: string): SearchCriterion {
  return {
    type: 'UID',
    value: range,
  }
}

/**
 * Create keyword search criterion
 * 
 * @param keyword - User flag keyword
 * @param negated - If true, search for messages without keyword
 * @returns Search criterion
 */
export function searchByKeyword(keyword: string, negated: boolean = false): SearchCriterion {
  return {
    type: negated ? 'UNKEYWORD' : 'KEYWORD',
    value: keyword,
  }
}

/**
 * Create AND search criterion
 * 
 * All criteria must match
 * 
 * @param criteria - Array of criteria
 * @returns Search criterion
 */
export function searchAnd(criteria: SearchCriterion[]): SearchCriterion {
  if (criteria.length === 0) {
    return searchAll()
  }
  
  if (criteria.length === 1) {
    return criteria[0]
  }
  
  return {
    type: 'AND',
    criteria,
  }
}

/**
 * Create OR search criterion
 * 
 * At least one criterion must match
 * 
 * @param criteria - Array of criteria
 * @returns Search criterion
 */
export function searchOr(criteria: SearchCriterion[]): SearchCriterion {
  if (criteria.length === 0) {
    return searchAll()
  }
  
  if (criteria.length === 1) {
    return criteria[0]
  }
  
  return {
    type: 'OR',
    criteria,
  }
}

/**
 * Create NOT search criterion
 * 
 * Negates a criterion
 * 
 * @param criterion - Criterion to negate
 * @returns Search criterion
 */
export function searchNot(criterion: SearchCriterion): SearchCriterion {
  return {
    type: 'NOT',
    criteria: [criterion],
  }
}

/**
 * Create NEW search criterion
 * 
 * Messages with RECENT flag and without SEEN flag
 * 
 * @returns Search criterion
 */
export function searchNew(): SearchCriterion {
  return {
    type: 'NEW',
  }
}

/**
 * Create OLD search criterion
 * 
 * Messages without RECENT flag
 * 
 * @returns Search criterion
 */
export function searchOld(): SearchCriterion {
  return {
    type: 'OLD',
  }
}

/**
 * Format search criterion to IMAP search key string
 * 
 * @param criterion - Search criterion
 * @returns IMAP search key string
 */
export function formatSearchCriterion(criterion: SearchCriterion): string {
  switch (criterion.type) {
    case 'ALL':
      return 'ALL'
    
    case 'ANSWERED':
      return 'ANSWERED'
    case 'UNANSWERED':
      return 'UNANSWERED'
    
    case 'DELETED':
      return 'DELETED'
    case 'UNDELETED':
      return 'UNDELETED'
    
    case 'DRAFT':
      return 'DRAFT'
    case 'UNDRAFT':
      return 'UNDRAFT'
    
    case 'FLAGGED':
      return 'FLAGGED'
    case 'UNFLAGGED':
      return 'UNFLAGGED'
    
    case 'SEEN':
      return 'SEEN'
    case 'UNSEEN':
      return 'UNSEEN'
    
    case 'RECENT':
      return 'RECENT'
    case 'OLD':
      return 'OLD'
    case 'NEW':
      return 'NEW'
    
    case 'FROM':
      return `FROM ${criterion.value}`
    case 'TO':
      return `TO ${criterion.value}`
    case 'CC':
      return `CC ${criterion.value}`
    case 'BCC':
      return `BCC ${criterion.value}`
    
    case 'SUBJECT':
      return `SUBJECT ${criterion.value}`
    case 'BODY':
      return `BODY ${criterion.value}`
    case 'TEXT':
      return `TEXT ${criterion.value}`
    
    case 'HEADER':
      if (!criterion.value || criterion.value === '') {
        return `HEADER ${criterion.headerName}`
      }
      return `HEADER ${criterion.headerName} ${criterion.value}`
    
    case 'BEFORE':
      return `BEFORE ${formatDate(criterion.date!)}`
    case 'ON':
      return `ON ${formatDate(criterion.date!)}`
    case 'SINCE':
      return `SINCE ${formatDate(criterion.date!)}`
    case 'SENTBEFORE':
      return `SENTBEFORE ${formatDate(criterion.date!)}`
    case 'SENTON':
      return `SENTON ${formatDate(criterion.date!)}`
    case 'SENTSINCE':
      return `SENTSINCE ${formatDate(criterion.date!)}`
    
    case 'LARGER':
      return `LARGER ${criterion.size}`
    case 'SMALLER':
      return `SMALLER ${criterion.size}`
    
    case 'UID':
      return `UID ${criterion.value}`
    
    case 'KEYWORD':
      return `KEYWORD ${criterion.value}`
    case 'UNKEYWORD':
      return `UNKEYWORD ${criterion.value}`
    
    case 'AND':
      if (!criterion.criteria || criterion.criteria.length === 0) {
        return 'ALL'
      }
      return `(${criterion.criteria.map(formatSearchCriterion).join(' ')})`
    
    case 'OR':
      if (!criterion.criteria || criterion.criteria.length === 0) {
        return 'ALL'
      }
      return `OR ${formatSearchCriterion(criterion.criteria[0])} ${formatSearchCriterion(criterion.criteria[1])}`
    
    case 'NOT':
      if (!criterion.criteria || criterion.criteria.length === 0) {
        return 'ALL'
      }
      return `NOT ${formatSearchCriterion(criterion.criteria[0])}`
    
    default:
      return 'ALL'
  }
}

/**
 * Format date for IMAP search
 * 
 * Format: DD-MMM-YYYY (e.g., "01-Jan-2024")
 * 
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = monthNames[date.getMonth()]
  const year = date.getFullYear()
  
  return `${day}-${month}-${year}`
}

/**
 * Parse date from IMAP format
 * 
 * @param dateString - Date string (DD-MMM-YYYY)
 * @returns Parsed date or null if invalid
 */
export function parseImapDate(dateString: string): Date | null {
  const parts = dateString.split('-')
  if (parts.length !== 3) {
    return null
  }
  
  const day = parseInt(parts[0], 10)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = monthNames.indexOf(parts[1])
  const year = parseInt(parts[2], 10)
  
  if (isNaN(day) || month === -1 || isNaN(year)) {
    return null
  }
  
  return new Date(year, month, day)
}

/**
 * Validate search query
 * 
 * @param query - Search query to validate
 * @returns Validation result
 */
export function validateSearchQuery(query: SearchQuery): {
  valid: boolean
  error?: string
} {
  if (!query.criteria || query.criteria.length === 0) {
    return {
      valid: false,
      error: 'Search query must have at least one criterion',
    }
  }
  
  // Validate each criterion
  for (const criterion of query.criteria) {
    const validation = validateSearchCriterion(criterion)
    if (!validation.valid) {
      return validation
    }
  }
  
  return { valid: true }
}

/**
 * Validate search criterion
 * 
 * @param criterion - Search criterion to validate
 * @returns Validation result
 */
function validateSearchCriterion(criterion: SearchCriterion): {
  valid: boolean
  error?: string
} {
  // Check required fields based on type
  switch (criterion.type) {
    case 'FROM':
    case 'TO':
    case 'CC':
    case 'BCC':
    case 'SUBJECT':
    case 'BODY':
    case 'TEXT':
      if (!criterion.value || typeof criterion.value !== 'string') {
        return {
          valid: false,
          error: `${criterion.type} requires a string value`,
        }
      }
      break
    
    case 'HEADER':
      if (!criterion.headerName) {
        return {
          valid: false,
          error: 'HEADER requires a header name',
        }
      }
      break
    
    case 'BEFORE':
    case 'ON':
    case 'SINCE':
    case 'SENTBEFORE':
    case 'SENTON':
    case 'SENTSINCE':
      if (!criterion.date || !(criterion.date instanceof Date)) {
        return {
          valid: false,
          error: `${criterion.type} requires a Date value`,
        }
      }
      break
    
    case 'LARGER':
    case 'SMALLER':
      if (criterion.size === undefined || typeof criterion.size !== 'number') {
        return {
          valid: false,
          error: `${criterion.type} requires a number value`,
        }
      }
      break
    
    case 'UID':
    case 'KEYWORD':
    case 'UNKEYWORD':
      if (!criterion.value) {
        return {
          valid: false,
          error: `${criterion.type} requires a value`,
        }
      }
      break
    
    case 'AND':
    case 'OR':
      if (!criterion.criteria || criterion.criteria.length < 2) {
        return {
          valid: false,
          error: `${criterion.type} requires at least 2 criteria`,
        }
      }
      // Recursively validate nested criteria
      for (const nested of criterion.criteria) {
        const nestedValidation = validateSearchCriterion(nested)
        if (!nestedValidation.valid) {
          return nestedValidation
        }
      }
      break
    
    case 'NOT':
      if (!criterion.criteria || criterion.criteria.length !== 1) {
        return {
          valid: false,
          error: 'NOT requires exactly one criterion',
        }
      }
      // Recursively validate nested criterion
      return validateSearchCriterion(criterion.criteria[0])
  }
  
  return { valid: true }
}

/**
 * Build search query from criteria
 * 
 * @param criteria - Array of search criteria
 * @param useUids - Use UIDs instead of sequence numbers
 * @param charset - Character set (default: UTF-8)
 * @returns Search query
 */
export function buildSearchQuery(
  criteria: SearchCriterion[],
  useUids: boolean = false,
  charset: string = 'UTF-8'
): SearchQuery {
  return {
    criteria,
    useUids,
    charset,
  }
}

/**
 * Format search query to IMAP SEARCH command string
 * 
 * @param query - Search query
 * @returns IMAP SEARCH command string
 */
export function formatSearchQuery(query: SearchQuery): string {
  const criteriaStr = query.criteria.map(formatSearchCriterion).join(' ')
  const uidPrefix = query.useUids ? 'UID ' : ''
  return `${uidPrefix}SEARCH ${criteriaStr}`
}

/**
 * Parse IMAP search query string
 * Following james-project SearchCommandParser pattern
 * 
 * @param imapSearchString - IMAP search string (e.g., "FROM \"user@example.com\" SUBJECT \"Test\"")
 * @returns Parsed search query
 */
export function parseSearchQuery(imapSearchString: string): SearchQuery {
  const criteria: SearchCriterion[] = []
  const tokens = tokenizeSearchString(imapSearchString)
  
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i].toUpperCase()
    
    switch (token) {
      case 'ALL':
        criteria.push({ type: 'ALL' })
        i++
        break
      
      case 'ANSWERED':
      case 'UNANSWERED':
      case 'DELETED':
      case 'UNDELETED':
      case 'DRAFT':
      case 'UNDRAFT':
      case 'FLAGGED':
      case 'UNFLAGGED':
      case 'SEEN':
      case 'UNSEEN':
      case 'RECENT':
      case 'OLD':
      case 'NEW':
        criteria.push({ type: token as SearchCriterionType })
        i++
        break
      
      case 'FROM':
      case 'TO':
      case 'CC':
      case 'BCC':
      case 'SUBJECT':
      case 'BODY':
      case 'TEXT':
        if (i + 1 < tokens.length) {
          const value = unquoteString(tokens[i + 1])
          criteria.push({ type: token as SearchCriterionType, value })
          i += 2
        } else {
          i++
        }
        break
      
      case 'HEADER':
        if (i + 2 < tokens.length) {
          const headerName = tokens[i + 1]
          const value = unquoteString(tokens[i + 2])
          criteria.push({ type: 'HEADER', headerName, value })
          i += 3
        } else if (i + 1 < tokens.length) {
          const headerName = tokens[i + 1]
          criteria.push({ type: 'HEADER', headerName })
          i += 2
        } else {
          i++
        }
        break
      
      case 'BEFORE':
      case 'ON':
      case 'SINCE':
      case 'SENTBEFORE':
      case 'SENTON':
      case 'SENTSINCE':
        if (i + 1 < tokens.length) {
          const dateStr = unquoteString(tokens[i + 1])
          const date = parseImapDate(dateStr) || new Date(dateStr)
          criteria.push({ type: token as SearchCriterionType, date })
          i += 2
        } else {
          i++
        }
        break
      
      case 'LARGER':
      case 'SMALLER':
        if (i + 1 < tokens.length) {
          const size = parseInt(tokens[i + 1], 10)
          if (!isNaN(size)) {
            criteria.push({ type: token as SearchCriterionType, size })
            i += 2
          } else {
            i++
          }
        } else {
          i++
        }
        break
      
      case 'UID':
        if (i + 1 < tokens.length) {
          criteria.push({ type: 'UID', value: tokens[i + 1] })
          i += 2
        } else {
          i++
        }
        break
      
      case 'KEYWORD':
      case 'UNKEYWORD':
        if (i + 1 < tokens.length) {
          criteria.push({ type: token as SearchCriterionType, value: tokens[i + 1] })
          i += 2
        } else {
          i++
        }
        break
      
      case 'OR':
        if (i + 2 < tokens.length) {
          // OR requires two criteria - simplified parsing
          const criterion1 = parseSearchQuery(tokens[i + 1]).criteria[0]
          const criterion2 = parseSearchQuery(tokens[i + 2]).criteria[0]
          if (criterion1 && criterion2) {
            criteria.push({ type: 'OR', criteria: [criterion1, criterion2] })
            i += 3
          } else {
            i++
          }
        } else {
          i++
        }
        break
      
      case 'NOT':
        if (i + 1 < tokens.length) {
          const notQuery = parseSearchQuery(tokens[i + 1])
          if (notQuery.criteria.length > 0) {
            criteria.push({ type: 'NOT', criteria: notQuery.criteria })
            i += 2
          } else {
            i++
          }
        } else {
          i++
        }
        break
      
      default:
        i++
        break
    }
  }
  
  return buildSearchQuery(criteria)
}

/**
 * Tokenize IMAP search string
 * Handles quoted strings and whitespace
 * 
 * @param searchString - Search string
 * @returns Array of tokens
 */
function tokenizeSearchString(searchString: string): string[] {
  const tokens: string[] = []
  let currentToken = ''
  let inQuotes = false
  let escapeNext = false
  
  for (let i = 0; i < searchString.length; i++) {
    const char = searchString[i]
    
    if (escapeNext) {
      currentToken += char
      escapeNext = false
      continue
    }
    
    if (char === '\\' && inQuotes) {
      escapeNext = true
      currentToken += char
      continue
    }
    
    if (char === '"') {
      inQuotes = !inQuotes
      currentToken += char
      continue
    }
    
    if (char === ' ' && !inQuotes) {
      if (currentToken.trim()) {
        tokens.push(currentToken.trim())
        currentToken = ''
      }
      continue
    }
    
    currentToken += char
  }
  
  if (currentToken.trim()) {
    tokens.push(currentToken.trim())
  }
  
  return tokens
}

/**
 * Remove quotes from string if present
 * 
 * @param str - String to unquote
 * @returns Unquoted string
 */
function unquoteString(str: string): string {
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1)
  }
  return str
}

/**
 * Message interface for search evaluation
 */
export interface SearchableMessage {
  flags?: FlagSet | string[] | string
  from?: string
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  text?: string
  headers?: Record<string, string | string[]>
  size?: number
  internalDate?: Date
  sentDate?: Date
  uid?: number
}

/**
 * Evaluate search query against messages
 * Following james-project SearchProcessor pattern
 * 
 * @param query - Search query
 * @param messages - Array of messages to search
 * @returns Array of matching messages
 */
export function evaluateSearchQuery<T extends SearchableMessage>(
  query: SearchQuery,
  messages: T[]
): T[] {
  return messages.filter(message => {
    return query.criteria.every(criterion => {
      return matchCriterion(criterion, message)
    })
  })
}

/**
 * Match a single criterion against a message
 * 
 * @param criterion - Search criterion
 * @param message - Message to match
 * @returns true if message matches criterion
 */
function matchCriterion(criterion: SearchCriterion, message: SearchableMessage): boolean {
  const flags = normalizeFlags(message.flags)
  
  switch (criterion.type) {
    case 'ALL':
      return true
    
    case 'ANSWERED':
      return hasFlag(flags, SystemFlag.ANSWERED)
    case 'UNANSWERED':
      return !hasFlag(flags, SystemFlag.ANSWERED)
    
    case 'DELETED':
      return hasFlag(flags, SystemFlag.DELETED)
    case 'UNDELETED':
      return !hasFlag(flags, SystemFlag.DELETED)
    
    case 'DRAFT':
      return hasFlag(flags, SystemFlag.DRAFT)
    case 'UNDRAFT':
      return !hasFlag(flags, SystemFlag.DRAFT)
    
    case 'FLAGGED':
      return hasFlag(flags, SystemFlag.FLAGGED)
    case 'UNFLAGGED':
      return !hasFlag(flags, SystemFlag.FLAGGED)
    
    case 'SEEN':
      return hasFlag(flags, SystemFlag.SEEN)
    case 'UNSEEN':
      return !hasFlag(flags, SystemFlag.SEEN)
    
    case 'RECENT':
      return hasFlag(flags, SystemFlag.RECENT)
    case 'OLD':
      return !hasFlag(flags, SystemFlag.RECENT)
    case 'NEW':
      return hasFlag(flags, SystemFlag.RECENT) && !hasFlag(flags, SystemFlag.SEEN)
    
    case 'FROM':
      return message.from?.toLowerCase().includes((criterion.value as string).toLowerCase()) || false
    case 'TO':
      return message.to?.toLowerCase().includes((criterion.value as string).toLowerCase()) || false
    case 'CC':
      return message.cc?.toLowerCase().includes((criterion.value as string).toLowerCase()) || false
    case 'BCC':
      return message.bcc?.toLowerCase().includes((criterion.value as string).toLowerCase()) || false
    
    case 'SUBJECT':
      return message.subject?.toLowerCase().includes((criterion.value as string).toLowerCase()) || false
    case 'BODY':
      return message.body?.toLowerCase().includes((criterion.value as string).toLowerCase()) || false
    case 'TEXT':
      const searchText = (criterion.value as string).toLowerCase()
      return (
        message.subject?.toLowerCase().includes(searchText) ||
        message.body?.toLowerCase().includes(searchText) ||
        message.text?.toLowerCase().includes(searchText) ||
        false
      )
    
    case 'HEADER':
      if (!criterion.headerName) return false
      const headerValue = message.headers?.[criterion.headerName.toLowerCase()]
      if (!headerValue) return false
      if (criterion.value) {
        const headerStr = Array.isArray(headerValue) ? headerValue.join(' ') : headerValue
        return headerStr.toLowerCase().includes((criterion.value as string).toLowerCase())
      }
      return true // Header exists
    
    case 'BEFORE':
      if (!message.internalDate || !criterion.date) return false
      return message.internalDate < criterion.date
    case 'ON':
      if (!message.internalDate || !criterion.date) return false
      return message.internalDate.toDateString() === criterion.date.toDateString()
    case 'SINCE':
      if (!message.internalDate || !criterion.date) return false
      return message.internalDate >= criterion.date
    
    case 'SENTBEFORE':
      if (!message.sentDate || !criterion.date) return false
      return message.sentDate < criterion.date
    case 'SENTON':
      if (!message.sentDate || !criterion.date) return false
      return message.sentDate.toDateString() === criterion.date.toDateString()
    case 'SENTSINCE':
      if (!message.sentDate || !criterion.date) return false
      return message.sentDate >= criterion.date
    
    case 'LARGER':
      if (!message.size || criterion.size === undefined) return false
      return message.size > criterion.size
    case 'SMALLER':
      if (!message.size || criterion.size === undefined) return false
      return message.size < criterion.size
    
    case 'UID':
      if (!message.uid || !criterion.value) return false
      // Simple UID matching (could be enhanced for ranges)
      return message.uid.toString() === criterion.value.toString()
    
    case 'KEYWORD':
      if (!criterion.value) return false
      return hasUserFlag(flags, criterion.value as string)
    case 'UNKEYWORD':
      if (!criterion.value) return false
      return !hasUserFlag(flags, criterion.value as string)
    
    case 'OR':
      if (!criterion.criteria || criterion.criteria.length < 2) return false
      return matchCriterion(criterion.criteria[0], message) || matchCriterion(criterion.criteria[1], message)
    
    case 'NOT':
      if (!criterion.criteria || criterion.criteria.length !== 1) return false
      return !matchCriterion(criterion.criteria[0], message)
    
    default:
      return false
  }
}

/**
 * Normalize flags to FlagSet
 * 
 * @param flags - Flags in various formats
 * @returns FlagSet
 */
function normalizeFlags(flags?: FlagSet | string[] | string): FlagSet {
  if (!flags) {
    return { systemFlags: new Set(), userFlags: new Set() }
  }
  
  if (typeof flags === 'string') {
    return parseFlags(flags)
  }
  
  if (Array.isArray(flags)) {
    const flagSet = { systemFlags: new Set<SystemFlag>(), userFlags: new Set<string>() }
    for (const flag of flags) {
      if (flag.startsWith('\\')) {
        const systemFlag = parseSystemFlag(flag)
        if (systemFlag) {
          flagSet.systemFlags.add(systemFlag)
        }
      } else {
        flagSet.userFlags.add(flag)
      }
    }
    return flagSet
  }
  
  return flags
}


/**
 * Check if flag set has a user flag
 * 
 * @param flags - Flag set
 * @param flag - User flag
 * @returns true if flag is set
 */
function hasUserFlag(flags: FlagSet, flag: string): boolean {
  return flags.userFlags.has(flag)
}


