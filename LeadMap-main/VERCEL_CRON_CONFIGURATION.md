# Vercel Cron Configuration Summary

## ✅ Configuration Complete

All 14 cron jobs have been configured in `vercel.json` for automatic execution by Vercel's cron service.

## Configuration Details

**File**: `vercel.json`
**Schema**: `https://openapi.vercel.sh/vercel.json`
**Total Jobs**: 14

## All Configured Jobs

| # | Job Name | Path | Schedule | Frequency |
|---|----------|------|----------|-----------|
| 1 | Process Email Queue | `/api/cron/process-email-queue` | `* * * * *` | Every minute |
| 2 | Process Campaigns | `/api/cron/process-campaigns` | `* * * * *` | Every minute |
| 3 | Process Emails | `/api/cron/process-emails` | `* * * * *` | Every minute |
| 4 | SMS Drip Run | `/api/sms/drip/run` | `* * * * *` | Every minute |
| 5 | Sync Mailboxes | `/api/cron/sync-mailboxes` | `*/5 * * * *` | Every 5 minutes |
| 6 | Calendar Sync | `/api/calendar/cron/sync` | `*/15 * * * *` | Every 15 minutes |
| 7 | Calendar Sync Retry | `/api/calendar/cron/sync-retry` | `*/30 * * * *` | Every 30 minutes |
| 8 | Calendar Token Refresh | `/api/calendar/cron/token-refresh` | `0 * * * *` | Hourly |
| 9 | Provider Health Check | `/api/cron/provider-health-check` | `0 * * * *` | Hourly |
| 10 | Prospect Enrich | `/api/cron/prospect-enrich` | `0 */4 * * *` | Every 4 hours |
| 11 | Property Map Refresh | `/api/cron/property-map-refresh` | `0 */6 * * *` | Every 6 hours |
| 12 | Calendar Cleanup | `/api/calendar/cron/cleanup` | `0 2 * * *` | Daily at 2 AM UTC |
| 13 | Gmail Watch Renewal | `/api/cron/gmail-watch-renewal` | `0 3 * * *` | Daily at 3 AM UTC |
| 14 | Calendar Webhook Renewal | `/api/calendar/cron/webhook-renewal` | `0 3 * * *` | Daily at 3 AM UTC |

## Environment Variable

**CRON_SECRET**: `gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

**Important**: 
- Set this in Vercel Dashboard → Settings → Environment Variables
- Vercel automatically injects `x-vercel-cron-secret` header with this value
- Your endpoints verify this header matches `CRON_SECRET`

## Next Steps

1. **Deploy to Vercel**: Commit and push `vercel.json` to trigger deployment
2. **Verify in Dashboard**: Check Vercel Dashboard → Cron Jobs tab
3. **Set Environment Variable**: Ensure `CRON_SECRET` is set in Vercel
4. **Monitor Executions**: Check execution logs in Vercel dashboard
5. **Test Manually**: Test endpoints with curl to verify authentication

## Verification Checklist

- [ ] `vercel.json` committed and pushed
- [ ] Deployment completed successfully
- [ ] `CRON_SECRET` set in Vercel environment variables
- [ ] All 14 jobs visible in Vercel Dashboard → Cron Jobs tab
- [ ] Execution logs showing successful runs
- [ ] Manual test with curl returns 200 OK

## Testing

Test any endpoint:

```bash
curl -X POST https://www.growyourdigitalleverage.com/api/cron/process-emails \
  -H "Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi" \
  -H "Content-Type: application/json"
```

## Documentation

- **Setup Guide**: `VERCEL_CRON_SETUP.md` - Complete setup and troubleshooting guide
- **Quick Reference**: `CRON_QUICK_REFERENCE.md` - Quick reference card
- **Full Index**: `CRON_JOBS_INDEX.md` - Detailed documentation of all jobs

