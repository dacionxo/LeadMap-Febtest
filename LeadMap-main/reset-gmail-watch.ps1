# Reset Gmail Watch Script
# This script helps reset Gmail Watch for all Gmail mailboxes

param(
    [string]$MailboxId = "",
    [string]$ProjectId = "canvas-advice-479307-p4",
    [string]$TopicName = "gmail-notifications3",
    [string]$BaseUrl = "https://www.growyourdigitalleverage.com"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Reset Gmail Watch" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$topicFullName = "projects/$ProjectId/topics/$TopicName"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Project ID: $ProjectId" -ForegroundColor White
Write-Host "  Topic: $topicFullName" -ForegroundColor White
Write-Host "  Base URL: $BaseUrl" -ForegroundColor White
Write-Host ""

# Step 1: List Gmail mailboxes
Write-Host "Step 1: Getting Gmail mailboxes from database..." -ForegroundColor Green
Write-Host ""
Write-Host "To reset Gmail Watch, you have two options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use API Endpoint (Recommended)" -ForegroundColor Cyan
Write-Host "  POST $BaseUrl/api/mailboxes/{mailboxId}/watch" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Re-authenticate via OAuth" -ForegroundColor Cyan
Write-Host "  This will automatically set up a new watch" -ForegroundColor White
Write-Host ""

# Step 2: Provide instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($MailboxId) {
    Write-Host "Resetting watch for mailbox: $MailboxId" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Using curl:" -ForegroundColor Green
    Write-Host "  curl -X POST `"$BaseUrl/api/mailboxes/$MailboxId/watch`" \`" -ForegroundColor Cyan
    Write-Host "    -H `"Content-Type: application/json`" \`" -ForegroundColor Cyan
    Write-Host "    -H `"Authorization: Bearer YOUR_TOKEN`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or using PowerShell:" -ForegroundColor Green
    Write-Host "  `$response = Invoke-RestMethod -Uri `"$BaseUrl/api/mailboxes/$MailboxId/watch`" \`" -ForegroundColor Cyan
    Write-Host "    -Method POST \`" -ForegroundColor Cyan
    Write-Host "    -Headers @{ 'Authorization' = 'Bearer YOUR_TOKEN' }" -ForegroundColor Cyan
} else {
    Write-Host "To reset Gmail Watch for a specific mailbox:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Get your mailbox ID from Supabase:" -ForegroundColor White
    Write-Host "   SELECT id, email, provider FROM mailboxes WHERE provider = 'gmail';" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Call the watch endpoint:" -ForegroundColor White
    Write-Host "   POST $BaseUrl/api/mailboxes/{mailboxId}/watch" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Or re-authenticate the mailbox (OAuth flow will set up watch automatically)" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Important Notes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Environment Variable:" -ForegroundColor Yellow
Write-Host "   Ensure GMAIL_PUBSUB_TOPIC_NAME=$topicFullName" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Topic Permissions:" -ForegroundColor Yellow
Write-Host "   Gmail service account must have Pub/Sub Publisher permission" -ForegroundColor White
Write-Host "   (Already fixed via fix-gmail-pubsub-permissions.ps1)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Access Token:" -ForegroundColor Yellow
Write-Host "   The mailbox must have a valid access_token and refresh_token" -ForegroundColor White
Write-Host "   If tokens are expired, re-authenticate via OAuth" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Watch Expiration:" -ForegroundColor Yellow
Write-Host "   Gmail Watch expires after 7 days" -ForegroundColor White
Write-Host "   The cron job at /api/cron/gmail-watch-renewal should renew it automatically" -ForegroundColor Gray
Write-Host ""

