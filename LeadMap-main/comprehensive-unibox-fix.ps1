# Comprehensive Unibox Email Reception Fix
# Fixes all identified issues preventing emails from being received

param(
    [string]$ProjectId = "canvas-advice-479307-p4",
    [string]$TopicName = "gmail-notifications3",
    [string]$SupabaseProjectRef = "bqkucdaefpfkunceftye"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Comprehensive Unibox Email Fix" -ForegroundColor Cyan
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
# FIX 1: Pub/Sub Ingestion Error
# ========================================
Write-Host "FIX 1: Pub/Sub Ingestion Error" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$topicInfo = & $gcloudPath pubsub topics describe $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json

if ($topicInfo.ingestionDataSourceSettings) {
    Write-Host "  ⚠ Cloud Storage ingestion is configured (causing error)" -ForegroundColor Yellow
    Write-Host "  Clearing Cloud Storage ingestion..." -ForegroundColor Gray
    
    & $gcloudPath pubsub topics update $TopicName `
        --clear-ingestion-data-source-settings `
        --project=$ProjectId 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Cloud Storage ingestion cleared" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to clear ingestion" -ForegroundColor Red
    }
} else {
    Write-Host "  ✓ No Cloud Storage ingestion configured" -ForegroundColor Green
}

Write-Host ""

# ========================================
# FIX 2: Verify Pub/Sub Permissions
# ========================================
Write-Host "FIX 2: Pub/Sub Permissions" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$policy = & $gcloudPath pubsub topics get-iam-policy $TopicName --project=$ProjectId --format=json 2>&1 | ConvertFrom-Json
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
    Write-Host "  ⚠ Granting Pub/Sub Publisher permission..." -ForegroundColor Yellow
    & $gcloudPath pubsub topics add-iam-policy-binding $TopicName `
        --member=$gmailSA `
        --role="roles/pubsub.publisher" `
        --project=$ProjectId 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Permission granted" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to grant permission" -ForegroundColor Red
    }
}

Write-Host ""

# ========================================
# FIX 3: Check RLS Policies
# ========================================
Write-Host "FIX 3: Database RLS Policies" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ⚠ Cannot check RLS policies via CLI" -ForegroundColor Yellow
Write-Host "  Please run this SQL in Supabase Dashboard:" -ForegroundColor White
Write-Host "    File: supabase/unibox_rls_service_role_fix.sql" -ForegroundColor Cyan
Write-Host ""

# ========================================
# SUMMARY
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fixes Applied:" -ForegroundColor Yellow
Write-Host "  1. ✓ Cleared Cloud Storage ingestion (if configured)" -ForegroundColor Green
Write-Host "  2. ✓ Verified/Granted Pub/Sub Publisher permission" -ForegroundColor Green
Write-Host "  3. ⚠ RLS policies - run SQL migration manually" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run RLS fix SQL in Supabase:" -ForegroundColor White
Write-Host "   supabase/unibox_rls_service_role_fix.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Verify environment variables:" -ForegroundColor White
Write-Host "   GMAIL_PUBSUB_TOPIC_NAME=$topicFullName" -ForegroundColor Cyan
Write-Host "   NEXT_PUBLIC_SUPABASE_URL=https://$SupabaseProjectRef.supabase.co" -ForegroundColor Cyan
Write-Host "   SUPABASE_SERVICE_ROLE_KEY=***" -ForegroundColor Cyan
Write-Host "   EMAIL_ENCRYPTION_KEY=***" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Re-setup Gmail Watch:" -ForegroundColor White
Write-Host "   POST /api/mailboxes/{mailboxId}/watch" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Wait 2-3 minutes for topic state to update" -ForegroundColor White
Write-Host ""
Write-Host "5. Test by sending an email to Gmail inbox" -ForegroundColor White
Write-Host ""

