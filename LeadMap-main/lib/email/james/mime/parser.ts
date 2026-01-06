/**
 * MIME Message Parser
 * 
 * MIME message parsing utilities following james-project patterns
 * Based on MimeMessageBuilder and MimeMessageWrapper
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/core/src/main/java/org/apache/james/core/builder/MimeMessageBuilder.java
 * @see james-project/core/src/main/java/org/apache/james/core/builder/MimeMessageWrapper.java
 */

import { decodeBase64, decodeQuotedPrintable, decodeHeader } from './encoding'

/**
 * MIME part structure
 */
export interface MimePart {
  headers: Record<string, string | string[]>
  contentType: string
  contentDisposition?: string
  contentTransferEncoding?: string
  body?: string
  parts?: MimePart[] // For multipart
  filename?: string
  contentId?: string
  charset?: string
}

/**
 * Parsed MIME message
 */
export interface ParsedMimeMessage {
  headers: Record<string, string | string[]>
  contentType: string
  body: MimePart
  text?: string
  html?: string
  attachments: MimePart[]
  inlineAttachments: MimePart[]
}

/**
 * Parse Content-Type header
 * 
 * @param contentTypeHeader - Content-Type header value
 * @returns Parsed content type with parameters
 */
export function parseContentType(contentTypeHeader: string): {
  type: string
  subtype: string
  parameters: Record<string, string>
} {
  const parts = contentTypeHeader.split(';')
  const mainType = parts[0].trim()
  
  const [type, subtype] = mainType.split('/').map(s => s.trim())
  
  const parameters: Record<string, string> = {}
  
  for (let i = 1; i < parts.length; i++) {
    const param = parts[i].trim()
    const equalIndex = param.indexOf('=')
    
    if (equalIndex !== -1) {
      const key = param.substring(0, equalIndex).trim().toLowerCase()
      let value = param.substring(equalIndex + 1).trim()
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      parameters[key] = value
    }
  }
  
  return {
    type: type || 'text',
    subtype: subtype || 'plain',
    parameters,
  }
}

/**
 * Parse Content-Disposition header
 * 
 * @param dispositionHeader - Content-Disposition header value
 * @returns Parsed disposition with parameters
 */
export function parseContentDisposition(dispositionHeader: string): {
  disposition: string
  parameters: Record<string, string>
} {
  const parts = dispositionHeader.split(';')
  const disposition = parts[0].trim().toLowerCase()
  
  const parameters: Record<string, string> = {}
  
  for (let i = 1; i < parts.length; i++) {
    const param = parts[i].trim()
    const equalIndex = param.indexOf('=')
    
    if (equalIndex !== -1) {
      const key = param.substring(0, equalIndex).trim().toLowerCase()
      let value = param.substring(equalIndex + 1).trim()
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      parameters[key] = decodeHeader(value) // Decode filename
    }
  }
  
  return {
    disposition,
    parameters,
  }
}

/**
 * Parse MIME part from raw data
 * 
 * @param rawData - Raw MIME part data
 * @param boundary - Boundary string for multipart (optional)
 * @returns Parsed MIME part
 */
export function parseMimePart(rawData: string, boundary?: string): MimePart {
  // Split headers and body
  const headerBodySplit = rawData.indexOf('\r\n\r\n')
  if (headerBodySplit === -1) {
    throw new Error('Invalid MIME part: missing header/body separator')
  }
  
  const headerSection = rawData.substring(0, headerBodySplit)
  const bodySection = rawData.substring(headerBodySplit + 4)
  
  // Parse headers
  const headers = parseHeaders(headerSection)
  
  // Get Content-Type
  const contentTypeHeader = (headers['content-type'] as string) || 'text/plain'
  const contentType = parseContentType(contentTypeHeader)
  const fullContentType = `${contentType.type}/${contentType.subtype}`
  
  // Get Content-Disposition
  let contentDisposition: string | undefined
  let filename: string | undefined
  if (headers['content-disposition']) {
    const dispositionHeader = headers['content-disposition'] as string
    contentDisposition = parseContentDisposition(dispositionHeader).disposition
    filename = parseContentDisposition(dispositionHeader).parameters.filename
  }
  
  // Get Content-Transfer-Encoding
  const contentTransferEncoding = (headers['content-transfer-encoding'] as string)?.toLowerCase()
  
  // Get Content-ID
  const contentId = headers['content-id'] as string | undefined
  
  // Parse body
  let body: string | undefined
  let parts: MimePart[] | undefined
  
  if (contentType.type === 'multipart') {
    // Multipart message
    const multipartBoundary = contentType.parameters.boundary
    if (!multipartBoundary) {
      throw new Error('Multipart message missing boundary parameter')
    }
    
    parts = parseMultipart(bodySection, multipartBoundary)
  } else {
    // Single part
    body = decodeBody(bodySection, contentTransferEncoding || '7bit', contentType.parameters.charset)
  }
  
  return {
    headers,
    contentType: fullContentType,
    contentDisposition,
    contentTransferEncoding,
    body,
    parts,
    filename,
    contentId: contentId?.replace(/^<|>$/g, ''),
    charset: contentType.parameters.charset,
  }
}

