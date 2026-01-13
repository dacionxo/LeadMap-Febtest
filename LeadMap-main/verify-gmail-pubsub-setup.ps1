# Verify Complete Gmail Pub/Sub Setup
# Checks all components to ensure emails flow from Gmail to Supabase

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

$topicFullName = "projects/$ProjectId/topics/$TopicName"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Gmail Pub/Sub Setup Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check topic exists
Write-Host "1. Checking topic..." -ForegroundColor Green
$topicCheck = & $gcloudCmd pubsub topics describe $TopicName --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Topic exists: $topicFullName" -ForegroundColor Green
} else {
    Write-Host "   ✗ Topic not found!" -ForegroundColor Red
    exit 1
}

# 2. Check permissions
Write-Host ""
Write-Host "2. Checking permissions..." -ForegroundColor Green
$policy = & $gcloudCmd pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json
$gmailSA = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
$hasPermission = $false
if ($policy.bindings) {
    foreach ($binding in $policy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailSA) {
            $hasPermission = $true
            break
        }
    }
}
if ($hasPermission) {
    Write-Host "   ✓ Gmail service account has Pub/Sub Publisher permission" -ForegroundColor Green
} else {
    Write-Host "   ✗ Gmail service account missing permission!" -ForegroundColor Red
    Write-Host "   Run: .\fix-gmail-pubsub-permissions.ps1" -ForegroundColor Yellow
}

# 3. Check subscriptions
Write-Host ""
Write-Host "3. Checking subscriptions..." -ForegroundColor Green
$subscriptions = & $gcloudCmd pubsub subscriptions list --project=$ProjectId --filter="topic:projects/$ProjectId/topics/$TopicName" --format="json" 2>&1 | ConvertFrom-Json
if ($subscriptions) {
    Write-Host "   ✓ Found $($subscriptions.Count) subscription(s):" -ForegroundColor Green
    foreach ($sub in $subscriptions) {
        $subName = $sub.name.Split('/')[-1]
        $endpoint = $sub.pushConfig.pushEndpoint
        $ackDeadline = $sub.ackDeadlineSeconds
        Write-Host "     - $subName" -ForegroundColor Gray
        Write-Host "       Endpoint: $endpoint" -ForegroundColor Gray
        Write-Host "       Ack Deadline: ${ackDeadline}s" -ForegroundColor Gray
        
        # Check backlog
        $backlog = & $gcloudCmd pubsub subscriptions describe $subName --project=$ProjectId --format="value(numUndeliveredMessages)" 2>&1
        if ($backlog -and $backlog -ne "0") {
            Write-Host "       ⚠ Backlog: $backlog unacknowledged messages" -ForegroundColor Yellow
        } else {
            Write-Host "       ✓ No backlog" -ForegroundColor Green
        }
    }
} else {
    Write-Host "   ⚠ No subscriptions found!" -ForegroundColor Yellow
    Write-Host "   Create one pointing to your webhook endpoint" -ForegroundColor Gray
}

# 4. Check recent messages
Write-Host ""
Write-Host "4. Checking recent Pub/Sub activity..." -ForegroundColor Green
Write-Host "   (This may take a moment...)" -ForegroundColor Gray
$metrics = & $gcloudCmd pubsub topics describe $TopicName --project=$ProjectId --format="json" 2>&1 | ConvertFrom-Json
Write-Host "   Topic created: $($metrics.name)" -ForegroundColor Gray

# 5. Display configuration
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project ID: $ProjectId" -ForegroundColor White
Write-Host "Topic Full Name: $topicFullName" -ForegroundColor White
Write-Host ""
Write-Host "Environment Variable Should Be:" -ForegroundColor Yellow
Write-Host "  GMAIL_PUBSUB_TOPIC_NAME=$topicFullName" -ForegroundColor Cyan
Write-Host ""

# 6. Next steps
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verify environment variable is set:" -ForegroundColor Yellow
Write-Host "   GMAIL_PUBSUB_TOPIC_NAME=$topicFullName" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Re-setup Gmail Watch to ensure it uses the correct topic:" -ForegroundColor Yellow
Write-Host "   The watch must use: $topicFullName" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Test by sending an email to your Gmail inbox" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Check webhook logs for:" -ForegroundColor Yellow
Write-Host "   [Gmail Webhook] Processing notification..." -ForegroundColor Cyan
Write-Host "   [syncGmailMessages] History API returned X new messages..." -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Check Supabase database:" -ForegroundColor Yellow
Write-Host "   SELECT COUNT(*) FROM email_messages WHERE direction = 'inbound';" -ForegroundColor Cyan
Write-Host ""

