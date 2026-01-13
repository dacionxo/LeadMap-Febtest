# Quick Migration Verification Guide

## 🚀 Fastest Method: Supabase Dashboard SQL Editor

### Step 1: Open SQL Editor
1. Go to: https://supabase.com/dashboard/project/bqkucdaefpfkunceftye/editor
2. Click **New query**

### Step 2: Copy & Run Verification Query
Copy the entire contents of `verify_postiz_migrations.sql` and paste into the SQL Editor, then click **Run**.

**OR** use this quick check:

```sql
-- Quick Check: Are Postiz tables present?
SELECT 
    CASE 
        WHEN COUNT(*) = 15 THEN '✅ ALL MIGRATIONS APPLIED - 15 tables found'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - Only ' || COUNT(*) || ' tables found (expected 15)'
        ELSE '❌ NO MIGRATIONS - Run migrations first'
    END as migration_status,
    COUNT(*) as tables_found,
    STRING_AGG(table_name, ', ' ORDER BY table_name) as existing_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'workspaces', 'workspace_members', 'social_accounts', 'credentials', 
    'posts', 'post_targets', 'media_assets', 'schedules', 'queue_jobs', 
    'tags', 'post_tags', 'analytics_events', 'webhook_events', 
    'activity_logs', 'oauth_states'
  );
```

## 📊 What to Look For

### ✅ Success Indicators:
- **15 tables** found (all Postiz tables)
- **50+ indexes** found (performance optimization)
- **7+ functions** found (core Postiz functions)
- **5+ tables** have RLS policies enabled

### ❌ If Migrations Haven't Run:
- **0 tables** found → Run all 5 migration files
- **< 15 tables** → Check which migrations failed
- **< 50 indexes** → Migration 4 (optimize_postiz_for_scale.sql) may not have run

## 🔍 Detailed Checks

### Check 1: Core Tables (Should have 15)
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'workspaces', 'workspace_members', 'social_accounts', 'credentials',
    'posts', 'post_targets', 'media_assets', 'schedules', 'queue_jobs',
    'tags', 'post_tags', 'analytics_events', 'webhook_events',
    'activity_logs', 'oauth_states'
  )
ORDER BY table_name;
```

### Check 2: Indexes (Should have 50+)
```sql
SELECT COUNT(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';
```

### Check 3: Functions (Should have 7+)
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'refresh_expiring_tokens',
    'cleanup_expired_oauth_states_batch',
    'get_queue_stats',
    'get_workspace_stats',
    'create_default_workspace_for_user',
    'is_workspace_member',
    'get_user_workspaces'
  )
ORDER BY routine_name;
```

### Check 4: RLS Policies (Should have policies on 5+ tables)
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts')
GROUP BY tablename;
```

## 🎯 One-Line Status Check

Run this single query to get overall status:

```sql
SELECT 
    'Tables: ' || (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts', 'post_targets', 'media_assets', 'schedules', 'queue_jobs', 'tags', 'post_tags', 'analytics_events', 'webhook_events', 'activity_logs', 'oauth_states')) || '/15, ' ||
    'Indexes: ' || (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') || '+, ' ||
    'Functions: ' || (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('refresh_expiring_tokens', 'cleanup_expired_oauth_states_batch', 'get_queue_stats', 'get_workspace_stats', 'create_default_workspace_for_user')) || '+'
    as migration_status;
```

**Expected output if successful:**
```
Tables: 15/15, Indexes: 50+, Functions: 5+
```

## 🛠️ Using PowerShell Script

If Supabase CLI is linked:

```powershell
cd "D:\Downloads\LeadMap-main\LeadMap-main"
.\verify_postiz_migrations.ps1
```

If not linked, link first:
```powershell
supabase link --project-ref bqkucdaefpfkunceftye
.\verify_postiz_migrations.ps1
```

## 📝 Migration Files Reference

If verification shows missing components, run these migrations in order:

1. `supabase/migrations/create_postiz_workspaces.sql`
2. `supabase/migrations/create_postiz_data_model.sql`
3. `supabase/migrations/create_oauth_states_table.sql`
4. `supabase/migrations/optimize_postiz_for_scale.sql`
5. `supabase/migrations/add_user_id_to_credentials.sql`

---

**💡 Tip:** The SQL file method (`verify_postiz_migrations.sql`) is the most reliable and provides detailed results!
