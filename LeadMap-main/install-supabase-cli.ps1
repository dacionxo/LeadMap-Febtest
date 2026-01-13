# Install Supabase CLI Script
# Downloads and installs Supabase CLI for Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase CLI Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get latest release URL
$releasesUrl = "https://api.github.com/repos/supabase/cli/releases/latest"
try {
    $release = Invoke-RestMethod -Uri $releasesUrl -UseBasicParsing
    $supabaseUrl = ($release.assets | Where-Object { $_.name -like "*windows*amd64*.zip" }).browser_download_url
    if (-not $supabaseUrl) {
        # Fallback to known URL pattern
        $supabaseUrl = "https://github.com/supabase/cli/releases/latest/download/supabase_${release.tag_name}_windows_amd64.zip"
    }
    Write-Host "Latest version: $($release.tag_name)" -ForegroundColor Gray
} catch {
    Write-Host "⚠ Could not fetch latest release, using fallback URL" -ForegroundColor Yellow
    $supabaseUrl = "https://github.com/supabase/cli/releases/download/v1.200.0/supabase_1.200.0_windows_amd64.zip"
}
$downloadPath = "$env:TEMP\supabase.zip"
$installPath = "$env:LOCALAPPDATA\supabase"

# Step 1: Download
Write-Host "Step 1: Downloading Supabase CLI..." -ForegroundColor Green
try {
    Invoke-WebRequest -Uri $supabaseUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "✓ Download complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Download failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Extract
Write-Host ""
Write-Host "Step 2: Extracting..." -ForegroundColor Green
if (Test-Path $installPath) {
    Remove-Item $installPath -Recurse -Force
}
Expand-Archive -Path $downloadPath -DestinationPath $installPath -Force
Write-Host "✓ Extraction complete" -ForegroundColor Green

# Step 3: Find executable
Write-Host ""
Write-Host "Step 3: Locating executable..." -ForegroundColor Green
$exePath = Get-ChildItem -Path $installPath -Recurse -Filter "supabase.exe" | Select-Object -First 1 -ExpandProperty FullName

if (-not $exePath) {
    Write-Host "✗ supabase.exe not found" -ForegroundColor Red
    exit 1
}

$binPath = Split-Path $exePath
Write-Host "✓ Found at: $exePath" -ForegroundColor Green

# Step 4: Add to PATH
Write-Host ""
Write-Host "Step 4: Adding to PATH..." -ForegroundColor Green

# Add to current session
$env:Path += ";$binPath"

# Add to user PATH permanently
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binPath", "User")
    Write-Host "✓ Added to user PATH permanently" -ForegroundColor Green
} else {
    Write-Host "✓ Already in PATH" -ForegroundColor Green
}

# Step 5: Verify
Write-Host ""
Write-Host "Step 5: Verifying installation..." -ForegroundColor Green
try {
    $version = & $exePath --version 2>&1
    Write-Host "✓ Installation successful!" -ForegroundColor Green
    Write-Host "  Version: $version" -ForegroundColor Gray
} catch {
    Write-Host "⚠ Installation complete, but verification failed" -ForegroundColor Yellow
    Write-Host "  You may need to restart your terminal" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Close and reopen your terminal" -ForegroundColor White
Write-Host "2. Run: supabase login" -ForegroundColor Cyan
Write-Host "3. Run: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation path: $binPath" -ForegroundColor Gray
Write-Host ""

# Cleanup
if (Test-Path $downloadPath) {
    Remove-Item $downloadPath -Force
    Write-Host "Cleaned up download file" -ForegroundColor Gray
}

