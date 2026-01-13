# PowerShell Script to Run Postiz Migrations NOW
# This script provides the exact commands to run the migrations

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Postiz Migration Runner - Ready to Execute" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$currentDir = Get-Location
$projectRoot = Split-Path $currentDir -Parent
$migrationDir = Join-Path $projectRoot "supabase\migrations"

Write-Host "📁 Project Root: $projectRoot" -ForegroundColor Gray
Write-Host "📁 Migrations Directory: $migrationDir" -ForegroundColor Gray
Write-Host ""

Write-Host "=========================================" -ForegroundColor Green
Write-Host "METHOD 1: Supabase SQL Editor (Easiest)" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "1. Open your Supabase project dashboard" -ForegroundColor White
Write-Host "2. Go to SQL Editor" -ForegroundColor White
Write-Host "3. Copy and paste each migration file content in order:" -ForegroundColor White
Write-Host ""

$migrations = @(
    "create_postiz_workspaces.sql",
    "create_postiz_data_model.sql",
    "create_oauth_states_table.sql",
    "optimize_postiz_for_scale.sql",
    "add_user_id_to_credentials.sql"
)

for ($i = 0; $i -lt $migrations.Length; $i++) {
    $num = $i + 1
    $filePath = Join-Path $migrationDir $migrations[$i]
    Write-Host "$num. $filePath" -ForegroundColor Yellow

    if (Test-Path $filePath) {
        $fileSize = (Get-Item $filePath).Length
        Write-Host "   ✅ File exists ($fileSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ File not found!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "METHOD 2: Direct psql Commands" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "If you have psql access, run these commands:" -ForegroundColor Yellow
Write-Host ""

# Get Supabase connection string (you'll need to replace this)
Write-Host "# First, get your Supabase database URL from:" -ForegroundColor Gray
Write-Host "# Supabase Dashboard → Settings → Database → Connection string" -ForegroundColor Gray
Write-Host ""
Write-Host '$env:DATABASE_URL = "postgresql://postgres:[password]@[host]:5432/postgres"' -ForegroundColor Gray
Write-Host ""

Write-Host "# Then run each migration:" -ForegroundColor Yellow
foreach ($migration in $migrations) {
    $filePath = Join-Path $migrationDir $migration
    Write-Host "psql `$env:DATABASE_URL -f `"$filePath`"" -ForegroundColor White
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "METHOD 3: Supabase CLI (If Linked)" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "# If your project is linked to Supabase CLI:" -ForegroundColor Yellow
foreach ($migration in $migrations) {
    $filePath = Join-Path $migrationDir $migration
    Write-Host "supabase db push --file `"$filePath`"" -ForegroundColor White
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION QUERIES" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "# Check tables were created:" -ForegroundColor Yellow
Write-Host "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'workspaces' OR table_name LIKE 'social_%' OR table_name LIKE '%post%' ORDER BY table_name;" -ForegroundColor White
Write-Host ""

Write-Host "# Check indexes were created:" -ForegroundColor Yellow
Write-Host "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';" -ForegroundColor White
Write-Host ""

Write-Host "# Check functions were created:" -ForegroundColor Yellow
Write-Host "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'refresh_%' ORDER BY routine_name;" -ForegroundColor White
Write-Host ""

Write-Host "=========================================" -ForegroundColor Green
Write-Host "NEXT STEPS AFTER MIGRATION" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "1. Set environment variables:" -ForegroundColor White
Write-Host "   POSTIZ_BATCH_API_KEY=your-secure-api-key-here" -ForegroundColor Gray
Write-Host "   POSTIZ_WORKER_API_KEY=your-worker-api-key-here" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Test the setup:" -ForegroundColor White
Write-Host "   - Create a workspace" -ForegroundColor Gray
Write-Host "   - Connect a social media account" -ForegroundColor Gray
Write-Host "   - Create and schedule a post" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Start background workers:" -ForegroundColor White
Write-Host "   - Token refresh worker (hourly)" -ForegroundColor Gray
Write-Host "   - Queue processing worker (continuous)" -ForegroundColor Gray
Write-Host ""

Write-Host "=========================================" -ForegroundColor Magenta
Write-Host "🚀 READY TO RUN MIGRATIONS!" -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "Choose your preferred method above and execute the migrations in order." -ForegroundColor White
Write-Host "Each migration depends on the previous ones, so run them sequentially." -ForegroundColor Yellow
Write-Host ""

# Check if files exist
Write-Host "File Status Check:" -ForegroundColor Cyan
$allFilesExist = $true
foreach ($migration in $migrations) {
    $filePath = Join-Path $migrationDir $migration
    if (Test-Path $filePath) {
        Write-Host "✅ $migration" -ForegroundColor Green
    } else {
        Write-Host "❌ $migration - MISSING!" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if ($allFilesExist) {
    Write-Host ""
    Write-Host "🎉 All migration files are present and ready!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Some migration files are missing. Please check the supabase/migrations directory." -ForegroundColor Yellow
}