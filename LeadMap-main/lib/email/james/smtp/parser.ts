/**
 * SMTP Message Parser
 * 
 * SMTP message parsing utilities following james-project patterns
 * Based on DataLineMessageHookHandler and SMTP message handling
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/smtp/src/main/java/org/apache/james/protocols/smtp/core/DataLineMessageHookHandler.java
 */

/**
 * SMTP message structure
 */
export interface SMTPMessage {
  headers: Record<string, string | string[]>
  body: string
  raw: string
}

/**
 * Parse SMTP message from raw data
 * 
 * Handles dot-stuffing and message termination
 * Following james-project DataLineMessageHookHandler patterns
 * 
 * @param rawData - Raw SMTP message data
 * @returns Parsed SMTP message
 */
export function parseSMTPMessage(rawData: string | Buffer): SMTPMessage {
  const data = typeof rawData === 'string' ? rawData : rawData.toString('utf-8')
  
  // Split headers and body
  const headerBodySplit = data.indexOf('\r\n\r\n')
  if (headerBodySplit === -1) {
    // No body, headers only
    return {
      headers: parseHeaders(data),
      body: '',
      raw: data,
    }
  }

  const headerSection = data.substring(0, headerBodySplit)
  const bodySection = data.substring(headerBodySplit + 4) // Skip \r\n\r\n

  // Parse headers
  const headers = parseHeaders(headerSection)

  // Process body (handle dot-stuffing)
  const body = processBody(bodySection)

  return {
    headers,
    body,
    raw: data,
  }
}

/**
 * Parse email headers
 * 
 * @param headerSection - Header section of message
 * @returns Parsed headers
 */
function parseHeaders(headerSection: string): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {}
  const lines = headerSection.split(/\r?\n/)

  let currentHeader: string | null = null
  let currentValue: string[] = []

  for (const line of lines) {
    // Continuation line (starts with whitespace)
    if (/^\s/.test(line) && currentHeader) {
      currentValue.push(line.trim())
      continue
    }

    // Save previous header
    if (currentHeader) {
      headers[currentHeader] = currentValue.length === 1 ? currentValue[0] : currentValue
      currentValue = []
    }

    // Parse header line
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) {
      continue
    }

    currentHeader = line.substring(0, colonIndex).trim().toLowerCase()
    const value = line.substring(colonIndex + 1).trim()
    currentValue.push(value)
  }

  // Save last header
  if (currentHeader) {
    headers[currentHeader] = currentValue.length === 1 ? currentValue[0] : currentValue
  }

  return headers
}

/**
 * Process message body
 * 
 * Handles dot-stuffing (RFC 5321)
 * Removes leading dots from lines starting with ".."
 * 
 * @param bodySection - Body section of message
 * @returns Processed body
 */
function processBody(bodySection: string): string {
  const lines = bodySection.split(/\r?\n/)
  const processed: string[] = []

  for (const line of lines) {
    // Dot-stuffing: remove leading dot from lines starting with ".."
    if (line.startsWith('..')) {
      processed.push(line.substring(1))
    } else {
      processed.push(line)
    }
  }

  return processed.join('\r\n')
}

/**
 * Extract message termination
 * 
 * Checks if message ends with ".\r\n" (message termination)
 * Following james-project DataLineMessageHookHandler pattern
 * 
 * @param data - Message data
 * @returns true if message is terminated
 */
export function isMessageTerminated(data: string | Buffer): boolean {
  const str = typeof data === 'string' ? data : data.toString('utf-8')
  
  // Check for ".\r\n" termination
  if (str.endsWith('.\r\n')) {
    return true
  }

  // Check for ".\n" termination
  if (str.endsWith('.\n')) {
    return true
  }

  // Check for standalone "." line
  const lines = str.split(/\r?\n/)
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1]
    if (lastLine === '.' || lastLine === '.\r') {
      return true
    }
  }

  return false
}



