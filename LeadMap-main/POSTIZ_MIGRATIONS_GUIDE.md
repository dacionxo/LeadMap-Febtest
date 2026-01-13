# Postiz Migration Guide

## Overview

This guide explains how to run all Postiz database migrations to set up the social media integration for thousands of users.

## Migration Files

The Postiz integration consists of 5 migration files that must be run in order:

### 1. `create_postiz_workspaces.sql`
- Creates `workspaces` and `workspace_members` tables
- Foundation for multi-tenant architecture
- Includes RLS policies and indexes

### 2. `create_postiz_data_model.sql`
- Creates all main Postiz tables:
  - `social_accounts` - Connected social media accounts
  - `credentials` - Encrypted OAuth tokens
  - `posts` - Social media posts
  - `post_targets` - Post-to-account mappings
  - `media_assets` - Media files
  - `schedules` - Posting schedules
  - `queue_jobs` - Background job queue
  - `tags`, `post_tags` - Organization
  - `analytics_events` - Performance data
  - `webhook_events` - Provider callbacks
  - `activity_logs` - Audit trail

### 3. `create_oauth_states_table.sql`
- Creates `oauth_states` table for OAuth flow security
- Temporary storage for authentication states
- Auto-cleanup functions

### 4. `optimize_postiz_for_scale.sql`
- Adds 50+ performance indexes
- Creates background job functions
- Optimizes RLS policies
- Adds monitoring functions

### 5. `add_user_id_to_credentials.sql`
- Adds `user_id` column to `credentials` table
- Required for existing databases
- Improves query performance

## How to Run Migrations

### Option 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run Migrations in Order**
   - Copy and paste each migration file content
   - Run one at a time in the correct order
   - Wait for each to complete before running the next

```sql
-- Step 1: Run create_postiz_workspaces.sql
-- Copy the entire content of the file and execute

-- Step 2: Run create_postiz_data_model.sql
-- Copy the entire content and execute

-- Step 3: Run create_oauth_states_table.sql
-- Copy the entire content and execute

-- Step 4: Run optimize_postiz_for_scale.sql
-- Copy the entire content and execute

-- Step 5: Run add_user_id_to_credentials.sql (only if upgrading existing database)
-- Copy the entire content and execute
```

### Option 2: Supabase CLI

If you have Supabase CLI configured:

```bash
# Navigate to project root
cd LeadMap-main

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Run migrations (adjust paths as needed)
psql $(supabase db url) -f supabase/migrations/create_postiz_workspaces.sql
psql $(supabase db url) -f supabase/migrations/create_postiz_data_model.sql
psql $(supabase db url) -f supabase/migrations/create_oauth_states_table.sql
psql $(supabase db url) -f supabase/migrations/optimize_postiz_for_scale.sql
psql $(supabase db url) -f supabase/migrations/add_user_id_to_credentials.sql
```

### Option 3: Direct psql Connection

If you have direct database access:

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run migrations
psql $DATABASE_URL -f supabase/migrations/create_postiz_workspaces.sql
psql $DATABASE_URL -f supabase/migrations/create_postiz_data_model.sql
psql $DATABASE_URL -f supabase/migrations/create_oauth_states_table.sql
psql $DATABASE_URL -f supabase/migrations/optimize_postiz_for_scale.sql
psql $DATABASE_URL -f supabase/migrations/add_user_id_to_credentials.sql
```

## Migration Order Importance

**CRITICAL**: Run migrations in the exact order specified. Each migration depends on tables/functions created by previous migrations.

- Migration 1 creates foundation tables
- Migration 2 creates data model (references tables from migration 1)
- Migration 3 creates OAuth tables
- Migration 4 optimizes everything (references all tables)
- Migration 5 is optional (for existing databases)

## Verification Steps

After running all migrations, verify the setup:

### Check Tables Created
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'workspaces' OR table_name LIKE 'social_%' OR table_name LIKE '%post%'
ORDER BY table_name;
```

Expected tables:
- `workspaces`
- `workspace_members`
- `social_accounts`
- `credentials`
- `posts`
- `post_targets`
- `media_assets`
- `schedules`
- `queue_jobs`
- `tags`
- `post_tags`
- `analytics_events`
- `webhook_events`
- `activity_logs`
- `oauth_states`

### Check Indexes Created
```sql
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'workspaces' OR tablename LIKE 'social_%' OR tablename LIKE '%post%')
ORDER BY tablename, indexname;
```

Should show 50+ indexes starting with `idx_`.

