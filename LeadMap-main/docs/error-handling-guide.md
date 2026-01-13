# Error Handling Guide

## Overview

This guide documents the error handling patterns for OAuth email operations in LeadMap. The implementation follows Mautic's error handling approach, adapted for Node.js/TypeScript.

## Error Classes

### Base Error: `OAuthError`

All OAuth-related errors extend from `OAuthError`:

```typescript
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode: number = 500,
    public readonly provider?: string,
    public readonly details?: unknown
  )
}
```

### Specific Error Types

#### `TokenExpiredError`

Thrown when an access token has expired:

```typescript
throw new TokenExpiredError('Gmail access token expired', 'gmail')
```

**Status Code**: 401  
**Error Code**: `TOKEN_EXPIRED`  
**Classification**: `authentication`  
**Action**: Trigger token refresh

#### `TokenRefreshError`

Thrown when token refresh fails:

```typescript
throw new TokenRefreshError('Failed to refresh Gmail token', 'gmail', {
  error_code: 'invalid_grant'
})
```

**Status Code**: 401  
**Error Code**: `TOKEN_REFRESH_ERROR`  
**Classification**: `permanent` (if `invalid_grant`) or `authentication`  
**Action**: User must re-authenticate

#### `AuthenticationError`

Thrown when authentication fails:

```typescript
throw new AuthenticationError('Gmail authentication failed', 'gmail', {
  status: 401,
  error_data: { error: 'invalid_client' }
})
```

**Status Code**: 401  
**Error Code**: `AUTHENTICATION_ERROR`  
**Classification**: `authentication`  
**Action**: Check credentials, may need re-authentication

## Error Classification

### Classification Function

```typescript
import { classifyError } from '@/lib/email/errors'

const errorType = classifyError(error)
// Returns: 'transient' | 'authentication' | 'permanent'
```

### Classification Rules

| Error Type | Conditions | Retry? | User Action |
|------------|------------|--------|-------------|
| **Transient** | Network errors, timeouts, rate limits (429), server errors (500+) | Yes | Retry automatically |
| **Authentication** | Token expired, authentication failed | Maybe | Refresh token or re-authenticate |
| **Permanent** | Invalid grant, missing tokens, configuration errors | No | Fix configuration or reconnect |

### Classification Logic

```typescript
export function classifyError(error: unknown): ErrorType {
  // Token expired - trigger refresh
  if (error instanceof TokenExpiredError) {
    return 'authentication'
  }
  
  // Token refresh failed - may need re-auth
  if (error instanceof TokenRefreshError) {
    return 'permanent' // Usually permanent (invalid_grant)
  }
  
  // Authentication failed - may need re-auth
  if (error instanceof AuthenticationError) {
    return 'authentication'
  }
  
  // Check status code for transient errors
  if (error instanceof OAuthError) {
    if (error.statusCode === 429 || error.statusCode >= 500 || error.statusCode === 408) {
      return 'transient'
    }
    return 'permanent'
  }
  
  // Network errors are transient
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('timeout')) {
      return 'transient'
    }
  }
  
  return 'permanent'
}
```

## Error Handling Patterns

### Pattern 1: Automatic Retry for Transient Errors

```typescript
import { retryWithBackoff } from '@/lib/email/retry'
import { isRetryableError } from '@/lib/email/errors'

async function sendEmailWithRetry(mailbox: Mailbox, email: EmailPayload) {
  return await retryWithBackoff(
    async () => {
      try {
        return await sendEmail(mailbox, email)
      } catch (error) {
        if (!isRetryableError(error)) {
          throw error // Don't retry non-retryable errors
        }
        throw error // Retry will be handled by retryWithBackoff
      }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000
    }
  )
}
```

### Pattern 2: Token Refresh on Expiration

```typescript
import { TokenExpiredError, classifyError } from '@/lib/email/errors'
import { refreshToken } from '@/lib/email/token-refresh'

async function sendEmailWithAutoRefresh(mailbox: Mailbox, email: EmailPayload) {
  try {
    return await sendEmail(mailbox, email)
  } catch (error) {
    // Check if token expired
    if (error instanceof TokenExpiredError || classifyError(error) === 'authentication') {
      // Try refreshing token
      const refreshResult = await refreshToken(mailbox, {
        supabase,
        persistToDatabase: true
      })
      
      if (refreshResult.success) {
        // Retry with new token
        mailbox.access_token = refreshResult.accessToken
        return await sendEmail(mailbox, email)
      } else {
        // Refresh failed, user needs to reconnect
        throw new Error('Please reconnect your mailbox')
      }
    }
    
    // Re-throw other errors
    throw error
  }
}
```

### Pattern 3: User-Friendly Error Messages

