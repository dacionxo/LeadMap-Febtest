# PowerShell script to push Postiz migrations to Supabase
# Uses Supabase CLI to execute SQL migrations in order

Write-Host "🚀 Starting Postiz Migration Push to Supabase..." -ForegroundColor Green
Write-Host ""

$migrationDir = "supabase\migrations"
$migrations = @(
    "create_postiz_workspaces.sql",
    "create_postiz_data_model.sql",
    "create_oauth_states_table.sql",
    "optimize_postiz_for_scale.sql",
    "add_user_id_to_credentials.sql"
)

$successCount = 0
$failCount = 0

foreach ($migration in $migrations) {
    $migrationPath = Join-Path $migrationDir $migration
    
    if (-not (Test-Path $migrationPath)) {
        Write-Host "❌ Migration file not found: $migrationPath" -ForegroundColor Red
        $failCount++
        continue
    }
    
    Write-Host "📄 Running migration: $migration" -ForegroundColor Cyan
    
    try {
        # Read the SQL file content
        $sqlContent = Get-Content $migrationPath -Raw
        
        # Escape single quotes and newlines for PowerShell
        $sqlEscaped = $sqlContent -replace "'", "''" -replace "`r`n", "`n"
        
        # Execute using Supabase CLI
        # Note: We need to pass SQL as a string, but Supabase CLI may have limitations
        # So we'll try using psql or direct connection
        
        # Try using supabase db remote execute with the SQL content
        # First, let's check if we can get the database URL
        $dbUrl = supabase status --output env | Select-String "DB_URL" | ForEach-Object { $_.ToString().Split("=")[1] }
        
        if ($dbUrl) {
            # Use psql if available
            Write-Host "   Executing via psql..." -ForegroundColor Yellow
            $sqlContent | psql $dbUrl
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Migration completed: $migration" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "   ❌ Migration failed: $migration" -ForegroundColor Red
                Write-Host "   💡 Trying alternative method..." -ForegroundColor Yellow
                throw "psql execution failed"
            }
        } else {
            # Alternative: Use Supabase Management API
            Write-Host "   ⚠️  Direct execution not available. Please run manually:" -ForegroundColor Yellow
            Write-Host "   1. Go to Supabase Dashboard > SQL Editor" -ForegroundColor White
            Write-Host "   2. Copy and paste the contents of: $migrationPath" -ForegroundColor White
            Write-Host "   3. Click 'Run'" -ForegroundColor White
            Write-Host ""
            throw "Manual execution required"
        }
        
    } catch {
        Write-Host "   ❌ Error executing migration: $migration" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        
        # Provide manual instructions
        Write-Host ""
        Write-Host "   📋 Manual Execution Instructions:" -ForegroundColor Yellow
        Write-Host "   1. Open Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor White
        Write-Host "   2. Select your project" -ForegroundColor White
        Write-Host "   3. Navigate to SQL Editor" -ForegroundColor White
        Write-Host "   4. Create a new query" -ForegroundColor White
        Write-Host "   5. Copy and paste the contents of: $migrationPath" -ForegroundColor White
        Write-Host "   6. Click 'Run' and wait for completion" -ForegroundColor White
        Write-Host ""
        
        $failCount++
        continue
    }
    
    Write-Host ""
}

Write-Host "=" * 80 -ForegroundColor Gray
Write-Host "Migration Summary:" -ForegroundColor Green
Write-Host "  ✅ Successful: $successCount" -ForegroundColor Green
Write-Host "  ❌ Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "🎉 All migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔧 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Set POSTIZ_BATCH_API_KEY environment variable" -ForegroundColor White
    Write-Host "  2. Configure cron jobs for token refresh and cleanup" -ForegroundColor White
    Write-Host "  3. Test OAuth flows with social media providers" -ForegroundColor White
} else {
    Write-Host "⚠️  Some migrations failed. Please run them manually using the instructions above." -ForegroundColor Yellow
}
