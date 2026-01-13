# Complete Pub/Sub Setup Guide for Gmail Webhooks

This guide walks you through setting up Google Cloud Pub/Sub to receive Gmail push notifications and deliver them to your database.

## Architecture Overview

```
Gmail Inbox → Gmail Watch API → Google Cloud Pub/Sub Topic → Push Subscription → Your Webhook → Supabase Database
```

## Prerequisites

Before starting, ensure you have:

- ✅ Google Cloud Project created
- ✅ Gmail API enabled in Google Cloud Console
- ✅ Pub/Sub API enabled in Google Cloud Console
- ✅ OAuth credentials configured (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- ✅ Your webhook endpoint deployed (e.g., `https://yourdomain.com/api/webhooks/gmail`)

## Step 1: Create Pub/Sub Topic

### Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Pub/Sub** → **Topics**
3. Click **"Create Topic"**

### Topic Configuration

**Basic Settings:**
- **Topic ID**: `gmail-notifications` (or your preferred name)
- **Display name**: `Gmail Notifications` (optional)

**Advanced Settings:**

#### ✅ Enable Ingestion (Recommended)
- **Purpose**: Provides exactly-once delivery guarantees and message ordering
- **Action**: Check **"Enable ingestion"**
- **Ingestion Source**: Select **"None"** or leave blank
  - ⚠️ **Important**: Gmail API publishes directly to the topic, so no external ingestion source is needed
  - The ingestion feature is for delivery guarantees, not data ingestion

#### ✅ Enable Message Retention (Required)
- **Purpose**: Keeps messages available even if webhook is temporarily down
- **Action**: Check **"Enable Message Retention"**
- **Retention Period**: `7 days` (604,800 seconds)
- **Why**: Ensures no emails are lost during outages

#### ⚠️ Optional: Export to BigQuery
- **Purpose**: Analytics and debugging
- **Action**: Check if you want email delivery analytics
- **Not required** for basic functionality

#### ⚠️ Optional: Backup to Cloud Storage
- **Purpose**: Audit trail and recovery
- **Action**: Check if you want message backup
- **Not required** for basic functionality

#### ❌ Skip: Default Subscription
- **Action**: Leave unchecked
- **Why**: We'll create a push subscription manually with the correct webhook URL

#### ❌ Skip: Schema
- **Action**: Leave unchecked
- **Why**: Gmail Watch messages come in a standardized format

4. Click **"Create"**

### Verify Topic Creation

After creation, note the **full topic name**:
```
projects/YOUR_PROJECT_ID/topics/gmail-notifications
```

You'll need this for the `GMAIL_PUBSUB_TOPIC_NAME` environment variable.

---

## Step 2: Create Push Subscription

### Using Google Cloud Console

1. In your Pub/Sub topic, click **"Create Subscription"**
2. Enter **Subscription ID**: `gmail-webhook-subscription` (or your preferred name)
3. Select **Delivery type**: **Push**

### Subscription Configuration

**Basic Settings:**
- **Subscription ID**: `gmail-webhook-subscription`
- **Delivery type**: **Push**

**Push Configuration:**
- **Endpoint URL**: `https://YOUR_DOMAIN.com/api/webhooks/gmail`
  - Replace `YOUR_DOMAIN.com` with your actual domain
  - ⚠️ **Must be HTTPS** (HTTP not allowed)
  - ⚠️ **Must be publicly accessible** (no localhost)
  - Example: `https://www.growyourdigitalleverage.com/api/webhooks/gmail`

**Message Delivery:**
- **Acknowledgment deadline**: `60 seconds`
  - Your webhook must respond within 60 seconds
  - Pub/Sub will retry if no acknowledgment received

**Message Retention:**
- **Message retention duration**: `7 days`
  - Keeps messages available if webhook is temporarily down

**Retry Policy:**
- **Minimum backoff**: `10 seconds`
- **Maximum backoff**: `600 seconds` (10 minutes)
- **Purpose**: Prevents overwhelming your webhook with rapid retries

**Dead Letter Topic** (Recommended):
- **Create a dead letter topic** (see Step 3)
- **Maximum delivery attempts**: `5`
  - After 5 failed attempts, message goes to dead letter topic
  - Prevents infinite retries

4. Click **"Create"**

---

## Step 3: Create Dead Letter Topic (Optional but Recommended)

Dead letter topics capture messages that fail delivery after maximum retries, helping you identify and fix issues.

### Create Dead Letter Topic

1. Go to **Pub/Sub** → **Topics** → **Create Topic**
2. **Topic ID**: `gmail-notifications-dlq`
3. **Display name**: `Gmail Notifications Dead Letter Queue`
4. Click **"Create"**

### Configure Dead Letter Subscription

1. In the dead letter topic, click **"Create Subscription"**
2. **Subscription ID**: `gmail-dlq-subscription`
3. **Delivery type**: **Pull** (or Push to a monitoring endpoint)
4. Click **"Create"**

### Set Up Monitoring

Monitor the dead letter queue for failed messages:

```bash
# Check dead letter queue messages
gcloud pubsub subscriptions pull gmail-dlq-subscription --limit=10
```

---

## Step 4: Configure Environment Variables

Add these environment variables to your application (Vercel, environment file, etc.):

```bash
# Required: Pub/Sub Topic Name
GMAIL_PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications

# Optional: Verification Token (for webhook security)
GMAIL_PUBSUB_VERIFICATION_TOKEN=your-secure-random-token-here

# Optional: Dead Letter Topic (for monitoring)
GMAIL_PUBSUB_DLQ_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications-dlq
```

### Generate Verification Token

```bash
# Generate a secure random token
openssl rand -hex 32
```

---

## Step 5: Grant Pub/Sub Permissions

### Automatic Permission Granting (Recommended)

**Good News**: Gmail Watch API automatically grants permissions when you set up the watch! 

If you get a "Domain Restricted Sharing" error when trying to manually grant permissions, **you can skip this step**. The Gmail Watch API will handle permissions automatically.

### Manual Permission Granting (Optional)

If your organization doesn't have domain restrictions, you can manually grant permissions for better visibility:

1. Go to **Pub/Sub** → **Topics** → Your topic (`gmail-notifications`)
2. Click **"PERMISSIONS"** tab
3. Click **"GRANT ACCESS"**
4. **Add principal**: `gmail-api-push@system.gserviceaccount.com`
5. **Select role**: **Pub/Sub Publisher**
6. Click **"SAVE"**

---

## Step 6: Set Up Gmail Watch

Once Pub/Sub is configured, set up Gmail Watch for your mailboxes:

### Automatic Setup (During OAuth)

When a user connects their Gmail account via OAuth, the watch is automatically set up in:
- `app/api/mailboxes/oauth/gmail/callback/route.ts`

### Manual Setup (If Needed)

If you need to manually set up or renew a watch:

```bash
POST https://YOUR_DOMAIN.com/api/mailboxes/{mailboxId}/watch
```

Or trigger the cron job for automatic renewal:
```bash
GET https://YOUR_DOMAIN.com/api/cron/gmail-watch-renewal
```

---

## Step 7: Verify Configuration

### Test 1: Check Webhook Health

```bash
curl https://YOUR_DOMAIN.com/api/webhooks/gmail
```

**Expected Response:**
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
- ✅ `pubsub_topic: true` - `GMAIL_PUBSUB_TOPIC_NAME` is set correctly
- ✅ `expired_watches: 0` - All watches are active
- ⚠️ `pubsub_verification: false` - Optional, only true if token is set

### Test 2: Verify Topic Exists

```bash
gcloud pubsub topics describe gmail-notifications
```

**Should show:**
- `messageRetentionDuration: 604800s` (7 days)
- `ingestionDataSourceSettings` enabled

### Test 3: Verify Subscription

```bash
gcloud pubsub subscriptions describe gmail-webhook-subscription
```

**Should show:**
- `pushConfig.endpoint` pointing to your webhook URL
- `ackDeadlineSeconds: 60`
- `messageRetentionDuration: 604800s`

### Test 4: Send Test Email

1. Send a test email to your connected Gmail account
2. Wait 10-30 seconds
3. Check Pub/Sub metrics:
   - **Messages published** should increase
   - **Messages delivered** should match published
4. Check your application logs for:
   ```
   [Gmail Webhook] Processing notification for {email}...
   [syncGmailMessages] Successfully inserted message...
   ```
5. Check Supabase database:
   ```sql
   SELECT * FROM email_messages 
   WHERE direction = 'inbound' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## Step 8: Monitor Pub/Sub Metrics

### In Google Cloud Console

1. Go to **Pub/Sub** → **Subscriptions** → Your subscription
2. Check **"Metrics"** tab:

**Key Metrics:**
- **Messages published** - Should increase when emails arrive
- **Messages delivered** - Should match published (or close)
- **Message backlog** - Should be 0 or very low
- **Oldest unacknowledged message** - Should be recent or empty
- **Delivery errors** - Should be 0 or low

**Red Flags:**
- ❌ Messages published = 0 (Gmail not publishing)
- ❌ Message backlog growing (webhook not processing)
- ❌ High delivery errors (webhook failing)
- ❌ Oldest unacknowledged message is old (webhook not responding)

### Check Subscription Backlog

```bash
gcloud pubsub subscriptions describe gmail-webhook-subscription \
  --format="value(numUndeliveredMessages)"
```

Should return `0` or a low number.

---

## Troubleshooting

### Issue 1: Messages Not Being Published

**Symptom**: `Messages published = 0` in Pub/Sub metrics

**Fix:**
1. Verify Gmail Watch is active:
   ```sql
   SELECT email, watch_expiration 
   FROM mailboxes 
   WHERE provider = 'gmail' 
   AND watch_expiration > NOW();
   ```
2. Check `GMAIL_PUBSUB_TOPIC_NAME` matches topic in Google Cloud
3. Re-setup watch:
   ```bash
   POST /api/mailboxes/{mailboxId}/watch
   ```

### Issue 2: Messages Published but Not Delivered

**Symptom**: Messages published > 0, but backlog growing

**Fix:**
1. Verify webhook endpoint URL is correct and accessible
2. Check webhook returns `200 OK` within 60 seconds
3. Check webhook logs for errors
4. Verify SSL certificate is valid (Pub/Sub requires HTTPS)

### Issue 3: Webhook Receiving but Not Processing

**Symptom**: See webhook logs but no emails in database

**Fix:**
1. Check RLS policies allow service_role:
   ```sql
   -- Run: supabase/unibox_rls_service_role_fix.sql
   ```
2. Check webhook logs for:
   - Token decryption errors
   - Database insert errors
   - Authentication errors
3. Verify `EMAIL_ENCRYPTION_KEY` is set correctly

### Issue 4: Watch Expired

**Symptom**: `watch_expiration < NOW()` in database

**Fix:**
1. Automatic renewal (recommended):
   - Cron job at `/api/cron/gmail-watch-renewal` runs daily
   - Check logs to verify it's running
2. Manual renewal:
   ```bash
   POST /api/mailboxes/{mailboxId}/watch
   ```

---

## Configuration Checklist

Use this checklist to verify everything is set up correctly:

- [ ] Pub/Sub topic created (`gmail-notifications`)
- [ ] Topic has message retention enabled (7 days)
- [ ] Topic has ingestion enabled (for exactly-once delivery)
- [ ] Push subscription created (`gmail-webhook-subscription`)
- [ ] Subscription points to correct webhook URL (HTTPS)
- [ ] Subscription has acknowledgment deadline set (60 seconds)
- [ ] Dead letter topic created (optional but recommended)
- [ ] `GMAIL_PUBSUB_TOPIC_NAME` environment variable set
- [ ] `GMAIL_PUBSUB_VERIFICATION_TOKEN` set (optional)
- [ ] Webhook health endpoint returns `status: "ok"`
- [ ] Gmail Watch is active for mailboxes (`watch_expiration > NOW()`)
- [ ] Test email successfully processed and saved to database
- [ ] Pub/Sub metrics show messages being published and delivered
- [ ] Message backlog is 0 or very low
- [ ] No errors in mailbox `last_error` field

---

## Next Steps

After Pub/Sub is configured:

1. **Connect Gmail Mailboxes**: Users connect their Gmail accounts via OAuth
2. **Automatic Watch Setup**: Watch is automatically set up during OAuth
3. **Receive Emails**: Emails are pushed to your webhook in real-time
4. **Monitor Health**: Use the health endpoint and Pub/Sub metrics to monitor
5. **Automatic Renewal**: Cron job renews watches before expiration

---

## Related Documentation

- [Gmail Webhook Diagnostics](./GMAIL_WEBHOOK_DIAGNOSTICS.md) - Troubleshooting guide
- [Gmail Pub/Sub Topic Configuration](./GMAIL_PUBSUB_TOPIC_CONFIGURATION.md) - Detailed topic settings
- [Gmail Pub/Sub Ingestion Setup](./GMAIL_PUBSUB_INGESTION_SETUP.md) - Ingestion clarification
- [Gmail Watch Setup Manual](./GMAIL_WATCH_SETUP_MANUAL.md) - Manual watch setup
- [Realtime Gmail Listener Reference](./REALTIME_GMAIL_LISTENER_REFERENCE.md) - Reference implementation

---

## Quick Reference

### Environment Variables
```bash
GMAIL_PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications
GMAIL_PUBSUB_VERIFICATION_TOKEN=your-secure-token-here  # Optional
GMAIL_PUBSUB_DLQ_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications-dlq  # Optional
```

### Health Check
```bash
curl https://YOUR_DOMAIN.com/api/webhooks/gmail
```

### Database Check
```sql
-- Check watch status
SELECT email, watch_expiration, watch_history_id 
FROM mailboxes 
WHERE provider = 'gmail';

-- Check received messages
SELECT COUNT(*) 
FROM email_messages 
WHERE direction = 'inbound' 
AND created_at > NOW() - INTERVAL '1 hour';
```

### Pub/Sub Commands
```bash
# Describe topic
gcloud pubsub topics describe gmail-notifications

# Describe subscription
gcloud pubsub subscriptions describe gmail-webhook-subscription

# Check backlog
gcloud pubsub subscriptions describe gmail-webhook-subscription \
  --format="value(numUndeliveredMessages)"
```