### Check Functions Created
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'refresh_%' OR routine_name LIKE 'cleanup_%' OR routine_name LIKE 'get_%'
ORDER BY routine_name;
```

Expected functions:
- `refresh_expiring_tokens`
- `cleanup_expired_oauth_states_batch`
- `cleanup_old_analytics_events`
- `cleanup_old_activity_logs`
- `cleanup_old_webhook_events`
- `get_queue_stats`
- `get_workspace_stats`

### Test RLS Policies
```sql
-- Should work (service role bypasses RLS)
SELECT COUNT(*) FROM workspaces;

-- Should fail (regular user without auth context)
-- This is expected - RLS prevents unauthorized access
```

## Post-Migration Setup

### 1. Environment Variables
Add these to your `.env.local`:

```env
# Batch API Key (secure random string)
POSTIZ_BATCH_API_KEY=your-secure-random-api-key-here

# Frontend URL for OAuth redirects
NEXT_PUBLIC_APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com

# OAuth Provider Keys (when implementing providers)
X_API_KEY=your_twitter_api_key
X_API_SECRET=your_twitter_api_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### 2. Cron Jobs Setup

Set up these scheduled jobs:

#### Token Refresh (Every Hour)
```bash
# Using curl to batch endpoint
0 * * * * curl -X POST https://your-domain.com/api/postiz/oauth/refresh-batch \
  -H "Authorization: Bearer $POSTIZ_BATCH_API_KEY"

# Or using Supabase Edge Functions
# Create an Edge Function that calls refresh_expiring_tokens()
```

#### OAuth State Cleanup (Every 15 Minutes)
```sql
-- Using pg_cron in Supabase
SELECT cron.schedule(
  'cleanup-oauth-states',
  '*/15 * * * *',
  $$SELECT cleanup_expired_oauth_states_batch()$$
);
```

#### Data Retention Cleanup (Monthly)
```sql
-- Using pg_cron
SELECT cron.schedule(
  'monthly-cleanup',
  '0 0 1 * *', -- First day of month
  $$
  SELECT cleanup_old_analytics_events(90);
  SELECT cleanup_old_activity_logs(365);
  SELECT cleanup_old_webhook_events(30);
  $$
);
```

### 3. Monitoring Setup

Monitor these key metrics:

```sql
-- Queue backlog
SELECT * FROM get_queue_stats();

-- Expiring tokens (should be handled by cron)
SELECT COUNT(*) FROM credentials
WHERE token_expires_at BETWEEN NOW() AND (NOW() + INTERVAL '24 hours');

-- Workspace statistics
SELECT * FROM get_workspace_stats('workspace-uuid');
```

## Troubleshooting

### Migration Fails
- **Check order**: Ensure migrations run in correct sequence
- **Dependencies**: Previous migrations must complete successfully
- **Permissions**: Ensure service role has permission to create tables/functions

### RLS Issues
- **Auth context**: RLS policies require proper user authentication
- **Service role**: Use service role for admin operations
- **Workspace membership**: Users must be members of workspaces

### Performance Issues
- **Missing indexes**: Run `optimize_postiz_for_scale.sql`
- **Table statistics**: Run `ANALYZE` on tables after bulk operations
- **Connection pooling**: Configure Supabase connection pool

### OAuth Issues
- **Environment variables**: Ensure all provider keys are set
- **Redirect URIs**: Must match registered URIs in provider apps
- **HTTPS**: Production requires HTTPS for OAuth

## Rollback Plan

If you need to rollback:

```sql
-- Drop all Postiz tables (CAUTION: DATA LOSS)
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS post_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS queue_jobs CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS post_targets CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS oauth_states CASCADE;
DROP TABLE IF EXISTS credentials CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS refresh_expiring_tokens();
DROP FUNCTION IF EXISTS cleanup_expired_oauth_states_batch();
DROP FUNCTION IF EXISTS cleanup_old_analytics_events(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_activity_logs(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_webhook_events(INTEGER);
DROP FUNCTION IF EXISTS get_queue_stats();
DROP FUNCTION IF EXISTS get_workspace_stats(UUID);
DROP FUNCTION IF EXISTS is_workspace_member_fast(UUID, UUID);
```

## Next Steps After Migration

1. **Test OAuth Flows**: Connect social media accounts
2. **Configure Providers**: Set up API keys for Twitter, LinkedIn, Instagram, Facebook
3. **Set up Monitoring**: Configure alerts for queue backlog and failed jobs
4. **Load Testing**: Test with simulated user load
5. **Production Deployment**: Monitor performance and scale as needed

---

**Migration Complete!** Your Postiz integration is now ready for thousands of users. 🎉