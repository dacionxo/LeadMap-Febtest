# Postiz Migrations - Execution Status

## 📋 Migration Files

The following 5 migration files need to be executed in Supabase:

1. ✅ `supabase/migrations/create_postiz_workspaces.sql` - Workspaces & tenancy
2. ✅ `supabase/migrations/create_postiz_data_model.sql` - Core data model (largest file)
3. ✅ `supabase/migrations/create_oauth_states_table.sql` - OAuth state management
4. ✅ `supabase/migrations/optimize_postiz_for_scale.sql` - Performance optimizations (50+ indexes)
5. ✅ `supabase/migrations/add_user_id_to_credentials.sql` - Scalability enhancement

## ⚠️ Important Note

**Supabase CLI automated execution attempted but may not have worked correctly.** The script showed success, but verification queries failed due to CLI command syntax differences.

**RECOMMENDED APPROACH: Manual execution via Supabase Dashboard SQL Editor**

## 🚀 Manual Execution Instructions

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Sign in to your account
3. Select your project: **bqkucdaefpfkunceftye**

### Step 2: Navigate to SQL Editor

1. Click on **SQL Editor** in the left sidebar
2. Click **New query** button

### Step 3: Execute Migrations in Order

**CRITICAL: Execute migrations in this exact order!**

#### Migration 1: Workspaces
1. Open file: `supabase/migrations/create_postiz_workspaces.sql`
2. Copy **ALL** content (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor
4. Click **Run** (or press F5)
5. Wait for "Success" message
6. **Do not proceed until this completes successfully**

#### Migration 2: Data Model (LARGEST - may take 30-60 seconds)
1. Open file: `supabase/migrations/create_postiz_data_model.sql`
2. Copy **ALL** content (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor
4. Click **Run** (or press F5)
5. Wait for "Success" message
6. **This is the largest migration - be patient**

#### Migration 3: OAuth States
1. Open file: `supabase/migrations/create_oauth_states_table.sql`
2. Copy **ALL** content (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor
4. Click **Run** (or press F5)
5. Wait for "Success" message

#### Migration 4: Performance Optimization
1. Open file: `supabase/migrations/optimize_postiz_for_scale.sql`
2. Copy **ALL** content (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor
4. Click **Run** (or press F5)
5. Wait for "Success" message
6. **This creates 50+ indexes - may take 1-2 minutes**

#### Migration 5: User ID Enhancement
1. Open file: `supabase/migrations/add_user_id_to_credentials.sql`
2. Copy **ALL** content (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor
4. Click **Run** (or press F5)
5. Wait for "Success" message

## ✅ Verification Queries

After running all migrations, verify they worked by running these queries in SQL Editor:

### Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'workspaces' 
       OR table_name LIKE 'social_%' 
       OR table_name LIKE '%post%'
       OR table_name LIKE 'oauth_%'
       OR table_name = 'tags'
       OR table_name = 'queue_jobs'
       OR table_name = 'schedules')
ORDER BY table_name;
```

**Expected tables (should see ~15 tables):**
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
SELECT COUNT(*) as total_indexes 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';
```

**Expected: 50+ indexes**

### Check Functions Created
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_name LIKE 'refresh_%' 
       OR routine_name LIKE 'cleanup_%' 
       OR routine_name LIKE 'get_%'
       OR routine_name LIKE 'create_default_workspace%')
ORDER BY routine_name;
```

**Expected functions:**
- `refresh_expiring_tokens`
- `cleanup_expired_oauth_states_batch`
- `cleanup_old_analytics_events`
- `cleanup_old_activity_logs`
- `cleanup_old_webhook_events`
- `get_queue_stats`
- `get_workspace_stats`
- `create_default_workspace_for_user`
- `is_workspace_member`
- `get_user_workspaces`

## 🔧 Next Steps After Migration

### 1. Environment Variables

Add these to your `.env.local`:

```env
# Batch API Key (generate a secure random string)
POSTIZ_BATCH_API_KEY=your-secure-random-api-key-here

# Worker API Key (different from batch key)
POSTIZ_WORKER_API_KEY=your-secure-worker-api-key-here

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

### 2. Configure Cron Jobs

Set up these scheduled jobs in Supabase (using pg_cron or Vercel Cron):

#### Token Refresh (Every Hour)
```sql
-- Using pg_cron in Supabase
SELECT cron.schedule(
  'refresh-expiring-tokens',
  '0 * * * *', -- Every hour
  $$SELECT refresh_expiring_tokens()$$
);
```

#### OAuth State Cleanup (Every 15 Minutes)
```sql
SELECT cron.schedule(
  'cleanup-oauth-states',
  '*/15 * * * *',
  $$SELECT cleanup_expired_oauth_states_batch()$$
);
```

#### Data Retention Cleanup (Monthly)
```sql
SELECT cron.schedule(
  'monthly-cleanup',
  '0 0 1 * *', -- First day of month at midnight
  $$
  SELECT cleanup_old_analytics_events(90);
  SELECT cleanup_old_activity_logs(365);
  SELECT cleanup_old_webhook_events(30);
  $$
);
```

### 3. Test the System

1. **Create a workspace:**
   ```sql
   SELECT create_default_workspace_for_user(auth.uid(), 'user@example.com');
   ```

2. **Check workspace:**
   ```sql
   SELECT * FROM workspaces;
   SELECT * FROM workspace_members;
   ```

3. **Test OAuth flow:**
   - Navigate to `/dashboard/postiz`
   - Try connecting a social media account
   - Verify credentials are stored encrypted

4. **Test publishing:**
   - Create a post
   - Schedule it
   - Verify it appears in `queue_jobs`

## 🐛 Troubleshooting

### Migration Fails with "relation already exists"
- **Cause:** Migration was partially run before
- **Fix:** The migrations use `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen. If it does, check what tables already exist and skip those parts of the migration.

### Migration Fails with "permission denied"
- **Cause:** Insufficient permissions
- **Fix:** Ensure you're logged in as project owner/admin in Supabase Dashboard

### Migration Fails with "syntax error"
- **Cause:** SQL syntax issue or incomplete copy/paste
- **Fix:** Ensure you copied the ENTIRE file content, including all semicolons and closing statements

### Tables Not Appearing After Migration
- **Cause:** Migration failed silently or didn't execute
- **Fix:** Check SQL Editor for error messages, re-run the migration

### Indexes Not Created
- **Cause:** Migration 4 (optimize_postiz_for_scale.sql) didn't run successfully
- **Fix:** Re-run migration 4 specifically, check for errors

## 📚 Resources

- **Migration Files Location:** `LeadMap-main/supabase/migrations/`
- **Detailed Guide:** `LeadMap-main/POSTIZ_MIGRATIONS_GUIDE.md`
- **Scalability Guide:** `LeadMap-main/docs/SCALABILITY_GUIDE.md`
- **Postiz Roadmap:** `LeadMap-main/docs/POSTIZ_INTEGRATION_ROADMAP.md`

## ✅ Success Criteria

All migrations are successful when:
- ✅ All 15 tables exist
- ✅ 50+ indexes created
- ✅ 9+ functions created
- ✅ RLS policies are active
- ✅ Verification queries return expected results

---

**Status:** ⚠️ **PENDING MANUAL EXECUTION**

The automated script attempted execution but Supabase CLI command syntax may have changed. Please execute migrations manually via Supabase Dashboard SQL Editor following the instructions above.
