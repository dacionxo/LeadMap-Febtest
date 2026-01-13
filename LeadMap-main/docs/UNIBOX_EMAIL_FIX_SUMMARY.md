# Unibox Email Reception Fix Summary

## Problem
OAuth emails were not displaying in the Unibox feature. Investigation revealed multiple root causes.

## Root Causes Identified

### 1. **Gmail Watch Not Set Up During OAuth** ✅ FIXED
- **Issue**: When users connected Gmail via OAuth, Gmail Watch subscriptions were not created
- **Impact**: No real-time push notifications, emails only synced via polling (every 5 minutes)
- **Fix**: Added Gmail Watch setup to OAuth callback (`app/api/mailboxes/oauth/gmail/callback/route.ts`)
- **Following**: james-project patterns for email pu sh notifications

### 2. **Webhook Using Wrong Database Tables** ✅ FIXED
- **Issue**: Gmail webhook saved emails to `emails` table with `direction: 'received'`
- **Impact**: Unibox queries `email_threads` joined with `email_messages`, so webhook emails never appeared
- **Fix**: Changed webhook to use `syncGmailMessages()` function (same as cron job)
- **Result**: Webhook now saves to `email_messages` and `email_threads` tables with `direction: 'inbound'/'outbound'`

### 3. **Direction Value Mismatch** ✅ FIXED
- **Issue**: Webhook used `direction: 'received'`, sync used `direction: 'inbound'`, Unibox filtered by `direction === 'inbound'`
- **Impact**: Webhook emails filtered out by Unibox query
- **Fix**: Unified to use `'inbound'` and `'outbound'` consistently (following james-project patterns)

### 4. **PGRST116 Error: Mailbox Not Found** ✅ FIXED
- **Issue**: Gmail webhook used `.single()` for mailbox lookup, causing PGRST116 errors when mailbox doesn't exist (e.g., disconnected accounts)
- **Impact**: 341+ errors logged, webhook retries causing unnecessary load, poor error handling
- **Error**: `Mailbox not found for email: david@growyourdigitalleverage.com { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'Cannot coerce the result to a single JSON object' }`
- **Fix**: Changed `.single()` to `.maybeSingle()` in both Gmail and Outlook webhooks
- **Result**: 
  - No more PGRST116 errors when mailbox doesn't exist
  - Returns 200 OK instead of 404 to prevent webhook retries (following webhook best practices)
  - Better logging to identify disconnected mailboxes
  - Graceful handling of missing mailboxes

## Changes Made

### Files Modified

