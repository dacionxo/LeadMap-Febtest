# Reset Gmail Watch Guide

Complete guide for resetting Gmail Watch after fixing Pub/Sub permissions.

## Why Reset Gmail Watch?

After fixing Pub/Sub permissions, you should reset Gmail Watch to ensure:
1. The watch uses the correct topic name with proper permissions
2. A fresh `historyId` is obtained from Gmail
3. The watch expiration is reset to 7 days from now

## Methods to Reset Gmail Watch

### Method 1: Use Gmail Watch Renewal Cron Job (Easiest)

The cron job at `/api/cron/gmail-watch-renewal` will automatically renew all Gmail watches that are expiring or expired.

**Using PowerShell:**
```powershell
.\reset-gmail-watch-all.ps1 -CronSecret YOUR_CRON_SECRET
```

**Using curl:**
```bash
curl -X POST "https://www.growyourdigitalleverage.com/api/cron/gmail-watch-renewal" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Note:** The cron secret is typically set in your Vercel environment variables as `CRON_SECRET`.

### Method 2: Reset Individual Mailbox via API

Use the watch endpoint for a specific mailbox:

**Endpoint:**
```
POST /api/mailboxes/{mailboxId}/watch
```

**Requirements:**
- You must be authenticated (logged in to your application)
- You need the mailbox ID from Supabase

**Steps:**

1. **Get mailbox ID from Supabase:**
   ```sql
   SELECT id, email, watch_expiration, watch_history_id
   FROM mailboxes
   WHERE provider = 'gmail';
   ```

2. **Call the endpoint from your browser console (while logged in):**
   ```javascript
   fetch('https://www.growyourdigitalleverage.com/api/mailboxes/YOUR_MAILBOX_ID/watch', {
     method: 'POST',
     credentials: 'include'
   })
   .then(r => r.json())
   .then(data => console.log(data));
   ```

3. **Or use curl with authentication:**
   ```bash
   curl -X POST "https://www.growyourdigitalleverage.com/api/mailboxes/YOUR_MAILBOX_ID/watch" \
     -H "Cookie: YOUR_SESSION_COOKIE" \
     -H "Content-Type: application/json"
   ```

**Expected Response:**
```json
{
  "success": true,
  "expiration": 1734567890000,
  "historyId": "12345",
  "message": "Gmail Watch set up successfully. You will receive push notifications for new emails."
}
```

### Method 3: Re-authenticate via OAuth (Most Reliable)

Re-authenticating the Gmail mailbox will automatically set up a new watch during the OAuth callback.

**Steps:**

1. Go to your application's email/mailbox settings
2. Find the Gmail mailbox you want to reset
3. Click "Disconnect" or "Remove"
4. Click "Connect Gmail" or "Add Gmail Account"
5. Complete the OAuth flow
6. The watch will be automatically set up during the callback

**Why this works:**
- The OAuth callback (`/api/mailboxes/oauth/gmail/callback`) automatically calls `setupGmailWatch()` after successful authentication
- This ensures a fresh watch with the correct topic name

## Verification

After resetting, verify the watch is active:

### Check Database

```sql
SELECT 
  id,
  email,
  watch_expiration,
  watch_history_id,
  CASE 
    WHEN watch_expiration IS NULL THEN 'NOT SET UP'
    WHEN watch_expiration < NOW() THEN 'EXPIRED'
    WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON'
    ELSE 'ACTIVE'
  END as watch_status
FROM mailboxes
WHERE provider = 'gmail';
```

**What to look for:**
- ✅ `watch_expiration` should be ~7 days in the future
- ✅ `watch_history_id` should NOT be NULL
- ✅ `watch_status` should be 'ACTIVE'

### Check Google Cloud Console

1. Go to **Pub/Sub** → **Topics** → `gmail-notifications3`
2. Check **Topic state** - should be **Active** (not "Publish permission denied")
3. Check **Metrics** - should show messages being published when emails arrive

### Test with Email

1. Send a test email to your Gmail inbox
2. Wait 10-30 seconds
3. Check Pub/Sub metrics for published messages
4. Check webhook logs for processing
5. Check Supabase database for new emails

## Troubleshooting

### Error: "GMAIL_PUBSUB_TOPIC_NAME environment variable is not set"

**Fix:** Set the environment variable:
```
GMAIL_PUBSUB_TOPIC_NAME=projects/canvas-advice-479307-p4/topics/gmail-notifications3
```

### Error: "Access token is missing"

**Fix:** The mailbox needs to be re-authenticated via OAuth (Method 3)

### Error: "Failed to refresh access token"

**Fix:** 
1. Check if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Re-authenticate the mailbox via OAuth

### Error: "Publish permission denied" (still showing)

**Fix:**
1. Wait 2-3 minutes for permission propagation
2. Verify permission was granted:
   ```powershell
   gcloud pubsub topics get-iam-policy gmail-notifications3 --project=canvas-advice-479307-p4
   ```
3. Re-run the permission fix script:
   ```powershell
   .\fix-gmail-pubsub-permissions.ps1
   ```

## Quick Reference

### Reset All Watches (Cron Job)
```powershell
.\reset-gmail-watch-all.ps1 -CronSecret YOUR_SECRET
```

### Reset Single Mailbox (API)
```javascript
// From browser console (while logged in)
fetch('/api/mailboxes/YOUR_MAILBOX_ID/watch', {
  method: 'POST',
  credentials: 'include'
})
```

### Verify Watch Status
```sql
SELECT email, watch_expiration, watch_history_id
FROM mailboxes
WHERE provider = 'gmail';
```

## After Resetting

1. **Wait 1-2 minutes** for the watch to be fully active
2. **Send a test email** to your Gmail inbox
3. **Check Pub/Sub metrics** - should show messages published
4. **Check webhook logs** - should show notifications received
5. **Check Supabase** - emails should appear in `email_messages` and `emails` tables

## Related Documentation

- [Fix Publish Permission Denied](./FIX_PUBLISH_PERMISSION_DENIED.md)
- [Pub/Sub Setup Guide](./PUBSUB_SETUP_COMPLETE_GUIDE.md)
- [Gmail Webhook Diagnostics](./GMAIL_WEBHOOK_DIAGNOSTICS.md)

