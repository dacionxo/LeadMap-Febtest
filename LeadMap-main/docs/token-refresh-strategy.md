# Token Refresh Strategy

## Overview

This document describes the unified token refresh strategy for OAuth email providers in LeadMap. The implementation follows Mautic's token refresh patterns, adapted for Node.js/TypeScript.

## Architecture

### Unified Refresh Function

The `refreshToken()` function in `lib/email/token-refresh.ts` provides a unified interface for refreshing tokens across all OAuth providers:

```typescript
import { refreshToken } from '@/lib/email/token-refresh'

const result = await refreshToken(mailbox, {
  supabase: supabaseClient,
  persistToDatabase: true,
  autoRetry: true,
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000
})
```

### Key Features

1. **Provider Agnostic**: Works for both Gmail and Outlook
2. **Automatic Retry**: Exponential backoff for transient failures
3. **Database Persistence**: Optionally saves refreshed tokens automatically
4. **Error Classification**: Distinguishes between retryable and permanent errors

## Token Refresh Flow

```
┌─────────────┐
│   Request   │
│   Refresh   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Check Provider │
│  (Gmail/Outlook)│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Get Refresh    │
│  Token (decrypt) │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Call Provider  │
│  Token Endpoint │
└──────┬──────────┘
       │
       ├─── Success ───▶┌─────────────────┐
       │                 │  Encrypt Token  │
       │                 └──────┬──────────┘
       │                        │
       │                        ▼
       │                 ┌─────────────────┐
       │                 │  Save to DB     │
       │                 │  (if requested) │
       │                 └──────┬──────────┘
       │                        │
       │                        ▼
       │                 ┌─────────────────┐
       │                 │  Return Success │
       │                 └─────────────────┘
       │
       └─── Failure ───▶┌─────────────────┐
                         │  Classify Error │
                         └──────┬──────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌──────────────┐      ┌──────────────┐
            │  Retryable?  │      │  Permanent?  │
            └──────┬───────┘      └──────┬───────┘
                   │                     │
        ┌──────────┴──────────┐          │
        │                     │          │
        ▼                     ▼          ▼
┌──────────────┐    ┌──────────────┐  ┌──────────────┐
│ Retry with   │    │ Max Retries  │  │ Return Error │
│ Backoff      │    │ Exceeded?    │  │ Immediately │
└──────┬───────┘    └──────┬───────┘  └──────────────┘
       │                   │
       │                   ▼
       │            ┌──────────────┐
       │            │ Return Error │
       │            └──────────────┘
       │
       └───────────▶┌──────────────┐
                    │ Return Error │
                    └──────────────┘
```

## Retry Strategy

### Exponential Backoff

The retry mechanism uses exponential backoff with jitter:

```typescript
const delay = Math.min(
  initialDelay * Math.pow(2, attempt),
  maxDelay
)

const jitteredDelay = delay + Math.random() * 1000
```

**Default Configuration:**
- `initialDelay`: 1000ms (1 second)
- `maxDelay`: 10000ms (10 seconds)
- `maxRetries`: 3 attempts
- `backoffMultiplier`: 2x per attempt

**Retry Schedule Example:**
- Attempt 1: Immediate
- Attempt 2: ~1-2 seconds (1000ms + jitter)
- Attempt 3: ~2-3 seconds (2000ms + jitter)
- Attempt 4: ~4-5 seconds (4000ms + jitter)

### Error Classification

Errors are classified to determine retry behavior:

| Error Type | Status Code | Retry? | Action |
|------------|------------|--------|--------|
| Rate Limit | 429 | Yes | Retry with backoff |
| Server Error | 500+ | Yes | Retry with backoff |
| Timeout | 408 | Yes | Retry with backoff |
| Invalid Grant | 400 | No | User must re-authenticate |
| Missing Token | N/A | No | Configuration error |
| Network Error | N/A | Yes | Retry with backoff |

## Provider-Specific Implementation

### Gmail Token Refresh

```typescript
async function refreshGmailTokenInternal(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence
): Promise<TokenRefreshResult> {
  const refreshToken = tokenPersistence.getRefreshToken()
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })
  
  // Handle response...
}
```

### Outlook Token Refresh

```typescript
async function refreshOutlookTokenInternal(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence
): Promise<TokenRefreshResult> {
  const refreshToken = tokenPersistence.getRefreshToken()
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'
  
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Send offline_access'
      })
    }
  )
  
  // Handle response...
}
```

