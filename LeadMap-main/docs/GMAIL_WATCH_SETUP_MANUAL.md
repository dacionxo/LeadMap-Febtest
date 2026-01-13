# Gmail Watch & Unibox Email Reception Setup Manual

Complete step-by-step guide for setting up Gmail Watch push notifications and enabling real-time email reception in Unibox.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Cloud Setup](#google-cloud-setup)
3. [Environment Variables](#environment-variables)
4. [OAuth Configuration](#oauth-configuration)
5. [Gmail Watch Setup](#gmail-watch-setup)
6. [Webhook Configuration](#webhook-configuration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Monitoring](#monitoring)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Google Cloud Platform (GCP) account
- ✅ GCP project with billing enabled
- ✅ Gmail API enabled in GCP project
- ✅ OAuth 2.0 credentials (Client ID and Client Secret)
- ✅ Access to your application's environment variables
- ✅ Supabase database with `mailboxes`, `email_messages`, and `email_threads` tables

---

## Google Cloud Setup

### Step 1: Create a GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name (e.g., "LeadMap Gmail Watch")
4. Click **"Create"**

### Step 2: Enable Required APIs

1. Navigate to **APIs & Services** → **Library**
2. Enable the following APIs:
   - **Gmail API**
   - **Cloud Pub/Sub API**

### Step 3: Create Pub/Sub Topic

Gmail Watch requires a Google Cloud Pub/Sub topic to deliver push notifications.

1. Navigate to **Pub/Sub** → **Topics**
2. Click **"Create Topic"**
3. Enter topic name: `gmail-notifications` (or your preferred name)
4. Click **"Create"**
5. **Copy the full topic name** (format: `projects/YOUR_PROJECT_ID/topics/gmail-notifications`)

### Step 4: Create Pub/Sub Subscription (Push)

1. In the topic you just created, click **"Create Subscription"**
2. Enter subscription name: `gmail-webhook-subscription`
3. Select **"Push"** delivery type
4. Enter endpoint URL: `https://YOUR_DOMAIN.com/api/webhooks/gmail`
   - Replace `YOUR_DOMAIN.com` with your actual domain
   - For local development: `https://your-ngrok-url.ngrok.io/api/webhooks/gmail`
5. Set **"Acknowledgment deadline"** to 60 seconds
6. Click **"Create"**

### Step 5: Grant Pub/Sub Permissions (OPTIONAL - Usually Not Needed!)

**Important:** Gmail Watch API **automatically grants** permissions when you connect Gmail via OAuth. You typically **don't need to manually grant permissions**.

**Skip this step if:**
- You get a "Domain Restricted Sharing" error (this is expected and can be ignored)
- You're in an organization with domain restrictions
- You want to use the automatic permission granting

**Only manually grant permissions if:**
- You get a "User not authorized" error AFTER connecting Gmail
- Automatic permission granting fails
- You want explicit control over permissions

#### Option A: Topic-Level Permission (If Manual Granting is Needed)

1. Go to **Pub/Sub** → **Topics**
2. Click on your topic (e.g., `gmail-notifications3`)
3. Click **"Permissions"** tab (or **"SHOW INFO PANEL"** → **"Permissions"**)
4. Click **"Add Principal"**
5. Enter service account: `gmail-api-push@system.gserviceaccount.com`
6. Select role: **Pub/Sub Publisher**
7. Click **"Save"**

**Note:** If you get "Domain Restricted Sharing" error, this is expected - skip manual permission granting and proceed to Step 6. The Gmail Watch API will handle permissions automatically.

#### Option B: Project-Level Permission (If Manual Granting is Needed)

1. Go to **IAM & Admin** → **IAM**
2. Click **"Grant Access"** (or **"ADD"**)
3. Enter service account: `gmail-api-push@system.gserviceaccount.com`
4. Select role: **Pub/Sub Publisher**
5. Click **"Save"**

**Troubleshooting:**
- **"Domain Restricted Sharing" error**: This is expected! Skip manual permission granting. See [Gmail Watch Permissions Fix](GMAIL_WATCH_PERMISSIONS_FIX.md) for details.
- **"User not authorized" error**: See [Gmail Watch Permissions Fix](GMAIL_WATCH_PERMISSIONS_FIX.md) for detailed troubleshooting.

### Step 6: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **"External"** (or **"Internal"** for Google Workspace)
3. Fill in required fields:
   - **App name**: Your application name
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (if in testing mode)
6. Click **"Save and Continue"**

### Step 7: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Select **"Web application"**
4. Enter name: `Gmail OAuth Client`
5. Add authorized redirect URIs:
   - `https://YOUR_DOMAIN.com/api/mailboxes/oauth/gmail/callback`
   - For local development: `http://localhost:3000/api/mailboxes/oauth/gmail/callback`
6. Click **"Create"**
7. **Copy Client ID and Client Secret** (you'll need these for environment variables)

---

## Environment Variables

Add the following environment variables to your application (Vercel, `.env.local`, etc.):

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Gmail Watch Pub/Sub Configuration
GMAIL_PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications

# Optional: Webhook Verification Token (recommended for production)
GMAIL_PUBSUB_VERIFICATION_TOKEN=your-random-secure-token-here

# Application URL (for webhook callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Generating Verification Token (Optional but Recommended)

```bash
# Generate a secure random token
openssl rand -hex 32
```

Add this token to `GMAIL_PUBSUB_VERIFICATION_TOKEN` environment variable.

---

## OAuth Configuration

### Step 1: Verify OAuth Redirect URI

Ensure your OAuth redirect URI matches exactly:
- Production: `https://your-domain.com/api/mailboxes/oauth/gmail/callback`
- Development: `http://localhost:3000/api/mailboxes/oauth/gmail/callback`

### Step 2: Test OAuth Flow

1. Navigate to your application's email settings
2. Click **"Connect Gmail"** or **"Add Mailbox"**
3. You should be redirected to Google OAuth consent screen
4. Authorize the application
5. You should be redirected back with `success=gmail_connected`

---

## Gmail Watch Setup

### Automatic Setup (Recommended)

Gmail Watch is **automatically set up** when a user connects their Gmail account via OAuth. The setup happens in the OAuth callback handler.

**What happens automatically:**
1. User authorizes Gmail via OAuth
2. OAuth callback saves mailbox to database
3. OAuth callback calls `setupGmailWatch()`
4. Gmail Watch subscription is created (expires in 7 days)
5. Watch expiration is saved to database

**No manual steps required** - this is handled by `app/api/mailboxes/oauth/gmail/callback/route.ts`

### Manual Setup (If Needed)

If automatic setup fails, you can manually trigger Watch setup:

```typescript
import { setupGmailWatch } from '@/lib/email/providers/gmail-watch'

const result = await setupGmailWatch({
  mailboxId: 'mailbox-id',
  accessToken: 'decrypted-access-token',
  refreshToken: 'decrypted-refresh-token',
  webhookUrl: 'https://your-domain.com/api/webhooks/gmail'
})

if (result.success) {
  console.log('Watch expires at:', new Date(result.expiration))
  console.log('History ID:', result.historyId)
}
```

### Watch Renewal

Gmail Watch subscriptions expire after 7 days. A cron job automatically renews them:

- **Cron route**: `/api/cron/gmail-watch-renewal`
- **Schedule**: Daily at 3 AM (configured in `vercel.json`)
- **What it does**: Finds mailboxes with expiring watches and renews them

**No manual intervention needed** - the cron job handles renewal automatically.

---

## Webhook Configuration

### Step 1: Verify Webhook Endpoint

The webhook endpoint is located at:
- **Route**: `/api/webhooks/gmail`
- **File**: `app/api/webhooks/gmail/route.ts`
- **Method**: `POST`

### Step 2: Configure Pub/Sub Push Subscription

1. Go to **Pub/Sub** → **Subscriptions**
2. Find your subscription: `gmail-webhook-subscription`
3. Click **"Edit"**
4. Verify **Push endpoint** is set to: `https://your-domain.com/api/webhooks/gmail`
5. If using verification token, add header:
   - **Header name**: `x-verification-token`
   - **Header value**: Your `GMAIL_PUBSUB_VERIFICATION_TOKEN` value
6. Click **"Update"**

### Step 3: Test Webhook Endpoint

You can test the webhook endpoint with a GET request:

```bash
curl https://your-domain.com/api/webhooks/gmail
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "supabase": true,
    "pubsub_topic": true,
    "pubsub_verification": true,
    "expired_watches": 0
  }
}
```

---

## Testing

### Test 1: OAuth Connection

1. Navigate to `/dashboard/marketing?tab=emails`
2. Click **"Connect Gmail"**
3. Authorize the application
4. Verify redirect shows `success=gmail_connected`
5. Check database: `mailboxes` table should have new entry with `watch_expiration` set

### Test 2: Gmail Watch Setup

1. After OAuth, check logs for: `[Gmail OAuth] Gmail Watch set up successfully`
2. Check database: `mailboxes.watch_expiration` should be ~7 days in the future
3. Check database: `mailboxes.watch_history_id` should be set

### Test 3: Webhook Reception

1. Send a test email to the connected Gmail account
2. Check application logs for: `[Gmail Webhook] Processed X emails`
3. Check database: `email_messages` table should have new entry
4. Check database: `email_threads` table should have new or updated thread

### Test 4: Unibox Display

1. Navigate to `/dashboard/unibox` (or Unibox tab)
2. Verify the test email appears in the thread list
3. Click on the thread to view message details
4. Verify email content, sender, and timestamp are correct

### Test 5: Cron Sync (Fallback)

1. Wait 5 minutes (cron runs every 5 minutes)
2. Check logs for: `[Sync Mailboxes] Successfully synced gmail mailbox`
3. Verify emails still sync even if webhook fails

---

## Troubleshooting

### Issue: Gmail Watch Not Set Up

**Symptoms:**
- `watch_expiration` is null in database
- Logs show: `Failed to set up Gmail Watch`

**Solutions:**
1. Verify `GMAIL_PUBSUB_TOPIC_NAME` is set correctly
2. Check Pub/Sub topic exists and is accessible
3. Verify OAuth token has `gmail.readonly` scope
4. Check logs for specific error message

### Issue: Webhook Not Receiving Notifications

**Symptoms:**
- Emails not appearing in Unibox
- No webhook logs in application

**Solutions:**
1. Verify Pub/Sub subscription push endpoint is correct
2. Check subscription is active (not paused)
3. Verify webhook endpoint is publicly accessible
4. Check Pub/Sub subscription has proper permissions
5. Test webhook endpoint manually: `GET /api/webhooks/gmail`

### Issue: Emails Not Appearing in Unibox

**Symptoms:**
- Emails in database but not in Unibox UI

**Solutions:**
1. Check `email_messages.direction` is `'inbound'` (not `'received'`)
2. Verify `email_threads` table has corresponding thread
3. Check Unibox API query: `/api/unibox/threads`
4. Verify `email_messages.thread_id` links to `email_threads.id`
5. Check browser console for API errors

### Issue: Watch Subscription Expired

**Symptoms:**
- `watch_expiration` is in the past
- No new emails received

**Solutions:**
1. Check cron job is running: `/api/cron/gmail-watch-renewal`
2. Manually trigger renewal via API
3. Reconnect Gmail account (triggers Watch setup)

### Issue: Invalid Verification Token

**Symptoms:**
- Webhook returns 401 Unauthorized
- Logs show: `Invalid verification token`

**Solutions:**
1. Verify `GMAIL_PUBSUB_VERIFICATION_TOKEN` matches Pub/Sub subscription header
2. Check token is not expired or changed
3. Regenerate token and update both environment variable and Pub/Sub subscription

### Issue: Database Schema Mismatch

**Symptoms:**
- Errors when saving emails
- Missing columns in database

**Solutions:**
1. Verify `email_messages` table has columns:
   - `id`, `thread_id`, `user_id`, `mailbox_id`
   - `direction` (text: 'inbound' or 'outbound')
   - `provider_message_id`, `subject`, `snippet`
   - `body_html`, `body_plain`, `sent_at`, `received_at`
2. Verify `email_threads` table has columns:
   - `id`, `user_id`, `mailbox_id`, `provider_thread_id`
   - `subject`, `status`, `unread`, `last_message_at`
3. Run database migrations if needed

---

## Monitoring

### Health Check Endpoint

Monitor webhook health:

```bash
GET /api/webhooks/gmail
```

Returns:
- Supabase connection status
- Pub/Sub topic configuration
- Expired watch count

### Log Monitoring

Key log messages to monitor:

**Success:**
- `[Gmail OAuth] Gmail Watch set up successfully`
- `[Gmail Webhook] Processed X emails`
- `[Sync Mailboxes] Successfully synced gmail mailbox`

**Errors:**
- `[Gmail OAuth] Failed to set up Gmail Watch`
- `[Gmail Webhook] Mailbox not found`
- `[Sync Mailboxes] Failed to refresh gmail access token`

### Database Monitoring

Query to check Watch status:

```sql
SELECT 
  id,
  email,
  provider,
  watch_expiration,
  watch_history_id,
  last_synced_at,
  CASE 
    WHEN watch_expiration < NOW() THEN 'expired'
    WHEN watch_expiration < NOW() + INTERVAL '1 day' THEN 'expiring_soon'
    ELSE 'active'
  END as watch_status
FROM mailboxes
WHERE provider = 'gmail'
  AND active = true;
```

Query to check email sync status:

```sql
SELECT 
  m.id,
  m.email,
  COUNT(em.id) as message_count,
  MAX(em.received_at) as last_message_at
FROM mailboxes m
LEFT JOIN email_messages em ON em.mailbox_id = m.id
WHERE m.provider = 'gmail'
  AND m.active = true
GROUP BY m.id, m.email;
```

---

## Best Practices

1. **Always set `GMAIL_PUBSUB_VERIFICATION_TOKEN`** in production
2. **Monitor Watch expiration** - set up alerts for expiring watches
3. **Test webhook endpoint** before going live
4. **Keep Pub/Sub subscription active** - don't pause it
5. **Monitor cron job execution** - ensure Watch renewal runs daily
6. **Log all webhook events** for debugging
7. **Handle webhook failures gracefully** - cron sync is fallback
8. **Test OAuth flow** after any environment variable changes

---

## Support

If you encounter issues not covered in this manual:

1. Check application logs for specific error messages
2. Verify all environment variables are set correctly
3. Test each component individually (OAuth, Watch, Webhook, Sync)
4. Review [Gmail Watch API documentation](https://developers.google.com/gmail/api/guides/push)
5. Check [Google Cloud Pub/Sub documentation](https://cloud.google.com/pubsub/docs)

---

## Quick Reference

### Environment Variables Checklist

- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GMAIL_PUBSUB_TOPIC_NAME`
- [ ] `GMAIL_PUBSUB_VERIFICATION_TOKEN` (optional but recommended)
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

### Endpoints

- **OAuth Initiation**: `GET /api/mailboxes/oauth/gmail`
- **OAuth Callback**: `GET /api/mailboxes/oauth/gmail/callback`
- **Webhook**: `POST /api/webhooks/gmail`
- **Health Check**: `GET /api/webhooks/gmail`
- **Sync Cron**: `GET /api/cron/sync-mailboxes` (runs every 5 minutes)
- **Watch Renewal**: `GET /api/cron/gmail-watch-renewal` (runs daily at 3 AM)

### Database Tables

- `mailboxes` - Mailbox configuration and Watch status
- `email_messages` - Individual email messages
- `email_threads` - Email conversation threads
- `email_participants` - From/To/CC/BCC addresses

---

**Last Updated**: 2024-01-01
**Version**: 1.0

