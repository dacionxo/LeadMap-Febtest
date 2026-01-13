# Cron-Job.org Setup Guide for LeadMap

This guide provides step-by-step instructions for configuring cron-job.org to reliably trigger all LeadMap cron endpoints.

## Prerequisites

1. **Public URL**: Your Next.js app must be publicly accessible (e.g., deployed on Vercel)
2. **Environment Variable**: `CRON_SECRET` must be set in your environment
3. **Cron-Job.org Account**: Sign up at https://cron-job.org (or use self-hosted instance)

## Step 1: Configure CRON_SECRET

Your `CRON_SECRET` is: `gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

**Important**: Set this in your environment:

1. **Vercel**: 
   - Go to Settings → Environment Variables
   - Add `CRON_SECRET` with value: `gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
   - Apply to all environments (Production, Preview, Development)

2. **Local Development**: 
   - Add to `.env.local`:
   ```env
   CRON_SECRET=gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi
   ```

## Step 2: Verify Endpoint Authentication

Test that your endpoints accept the `Authorization: Bearer` header:

```bash
# Test endpoint with your domain and CRON_SECRET
curl -X POST https://www.growyourdigitalleverage.com/api/cron/process-emails \
  -H "Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi" \
  -H "Content-Type: application/json"
```

You should receive a `200 OK` response with JSON data. If you get `401 Unauthorized`, check that:
- `CRON_SECRET` is set correctly
- The header value matches exactly (no extra spaces)

## Step 3: Create Jobs in Cron-Job.org

For each cron job below, follow these steps:

1. Log in to cron-job.org
2. Click "Create Cronjob" or "New Job"
3. Fill in the configuration (see details below)
4. Save and activate the job

### Job Configuration Template

**Basic Settings:**
- **Title**: Descriptive name (e.g., "Process Emails - Every Minute")
- **URL**: `https://yourdomain.com/api/cron/endpoint-name`
- **Request Method**: `POST` (or `GET` if endpoint supports both)
- **Schedule**: Cron expression (see individual jobs below)

**Headers:**
Add a custom header:
- **Name**: `Authorization`
- **Value**: `Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

**Advanced Settings:**
- **Timeout**: 300 seconds (5 minutes) - adjust based on endpoint
- **Retry on Failure**: Enable (recommended: 2-3 retries)
- **Expected Status Code**: 200

## Complete Job List

### 1. Process Email Queue
- **Title**: `LeadMap - Process Email Queue`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/process-email-queue`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 2. Process Campaigns
- **Title**: `LeadMap - Process Campaigns`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/process-campaigns`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 3. Process Emails
- **Title**: `LeadMap - Process Emails`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/process-emails`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 4. Gmail Watch Renewal
- **Title**: `LeadMap - Gmail Watch Renewal`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/gmail-watch-renewal`
- **Method**: `POST`
- **Schedule**: `0 3 * * *` (daily at 3 AM UTC)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 600 seconds (10 minutes)

### 5. Sync Mailboxes
- **Title**: `LeadMap - Sync Mailboxes`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/sync-mailboxes`
- **Method**: `POST`
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 6. Calendar Sync
- **Title**: `LeadMap - Calendar Sync`
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/sync`
- **Method**: `POST`
- **Schedule**: `*/15 * * * *` (every 15 minutes)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 7. Calendar Token Refresh
- **Title**: `LeadMap - Calendar Token Refresh`
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/token-refresh`
- **Method**: `POST`
- **Schedule**: `0 * * * *` (hourly at minute 0)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 8. Calendar Webhook Renewal
- **Title**: `LeadMap - Calendar Webhook Renewal`
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/webhook-renewal`
- **Method**: `POST`
- **Schedule**: `0 3 * * *` (daily at 3 AM UTC)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 600 seconds

### 9. Calendar Sync Retry
- **Title**: `LeadMap - Calendar Sync Retry`
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/sync-retry`
- **Method**: `POST`
- **Schedule**: `*/30 * * * *` (every 30 minutes)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 10. Calendar Cleanup
- **Title**: `LeadMap - Calendar Cleanup`
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/cleanup`
- **Method**: `POST`
- **Schedule**: `0 2 * * *` (daily at 2 AM UTC)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 600 seconds

### 11. Property Map Refresh
- **Title**: `LeadMap - Property Map Refresh`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/property-map-refresh`
- **Method**: `POST`
- **Schedule**: `0 */6 * * *` (every 6 hours)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 600 seconds

