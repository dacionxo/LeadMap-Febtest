# Diagnostic Guide: Webhook Works But Emails Not Saving to Supabase

## Problem
- ✅ Gmail Inbox receives emails
- ✅ Gmail API watch is active
- ✅ Webhook successfully receives notifications (returns 200 OK)
- ❌ **No emails appear in Supabase database**

## Quick Diagnostic Steps

### Step 1: Check Webhook Response

When the webhook is called, check what it returns. Look in your application logs for:

```json
{
  "success": true/false,
  "processed": 0,  // <-- This number tells us if messages were found
  "threadsCreated": 0,
  "threadsUpdated": 0,
  "errors": 0,
  "errorDetails": []
}
```

**What to look for:**
- If `processed: 0` → No messages were found/processed (see Step 2)
- If `processed > 0` but no emails in DB → Database insert is failing (see Step 3)
- If `errors > 0` → Check `errorDetails` array for specific errors

### Step 2: Check Application Logs for Message Discovery

Look for these log entries in your application logs:

#### History API Path (Preferred)
```
[syncGmailMessages] Using History API for incremental sync with historyId: ...
[syncGmailMessages] History API returned X new messages, latest historyId: ...
```

**If you see `History API returned 0 new messages`:**
- History API found no new messages since the last `historyId`
- This could mean:
  - The `historyId` is too recent (no new messages yet)
  - The `historyId` is too old (Gmail only stores limited history)
  - The watch was just set up and no new emails arrived yet

#### Date-Based Query Path (Fallback)
```
[syncGmailMessages] Using date-based query - historyId: ...
[syncGmailMessages] Date-based query returned X messages for mailbox ...
```

**If you see `Date-based query returned 0 messages`:**
- The date-based query found no messages
- Check the `since` date being used
- Verify emails actually exist in the Gmail inbox

### Step 3: Check Database Insert Logs

Look for these log entries:

#### Successful Insert
```
[syncGmailMessages] Successfully inserted message {messageId} for mailbox {mailboxId}
[syncGmailMessages] Successfully inserted into emails table for message {messageId}
```

#### Failed Insert
```
[syncGmailMessages] Failed to insert message {messageId}: ...
[syncGmailMessages] Failed to insert into emails table for message {messageId}: ...
```

**Common error codes:**
- `42501` → RLS policy violation (run `supabase/unibox_rls_service_role_fix.sql`)
- `23505` → Duplicate message (already exists)
- `23503` → Foreign key violation (invalid thread_id or mailbox_id)

### Step 4: Check Debug Logs

With the enhanced logging, look for `[DEBUG]` entries:

```
[DEBUG] {"location":"app/api/webhooks/gmail/route.ts:347","message":"syncGmailMessages returned","data":{"success":true,"messagesProcessed":0,...}}
[DEBUG] {"location":"lib/email/unibox/gmail-connector.ts:510","message":"History API success","data":{"messageCount":0,...}}
[DEBUG] {"location":"lib/email/unibox/gmail-connector.ts:583","message":"Starting message processing","data":{"totalMessages":0,...}}
```

**Key fields to check:**
- `messagesProcessed`: Should be > 0 if messages were found and inserted
- `messageCount`: Number of messages found by History API or date-based query
- `totalMessages`: Total messages to process
- `success`: Whether sync completed successfully

## Common Issues and Fixes

### Issue 1: `processed: 0` - No Messages Found

**Symptom:** Webhook returns `processed: 0`, logs show `History API returned 0 new messages` or `Date-based query returned 0 messages`

**Possible Causes:**

#### A. History ID Too Recent
- The `historyId` from the notification is very recent
- No new messages have arrived since that `historyId`
- **Fix:** This is normal - wait for a new email to arrive

#### B. History ID Too Old
- The `historyId` is older than Gmail's history retention (usually 1-2 weeks)
- History API returns 404 or "too old" error
- **Fix:** System should fallback to date-based query automatically

#### C. Date-Based Query Not Finding Messages
- The `since` date is too recent
- Messages exist but are older than the `since` date
- **Fix:** Check what `since` date is being used:
  ```sql
  SELECT email, last_synced_at, watch_history_id
  FROM mailboxes
  WHERE provider = 'gmail';
  ```
  The `since` date is either `last_synced_at` or 24 hours ago (for webhooks)

#### D. Messages Not in INBOX Label
- The query filters for `in:inbox`
- Messages might be in other labels/folders
- **Fix:** Check if messages are actually in the INBOX label in Gmail

**Diagnostic Query:**
```sql
-- Check when mailbox was last synced
SELECT 
  email,
  watch_history_id,
  last_synced_at,
  watch_expiration,
  CASE 
    WHEN last_synced_at IS NULL THEN 'Never synced'
    WHEN last_synced_at < NOW() - INTERVAL '7 days' THEN 'Stale (>7 days)'
    WHEN last_synced_at < NOW() - INTERVAL '1 day' THEN 'Stale (>1 day)'
    ELSE 'Recent'
  END as sync_status
FROM mailboxes
WHERE provider = 'gmail';
```

