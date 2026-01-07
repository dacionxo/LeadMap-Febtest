# Gmail Pub/Sub Topic Configuration Guide

Complete guide for configuring Google Cloud Pub/Sub topic for Gmail Watch, following james-project reliability patterns and best practices.

## Topic Creation Options

When creating the Pub/Sub topic `gmail-notifications`, here are the recommended settings:

### ✅ Recommended Options

#### 1. **Add a default subscription** - ❌ **NO (Skip)**
   - **Reason**: We need to create a **push subscription** manually with the correct webhook endpoint URL
   - **Action**: Leave unchecked, create subscription separately with push configuration

#### 2. **Use a schema** - ❌ **NO (Skip)**
   - **Reason**: Gmail Watch messages come in a standardized format from Google
   - **Action**: Leave unchecked, no custom schema needed

#### 3. **Enable ingestion** - ✅ **YES (Recommended)**
   - **Reason**: Provides message ordering and exactly-once delivery guarantees
   - **Benefit**: Prevents duplicate email processing (following james-project reliability patterns)
   - **Ingestion Source**: **None/Default** (Gmail API publishes directly to topic)
   - **Action**: Check this option, but **do NOT select an ingestion source** - Gmail API publishes directly

#### 4. **Enable Message Retention** - ✅ **YES (Recommended)**
   - **Reason**: Keeps messages available for 7 days even if webhook is temporarily down
   - **Benefit**: Ensures no emails are lost during outages (following james-project message queue patterns)
   - **Retention Period**: 7 days (604,800 seconds)
   - **Action**: Check this option, set to 7 days

#### 5. **Export Message data to Big Query** - ⚠️ **OPTIONAL**
   - **Reason**: Useful for analytics and debugging, but not required for functionality
   - **Benefit**: Can analyze email delivery patterns, webhook performance
   - **Action**: Check if you want analytics, skip if not needed

#### 6. **Backup Message data to Cloud Storage** - ⚠️ **OPTIONAL**
   - **Reason**: Provides long-term backup of notifications, but not required
   - **Benefit**: Can recover from data loss, audit trail
   - **Bucket Name**: If enabled, specify your bucket (e.g., `gmail-notifications2`)
   - **Action**: Check if you want backup/audit, skip if not needed
   - **Note**: See `docs/GMAIL_CLOUD_STORAGE_BACKUP_SETUP.md` for detailed setup

## Recommended Configuration Summary

**Minimum Required:**
- ✅ Enable Message Retention (7 days)
- ✅ Enable ingestion (for exactly-once delivery)

**Optional but Recommended:**
- ✅ Export to BigQuery (for analytics)
- ✅ Backup to Cloud Storage (for audit/recovery)

**Skip:**
- ❌ Default subscription (create push subscription manually)
- ❌ Schema (not needed for Gmail Watch)

---

## Step-by-Step Topic Creation

### Step 1: Create Topic

1. Go to **Pub/Sub** → **Topics** → **Create Topic**
2. Enter **Topic ID**: `gmail-notifications`
3. **Enable ingestion**: ✅ Check
4. **Enable Message Retention**: ✅ Check
   - Set retention to: **7 days** (604,800 seconds)
5. **Export to BigQuery**: ⚠️ Optional (check if you want analytics)
6. **Backup to Cloud Storage**: ⚠️ Optional (check if you want backup)
7. Click **"Create"**

### Step 2: Create Push Subscription

After creating the topic, create the push subscription:

1. In the topic, click **"Create Subscription"**
2. Enter **Subscription ID**: `gmail-webhook-subscription`
3. Select **Delivery type**: **Push**
4. Enter **Endpoint URL**: `https://YOUR_DOMAIN.com/api/webhooks/gmail`
   - Replace `YOUR_DOMAIN.com` with your actual domain
5. **Acknowledgment deadline**: 60 seconds
6. **Message retention duration**: 7 days
7. **Retry policy**: 
   - **Minimum backoff**: 10 seconds
   - **Maximum backoff**: 600 seconds (10 minutes)
8. **Dead letter topic**: Create one (see Step 3)
9. **Maximum delivery attempts**: 5
10. Click **"Create"**

### Step 3: Create Dead Letter Topic (Recommended)

For handling failed messages:

1. Create a new topic: `gmail-notifications-dlq` (dead letter queue)
2. No special configuration needed
3. Use this topic in subscription's "Dead letter topic" setting

### Step 4: Configure Subscription Retry Policy

In the subscription settings:

1. **Minimum backoff**: 10 seconds
2. **Maximum backoff**: 600 seconds (10 minutes)
3. **Maximum delivery attempts**: 5
   - After 5 failures, message goes to dead letter topic

### Step 5: Add Verification Token (Optional but Recommended)

1. In subscription settings, go to **"Push configuration"**
2. Add **Attribute**:
   - **Key**: `x-verification-token`
   - **Value**: Your `GMAIL_PUBSUB_VERIFICATION_TOKEN` value
3. This token will be sent as a header to your webhook

---

## Configuration Rationale

### Why Enable Ingestion?

Following james-project message queue patterns:
- **Exactly-once delivery**: Prevents duplicate email processing
- **Message ordering**: Ensures emails are processed in order
- **Reliability**: Reduces chance of lost messages

