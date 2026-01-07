# Gmail Pub/Sub Cloud Storage Backup Setup

Guide for configuring Cloud Storage backup for Gmail Watch Pub/Sub messages.

## Understanding Cloud Storage Backup

If you enabled "Backup Message data to Cloud Storage" when creating your Pub/Sub topic, you need to configure a Cloud Storage bucket to receive the backup messages.

## Your Configuration

Based on your setup:
- **Bucket Name**: `gmail-notifications2`
- **Purpose**: Backup Gmail Watch push notifications

## Setup Steps

### Step 1: Verify Bucket Exists

1. Go to **Cloud Storage** → **Buckets**
2. Verify bucket `gmail-notifications2` exists
3. If it doesn't exist, create it (see Step 2)

### Step 2: Create Bucket (If Needed)

If the bucket doesn't exist:

1. Go to **Cloud Storage** → **Buckets** → **Create Bucket**
2. **Name**: `gmail-notifications2`
3. **Location type**: Choose your preferred region
4. **Storage class**: Standard (for frequent access)
5. **Access control**: Uniform (recommended)
6. Click **"Create"**

### Step 3: Configure Pub/Sub Topic Backup

1. Go to **Pub/Sub** → **Topics**
2. Click on `gmail-notifications` topic
3. Go to **"Backup"** tab or **"Settings"**
4. Enable **"Backup to Cloud Storage"**
5. Select bucket: `gmail-notifications2`
6. **Backup format**: JSON (recommended)
7. Click **"Save"**

### Step 4: Grant Pub/Sub Permissions

The Pub/Sub service account needs permission to write to your bucket:

1. Go to **Cloud Storage** → **Buckets**
2. Click on `gmail-notifications2`
3. Go to **"Permissions"** tab
4. Click **"Grant Access"**
5. Add principal: `service-[PROJECT_NUMBER]@gcp-sa-pubsub.iam.gserviceaccount.com`
   - Replace `[PROJECT_NUMBER]` with your GCP project number
6. Role: **Storage Object Creator**
7. Click **"Save"**

### Step 5: Verify Backup Configuration

1. Send a test email to your connected Gmail account
2. Wait a few minutes
3. Check bucket `gmail-notifications2` for backup files
4. Files should appear in format: `gmail-notifications/YYYY/MM/DD/HH/...`

## Bucket Structure

Backed up messages will be stored in:
```
gs://gmail-notifications2/
  └── gmail-notifications/
      └── YYYY/
          └── MM/
              └── DD/
                  └── HH/
                      └── [message-files].json
```

## Accessing Backup Files

### Using gcloud CLI

```bash
# List backup files
gsutil ls gs://gmail-notifications2/gmail-notifications/

# Download a backup file
gsutil cp gs://gmail-notifications2/gmail-notifications/2024/01/01/12/message.json .
```

### Using Google Cloud Console

1. Go to **Cloud Storage** → **Buckets**
2. Click on `gmail-notifications2`
3. Navigate to `gmail-notifications/` folder
4. Browse by date/time structure

## Important Notes

1. **Backup is Optional**: Cloud Storage backup is not required for Gmail Watch to work
2. **Cost**: Storing backups incurs Cloud Storage costs
3. **Retention**: Consider setting lifecycle policies to delete old backups
4. **Access**: Backup files contain message data - secure appropriately

## Lifecycle Policy (Optional)

To automatically delete old backups:

1. Go to **Cloud Storage** → **Buckets** → `gmail-notifications2`
2. Go to **"Lifecycle"** tab
3. Click **"Add a rule"**
4. **Action**: Delete object
5. **Condition**: Age > 30 days (or your preferred retention)
6. Click **"Create"**

## Troubleshooting

### Issue: Backup not working

**Check:**
1. Bucket exists and is accessible
2. Pub/Sub service account has write permissions
3. Backup is enabled in topic settings
4. Check Pub/Sub logs for errors

### Issue: High storage costs

**Solution:**
- Set up lifecycle policy to delete old backups
- Consider using Nearline or Coldline storage class
- Disable backup if not needed

## Alternative: Manual Backup

If you don't want automatic backup, you can manually export messages:

```bash
# Export messages from Pub/Sub to Cloud Storage
gcloud pubsub subscriptions pull gmail-webhook-subscription \
  --format=json > messages.json

# Upload to Cloud Storage
gsutil cp messages.json gs://gmail-notifications2/backups/
```

---

**Last Updated**: 2024-01-01
**Version**: 1.0

