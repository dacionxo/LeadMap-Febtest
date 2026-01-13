# Connect Supabase CLI to Project Script
# Connects to project: bqkucdaefpfkunceftye

param(
    [string]$ProjectRef = "bqkucdaefpfkunceftye"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Connect Supabase CLI to Project" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find Supabase CLI
$supabasePath = Get-ChildItem -Path "$env:LOCALAPPDATA" -Recurse -Filter "supabase.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-not $supabasePath) {
    Write-Host "✗ Supabase CLI not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Close and reopen your terminal" -ForegroundColor White
    Write-Host "2. Run: supabase login" -ForegroundColor Cyan
    Write-Host "3. Run: supabase link --project-ref $ProjectRef" -ForegroundColor Cyan
    exit 1
}

Write-Host "Found Supabase CLI: $supabasePath" -ForegroundColor Green
Write-Host ""

# Step 1: Check login status
Write-Host "Step 1: Checking login status..." -ForegroundColor Green
$projects = & $supabasePath projects list 2>&1

if ($LASTEXITCODE -ne 0) {
    if ($projects -match "not logged in" -or $projects -match "authentication") {
        Write-Host "⚠ Not logged in" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please run:" -ForegroundColor Yellow
        Write-Host "  supabase login" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "This will open your browser for authentication." -ForegroundColor White
        exit 1
    } else {
        Write-Host "✗ Error checking projects: $projects" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Logged in successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available projects:" -ForegroundColor Gray
    $projects | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}

Write-Host ""

# Step 2: Link to project
Write-Host "Step 2: Linking to project: $ProjectRef" -ForegroundColor Green
$linkResult = & $supabasePath link --project-ref $ProjectRef 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully linked to project: $ProjectRef" -ForegroundColor Green
} else {
    if ($linkResult -match "already linked") {
        Write-Host "✓ Project already linked" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to link: $linkResult" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Step 3: Verify connection
Write-Host "Step 3: Verifying connection..." -ForegroundColor Green
$status = & $supabasePath status 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Connection verified" -ForegroundColor Green
    Write-Host ""
    Write-Host "Project status:" -ForegroundColor Gray
    $status | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "⚠ Status check failed (this is OK if not using local development)" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Test database connection
Write-Host "Step 4: Testing database connection..." -ForegroundColor Green
$tables = & $supabasePath db remote list 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database connection successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Found tables:" -ForegroundColor Gray
    $tables | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "✗ Database connection failed: $tables" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Test query
Write-Host "Step 5: Running test query..." -ForegroundColor Green
$testQuery = "SELECT COUNT(*) as total_mailboxes FROM mailboxes WHERE provider = 'gmail';"
$queryResult = & $supabasePath db remote execute $testQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Query executed successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Result:" -ForegroundColor Gray
    $queryResult | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "⚠ Query failed (this is OK if table doesn't exist yet): $queryResult" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Connection Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectRef" -ForegroundColor White
Write-Host "Status: Connected" -ForegroundColor Green
Write-Host ""
Write-Host "You can now use Supabase CLI commands:" -ForegroundColor Yellow
Write-Host "  supabase db remote list" -ForegroundColor Cyan
Write-Host "  supabase db remote execute \"YOUR_SQL_QUERY\"" -ForegroundColor Cyan
Write-Host ""

