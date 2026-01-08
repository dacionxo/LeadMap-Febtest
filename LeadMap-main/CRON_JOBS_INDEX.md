# Cron Jobs Index

Comprehensive index of all cron jobs in the LeadMap application, including their routes, schedules, and purposes.

## Architecture Overview

All cron jobs have been rebuilt with a **world-class architecture** featuring:

- **Shared Utilities** (`lib/cron/`):
  - `auth.ts` - Centralized authentication with `verifyCronRequestOrError()`
  - `errors.ts` - Custom error classes and `handleCronError()` function
  - `responses.ts` - Standardized response builders
  - `database.ts` - Type-safe database operations with `executeSelectOperation()`, `executeUpdateOperation()`, `executeInsertOperation()`
  - `schemas.ts` - Shared Zod schemas (if needed)

- **Type Safety**:
  - Comprehensive TypeScript interfaces for all data structures
  - Zod schemas for runtime validation and type inference
  - Minimal `any` types (only for Supabase query builder casting)

- **Error Handling**:
  - Custom error classes (`ValidationError`, `DatabaseError`, `AuthenticationError`, etc.)
  - Centralized error handling with `handleCronError()`
  - User-friendly error messages
  - No sensitive data in error responses

- **Code Quality**:
  - Full JSDoc documentation for all functions
  - Consistent code style
  - Proper separation of concerns
  - Modular helper functions

## Email & Campaign Cron Jobs

### 1. Process Email Queue
- **Route**: `/api/cron/process-email-queue`
- **File**: `app/api/cron/process-email-queue/route.ts`
- **Schedule**: Runs every minute
- **Purpose**: Processes queued emails in the background
- **Key Functions**:
  - Fetches emails from `email_queue` table with status 'queued'
  - Validates mailbox availability and active status
  - Checks rate limits before sending
  - Sends emails via `sendViaMailbox`
  - Creates email records in `emails` table
  - Handles retries (up to max_retries, default 3)
  - Updates queue status (processing, sent, failed, queued_for_retry)
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 2. Process Campaigns
- **Route**: `/api/cron/process-campaigns`
- **File**: `app/api/cron/process-campaigns/route.ts`
- **Schedule**: Runs every minute
- **Purpose**: Processes email campaigns and schedules emails for sending
- **Key Functions**:
  - Finds active campaigns that need processing
  - Checks campaign end dates and warmup schedules
  - Processes campaign recipients and steps
  - Creates email records for scheduled sends
  - Updates campaign status and recipient progress
  - Handles time windows and timezone considerations
  - Updates campaign reports via RPC
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 3. Process Emails
- **Route**: `/api/cron/process-emails`
- **File**: `app/api/cron/process-emails/route.ts`
- **Schedule**: Runs every minute (typically)
- **Purpose**: Processes scheduled emails from campaigns
- **Key Functions**:
  - Fetches emails with status 'scheduled' and `scheduled_at <= now`
  - Proactively refreshes mailbox tokens before sending
  - Checks for global unsubscribes and bounces
  - Validates mailbox limits and rate limits
  - Sends emails via `sendViaMailbox`
  - Updates email status (sending, sent, failed)
  - Records email events (sent, failed)
  - Updates campaign recipient and step progress
  - Handles variant assignments for A/B testing
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 4. Gmail Watch Renewal
- **Route**: `/api/cron/gmail-watch-renewal`
- **File**: `app/api/cron/gmail-watch-renewal/route.ts`
- **Schedule**: Runs daily at 3 AM
- **Purpose**: Renews Gmail Watch subscriptions (expire after 7 days)
- **Key Functions**:
  - Finds Gmail mailboxes with watch subscriptions expiring in next 24 hours
  - Refreshes access tokens if needed
  - Renews Gmail Watch subscriptions via Google API
  - Updates `watch_expiration` and `watch_history_id` in database
  - Handles token refresh failures gracefully
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 5. Sync Mailboxes
- **Route**: `/api/cron/sync-mailboxes`
- **File**: `app/api/cron/sync-mailboxes/route.ts`
- **Schedule**: Runs every 5 minutes
- **Purpose**: Syncs all active mailboxes to ingest new emails
- **Key Functions**:
  - Fetches all active mailboxes (Gmail and Outlook)
  - Refreshes tokens if expired or about to expire
  - Syncs Gmail messages via `syncGmailMessages`
  - Syncs Outlook messages via `syncOutlookMessages`
  - Updates mailbox sync status and last sync time
  - Handles provider-specific sync logic
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