### Why Enable Message Retention?

Following james-project message queue retention patterns:
- **Outage resilience**: Messages available for 7 days if webhook is down
- **Recovery**: Can replay messages if needed
- **Debugging**: Can inspect messages that failed processing

### Why Manual Push Subscription?

- **Control**: Can configure exact webhook endpoint URL
- **Flexibility**: Can add custom headers (verification token)
- **Configuration**: Can set retry policies and dead letter queue

### Why Dead Letter Topic?

Following james-project error recovery patterns:
- **Failed message handling**: Captures messages that fail after max retries
- **Debugging**: Can inspect why messages failed
- **Recovery**: Can manually reprocess failed messages

---

## Environment Variables

After configuration, ensure these are set:

```bash
# Required
GMAIL_PUBSUB_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications

# Optional but recommended
GMAIL_PUBSUB_VERIFICATION_TOKEN=your-secure-token-here

# For dead letter queue monitoring (optional)
GMAIL_PUBSUB_DLQ_TOPIC_NAME=projects/YOUR_PROJECT_ID/topics/gmail-notifications-dlq
```

---

## Monitoring and Alerting

### Set Up Alerts

1. **Dead Letter Queue Messages**:
   - Alert when messages appear in DLQ
   - Indicates webhook failures

2. **Subscription Backlog**:
   - Alert when unacknowledged messages > 100
   - Indicates webhook is slow or failing

3. **Message Age**:
   - Alert when oldest unacknowledged message > 1 hour
   - Indicates webhook is not processing

### Monitoring Queries

**Check subscription health:**
```sql
-- In BigQuery (if enabled)
SELECT 
  subscription_name,
  COUNT(*) as unacknowledged_messages,
  MAX(publish_time) as oldest_message
FROM `pubsub.subscription_stats`
WHERE subscription_name = 'gmail-webhook-subscription'
GROUP BY subscription_name;
```

**Check dead letter queue:**
```bash
# Using gcloud CLI
gcloud pubsub topics list-subscriptions gmail-notifications-dlq
```

---

## Testing Configuration

### Test 1: Verify Topic Creation

```bash
gcloud pubsub topics describe gmail-notifications
```

Should show:
- `messageRetentionDuration: 604800s` (7 days)
- `ingestionDataSourceSettings` enabled

### Test 2: Verify Subscription

```bash
gcloud pubsub subscriptions describe gmail-webhook-subscription
```

Should show:
- `pushConfig.endpoint` pointing to your webhook
- `ackDeadlineSeconds: 60`
- `messageRetentionDuration: 604800s`

### Test 3: Test Message Delivery

1. Send test email to connected Gmail account
2. Check Pub/Sub metrics for message delivery
3. Verify webhook receives notification
4. Check application logs for processing

### Test 4: Test Dead Letter Queue

1. Temporarily break webhook endpoint (return 500 error)
2. Wait for max delivery attempts (5)
3. Verify message appears in dead letter topic
4. Fix webhook and verify normal processing resumes

---

## Troubleshooting

### Issue: Messages Not Delivered

**Check:**
1. Subscription is active (not paused)
2. Push endpoint is publicly accessible
3. Endpoint returns 200 OK within acknowledgment deadline
4. No firewall blocking Pub/Sub IPs

### Issue: Duplicate Messages

**Solution:**
- Ensure "Enable ingestion" is checked
- Implement idempotency in webhook handler
- Check `provider_message_id` before processing

### Issue: Messages Lost

**Solution:**
- Ensure message retention is enabled (7 days)
- Check dead letter queue for failed messages
- Monitor subscription backlog

### Issue: High Backlog

**Solution:**
- Check webhook endpoint performance
- Increase acknowledgment deadline if needed
- Scale webhook endpoint if necessary

---

## Best Practices

1. ✅ **Always enable message retention** (7 days minimum)
2. ✅ **Enable ingestion** for exactly-once delivery
3. ✅ **Use dead letter queue** for failed message handling
4. ✅ **Set appropriate retry policy** (10s min, 10min max)
5. ✅ **Monitor subscription metrics** regularly
6. ✅ **Use verification token** in production
7. ✅ **Test webhook endpoint** before going live
8. ✅ **Set up alerts** for DLQ and backlog

---

## Configuration Checklist

- [ ] Topic created with ID: `gmail-notifications`
- [ ] Ingestion enabled ✅
- [ ] Message retention enabled (7 days) ✅
- [ ] Push subscription created: `gmail-webhook-subscription`
- [ ] Subscription endpoint: `https://your-domain.com/api/webhooks/gmail`
- [ ] Acknowledgment deadline: 60 seconds
- [ ] Retry policy configured (10s-10min)
- [ ] Dead letter topic created (optional but recommended)
- [ ] Verification token configured (optional but recommended)
- [ ] Environment variables set
- [ ] Monitoring alerts configured
- [ ] Test message delivery successful

---

## References

- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Gmail Watch API](https://developers.google.com/gmail/api/guides/push)
- [james-project Message Queue Patterns](https://github.com/apache/james-project)
- [Exactly-Once Delivery](https://cloud.google.com/pubsub/docs/exactly-once-delivery)

---

**Last Updated**: 2024-01-01
**Version**: 1.0

