# Vercel Cron Jobs Setup Guide

This guide explains how Vercel cron jobs are configured for LeadMap and how to verify they're working correctly.

## Overview

All cron jobs are configured in `vercel.json` and automatically executed by Vercel's cron service. Vercel automatically sets the `x-vercel-cron-secret` header with the value from your `CRON_SECRET` environment variable.

## Configuration

All 14 cron jobs are configured in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    // ... all cron jobs listed here
  ]
}
```

## All Configured Cron Jobs

### Email & Campaign Jobs (Every Minute)

1. **Process Email Queue**
   - Path: `/api/cron/process-email-queue`
   - Schedule: `* * * * *` (every minute)
   - Purpose: Processes queued emails in the background

2. **Process Campaigns**
   - Path: `/api/cron/process-campaigns`
   - Schedule: `* * * * *` (every minute)
   - Purpose: Processes email campaigns and schedules emails

3. **Process Emails**
   - Path: `/api/cron/process-emails`
   - Schedule: `* * * * *` (every minute)
   - Purpose: Sends scheduled emails from campaigns

4. **SMS Drip Run**
   - Path: `/api/sms/drip/run`
   - Schedule: `* * * * *` (every minute)
   - Purpose: Processes SMS drip campaign enrollments

### Email Maintenance Jobs

5. **Sync Mailboxes**
   - Path: `/api/cron/sync-mailboxes`
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Purpose: Syncs all active mailboxes to ingest new emails

6. **Gmail Watch Renewal**
   - Path: `/api/cron/gmail-watch-renewal`
   - Schedule: `0 3 * * *` (daily at 3 AM UTC)
   - Purpose: Renews Gmail Watch subscriptions (expire after 7 days)

### Calendar Jobs

7. **Calendar Sync**
   - Path: `/api/calendar/cron/sync`
   - Schedule: `*/15 * * * *` (every 15 minutes)
   - Purpose: Syncs Google Calendar events

8. **Calendar Token Refresh**
   - Path: `/api/calendar/cron/token-refresh`
   - Schedule: `0 * * * *` (hourly)
   - Purpose: Refreshes OAuth tokens for calendar connections

9. **Calendar Webhook Renewal**
   - Path: `/api/calendar/cron/webhook-renewal`
   - Schedule: `0 3 * * *` (daily at 3 AM UTC)
   - Purpose: Renews Google Calendar webhook subscriptions

10. **Calendar Sync Retry**
    - Path: `/api/calendar/cron/sync-retry`
    - Schedule: `*/30 * * * *` (every 30 minutes)
    - Purpose: Retries failed calendar syncs

11. **Calendar Cleanup**
    - Path: `/api/calendar/cron/cleanup`
    - Schedule: `0 2 * * *` (daily at 2 AM UTC)
    - Purpose: Cleans up old calendar data

### Data & Monitoring Jobs

12. **Property Map Refresh**
    - Path: `/api/cron/property-map-refresh`
    - Schedule: `0 */6 * * *` (every 6 hours)
    - Purpose: Refreshes property map data

13. **Prospect Enrich**
    - Path: `/api/cron/prospect-enrich`
    - Schedule: `0 */4 * * *` (every 4 hours)
    - Purpose: Enriches prospect data

14. **Provider Health Check**
    - Path: `/api/cron/provider-health-check`
    - Schedule: `0 * * * *` (hourly)
    - Purpose: Checks health of email providers

## Required Environment Variable

### CRON_SECRET

**Purpose**: Authenticates cron job requests from Vercel

**How to Set**:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add `CRON_SECRET` with value: `gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`
5. Apply to all environments (Production, Preview, Development)

**Important**: 
- Vercel automatically sets `x-vercel-cron-secret` header with this value
- Your endpoints verify this header matches `CRON_SECRET`
- Never commit this value to version control

## How Vercel Cron Works

1. **Automatic Execution**: Vercel's cron service triggers jobs based on schedule
2. **Header Injection**: Vercel automatically adds `x-vercel-cron-secret` header
3. **Authentication**: Your endpoints verify the header matches `CRON_SECRET`
4. **Logging**: All executions are logged in Vercel dashboard

## Verifying Cron Jobs

### Step 1: Check Vercel Dashboard

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on **"Cron Jobs"** tab
3. You should see all 14 cron jobs listed
4. Check execution history and status

### Step 2: Check Execution Logs

1. Go to **Deployments** → Select latest deployment
2. Click on **"Functions"** tab
3. Find your cron endpoint (e.g., `/api/cron/process-emails`)
4. Click to view execution logs
5. Verify executions are happening on schedule

### Step 3: Manual Testing

Test any endpoint manually to verify authentication:

```bash
# Test with your CRON_SECRET
curl -X POST https://www.growyourdigitalleverage.com/api/cron/process-emails \
  -H "Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "data": { ... },
  "message": "...",
  "duration": 1234
}
```

## Cron Schedule Reference

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `*/15 * * * *` | Every 15 minutes |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour (at minute 0) |
| `0 */4 * * *` | Every 4 hours |
| `0 */6 * * *` | Every 6 hours |
| `0 2 * * *` | Daily at 2 AM UTC |
| `0 3 * * *` | Daily at 3 AM UTC |

## Troubleshooting

### Issue: Cron Jobs Not Executing

**Possible Causes**:
1. `CRON_SECRET` not set in Vercel environment variables
2. Cron jobs not visible in Vercel dashboard
3. Deployment not completed

**Solutions**:
1. Verify `CRON_SECRET` is set in Vercel dashboard
2. Check that `vercel.json` is committed and deployed
3. Redeploy your application after adding/updating cron jobs
4. Check Vercel dashboard → Cron Jobs tab for status

### Issue: 401 Unauthorized Errors

**Possible Causes**:
1. `CRON_SECRET` mismatch between Vercel and your code
2. Environment variable not set correctly
3. Header verification failing

**Solutions**:
1. Verify `CRON_SECRET` value matches in Vercel dashboard
2. Check that environment variable is set for correct environment
3. Redeploy after changing environment variables
4. Test endpoint manually with correct header

### Issue: Timeout Errors

**Possible Causes**:
1. Cron job taking too long to execute
2. Vercel function timeout limit exceeded

**Solutions**:
1. Check execution logs for slow operations
2. Optimize cron job code for faster execution
3. Consider breaking large jobs into smaller batches
4. Increase timeout in Vercel settings (if available)

### Issue: Missing Executions

**Possible Causes**:
1. Cron schedule incorrectly configured
2. Vercel cron service issues
3. Deployment issues

**Solutions**:
1. Verify cron expression is correct in `vercel.json`
2. Check Vercel status page for service issues
3. Review execution logs in Vercel dashboard
4. Test endpoint manually to verify it works

## Monitoring

### Vercel Dashboard

- **Cron Jobs Tab**: View all configured cron jobs and their status
- **Execution History**: See when each job last ran
- **Function Logs**: View detailed execution logs for each run

### Key Metrics to Monitor

1. **Execution Success Rate**: Should be near 100%
2. **Execution Time**: Monitor for performance issues
3. **Error Rate**: Track and investigate failures
4. **Missed Executions**: Alert if jobs don't run on schedule

## Best Practices

1. **Idempotency**: All cron jobs are designed to be safe to run multiple times
2. **Error Handling**: Comprehensive error handling prevents one failure from stopping the job
3. **Logging**: All jobs log execution details for debugging
4. **Batch Processing**: Jobs process items in batches to avoid timeouts
5. **Rate Limiting**: Jobs respect rate limits for external APIs

## Security

1. **Never commit `CRON_SECRET`** to version control
2. **Use HTTPS only** for all endpoints
3. **Verify authentication** in all cron endpoints
4. **Monitor access logs** for unauthorized attempts
5. **Rotate secrets** periodically (every 90 days recommended)

## Next Steps

1. ✅ Verify all cron jobs are listed in Vercel dashboard
2. ✅ Check execution logs for successful runs
3. ✅ Monitor for any errors or timeouts
4. ✅ Set up alerts for failed executions (if available)
5. ✅ Review and optimize schedules if needed

## References

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [CRON_JOBS_INDEX.md](./CRON_JOBS_INDEX.md) - Complete list of all cron jobs
- [lib/cron/auth.ts](./lib/cron/auth.ts) - Authentication utility

