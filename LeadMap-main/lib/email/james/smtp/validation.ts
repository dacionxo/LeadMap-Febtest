/**
 * SMTP Validation Utilities
 * 
 * SMTP validation patterns following james-project implementation
 * Based on EnforceHeaderLimitationsMessageHook, MailSizeEsmtpExtension, and validation patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/protocols/protocols-smtp/src/main/java/org/apache/james/smtpserver/EnforceHeaderLimitationsMessageHook.java
 * @see james-project/protocols/smtp/src/main/java/org/apache/james/protocols/smtp/core/esmtp/MailSizeEsmtpExtension.java
 */

import type { SMTPMessage } from './parser'

/**
 * Validation configuration
 */
export interface ValidationConfig {
  maxMessageSize?: number // Maximum message size in bytes (default: 100 MB)
  maxHeaderLines?: number // Maximum number of header lines (default: 500)
  maxHeaderSize?: number // Maximum header size in bytes (default: 64 KB)
  maxLineLength?: number // Maximum line length in bytes (default: 998 per RFC 5322)
  maxRecipients?: number // Maximum number of recipients (default: 100)
  requireFrom?: boolean // Require From header (default: true)
  requireTo?: boolean // Require To, Cc, or Bcc header (default: true)
  validateHeaderNames?: boolean // Validate header name format (default: true)
  validateHeaderValues?: boolean // Validate header value format (default: true)
}

/**
 * Default validation configuration
 * Following james-project EnforceHeaderLimitationsMessageHook defaults
 */
export const DEFAULT_VALIDATION_CONFIG: Required<ValidationConfig> = {
  maxMessageSize: 100 * 1024 * 1024, // 100 MB
  maxHeaderLines: 500,
  maxHeaderSize: 64 * 1024, // 64 KB
  maxLineLength: 998, // RFC 5322 limit
  maxRecipients: 100,
  requireFrom: true,
  requireTo: true,
  validateHeaderNames: true,
  validateHeaderValues: true,
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string
  message: string
  field?: string
}

/**
 * Validate SMTP message size
 * Following james-project MailSizeEsmtpExtension pattern
 * 
 * @param message - SMTP message
 * @param maxSize - Maximum size in bytes
 * @returns Validation result
 */
