# OAuth Email Integration Guide

## Overview

This guide documents the OAuth integration patterns for email providers (Gmail, Outlook) in LeadMap. The implementation follows Mautic's authentication patterns, adapted for Node.js/TypeScript.

## Architecture

### Components

1. **Authentication Interface** (`lib/email/auth/interface.ts`)
   - Standardized `OAuthProvider` interface
   - Consistent authentication patterns across providers

2. **Provider Implementations**
   - `GmailAuth` (`lib/email/auth/gmail.ts`) - Gmail OAuth implementation
   - `OutlookAuth` (`lib/email/auth/outlook.ts`) - Outlook OAuth implementation

3. **Token Persistence** (`lib/email/token-persistence.ts`)
   - Automatic encryption/decryption of tokens
   - Unified interface for token operations

4. **Token Refresh** (`lib/email/token-refresh.ts`)
   - Unified token refresh for all providers
   - Automatic retry with exponential backoff
   - Database persistence integration

5. **Error Handling** (`lib/email/errors.ts`)
   - Custom error classes for OAuth operations
   - Error classification (transient, authentication, permanent)
   - User-friendly error messages

## OAuth Flow Diagrams

### Gmail OAuth Flow

```
┌─────────┐         ┌──────────────┐         ┌──────────┐         ┌─────────────┐
│  User   │────────▶│  LeadMap UI │────────▶│  Google  │────────▶│  Callback   │
│         │         │              │         │  OAuth    │         │   Route     │
└─────────┘         └──────────────┘         └──────────┘         └─────────────┘
     │                      │                       │                      │
     │                      │                       │                      │
     │  1. Click Connect   │                       │                      │
     │◀────────────────────│                       │                      │
     │                      │                       │                      │
     │  2. Redirect to     │                       │                      │
     │     Google OAuth    │                       │                      │
     │────────────────────▶│──────────────────────▶│                      │
     │                      │                       │                      │
     │                      │  3. User Authorizes   │                      │
     │                      │◀──────────────────────│                      │
     │                      │                       │                      │
     │                      │  4. Redirect with    │                      │
     │                      │     Authorization     │                      │
     │                      │     Code              │                      │
     │                      │───────────────────────▶│─────────────────────▶│
     │                      │                       │                      │
     │                      │                       │  5. Exchange Code   │
     │                      │                       │     for Tokens      │
     │                      │                       │◀─────────────────────│
     │                      │                       │                      │
     │                      │  6. Get User Info    │                      │
     │                      │◀─────────────────────│                      │
     │                      │                       │                      │
     │  7. Success          │                       │                      │
     │◀────────────────────│                       │                      │
```

### Outlook OAuth Flow

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐         ┌─────────────┐
│  User   │────────▶│  LeadMap UI │────────▶│  Microsoft   │────────▶│  Callback   │
│         │         │              │         │  OAuth        │         │   Route     │
└─────────┘         └──────────────┘         └──────────────┘         └─────────────┘
     │                      │                       │                      │
     │  1. Click Connect   │                       │                      │
     │◀────────────────────│                       │                      │
     │                      │                       │                      │
     │  2. Redirect to     │                       │                      │
     │     Microsoft OAuth │                       │                      │
     │────────────────────▶│──────────────────────▶│                      │
     │                      │                       │                      │
     │                      │  3. User Authorizes   │                      │
     │                      │◀──────────────────────│                      │
     │                      │                       │                      │
     │                      │  4. Redirect with    │                      │
     │                      │     Authorization     │                      │
     │                      │     Code              │                      │
     │                      │───────────────────────▶│─────────────────────▶│
     │                      │                       │                      │
     │                      │                       │  5. Exchange Code   │
     │                      │                       │     for Tokens      │
     │                      │                       │◀─────────────────────│
     │                      │                       │                      │
     │                      │  6. Get User Info    │                      │
     │                      │◀─────────────────────│                      │
     │                      │                       │                      │
     │  7. Success          │                       │                      │
     │◀────────────────────│                       │                      │
