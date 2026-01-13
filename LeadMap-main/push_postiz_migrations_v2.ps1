# PowerShell script to push Postiz migrations to Supabase using Supabase CLI
# Reads each migration file and executes it using supabase db remote execute

Write-Host "🚀 Starting Postiz Migration Push to Supabase..." -ForegroundColor Green
Write-Host ""

$baseDir = Get-Location
$migrationDir = Join-Path $baseDir "supabase\migrations"

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
    Write-Host "   File: $migrationPath" -ForegroundColor Gray
    
    try {
        # Read the SQL file content
        $sqlContent = Get-Content $migrationPath -Raw -Encoding UTF8
        
        # For large SQL files, we need to split into smaller chunks
        # Supabase CLI may have limitations on SQL length, so we'll try executing the whole thing first
        # If that fails, we'll split by semicolons
        
        # Remove BOM if present
        $sqlContent = $sqlContent -replace "^\xEF\xBB\xBF", ""
        
        # Escape single quotes for PowerShell (double them)
        # Note: We'll pass it as a here-string to avoid escaping issues
        $tempFile = [System.IO.Path]::GetTempFileName()
        $sqlContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
        
        Write-Host "   Executing via Supabase CLI..." -ForegroundColor Yellow
        
        # Try using supabase db remote execute with file input
        # Since --file flag doesn't work, we'll use stdin
        $result = Get-Content $tempFile -Raw | supabase db remote execute 2>&1
        
        # Check exit code
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Migration completed: $migration" -ForegroundColor Green
            $successCount++
        } else {
            # If stdin doesn't work, try executing SQL directly as argument
            Write-Host "   ⚠️  stdin method failed, trying direct execution..." -ForegroundColor Yellow
            
            # Read content and try to pass as argument (may have issues with length)
            $sqlLines = Get-Content $migrationPath -Raw
            
            # Try executing with quotes
            $result2 = supabase db remote execute $sqlLines 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Migration completed: $migration" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "   ❌ Migration execution failed" -ForegroundColor Red
                Write-Host "   Error output:" -ForegroundColor Red
                Write-Host $result2 -ForegroundColor Red
                throw "Execution failed"
            }
        }
        
        # Clean up temp file
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        
    } catch {
        Write-Host "   ❌ Error executing migration: $migration" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        
        # Provide manual instructions
        Write-Host ""
        Write-Host "   📋 Manual Execution Instructions:" -ForegroundColor Yellow
        Write-Host "   1. Open Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor White
        Write-Host "   2. Select your project (bqkucdaefpfkunceftye)" -ForegroundColor White
        Write-Host "   3. Navigate to SQL Editor" -ForegroundColor White
        Write-Host "   4. Create a new query" -ForegroundColor White
        Write-Host "   5. Copy and paste the contents of: $migrationPath" -ForegroundColor White
        Write-Host "   6. Click 'Run' and wait for completion" -ForegroundColor White
        Write-Host ""
        
        $failCount++
        continue
    }
    
    Write-Host ""
    
    # Small delay between migrations
    Start-Sleep -Milliseconds 500
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
    Write-Host "  1. Verify tables were created (see verification queries below)" -ForegroundColor White
    Write-Host "  2. Set POSTIZ_BATCH_API_KEY environment variable" -ForegroundColor White
    Write-Host "  3. Configure cron jobs for token refresh and cleanup" -ForegroundColor White
    Write-Host "  4. Test OAuth flows with social media providers" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Verification Queries:" -ForegroundColor Cyan
    Write-Host '  supabase db remote execute "SELECT table_name FROM information_schema.tables WHERE table_schema = ''public'' AND (table_name LIKE ''workspaces'' OR table_name LIKE ''social_%'' OR table_name LIKE ''%post%'') ORDER BY table_name;"' -ForegroundColor White
} else {
    Write-Host "⚠️  Some migrations failed. Please run them manually using the instructions above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Tip: Large SQL files may need to be executed via Supabase Dashboard SQL Editor" -ForegroundColor Yellow
}
