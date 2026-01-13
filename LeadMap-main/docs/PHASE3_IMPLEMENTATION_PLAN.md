# Phase 3: james-project Pattern Integration - Implementation Plan

## Overview

Phase 3 focuses on extracting and adapting patterns from james-project into TypeScript utilities that enhance the Unibox email system. These patterns will improve message parsing, validation, threading, and protocol handling.

## Implementation Strategy

### 1. Directory Structure

```
lib/email/james/
├── smtp/
│   ├── parser.ts           # SMTP message parsing
│   ├── validation.ts       # SMTP validation patterns
│   └── routing.ts          # SMTP routing patterns
├── imap/
│   ├── folders.ts          # Folder management
│   ├── flags.ts            # Flag management
│   ├── search.ts           # Search capabilities
│   └── idle.ts             # IDLE support patterns
├── mailbox/
│   ├── manager.ts          # Mailbox management
│   └── quota.ts            # Quota management
├── mime/
│   ├── parser.ts           # MIME parsing
│   ├── encoding.ts         # Encoding utilities
│   └── attachments.ts      # Attachment handling
├── threading/
│   └── thread-reconstruction.ts  # Thread reconstruction
└── validation/
    └── email-validation.ts  # Email validation
```

### 2. Implementation Order

1. **Foundation Layer** (Tasks 1-4, 13-16)
   - SMTP message parsing
   - MIME parsing and encoding
   - Email validation

2. **Protocol Layer** (Tasks 5-9)
   - IMAP folder management
   - IMAP flags
   - IMAP search
   - IMAP IDLE patterns

3. **Management Layer** (Tasks 10-12)
   - Mailbox management
   - Quota management
   - User management patterns

4. **Integration Layer** (Tasks 17-24)
   - Threading utilities
   - Integration with existing connectors
   - Integration with nodemailer service

5. **Quality Assurance** (Tasks 25-28)
   - Context7 validation
   - .cursorrules compliance
   - Documentation
   - Testing

## Key Patterns to Extract

### SMTP Patterns
- Message parsing and validation
- Header parsing
- Address validation
- Content validation
- Routing logic

### IMAP Patterns
- Folder hierarchy management
- Message flag management
- Search query parsing
- IDLE push notifications
- Session management

### MIME Patterns
- MIME structure parsing
- Multipart handling
- Encoding/decoding
- Attachment extraction
- Inline content handling

### Mailbox Patterns
- Multi-tenant mailbox handling
- Quota calculation and enforcement
- User management
- Mailbox lifecycle

### Threading Patterns
- Message-ID matching
- In-Reply-To parsing
- References header parsing
- Conversation grouping
- Thread reconstruction

## Success Criteria

- [ ] SMTP utilities created and integrated
- [ ] IMAP utilities created and integrated
- [ ] MIME utilities created and integrated
- [ ] Mailbox management utilities created
- [ ] Threading utilities created and integrated
- [ ] All utilities follow james-project patterns
- [ ] All code follows .cursorrules
- [ ] Comprehensive tests written
- [ ] Documentation complete

## References

- **james-project**: `james-project/` - Source patterns
- **Phase 1 Analysis**: `docs/PHASE1_JAMES_PROJECT_ANALYSIS.md`
- **nodemailer**: Context7 documentation
- **.cursorrules**: `LeadMap-main/.cursorrules`


