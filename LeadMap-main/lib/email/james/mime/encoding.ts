/**
 * MIME Encoding Utilities
 * 
 * Email encoding utilities following james-project patterns
 * Supports base64, quoted-printable, and header encoding
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/core/src/main/java/org/apache/james/core/builder/MimeMessageBuilder.java
 */

/**
 * Encoding types
 */
export type EncodingType = '7bit' | '8bit' | 'base64' | 'quoted-printable' | 'binary'

/**
 * Base64 encode string
 * 
 * @param data - Data to encode (string or Buffer)
 * @returns Base64 encoded string
 */
export function encodeBase64(data: string | Buffer): string {
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf-8').toString('base64')
  }
  return data.toString('base64')
}

/**
 * Base64 decode string
 * 
 * @param encoded - Base64 encoded string
 * @returns Decoded string
 */
export function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8')
}

/**
 * Quoted-printable encode string
 * 
 * Following RFC 2045 quoted-printable encoding rules
 * 
 * @param text - Text to encode
 * @returns Quoted-printable encoded string
 */
export function encodeQuotedPrintable(text: string): string {
  let encoded = ''
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const code = char.charCodeAt(0)
    
    // Characters that don't need encoding
    if (
      (code >= 33 && code <= 60) || // ! through <
      (code >= 62 && code <= 126) || // > through ~
      char === ' ' ||
      char === '\t'
    ) {
      encoded += char
    } else if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
      // CRLF - keep as is
      encoded += '\r\n'
      i++ // Skip LF
    } else {
      // Encode as =XX
      const hex = code.toString(16).toUpperCase().padStart(2, '0')
      encoded += `=${hex}`
    }
  }
  
  // Soft line breaks: lines must not exceed 76 characters
  // Insert =CRLF before 76th character
  const lines: string[] = []
  let currentLine = ''
  
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i]
    
    if (char === '\r' && i + 1 < encoded.length && encoded[i + 1] === '\n') {
      // Actual line break
      currentLine += '\r\n'
      lines.push(currentLine)
      currentLine = ''
      i++ // Skip LF
    } else {
      currentLine += char
      
      // Check if we need a soft line break
      if (currentLine.length >= 75 && char !== '\n') {
        // Find a safe place to break (not in the middle of =XX)
        let breakPos = currentLine.length
        if (currentLine[currentLine.length - 1] === '=') {
          breakPos = currentLine.length - 1
        } else if (currentLine[currentLine.length - 2] === '=') {
          breakPos = currentLine.length - 2
        }
        
        const beforeBreak = currentLine.substring(0, breakPos)
        const afterBreak = currentLine.substring(breakPos)
        
        lines.push(beforeBreak + '=\r\n')
        currentLine = afterBreak
      }
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine)
  }
  
  return lines.join('')
}

/**
 * Quoted-printable decode string
 * 
 * @param encoded - Quoted-printable encoded string
 * @returns Decoded string
 */
export function decodeQuotedPrintable(encoded: string): string {
  let decoded = ''
  let i = 0
  
  while (i < encoded.length) {
    const char = encoded[i]
    
    if (char === '=') {
      // Check for soft line break (=CRLF)
      if (i + 2 < encoded.length && encoded[i + 1] === '\r' && encoded[i + 2] === '\n') {
        // Soft line break - remove it
        i += 3
        continue
      }
      
      // Check for =XX hex encoding
      if (i + 2 < encoded.length) {
        const hex = encoded.substring(i + 1, i + 3)
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          const code = parseInt(hex, 16)
          decoded += String.fromCharCode(code)
          i += 3
          continue
        }
      }
      
      // Invalid = sequence, keep as is
      decoded += char
      i++
    } else {
      decoded += char
      i++
    }
  }
  
  return decoded
}

/**
 * Encode email header value
 * 
 * Encodes non-ASCII characters in header values using RFC 2047 encoding
 * Format: =?charset?encoding?encoded-text?=
 * 
 * @param text - Header value to encode
 * @param charset - Character set (default: UTF-8)
 * @returns Encoded header value
 */
export function encodeHeader(text: string, charset: string = 'UTF-8'): string {
  // Check if encoding is needed
  if (/^[\x00-\x7F]*$/.test(text)) {
    // ASCII only, no encoding needed
    return text
  }
  
  // Encode using base64
  const encoded = encodeBase64(text)
  
  // Split into chunks of 75 characters (RFC 2047 limit)
  const chunks: string[] = []
  for (let i = 0; i < encoded.length; i += 75) {
    chunks.push(encoded.substring(i, i + 75))
  }
  
  // Format as =?charset?B?encoded?=
  return chunks.map(chunk => `=?${charset}?B?${chunk}?=`).join(' ')
}

/**
 * Decode email header value
 * 
 * Decodes RFC 2047 encoded header values
 * 
 * @param encoded - Encoded header value
 * @returns Decoded header value
 */
export function decodeHeader(encoded: string): string {
  // Match =?charset?encoding?text?= pattern
  const pattern = /=\?([^?]+)\?([BQ])\?([^?]+)\?=/g
  
  let decoded = encoded
  let match: RegExpExecArray | null
  
  while ((match = pattern.exec(encoded)) !== null) {
    const [, charset, encoding, text] = match
    
    let decodedText: string
    if (encoding === 'B' || encoding === 'b') {
      // Base64 encoding
      try {
        decodedText = decodeBase64(text)
      } catch {
        decodedText = match[0] // Keep original if decode fails
      }
    } else if (encoding === 'Q' || encoding === 'q') {
      // Quoted-printable encoding
      decodedText = decodeQuotedPrintable(text.replace(/_/g, ' '))
    } else {
      decodedText = match[0] // Unknown encoding, keep original
    }
    
    decoded = decoded.replace(match[0], decodedText)
  }
  
  return decoded
}

/**
 * Detect encoding type from content
 * 
 * @param content - Content to analyze
 * @returns Suggested encoding type
 */
export function detectEncoding(content: string | Buffer): EncodingType {
  const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
  
  // Check for binary data (non-printable characters)
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      // Non-printable character found, use base64
      return 'base64'
    }
  }
  
  // Check for 8-bit characters
  const text = data.toString('utf-8')
  if (!/^[\x00-\x7F]*$/.test(text)) {
    // Contains non-ASCII characters
    return 'quoted-printable'
  }
  
  // Check line length (if lines are too long, use quoted-printable)
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (line.length > 998) {
      // Line too long, use quoted-printable for soft line breaks
      return 'quoted-printable'
    }
  }
  
  // ASCII only, short lines - use 7bit
  return '7bit'
}

/**
 * Get encoding for content type
 * 
 * @param contentType - MIME content type
 * @param content - Content data
 * @returns Recommended encoding
 */
export function getEncodingForContentType(
  contentType: string,
  content: string | Buffer
): EncodingType {
  // Binary content types always use base64
  if (
    contentType.startsWith('image/') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('application/octet-stream') ||
    contentType.startsWith('application/pdf')
  ) {
    return 'base64'
  }
  
  // Text content - detect based on content
  return detectEncoding(content)
}