```

## Implementation Details

### 1. OAuth Callback Routes

#### Gmail Callback (`app/api/mailboxes/oauth/gmail/callback/route.ts`)

```typescript
import { GmailAuth } from '@/lib/email/auth/gmail'
import { encryptMailboxTokens } from '@/lib/email/encryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  // Decode state to get userId
  const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
  const userId = decoded.userId
  
  // Authenticate using GmailAuth
  const gmailAuth = new GmailAuth()
  const tokenResult = await gmailAuth.authenticateIntegration(code, state, redirectUri)
  
  // Encrypt tokens before storing
  const encrypted = encryptMailboxTokens({
    access_token: tokenResult.accessToken,
    refresh_token: tokenResult.refreshToken,
    smtp_password: null
  })
  
  // Save to database
  await supabase.from('mailboxes').upsert({
    user_id: userId,
    provider: 'gmail',
    email: tokenResult.email,
    access_token: encrypted.access_token,
    refresh_token: encrypted.refresh_token,
    token_expires_at: expiresAt,
    active: true,
  })
}
```

#### Outlook Callback (`app/api/mailboxes/oauth/outlook/callback/route.ts`)

Similar pattern to Gmail, using `OutlookAuth` instead.

### 2. Token Persistence

Tokens are automatically encrypted before storage and decrypted when retrieved:

```typescript
import { createTokenPersistence } from '@/lib/email/token-persistence'

const persistence = createTokenPersistence(mailbox)

// Check authentication
if (persistence.isAuthenticated()) {
  const accessToken = persistence.getAccessToken()
  // Use access token...
}

// Update tokens (automatically encrypted)
const encrypted = persistence.setTokens({
  access_token: 'new_access_token',
  refresh_token: 'new_refresh_token',
  token_expires_at: new Date().toISOString()
})

// Save to database
await supabase.from('mailboxes').update(encrypted).eq('id', mailbox.id)
```

### 3. Token Refresh

Automatic token refresh with retry logic:

```typescript
import { refreshToken } from '@/lib/email/token-refresh'

const result = await refreshToken(mailbox, {
  supabase: supabaseClient,
  persistToDatabase: true,
  autoRetry: true,
  maxRetries: 3
})

if (result.success) {
  console.log('New access token:', result.accessToken)
} else {
  console.error('Refresh failed:', result.error)
}
```

### 4. Error Handling

Errors are classified and handled appropriately:

```typescript
import {
  TokenExpiredError,
  TokenRefreshError,
  AuthenticationError,
  classifyError,
  getUserFriendlyErrorMessage
} from '@/lib/email/errors'

try {
  // OAuth operation
} catch (error) {
  const errorType = classifyError(error)
  
  switch (errorType) {
    case 'transient':
      // Retry the operation
      break
    case 'authentication':
      // Trigger token refresh or re-authentication
      break
    case 'permanent':
      // Log and report to user
      break
  }
  
  const userMessage = getUserFriendlyErrorMessage(error)
  // Display to user
}
```

## Environment Variables

Required environment variables for OAuth:

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Outlook OAuth
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=common  # or specific tenant ID

# Encryption
EMAIL_ENCRYPTION_KEY=your_64_hex_character_key

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Security Considerations

1. **Token Encryption**: All tokens are encrypted using AES-256-GCM before storage
2. **State Parameter**: OAuth state includes userId and is base64-encoded
3. **HTTPS Only**: OAuth callbacks must use HTTPS in production
4. **Token Expiration**: Access tokens expire and are automatically refreshed
5. **Refresh Token Rotation**: Refresh tokens are kept secure and never exposed

## Testing

See the test files for examples:
- `tests/email/token-persistence.test.ts` - Token persistence tests
- `tests/email/token-refresh.test.ts` - Token refresh tests
- `tests/email/auth-interface.test.ts` - Authentication interface tests

## Troubleshooting

### Common Issues

1. **"Invalid grant" error**
   - Refresh token may have been revoked
   - User needs to reconnect their mailbox

2. **"Token expired" error**
   - Access token expired, refresh should be triggered automatically
   - Check token refresh logic

3. **"OAuth client not configured"**
   - Missing environment variables
   - Check `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.

4. **"Decryption failed"**
   - `EMAIL_ENCRYPTION_KEY` may have changed
   - Users may need to reconnect mailboxes

## Related Documentation

- [Token Refresh Strategy](./token-refresh-strategy.md)
- [Error Handling Guide](./error-handling-guide.md)
- [Adding New Providers](./adding-new-providers.md)










