# phpList3 Integration Plan for LeadMap OAuth Email Sending

## Executive Summary

This document outlines the plan to enhance LeadMap's OAuth email sending system by adapting best practices and patterns from phpList3, a mature open-source email marketing platform.

## Current State Analysis

### LeadMap's Existing OAuth Email System

**Strengths:**
- ✅ OAuth token management (Gmail/Outlook)
- ✅ Token encryption and secure storage
- ✅ Automatic token refresh
- ✅ Queue-based email processing
- ✅ Rate limiting per mailbox
- ✅ Retry logic with exponential backoff
- ✅ Support for multiple providers (Gmail, Outlook, SMTP, transactional)

**Areas for Enhancement:**
- ⚠️ Domain-based throttling (currently mailbox-level only)
- ⚠️ Load balancing across multiple mailboxes for same domain
- ⚠️ Priority-based queue processing
- ⚠️ Enhanced batch processing strategies
- ⚠️ Token refresh scheduling (currently on-demand)

## phpList3 Patterns to Integrate

### 1. Domain-Based Throttling System

**phpList3 Pattern:**
- Implements throttling at the domain level (e.g., all @gmail.com addresses)
- Allows load balancing across multiple mailboxes for the same domain
- Configurable throttling policies per domain

**LeadMap Enhancement:**
```typescript
// New: Domain-level rate limiting
interface DomainThrottleConfig {
  domain: string
  hourly_limit: number
  daily_limit: number
  mailbox_ids: string[] // Multiple mailboxes for load balancing
}

// Enhanced: Load balancing across mailboxes
async function selectMailboxForDomain(
  domain: string,
  supabase: any
): Promise<Mailbox | null> {
  // Select mailbox with lowest current usage for this domain
  // Implement round-robin or least-used strategy
}
```

### 2. Priority-Based Queue Processing

**phpList3 Pattern:**
- Email queue items have priority levels (1-10, higher = more urgent)
- Processing respects priority order
- Campaign emails can have different priorities than transactional

**LeadMap Enhancement:**
```typescript
// Enhanced queue processing
async function fetchQueuedEmails(
  supabase: any,
  batchSize: number,
  priority?: number
): Promise<EmailQueueItem[]> {
  // Fetch emails ordered by priority (desc) then created_at (asc)
  // Process high-priority emails first
}
```

### 3. Enhanced Batch Processing

**phpList3 Pattern:**
- Processes emails in configurable batch sizes
- Implements delays between batches to avoid overwhelming providers
- Tracks batch statistics

**LeadMap Enhancement:**
```typescript
// Enhanced batch processing with delays
async function processBatchWithThrottle(
  emails: EmailQueueItem[],
  batchSize: number,
  delayMs: number
): Promise<BatchResult> {
  // Process in smaller sub-batches
  // Add delays between sub-batches
  // Track progress and statistics
}
```

### 4. Token Refresh Scheduling

**phpList3 Pattern:**
- Proactive token refresh before expiration
- Scheduled refresh tasks
- Token expiration prediction

**LeadMap Enhancement:**
```typescript
// Enhanced token refresh scheduling
async function scheduleTokenRefresh(mailbox: Mailbox): Promise<void> {
  // Calculate refresh time (e.g., 5 minutes before expiration)
  // Schedule refresh task
  // Update mailbox with refresh schedule
}
```

## Implementation Tasks

### Phase 1: Domain-Based Throttling

1. ✅ Create domain throttle configuration schema
2. ✅ Implement domain-level rate limit tracking
3. ✅ Add mailbox selection for domain load balancing
4. ✅ Update rate limit checks to consider domain limits
5. ✅ Add domain throttle configuration UI (optional)

### Phase 2: Priority Queue Processing

1. ✅ Enhance email queue schema with priority field (if not exists)
2. ✅ Update queue fetching to order by priority
3. ✅ Add priority assignment logic for different email types
4. ✅ Update queue processing to respect priority

### Phase 3: Enhanced Batch Processing

1. ✅ Implement configurable batch delays
2. ✅ Add sub-batch processing with throttling
3. ✅ Enhance batch statistics tracking
4. ✅ Add batch processing configuration options

### Phase 4: Token Refresh Scheduling

1. ✅ Create token refresh scheduler utility
2. ✅ Implement proactive token refresh
3. ✅ Add token expiration prediction
4. ✅ Update cron jobs to use scheduled refresh

## Migration Strategy

1. **Non-Breaking Changes**: All enhancements are additive, existing functionality remains unchanged
2. **Feature Flags**: New features can be enabled/disabled via configuration
3. **Gradual Rollout**: Implement features incrementally with testing at each phase
4. **Backward Compatibility**: Maintain compatibility with existing mailbox configurations

## Testing Strategy

1. **Unit Tests**: Test new utilities and functions
2. **Integration Tests**: Test queue processing with new features
3. **Load Testing**: Test domain throttling and load balancing
4. **Token Refresh Testing**: Verify proactive token refresh works correctly

## Documentation

1. Update `EMAIL_SYSTEM_IMPLEMENTATION.md` with new features
2. Create `DOMAIN_THROTTLING_GUIDE.md` for domain-based throttling
3. Update API documentation for new queue processing options
4. Add examples for priority-based queue usage

## Success Metrics

- ✅ Reduced rate limit errors through domain throttling
- ✅ Improved email delivery through load balancing
- ✅ Better queue processing performance with priorities
- ✅ Fewer token expiration errors with proactive refresh
- ✅ Improved email delivery success rate

