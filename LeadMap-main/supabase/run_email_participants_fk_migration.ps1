# PowerShell script to apply email_participants foreign key constraint migration
# This fixes the PGRST200 error: "Could not find a relationship between 'email_participants' and 'contacts'"

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Email Participants Foreign Key Migration" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "This migration fixes the following error:" -ForegroundColor Yellow
Write-Host "  PGRST200: Could not find a relationship between 'email_participants' and 'contacts'" -ForegroundColor Red
Write-Host ""

# Get the migration file path
$migrationFile = Join-Path $PSScriptRoot "migrations\add_email_participants_contact_fk.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "Error: Migration file not found at $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Migration file found: $migrationFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "This migration will:" -ForegroundColor Yellow
Write-Host "  ✓ Add foreign key constraint from email_participants.contact_id to contacts.id" -ForegroundColor White
Write-Host "  ✓ Create index on contact_id for better query performance" -ForegroundColor White
Write-Host "  ✓ Fix PostgREST automatic join between email_participants and contacts" -ForegroundColor White
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "To apply this migration, you have two options:" -ForegroundColor Yellow
Write-Host ""

Write-Host "OPTION 1: Supabase Dashboard (Recommended)" -ForegroundColor Green
Write-Host "  1. Go to https://supabase.com/dashboard" -ForegroundColor White
Write-Host "  2. Select your project" -ForegroundColor White
Write-Host "  3. Navigate to SQL Editor" -ForegroundColor White
Write-Host "  4. Create a new query" -ForegroundColor White
Write-Host "  5. Copy and paste the contents of:" -ForegroundColor White
Write-Host "     $migrationFile" -ForegroundColor Cyan
Write-Host "  6. Click 'Run'" -ForegroundColor White
Write-Host ""

Write-Host "OPTION 2: Using Supabase CLI" -ForegroundColor Green
Write-Host "  If you have Supabase CLI installed:" -ForegroundColor White
Write-Host "    supabase db remote execute --file `"$migrationFile`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Or using npx (no installation required):" -ForegroundColor White
Write-Host "    npx supabase db remote execute --file `"$migrationFile`"" -ForegroundColor Cyan
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Reading migration file..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray
Get-Content $migrationFile
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

Write-Host "After running the migration, verify it worked:" -ForegroundColor Yellow
Write-Host "  1. Check the unibox inbox - emails should now display correctly" -ForegroundColor White
Write-Host "  2. Test the API endpoint: GET /api/unibox/threads/[id]" -ForegroundColor White
Write-Host "  3. Verify foreign key constraint exists:" -ForegroundColor White
Write-Host "     SELECT conname FROM pg_constraint WHERE conname = 'email_participants_contact_id_fkey';" -ForegroundColor Cyan
Write-Host ""

