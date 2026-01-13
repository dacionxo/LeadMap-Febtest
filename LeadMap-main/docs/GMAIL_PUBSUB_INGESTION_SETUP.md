# Gmail Pub/Sub Ingestion Setup Guide

Complete guide for configuring Pub/Sub ingestion for Gmail Watch, clarifying the ingestion source selection.

## Understanding Pub/Sub Ingestion

**Important Clarification**: When you enable "ingestion" in Google Cloud Pub/Sub, you're enabling **exactly-once delivery guarantees** and **message ordering**, NOT external data ingestion from sources like BigQuery, Cloud Storage, etc.

For Gmail Watch:
- **Gmail API publishes directly** to your Pub/Sub topic
- **No external ingestion source** is needed
- The "ingestion" feature provides reliability guarantees, not data ingestion

## Ingestion Source Selection

When creating the topic with "Enable ingestion" checked, you may be prompted to select an "Ingestion source". 

### ✅ Correct Selection: **None / No Ingestion Source**

**Why:**
- Gmail API publishes push notifications directly to your Pub/Sub topic
- No external data source needs to be ingested
- The ingestion feature is enabled for exactly-once delivery, not for ingesting external data

**How to Select:**
1. When creating the topic, check **"Enable ingestion"**
2. If prompted for "Ingestion source", select:
   - **"None"** or
   - **"No ingestion source"** or
   - **Leave it blank/unselected**
3. The ingestion feature will still be enabled for delivery guarantees

## Step-by-Step Topic Creation with Ingestion

### Option 1: Using Google Cloud Console

1. Navigate to **Pub/Sub** → **Topics** → **Create Topic**

2. **Basic Settings**:
   - **Topic ID**: `gmail-notifications`
   - **Display name**: `Gmail Notifications` (optional)

3. **Ingestion Settings**:
   - ✅ Check **"Enable ingestion"**
   - **Ingestion source**: **Leave blank / Select "None"**
   - **Note**: You may not see this option - if you don't, that's fine. The ingestion feature is still enabled.

4. **Message Retention**:
   - ✅ Check **"Enable Message Retention"**
   - **Retention duration**: `604800` seconds (7 days)

5. **Optional Settings**:
   - Export to BigQuery: ⚠️ Optional
   - Backup to Cloud Storage: ⚠️ Optional

6. Click **"Create"**

### Option 2: Using gcloud CLI

```bash
# Create topic with ingestion enabled (no ingestion source)
gcloud pubsub topics create gmail-notifications \
  --message-retention-duration=604800s \
  --ingestion-data-source= \
  --enable-message-ordering
```

**Note**: The `--ingestion-data-source` flag may not be available or needed. If it errors, omit it:

```bash
# Simplified command (ingestion enabled by default with message ordering)
gcloud pubsub topics create gmail-notifications \
  --message-retention-duration=604800s \
  --enable-message-ordering
```

### Option 3: Using Terraform

```hcl
resource "google_pubsub_topic" "gmail_notifications" {
  name = "gmail-notifications"
  
  # Enable message retention (7 days)
  message_retention_duration = "604800s"
  
  # Enable message ordering (provides exactly-once delivery)
  enable_message_ordering = true
  
  # Note: No ingestion_data_source needed - Gmail API publishes directly
}
```

## Verifying Ingestion Configuration

After creating the topic, verify the configuration:

### Using gcloud CLI

```bash
# Describe the topic
gcloud pubsub topics describe gmail-notifications

# Check for message ordering (indicates ingestion is enabled)
gcloud pubsub topics describe gmail-notifications --format="value(enableMessageOrdering)"
# Should return: true
```

### Using Google Cloud Console

1. Go to **Pub/Sub** → **Topics**
2. Click on `gmail-notifications`
3. Check **"Message ordering"** is enabled
4. Check **"Message retention"** is set to 7 days

## What Ingestion Actually Does

When you enable "ingestion" in Pub/Sub for Gmail Watch:

1. **Exactly-Once Delivery**: Each Gmail push notification is delivered exactly once
2. **Message Ordering**: Messages are delivered in the order they were published
3. **Reliability**: Prevents duplicate email processing
4. **No External Data Source**: Gmail API publishes directly - no ingestion source needed

## Common Misconceptions

### ❌ Wrong: "I need to select BigQuery as ingestion source"
- **Reality**: BigQuery export is separate from ingestion
- **Gmail API publishes directly** - no BigQuery ingestion needed

### ❌ Wrong: "I need to select Cloud Storage as ingestion source"
- **Reality**: Cloud Storage backup is separate from ingestion
- **Gmail API publishes directly** - no Cloud Storage ingestion needed

### ✅ Correct: "Ingestion provides delivery guarantees, not data ingestion"
- **Reality**: The feature name is misleading - it's about delivery reliability
- **Gmail API is the publisher** - it sends messages directly to your topic

## Troubleshooting

### Issue: "Ingestion source is required"

**Solution:**
- If the UI requires an ingestion source, try creating the topic via gcloud CLI instead
- Or select "None" / "No ingestion source" if available
- The ingestion feature works without an external source for Gmail Watch

### Issue: "Cannot enable ingestion without source"

**Solution:**
- This may be a UI limitation
- Use gcloud CLI: `gcloud pubsub topics create gmail-notifications --enable-message-ordering`
- Message ordering provides the same reliability guarantees

### Issue: Messages are duplicated

**Solution:**
- Verify message ordering is enabled: `gcloud pubsub topics describe gmail-notifications`
- Check subscription has `enableExactlyOnceDelivery: true`
- Implement idempotency in webhook handler (check `provider_message_id`)

## Alternative: Enable Message Ordering Only

If the ingestion feature causes issues, you can enable message ordering directly:

```bash
# Enable message ordering (provides similar guarantees)
gcloud pubsub topics update gmail-notifications \
  --enable-message-ordering
```

This provides:
- Message ordering guarantees
- Reduced duplicate delivery (though not exactly-once)

## Best Practices

1. ✅ **Enable ingestion/message ordering** for reliability
2. ✅ **Select "None" for ingestion source** - Gmail API publishes directly
3. ✅ **Enable message retention** (7 days) for outage resilience
4. ✅ **Verify configuration** after creation
5. ✅ **Test message delivery** to ensure no duplicates

## Configuration Summary

```
Topic: gmail-notifications
✅ Enable ingestion: YES
✅ Ingestion source: NONE (Gmail API publishes directly)
✅ Message retention: 7 days (604,800 seconds)
✅ Message ordering: Enabled (via ingestion)
```

## References

- [Pub/Sub Exactly-Once Delivery](https://cloud.google.com/pubsub/docs/exactly-once-delivery)
- [Pub/Sub Message Ordering](https://cloud.google.com/pubsub/docs/ordering)
- [Gmail Watch API](https://developers.google.com/gmail/api/guides/push)

---

**Last Updated**: 2024-01-01
**Version**: 1.0

