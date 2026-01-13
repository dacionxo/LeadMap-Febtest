# Unibox Email Reception Debugging Hypotheses

## Problem Statement
OAuth emails are not displaying in the Unibox feature. Need to determine if this is a sync issue, database issue, or webhook/push notification issue.

## Hypotheses

### Hypothesis A: Sync cron job not running or failing silently
- **Expected behavior**: Cron job runs every 5 minutes, syncs emails from Gmail/Outlook
- **Failure points**: 
  - Cron job not configured in Vercel
  - Token refresh failing (invalid_grant errors)
  - API errors not being logged
- **Evidence needed**: Logs showing cron execution, sync results, errors

### Hypothesis B: Emails being fetched but not saved to database
- **Expected behavior**: `syncGmailMessages`/`syncOutlookMessages` fetch messages and save to `email_messages` and `email_threads` tables
- **Failure points**:
  - Database insert errors (missing columns, constraints, permissions)
  - Transaction rollback
  - Silent failures in error handling
- **Evidence needed**: Logs showing message fetch success, database insert results

### Hypothesis C: Direction field mismatch (inbound vs received)
- **Expected behavior**: Sync saves with `direction: 'inbound'`, Unibox filters by `direction === 'inbound'`
- **Failure points**:
  - Direction detection logic incorrect (`isInbound` calculation)
  - Database schema mismatch
  - Query filter mismatch
- **Evidence needed**: Logs showing direction values saved vs queried

### Hypothesis D: Thread creation/linking failing
- **Expected behavior**: Messages linked to threads via `thread_id`, threads created if missing
- **Failure points**:
  - Thread creation failing
  - Message-to-thread linking failing
  - Foreign key constraint violations
- **Evidence needed**: Logs showing thread creation, message insertion, thread_id values

### Hypothesis E: Unibox API query filtering out emails
- **Expected behavior**: `/api/unibox/threads` returns threads with inbound messages
- **Failure points**:
  - Query filters excluding emails (status, mailbox_id)
  - Join conditions failing
  - Sorting/ordering hiding emails
- **Evidence needed**: Logs showing query results, thread counts, message counts

### Hypothesis F: Real-time sync missing (webhook/push not set up)
- **Expected behavior**: Gmail Watch API or Outlook webhooks push new emails immediately
- **Failure points**:
  - Watch subscriptions not created
  - Webhook endpoints not configured
  - Push notifications not delivered
- **Evidence needed**: Logs showing watch subscription, webhook delivery, push notifications

## Instrumentation Strategy

1. **Sync cron job** (`app/api/cron/sync-mailboxes/route.ts`):
   - Log cron execution start/end
   - Log mailbox processing
   - Log token refresh results
   - Log sync function calls and results
   - Log errors with full details

2. **Sync functions** (`lib/email/unibox/gmail-connector.ts`, `outlook-connector.ts`):
   - Log message fetch attempts and results
   - Log database queries and results
   - Log thread creation/update
   - Log message insertion with direction value
   - Log any errors with full context

3. **Unibox API** (`app/api/unibox/threads/route.ts`):
   - Log query parameters
   - Log database query and results
   - Log thread transformation
   - Log filtering results

4. **Unibox UI** (`app/dashboard/unibox/components/UniboxContent.tsx`):
   - Log API calls and responses
   - Log thread data received


