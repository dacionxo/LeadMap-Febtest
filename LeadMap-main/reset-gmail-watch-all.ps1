# Reset Gmail Watch for All Mailboxes
# This script helps reset Gmail Watch using the cron job endpoint

param(
    [string]$BaseUrl = "https://www.growyourdigitalleverage.com",
    [string]$CronSecret = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Reset Gmail Watch for All Mailboxes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Option 1: Use Cron Job (Renews all watches)
Write-Host "Option 1: Use Gmail Watch Renewal Cron Job" -ForegroundColor Yellow
Write-Host "  This will renew ALL Gmail watches that are expiring or expired" -ForegroundColor White
Write-Host ""
Write-Host "  Endpoint: $BaseUrl/api/cron/gmail-watch-renewal" -ForegroundColor Cyan
Write-Host ""

if ($CronSecret) {
    Write-Host "  Calling cron job with secret..." -ForegroundColor Green
    try {
        $headers = @{
            "Authorization" = "Bearer $CronSecret"
        }
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/cron/gmail-watch-renewal" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json"
        
        Write-Host "  ✓ Cron job executed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Results:" -ForegroundColor Yellow
        Write-Host "    Renewed: $($response.renewed)" -ForegroundColor White
        Write-Host "    Failed: $($response.failed)" -ForegroundColor White
        Write-Host "    Total: $($response.total)" -ForegroundColor White
        
        if ($response.results) {
            Write-Host ""
            Write-Host "  Details:" -ForegroundColor Yellow
            foreach ($result in $response.results) {
                $status = if ($result.status -eq "success") { "✓" } else { "✗" }
                $color = if ($result.status -eq "success") { "Green" } else { "Red" }
                Write-Host "    $status $($result.email): $($result.status)" -ForegroundColor $color
                if ($result.error) {
                    Write-Host "      Error: $($result.error)" -ForegroundColor Red
                }
            }
        }
    } catch {
        Write-Host "  ✗ Failed to call cron job: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Try Option 2 or 3 below" -ForegroundColor Yellow
    }
} else {
    Write-Host "  To use this option, you need the cron secret:" -ForegroundColor Yellow
    Write-Host "    .\reset-gmail-watch-all.ps1 -CronSecret YOUR_SECRET" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Or call manually:" -ForegroundColor Yellow
    Write-Host "    curl -X POST `"$BaseUrl/api/cron/gmail-watch-renewal`" \`" -ForegroundColor Cyan
    Write-Host "      -H `"Authorization: Bearer YOUR_CRON_SECRET`"" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Option 2: Reset Individual Mailbox via API" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "For a specific mailbox, use the watch endpoint:" -ForegroundColor White
Write-Host ""
Write-Host "  POST $BaseUrl/api/mailboxes/{mailboxId}/watch" -ForegroundColor Cyan
Write-Host ""
Write-Host "Requirements:" -ForegroundColor Yellow
Write-Host "  - You must be authenticated (logged in)" -ForegroundColor White
Write-Host "  - You need the mailbox ID from Supabase" -ForegroundColor White
Write-Host ""
Write-Host "Steps:" -ForegroundColor Yellow
Write-Host "  1. Get mailbox ID from Supabase:" -ForegroundColor White
Write-Host "     SELECT id, email FROM mailboxes WHERE provider = 'gmail';" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Call the endpoint (from your browser console or Postman):" -ForegroundColor White
Write-Host "     fetch('$BaseUrl/api/mailboxes/YOUR_MAILBOX_ID/watch', {" -ForegroundColor Cyan
Write-Host "       method: 'POST'," -ForegroundColor Cyan
Write-Host "       credentials: 'include'" -ForegroundColor Cyan
Write-Host "     })" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Option 3: Re-authenticate via OAuth" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Re-authenticating the Gmail mailbox will automatically set up a new watch:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Go to your application's email settings" -ForegroundColor White
Write-Host "  2. Disconnect the Gmail mailbox" -ForegroundColor White
Write-Host "  3. Reconnect it via OAuth" -ForegroundColor White
Write-Host "  4. The watch will be set up automatically during OAuth callback" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "After resetting, verify the watch is active:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Check Supabase:" -ForegroundColor White
Write-Host "    SELECT email, watch_expiration, watch_history_id" -ForegroundColor Cyan
Write-Host "    FROM mailboxes" -ForegroundColor Cyan
Write-Host "    WHERE provider = 'gmail';" -ForegroundColor Cyan
Write-Host ""
Write-Host "  watch_expiration should be in the future (7 days from now)" -ForegroundColor Gray
Write-Host "  watch_history_id should not be NULL" -ForegroundColor Gray
Write-Host ""