```typescript
import { getUserFriendlyErrorMessage } from '@/lib/email/errors'

try {
  await sendEmail(mailbox, email)
} catch (error) {
  const userMessage = getUserFriendlyErrorMessage(error)
  
  // Display to user
  showError(userMessage)
  
  // Log detailed error for debugging
  console.error('Email send failed:', {
    error: error.message,
    errorType: classifyError(error),
    mailbox_id: mailbox.id
  })
}
```

### Pattern 4: Error Logging and Monitoring

```typescript
import { classifyError, isOAuthError } from '@/lib/email/errors'

try {
  await performOAuthOperation()
} catch (error) {
  const errorType = classifyError(error)
  
  // Log for monitoring
  logError({
    error: error.message,
    errorType,
    errorCode: isOAuthError(error) ? error.code : undefined,
    statusCode: isOAuthError(error) ? error.statusCode : undefined,
    provider: isOAuthError(error) ? error.provider : undefined,
    details: isOAuthError(error) ? error.details : undefined
  })
  
  // Send to error tracking service
  if (errorType === 'permanent') {
    sendToErrorTracking(error)
  }
}
```

## Helper Functions

### `isRetryableError(error)`

Checks if an error should be retried:

```typescript
import { isRetryableError } from '@/lib/email/errors'

if (isRetryableError(error)) {
  // Retry the operation
} else {
  // Don't retry, handle error
}
```

### `requiresReAuthentication(error)`

Checks if an error requires user re-authentication:

```typescript
import { requiresReAuthentication } from '@/lib/email/errors'

if (requiresReAuthentication(error)) {
  // Prompt user to reconnect mailbox
  showReconnectPrompt()
}
```

### `isTokenExpiredError(error)`

Checks if an error indicates token expiration:

```typescript
import { isTokenExpiredError } from '@/lib/email/errors'

if (isTokenExpiredError(error)) {
  // Trigger token refresh
  await refreshToken(mailbox)
}
```

### `getUserFriendlyErrorMessage(error)`

Gets a user-friendly error message:

```typescript
import { getUserFriendlyErrorMessage } from '@/lib/email/errors'

const userMessage = getUserFriendlyErrorMessage(error)
// Returns messages like:
// - "Your session has expired. Please reconnect your account."
// - "Your account connection has expired. Please reconnect your account."
// - "Authentication failed. Please try connecting again."
```

## Provider-Specific Error Handling

### Gmail Errors

```typescript
// Gmail API errors
if (response.status === 401) {
  throw new TokenExpiredError('Gmail access token expired', 'gmail')
}

if (response.status === 429) {
  throw new OAuthError('Gmail rate limit exceeded', 'RATE_LIMIT', 429, 'gmail')
}

if (response.status >= 500) {
  throw new OAuthError('Gmail server error', 'SERVER_ERROR', response.status, 'gmail')
}
```

### Outlook Errors

```typescript
// Microsoft Graph API errors
if (response.status === 401) {
  const errorData = await response.json()
  if (errorData.error?.code === 'InvalidAuthenticationToken') {
    throw new TokenExpiredError('Outlook access token expired', 'outlook')
  }
  throw new AuthenticationError('Outlook authentication failed', 'outlook', errorData)
}

if (response.status === 429) {
  throw new OAuthError('Outlook rate limit exceeded', 'RATE_LIMIT', 429, 'outlook')
}
```

## Best Practices

1. **Always Classify Errors**: Use `classifyError()` to determine handling strategy
2. **User-Friendly Messages**: Use `getUserFriendlyErrorMessage()` for user-facing errors
3. **Detailed Logging**: Log full error details for debugging, but don't expose to users
4. **Retry Transient Errors**: Automatically retry transient errors with exponential backoff
5. **Handle Authentication Errors**: Prompt for re-authentication when needed
6. **Monitor Error Rates**: Track error rates by type for monitoring and alerting

## Error Response Format

### API Error Response

```typescript
{
  success: false,
  error: "User-friendly error message",
  errorCode: "TOKEN_EXPIRED",
  errorType: "authentication",
  details: {
    // Additional error details (not exposed to users)
  }
}
```

### Logging Format

```typescript
{
  error: "Original error message",
  errorType: "transient" | "authentication" | "permanent",
  errorCode: "TOKEN_EXPIRED",
  statusCode: 401,
  provider: "gmail",
  mailbox_id: "uuid",
  mailbox_email: "user@example.com",
  timestamp: "2024-01-01T00:00:00Z",
  details: {
    // Additional context
  }
}
```

## Testing Error Handling

See `tests/email/error-handling.test.ts` for comprehensive error handling tests.

## Related Documentation

- [OAuth Email Integration](./oauth-email-integration.md)
- [Token Refresh Strategy](./token-refresh-strategy.md)










