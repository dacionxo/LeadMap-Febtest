# Symphony Messenger Migration Guide

## Overview

This guide explains how to apply the Symphony Messenger database schema migration to your Supabase project.

## Prerequisites

- Access to your Supabase project dashboard
- OR Supabase CLI installed (optional)

## Migration Files

- **Migration**: `supabase/migrations/create_symphony_messenger_schema.sql`
- **Rollback**: `supabase/migrations/rollback_symphony_messenger_schema.sql`

## What This Migration Creates

### Tables

1. **messenger_messages** - Main message queue table
   - Stores all messages waiting to be processed
   - Supports priority, scheduling, retry logic, and message locking
   - Includes comprehensive indexes for efficient queue processing

2. **messenger_failed_messages** - Dead letter queue
   - Stores messages that failed after exhausting all retry attempts
   - Preserves error information and original message content

3. **messenger_transports** - Transport configuration
   - Optional table for dynamic transport management
   - Supports multiple transport types (sync, supabase, redis, rabbitmq, sqs)

4. **messenger_schedules** - Scheduled and recurring messages
   - Stores scheduled and recurring message configurations
   - Supports cron, interval, and one-time schedules

### Functions and Triggers

- `update_messenger_messages_updated_at()` - Auto-updates `updated_at` timestamp
- `update_messenger_transports_updated_at()` - Auto-updates `updated_at` timestamp
- `update_messenger_schedules_updated_at()` - Auto-updates `updated_at` timestamp

### Views

- `messenger_queue_depth` - Queue depth by transport and status
- `messenger_failed_summary` - Failed messages summary
- `messenger_schedules_summary` - Scheduled messages summary

## Applying the Migration

### Method 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Open `supabase/migrations/create_symphony_messenger_schema.sql`
6. Copy the entire contents
7. Paste into the SQL Editor
8. Click **Run** (or press `Ctrl+Enter`)

### Method 2: Supabase CLI

If you have Supabase CLI installed:

```bash
cd LeadMap-main
supabase db execute -f supabase/migrations/create_symphony_messenger_schema.sql
```

Or using npx (no installation required):

```bash
cd LeadMap-main
npx supabase db execute -f supabase/migrations/create_symphony_messenger_schema.sql
```

### Method 3: PowerShell Script

On Windows, you can use the provided PowerShell script:

```powershell
cd LeadMap-main\supabase
.\run_symphony_migration.ps1
```

This will display the migration SQL and provide instructions.

## Verifying the Migration

After running the migration, verify it was successful:

### Check Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'messenger_%'
ORDER BY table_name;
```

Expected output:
- messenger_failed_messages
- messenger_messages
- messenger_schedules
- messenger_transports

### Check Views

```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'messenger_%'
ORDER BY table_name;
```

Expected output:
- messenger_failed_summary
- messenger_queue_depth
- messenger_schedules_summary

### Check Functions

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'update_messenger_%'
ORDER BY routine_name;
```

Expected output:
- update_messenger_messages_updated_at
- update_messenger_schedules_updated_at
- update_messenger_transports_updated_at

### Test Queue Depth View

```sql
SELECT * FROM messenger_queue_depth;
```

This should return an empty result set (no messages yet).

## Rollback

If you need to rollback the migration (⚠️ **WARNING**: This deletes all data):

### Method 1: Supabase Dashboard

1. Go to SQL Editor
2. Open `supabase/migrations/rollback_symphony_messenger_schema.sql`
3. Copy and paste into SQL Editor
4. Click **Run**

### Method 2: Supabase CLI

```bash
supabase db execute -f supabase/migrations/rollback_symphony_messenger_schema.sql
```

## Troubleshooting

### Error: "relation already exists"

If you see this error, the tables may already exist. You can:

1. **Check if tables exist**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name LIKE 'messenger_%';
   ```

2. **Drop existing tables** (if safe to do so):
   ```sql
   -- Use the rollback script
   ```

3. **Or modify the migration** to use `CREATE TABLE IF NOT EXISTS` (already included)

### Error: "permission denied"

Ensure you're using a user with sufficient permissions (typically the service role or postgres user).

### Error: "extension uuid-ossp does not exist"

The migration includes `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` which should handle this. If it fails, you may need to enable the extension manually:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Next Steps

After successfully applying the migration:

1. ✅ Verify all tables, views, and functions were created
2. ✅ Test the queue depth view
3. ✅ Proceed to Phase 3: Implement core Symphony Messenger types and interfaces
4. ✅ Review the architecture documentation: `SYMPHONY_MESSENGER_ARCHITECTURE.md`

## Support

For issues or questions:
- Review `SYMPHONY_MESSENGER_ARCHITECTURE.md` for architecture details
- Check the migration file comments for table/column documentation
- Review existing migrations in `supabase/migrations/` for reference


