/**
 * james-project Pattern Utilities
 * 
 * TypeScript utilities adapted from Apache James Project patterns
 * 
 * This module provides utilities for:
 * - Email address validation and parsing
 * - SMTP message parsing and validation
 * - MIME message handling
 * - IMAP protocol utilities
 * - Mailbox management
 * - Email threading
 */

// Validation utilities
export * from './validation/email-address'

// SMTP utilities
export * from './smtp/parser'
export * from './smtp/routing'
export * from './smtp/validation'

// MIME utilities
export * from './mime/encoding'
export * from './mime/parser'
export * from './mime/attachments'

// IMAP utilities
export * from './imap/folders'
export * from './imap/flags'
export * from './imap/search'
export * from './imap/idle'

// Mailbox utilities
export * from './mailbox/quota'
export * from './mailbox/manager'

// Threading utilities
export * from './threading/thread-reconstruction'

// Queue utilities
export * from './queue/message-queue'

// Error recovery utilities
export * from './error-recovery/circuit-breaker'

// Performance utilities
export * from './performance/cache'

// Rate limiting utilities
export * from './rate-limiting'

// Monitoring utilities
export * from './monitoring'

// Connection utilities
export * from './connection'

// Event utilities
export * from './events'

// Filtering utilities
export * from './filtering'

// Security utilities
export * from './security'

// Spam detection utilities
export * from './spam'

// OAuth utilities
export * from './oauth'

// DLP utilities
export * from './dlp'

// Vacation utilities
export * from './vacation'

// Forwarding utilities
export * from './forwarding'

// Composition utilities
export * from './composition'

// Search utilities
export * from './search'

// Archiving utilities
export * from './archiving'

// Backup utilities
export * from './backup'

// Migration utilities
export * from './migration'

// Compliance utilities
export * from './compliance'

// Delivery utilities
export * from './delivery'

// Tracking utilities
export * from './tracking'

// Reputation utilities
export * from './reputation'

// List management utilities
export * from './lists'

