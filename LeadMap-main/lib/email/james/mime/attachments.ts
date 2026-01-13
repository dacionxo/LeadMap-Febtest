/**
 * MIME Attachment Utilities
 * 
 * Attachment handling utilities following james-project patterns
 * Based on MimeMessageBuilder BodyPartBuilder patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/core/src/main/java/org/apache/james/core/builder/MimeMessageBuilder.java
 */

import type { MimePart } from './parser'
import { extractAttachments, extractInlineAttachments } from './parser'

/**
 * Attachment metadata
 */
export interface AttachmentInfo {
  filename?: string
  contentType: string
  size: number
  contentId?: string
  contentDisposition: string
  encoding?: string
  charset?: string
}

/**
 * Get attachment information from MIME part
 * 
 * @param part - MIME part
 * @returns Attachment information
 */
export function getAttachmentInfo(part: MimePart): AttachmentInfo {
  return {
    filename: part.filename,
    contentType: part.contentType,
    size: part.body ? Buffer.byteLength(part.body, 'utf-8') : 0,
    contentId: part.contentId,
    contentDisposition: part.contentDisposition || 'attachment',
    encoding: part.contentTransferEncoding,
    charset: part.charset,
  }
}

/**
 * Get all attachments from parsed MIME message
 * 
 * @param part - Root MIME part
 * @returns Array of attachment information
 */
export function getAllAttachments(part: MimePart): AttachmentInfo[] {
  const attachments = extractAttachments(part)
  return attachments.map(getAttachmentInfo)
}

/**
 * Get all inline attachments from parsed MIME message
 * 
 * @param part - Root MIME part
 * @returns Array of inline attachment information
 */
export function getAllInlineAttachments(part: MimePart): AttachmentInfo[] {
  const inline = extractInlineAttachments(part)
  return inline.map(getAttachmentInfo)
}

/**
 * Find attachment by filename
 * 
 * @param part - Root MIME part
 * @param filename - Filename to search for
 * @returns Attachment part or null if not found
 */
export function findAttachmentByFilename(part: MimePart, filename: string): MimePart | null {
  const attachments = extractAttachments(part)
  
  for (const attachment of attachments) {
    if (attachment.filename === filename || 
        attachment.filename?.toLowerCase() === filename.toLowerCase()) {
      return attachment
    }
  }
  
  return null
}

/**
 * Find attachment by filename from array
 * 
 * @param attachments - Array of MIME parts
 * @param filename - Filename to search for
 * @returns Attachment part or null if not found
 */
export function findAttachmentByFilenameFromArray(attachments: MimePart[], filename: string): MimePart | null {
  for (const attachment of attachments) {
    if (attachment.filename === filename || 
        attachment.filename?.toLowerCase() === filename.toLowerCase()) {
      return attachment
    }
  }
  
  return null
}

/**
 * Find inline attachment by Content-ID
 * 
 * @param part - Root MIME part
 * @param contentId - Content-ID to search for
 * @returns Inline attachment part or null if not found
 */
export function findInlineAttachmentByCid(part: MimePart, contentId: string): MimePart | null {
  const inline = extractInlineAttachments(part)
  
  // Remove angle brackets if present
  const cleanCid = contentId.replace(/^<|>$/g, '')
  
  for (const attachment of inline) {
    const attachmentCid = attachment.contentId?.replace(/^<|>$/g, '')
    if (attachmentCid === cleanCid) {
      return attachment
    }
  }
  
  return null
}

/**
 * Find attachment by Content-ID from array
 * 
 * @param attachments - Array of MIME parts
 * @param contentId - Content-ID to search for
 * @returns Attachment part or null if not found
 */
export function findAttachmentByContentId(attachments: MimePart[], contentId: string): MimePart | null {
  // Remove angle brackets if present
  const cleanCid = contentId.replace(/^<|>$/g, '')
  
  for (const attachment of attachments) {
    const attachmentCid = attachment.contentId?.replace(/^<|>$/g, '')
    if (attachmentCid === cleanCid) {
      return attachment
    }
  }
  
  return null
}

/**
 * Get attachment content as Buffer
 * 
 * @param part - MIME part containing attachment
 * @returns Buffer with attachment content
 */
export function getAttachmentContent(part: MimePart): Buffer | null {
  if (!part.body) {
    return null
  }
  
  return Buffer.from(part.body, part.charset ? undefined : 'utf-8')
}

/**
 * Get attachment content as base64 string
 * 
 * @param part - MIME part containing attachment
 * @returns Base64 encoded content
 */
export function getAttachmentContentBase64(part: MimePart): string | null {
  const buffer = getAttachmentContent(part)
  if (!buffer) {
    return null
  }
  
  return buffer.toString('base64')
}

/**
 * Check if MIME part is an attachment
 * 
 * @param part - MIME part to check
 * @returns true if part is an attachment
 */
export function isAttachment(part: MimePart): boolean {
  return (
    part.contentDisposition === 'attachment' ||
    (part.filename !== undefined && part.contentDisposition !== 'inline')
  )
}

/**
 * Check if MIME part is an inline attachment
 * 
 * @param part - MIME part to check
 * @returns true if part is an inline attachment
 */
export function isInlineAttachment(part: MimePart): boolean {
  return (
    part.contentDisposition === 'inline' ||
    (part.contentId !== undefined && part.contentDisposition !== 'attachment')
  )
}

/**
 * Get attachment MIME type from filename
 * 
 * @param filename - Filename
 * @returns MIME type or 'application/octet-stream' if unknown
 */
export function getMimeTypeFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase()
  
  if (!extension) {
    return 'application/octet-stream'
  }
  
  // Common MIME types
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Text
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    
    // Video
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
  }
  
  return mimeTypes[extension] || 'application/octet-stream'
}

/**
 * Validate attachment size
 * 
 * @param part - MIME part containing attachment
 * @param maxSize - Maximum size in bytes
 * @returns true if attachment size is within limit
 */
export function validateAttachmentSize(part: MimePart, maxSize: number): boolean {
  if (!part.body) {
    return true // Empty attachment
  }
  
  const size = Buffer.byteLength(part.body, 'utf-8')
  return size <= maxSize
}

/**
 * Validate attachment size from attachment info
 * 
 * @param attachment - Attachment with size property
 * @param maxSize - Maximum size in bytes
 * @returns true if attachment size is within limit
 */
export function validateAttachmentSizeFromInfo(attachment: { size: number }, maxSize: number): boolean {
  return attachment.size <= maxSize
}

/**
 * Get total size of all attachments
 * 
 * @param part - Root MIME part
 * @returns Total size in bytes
 */
export function getTotalAttachmentSize(part: MimePart): number {
  const attachments = extractAttachments(part)
  let totalSize = 0
  
  for (const attachment of attachments) {
    if (attachment.body) {
      totalSize += Buffer.byteLength(attachment.body, 'utf-8')
    }
  }
  
  return totalSize
}

