# PowerShell script to apply unibox activity logs migration
# This creates the logging table for unibox operations

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Unibox Activity Logs Migration" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Get the migration file path
$migrationFile = Join-Path $PSScriptRoot "migrations\create_unibox_activity_logs.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "Error: Migration file not found at $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Migration file found: $migrationFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "This migration will:" -ForegroundColor Yellow
Write-Host "  ✓ Create unibox_activity_logs table for logging all unibox operations" -ForegroundColor White
Write-Host "  ✓ Add indexes for efficient querying" -ForegroundColor White
Write-Host "  ✓ Set up RLS policies for multi-user isolation" -ForegroundColor White
Write-Host "  ✓ Create cleanup function for old logs" -ForegroundColor White
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "To apply this migration, you have two options:" -ForegroundColor Yellow
Write-Host ""

Write-Host "OPTION 1: Supabase Dashboard (Recommended)" -ForegroundColor Green
Write-Host "  1. Go to https://supabase.com/dashboard" -ForegroundColor White
Write-Host "  2. Select your project" -ForegroundColor White
Write-Host "  3. Navigate to SQL Editor" -ForegroundColor White
Write-Host "  4. Create a new query" -ForegroundColor White
Write-Host "  5. Copy and paste the contents of:" -ForegroundColor White
Write-Host "     $migrationFile" -ForegroundColor Cyan
Write-Host "  6. Click 'Run'" -ForegroundColor White
Write-Host ""

Write-Host "OPTION 2: Using Supabase CLI" -ForegroundColor Green
Write-Host "  If you have Supabase CLI installed:" -ForegroundColor White
Write-Host "    supabase db remote execute --file `"$migrationFile`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Or using npx (no installation required):" -ForegroundColor White
Write-Host "    npx supabase db remote execute --file `"$migrationFile`"" -ForegroundColor Cyan
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Reading migration file..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray
Get-Content $migrationFile
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

Write-Host "After running the migration, verify it worked:" -ForegroundColor Yellow
Write-Host "  1. Check the table exists:" -ForegroundColor White
Write-Host "     SELECT table_name FROM information_schema.tables WHERE table_name = 'unibox_activity_logs';" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Test logging by accessing the unibox inbox" -ForegroundColor White
Write-Host ""
Write-Host "  3. Verify logs are being created:" -ForegroundColor White
Write-Host "     SELECT COUNT(*) FROM unibox_activity_logs;" -ForegroundColor Cyan
Write-Host ""

