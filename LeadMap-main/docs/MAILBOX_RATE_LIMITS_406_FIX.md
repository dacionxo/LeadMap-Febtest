# Mailbox Rate Limits 406 Error Fix

## Issue

**Error**: 406 (Not Acceptable) when querying `mailbox_rate_limits` table
- **Location**: `/rest/v1/mailbox_rate_limits`
- **PostgREST Error**: PGRST116
- **Request**: `GET /rest/v1/mailbox_rate_limits?select=*&mailbox_id=eq.667e5783-873c-40b9-8fb7-d8c8382c2789`

## Root Cause

The query was using `.single()` which expects exactly one row to be returned. When no rate limit configuration exists for a mailbox, PostgREST returns a 406 error because:

1. `.single()` sets the `Accept` header to `application/vnd.pgrst.object+json` (expects a single object)
2. When no row matches, PostgREST cannot return a single object
3. This triggers error code PGRST116 with HTTP 406

## Solution

Changed from `.single()` to `.maybeSingle()` in `lib/email/sendViaMailbox.ts`:

**Before**:
```typescript
const { data: limitConfig } = await supabase
  .from('mailbox_rate_limits')
  .select('*')
  .eq('mailbox_id', mailbox.id)
  .single()  // ❌ Throws 406 if no row exists
```

**After**:
```typescript
const { data: limitConfig, error: limitError } = await supabase
  .from('mailbox_rate_limits')
  .select('*')
  .eq('mailbox_id', mailbox.id)
  .maybeSingle()  // ✅ Returns null if no row exists, no error
```

## Benefits

1. **No more 406 errors**: `.maybeSingle()` returns `null` instead of throwing when no row exists
2. **Graceful fallback**: Code continues with default rate limits when no config exists
3. **Better error handling**: Only logs actual errors (not "not found" cases)

## Behavior

- If a rate limit config exists: Returns the config and uses it
- If no rate limit config exists: Returns `null`, code uses default limits (100 hourly, 1000 daily)
- If there's a real error: Logs a warning but continues with defaults

## Files Changed

- `lib/email/sendViaMailbox.ts` - Updated `checkMailboxLimits()` function

## Status: ✅ FIXED

The fix has been committed and pushed to GitHub.

