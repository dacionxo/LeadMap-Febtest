# Connect Vercel CLI to Your Project
# Helps you link your local project to Vercel

param(
    [string]$ProjectName = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Connect Vercel CLI to Project" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
$vercelVersion = vercel --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Vercel CLI not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install with:" -ForegroundColor Yellow
    Write-Host "  npm install -g vercel" -ForegroundColor Cyan
    exit 1
}

Write-Host "Found Vercel CLI: $vercelVersion" -ForegroundColor Green
Write-Host ""

# Step 1: Check login status
Write-Host "Step 1: Checking login status..." -ForegroundColor Green
$whoami = vercel whoami 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Logged in as: $whoami" -ForegroundColor Green
} else {
    Write-Host "⚠ Not logged in" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please run:" -ForegroundColor Yellow
    Write-Host "  vercel login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This will open your browser for authentication." -ForegroundColor White
    exit 1
}

Write-Host ""

# Step 2: Check if project is already linked
Write-Host "Step 2: Checking if project is linked..." -ForegroundColor Green

if (Test-Path ".vercel\project.json") {
    $projectInfo = Get-Content ".vercel\project.json" | ConvertFrom-Json
    Write-Host "✓ Project already linked!" -ForegroundColor Green
    Write-Host "  Project ID: $($projectInfo.projectId)" -ForegroundColor White
    Write-Host "  Org ID: $($projectInfo.orgId)" -ForegroundColor White
    Write-Host ""
    Write-Host "To link to a different project, run:" -ForegroundColor Yellow
    Write-Host "  vercel link" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "⚠ Project not linked" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Link project
Write-Host "Step 3: Linking project to Vercel..." -ForegroundColor Green
Write-Host ""
Write-Host "This will:" -ForegroundColor Gray
Write-Host "  1. Show you a list of your Vercel projects" -ForegroundColor Gray
Write-Host "  2. Let you select an existing project or create a new one" -ForegroundColor Gray
Write-Host "  3. Create a .vercel directory with project configuration" -ForegroundColor Gray
Write-Host ""

if ($ProjectName) {
    Write-Host "Attempting to link to project: $ProjectName" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "If the project doesn't exist, you'll be prompted to create it." -ForegroundColor Yellow
    Write-Host ""
    
    # Try to link with project name
    vercel link --yes --project=$ProjectName 2>&1
} else {
    Write-Host "Starting interactive link process..." -ForegroundColor Cyan
    Write-Host ""
    vercel link 2>&1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Project linked successfully!" -ForegroundColor Green
    
    if (Test-Path ".vercel\project.json") {
        $projectInfo = Get-Content ".vercel\project.json" | ConvertFrom-Json
        Write-Host ""
        Write-Host "Project Details:" -ForegroundColor Cyan
        Write-Host "  Project ID: $($projectInfo.projectId)" -ForegroundColor White
        Write-Host "  Org ID: $($projectInfo.orgId)" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "✗ Failed to link project" -ForegroundColor Red
    Write-Host "  Try running manually: vercel link" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 4: Verify connection
Write-Host "Step 4: Verifying connection..." -ForegroundColor Green
$projects = vercel ls 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Connection verified" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Vercel projects:" -ForegroundColor Gray
    $projects | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "⚠ Could not list projects" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Connection Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now use Vercel CLI commands:" -ForegroundColor Yellow
Write-Host "  vercel                    # Deploy to preview" -ForegroundColor Cyan
Write-Host "  vercel --prod             # Deploy to production" -ForegroundColor Cyan
Write-Host "  vercel env ls             # List environment variables" -ForegroundColor Cyan
Write-Host "  vercel env add            # Add environment variable" -ForegroundColor Cyan
Write-Host "  vercel logs               # View deployment logs" -ForegroundColor Cyan
Write-Host "  vercel inspect            # Inspect deployment" -ForegroundColor Cyan
Write-Host ""

