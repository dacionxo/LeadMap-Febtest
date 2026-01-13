# Gmail Webhook Diagnostics & Troubleshooting Guide

Complete guide to detect if Google Cloud Pub/Sub is pushing emails to your webhook and how to fix issues.

## 🔍 How to Detect if Pub/Sub is NOT Pushing Emails

### 1. Check Webhook Health Endpoint

The webhook has a built-in health check endpoint:

```bash
GET https://YOUR_DOMAIN.com/api/webhooks/gmail
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-08T00:00:00.000Z",
  "checks": {
    "supabase": true,
    "pubsub_topic": true,
    "pubsub_verification": false,
    "expired_watches": 0
  }
}
```

**What to Check:**
- ✅ `pubsub_topic: true` - GMAIL_PUBSUB_TOPIC_NAME is set
- ⚠️ `expired_watches: > 0` - Some watches have expired and need renewal
- ⚠️ `expired_watches: "error"` - Could not check database

### 2. Check Application Logs

Check your Vercel/application logs for webhook requests:

**Look for:**
```log
[Gmail Webhook] Processing notification for {email} - historyId from notification: ...
[Gmail Webhook] Successfully processed {count} emails for mailbox {id}
```

**If you DON'T see these logs:**
- ❌ Webhooks are not being received
- ❌ Pub/Sub is not pushing to your endpoint

**Check for errors:**
```log
[Gmail Webhook] CRITICAL: Failed to decrypt tokens...
[Gmail Webhook] Failed to process emails...
```

### 3. Check Database for Received Messages

Query your Supabase database:

```sql
-- Check if any messages have been received recently
SELECT 
  COUNT(*) as total_messages,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
  MAX(created_at) as most_recent
FROM email_messages
WHERE direction = 'inbound';

-- Check mailboxes with expired watches
SELECT 
  id,
  email,
  provider,
  watch_expiration,
  watch_history_id,
  last_synced_at,
  last_error,
  CASE 
    WHEN watch_expiration IS NULL THEN 'No watch set'
    WHEN watch_expiration < NOW() THEN 'EXPIRED'
    WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'Expiring soon'
    ELSE 'Active'
  END as watch_status
FROM mailboxes
WHERE provider = 'gmail'
ORDER BY watch_expiration NULLS LAST;
```

**Red flags:**
- ❌ No messages in last 24 hours
- ❌ `watch_expiration` is in the past (EXPIRED)
- ❌ `watch_status` = 'No watch set'
- ❌ `last_error` contains error messages

### 4. Check Google Cloud Pub/Sub Console

