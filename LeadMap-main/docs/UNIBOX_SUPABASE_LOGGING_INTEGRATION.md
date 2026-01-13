# Unibox Supabase Logging Integration

## Overview

All unibox operations are now logged to Supabase's `unibox_activity_logs` table for auditing, debugging, and analytics. This ensures comprehensive tracking of all user interactions with the unibox inbox system.

## Implementation

### Activity Logger Module

**Location:** `lib/email/unibox/activity-logger.ts`

The activity logger provides helper functions to log different types of unibox operations:

- `logThreadList()` - Logs thread list operations (GET /api/unibox/threads)
- `logThreadGet()` - Logs thread get operations (GET /api/unibox/threads/[id])
- `logThreadUpdate()` - Logs thread update operations (PATCH /api/unibox/threads/[id])

### Database Schema

**Migration:** `supabase/migrations/create_unibox_activity_logs.sql`

**Table:** `unibox_activity_logs`

**Columns:**
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to auth.users (multi-user isolation)
- `action` (TEXT) - Type of operation: 'list_threads', 'get_thread', 'update_thread', 'reply_thread', 'forward_thread', 'filter_threads', 'search_threads', 'error'
- `thread_id` (UUID) - Optional reference to email_threads
- `mailbox_id` (UUID) - Optional reference to mailboxes
- `request_data` (JSONB) - Request parameters, filters, query details
- `response_data` (JSONB) - Response summary (count, success, etc.)
- `error_data` (JSONB) - Error details (when action = 'error')
- `ip_address` (INET) - Client IP address
- `user_agent` (TEXT) - Client user agent
- `created_at` (TIMESTAMPTZ) - Timestamp of the log entry

**Indexes:**
- `idx_unibox_activity_logs_user_id` - For filtering by user
- `idx_unibox_activity_logs_action` - For filtering by action type
- `idx_unibox_activity_logs_thread_id` - For filtering by thread
- `idx_unibox_activity_logs_created_at` - For time-based queries
- `idx_unibox_activity_logs_user_action` - Composite index for user + action queries
- `idx_unibox_activity_logs_user_created` - Composite index for user + time queries
- GIN indexes on JSONB columns for efficient querying

**RLS Policies:**
- Users can view their own logs
- Service role can insert logs (for API logging)
- Only service role can delete logs (for maintenance)

## Integrated Endpoints

### GET /api/unibox/threads

**Logged Operations:**
- ✅ Successful thread list requests
- ✅ Failed database queries
- ✅ Unhandled exceptions

**Logged Data:**
- Filters: mailboxId, status, starred, archived, folder, search, page, pageSize
- Results: threadCount, totalCount, success status
- Errors: Error messages when failures occur
- Metadata: IP address, user agent, timestamp

**Example Log Entry:**
```json
{
  "user_id": "user-uuid",
  "action": "list_threads",
  "request_data": {
    "filters": {
      "mailboxId": null,
      "status": "open",
      "starred": null,
      "archived": false,
      "folder": "inbox",
      "search": null,
      "page": 1,
      "pageSize": 50
    },
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "response_data": {
    "threadCount": 25,
    "totalCount": 100,
    "success": true
  }
}
```

### GET /api/unibox/threads/[id]

**Logged Operations:**
- ✅ Successful thread fetch requests
- ✅ Database errors
- ✅ Unhandled exceptions

**Logged Data:**
- Thread ID
- Results: messageCount, success status
- Errors: Error messages when failures occur
- Metadata: IP address, user agent, timestamp

**Example Log Entry:**
```json
{
  "user_id": "user-uuid",
  "action": "get_thread",
  "thread_id": "thread-uuid",
  "request_data": {
    "threadId": "thread-uuid",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "response_data": {
    "messageCount": 5,
    "success": true
  }
}
```

### PATCH /api/unibox/threads/[id]

**Logged Operations:**
- ✅ Successful thread updates
- ✅ Validation errors
- ✅ Database errors
- ✅ Unhandled exceptions

**Logged Data:**
- Thread ID
- Updates: status, unread, starred, archived
- Results: success status
- Errors: Error messages when failures occur
- Metadata: IP address, user agent, timestamp

**Example Log Entry:**
```json
{
  "user_id": "user-uuid",
  "action": "update_thread",
  "thread_id": "thread-uuid",
  "request_data": {
    "threadId": "thread-uuid",
    "updates": {
      "status": "closed",
      "starred": true,
      "archived": false
    },
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "response_data": {
    "success": true
  }
}
```

## Multi-User Isolation

All logs are properly isolated by `user_id`:

1. **RLS Policies:** Users can only view their own logs
2. **API Filtering:** All queries filter by authenticated user
3. **Log Entries:** Every log entry includes the user_id

## Non-Blocking Logging

Logging is designed to be non-blocking to avoid impacting API performance:

1. **Async/Await:** All logging calls use async/await
2. **Error Handling:** Logging failures are caught and logged to console, but don't fail the API request
3. **Service Role:** Uses service role key to bypass RLS for insertions

**Example:**
```typescript
logThreadList({
  // ... parameters
}).catch((error) => {
  // Don't fail the request if logging fails
  console.error('[UniboxLogger] Failed to log thread list:', error)
})
```

