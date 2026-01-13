# Google Cloud CLI Installation Script for Windows
# Run this script in PowerShell as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Google Cloud CLI Installation Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some features may not work." -ForegroundColor Yellow
    Write-Host "Right-click PowerShell and select 'Run as Administrator' for full installation." -ForegroundColor Yellow
    Write-Host ""
}

# Download installer
$installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"
$installerUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"

Write-Host "Step 1: Downloading Google Cloud SDK Installer..." -ForegroundColor Green
try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✓ Download complete: $installerPath" -ForegroundColor Green
} catch {
    Write-Host "✗ Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Starting installer..." -ForegroundColor Green
Write-Host "A window will open - please follow the installation wizard." -ForegroundColor Yellow
Write-Host ""

# Run installer
try {
    Start-Process -FilePath $installerPath -Wait
    Write-Host "✓ Installer completed" -ForegroundColor Green
} catch {
    Write-Host "✗ Installer failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Checking installation..." -ForegroundColor Green

# Check common installation paths
$gcloudPaths = @(
    "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$gcloudFound = $false
foreach ($path in $gcloudPaths) {
    if (Test-Path $path) {
        Write-Host "✓ Found gcloud at: $path" -ForegroundColor Green
        $gcloudFound = $true
        
        # Add to PATH for current session
        $binPath = Split-Path $path
        $env:Path += ";$binPath"
        
        # Verify installation
        Write-Host ""
        Write-Host "Verifying installation..." -ForegroundColor Cyan
        & $path --version
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Installation Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Close and reopen your terminal/PowerShell" -ForegroundColor White
        Write-Host "2. Run: gcloud init" -ForegroundColor White
        Write-Host "3. Follow the prompts to sign in and select your project" -ForegroundColor White
        Write-Host ""
        Write-Host "To verify installation, run:" -ForegroundColor Yellow
        Write-Host "  gcloud --version" -ForegroundColor White
        Write-Host ""
        break
    }
}

if (-not $gcloudFound) {
    Write-Host "⚠ gcloud not found in common installation paths." -ForegroundColor Yellow
    Write-Host "The installer may have installed to a custom location." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Close and reopen your terminal/PowerShell" -ForegroundColor White
    Write-Host "2. Run: gcloud --version" -ForegroundColor White
    Write-Host "3. If not found, manually add gcloud to your PATH" -ForegroundColor White
    Write-Host ""
}

# Cleanup
if (Test-Path $installerPath) {
    Write-Host "Cleaning up installer..." -ForegroundColor Gray
    Remove-Item $installerPath -Force
}

Write-Host ""
Write-Host "Script completed!" -ForegroundColor Green

