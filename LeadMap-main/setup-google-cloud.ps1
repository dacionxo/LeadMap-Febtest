# Complete Google Cloud Setup Script
# Run this AFTER installing Google Cloud CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Google Cloud Complete Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if gcloud is installed
Write-Host "Step 1: Checking Google Cloud CLI installation..." -ForegroundColor Green
try {
    $gcloudVersion = gcloud --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Google Cloud CLI is installed" -ForegroundColor Green
        Write-Host $gcloudVersion -ForegroundColor Gray
    } else {
        Write-Host "✗ Google Cloud CLI not found. Please install it first." -ForegroundColor Red
        Write-Host "  Run: .\install-gcloud.ps1" -ForegroundColor Yellow
        Write-Host "  Or download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Google Cloud CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "  Run: .\install-gcloud.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Check if already initialized
Write-Host "Step 2: Checking current configuration..." -ForegroundColor Green
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -eq 0 -and $currentProject -and $currentProject -ne "(unset)") {
    Write-Host "✓ Current project: $currentProject" -ForegroundColor Green
    $skipInit = Read-Host "Project already set. Skip initialization? (y/n)"
    if ($skipInit -eq "y" -or $skipInit -eq "Y") {
        Write-Host "Skipping initialization..." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "Step 3: Initializing Google Cloud..." -ForegroundColor Green
        Write-Host "This will open a browser for authentication." -ForegroundColor Yellow
        Write-Host ""
        gcloud init
    }
} else {
    Write-Host "⚠ No project configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Step 3: Initializing Google Cloud..." -ForegroundColor Green
    Write-Host "This will open a browser for authentication." -ForegroundColor Yellow
    Write-Host ""
    gcloud init
}

Write-Host ""

# Step 4: Get current project
$projectId = gcloud config get-value project 2>&1
if (-not $projectId -or $projectId -eq "(unset)") {
    Write-Host "✗ No project configured. Please run 'gcloud init' first." -ForegroundColor Red
    exit 1
}

Write-Host "Using project: $projectId" -ForegroundColor Cyan
Write-Host ""

# Step 5: Enable required APIs
Write-Host "Step 4: Enabling required APIs..." -ForegroundColor Green

$apis = @(
    "pubsub.googleapis.com",
    "gmail.googleapis.com"
)

foreach ($api in $apis) {
    Write-Host "  Enabling $api..." -ForegroundColor Gray
    gcloud services enable $api --project=$projectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $api enabled" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to enable $api" -ForegroundColor Red
    }
}

Write-Host ""

# Step 6: Verify APIs are enabled
Write-Host "Step 5: Verifying enabled APIs..." -ForegroundColor Green
$enabledApis = gcloud services list --enabled --project=$projectId 2>&1
$pubsubEnabled = $enabledApis -match "pubsub"
$gmailEnabled = $enabledApis -match "gmail"

if ($pubsubEnabled) {
    Write-Host "  ✓ Pub/Sub API is enabled" -ForegroundColor Green
} else {
    Write-Host "  ✗ Pub/Sub API is NOT enabled" -ForegroundColor Red
}

if ($gmailEnabled) {
    Write-Host "  ✓ Gmail API is enabled" -ForegroundColor Green
} else {
    Write-Host "  ✗ Gmail API is NOT enabled" -ForegroundColor Red
}

Write-Host ""

# Step 7: Display configuration summary
Write-Host "Step 6: Configuration Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project ID: $projectId" -ForegroundColor White
Write-Host "Account: $(gcloud config get-value account)" -ForegroundColor White
Write-Host ""

# Step 8: Check for existing Pub/Sub topic
Write-Host "Step 7: Checking Pub/Sub setup..." -ForegroundColor Green
$topics = gcloud pubsub topics list --project=$projectId 2>&1
if ($topics -match "gmail-notifications") {
    Write-Host "  ✓ Topic 'gmail-notifications' exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Topic 'gmail-notifications' not found" -ForegroundColor Yellow
    $createTopic = Read-Host "  Create topic 'gmail-notifications'? (y/n)"
    if ($createTopic -eq "y" -or $createTopic -eq "Y") {
        Write-Host "  Creating topic..." -ForegroundColor Gray
        gcloud pubsub topics create gmail-notifications --project=$projectId
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Topic created" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to create topic" -ForegroundColor Red
        }
    }
}

Write-Host ""

# Step 9: Display next steps
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Set environment variable in your application:" -ForegroundColor White
Write-Host "   GMAIL_PUBSUB_TOPIC_NAME=projects/$projectId/topics/gmail-notifications" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Create a push subscription (when ready):" -ForegroundColor White
Write-Host "   gcloud pubsub subscriptions create gmail-webhook-subscription \`" -ForegroundColor Cyan
Write-Host "     --topic=gmail-notifications \`" -ForegroundColor Cyan
Write-Host "     --push-endpoint=https://YOUR_DOMAIN.com/api/webhooks/gmail \`" -ForegroundColor Cyan
Write-Host "     --ack-deadline=60" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Grant permissions to Gmail API service account:" -ForegroundColor White
Write-Host "   gcloud pubsub topics add-iam-policy-binding gmail-notifications \`" -ForegroundColor Cyan
Write-Host "     --member=`"serviceAccount:gmail-api-push@system.gserviceaccount.com`" \`" -ForegroundColor Cyan
Write-Host "     --role=`"roles/pubsub.publisher`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Verify setup:" -ForegroundColor White
Write-Host "   gcloud pubsub topics describe gmail-notifications" -ForegroundColor Cyan
Write-Host "   gcloud pubsub subscriptions list" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed Pub/Sub setup, see:" -ForegroundColor Gray
Write-Host "  docs/PUBSUB_SETUP_COMPLETE_GUIDE.md" -ForegroundColor Gray
Write-Host ""

