# Cron Jobs Quick Reference

## Configuration

All cron jobs are configured in `vercel.json` and automatically executed by Vercel.

**CRON_SECRET**: `gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

## Quick Test Command

Test any cron endpoint:

```bash
curl -X POST https://www.growyourdigitalleverage.com/api/cron/endpoint-name \
  -H "Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi" \
  -H "Content-Type: application/json"
```

## Vercel Cron Jobs

All jobs are automatically triggered by Vercel. Check the **Cron Jobs** tab in your Vercel dashboard to view execution history.

## All Cron Endpoints

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/process-email-queue` | Every minute | Process queued emails |
| `/api/cron/process-campaigns` | Every minute | Process email campaigns |
| `/api/cron/process-emails` | Every minute | Send scheduled emails |
| `/api/cron/gmail-watch-renewal` | Daily 3 AM | Renew Gmail watch subscriptions |
| `/api/cron/sync-mailboxes` | Every 5 min | Sync mailbox emails |
| `/api/calendar/cron/sync` | Every 15 min | Sync Google Calendar |
| `/api/calendar/cron/token-refresh` | Hourly | Refresh OAuth tokens |
| `/api/calendar/cron/webhook-renewal` | Daily 3 AM | Renew webhook subscriptions |
| `/api/calendar/cron/sync-retry` | Every 30 min | Retry failed syncs |
| `/api/calendar/cron/cleanup` | Daily 2 AM | Cleanup old data |
| `/api/cron/property-map-refresh` | Every 6 hours | Refresh property maps |
| `/api/cron/prospect-enrich` | Every 4 hours | Enrich prospect data |
| `/api/cron/provider-health-check` | Hourly | Check provider health |
| `/api/sms/drip/run` | Every minute | Process SMS drip campaigns |

## Authentication

All endpoints accept:
- `Authorization: Bearer <CRON_SECRET>`
- `x-vercel-cron-secret: <CRON_SECRET>`
- `x-service-key: <CALENDAR_SERVICE_KEY>`

## Cron Expressions

- `* * * * *` = Every minute
- `*/5 * * * *` = Every 5 minutes
- `*/15 * * * *` = Every 15 minutes
- `*/30 * * * *` = Every 30 minutes
- `0 * * * *` = Every hour
- `0 */4 * * *` = Every 4 hours
- `0 */6 * * *` = Every 6 hours
- `0 2 * * *` = Daily at 2 AM UTC
- `0 3 * * *` = Daily at 3 AM UTC

## Response Format

All endpoints return:

```json
{
  "success": true,
  "data": { ... },
  "message": "Description",
  "duration": 1234,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Documentation

- **Vercel Setup Guide**: `VERCEL_CRON_SETUP.md` ⭐ (Start here)
- **Full Index**: `CRON_JOBS_INDEX.md`
- **Improvements Summary**: `CRON_IMPROVEMENTS_SUMMARY.md`
- **Legacy (cron-job.org)**: `CRON_JOB_ORG_SETUP_GUIDE.md` (not used)