## Querying Activity Logs

### View User's Recent Activity

```sql
SELECT 
  action,
  thread_id,
  request_data,
  response_data,
  error_data,
  created_at
FROM unibox_activity_logs
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 50;
```

### Find Errors for a User

```sql
SELECT 
  action,
  thread_id,
  error_data,
  created_at
FROM unibox_activity_logs
WHERE user_id = 'user-uuid'
  AND action = 'error'
ORDER BY created_at DESC;
```

### Count Actions by Type

```sql
SELECT 
  action,
  COUNT(*) as count
FROM unibox_activity_logs
WHERE user_id = 'user-uuid'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY count DESC;
```

### Find Most Active Users

```sql
SELECT 
  user_id,
  COUNT(*) as activity_count
FROM unibox_activity_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY activity_count DESC
LIMIT 10;
```

### Filter by Thread

```sql
SELECT 
  action,
  user_id,
  request_data,
  response_data,
  created_at
FROM unibox_activity_logs
WHERE thread_id = 'thread-uuid'
ORDER BY created_at DESC;
```

### Search Request Data (JSONB)

```sql
SELECT *
FROM unibox_activity_logs
WHERE user_id = 'user-uuid'
  AND request_data @> '{"filters": {"status": "open"}}'::jsonb
ORDER BY created_at DESC;
```

## Maintenance

### Cleanup Old Logs

The migration includes a cleanup function to remove old logs:

```sql
-- Delete logs older than 90 days (default)
SELECT cleanup_old_unibox_logs(90);

-- Delete logs older than 30 days
SELECT cleanup_old_unibox_logs(30);
```

**Recommendation:** Run this function periodically via a cron job or Supabase Edge Function.

### Monitor Log Growth

```sql
-- Check table size
SELECT 
  pg_size_pretty(pg_total_relation_size('unibox_activity_logs')) as total_size,
  pg_size_pretty(pg_relation_size('unibox_activity_logs')) as table_size,
  pg_size_pretty(pg_indexes_size('unibox_activity_logs')) as indexes_size;

-- Count total logs
SELECT COUNT(*) as total_logs FROM unibox_activity_logs;

-- Count by user
SELECT 
  user_id,
  COUNT(*) as log_count
FROM unibox_activity_logs
GROUP BY user_id
ORDER BY log_count DESC;
```

## Performance Considerations

1. **Indexes:** All commonly queried fields have indexes
2. **JSONB Queries:** GIN indexes enable efficient JSONB queries
3. **Async Logging:** Non-blocking to avoid impacting API performance
4. **Cleanup:** Regular cleanup prevents table from growing indefinitely

## Security

1. **RLS Policies:** Users can only view their own logs
2. **Service Role:** Logging uses service role key (not exposed to client)
3. **IP Address:** Client IP is logged for security auditing
4. **User Agent:** Client user agent is logged for debugging

## Error Handling

If logging fails, it's handled gracefully:

1. Error is caught and logged to console
2. API request continues normally
3. No user impact

This ensures logging failures don't break the application.

## Related Files

- **Logger:** `lib/email/unibox/activity-logger.ts`
- **Migration:** `supabase/migrations/create_unibox_activity_logs.sql`
- **API Routes:**
  - `app/api/unibox/threads/route.ts`
  - `app/api/unibox/threads/[id]/route.ts`
- **Documentation:**
  - `docs/UNIBOX_COMPLETE_FEATURE_DOCUMENTATION.md`

## Migration Instructions

To enable activity logging:

1. **Run the migration:**
   ```bash
   # Option 1: Supabase Dashboard
   # Go to SQL Editor and run:
   # supabase/migrations/create_unibox_activity_logs.sql
   
   # Option 2: Supabase CLI
   supabase db remote execute --file supabase/migrations/create_unibox_activity_logs.sql
   ```

2. **Verify the table was created:**
   ```sql
   SELECT * FROM unibox_activity_logs LIMIT 1;
   ```

3. **Test logging:**
   - Make a request to `/api/unibox/threads`
   - Check that a log entry was created:
   ```sql
   SELECT * FROM unibox_activity_logs 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

## Troubleshooting

### Logs Not Being Created

1. **Check Supabase Configuration:**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is set
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is set

2. **Check Console Logs:**
   - Look for `[UniboxLogger]` messages
   - Check for any error messages

3. **Check Database:**
   - Verify `unibox_activity_logs` table exists
   - Verify RLS policies are set correctly
   - Check if service role has insert permissions

### Performance Issues

1. **Check Indexes:**
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'unibox_activity_logs';
   ```

2. **Monitor Query Performance:**
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM unibox_activity_logs 
   WHERE user_id = 'user-uuid' 
   ORDER BY created_at DESC 
   LIMIT 50;
   ```

3. **Consider Cleanup:**
   - Run cleanup function if table is too large
   - Adjust retention period based on needs

## Future Enhancements

### Potential Features

1. **Analytics Dashboard:**
   - User activity metrics
   - Popular filters/actions
   - Error rate monitoring

2. **Alerting:**
   - Alert on high error rates
   - Alert on unusual activity patterns

3. **Advanced Queries:**
   - User behavior analysis
   - Performance metrics
   - Usage statistics

