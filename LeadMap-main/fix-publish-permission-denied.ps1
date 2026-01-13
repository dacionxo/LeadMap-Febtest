# Fix "Publish permission denied" Error
# This script explicitly grants and verifies the permission

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
    $gcloudInPath = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($gcloudInPath) { $gcloudCmd = "gcloud" }
}

if (-not $gcloudCmd) {
    Write-Host "✗ gcloud not found" -ForegroundColor Red
    exit 1
}

$gmailServiceAccount = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
$topicFullName = "projects/$ProjectId/topics/$TopicName"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Publish Permission Denied Error" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Topic: $topicFullName" -ForegroundColor White
Write-Host "Service Account: $gmailServiceAccount" -ForegroundColor White
Write-Host ""

# Step 1: Check current permissions
Write-Host "Step 1: Checking current permissions..." -ForegroundColor Green
$currentPolicy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to get IAM policy: $currentPolicy" -ForegroundColor Red
    exit 1
}

$policyObj = $currentPolicy | ConvertFrom-Json
Write-Host "Current bindings:" -ForegroundColor Gray
$policyObj.bindings | ForEach-Object {
    Write-Host "  Role: $($_.role)" -ForegroundColor Gray
    Write-Host "  Members: $($_.members -join ', ')" -ForegroundColor Gray
}

$hasPermission = $false
if ($policyObj.bindings) {
    foreach ($binding in $policyObj.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailServiceAccount) {
            $hasPermission = $true
            Write-Host ""
            Write-Host "✓ Gmail service account already has permission" -ForegroundColor Green
            break
        }
    }
}

Write-Host ""

# Step 2: Grant permission (even if it exists, re-grant to ensure it's correct)
Write-Host "Step 2: Granting Pub/Sub Publisher permission..." -ForegroundColor Green
Write-Host "  Command: gcloud pubsub topics add-iam-policy-binding" -ForegroundColor Gray
Write-Host "  Topic: $TopicName" -ForegroundColor Gray
Write-Host "  Member: $gmailServiceAccount" -ForegroundColor Gray
Write-Host "  Role: roles/pubsub.publisher" -ForegroundColor Gray
Write-Host ""

$grantResult = & $gcloudCmd pubsub topics add-iam-policy-binding $TopicName `
    --member=$gmailServiceAccount `
    --role="roles/pubsub.publisher" `
    --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Permission granted successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to grant permission" -ForegroundColor Red
    Write-Host "Error: $grantResult" -ForegroundColor Red
    
    # Check if it's a duplicate binding error (which is actually OK)
    if ($grantResult -match "already has") {
        Write-Host ""
        Write-Host "⚠ Permission already exists (this is OK)" -ForegroundColor Yellow
    } else {
        exit 1
    }
}

Write-Host ""

# Step 3: Verify permission
Write-Host "Step 3: Verifying permission..." -ForegroundColor Green
$verifyPolicy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

$hasPermission = $false
if ($verifyPolicy.bindings) {
    foreach ($binding in $verifyPolicy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher") {
            Write-Host "  Found Pub/Sub Publisher role with members:" -ForegroundColor Gray
            foreach ($member in $binding.members) {
                Write-Host "    - $member" -ForegroundColor Gray
                if ($member -eq $gmailServiceAccount) {
                    $hasPermission = $true
                }
            }
        }
    }
}

Write-Host ""

if ($hasPermission) {
    Write-Host "✓ Verification successful!" -ForegroundColor Green
    Write-Host "  Gmail service account has Pub/Sub Publisher permission" -ForegroundColor Green
} else {
    Write-Host "✗ Verification failed!" -ForegroundColor Red
    Write-Host "  Gmail service account does NOT have permission" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please try manually:" -ForegroundColor Yellow
    Write-Host "  $gcloudCmd pubsub topics add-iam-policy-binding $TopicName \`" -ForegroundColor Cyan
    Write-Host "    --member=`"$gmailServiceAccount`" \`" -ForegroundColor Cyan
    Write-Host "    --role=`"roles/pubsub.publisher`" \`" -ForegroundColor Cyan
    Write-Host "    --project=$ProjectId" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Step 4: Check topic state
Write-Host "Step 4: Checking topic state..." -ForegroundColor Green
$topicInfo = & $gcloudCmd pubsub topics describe $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

if ($topicInfo) {
    Write-Host "  Topic name: $($topicInfo.name)" -ForegroundColor Gray
    if ($topicInfo.labels) {
        Write-Host "  Labels: $($topicInfo.labels | ConvertTo-Json -Compress)" -ForegroundColor Gray
    }
}

Write-Host ""

# Step 5: Wait and re-check (permissions can take a moment to propagate)
Write-Host "Step 5: Waiting for permission propagation (10 seconds)..." -ForegroundColor Green
Write-Host "  (Google Cloud permissions can take a few seconds to propagate)" -ForegroundColor Gray
Start-Sleep -Seconds 10

Write-Host ""

# Step 6: Final verification
Write-Host "Step 6: Final verification..." -ForegroundColor Green
$finalPolicy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

$finalHasPermission = $false
if ($finalPolicy.bindings) {
    foreach ($binding in $finalPolicy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailServiceAccount) {
            $finalHasPermission = $true
            break
        }
    }
}

if ($finalHasPermission) {
    Write-Host "✓ Final verification successful!" -ForegroundColor Green
} else {
    Write-Host "✗ Final verification failed - permission may not have propagated yet" -ForegroundColor Yellow
    Write-Host "  Wait a few minutes and check the topic state in Google Cloud Console" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Topic: $topicFullName" -ForegroundColor White
Write-Host "Service Account: $gmailServiceAccount" -ForegroundColor White
Write-Host "Permission: roles/pubsub.publisher" -ForegroundColor White
Write-Host "Status: $($finalHasPermission ? 'GRANTED' : 'PENDING')" -ForegroundColor $(if ($finalHasPermission) { "Green" } else { "Yellow" })
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait 1-2 minutes for permission to fully propagate" -ForegroundColor White
Write-Host "2. Check topic state in Google Cloud Console" -ForegroundColor White
Write-Host "3. Re-setup Gmail Watch to ensure it uses the correct topic" -ForegroundColor White
Write-Host "4. Test by sending an email to your Gmail inbox" -ForegroundColor White
Write-Host ""

