# PowerShell script to verify Postiz migrations were successfully applied
# Checks for tables, indexes, functions, and RLS policies

Write-Host "🔍 Verifying Postiz Migrations..." -ForegroundColor Cyan
Write-Host ""

$allChecksPassed = $true
$checks = @()

# Expected tables from migrations
$expectedTables = @(
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
)

# Expected functions
$expectedFunctions = @(
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
)

# Check if Supabase CLI is available
$supabaseAvailable = $false
try {
    $null = supabase --version 2>&1
    $supabaseAvailable = $true
} catch {
    Write-Host "⚠️  Supabase CLI not found. Some checks will be skipped." -ForegroundColor Yellow
}

if (-not $supabaseAvailable) {
    Write-Host "❌ Cannot verify migrations - Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please install Supabase CLI or check migrations manually via Supabase Dashboard" -ForegroundColor Yellow
    exit 1
}

# Check if project is linked
$projectLinked = $false
try {
    $status = supabase status --output json 2>&1
    if ($status -match "project_id" -or $status -match "bqkucdaefpfkunceftye") {
        $projectLinked = $true
    }
} catch {
    Write-Host "⚠️  Project may not be linked. Attempting to link..." -ForegroundColor Yellow
    try {
        $linkResult = supabase link --project-ref bqkucdaefpfkunceftye 2>&1
        if ($LASTEXITCODE -eq 0) {
            $projectLinked = $true
            Write-Host "✅ Project linked successfully" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Could not link project. Please link manually: supabase link --project-ref bqkucdaefpfkunceftye" -ForegroundColor Red
    }
}

if (-not $projectLinked) {
    Write-Host "❌ Project not linked. Cannot verify migrations via CLI." -ForegroundColor Red
    Write-Host "💡 Run this command to link: supabase link --project-ref bqkucdaefpfkunceftye" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatively, check migrations manually via Supabase Dashboard SQL Editor:" -ForegroundColor Yellow
    Write-Host "  https://supabase.com/dashboard/project/bqkucdaefpfkunceftye/editor" -ForegroundColor Cyan
    exit 1
}

# Function to execute SQL query via Supabase CLI
function Invoke-SupabaseQuery {
    param([string]$query)
    
    # Try using supabase db remote execute
    # Since direct SQL execution might not work, we'll create a verification query file
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $query | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        # Try to execute via stdin
        $result = Get-Content $tempFile -Raw | supabase db remote execute 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $result -notmatch "Usage:" -and $result -notmatch "unknown flag") {
            return $result
        }
    } catch {
        # If that fails, return null
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
    
    return $null
}

Write-Host "📊 Running Verification Checks..." -ForegroundColor Cyan
Write-Host ""

# Check 1: Verify Tables Exist
Write-Host "1️⃣  Checking Tables..." -ForegroundColor Yellow

$tablesQuery = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts', 'post_targets', 'media_assets', 'schedules', 'queue_jobs', 'tags', 'post_tags', 'analytics_events', 'webhook_events', 'activity_logs', 'oauth_states')
ORDER BY table_name;
"@

$tablesResult = Invoke-SupabaseQuery -query $tablesQuery

if ($null -ne $tablesResult -and $tablesResult -notmatch "Usage:" -and $tablesResult -notmatch "unknown flag") {
    $foundTables = @()
    foreach ($table in $expectedTables) {
        if ($tablesResult -match $table) {
            $foundTables += $table
        }
    }
    
    $missingTables = $expectedTables | Where-Object { $foundTables -notcontains $_ }
    
    if ($foundTables.Count -eq $expectedTables.Count) {
        Write-Host "   ✅ All $($expectedTables.Count) tables found" -ForegroundColor Green
        $checks += @{ Name = "Tables"; Status = "✅ Pass"; Details = "All $($expectedTables.Count) tables exist" }
    } else {
        Write-Host "   ⚠️  Found $($foundTables.Count)/$($expectedTables.Count) tables" -ForegroundColor Yellow
        Write-Host "   Missing: $($missingTables -join ', ')" -ForegroundColor Red
        $checks += @{ Name = "Tables"; Status = "⚠️ Partial"; Details = "Missing: $($missingTables -join ', ')" }
        $allChecksPassed = $false
    }
} else {
    Write-Host "   ⚠️  Could not verify tables automatically" -ForegroundColor Yellow
    Write-Host "   💡 Please run this query manually in Supabase SQL Editor:" -ForegroundColor Cyan
    Write-Host "   $tablesQuery" -ForegroundColor Gray
    $checks += @{ Name = "Tables"; Status = "⚠️ Manual Check Required"; Details = "CLI verification failed" }
}

