# Vercel Cron Jobs - Symphony Messenger

## Overview

This document describes the Symphony Messenger cron jobs configured in `vercel.json`.

## Symphony Worker Cron

**Path**: `/api/cron/symphony-worker`  
**Schedule**: `* * * * *` (Every minute)  
**Purpose**: Process messages from Symphony Messenger queue

### Features

- Message polling from transports
- Handler execution with middleware
- Batch processing with concurrency limits
- Error handling and retry logic
- Graceful shutdown
- Health monitoring

### Configuration

- **Max Duration**: 60 seconds (Vercel limit)
- **Authentication**: Vercel cron secret or service key
- **Batch Size**: Configurable via `SYMPHONY_WORKER_BATCH_SIZE` (default: 10)
- **Max Concurrency**: Configurable via `SYMPHONY_WORKER_MAX_CONCURRENCY` (default: 5)

### Environment Variables

- `SYMPHONY_WORKER_BATCH_SIZE` - Batch size (default: 10)
- `SYMPHONY_WORKER_MAX_CONCURRENCY` - Max concurrency (default: 5)
- `SYMPHONY_WORKER_POLL_INTERVAL` - Poll interval in ms (default: 1000)
- `SYMPHONY_WORKER_MESSAGE_LIMIT` - Max messages per run (optional)
- `SYMPHONY_WORKER_TIME_LIMIT` - Max time per run in ms (default: 50000)
- `SYMPHONY_WORKER_MEMORY_LIMIT` - Max memory in bytes (optional)
- `SYMPHONY_WORKER_FAILURE_LIMIT` - Max failures before stop (optional)

## Symphony Scheduler Cron

**Path**: `/api/cron/symphony-scheduler`  
**Schedule**: `* * * * *` (Every minute)  
**Purpose**: Process scheduled messages that are due

### Features

- Cron-based scheduling
- Interval-based scheduling
- One-time scheduled messages
- Recurring message support
- Timezone-aware scheduling

### Configuration

- **Max Duration**: 60 seconds (Vercel limit)
- **Authentication**: Vercel cron secret or service key
- **Batch Size**: Processes all due schedules per run

## Authentication

Both cron jobs use the existing cron authentication system:

- `verifyCronRequestOrError` from `@/lib/cron/auth`
- Supports Vercel cron secret
- Supports service key authentication
- Returns 401 if authentication fails

## Monitoring

### Health Checks

Monitor cron job health via:
- Vercel dashboard cron logs
- Symphony health API: `/api/symphony/health`
- Symphony metrics API: `/api/symphony/metrics`

### Logging

Both cron jobs log:
- Processing statistics
- Error details
- Performance metrics
- Health status

## Troubleshooting

### Cron Job Not Running

1. Check Vercel dashboard for cron job status
2. Verify authentication is working
3. Check environment variables are set
4. Review cron job logs in Vercel

### High Error Rate

1. Check Symphony health endpoint
2. Review failed messages: `/api/symphony/failed`
3. Check worker logs for errors
4. Verify handlers are registered

### Performance Issues

1. Adjust batch size and concurrency
2. Monitor queue depth
3. Check processing times
4. Review metrics endpoint

## Best Practices

1. **Monitor Regularly**: Check cron job logs and metrics
2. **Set Appropriate Limits**: Configure time and message limits
3. **Handle Errors**: Ensure proper error handling in handlers
4. **Scale Gradually**: Increase batch size as needed
5. **Use Feature Flags**: Control Symphony usage with feature flags