### 12. Prospect Enrich
- **Title**: `LeadMap - Prospect Enrich`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/prospect-enrich`
- **Method**: `POST`
- **Schedule**: `0 */4 * * *` (every 4 hours)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 600 seconds

### 13. Provider Health Check
- **Title**: `LeadMap - Provider Health Check`
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/provider-health-check`
- **Method**: `POST`
- **Schedule**: `0 * * * *` (hourly at minute 0)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

### 14. SMS Drip Run
- **Title**: `LeadMap - SMS Drip Run`
- **URL**: `https://www.growyourdigitalleverage.com/api/sms/drip/run`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
- **Timeout**: 300 seconds

## Step 4: Test Each Job

After creating each job:

1. **Manual Test**: Click "Run Now" or "Test" button in cron-job.org
2. **Check Response**: Verify you get a `200 OK` response
3. **Check Logs**: Review execution logs in cron-job.org dashboard
4. **Verify Execution**: Check your Next.js logs to confirm the endpoint was called

## Step 5: Monitor and Verify

### Daily Checks (First Week)

1. **Execution Logs**: Check cron-job.org dashboard daily
2. **Success Rate**: Should be 100% (or near 100%)
3. **Response Times**: Monitor for any slow executions
4. **Error Logs**: Review any failed executions

### What to Look For

✅ **Good Signs:**
- All jobs executing on schedule
- `200 OK` responses
- No authentication errors
- Consistent execution times

❌ **Warning Signs:**
- `401 Unauthorized` errors (check `CRON_SECRET`)
- `500 Internal Server Error` (check Next.js logs)
- Timeouts (may need to increase timeout setting)
- Missing executions (check cron-job.org status)

## Troubleshooting

### Issue: 401 Unauthorized

**Cause**: Authentication header mismatch

**Solution**:
1. Verify `CRON_SECRET` in your environment matches the header value
2. Check for extra spaces in the header value
3. Ensure header format is exactly: `Bearer <secret>` (with space)

### Issue: Timeout Errors

**Cause**: Endpoint taking too long to execute

**Solution**:
1. Increase timeout in cron-job.org settings (up to 600 seconds)
2. Check Next.js function logs for slow operations
3. Consider optimizing the endpoint code

### Issue: Missing Executions

**Cause**: Cron job not triggering

**Solution**:
1. Verify job is active in cron-job.org
2. Check cron expression is correct
3. Review cron-job.org execution history
4. Check for any account limits or restrictions

### Issue: Duplicate Executions

**Cause**: Multiple cron services running simultaneously

**Solution**:
1. Disable Vercel cron jobs if using cron-job.org
2. Verify only one cron service is active
3. Check idempotency logic in endpoints (should be safe)

## Migration from Vercel Cron

If you're currently using Vercel cron jobs:

1. **Phase 1 - Parallel Running** (Week 1):
   - Keep Vercel cron jobs active
   - Add cron-job.org jobs
   - Monitor both for consistency

2. **Phase 2 - Verification** (Week 2):
   - Compare execution logs
   - Verify data consistency
   - Check for any missed executions

3. **Phase 3 - Cutover** (Week 3):
   - Disable Vercel cron jobs in `vercel.json`
   - Rely solely on cron-job.org
   - Monitor closely for 24-48 hours

## Security Best Practices

1. **Never commit `CRON_SECRET`** to version control
2. **Use HTTPS only** for all cron-job.org URLs
3. **Rotate secrets periodically** (every 90 days recommended)
4. **Monitor access logs** for unauthorized attempts
5. **Use different secrets** for development and production

## Cron Expression Reference

Common cron expressions used in this guide:

- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour (at minute 0)
- `0 */4 * * *` - Every 4 hours
- `0 */6 * * *` - Every 6 hours
- `0 2 * * *` - Daily at 2 AM UTC
- `0 3 * * *` - Daily at 3 AM UTC

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review cron-job.org documentation
3. Check Next.js function logs in Vercel
4. Review `CRON_JOB_ORG_INTEGRATION_PLAN.md` for detailed architecture

## Next Steps

After setup:

1. ✅ Monitor all jobs for first week
2. ✅ Set up alerts for failed executions (if available)
3. ✅ Document any custom configurations
4. ✅ Review and optimize schedules if needed
5. ✅ Consider adding health check endpoint monitoring