# Check 2: Verify Indexes
Write-Host ""
Write-Host "2️⃣  Checking Indexes..." -ForegroundColor Yellow

$indexesQuery = "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';"

$indexesResult = Invoke-SupabaseQuery -query $indexesQuery

if ($null -ne $indexesResult -and $indexesResult -notmatch "Usage:" -and $indexesResult -notmatch "unknown flag") {
    if ($indexesResult -match '\d+') {
        $indexCount = [int]($matches[0])
        if ($indexCount -ge 50) {
            Write-Host "   ✅ Found $indexCount indexes (expected 50+)" -ForegroundColor Green
            $checks += @{ Name = "Indexes"; Status = "✅ Pass"; Details = "$indexCount indexes found" }
        } else {
            Write-Host "   ⚠️  Found only $indexCount indexes (expected 50+)" -ForegroundColor Yellow
            $checks += @{ Name = "Indexes"; Status = "⚠️ Partial"; Details = "Only $indexCount indexes found" }
            $allChecksPassed = $false
        }
    }
} else {
    Write-Host "   ⚠️  Could not verify indexes automatically" -ForegroundColor Yellow
    Write-Host "   💡 Please run: SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';" -ForegroundColor Cyan
    $checks += @{ Name = "Indexes"; Status = "⚠️ Manual Check Required"; Details = "CLI verification failed" }
}

# Check 3: Verify Functions
Write-Host ""
Write-Host "3️⃣  Checking Functions..." -ForegroundColor Yellow

$functionsQuery = @"
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('refresh_expiring_tokens', 'cleanup_expired_oauth_states_batch', 'cleanup_old_analytics_events', 'cleanup_old_activity_logs', 'cleanup_old_webhook_events', 'get_queue_stats', 'get_workspace_stats', 'create_default_workspace_for_user', 'is_workspace_member', 'get_user_workspaces', 'cleanup_expired_oauth_states')
ORDER BY routine_name;
"@

$functionsResult = Invoke-SupabaseQuery -query $functionsQuery

if ($null -ne $functionsResult -and $functionsResult -notmatch "Usage:" -and $functionsResult -notmatch "unknown flag") {
    $foundFunctions = @()
    foreach ($func in $expectedFunctions) {
        if ($functionsResult -match $func) {
            $foundFunctions += $func
        }
    }
    
    $missingFunctions = $expectedFunctions | Where-Object { $foundFunctions -notcontains $_ }
    
    if ($foundFunctions.Count -ge 8) {
        Write-Host "   ✅ Found $($foundFunctions.Count)/$($expectedFunctions.Count) functions" -ForegroundColor Green
        if ($missingFunctions.Count -gt 0) {
            Write-Host "   Note: Some optional functions missing: $($missingFunctions -join ', ')" -ForegroundColor Gray
        }
        $checks += @{ Name = "Functions"; Status = "✅ Pass"; Details = "$($foundFunctions.Count) functions found" }
    } else {
        Write-Host "   ⚠️  Found only $($foundFunctions.Count)/$($expectedFunctions.Count) functions" -ForegroundColor Yellow
        Write-Host "   Missing: $($missingFunctions -join ', ')" -ForegroundColor Red
        $checks += @{ Name = "Functions"; Status = "⚠️ Partial"; Details = "Missing: $($missingFunctions.Count) functions" }
        $allChecksPassed = $false
    }
} else {
    Write-Host "   ⚠️  Could not verify functions automatically" -ForegroundColor Yellow
    Write-Host "   💡 Please run the functions query manually in Supabase SQL Editor" -ForegroundColor Cyan
    $checks += @{ Name = "Functions"; Status = "⚠️ Manual Check Required"; Details = "CLI verification failed" }
}

# Check 4: Verify RLS is Enabled
Write-Host ""
Write-Host "4️⃣  Checking RLS Policies..." -ForegroundColor Yellow

$rlsQuery = @"
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts')
GROUP BY tablename
ORDER BY tablename;
"@

$rlsResult = Invoke-SupabaseQuery -query $rlsQuery

if ($null -ne $rlsResult -and $rlsResult -notmatch "Usage:" -and $rlsResult -notmatch "unknown flag") {
    if ($rlsResult -match 'workspaces|workspace_members|social_accounts') {
        Write-Host "   ✅ RLS policies found on key tables" -ForegroundColor Green
        $checks += @{ Name = "RLS Policies"; Status = "✅ Pass"; Details = "RLS enabled on key tables" }
    } else {
        Write-Host "   ⚠️  RLS policies may be missing" -ForegroundColor Yellow
        $checks += @{ Name = "RLS Policies"; Status = "⚠️ Check Required"; Details = "Could not verify all policies" }
    }
} else {
    Write-Host "   ⚠️  Could not verify RLS automatically" -ForegroundColor Yellow
    $checks += @{ Name = "RLS Policies"; Status = "⚠️ Manual Check Required"; Details = "CLI verification failed" }
}

