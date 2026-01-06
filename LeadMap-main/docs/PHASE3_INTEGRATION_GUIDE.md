# Phase 3: james-project Integration Guide

## Overview

This guide documents the integration of james-project patterns into the Unibox email system. All utilities have been adapted from Apache James Project Java code to TypeScript, following best practices and .cursorrules guidelines.

## Integration Points

### 1. SMTP Integration (Task 21) ✅ **ENHANCED IN PHASE 4**

**Location**: `lib/email/providers/smtp.ts`

**Enhancements**:
- Email address validation using `isValidEmailAddress()` from `lib/email/james/validation/email-address.ts`
- Recipient routing validation using `resolveRecipientRoute()` and `validateRecipient()` from `lib/email/james/smtp/routing.ts`
- **NEW**: Message validation using `validateSMTPMessage()` from `lib/email/james/smtp/validation.ts`
- **NEW**: Header validation (size, line count, format)
- **NEW**: Message size validation
- **NEW**: Recipient count validation
- Enhanced error messages for invalid addresses and routing failures

**Usage**:
```typescript
import { smtpSend } from '@/lib/email/providers/smtp'
import { validateSMTPMessage } from '@/lib/email/james/smtp/validation'

// Automatic validation before sending
const result = await smtpSend(mailbox, emailPayload)

// Or validate manually
const validation = validateSMTPMessage(message, {
  maxMessageSize: 50 * 1024 * 1024, // 50 MB
  maxHeaderLines: 500,
})
```

### 2. IMAP Integration (Task 22) ✅ **ENHANCED IN PHASE 4**

**Location**: `lib/email/unibox/imap-connector.ts`

**Enhancements**:
- Threading header parsing using `extractThreadHeaders()`, `parseReferences()`, and `parseInReplyTo()` from `lib/email/james/threading/thread-reconstruction.ts`
- Improved message-id, in-reply-to, and references parsing
- Better handling of malformed headers
- Consistent threading across all connectors

**Usage**:
The IMAP connector now automatically uses james-project threading utilities when parsing messages.

**Phase 4 Updates**:
- Replaced manual header parsing with james-project utilities
- Consistent threading implementation across Gmail, IMAP, and Outlook connectors

### 3. MIME Integration (Task 23) 🔄

**Available Utilities**:
- `lib/email/james/mime/parser.ts` - MIME message parsing
- `lib/email/james/mime/encoding.ts` - Encoding/decoding utilities
- `lib/email/james/mime/attachments.ts` - Attachment handling

**Integration Points**:
- Email parsing in Gmail/Outlook/IMAP connectors
- Email sending in nodemailer service
- Attachment extraction and validation

### 4. Threading Integration (Task 24) 🔄

**Location**: `lib/email/james/threading/thread-reconstruction.ts`

**Features**:
- Thread reconstruction from message headers
- Subject normalization for thread matching
- Thread merging capabilities
- Thread validation

**Usage**:
```typescript
import { buildThreads, extractThreadHeaders } from '@/lib/email/james/threading/thread-reconstruction'

// Extract headers from message
const headers = extractThreadHeaders(messageHeaders)

// Build threads from messages
const messages = [
  { id: 'msg1', headers: { messageId: '<1@example.com>', ... } },
  { id: 'msg2', headers: { messageId: '<2@example.com>', inReplyTo: '<1@example.com>', ... } },
]
const threads = buildThreads(messages)
```

## Available Utilities

### Validation
- `isValidEmailAddress()` - Validate email addresses
- `parseEmailAddress()` - Parse email with display name
- `normalizeEmailAddress()` - Normalize email addresses

### SMTP
- `parseSmtpMessage()` - Parse raw SMTP messages
- `parseHeaders()` - Parse email headers
- `resolveRecipientRoute()` - Route recipient addresses
- `validateRecipient()` - Validate recipient addresses

### MIME
- `parseMimeMessage()` - Parse MIME messages
- `parseContentType()` - Parse Content-Type headers
- `extractAttachments()` - Extract attachments from messages
- `encodeBase64()` / `decodeBase64()` - Base64 encoding
- `encodeQuotedPrintable()` / `decodeQuotedPrintable()` - Quoted-printable encoding

### IMAP
- `createFolder()` / `deleteFolder()` / `renameFolder()` - Folder management
- `parseFlags()` / `formatFlags()` - Flag management
- `buildSearchQuery()` / `parseSearchQuery()` - Search capabilities
- `IdleSession` - IDLE support

### Threading
- `parseMessageId()` - Parse Message-ID headers
- `parseInReplyTo()` - Parse In-Reply-To headers
- `parseReferences()` - Parse References headers
- `extractThreadHeaders()` - Extract all threading headers
- `buildThreads()` - Build thread structures
- `normalizeSubject()` - Normalize subjects for matching

### Mailbox
- `calculateQuotaUsage()` - Calculate quota usage
- `checkQuota()` - Check quota limits
- `setQuotaLimits()` - Set quota limits

## Best Practices

1. **Always validate email addresses** before sending
2. **Use threading utilities** for proper conversation grouping
3. **Handle errors gracefully** with early returns
4. **Follow .cursorrules** for code style and structure
5. **Use TypeScript types** for all function parameters and returns

## Error Handling

All utilities follow .cursorrules error handling patterns:
- Early returns for validation failures
- Descriptive error messages
- Proper error types (not just strings)

## Performance Considerations

- Connection pooling is handled by nodemailer service
- Threading utilities are optimized for large message sets
- MIME parsing handles large attachments efficiently

## Testing

Unit tests should be added for:
- Email address validation edge cases
- Thread reconstruction with various header combinations
- MIME parsing with complex multipart messages
- SMTP routing validation

## Phase 4 Enhancements

### SMTP Validation ✅
- **Location**: `lib/email/james/smtp/validation.ts`
- **Usage**: Automatic validation before sending emails
- **Features**: Message size limits, header validation, recipient count validation

### Circuit Breaker ✅
- **Location**: `lib/email/james/error-recovery/circuit-breaker.ts`
- **Integration**: Automatically integrated into `NodemailerService`
- **Features**: Prevents cascading failures, automatic recovery

### Performance Caching ✅
- **Location**: `lib/email/james/performance/cache.ts`
- **Integration**: Transporter caching in `NodemailerService`
- **Features**: TTL-based expiration, LRU eviction

### Message Queue ✅
- **Location**: `lib/email/james/queue/message-queue.ts`
- **Features**: Priority queue, scheduled delivery, retry logic

## References

- **james-project**: Apache James Project source code
- **.cursorrules**: Development guidelines
- **Phase 3 Implementation Plan**: `docs/PHASE3_IMPLEMENTATION_PLAN.md`
- **Phase 3 Summary**: `docs/PHASE3_IMPLEMENTATION_SUMMARY.md`
- **Phase 4 Summary**: `docs/PHASE4_IMPLEMENTATION_SUMMARY.md`