## Calendar Cron Jobs

### 6. Calendar Sync
- **Route**: `/api/calendar/cron/sync`
- **File**: `app/api/calendar/cron/sync/route.ts`
- **Schedule**: Runs every 15 minutes
- **Purpose**: Periodic sync of Google Calendar events (pulls new/updated events)
- **Key Functions**:
  - Fetches all active Google Calendar connections
  - Gets valid access tokens (refreshes if needed)
  - Fetches events from Google Calendar API (last 24 hours to next 7 days)
  - Syncs events to `calendar_events` table
  - Creates new events or updates existing ones
  - Skips cancelled events and events with newer local versions
  - Updates connection's `last_sync_at` timestamp
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 7. Calendar Token Refresh
- **Route**: `/api/calendar/cron/token-refresh`
- **File**: `app/api/calendar/cron/token-refresh/route.ts`
- **Schedule**: Runs hourly
- **Purpose**: Refresh Google Calendar access tokens that are expired or about to expire
- **Key Functions**:
  - Finds Google Calendar connections with tokens expiring in next hour
  - Refreshes tokens using `refreshGoogleAccessToken`
  - Updates `access_token` and `token_expires_at` in database
  - Handles refresh failures gracefully
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 8. Calendar Webhook Renewal
- **Route**: `/api/calendar/cron/webhook-renewal`
- **File**: `app/api/calendar/cron/webhook-renewal/route.ts`
- **Schedule**: Runs daily
- **Purpose**: Renew Google Calendar webhook subscriptions (they expire after 7 days)
- **Key Functions**:
  - Finds connections with webhooks expiring in next 24 hours or already expired
  - Deletes old webhook subscriptions
  - Creates new webhook subscriptions via Google Calendar API
  - Updates `webhook_id` and `webhook_expires_at` in database
  - Webhooks last for 7 days
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 9. Calendar Sync Retry
- **Route**: `/api/calendar/cron/sync-retry`
- **File**: `app/api/calendar/cron/sync-retry/route.ts`
- **Schedule**: Runs every 30 minutes
- **Purpose**: Retry failed syncs for events that failed to sync to Google Calendar
- **Key Functions**:
  - Finds events with `sync_status = 'failed'` from last 24 hours
  - Gets user's Google Calendar connection
  - Refreshes tokens if needed
  - Retries pushing events to Google Calendar via `pushEventToGoogleCalendar`
  - Updates sync status to 'synced' on success
  - Limits to 50 retries per run
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 10. Calendar Cleanup
- **Route**: `/api/calendar/cron/cleanup`
- **File**: `app/api/calendar/cron/cleanup/route.ts`
- **Schedule**: Runs daily
- **Purpose**: Cleanup old events and sync logs
- **Key Functions**:
  - Archives events older than 1 year (soft delete by updating status to 'archived')
  - Deletes old sync logs (older than 30 days)
  - Deletes old reminders that have been sent (older than 7 days)
  - Cleans up expired webhook subscriptions
  - Processes in batches (1000 events at a time)
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

## Data Management Cron Jobs