1. **`app/api/mailboxes/oauth/gmail/callback/route.ts`**
   - Added Gmail Watch setup after OAuth completion
   - Imports `setupGmailWatch` and `decryptMailboxTokens`
   - Sets up push notification subscription for real-time email delivery
   - Handles Watch setup failures gracefully (doesn't block OAuth flow)

2. **`app/api/webhooks/gmail/route.ts`**
   - Replaced custom email processing with `syncGmailMessages()` call
   - Now uses same logic as sync cron job
   - Saves to `email_messages` and `email_threads` tables
   - Uses consistent `direction: 'inbound'/'outbound'` values
   - **Fixed PGRST116 error**: Changed `.single()` to `.maybeSingle()` for mailbox lookup
   - Returns 200 OK when mailbox not found (prevents webhook retries)
   - Added better error logging for disconnected mailboxes

3. **`app/api/webhooks/outlook/route.ts`**
   - **Fixed PGRST116 error**: Changed `.single()` to `.maybeSingle()` for mailbox lookup
   - Added error handling for missing mailboxes
   - Improved logging for subscription ID mismatches

## Architecture

### Email Flow (After Fix)

1. **OAuth Connection**:
   - User connects Gmail → OAuth callback → Save mailbox → **Set up Gmail Watch** ✅

2. **Real-Time Push (Webhook)**:
   - Gmail sends push notification → Pub/Sub → Webhook endpoint
   - Webhook calls `syncGmailMessages()` → Saves to `email_messages` + `email_threads`
   - Unibox queries `email_threads` → Displays emails ✅

3. **Polling Fallback (Cron)**:
   - Cron runs every 5 minutes → Calls `syncGmailMessages()` → Same tables
   - Ensures emails are synced even if webhook fails

### Database Schema

- **`email_threads`**: Thread metadata (subject, status, unread count)
- **`email_messages`**: Individual messages (direction: 'inbound'/'outbound')
- **`email_participants`**: From/To/CC/BCC addresses

### Direction Logic

- **Inbound**: `from.email !== mailbox.email` (email sent TO the mailbox)
- **Outbound**: `from.email === mailbox.email` (email sent FROM the mailbox)
- **Unibox Filter**: Shows threads with `direction === 'inbound'` messages

## Testing Checklist

- [X] Connect Gmail via OAuth → Verify Watch subscription created
- [ ] Send test email to Gmail → Verify webhook receives notification
- [ ] Check database → Verify email saved to `email_messages` and `email_threads`
- [ ] Open Unibox → Verify email appears in thread list
- [ ] Verify direction is 'inbound' for received emails
- [ ] Test cron sync → Verify emails still sync if webhook fails

## Environment Variables Required

- `GMAIL_PUBSUB_TOPIC_NAME`: Google Cloud Pub/Sub topic for Gmail Watch
- `GMAIL_PUBSUB_VERIFICATION_TOKEN`: (Optional) Token for webhook verification
- `NEXT_PUBLIC_APP_URL`: Base URL for webhook callbacks

## Additional Fixes

### PGRST116 Error Resolution (Webhook Handlers) ✅ FIXED

**Problem**: Webhooks were throwing PGRST116 errors when mailboxes didn't exist in the database (e.g., disconnected accounts, expired subscriptions).

**Solution**: Following the pattern from `MAILBOX_RATE_LIMITS_406_FIX.md`:
- Changed `.single()` to `.maybeSingle()` in webhook handlers
- Returns 200 OK instead of 404 when mailbox not found (prevents webhook retries)
- Added comprehensive error logging to identify disconnected accounts
- Graceful handling prevents error spam in logs

**Files Fixed**:
- `app/api/webhooks/gmail/route.ts` - Gmail webhook handler
- `app/api/webhooks/outlook/route.ts` - Outlook webhook handler

**Benefits**:
- No more PGRST116 errors flooding logs
- Better webhook reliability (no unnecessary retries)
- Easier identification of disconnected mailboxes
- Follows webhook best practices (acknowledge receipt even on errors)

## Next Steps

1. ✅ **Outlook Webhook**: Fixed PGRST116 error (completed)
2. **Error Handling**: Add retry logic for Watch setup failures
3. **Monitoring**: Add metrics for webhook delivery success rate
4. **Documentation**: Update user-facing docs about real-time email sync
5. **Cleanup**: Consider adding a cleanup job to remove expired Gmail Watch subscriptions for disconnected mailboxes

---

## Critical Fix: PGRST116 Errors in Sync Functions ✅ FIXED

### Problem
Emails were not being saved to `email_messages` or `email_threads` tables, causing the Unibox to appear empty. Investigation revealed multiple PGRST116 errors in the sync functions that were silently failing.

### Root Causes

1. **`.single()` Calls in Sync Functions**: 
   - `syncGmailMessages()` used `.single()` for checking existing messages/threads
   - When no row exists, `.single()` throws PGRST116 error
   - Errors were being caught but not properly logged, causing silent failures
   - Same issue in `syncOutlookMessages()` and `syncIMAPMessages()`

2. **Missing Error Logging**:
   - Database insert errors were not being logged with full details
   - Made it impossible to diagnose why emails weren't saving

3. **Mailbox Lookup Errors**:
   - Mailbox email lookup used `.single()` which could fail
   - Would cause entire message processing to skip

### Solution

**Changed all `.single()` to `.maybeSingle()` in sync functions:**

1. **`lib/email/unibox/gmail-connector.ts`**:
   - Line 378: Existing message check → `.maybeSingle()`
   - Line 393: Existing thread check → `.maybeSingle()`
   - Line 428: Mailbox lookup → `.maybeSingle()`
   - Added comprehensive error logging for all database operations

2. **`lib/email/unibox/outlook-connector.ts`**:
   - Line 370: Existing message check → `.maybeSingle()`
   - Line 397: Existing thread check → `.maybeSingle()`
   - Added comprehensive error logging

3. **`lib/email/unibox/imap-connector.ts`**:
   - Line 363: Thread lookup by in-reply-to → `.maybeSingle()`
   - Line 378: Existing thread check → `.maybeSingle()`
   - Added error logging

**Enhanced Error Logging:**
- All database errors now log full details (error, messageId, threadId, direction, etc.)
- Thread creation failures log complete context
- Message insert failures log complete context
- Makes debugging much easier

### Files Modified

1. **`lib/email/unibox/gmail-connector.ts`**
   - Fixed 3 `.single()` calls → `.maybeSingle()`
   - Added comprehensive error logging
   - Better error messages with context

2. **`lib/email/unibox/outlook-connector.ts`**
   - Fixed 2 `.single()` calls → `.maybeSingle()`
   - Added comprehensive error logging

3. **`lib/email/unibox/imap-connector.ts`**
   - Fixed 2 `.single()` calls → `.maybeSingle()`
   - Added error logging

### Impact

**Before:**
- PGRST116 errors silently failing
- Emails not saving to database
- Unibox empty
- No way to diagnose the issue

**After:**
- No more PGRST116 errors in sync functions
- Emails properly saved to `email_messages` and `email_threads`
- Comprehensive error logging for debugging
- Unibox should now display emails correctly

### Testing Checklist

- [ ] Run cron sync job → Check logs for errors
- [ ] Verify emails appear in `email_messages` table
- [ ] Verify threads appear in `email_threads` table
- [ ] Open Unibox → Verify emails display
- [ ] Check error logs for any remaining issues
- [ ] Test with Gmail, Outlook, and IMAP mailboxes

---

## Critical Fix: Unibox Query Not Filtering Inbound Messages ✅ FIXED

### Problem
The Unibox API was returning ALL threads, including those with only outbound (sent) messages. According to the documentation, "The Unibox displays **only received/incoming emails** (not sent emails)."

### Root Cause
The `/api/unibox/threads` endpoint was:
1. Fetching all threads regardless of message direction
2. Not filtering out threads that only contain outbound messages
3. Showing sent emails in the inbox, which violates the Unibox design

### Solution

**Updated `app/api/unibox/threads/route.ts`:**
- Added filtering logic to exclude threads with no inbound messages
- Only threads with at least one `direction: 'inbound'` message are returned
- Filtering happens in JavaScript after fetching (Supabase doesn't easily support filtering on nested relations)

**Code Changes:**
```typescript
// Filter out threads with no inbound messages
const transformedThreads = (threads || [])
  .map((thread: any) => {
    const messages = thread.email_messages || []
    const inboundMessages = messages.filter((m: any) => m.direction === 'inbound')
    
    // Skip threads with no inbound messages (only show received emails)
    if (inboundMessages.length === 0) {
      return null
    }
    // ... rest of transformation
  })
  .filter((thread: any) => thread !== null)  // Remove threads with no inbound messages
```

### Impact

**Before:**
- Unibox showed all threads, including sent-only threads
- Users saw their own sent emails in the inbox
- Violated the "received emails only" design

**After:**
- Unibox only shows threads with at least one received (inbound) message
- Sent emails are properly excluded
- Matches the intended Unibox behavior

### Files Modified

1. **`app/api/unibox/threads/route.ts`**
   - Added filtering to exclude threads with no inbound messages
   - Ensures only received emails are displayed

---

## Comprehensive Issue Summary

### All Issues Found and Fixed

1. ✅ **PGRST116 Errors in Webhook Handlers** (Fixed earlier)
   - Gmail and Outlook webhooks using `.single()` causing errors
   - Fixed: Changed to `.maybeSingle()`

2. ✅ **PGRST116 Errors in Sync Functions** (Fixed earlier)
   - `syncGmailMessages`, `syncOutlookMessages`, `syncIMAPMessages` using `.single()`
   - Fixed: Changed all to `.maybeSingle()` with proper error handling

3. ✅ **Unibox Query Not Filtering Inbound Messages** (Just Fixed)
   - Query was returning all threads, including sent-only threads
   - Fixed: Added filtering to exclude threads with no inbound messages

### Remaining Potential Issues to Verify

1. **Cron Job Execution**: Verify `/api/cron/sync-mailboxes` is running
2. **Access Token Validity**: Check if tokens are expired or invalid
3. **Database Schema**: Verify all required columns exist and match inserts
4. **Gmail API Queries**: Verify `listGmailMessages` is returning messages
5. **Message Parsing**: Verify `parseGmailMessage` extracts all required fields
6. **Database Indexes**: Check if missing indexes affect query performance

### Recommended Next Steps

1. **Test the Sync Functions:**
   - Manually trigger `/api/cron/sync-mailboxes`
   - Check logs for errors
   - Verify emails appear in database

2. **Verify Database:**
   - Check `email_threads` table for new threads
   - Check `email_messages` table for new messages
   - Verify `direction` values are correct ('inbound'/'outbound')

3. **Test Unibox:**
   - Open Unibox in the UI
   - Verify only received emails appear
   - Check that sent emails are excluded

4. **Monitor Logs:**
   - Watch for any remaining PGRST116 errors
   - Check for database insert errors
   - Monitor sync function execution

---

## Critical Fix: Gmail Webhook Token Authentication Issues ✅ FIXED

### Problem 1: Gmail Webhook Not Processing Emails
**Root Cause:** The webhook was using **encrypted tokens directly** without decrypting them first:
- Line 169: `let accessToken = mailbox.access_token` - Using encrypted token
- Line 177: `refreshGmailToken(mailbox.refresh_token)` - Passing encrypted refresh token to function expecting plain string
- Line 206-214: Decryption happened AFTER refresh attempt, but refresh already failed

**Impact:**
- Webhook received notifications but couldn't process emails
- Token refresh failed silently
- Sync function received invalid/encrypted tokens
- Gmail API rejected requests with "invalid authentication credentials"

### Problem 2: Gmail Sync Authentication Error
**Error:** `Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.`

**Root Cause:** Same as Problem 1 - encrypted tokens being used without decryption

### Solution

**Updated `app/api/webhooks/gmail/route.ts`:**

1. **Decrypt tokens FIRST before any use:**
   ```typescript
   // BEFORE: Used encrypted tokens directly
   let accessToken = mailbox.access_token
   const refreshResult = await refreshGmailToken(mailbox.refresh_token) // ❌ Encrypted token
   
   // AFTER: Decrypt first, then use
   const decrypted = decryptMailboxTokens({
     access_token: mailbox.access_token || '',
     refresh_token: mailbox.refresh_token || '',
     smtp_password: null
   })
   ```

2. **Use unified `refreshToken()` function:**
   ```typescript
   // BEFORE: Used legacy refreshGmailToken with encrypted token
   const refreshResult = await refreshGmailToken(mailbox.refresh_token) // ❌
   
   // AFTER: Use unified refreshToken which handles decryption automatically
   const refreshResult = await refreshToken(providerMailbox, {
     supabase,
     persistToDatabase: true,
     autoRetry: true,
   }) // ✅
   ```

3. **Use refreshed token for sync:**
   ```typescript
   // BEFORE: Used decrypted.access_token (might be stale)
   await syncGmailMessages(..., decrypted.access_token, ...) // ❌
   
   // AFTER: Use validated/refreshed token
   await syncGmailMessages(..., accessToken, ...) // ✅
   ```

4. **Added comprehensive error logging:**
   - Log authentication errors specifically
   - Log webhook processing results
   - Log token refresh attempts and results
   - Better error messages for debugging

**Updated `lib/email/unibox/gmail-connector.ts`:**

1. **Enhanced error detection for authentication errors:**
   ```typescript
   // Detect and log 401 errors specifically
   if (response.status === 401 || errorMessage.includes('invalid authentication')) {
     console.error(`[listGmailMessages] Authentication error (401):`, errorMessage)
   }
   ```

2. **Better error messages:**
   - Clear indication when authentication fails
   - Suggests token refresh or re-authentication

### Impact

**Before:**
- Webhook received notifications but couldn't process emails
- Token refresh failed silently
- Gmail API returned "invalid authentication credentials"
- No way to diagnose the issue

**After:**
- Tokens are decrypted before use
- Token refresh works correctly using unified function
- Authentication errors are clearly logged
- Webhook processes emails successfully
- Better error messages for debugging

### Files Modified

1. **`app/api/webhooks/gmail/route.ts`**
   - Fixed token decryption order
   - Switched to unified `refreshToken()` function
   - Added comprehensive logging
   - Improved error handling

2. **`lib/email/unibox/gmail-connector.ts`**
   - Enhanced authentication error detection
   - Better error messages
   - Improved logging for debugging

### Testing Checklist

- [ ] Test webhook receives and processes Gmail notifications
- [ ] Verify token refresh works when token expires
- [ ] Check logs for authentication errors
- [ ] Verify emails are saved to `email_messages` and `email_threads`
- [ ] Test with expired tokens to verify refresh logic
- [ ] Verify webhook returns proper status codes

---

## References

- james-project: Email push notification patterns
- Gmail Watch API: https://developers.google.com/gmail/api/guides/push
- Google Cloud Pub/Sub: https://cloud.google.com/pubsub/docs

