# Fix Pub/Sub Ingestion Resource Error
# The error is caused by Cloud Storage ingestion being configured incorrectly
# Gmail publishes directly to the topic, so Cloud Storage ingestion is not needed

param(
    [string]$TopicName = "gmail-notifications3",
    [string]$ProjectId = "canvas-advice-479307-p4"
)

# Find gcloud
$gcloudPaths = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$gcloudCmd = $null
foreach ($path in $gcloudPaths) {
    if (Test-Path $path) {
        $gcloudCmd = $path
        break
    }
}

if (-not $gcloudCmd) {
    Write-Host "✗ gcloud not found" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Pub/Sub Ingestion Resource Error" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Topic: $TopicName" -ForegroundColor White
Write-Host "Project: $ProjectId" -ForegroundColor White
Write-Host ""

# Step 1: Check current state
Write-Host "Step 1: Checking current topic state..." -ForegroundColor Green
$topicInfo = & $gcloudCmd pubsub topics describe $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

Write-Host "  Current state: $($topicInfo.state)" -ForegroundColor $(if ($topicInfo.state -eq "ACTIVE") { "Green" } else { "Red" })

if ($topicInfo.ingestionDataSourceSettings) {
    Write-Host "  ⚠ Cloud Storage ingestion is configured" -ForegroundColor Yellow
    Write-Host "  This is causing the error - Gmail publishes directly, not through Cloud Storage" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ No Cloud Storage ingestion configured" -ForegroundColor Green
}

Write-Host ""

# Step 2: Clear Cloud Storage ingestion
if ($topicInfo.ingestionDataSourceSettings) {
    Write-Host "Step 2: Clearing Cloud Storage ingestion configuration..." -ForegroundColor Green
    
    $clearResult = & $gcloudCmd pubsub topics update $TopicName `
        --clear-ingestion-data-source-settings `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Cloud Storage ingestion cleared successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to clear ingestion: $clearResult" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Step 2: No Cloud Storage ingestion to clear" -ForegroundColor Green
}

Write-Host ""

# Step 3: Verify fix
Write-Host "Step 3: Verifying fix..." -ForegroundColor Green
Start-Sleep -Seconds 5  # Wait for state to update

$verifyInfo = & $gcloudCmd pubsub topics describe $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

Write-Host "  New state: $($verifyInfo.state)" -ForegroundColor $(if ($verifyInfo.state -eq "ACTIVE") { "Green" } else { "Yellow" })

if ($verifyInfo.state -eq "ACTIVE") {
    Write-Host "  ✓ Topic is now ACTIVE!" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Topic state may take a few minutes to update" -ForegroundColor Yellow
    Write-Host "  Check again in 2-3 minutes" -ForegroundColor Yellow
}

if (-not $verifyInfo.ingestionDataSourceSettings) {
    Write-Host "  ✓ Cloud Storage ingestion removed" -ForegroundColor Green
}

Write-Host ""

# Step 4: Verify permissions are still correct
Write-Host "Step 4: Verifying Gmail permissions..." -ForegroundColor Green
$policy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

$gmailSA = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
$hasPublisher = $false

if ($policy.bindings) {
    foreach ($binding in $policy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailSA) {
            $hasPublisher = $true
            break
        }
    }
}

if ($hasPublisher) {
    Write-Host "  ✓ Gmail service account has Pub/Sub Publisher permission" -ForegroundColor Green
} else {
    Write-Host "  ✗ Gmail service account missing permission!" -ForegroundColor Red
    Write-Host "  Run: .\fix-gmail-pubsub-permissions.ps1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait 2-3 minutes for topic state to update to ACTIVE" -ForegroundColor White
Write-Host "2. Re-setup Gmail Watch to ensure it uses the correct topic" -ForegroundColor White
Write-Host "3. Test by sending an email to your Gmail inbox" -ForegroundColor White
Write-Host "4. Check Pub/Sub metrics for published messages" -ForegroundColor White
Write-Host ""

