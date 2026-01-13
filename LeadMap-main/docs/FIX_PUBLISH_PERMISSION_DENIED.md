# Fix "Publish Permission Denied" Error

## Problem

You see this error in Google Cloud Console:
```
Topic state: Ingestion resource error: Publish permission denied
```

This means Gmail's push service account cannot publish notifications to your Pub/Sub topic.

## Root Cause

When Gmail Watch publishes notifications, it uses Google's service account:
```
gmail-api-push@system.gserviceaccount.com
```

This service account needs the `roles/pubsub.publisher` role on your topic to publish messages.

## Solution

### Option 1: Using Google Cloud Console (Easiest)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Pub/Sub** → **Topics**
3. Click on your topic: `gmail-notifications3`
4. Click the **PERMISSIONS** tab (or **SHOW INFO PANEL** → **PERMISSIONS**)
5. Click **GRANT ACCESS**
6. In **New principals**, enter:
   ```
   gmail-api-push@system.gserviceaccount.com
   ```
7. In **Select a role**, choose: **Pub/Sub Publisher** (`roles/pubsub.publisher`)
8. Click **SAVE**

### Option 2: Using gcloud CLI

Run this command (replace with your project ID and topic name):

```powershell
gcloud pubsub topics add-iam-policy-binding gmail-notifications3 `
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" `
  --role="roles/pubsub.publisher" `
  --project=canvas-advice-479307-p4
```

**Or use the script:**
```powershell
.\fix-gmail-pubsub-permissions.ps1 -TopicName "gmail-notifications3" -ProjectId "canvas-advice-479307-p4"
```

### Option 3: Using the Fix Script

Run the dedicated fix script:

```powershell
.\fix-publish-permission-denied.ps1
```

This script will:
1. Check current permissions
2. Grant the permission
3. Verify it was granted
4. Wait for propagation
5. Final verification

## Verification

### Check Permissions

```powershell
gcloud pubsub topics get-iam-policy gmail-notifications3 --project=canvas-advice-479307-p4
```

You should see:
```
bindings:
- members:
  - serviceAccount:gmail-api-push@system.gserviceaccount.com
  role: roles/pubsub.publisher
```

### Check Topic State

1. Go to Google Cloud Console → Pub/Sub → Topics
2. Click on `gmail-notifications3`
3. Check the **Topic state** - it should show **Active** (not "Publish permission denied")

## Important Notes

### Permission Propagation

- Permissions can take **1-2 minutes** to fully propagate
- Wait a few minutes after granting before checking topic state
- The error may persist briefly even after granting permission

### Topic Name Must Match

Your Gmail Watch must use the **exact full topic name**:
```
projects/canvas-advice-479307-p4/topics/gmail-notifications3
```

Check your environment variable:
```bash
GMAIL_PUBSUB_TOPIC_NAME=projects/canvas-advice-479307-p4/topics/gmail-notifications3
```

### Re-setup Gmail Watch

After fixing permissions, **re-setup your Gmail Watch** to ensure it uses the correct topic:

1. Re-authenticate the Gmail mailbox (OAuth flow)
2. Or manually trigger watch setup via API

## Troubleshooting

### Still Getting Error After Granting Permission

1. **Wait 2-3 minutes** - permissions need time to propagate
2. **Verify permission was granted:**
   ```powershell
   gcloud pubsub topics get-iam-policy gmail-notifications3 --project=canvas-advice-479307-p4
   ```
3. **Check topic name matches exactly** in your Gmail Watch setup
4. **Re-setup Gmail Watch** after fixing permissions

### Permission Shows But Error Persists

1. **Check project ID matches:**
   - Topic project: `canvas-advice-479307-p4`
   - Watch project: Must be the same
2. **Verify topic exists in correct project:**
   ```powershell
   gcloud pubsub topics list --project=canvas-advice-479307-p4
   ```
3. **Check Pub/Sub API is enabled:**
   ```powershell
   gcloud services list --enabled --project=canvas-advice-479307-p4 | findstr pubsub
   ```

### Error: "Permission already exists"

This is actually **OK** - it means the permission is already granted. The error might be:
- A propagation delay (wait a few minutes)
- Topic name mismatch in Gmail Watch
- Wrong project ID

## Quick Command Reference

```powershell
# Grant permission
gcloud pubsub topics add-iam-policy-binding gmail-notifications3 `
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" `
  --role="roles/pubsub.publisher" `
  --project=canvas-advice-479307-p4

# Check permissions
gcloud pubsub topics get-iam-policy gmail-notifications3 --project=canvas-advice-479307-p4

# Remove permission (if needed)
gcloud pubsub topics remove-iam-policy-binding gmail-notifications3 `
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" `
  --role="roles/pubsub.publisher" `
  --project=canvas-advice-479307-p4

# Verify topic state
gcloud pubsub topics describe gmail-notifications3 --project=canvas-advice-479307-p4
```

## After Fixing

1. **Wait 1-2 minutes** for permission to propagate
2. **Re-setup Gmail Watch** to ensure it uses the correct topic
3. **Test by sending an email** to your Gmail inbox
4. **Check Pub/Sub metrics** to see if messages are being published
5. **Check webhook logs** to see if notifications are being received

## Related Documentation

- [Pub/Sub Setup Guide](./PUBSUB_SETUP_COMPLETE_GUIDE.md)
- [Gmail Webhook Diagnostics](./GMAIL_WEBHOOK_DIAGNOSTICS.md)
- [Webhook Emails Not Saving Diagnostic](./WEBHOOK_EMAILS_NOT_SAVING_DIAGNOSTIC.md)

