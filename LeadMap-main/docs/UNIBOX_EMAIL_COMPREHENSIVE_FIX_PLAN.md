# Comprehensive Unibox Email Fix Plan

## Executive Summary

This document outlines a comprehensive plan to fix email reception in the Unibox by comparing our implementation with the [Realtime-Gmail-Listener](https://github.com/sangnandar/Realtime-Gmail-Listener) reference and implementing critical improvements.

## Key Differences Identified

### 1. ❌ CRITICAL: Not Using Gmail History API for Incremental Sync

**Reference Implementation:**
- Uses `Gmail.Users.History.list()` with `startHistoryId` to fetch only NEW messages
- Stores `lastHistoryId` and uses it for incremental sync
- Processes only messages added since last sync

**Our Implementation:**
- Uses `listGmailMessages()` with date-based queries (`newer_than:`)
- May miss messages or process duplicates
- Less efficient - queries all messages matching date filter

**Impact:** This is likely the PRIMARY reason emails aren't appearing in Unibox.

### 2. ⚠️ Watch Renewal Timing

**Reference:** Renews 1 hour before expiration
**Our Implementation:** Renews 24 hours before expiration

**Impact:** Less critical, but reference pattern is more reliable.

### 3. ✅ Webhook Returns 200 OK

**Both:** Return 200 OK to prevent Pub/Sub retries - ✅ Already implemented

### 4. ✅ Token Decryption

**Both:** Properly decrypt tokens before use - ✅ Already fixed

## Comprehensive To-Do List

### Phase 1: Critical Fixes (HIGH PRIORITY)

#### ✅ Task 1.1: Implement Gmail History API for Webhook Processing
**Status:** IN PROGRESS
**Priority:** CRITICAL
**Files:**
- `app/api/webhooks/gmail/route.ts`
- `lib/email/unibox/gmail-connector.ts`

**Changes Required:**
1. When webhook receives `historyId`, use it to fetch History API
2. Process only `messageAdded` events from History API
3. Update `syncGmailMessages` to accept `historyId` parameter
4. Use History API instead of `listGmailMessages` when `historyId` is available

**Reference Pattern:**
```javascript
// Reference: event-handlers.gs lines 82-126
function pullEmailsSince(historyId) {
  let pageToken = null;
  let lastHistoryId = historyId;
  const emails = [];

  do {
    response = Gmail.Users.History.list('me', {
      startHistoryId: historyId,
      pageToken: pageToken,
      historyTypes: ['messageAdded']
    });

    const history = response.history || [];
    for (const record of history) {
      const added = record.messages || [];
      for (const msg of added) {
        const email = Gmail.Users.Messages.get('me', msg.id);
        emails.push(email);
      }
    }

    if (response.historyId) lastHistoryId = response.historyId;
    pageToken = response.nextPageToken;
  } while (pageToken);

  SCRIPT_PROPS.setProperty('lastHistoryId', lastHistoryId);
  return emails;
}
```

#### ✅ Task 1.2: Update syncGmailMessages to Support History API
**Status:** PENDING
**Priority:** CRITICAL
**Files:**
- `lib/email/unibox/gmail-connector.ts`

**Changes Required:**
1. Add `historyId` parameter to `syncGmailMessages` options
2. If `historyId` provided, use `getGmailHistory()` instead of `listGmailMessages()`
3. Process only `messageAdded` events from History response
4. Update `watch_history_id` after successful sync

#### ✅ Task 1.3: Fix Watch Renewal Timing
**Status:** PENDING
**Priority:** MEDIUM
**Files:**
- `app/api/cron/gmail-watch-renewal/route.ts`

**Changes Required:**
1. Change renewal window from 24 hours to 1 hour before expiration
2. Follow reference pattern: `reinitAt = expiration - 60 * 60 * 1000`

### Phase 2: Enhancements (MEDIUM PRIORITY)

#### ✅ Task 2.1: Add Comprehensive Logging
**Status:** PENDING
**Priority:** MEDIUM
**Files:**
- All sync and webhook files

**Changes Required:**
1. Log History API calls with historyId
2. Log message processing counts
3. Log watch renewal attempts
4. Add structured logging for debugging

#### ✅ Task 2.2: Verify Watch Setup During OAuth
**Status:** PENDING
**Priority:** MEDIUM
**Files:**
- `app/api/mailboxes/oauth/gmail/callback/route.ts`

**Changes Required:**
1. Verify Gmail Watch is set up after OAuth
2. Store initial `historyId` from watch setup
3. Log watch setup success/failure

#### ✅ Task 2.3: Add Error Recovery for History API
**Status:** PENDING
**Priority:** MEDIUM
**Files:**
- `lib/email/unibox/gmail-connector.ts`

**Changes Required:**
1. Handle History API errors (e.g., historyId too old)
2. Fallback to date-based query if History API fails
3. Log errors for monitoring

### Phase 3: Testing & Validation (HIGH PRIORITY)

#### ✅ Task 3.1: End-to-End Testing
**Status:** PENDING
**Priority:** HIGH
**Test Cases:**
1. Webhook receives notification → History API called → Messages synced → Unibox displays
2. Watch renewal works correctly
3. Token refresh works during webhook processing
4. Error handling works correctly

#### ✅ Task 3.2: Database Verification
**Status:** PENDING
**Priority:** HIGH
**Checks:**
1. Verify `email_threads` and `email_messages` tables exist
2. Verify `watch_history_id` is stored correctly
3. Verify messages are saved with correct `direction` values
4. Verify threads are created correctly

## Implementation Plan

### Step 1: Update syncGmailMessages to Use History API

**File:** `lib/email/unibox/gmail-connector.ts`

**Changes:**
1. Add `historyId` to options parameter
2. If `historyId` provided, use `getGmailHistory()` 
3. Process `history.history` array for `messageAdded` events
4. Extract message IDs from `record.messagesAdded`
5. Fetch full messages and process as before

### Step 2: Update Webhook to Use History API

**File:** `app/api/webhooks/gmail/route.ts`

**Changes:**
1. When `historyId` received, pass it to `syncGmailMessages`
2. Use mailbox's `watch_history_id` if webhook historyId not provided
3. Update `watch_history_id` after successful sync

### Step 3: Fix Watch Renewal Timing

**File:** `app/api/cron/gmail-watch-renewal/route.ts`

**Changes:**
1. Change query from 24 hours to 1 hour before expiration
2. Update comment to reflect new timing

## Success Criteria

1. ✅ Webhook processes emails using History API
2. ✅ Only new messages are fetched (incremental sync)
3. ✅ Emails appear in Unibox within seconds of receipt
4. ✅ Watch subscriptions renew automatically 1 hour before expiration
5. ✅ No duplicate messages in database
6. ✅ Comprehensive logging for debugging

## Testing Checklist

- [ ] Test webhook with real Gmail notification
- [ ] Verify History API returns correct messages
- [ ] Verify messages saved to database
- [ ] Verify Unibox displays emails
- [ ] Test watch renewal cron job
- [ ] Test token refresh during webhook
- [ ] Test error handling (expired historyId, etc.)
- [ ] Verify no duplicate messages
- [ ] Check logs for errors

## References

- [Realtime-Gmail-Listener Reference](../external/realtime-gmail-listener/)
- [Gmail History API Documentation](https://developers.google.com/gmail/api/reference/rest/v1/users.history/list)
- [Gmail Watch API Documentation](https://developers.google.com/gmail/api/guides/push)
- [Our Current Implementation](./UNIBOX_EMAIL_FIX_SUMMARY.md)