/**
 * Parse headers from header section
 * 
 * @param headerSection - Header section text
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
    
    // Decode header value
    const decodedValue = decodeHeader(value)
    currentValue.push(decodedValue)
  }
  
  // Save last header
  if (currentHeader) {
    headers[currentHeader] = currentValue.length === 1 ? currentValue[0] : currentValue
  }
  
  return headers
}

/**
 * Parse multipart body
 * 
 * @param body - Multipart body text
 * @param boundary - Boundary string
 * @returns Array of parsed parts
 */
function parseMultipart(body: string, boundary: string): MimePart[] {
  const parts: MimePart[] = []
  const boundaryMarker = `--${boundary}`
  const endMarker = `${boundaryMarker}--`
  
  // Split by boundary
  const sections = body.split(boundaryMarker)
  
  for (let i = 0; i < sections.length; i++) {
    let section = sections[i].trim()
    
    // Skip preamble (first section before first boundary)
    if (i === 0 && !section) {
      continue
    }
    
    // Check for end marker
    if (section.endsWith('--')) {
      section = section.slice(0, -2).trim()
    }
    
    // Skip empty sections
    if (!section) {
      continue
    }
    
    try {
      const part = parseMimePart(section)
      parts.push(part)
    } catch (error) {
      // Log error but continue parsing other parts
      console.warn('Failed to parse MIME part:', error)
    }
  }
  
  return parts
}

/**
 * Decode body content
 * 
 * @param body - Encoded body content
 * @param encoding - Content-Transfer-Encoding
 * @param charset - Character set (default: UTF-8)
 * @returns Decoded body content
 */
function decodeBody(body: string, encoding: string, charset?: string): string {
  switch (encoding.toLowerCase()) {
    case 'base64':
      return decodeBase64(body.replace(/\s/g, ''))
    
    case 'quoted-printable':
      return decodeQuotedPrintable(body)
    
    case '7bit':
    case '8bit':
    case 'binary':
    default:
      // No decoding needed
      return body
  }
}

/**
 * Extract text and HTML from parsed MIME message
 * 
 * @param part - MIME part to extract from
 * @returns Extracted text and HTML
 */
export function extractTextAndHtml(part: MimePart): {
  text?: string
  html?: string
} {
  const result: { text?: string; html?: string } = {}
  
  if (part.contentType === 'multipart/alternative' && part.parts) {
    // multipart/alternative: prefer HTML over text
    for (const subPart of part.parts) {
      if (subPart.contentType === 'text/html' && subPart.body && !result.html) {
        result.html = subPart.body
      } else if (subPart.contentType === 'text/plain' && subPart.body && !result.text) {
        result.text = subPart.body
      }
    }
  } else if (part.contentType === 'multipart/related' && part.parts) {
    // multipart/related: find text/html part
    for (const subPart of part.parts) {
      if (subPart.contentType === 'text/html' && subPart.body) {
        result.html = subPart.body
      } else if (subPart.contentType === 'text/plain' && subPart.body) {
        result.text = subPart.body
      }
    }
  } else if (part.contentType === 'multipart/mixed' && part.parts) {
    // multipart/mixed: find first text part
    for (const subPart of part.parts) {
      if (subPart.contentType === 'text/html' && subPart.body && !result.html) {
        result.html = subPart.body
      } else if (subPart.contentType === 'text/plain' && subPart.body && !result.text) {
        result.text = subPart.body
      }
    }
  } else if (part.contentType === 'text/html' && part.body) {
    result.html = part.body
  } else if (part.contentType === 'text/plain' && part.body) {
    result.text = part.body
  }
  
  return result
}

/**
 * Extract attachments from parsed MIME message
 * 
 * @param part - MIME part to extract from
 * @returns Array of attachment parts
 */
export function extractAttachments(part: MimePart): MimePart[] {
  const attachments: MimePart[] = []
  
  // Check if this part is an attachment
  if (part.contentDisposition === 'attachment' || 
      (part.filename && part.contentDisposition !== 'inline')) {
    attachments.push(part)
  }
  
  // Recursively check multipart parts
  if (part.parts) {
    for (const subPart of part.parts) {
      attachments.push(...extractAttachments(subPart))
    }
  }
  
  return attachments
}

/**
 * Extract inline attachments (images, etc.) from parsed MIME message
 * 
 * @param part - MIME part to extract from
 * @returns Array of inline attachment parts
 */
export function extractInlineAttachments(part: MimePart): MimePart[] {
  const inline: MimePart[] = []
  
  // Check if this part is inline
  if (part.contentDisposition === 'inline' || 
      (part.contentId && part.contentDisposition !== 'attachment')) {
    inline.push(part)
  }
  
  // Recursively check multipart parts
  if (part.parts) {
    for (const subPart of part.parts) {
      inline.push(...extractInlineAttachments(subPart))
    }
  }
  
  return inline
}

/**
 * Parse complete MIME message
 * 
 * @param rawMessage - Raw MIME message
 * @returns Parsed MIME message
 */
export function parseMimeMessage(rawMessage: string): ParsedMimeMessage {
  const rootPart = parseMimePart(rawMessage)
  
  // Extract text and HTML
  const { text, html } = extractTextAndHtml(rootPart)
  
  // Extract attachments
  const attachments = extractAttachments(rootPart)
  const inlineAttachments = extractInlineAttachments(rootPart)
  
  return {
    headers: rootPart.headers,
    contentType: rootPart.contentType,
    body: rootPart,
    text,
    html,
    attachments,
    inlineAttachments,
  }
}

