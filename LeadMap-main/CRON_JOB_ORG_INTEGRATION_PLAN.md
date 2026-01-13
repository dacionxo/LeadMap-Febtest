# Cron-Job.org Integration Plan

## Overview

This document outlines the comprehensive plan to integrate cron-job.org (external HTTP scheduler) with LeadMap's cron endpoints to ensure reliable, scheduled task execution.

## Goals

1. **Reliability**: Ensure all cron jobs trigger reliably using external HTTP scheduler
2. **Security**: Maintain strict authentication for all cron endpoints
3. **Idempotency**: Make all cron handlers safe to call multiple times
4. **Monitoring**: Add comprehensive logging and error tracking
5. **Documentation**: Provide clear setup instructions for cron-job.org

## Current State Analysis

### Existing Cron Endpoints

Based on `CRON_JOBS_INDEX.md`, we have **13 cron jobs**:

1. `/api/cron/process-email-queue` - Every minute
2. `/api/cron/process-campaigns` - Every minute
3. `/api/cron/process-emails` - Every minute
4. `/api/cron/gmail-watch-renewal` - Daily at 3 AM
5. `/api/cron/sync-mailboxes` - Every 5 minutes
6. `/api/calendar/cron/sync` - Every 15 minutes
7. `/api/calendar/cron/token-refresh` - Hourly
8. `/api/calendar/cron/webhook-renewal` - Daily
9. `/api/calendar/cron/sync-retry` - Every 30 minutes
10. `/api/calendar/cron/cleanup` - Daily
11. `/api/cron/property-map-refresh` - Every 6 hours
12. `/api/cron/prospect-enrich` - Every 4 hours
13. `/api/cron/provider-health-check` - Hourly
14. `/api/sms/drip/run` - Every minute (SMS drip campaigns)

### Authentication Status

✅ **Good**: Most endpoints use `verifyCronRequestOrError()` from `lib/cron/auth.ts`
❌ **Needs Fix**: `/api/sms/drip/run` uses custom `x-cron-secret` check instead of centralized auth

### Current Auth Methods Supported

- `x-vercel-cron-secret` header (for Vercel cron)
- `x-service-key` header
- `Authorization: Bearer <CRON_SECRET>` or `Authorization: Bearer <CALENDAR_SERVICE_KEY>`

## Implementation Plan

### Phase 1: Authentication Standardization ✅

**Goal**: Ensure all cron endpoints use the same authentication method

**Tasks**:
1. ✅ Update `/api/sms/drip/run` to use `verifyCronRequestOrError()`
2. ✅ Verify all endpoints support `Authorization: Bearer` header (for cron-job.org)
3. ✅ Test authentication with various header formats

### Phase 2: Idempotency & Reliability ✅

**Goal**: Make all cron handlers safe to call multiple times

**Tasks**:
1. ✅ Review each endpoint for idempotency
2. ✅ Add idempotency keys where needed (using timestamps or request IDs)
3. ✅ Ensure database operations are safe for duplicate calls
4. ✅ Add request deduplication logic if needed

### Phase 3: Response Standardization ✅

**Goal**: Standardize all cron endpoint responses for better monitoring

**Tasks**:
1. ✅ Use `createSuccessResponse()`, `createNoDataResponse()`, `createBatchResponse()` from `lib/cron/responses.ts`
2. ✅ Include execution time, processed counts, and error details
3. ✅ Return consistent JSON structure: `{ success: true, data: {...}, message: "...", duration: 123 }`

### Phase 4: Logging & Monitoring ✅

**Goal**: Add comprehensive logging for debugging and monitoring

**Tasks**:
1. ✅ Add structured logging to all cron endpoints
2. ✅ Log execution time, success/failure counts, and errors
3. ✅ Include request metadata (headers, IP, timestamp)
4. ✅ Create monitoring dashboard or log aggregation

### Phase 5: Cron-Job.org Configuration ✅

**Goal**: Configure cron-job.org to trigger all endpoints

**Tasks**:
1. ✅ Document all endpoint URLs and schedules
2. ✅ Create cron-job.org job configurations
3. ✅ Test each endpoint with cron-job.org
4. ✅ Set up monitoring and alerts

## Cron-Job.org Setup Instructions

### Prerequisites

1. **Account**: Sign up at https://cron-job.org (or self-host)
2. **Environment Variables**: Ensure `CRON_SECRET` is set in your environment
3. **Public URL**: Your Next.js app must be publicly accessible

### Configuration Template

For each cron job, create a job in cron-job.org with:

**Method**: `POST` (or `GET` if endpoint supports both)

**URL**: `https://www.growyourdigitalleverage.com/api/cron/endpoint-name`

**Headers**:
```
Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi
Content-Type: application/json
```

**Schedule**: Use cron expression (e.g., `* * * * *` for every minute)

### Job Configurations