## Database Persistence

When `persistToDatabase: true` is set, refreshed tokens are automatically saved:

```typescript
async function persistTokensToDatabase(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence,
  accessToken: string,
  expiresIn: number,
  supabase: any
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  
  const encryptedTokens = tokenPersistence.setTokens({
    access_token: accessToken,
    refresh_token: null, // Keep existing refresh token
    token_expires_at: expiresAt
  })
  
  await supabase
    .from('mailboxes')
    .update({
      access_token: encryptedTokens.access_token,
      token_expires_at: encryptedTokens.token_expires_at,
      updated_at: new Date().toISOString()
    })
    .eq('id', mailbox.id)
}
```

## Usage Patterns

### Pattern 1: Automatic Refresh Before API Call

```typescript
import { createTokenPersistence } from '@/lib/email/token-persistence'
import { refreshToken } from '@/lib/email/token-refresh'

const persistence = createTokenPersistence(mailbox)

// Check if token needs refresh
if (persistence.isTokenExpired(5)) {
  const result = await refreshToken(mailbox, {
    supabase,
    persistToDatabase: true
  })
  
  if (!result.success) {
    throw new Error('Failed to refresh token')
  }
  
  // Update mailbox with new token
  mailbox.access_token = result.accessToken
}

// Use token for API call
const accessToken = persistence.getAccessToken()
```

### Pattern 2: Cron Job Token Refresh

```typescript
// In cron job: app/api/cron/sync-mailboxes/route.ts
async function refreshTokenIfNeeded(
  mailbox: Mailbox,
  supabase: any,
  now: Date
): Promise<string | null> {
  const needsRefresh = !mailbox.access_token ||
    (mailbox.token_expires_at &&
     new Date(mailbox.token_expires_at) < new Date(now.getTime() + 5 * 60 * 1000))
  
  if (!needsRefresh) {
    return mailbox.access_token
  }
  
  const result = await refreshToken(mailbox, {
    supabase,
    persistToDatabase: true,
    autoRetry: true
  })
  
  return result.success ? result.accessToken : null
}
```

### Pattern 3: Error Recovery

```typescript
import { refreshToken } from '@/lib/email/token-refresh'
import { TokenExpiredError, classifyError } from '@/lib/email/errors'

try {
  // API call with access token
  await sendEmail(mailbox, email)
} catch (error) {
  if (error instanceof TokenExpiredError || classifyError(error) === 'authentication') {
    // Token expired, try refreshing
    const refreshResult = await refreshToken(mailbox, {
      supabase,
      persistToDatabase: true
    })
    
    if (refreshResult.success) {
      // Retry API call with new token
      mailbox.access_token = refreshResult.accessToken
      await sendEmail(mailbox, email)
    } else {
      // Refresh failed, user needs to reconnect
      throw new Error('Please reconnect your mailbox')
    }
  } else {
    throw error
  }
}
```

## Best Practices

1. **Proactive Refresh**: Refresh tokens 5 minutes before expiration
2. **Error Handling**: Always handle refresh failures gracefully
3. **Logging**: Log refresh attempts and failures for debugging
4. **Rate Limiting**: Respect provider rate limits (429 errors)
5. **Token Security**: Never log or expose refresh tokens
6. **Database Updates**: Always update `updated_at` when saving tokens

## Monitoring

Key metrics to monitor:

- Token refresh success rate
- Token refresh failure rate by error type
- Average time to refresh
- Number of retries per refresh
- Token expiration vs refresh timing

## Troubleshooting

### Issue: "Token refresh failed: invalid_grant"

**Cause**: Refresh token has been revoked or expired

**Solution**: User must reconnect their mailbox

### Issue: "Token refresh failed: rate limit"

**Cause**: Too many refresh requests

**Solution**: Implement rate limiting and exponential backoff (already included)

### Issue: "Token refresh failed: network error"

**Cause**: Network connectivity issue

**Solution**: Retry with exponential backoff (already included)

### Issue: Tokens not persisting to database

**Cause**: `persistToDatabase` not set or `supabase` not provided

**Solution**: Ensure both are set when calling `refreshToken()`

## Related Documentation

- [OAuth Email Integration](./oauth-email-integration.md)
- [Error Handling Guide](./error-handling-guide.md)


