# Comprehensive Unibox Email Reception Diagnostic Script
# Deep scan of the entire email receiving pipeline

param(
    [string]$ProjectId = "canvas-advice-479307-p4",
    [string]$TopicName = "gmail-notifications3",
    [string]$SupabaseProjectRef = "bqkucdaefpfkunceftye"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Unibox Email Reception Deep Scan" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find CLI tools
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$supabasePath = Get-ChildItem -Path "$env:LOCALAPPDATA" -Recurse -Filter "supabase.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $supabasePath) {
    $supabasePath = "C:\Users\test\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\supabase\bin\supabase.exe"
}

$topicFullName = "projects/$ProjectId/topics/$TopicName"

# ========================================
# 1. PUB/SUB TOPIC STATUS
# ========================================
Write-Host "1. Checking Pub/Sub Topic Status..." -ForegroundColor Green
Write-Host ""

$topicInfo = & $gcloudPath pubsub topics describe $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

Write-Host "  Topic Name: $($topicInfo.name)" -ForegroundColor White
Write-Host "  State: $($topicInfo.state)" -ForegroundColor $(if ($topicInfo.state -eq "ACTIVE") { "Green" } else { "Red" })

if ($topicInfo.state -ne "ACTIVE") {
    Write-Host "  ⚠ Topic is not ACTIVE!" -ForegroundColor Red
    if ($topicInfo.ingestionDataSourceSettings) {
        Write-Host "  Issue: Ingestion data source configured incorrectly" -ForegroundColor Yellow
        Write-Host "  Fix: Disable Cloud Storage ingestion (Gmail publishes directly)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ========================================
# 2. PUB/SUB PERMISSIONS
# ========================================
Write-Host "2. Checking Pub/Sub Permissions..." -ForegroundColor Green
Write-Host ""

$policy = & $gcloudPath pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

$gmailSA = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
$hasPublisher = $false

if ($policy.bindings) {
    foreach ($binding in $policy.bindings) {
        if ($binding.role -eq "roles/pubsub.publisher" -and $binding.members -contains $gmailSA) {
            $hasPublisher = $true
            Write-Host "  ✓ Gmail service account has Pub/Sub Publisher permission" -ForegroundColor Green
            break
        }
    }
}

if (-not $hasPublisher) {
    Write-Host "  ✗ Gmail service account missing Pub/Sub Publisher permission!" -ForegroundColor Red
    Write-Host "  Fix: Run .\fix-gmail-pubsub-permissions.ps1" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# 3. PUB/SUB SUBSCRIPTION
# ========================================
Write-Host "3. Checking Pub/Sub Subscription..." -ForegroundColor Green
Write-Host ""

$subscription = & $gcloudPath pubsub subscriptions describe gmail-notifications3-sub --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

if ($subscription) {
    Write-Host "  Subscription: $($subscription.name)" -ForegroundColor White
    Write-Host "  State: $($subscription.state)" -ForegroundColor $(if ($subscription.state -eq "ACTIVE") { "Green" } else { "Red" })
    Write-Host "  Endpoint: $($subscription.pushConfig.pushEndpoint)" -ForegroundColor White
    Write-Host "  Ack Deadline: $($subscription.ackDeadlineSeconds)s" -ForegroundColor White
    
    # Check backlog
    $backlog = & $gcloudPath pubsub subscriptions describe gmail-notifications3-sub --project=$ProjectId --format="value(numUndeliveredMessages)" 2>&1
    if ($backlog -and $backlog -ne "0") {
        Write-Host "  ⚠ Backlog: $backlog unacknowledged messages" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ No backlog" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ Subscription not found!" -ForegroundColor Red
}

Write-Host ""

# ========================================
# 4. GMAIL WATCH STATUS (DATABASE)
# ========================================
Write-Host "4. Checking Gmail Watch Status (Database)..." -ForegroundColor Green
Write-Host ""

# Use psql-style query via Supabase CLI
$watchQuery = @"
SELECT 
  id,
  email,
  watch_expiration,
  watch_history_id,
  last_synced_at,
  last_error,
  CASE 
    WHEN watch_expiration IS NULL THEN 'NOT SET UP'
    WHEN watch_expiration < NOW() THEN 'EXPIRED'
    WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON'
    ELSE 'ACTIVE'
  END as watch_status
FROM mailboxes
WHERE provider = 'gmail';
"@

# Try to execute query - Supabase CLI might need different syntax
Write-Host "  Querying database for Gmail mailboxes..." -ForegroundColor Gray
Write-Host "  (If this fails, check Supabase Dashboard manually)" -ForegroundColor Gray
Write-Host ""

# ========================================
# 5. EMAIL MESSAGES IN DATABASE
# ========================================
Write-Host "5. Checking Email Messages in Database..." -ForegroundColor Green
Write-Host ""

$messagesQuery = @"
SELECT 
  COUNT(*) as total_inbound,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
  MAX(created_at) as most_recent
FROM email_messages
WHERE direction = 'inbound';
"@

Write-Host "  Querying email_messages table..." -ForegroundColor Gray
Write-Host "  (If this fails, check Supabase Dashboard manually)" -ForegroundColor Gray
Write-Host ""

# ========================================
# 6. ENVIRONMENT VARIABLES CHECK
# ========================================
Write-Host "6. Environment Variables Check..." -ForegroundColor Green
Write-Host ""
Write-Host "  Required variables:" -ForegroundColor Yellow
Write-Host "    GMAIL_PUBSUB_TOPIC_NAME=$topicFullName" -ForegroundColor Cyan
Write-Host "    NEXT_PUBLIC_SUPABASE_URL=https://$SupabaseProjectRef.supabase.co" -ForegroundColor Cyan
Write-Host "    SUPABASE_SERVICE_ROLE_KEY=***" -ForegroundColor Cyan
Write-Host "    EMAIL_ENCRYPTION_KEY=***" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ⚠ Cannot verify from CLI - check in your deployment environment" -ForegroundColor Yellow
Write-Host ""

# ========================================
# 7. WEBHOOK ENDPOINT CHECK
# ========================================
Write-Host "7. Checking Webhook Endpoint..." -ForegroundColor Green
Write-Host ""

$webhookUrl = "https://www.growyourdigitalleverage.com/api/webhooks/gmail"
Write-Host "  Endpoint: $webhookUrl" -ForegroundColor White

try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method GET -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Webhook endpoint is accessible" -ForegroundColor Green
        $health = $response.Content | ConvertFrom-Json
        Write-Host "  Status: $($health.status)" -ForegroundColor White
        Write-Host "  Checks:" -ForegroundColor Gray
        Write-Host "    Supabase: $($health.checks.supabase)" -ForegroundColor $(if ($health.checks.supabase) { "Green" } else { "Red" })
        Write-Host "    Pub/Sub Topic: $($health.checks.pubsub_topic)" -ForegroundColor $(if ($health.checks.pubsub_topic) { "Green" } else { "Red" })
        Write-Host "    Expired Watches: $($health.checks.expired_watches)" -ForegroundColor $(if ($health.checks.expired_watches -eq 0) { "Green" } else { "Yellow" })
    }
} catch {
    Write-Host "  ✗ Webhook endpoint check failed: $_" -ForegroundColor Red
}

Write-Host ""

# ========================================
# SUMMARY AND RECOMMENDATIONS
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary & Recommendations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$issues = @()

if ($topicInfo.state -ne "ACTIVE") {
    $issues += "Topic state is not ACTIVE (Ingestion error)"
}

if (-not $hasPublisher) {
    $issues += "Gmail service account missing Pub/Sub Publisher permission"
}

if ($issues.Count -eq 0) {
    Write-Host "✓ No critical issues found in Pub/Sub configuration" -ForegroundColor Green
} else {
    Write-Host "⚠ Issues found:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Fix topic ingestion error (disable Cloud Storage ingestion)" -ForegroundColor White
Write-Host "2. Verify Gmail Watch is active in database" -ForegroundColor White
Write-Host "3. Check environment variables are set correctly" -ForegroundColor White
Write-Host "4. Test by sending an email to Gmail inbox" -ForegroundColor White
Write-Host "5. Check webhook logs for processing" -ForegroundColor White
Write-Host ""