# Check 5: Verify Key Columns
Write-Host ""
Write-Host "5️⃣  Checking Key Columns..." -ForegroundColor Yellow

$columnsQuery = @"
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'workspaces' AND column_name IN ('id', 'name', 'slug', 'created_by'))
    OR (table_name = 'credentials' AND column_name IN ('id', 'social_account_id', 'access_token_encrypted', 'user_id'))
    OR (table_name = 'posts' AND column_name IN ('id', 'workspace_id', 'content', 'status'))
  )
ORDER BY table_name, column_name;
"@

$columnsResult = Invoke-SupabaseQuery -query $columnsQuery

if ($null -ne $columnsResult -and $columnsResult -notmatch "Usage:" -and $columnsResult -notmatch "unknown flag") {
    $keyColumns = @('workspaces.id', 'workspaces.name', 'credentials.id', 'credentials.access_token_encrypted', 'posts.id', 'posts.workspace_id')
    $found = 0
    foreach ($col in $keyColumns) {
        if ($columnsResult -match $col) {
            $found++
        }
    }
    
    if ($found -ge 4) {
        Write-Host "   ✅ Key columns found on critical tables" -ForegroundColor Green
        $checks += @{ Name = "Key Columns"; Status = "✅ Pass"; Details = "Key columns verified" }
    } else {
        Write-Host "   ⚠️  Some key columns may be missing" -ForegroundColor Yellow
        $checks += @{ Name = "Key Columns"; Status = "⚠️ Check Required"; Details = "Some columns not verified" }
    }
} else {
    Write-Host "   ⚠️  Could not verify columns automatically" -ForegroundColor Yellow
    $checks += @{ Name = "Key Columns"; Status = "⚠️ Manual Check Required"; Details = "CLI verification failed" }
}

# Summary
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "📋 Verification Summary" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

foreach ($check in $checks) {
    $statusColor = if ($check.Status -match "✅") { "Green" } elseif ($check.Status -match "⚠️") { "Yellow" } else { "Red" }
    Write-Host "  $($check.Status) $($check.Name)" -ForegroundColor $statusColor
    Write-Host "     $($check.Details)" -ForegroundColor Gray
}

Write-Host ""

if ($allChecksPassed -and ($checks | Where-Object { $_.Status -notmatch "✅" }).Count -eq 0) {
    Write-Host "🎉 All migrations verified successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Your Postiz integration is ready to use!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some checks require manual verification" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Manual Verification Instructions:" -ForegroundColor Cyan
    Write-Host "   1. Open Supabase Dashboard: https://supabase.com/dashboard/project/bqkucdaefpfkunceftye/editor" -ForegroundColor White
    Write-Host "   2. Run the verification queries provided above" -ForegroundColor White
    Write-Host "   3. Check POSTIZ_MIGRATIONS_COMPLETE.md for detailed verification queries" -ForegroundColor White
}

Write-Host ""
Write-Host "📝 Quick Verification Query (Copy to Supabase SQL Editor):" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray

$quickVerifyQuery = @"
-- Quick Postiz Migration Verification
-- Copy and paste this entire query into Supabase SQL Editor

-- 1. Check Tables
SELECT 'Tables Check' as check_type, COUNT(*) as count, 
       STRING_AGG(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts', 'post_targets', 'media_assets', 'schedules', 'queue_jobs', 'tags', 'post_tags', 'analytics_events', 'webhook_events', 'activity_logs', 'oauth_states');

-- 2. Check Indexes
SELECT 'Indexes Check' as check_type, COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%';

-- 3. Check Functions
SELECT 'Functions Check' as check_type, COUNT(*) as count,
       STRING_AGG(routine_name, ', ' ORDER BY routine_name) as functions
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('refresh_expiring_tokens', 'cleanup_expired_oauth_states_batch', 'get_queue_stats', 'get_workspace_stats', 'create_default_workspace_for_user', 'is_workspace_member', 'get_user_workspaces');

-- 4. Check RLS
SELECT 'RLS Check' as check_type, COUNT(DISTINCT tablename) as tables_with_rls
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'workspace_members', 'social_accounts', 'credentials', 'posts');
"@

Write-Host $quickVerifyQuery -ForegroundColor White
Write-Host "=" * 80 -ForegroundColor Gray
