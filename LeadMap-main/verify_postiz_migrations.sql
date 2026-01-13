-- ============================================================================
-- Postiz Migrations Verification Query
-- ============================================================================
-- Run this query in Supabase SQL Editor to verify all migrations were applied
-- ============================================================================

-- 1. CHECK TABLES
SELECT 
    'Tables Check' as check_type,
    COUNT(*) as found_count,
    15 as expected_count,
    CASE 
        WHEN COUNT(*) = 15 THEN '✅ PASS - All tables exist'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - Some tables missing'
        ELSE '❌ FAIL - No tables found'
    END as status,
    STRING_AGG(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'workspaces',
    'workspace_members',
    'social_accounts',
    'credentials',
    'posts',
    'post_targets',
    'media_assets',
    'schedules',
    'queue_jobs',
    'tags',
    'post_tags',
    'analytics_events',
    'webhook_events',
    'activity_logs',
    'oauth_states'
  );

-- 2. CHECK INDEXES
SELECT 
    'Indexes Check' as check_type,
    COUNT(*) as found_count,
    50 as expected_minimum,
    CASE 
        WHEN COUNT(*) >= 50 THEN '✅ PASS - Sufficient indexes'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - More indexes expected'
        ELSE '❌ FAIL - No indexes found'
    END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';

-- 3. CHECK FUNCTIONS
SELECT 
    'Functions Check' as check_type,
    COUNT(*) as found_count,
    7 as expected_minimum,
    CASE 
        WHEN COUNT(*) >= 7 THEN '✅ PASS - Core functions exist'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - Some functions missing'
        ELSE '❌ FAIL - No functions found'
    END as status,
    STRING_AGG(routine_name, ', ' ORDER BY routine_name) as functions
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'refresh_expiring_tokens',
    'cleanup_expired_oauth_states_batch',
    'cleanup_old_analytics_events',
    'cleanup_old_activity_logs',
    'cleanup_old_webhook_events',
    'get_queue_stats',
    'get_workspace_stats',
    'create_default_workspace_for_user',
    'is_workspace_member',
    'get_user_workspaces',
    'cleanup_expired_oauth_states'
  );

-- 4. CHECK RLS POLICIES
SELECT 
    'RLS Policies Check' as check_type,
    COUNT(DISTINCT tablename) as tables_with_rls,
    5 as expected_minimum,
    CASE 
        WHEN COUNT(DISTINCT tablename) >= 5 THEN '✅ PASS - RLS enabled on key tables'
        WHEN COUNT(DISTINCT tablename) > 0 THEN '⚠️ PARTIAL - Some tables missing RLS'
        ELSE '❌ FAIL - No RLS policies found'
    END as status,
    STRING_AGG(DISTINCT tablename, ', ' ORDER BY tablename) as tables
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts', 'queue_jobs');

-- 5. CHECK KEY COLUMNS
SELECT 
    'Key Columns Check' as check_type,
    COUNT(*) as found_count,
    12 as expected_count,
    CASE 
        WHEN COUNT(*) >= 12 THEN '✅ PASS - All key columns exist'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - Some columns missing'
        ELSE '❌ FAIL - No key columns found'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'workspaces' AND column_name IN ('id', 'name', 'slug', 'created_by', 'plan_tier', 'features'))
    OR (table_name = 'credentials' AND column_name IN ('id', 'social_account_id', 'access_token_encrypted', 'user_id', 'workspace_id'))
    OR (table_name = 'posts' AND column_name IN ('id', 'workspace_id', 'content', 'status', 'scheduled_at'))
  );

-- 6. CHECK TRIGGERS
SELECT 
    'Triggers Check' as check_type,
    COUNT(*) as found_count,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ PASS - Triggers configured'
        WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - Some triggers missing'
        ELSE '❌ FAIL - No triggers found'
    END as status,
    STRING_AGG(trigger_name, ', ' ORDER BY trigger_name) as triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%updated_at%' OR trigger_name LIKE '%workspace%');

-- 7. DETAILED TABLE CHECK
SELECT 
    'Detailed Table Check' as check_type,
    expected.table_name,
    CASE 
        WHEN actual.table_name IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (
    SELECT UNNEST(ARRAY[
        'workspaces',
        'workspace_members',
        'social_accounts',
        'credentials',
        'posts',
        'post_targets',
        'media_assets',
        'schedules',
        'queue_jobs',
        'tags',
        'post_tags',
        'analytics_events',
        'webhook_events',
        'activity_logs',
        'oauth_states'
    ]) as table_name
) expected
LEFT JOIN information_schema.tables actual
    ON actual.table_schema = 'public' 
    AND actual.table_name = expected.table_name
ORDER BY expected.table_name;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- ✅ PASS = Migration completed successfully
-- ⚠️ PARTIAL = Migration partially applied or some components missing
-- ❌ FAIL = Migration not applied or critical components missing
--
-- Expected Results:
-- - Tables: 15 tables should exist
-- - Indexes: 50+ indexes should exist (from optimize_postiz_for_scale.sql)
-- - Functions: 7+ functions should exist (core functions)
-- - RLS Policies: 5+ tables should have RLS enabled
-- - Key Columns: 12+ key columns should exist
-- - Triggers: 2+ triggers should exist (updated_at triggers)
-- ============================================================================