export function validateMessageSize(
  message: SMTPMessage | string | Buffer,
  maxSize: number = DEFAULT_VALIDATION_CONFIG.maxMessageSize
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  let messageSize: number
  if (typeof message === 'string') {
    messageSize = Buffer.byteLength(message, 'utf-8')
  } else if (Buffer.isBuffer(message)) {
    messageSize = message.length
  } else {
    // Calculate size from SMTPMessage
    const headerSize = Buffer.byteLength(JSON.stringify(message.headers), 'utf-8')
    const bodySize = Buffer.byteLength(message.body || '', 'utf-8')
    messageSize = headerSize + bodySize
  }

  if (messageSize > maxSize) {
    errors.push({
      code: 'MESSAGE_SIZE_EXCEEDED',
      message: `Message size (${formatSize(messageSize)}) exceeds maximum allowed size (${formatSize(maxSize)})`,
    })
  } else if (messageSize > maxSize * 0.9) {
    warnings.push(`Message size (${formatSize(messageSize)}) is approaching the limit (${formatSize(maxSize)})`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate SMTP message headers
 * Following james-project EnforceHeaderLimitationsMessageHook pattern
 * 
 * @param message - SMTP message
 * @param config - Validation configuration
 * @returns Validation result
 */
export function validateHeaders(
  message: SMTPMessage,
  config: Partial<ValidationConfig> = {}
): ValidationResult {
  const validationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config }
  const errors: ValidationError[] = []
  const warnings: string[] = []

  // Count header lines and calculate size
  let headerLineCount = 0
  let headerSize = 0
  const headerNames = new Set<string>()

  for (const [name, value] of Object.entries(message.headers)) {
    const normalizedName = name.toLowerCase()
    
    // Count header lines (array values count as multiple lines)
    const values = Array.isArray(value) ? value : [value]
    headerLineCount += values.length

    // Calculate header size
    for (const val of values) {
      const headerLine = `${name}: ${val}`
      headerSize += Buffer.byteLength(headerLine, 'utf-8') + 2 // +2 for CRLF
      
      // Validate header name format
      if (validationConfig.validateHeaderNames && !isValidHeaderName(name)) {
        errors.push({
          code: 'INVALID_HEADER_NAME',
          message: `Invalid header name format: ${name}`,
          field: name,
        })
      }

      // Validate header value format
      if (validationConfig.validateHeaderValues && typeof val === 'string' && !isValidHeaderValue(val)) {
        errors.push({
          code: 'INVALID_HEADER_VALUE',
          message: `Invalid header value format for ${name}`,
          field: name,
        })
      }

      // Check line length
      if (headerLine.length > validationConfig.maxLineLength) {
        errors.push({
          code: 'HEADER_LINE_TOO_LONG',
          message: `Header line exceeds maximum length (${validationConfig.maxLineLength}): ${name}`,
          field: name,
        })
      }
    }

    headerNames.add(normalizedName)
  }

  // Check header line count limit
  if (headerLineCount > validationConfig.maxHeaderLines) {
    errors.push({
      code: 'TOO_MANY_HEADER_LINES',
      message: `Header line count (${headerLineCount}) exceeds maximum (${validationConfig.maxHeaderLines})`,
    })
  } else if (headerLineCount > validationConfig.maxHeaderLines * 0.9) {
    warnings.push(`Header line count (${headerLineCount}) is approaching the limit (${validationConfig.maxHeaderLines})`)
  }

  // Check header size limit
  if (headerSize > validationConfig.maxHeaderSize) {
    errors.push({
      code: 'HEADER_SIZE_TOO_LARGE',
      message: `Header size (${formatSize(headerSize)}) exceeds maximum (${formatSize(validationConfig.maxHeaderSize)})`,
    })
  } else if (headerSize > validationConfig.maxHeaderSize * 0.9) {
    warnings.push(`Header size (${formatSize(headerSize)}) is approaching the limit (${formatSize(validationConfig.maxHeaderSize)})`)
  }

  // Check required headers
  if (validationConfig.requireFrom && !message.headers['from'] && !message.headers['From']) {
    errors.push({
      code: 'MISSING_FROM_HEADER',
      message: 'From header is required',
      field: 'from',
    })
  }

  if (validationConfig.requireTo) {
    const hasRecipient = 
      message.headers['to'] || message.headers['To'] ||
      message.headers['cc'] || message.headers['Cc'] ||
      message.headers['bcc'] || message.headers['Bcc']
    
    if (!hasRecipient) {
      errors.push({
        code: 'MISSING_RECIPIENT_HEADER',
        message: 'At least one recipient header (To, Cc, or Bcc) is required',
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate recipient count
 * 
 * @param message - SMTP message
 * @param maxRecipients - Maximum number of recipients
 * @returns Validation result
 */
export function validateRecipientCount(
  message: SMTPMessage,
  maxRecipients: number = DEFAULT_VALIDATION_CONFIG.maxRecipients
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  let recipientCount = 0

  // Count recipients from To, Cc, Bcc headers
  const recipientHeaders = ['to', 'To', 'cc', 'Cc', 'bcc', 'Bcc']
  for (const headerName of recipientHeaders) {
    const headerValue = message.headers[headerName]
    if (headerValue) {
      const values = Array.isArray(headerValue) ? headerValue : [headerValue]
      for (const value of values) {
        if (typeof value === 'string') {
          // Count email addresses in header value
          const addresses = value.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0)
          recipientCount += addresses.length
        }
      }
    }
  }

  if (recipientCount > maxRecipients) {
    errors.push({
      code: 'TOO_MANY_RECIPIENTS',
      message: `Recipient count (${recipientCount}) exceeds maximum (${maxRecipients})`,
    })
  } else if (recipientCount > maxRecipients * 0.9) {
    warnings.push(`Recipient count (${recipientCount}) is approaching the limit (${maxRecipients})`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate message body
 * 
 * @param body - Message body
 * @param config - Validation configuration
 * @returns Validation result
 */
export function validateBody(
  body: string,
  config: Partial<ValidationConfig> = {}
): ValidationResult {
  const validationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config }
  const errors: ValidationError[] = []
  const warnings: string[] = []

  if (!body || body.trim().length === 0) {
    warnings.push('Message body is empty')
    return { valid: true, errors, warnings }
  }

  const bodySize = Buffer.byteLength(body, 'utf-8')

  // Check body size (part of message size, but validate separately)
  if (bodySize > validationConfig.maxMessageSize * 0.9) {
    warnings.push(`Body size (${formatSize(bodySize)}) is large and may cause issues`)
  }

  // Check for extremely long lines (potential issues)
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.length > validationConfig.maxLineLength) {
      errors.push({
        code: 'BODY_LINE_TOO_LONG',
        message: `Body line ${i + 1} exceeds maximum length (${validationConfig.maxLineLength})`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Comprehensive SMTP message validation
 * Following james-project validation patterns
 * 
 * @param message - SMTP message
 * @param config - Validation configuration
 * @returns Validation result
 */
export function validateSMTPMessage(
  message: SMTPMessage,
  config: Partial<ValidationConfig> = {}
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  // Validate headers
  const headerValidation = validateHeaders(message, config)
  errors.push(...headerValidation.errors)
  warnings.push(...headerValidation.warnings)

  // Validate message size
  const sizeValidation = validateMessageSize(message, config.maxMessageSize)
  errors.push(...sizeValidation.errors)
  warnings.push(...sizeValidation.warnings)

  // Validate recipient count
  const recipientValidation = validateRecipientCount(message, config.maxRecipients)
  errors.push(...recipientValidation.errors)
  warnings.push(...recipientValidation.warnings)

  // Validate body
  if (message.body) {
    const bodyValidation = validateBody(message.body, config)
    errors.push(...bodyValidation.errors)
    warnings.push(...bodyValidation.warnings)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate header name format
 * Following RFC 5322 header name rules
 * 
 * @param name - Header name
 * @returns true if valid
 */
function isValidHeaderName(name: string): boolean {
  if (!name || name.length === 0) {
    return false
  }

  // Header names must be printable ASCII characters
  // Format: field-name = 1*field-char
  // field-char = VCHAR / obs-text
  // VCHAR = %x21-7E (printable ASCII except space)
  // Header names cannot contain colon or spaces
  if (name.includes(':') || name.includes(' ')) {
    return false
  }

  // Check for valid characters (printable ASCII, no control characters)
  for (let i = 0; i < name.length; i++) {
    const charCode = name.charCodeAt(i)
    if (charCode < 33 || charCode > 126) {
      return false
    }
  }

  return true
}

/**
 * Validate header value format
 * Following RFC 5322 header value rules
 * 
 * @param value - Header value
 * @returns true if valid
 */
function isValidHeaderValue(value: string): boolean {
  if (typeof value !== 'string') {
    return false
  }

  // Header values can contain printable ASCII and some control characters
  // But should not contain unescaped newlines (except continuation lines)
  // For simplicity, check for obvious issues
  if (value.includes('\r') && !value.includes('\r\n')) {
    // Lone \r without \n
    return false
  }

  // Check for null bytes (invalid)
  if (value.includes('\0')) {
    return false
  }

  return true
}

/**
 * Format size for display
 * 
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}