### Issue 2: `processed > 0` But No Emails in Database

**Symptom:** Webhook returns `processed: 5` but database shows 0 emails

**Possible Causes:**

#### A. RLS Policy Blocking Inserts
- Service role client can't insert due to RLS policies
- **Fix:** Run RLS policy fix:
  ```sql
  -- Run: supabase/unibox_rls_service_role_fix.sql
  ```
  Or manually:
  ```sql
  -- Check current policies
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
  FROM pg_policies
  WHERE tablename IN ('email_messages', 'email_threads', 'emails');
  
  -- Policies should include: OR auth.role() = 'service_role'
  ```

#### B. Database Insert Errors
- Inserts are failing silently
- **Fix:** Check logs for insert errors:
  ```
  [syncGmailMessages] Failed to insert message ...
  ```
  Look for error codes and messages

#### C. Wrong Direction Detection
- Messages are being marked as `outbound` instead of `inbound`
- **Fix:** Check logs for direction:
  ```
  [DEBUG] {"message":"Before insert","data":{"direction":"inbound",...}}
  ```
  Should be `"direction":"inbound"` for received emails

**Diagnostic Query:**
```sql
-- Check if any messages exist (regardless of direction)
SELECT 
  COUNT(*) as total_messages,
  COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_count,
  COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_count,
  MAX(created_at) as most_recent
FROM email_messages;

-- Check emails table
SELECT 
  COUNT(*) as total_emails,
  COUNT(CASE WHEN direction = 'received' THEN 1 END) as received_count,
  COUNT(CASE WHEN direction = 'sent' THEN 1 END) as sent_count,
  MAX(created_at) as most_recent
FROM emails;
```

### Issue 3: Authentication Errors

**Symptom:** Logs show authentication errors

**Fix:**
1. Check token decryption:
   ```
   [Gmail Webhook] CRITICAL: Failed to decrypt tokens...
   ```
   - Verify `EMAIL_ENCRYPTION_KEY` is set correctly
   - Tokens may need re-authentication if key changed

2. Check token refresh:
   ```
   [syncGmailMessages] Authentication error for mailbox ...
   ```
   - Token may be expired
   - Re-authenticate the mailbox via OAuth

## Step-by-Step Diagnostic Process

### 1. Send a Test Email
Send an email to your Gmail inbox from an external account.

### 2. Check Webhook Response
Look at your application logs or webhook response for:
```json
{
  "success": true,
  "processed": X,  // <-- Key number
  "errors": 0
}
```

### 3. Check Application Logs
Look for these log entries in order:

1. **Webhook received:**
   ```
   [Gmail Webhook] Processing notification for {email}...
   ```

2. **Sync started:**
   ```
   [DEBUG] {"message":"Calling syncGmailMessages",...}
   [DEBUG] {"message":"syncGmailMessages entry",...}
   ```

3. **Message discovery:**
   ```
   [syncGmailMessages] History API returned X new messages...
   ```
   OR
   ```
   [syncGmailMessages] Date-based query returned X messages...
   ```

4. **Message processing:**
   ```
   [DEBUG] {"message":"Starting message processing","data":{"totalMessages":X,...}}
   ```

5. **Database inserts:**
   ```
   [syncGmailMessages] Successfully inserted message {id}...
   ```

### 4. Check Database
```sql
-- Check email_messages table
SELECT 
  id,
  direction,
  subject,
  created_at,
  mailbox_id
FROM email_messages
WHERE direction = 'inbound'
ORDER BY created_at DESC
LIMIT 10;

-- Check emails table
SELECT 
  id,
  direction,
  subject,
  received_at,
  mailbox_id
FROM emails
WHERE direction = 'received'
ORDER BY received_at DESC
LIMIT 10;
```

## Quick Fix Checklist

- [ ] Check webhook response shows `processed > 0`
- [ ] Check logs show messages were found (`messageCount > 0`)
- [ ] Check logs show successful inserts
- [ ] Verify RLS policies allow service_role (run SQL fix)
- [ ] Check `EMAIL_ENCRYPTION_KEY` is set correctly
- [ ] Verify tokens are valid (not expired)
- [ ] Check database for any messages (even with wrong direction)
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

## Next Steps

Based on what you find:

1. **If `processed: 0`**: Messages aren't being found - check History API and date-based query logs
2. **If `processed > 0` but no DB entries**: Database inserts are failing - check RLS policies and insert error logs
3. **If errors in response**: Check `errorDetails` array for specific error messages

## Still Stuck?

Share these details:
1. Webhook response JSON (the full response)
2. Application logs showing:
   - `[Gmail Webhook] Processing notification...`
   - `[syncGmailMessages] History API returned...` OR `Date-based query returned...`
   - `[syncGmailMessages] Successfully inserted...` OR `Failed to insert...`
3. Database query results (from Step 4 above)
4. Any error messages from logs