Go to [Google Cloud Console](https://console.cloud.google.com/) → **Pub/Sub** → **Subscriptions**

**Check Your Push Subscription:**

1. **Find your subscription** (e.g., `gmail-webhook-subscription`)
2. **Check "Messages" tab:**
   - **Messages in delivery** - Should be 0 or low
   - **Oldest unacknowledged message** - Should be recent or empty
   - **Pull requests** - Should show activity

3. **Check "Backlog" tab:**
   - **Message backlog** - Should be 0 or very low
   - If backlog is growing → Webhook is not acknowledging messages

4. **Check "Metrics" tab:**
   - **Messages published** - Should show activity when emails arrive
   - **Messages delivered** - Should match published (or close)
   - **Delivery errors** - Should be 0 or low

**Red flags:**
- ❌ Messages published = 0 (Gmail not publishing)
- ❌ Message backlog growing (webhook not processing)
- ❌ High delivery errors (webhook failing)
- ❌ Oldest unacknowledged message is old (webhook not responding)

### 5. Check Gmail Watch Status

Check if Gmail Watch is active in your database:

```sql
-- Check watch status for all Gmail mailboxes
SELECT 
  email,
  watch_expiration,
  watch_history_id,
  last_synced_at,
  CASE 
    WHEN watch_expiration IS NULL THEN 'NOT SET UP'
    WHEN watch_expiration < NOW() THEN 'EXPIRED'
    WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON'
    ELSE 'ACTIVE'
  END as status
FROM mailboxes
WHERE provider = 'gmail';
```

**Red flags:**
- ❌ `watch_expiration IS NULL` - Watch was never set up
- ❌ `watch_expiration < NOW()` - Watch has expired (Gmail stops pushing after 7 days)
- ❌ `watch_history_id IS NULL` - Watch was never configured properly

### 6. Test Webhook Manually

Send a test Pub/Sub message to your webhook:

```bash
curl -X POST https://YOUR_DOMAIN.com/api/webhooks/gmail \
  -H "Content-Type: application/json" \
  -H "x-verification-token: YOUR_TOKEN" \
  -d '{
    "message": {
      "data": "eyJlbWFpbEFkZHJlc3MiOiJ5b3VyQGVtYWlsLmNvbSIsImhpc3RvcnlJZCI6IjEyMzQ1In0=",
      "messageId": "test-123",
      "publishTime": "2025-01-08T00:00:00Z"
    }
  }'
```

**Expected response:**
```json
{
  "success": true,
  "processed": 0,
  "threadsCreated": 0,
  "threadsUpdated": 0,
  "errors": 0
}
```

**If you get an error:**
- Check webhook logs for details
- Verify SUPABASE_SERVICE_ROLE_KEY is set
- Check RLS policies are updated

## 🔧 How to Fix Common Issues

### Issue 1: Watch Expired (Most Common)

**Symptom:** `watch_expiration < NOW()` in database

**Fix:**

1. **Automatic renewal (recommended):**
   - The cron job at `/api/cron/gmail-watch-renewal` runs daily at 3 AM
   - It should renew watches expiring in next 24 hours
   - Check logs to see if it's running

2. **Manual renewal:**
   ```bash
   # Renew watch for specific mailbox
   POST https://YOUR_DOMAIN.com/api/mailboxes/{mailboxId}/watch
   ```

3. **Check renewal cron job:**
   - Verify cron is enabled in `vercel.json`
   - Check cron job logs in Vercel dashboard
   - Manually trigger: `GET /api/cron/gmail-watch-renewal`

### Issue 2: Watch Never Set Up

**Symptom:** `watch_expiration IS NULL` in database

**Fix:**

1. **Set up watch:**
   ```bash
   POST https://YOUR_DOMAIN.com/api/mailboxes/{mailboxId}/watch
   ```

2. **Check OAuth tokens:**
   - Verify mailbox has valid `access_token` and `refresh_token`
   - Check `token_expires_at` is in the future
   - Re-authenticate if tokens are invalid

3. **Check environment variable:**
   - Verify `GMAIL_PUBSUB_TOPIC_NAME` is set correctly
   - Format: `projects/YOUR_PROJECT_ID/topics/gmail-notifications`

### Issue 3: Pub/Sub Not Pushing to Webhook

**Symptom:** Messages published but not delivered, backlog growing

**Fix:**

1. **Verify push subscription endpoint:**
   - Go to Pub/Sub → Subscriptions → Your subscription
   - Check **Endpoint URL** matches: `https://YOUR_DOMAIN.com/api/webhooks/gmail`
   - Must be HTTPS (HTTP not allowed)
   - Must be publicly accessible (no localhost)

2. **Check webhook endpoint is accessible:**
   ```bash
   curl https://YOUR_DOMAIN.com/api/webhooks/gmail
   ```
   Should return health check JSON

3. **Check SSL certificate:**
   - Pub/Sub requires valid SSL certificate
   - Use services like [SSL Labs](https://www.ssllabs.com/ssltest/) to verify

4. **Check acknowledgment:**
   - Webhook must return `200 OK` within 60 seconds
   - Check webhook logs for errors causing 500 responses
   - Pub/Sub will retry if webhook doesn't acknowledge

### Issue 4: Gmail Not Publishing to Pub/Sub

**Symptom:** Messages published = 0 in Pub/Sub metrics

**Fix:**

1. **Verify Gmail Watch is active:**
   ```sql
   SELECT email, watch_expiration 
   FROM mailboxes 
   WHERE provider = 'gmail' 
   AND watch_expiration > NOW();
   ```

2. **Check Pub/Sub permissions:**
   - Gmail Watch API should grant permissions automatically
   - If not, manually grant:
     - Go to Pub/Sub → Topics → Your topic → Permissions
     - Add: `gmail-api-push@system.gserviceaccount.com`
     - Role: **Pub/Sub Publisher**

3. **Verify topic name:**
   - Check `GMAIL_PUBSUB_TOPIC_NAME` matches topic in Google Cloud
   - Format must be: `projects/PROJECT_ID/topics/TOPIC_NAME`
   - Case-sensitive

4. **Re-setup watch:**
   ```bash
   # Stop existing watch
   DELETE /api/mailboxes/{mailboxId}/watch
   
   # Setup new watch
   POST /api/mailboxes/{mailboxId}/watch
   ```

### Issue 5: Webhook Receiving but Not Processing

**Symptom:** See webhook logs but no emails in database

**Fix:**

1. **Check for RLS policy violations:**
   ```sql
   -- Verify RLS policies allow service_role
   -- Run: supabase/unibox_rls_service_role_fix.sql
   ```

2. **Check webhook logs for errors:**
   ```log
   [Gmail Webhook] Failed to decrypt tokens...
   [Gmail Webhook] Authentication error...
   [syncGmailMessages] Failed to insert message...
   ```

3. **Check token decryption:**
   - Verify `EMAIL_ENCRYPTION_KEY` is set correctly
   - Check for decryption errors in logs
   - Tokens may need re-authentication if key changed

4. **Check database errors:**
   ```sql
   -- Check for mailboxes with errors
   SELECT email, last_error 
   FROM mailboxes 
   WHERE provider = 'gmail' 
   AND last_error IS NOT NULL;
   ```

### Issue 6: Pub/Sub Subscription Delivery Errors

**Symptom:** High delivery errors in Pub/Sub console

**Fix:**

1. **Check webhook response time:**
   - Webhook must respond within 60 seconds
   - Pub/Sub timeout is ~10 seconds (recommended to be faster)
   - Check for slow database queries or Gmail API calls

2. **Check webhook error responses:**
   - Webhook should return `200 OK` even on errors (to prevent retries)
   - Only return `500` for transient errors that should be retried
   - Check logs for repeated failures

3. **Verify endpoint URL is correct:**
   - No typos in URL
   - Correct HTTP method (POST)
   - Publicly accessible

4. **Check dead letter topic:**
   - Messages in dead letter topic indicate permanent failures
   - Review dead letter messages to identify issues
   - Fix underlying issue, then reprocess dead letter messages

## 📊 Monitoring Checklist

Use this checklist to verify everything is working:

- [ ] Webhook health endpoint returns `status: "ok"`
- [ ] `GMAIL_PUBSUB_TOPIC_NAME` is set correctly
- [ ] Pub/Sub subscription exists and points to correct endpoint
- [ ] Gmail Watch is active (`watch_expiration > NOW()`)
- [ ] Messages are being published to Pub/Sub (check metrics)
- [ ] Messages are being delivered (check subscription metrics)
- [ ] Message backlog is 0 or very low
- [ ] Webhook logs show incoming requests
- [ ] Database shows received messages (`email_messages` table)
- [ ] No expired watches (`expired_watches: 0` in health check)
- [ ] No errors in mailbox `last_error` field
- [ ] RLS policies allow service_role (run SQL fix if needed)

## 🚨 Emergency Fixes

### If Nothing is Working:

1. **Check all environment variables:**
   ```bash
   GMAIL_PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT/topics/YOUR_TOPIC
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   EMAIL_ENCRYPTION_KEY=your_encryption_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   ```

2. **Re-authenticate mailbox:**
   - Re-run OAuth flow to get fresh tokens
   - This will also set up a new watch

3. **Recreate Pub/Sub subscription:**
   - Delete old subscription
   - Create new push subscription
   - Point to webhook endpoint

4. **Run RLS policy fix:**
   ```sql
   -- Run: supabase/unibox_rls_service_role_fix.sql
   ```

5. **Manual sync as fallback:**
   - Use cron job `/api/cron/sync-mailboxes` as backup
   - This polls Gmail directly if webhooks fail

## 📝 Diagnostic Query

Run this comprehensive diagnostic query:

```sql
-- Comprehensive Gmail webhook diagnostic
WITH mailbox_status AS (
  SELECT 
    id,
    email,
    provider,
    watch_expiration,
    watch_history_id,
    last_synced_at,
    last_error,
    CASE 
      WHEN watch_expiration IS NULL THEN 'NOT SET UP'
      WHEN watch_expiration < NOW() THEN 'EXPIRED'
      WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON'
      ELSE 'ACTIVE'
    END as watch_status,
    CASE 
      WHEN last_synced_at IS NULL THEN 'NEVER SYNCED'
      WHEN last_synced_at < NOW() - INTERVAL '24 hours' THEN 'STALE (>24h)'
      ELSE 'RECENT'
    END as sync_status
  FROM mailboxes
  WHERE provider = 'gmail'
),
message_stats AS (
  SELECT 
    mailbox_id,
    COUNT(*) as total_messages,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
    MAX(created_at) as most_recent_message
  FROM email_messages
  WHERE direction = 'inbound'
  GROUP BY mailbox_id
)
SELECT 
  ms.email,
  ms.watch_status,
  ms.sync_status,
  ms.watch_expiration,
  ms.last_synced_at,
  ms.last_error,
  COALESCE(msg.total_messages, 0) as total_messages,
  COALESCE(msg.last_hour, 0) as messages_last_hour,
  COALESCE(msg.last_24h, 0) as messages_last_24h,
  msg.most_recent_message,
  CASE 
    WHEN ms.watch_status = 'EXPIRED' THEN '⚠️ WATCH EXPIRED - Renew watch'
    WHEN ms.watch_status = 'NOT SET UP' THEN '⚠️ WATCH NOT SET - Setup watch'
    WHEN ms.watch_status = 'EXPIRING SOON' THEN 'ℹ️ WATCH EXPIRING - Will renew automatically'
    WHEN msg.last_24h = 0 AND ms.sync_status = 'RECENT' THEN '⚠️ NO MESSAGES - Check webhook'
    WHEN msg.last_24h = 0 AND ms.sync_status = 'STALE' THEN '⚠️ NOT SYNCING - Check watch/tokens'
    WHEN ms.last_error IS NOT NULL THEN '❌ ERROR: ' || ms.last_error
    ELSE '✅ OK'
  END as recommendation
FROM mailbox_status ms
LEFT JOIN message_stats msg ON ms.id = msg.mailbox_id
ORDER BY ms.email;
```

This query will show you:
- Watch status for each mailbox
- Sync status and recency
- Message counts and recency
- Specific recommendations for each mailbox

