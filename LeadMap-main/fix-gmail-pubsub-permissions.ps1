# Fix Gmail Pub/Sub Permissions Script
# This fixes the "Publish permission denied" error

param(
    [string]$TopicName = "gmail-notifications3",
    [string]$ProjectId = "",
    [string]$DLQTopicName = "gmail-notifications-dlq"
)

# Find gcloud executable
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

# Also check if gcloud is in PATH
if (-not $gcloudCmd) {
    $gcloudInPath = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($gcloudInPath) {
        $gcloudCmd = "gcloud"
    }
}

if (-not $gcloudCmd) {
    Write-Host "✗ Google Cloud CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "  Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Gmail Pub/Sub Permissions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Using gcloud: $gcloudCmd" -ForegroundColor Gray
Write-Host ""

# Step 1: Get project ID if not provided
if ([string]::IsNullOrEmpty($ProjectId)) {
    Write-Host "Step 1: Getting current project..." -ForegroundColor Green
    $ProjectId = & $gcloudCmd config get-value project 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($ProjectId) -or $ProjectId -eq "(unset)") {
        Write-Host "✗ No project configured. Please set a project first:" -ForegroundColor Red
        Write-Host "  $gcloudCmd config set project YOUR_PROJECT_ID" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Using project: $ProjectId" -ForegroundColor Green
} else {
    Write-Host "Step 1: Using provided project: $ProjectId" -ForegroundColor Green
}

Write-Host ""

# Step 2: Verify topic exists
Write-Host "Step 2: Verifying topic exists..." -ForegroundColor Green
$topicFullName = "projects/$ProjectId/topics/$TopicName"
$topicCheck = & $gcloudCmd pubsub topics describe $TopicName --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Topic '$TopicName' not found in project '$ProjectId'" -ForegroundColor Red
    Write-Host ""
    $createTopic = Read-Host "Create topic '$TopicName'? (y/n)"
    if ($createTopic -eq "y" -or $createTopic -eq "Y") {
        Write-Host "Creating topic..." -ForegroundColor Gray
        & $gcloudCmd pubsub topics create $TopicName --project=$ProjectId
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Topic created" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to create topic" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Cannot proceed without topic. Exiting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Topic '$TopicName' exists" -ForegroundColor Green
    Write-Host "  Full name: $topicFullName" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Check current permissions
Write-Host "Step 3: Checking current permissions..." -ForegroundColor Green
$gmailServiceAccount = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
$currentPolicy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

$hasPermission = $false
if ($currentPolicy.bindings) {
    foreach ($binding in $currentPolicy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailServiceAccount) {
            $hasPermission = $true
            Write-Host "✓ Gmail service account already has Pub/Sub Publisher permission" -ForegroundColor Green
            break
        }
    }
}

if (-not $hasPermission) {
    Write-Host "⚠ Gmail service account does NOT have Pub/Sub Publisher permission" -ForegroundColor Yellow
    Write-Host ""
    
    # Step 4: Grant permission
    Write-Host "Step 4: Granting Pub/Sub Publisher permission to Gmail..." -ForegroundColor Green
    Write-Host "  Service Account: $gmailServiceAccount" -ForegroundColor Gray
    Write-Host "  Role: roles/pubsub.publisher" -ForegroundColor Gray
    Write-Host "  Topic: $TopicName" -ForegroundColor Gray
    Write-Host ""
    
    & $gcloudCmd pubsub topics add-iam-policy-binding $TopicName `
        --member=$gmailServiceAccount `
        --role="roles/pubsub.publisher" `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Permission granted successfully!" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to grant permission" -ForegroundColor Red
        Write-Host "Error details:" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Permission already granted, skipping..." -ForegroundColor Green
}

Write-Host ""

# Step 5: Verify Pub/Sub API is enabled
Write-Host "Step 5: Verifying Pub/Sub API is enabled..." -ForegroundColor Green
$enabledServices = & $gcloudCmd services list --enabled --project=$ProjectId --filter="name:pubsub.googleapis.com" 2>&1
if ($enabledServices -match "pubsub.googleapis.com") {
    Write-Host "✓ Pub/Sub API is enabled" -ForegroundColor Green
} else {
    Write-Host "⚠ Pub/Sub API is NOT enabled" -ForegroundColor Yellow
    Write-Host "Enabling Pub/Sub API..." -ForegroundColor Gray
    & $gcloudCmd services enable pubsub.googleapis.com --project=$ProjectId
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Pub/Sub API enabled" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to enable Pub/Sub API" -ForegroundColor Red
    }
}

Write-Host ""

# Step 6: Verify Gmail API is enabled
Write-Host "Step 6: Verifying Gmail API is enabled..." -ForegroundColor Green
$enabledServices = & $gcloudCmd services list --enabled --project=$ProjectId --filter="name:gmail.googleapis.com" 2>&1
if ($enabledServices -match "gmail.googleapis.com") {
    Write-Host "✓ Gmail API is enabled" -ForegroundColor Green
} else {
    Write-Host "⚠ Gmail API is NOT enabled" -ForegroundColor Yellow
    Write-Host "Enabling Gmail API..." -ForegroundColor Gray
    & $gcloudCmd services enable gmail.googleapis.com --project=$ProjectId
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Gmail API enabled" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to enable Gmail API" -ForegroundColor Red
    }
}

Write-Host ""

# Step 7: Display configuration summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project ID: $ProjectId" -ForegroundColor White
Write-Host "Topic Name: $TopicName" -ForegroundColor White
Write-Host "Topic Full Name: $topicFullName" -ForegroundColor White
Write-Host "Gmail Service Account: $gmailServiceAccount" -ForegroundColor White
Write-Host "Permission: roles/pubsub.publisher" -ForegroundColor White
Write-Host ""

# Step 8: Verify permissions
Write-Host "Step 7: Verifying permissions..." -ForegroundColor Green
$verifyPolicy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json
$hasPermission = $false
if ($verifyPolicy.bindings) {
    foreach ($binding in $verifyPolicy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailServiceAccount) {
            $hasPermission = $true
            break
        }
    }
}

if ($hasPermission) {
    Write-Host "✓ Verification successful - Gmail can now publish to your topic!" -ForegroundColor Green
} else {
    Write-Host "✗ Verification failed - permission may not have been granted correctly" -ForegroundColor Red
    Write-Host "Please check manually:" -ForegroundColor Yellow
    Write-Host "  $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId" -ForegroundColor Cyan
}

Write-Host ""

# Step 9: Display next steps
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Update your environment variable:" -ForegroundColor Yellow
Write-Host "   GMAIL_PUBSUB_TOPIC_NAME=$topicFullName" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Verify your Gmail Watch is using the correct topic name:" -ForegroundColor Yellow
Write-Host "   The topicName in your watch request must be: $topicFullName" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Re-setup Gmail Watch (if needed):" -ForegroundColor Yellow
Write-Host "   This will ensure the watch uses the correct topic with permissions" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test by sending an email to your Gmail inbox" -ForegroundColor Yellow
Write-Host "   Check Pub/Sub metrics to see if messages are being published" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Monitor Pub/Sub:" -ForegroundColor Yellow
Write-Host "   gcloud pubsub subscriptions describe YOUR_SUBSCRIPTION_NAME" -ForegroundColor Cyan
Write-Host ""

# Step 10: Check for subscriptions
Write-Host "Step 8: Checking for subscriptions..." -ForegroundColor Green
$subscriptions = & $gcloudCmd pubsub subscriptions list --project=$ProjectId --filter="topic:projects/$ProjectId/topics/$TopicName" --format="value(name)" 2>&1
if ($subscriptions) {
    Write-Host "✓ Found subscriptions:" -ForegroundColor Green
    $subscriptions | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
} else {
    Write-Host "⚠ No subscriptions found for topic '$TopicName'" -ForegroundColor Yellow
    Write-Host "  You'll need to create a push subscription pointing to your webhook" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Setup complete! Gmail should now be able to publish notifications." -ForegroundColor Green
Write-Host ""