### 11. Property Map Refresh
- **Route**: `/api/cron/property-map-refresh`
- **File**: `app/api/cron/property-map-refresh/route.ts`
- **Schedule**: Runs every 6 hours
- **Purpose**: Refresh property map data by geocoding addresses and updating coordinates
- **Key Functions**:
  - Processes multiple tables: `listings`, `expired_listings`, `probate_leads`, `fsbo_leads`, `frbo_leads`, `foreclosure_listings`
  - Finds listings without coordinates but with address data
  - Geocodes addresses using Mapbox API
  - Updates `lat`, `lng`, and `updated_at` fields
  - Processes 100 listings at a time to avoid rate limits
  - Includes 100ms delay between requests for rate limiting
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`
- **Dependencies**: Requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

### 12. Prospect Enrich
- **Route**: `/api/cron/prospect-enrich`
- **File**: `app/api/cron/prospect-enrich/route.ts`
- **Schedule**: Runs every 4 hours
- **Purpose**: Enrich prospect data by updating expired status, price changes, and enrichment data
- **Key Functions**:
  - Updates expired listing status
  - Tracks price changes
  - Enriches prospect data with additional information
  - Updates enrichment timestamps
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

### 13. Provider Health Check
- **Route**: `/api/cron/provider-health-check`
- **File**: `app/api/cron/provider-health-check/route.ts`
- **Schedule**: Runs every hour
- **Purpose**: Monitor health of email providers (Gmail, Outlook, etc.)
- **Key Functions**:
  - Checks provider API availability
  - Tests authentication and token validity
  - Records health check results in `provider_health_checks` table
  - Tracks uptime and response times
  - Identifies provider issues for alerting
- **Authentication**: Requires `CRON_SECRET` or `CALENDAR_SERVICE_KEY`

## Authentication & Security

All cron jobs support multiple authentication methods:
1. **Vercel Cron Secret**: `x-vercel-cron-secret` header matching `CRON_SECRET` env var
2. **Service Key**: `x-service-key` header matching `CALENDAR_SERVICE_KEY` env var
3. **Bearer Token**: `Authorization: Bearer <CALENDAR_SERVICE_KEY>` header

All cron jobs support both GET and POST methods:
- **GET**: Used by Vercel Cron for scheduled execution
- **POST**: Used for manual triggers and testing

## Common Patterns

### Error Handling
- All cron jobs use `handleCronError()` for consistent error handling
- Custom error classes provide structured error information
- Errors are logged with context (no sensitive data)
- Failed operations don't stop the entire cron job
- Results arrays track success/failure per item
- User-friendly error messages in production

### Database Operations
- All use `getCronSupabaseClient()` from shared utilities
- Type-safe operations via `executeSelectOperation()`, `executeUpdateOperation()`, `executeInsertOperation()`
- Comprehensive TypeScript interfaces for all data structures
- Proper error handling with `DatabaseError` class
- Zod validation for runtime type checking

### Authentication
- All cron jobs use `verifyCronRequestOrError()` from shared utilities
- Supports multiple authentication methods (Vercel Cron secret, service key, Bearer token)
- Consistent authentication across all cron jobs

### Rate Limiting
- Email sending respects mailbox limits
- API calls include delays where needed (100-200ms)
- Batch processing to avoid overwhelming APIs
- Appropriate batch limits (50-100 items per run)

## Environment Variables

Required environment variables:
- `CRON_SECRET`: Secret for authenticating cron requests
- `CALENDAR_SERVICE_KEY`: Service key for calendar operations
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: Mapbox API token (for property map refresh)
- `EMAIL_QUEUE_BATCH_SIZE`: Batch size for email queue processing (default: 200)
- `NEXT_PUBLIC_APP_URL`: Base URL for webhook callbacks

## Summary Table

| # | Cron Job | Route | Schedule | Category |
|---|----------|-------|----------|----------|
| 1 | Process Email Queue | `/api/cron/process-email-queue` | Every minute | Email |
| 2 | Process Campaigns | `/api/cron/process-campaigns` | Every minute | Campaign |
| 3 | Process Emails | `/api/cron/process-emails` | Every minute | Email |
| 4 | Gmail Watch Renewal | `/api/cron/gmail-watch-renewal` | Daily at 3 AM | Email |
| 5 | Sync Mailboxes | `/api/cron/sync-mailboxes` | Every 5 minutes | Email |
| 6 | Calendar Sync | `/api/calendar/cron/sync` | Every 15 minutes | Calendar |
| 7 | Calendar Token Refresh | `/api/calendar/cron/token-refresh` | Hourly | Calendar |
| 8 | Calendar Webhook Renewal | `/api/calendar/cron/webhook-renewal` | Daily | Calendar |
| 9 | Calendar Sync Retry | `/api/calendar/cron/sync-retry` | Every 30 minutes | Calendar |
| 10 | Calendar Cleanup | `/api/calendar/cron/cleanup` | Daily | Calendar |
| 11 | Property Map Refresh | `/api/cron/property-map-refresh` | Every 6 hours | Data |
| 12 | Prospect Enrich | `/api/cron/prospect-enrich` | Every 4 hours | Data |
| 13 | Provider Health Check | `/api/cron/provider-health-check` | Hourly | Monitoring |

## Notes

- All cron jobs are designed to be idempotent where possible
- Most cron jobs process items in batches to avoid timeouts
- Error handling is comprehensive to prevent one failure from stopping the entire job
- All cron jobs return JSON responses with success status and results
- Manual triggering is supported via POST requests for testing












