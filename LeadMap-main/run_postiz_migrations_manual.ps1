# PowerShell Script to Run Postiz Migrations Manually
# This script shows the commands to run each migration file

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Postiz Migration Runner" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script provides the commands to run Postiz migrations manually." -ForegroundColor Yellow
Write-Host "You need to run these commands in your Supabase SQL Editor or via psql." -ForegroundColor Yellow
Write-Host ""

# Migration files in order
$migrations = @(
    "supabase/migrations/create_postiz_workspaces.sql",
    "supabase/migrations/create_postiz_data_model.sql",
    "supabase/migrations/create_oauth_states_table.sql",
    "supabase/migrations/optimize_postiz_for_scale.sql",
    "supabase/migrations/add_user_id_to_credentials.sql"
)

Write-Host "📋 Migration Files to Run (in order):" -ForegroundColor Green
Write-Host ""

for ($i = 0; $i -lt $migrations.Length; $i++) {
    $num = $i + 1
    Write-Host "$num. $($migrations[$i])" -ForegroundColor White
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Option 1: Supabase SQL Editor (Recommended)" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open your Supabase project dashboard" -ForegroundColor White
Write-Host "2. Go to SQL Editor" -ForegroundColor White
Write-Host "3. Copy and paste the content of each file in order" -ForegroundColor White
Write-Host "4. Execute each migration before moving to the next" -ForegroundColor White
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Option 2: Direct psql Commands" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you have psql access, run these commands:" -ForegroundColor Yellow
Write-Host ""

# Get current directory
$currentDir = Get-Location
$fullPath = Join-Path $currentDir "LeadMap-main"

Write-Host "# Set your Supabase database URL" -ForegroundColor Gray
Write-Host "# You can find this in your Supabase project settings" -ForegroundColor Gray
Write-Host '$env:DATABASE_URL = "your-supabase-connection-string"' -ForegroundColor Gray
Write-Host ""

foreach ($migration in $migrations) {
    $fullMigrationPath = Join-Path $fullPath $migration
    Write-Host "psql `$env:DATABASE_URL -f `"$fullMigrationPath`"" -ForegroundColor White
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Verification Commands" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "# Check tables were created" -ForegroundColor Yellow
Write-Host "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE 'workspaces' OR table_name LIKE 'social_%' OR table_name LIKE '%post%' OR table_name LIKE 'oauth_%') ORDER BY table_name;" -ForegroundColor White
Write-Host ""

Write-Host "# Check indexes were created" -ForegroundColor Yellow
Write-Host "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';" -ForegroundColor White
Write-Host ""

Write-Host "# Check functions were created" -ForegroundColor Yellow
Write-Host "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND (routine_name LIKE 'refresh_%' OR routine_name LIKE 'cleanup_%' OR routine_name LIKE 'get_%') ORDER BY routine_name;" -ForegroundColor White
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Next Steps After Migration" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Set environment variables:" -ForegroundColor White
Write-Host "   POSTIZ_BATCH_API_KEY=your-secure-random-api-key" -ForegroundColor Gray
Write-Host "   NEXT_PUBLIC_APP_URL=https://your-domain.com" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Configure OAuth provider keys (when ready to test):" -ForegroundColor White
Write-Host "   X_API_KEY=..." -ForegroundColor Gray
Write-Host "   X_API_SECRET=..." -ForegroundColor Gray
Write-Host "   LINKEDIN_CLIENT_ID=..." -ForegroundColor Gray
Write-Host "   LINKEDIN_CLIENT_SECRET=..." -ForegroundColor Gray
Write-Host ""

Write-Host "3. Set up cron jobs for:" -ForegroundColor White
Write-Host "   - Token refresh (every hour)" -ForegroundColor Gray
Write-Host "   - OAuth state cleanup (every 15 minutes)" -ForegroundColor Gray
Write-Host "   - Data retention cleanup (monthly)" -ForegroundColor Gray
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Migration Guide Available" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed instructions, see: POSTIZ_MIGRATIONS_GUIDE.md" -ForegroundColor Yellow
Write-Host ""

Write-Host "🎉 Ready to run migrations!" -ForegroundColor Green