#### 1. Process Email Queue
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/process-email-queue`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 2. Process Campaigns
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/process-campaigns`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 3. Process Emails
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/process-emails`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 4. Gmail Watch Renewal
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/gmail-watch-renewal`
- **Method**: `POST`
- **Schedule**: `0 3 * * *` (daily at 3 AM UTC)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 5. Sync Mailboxes
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/sync-mailboxes`
- **Method**: `POST`
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 6. Calendar Sync
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/sync`
- **Method**: `POST`
- **Schedule**: `*/15 * * * *` (every 15 minutes)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 7. Calendar Token Refresh
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/token-refresh`
- **Method**: `POST`
- **Schedule**: `0 * * * *` (hourly)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 8. Calendar Webhook Renewal
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/webhook-renewal`
- **Method**: `POST`
- **Schedule**: `0 3 * * *` (daily at 3 AM UTC)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 9. Calendar Sync Retry
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/sync-retry`
- **Method**: `POST`
- **Schedule**: `*/30 * * * *` (every 30 minutes)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 10. Calendar Cleanup
- **URL**: `https://www.growyourdigitalleverage.com/api/calendar/cron/cleanup`
- **Method**: `POST`
- **Schedule**: `0 2 * * *` (daily at 2 AM UTC)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 11. Property Map Refresh
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/property-map-refresh`
- **Method**: `POST`
- **Schedule**: `0 */6 * * *` (every 6 hours)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 12. Prospect Enrich
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/prospect-enrich`
- **Method**: `POST`
- **Schedule**: `0 */4 * * *` (every 4 hours)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 13. Provider Health Check
- **URL**: `https://www.growyourdigitalleverage.com/api/cron/provider-health-check`
- **Method**: `POST`
- **Schedule**: `0 * * * *` (hourly)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

#### 14. SMS Drip Run
- **URL**: `https://www.growyourdigitalleverage.com/api/sms/drip/run`
- **Method**: `POST`
- **Schedule**: `* * * * *` (every minute)
- **Headers**: `Authorization: Bearer gy60xlYaTb9RAUd4oZN8WcHL2IQXDqFi`

## Testing Checklist

### Manual Testing

- [ ] Test each endpoint with `curl` using `Authorization: Bearer` header
- [ ] Verify 401 response when authentication fails
- [ ] Verify 200 response with proper JSON when authenticated
- [ ] Test idempotency by calling same endpoint twice
- [ ] Check logs for proper execution tracking

### Cron-Job.org Testing

- [ ] Create test job in cron-job.org
- [ ] Verify job triggers successfully
- [ ] Check response logs in cron-job.org dashboard
- [ ] Monitor Next.js logs for incoming requests
- [ ] Verify job execution completes successfully

## Security Considerations

1. **Secret Management**: Never commit `CRON_SECRET` to version control
2. **HTTPS Only**: Always use HTTPS for cron-job.org URLs
3. **Rate Limiting**: Consider adding rate limiting to prevent abuse
4. **IP Whitelisting**: Optionally whitelist cron-job.org IPs (if using hosted service)
5. **Request Validation**: Validate request structure and reject malformed requests

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Execution Success Rate**: Track % of successful vs failed executions
2. **Execution Time**: Monitor average execution duration
3. **Error Rate**: Track error frequency and types
4. **Missed Executions**: Alert if cron job doesn't trigger

### Recommended Tools

- **Vercel Logs**: Use Vercel's built-in logging for Next.js
- **Sentry**: Error tracking and alerting
- **Cron-Job.org Dashboard**: Monitor job execution history
- **Custom Dashboard**: Build internal monitoring dashboard

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check `CRON_SECRET` matches in both places
2. **Timeout**: Increase timeout in cron-job.org settings
3. **Missing Executions**: Check cron-job.org job status and logs
4. **Duplicate Executions**: Verify idempotency logic is working

### Debug Steps

1. Check cron-job.org execution logs
2. Review Next.js function logs in Vercel
3. Test endpoint manually with `curl`
4. Verify environment variables are set correctly
5. Check network connectivity between cron-job.org and your app

## Migration Strategy

### Step 1: Parallel Running
- Keep Vercel cron jobs active
- Add cron-job.org jobs
- Monitor both for consistency

### Step 2: Verification
- Compare execution logs
- Verify data consistency
- Check for any missed executions

### Step 3: Cutover
- Disable Vercel cron jobs
- Rely solely on cron-job.org
- Monitor closely for first 24-48 hours

## Next Steps

1. ✅ Complete authentication standardization
2. ✅ Verify idempotency of all endpoints
3. ✅ Test all endpoints manually
4. ✅ Set up cron-job.org account
5. ✅ Configure all jobs in cron-job.org
6. ✅ Monitor and verify execution
7. ✅ Document any issues and resolutions

## References

- [Cron-Job.org Documentation](https://github.com/pschlan/cron-job.org)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [CRON_JOBS_INDEX.md](./CRON_JOBS_INDEX.md)
- [lib/cron/auth.ts](./lib/cron/auth.ts)

