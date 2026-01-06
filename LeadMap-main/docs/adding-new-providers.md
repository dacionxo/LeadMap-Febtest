# Adding New OAuth Email Providers

## Overview

This guide explains how to add support for new OAuth email providers to LeadMap. The implementation follows Mautic's authentication patterns, adapted for Node.js/TypeScript.

## Step-by-Step Guide

### Step 1: Create Provider Authentication Class

Create a new file in `lib/email/auth/` implementing the `OAuthProvider` interface:

```typescript
// lib/email/auth/newprovider.ts
import { OAuthProvider, TokenResult } from './interface'
import { Mailbox } from '../types'
import { AuthenticationError, ConfigurationError } from '../errors'

export class NewProviderAuth implements OAuthProvider {
  isAuthenticated(mailbox: Mailbox): boolean {
    return !!(mailbox.access_token && mailbox.refresh_token && mailbox.token_expires_at)
  }

  async authenticateIntegration(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<TokenResult> {
    const clientId = process.env.NEW_PROVIDER_CLIENT_ID
    const clientSecret = process.env.NEW_PROVIDER_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new ConfigurationError(
        'New Provider OAuth client not configured (NEW_PROVIDER_CLIENT_ID/SECRET missing)'
      )
    }

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://api.newprovider.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}))
        throw new AuthenticationError(
          errorData.error_description || errorData.error || `Failed to exchange code for tokens (${tokenResponse.status})`,
          { status: tokenResponse.status, error_data: errorData }
        )
      }

      const tokens = await tokenResponse.json()
      const { access_token, refresh_token, expires_in } = tokens

      // Get user information
      const userInfoResponse = await fetch('https://api.newprovider.com/user', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      })

      if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.json().catch(() => ({}))
        throw new AuthenticationError(
          errorData.error_description || errorData.error || `Failed to get user info (${userInfoResponse.status})`,
          { status: userInfoResponse.status, error_data: errorData }
        )
      }

      const userInfo = await userInfoResponse.json()
      const email = userInfo.email
      const displayName = userInfo.name || email

      return {
        success: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        email,
        displayName,
      }
    } catch (error: any) {
      if (error instanceof AuthenticationError || error instanceof ConfigurationError) {
        throw error
      }
      throw new AuthenticationError(`Error during New Provider authentication: ${error.message}`, {
        original_error: error
      })
    }
  }
}
```

### Step 2: Add Token Refresh Support

Add token refresh logic to `lib/email/token-refresh.ts`:

```typescript
// In lib/email/token-refresh.ts

async function refreshNewProviderTokenInternal(
  mailbox: Mailbox,
  tokenPersistence: TokenPersistence
): Promise<TokenRefreshResult> {
  const refreshToken = tokenPersistence.getRefreshToken()
  
  if (!refreshToken) {
    return {
      success: false,
      error: 'Missing New Provider refresh token',
      errorCode: 'MISSING_REFRESH_TOKEN',
      shouldRetry: false
    }
  }

  const clientId = process.env.NEW_PROVIDER_CLIENT_ID
  const clientSecret = process.env.NEW_PROVIDER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'New Provider OAuth client not configured',
      errorCode: 'OAUTH_NOT_CONFIGURED',
      shouldRetry: false
    }
  }

  try {
    const response = await fetch('https://api.newprovider.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorCode = errorData.error || 'UNKNOWN_ERROR'
      const shouldRetry = response.status === 429 || response.status >= 500 || response.status === 408
      
      return {
        success: false,
        error: errorData.error_description || 'Failed to refresh token',
        errorCode,
        shouldRetry
      }
    }

    const data = await response.json()
    const newAccessToken = data.access_token
    const expiresIn = data.expires_in || 3600

    if (!newAccessToken) {
      return {
        success: false,
        error: 'Token refresh response did not include access_token',
        errorCode: 'INVALID_RESPONSE',
        shouldRetry: false
      }
    }

    return {
      success: true,
      accessToken: newAccessToken,
      expiresIn
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to refresh token',
      errorCode: 'NETWORK_ERROR',
      shouldRetry: true
    }
  }
}

// Update refreshToken function to handle new provider
export async function refreshToken(
  mailbox: Mailbox,
  options: TokenRefreshOptions = {}
): Promise<TokenRefreshResult> {
  // ... existing code ...
  
  const refreshFunction = async (): Promise<TokenRefreshResult> => {
    let result: TokenRefreshResult

    if (mailbox.provider === 'gmail') {
      result = await refreshGmailTokenInternal(mailbox, tokenPersistence)
    } else if (mailbox.provider === 'outlook') {
      result = await refreshOutlookTokenInternal(mailbox, tokenPersistence)
    } else if (mailbox.provider === 'newprovider') {
      result = await refreshNewProviderTokenInternal(mailbox, tokenPersistence)
    } else {
      return {
        success: false,
        error: `Token refresh not supported for provider: ${mailbox.provider}`,
        errorCode: 'UNSUPPORTED_PROVIDER',
        shouldRetry: false
      }
    }
    
    // ... rest of function ...
  }
}
```

### Step 3: Create OAuth Callback Route

Create a new route in `app/api/mailboxes/oauth/newprovider/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { encryptMailboxTokens } from '@/lib/email/encryption'
import { NewProviderAuth } from '@/lib/email/auth/newprovider'
import { AuthenticationError, ConfigurationError } from '@/lib/email/errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=missing_params`
      )
    }

    // Decode state to get userId
    let userId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = decoded.userId
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=invalid_state`
      )
    }

    // Verify user authentication
    const cookieStore = cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user || user.id !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=unauthorized`
      )
    }

    // Authenticate with provider
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/mailboxes/oauth/newprovider/callback`

    const newProviderAuth = new NewProviderAuth()
    const tokenResult = await newProviderAuth.authenticateIntegration(code, state, redirectUri)

    if (!tokenResult.success) {
      throw new AuthenticationError(tokenResult.error || 'New Provider authentication failed')
    }

    const { accessToken, refreshToken, expiresIn, email, displayName } = tokenResult

    const expiresAt = new Date(Date.now() + (expiresIn! * 1000)).toISOString()

    // Encrypt tokens before storing
    const encrypted = encryptMailboxTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
      smtp_password: null
    })

    // Save to database
    const supabase = supabaseAuth
    const { error: dbError } = await supabase
      .from('mailboxes')
      .upsert({
        user_id: user.id,
        provider: 'newprovider',
        email,
        display_name: displayName,
        access_token: encrypted.access_token || accessToken,
        refresh_token: encrypted.refresh_token || refreshToken,
        token_expires_at: expiresAt,
        active: true,
      }, {
        onConflict: 'user_id,email,provider',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=database_error`
      )
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&success=newprovider_connected`
    )
  } catch (error) {
    console.error('Error in New Provider OAuth callback:', error)
    let errorMessage = 'Internal server error'
    if (error instanceof AuthenticationError || error instanceof ConfigurationError) {
      errorMessage = error.message
    }
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(errorMessage)}`
    )
  }
}
```

### Step 4: Create OAuth Initiate Route

Create a route to initiate OAuth flow in `app/api/mailboxes/oauth/newprovider/initiate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore,
  })
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = process.env.NEW_PROVIDER_CLIENT_ID
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const redirectUri = `${baseUrl}/api/mailboxes/oauth/newprovider/callback`

  // Create state with userId
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')

  // Build OAuth URL
  const authUrl = new URL('https://api.newprovider.com/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId!)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'email send')
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
```

### Step 5: Add Provider to Types

Update `lib/email/types.ts` to include the new provider:

```typescript
export type EmailProvider = 'gmail' | 'outlook' | 'smtp' | 'resend' | 'sendgrid' | 'mailgun' | 'aws-ses' | 'newprovider'
```

### Step 6: Create Email Sending Provider

Create `lib/email/providers/newprovider.ts`:

```typescript
import { Mailbox, EmailPayload, SendResult } from '../types'
import { createTokenPersistence } from '../token-persistence'
import { refreshToken as refreshOAuthToken } from '../token-refresh'
import {
  TokenExpiredError,
  TokenRefreshError,
  AuthenticationError,
  getUserFriendlyErrorMessage,
  classifyError,
  TransientError
} from '../errors'
import { retryWithBackoff } from '../retry'

export async function newProviderSend(
  mailbox: Mailbox,
  email: EmailPayload,
  supabase?: any
): Promise<SendResult> {
  try {
    const tokenPersistence = createTokenPersistence(mailbox)

    if (!tokenPersistence.isAuthenticated()) {
      throw new AuthenticationError('New Provider mailbox is not authenticated')
    }

    let accessToken = tokenPersistence.getAccessToken()

    // Check if token needs refresh
    if (tokenPersistence.isTokenExpired(5)) {
      const currentRefreshToken = tokenPersistence.getRefreshToken()
      if (!currentRefreshToken) {
        throw new TokenExpiredError('New Provider refresh token is missing')
      }

      const refreshed = await refreshOAuthToken(mailbox, {
        supabase,
        persistToDatabase: true
      })
      
      if (!refreshed.success || !refreshed.accessToken) {
        throw new TokenRefreshError(
          refreshed.error || 'Failed to refresh New Provider token',
          'newprovider',
          { error_code: refreshed.errorCode }
        )
      }
      
      accessToken = refreshed.accessToken
    }

    if (!accessToken) {
      throw new AuthenticationError('New Provider access token is missing')
    }

    // Send email via provider API
    const sendOnce = async (token: string) => {
      const response = await fetch('https://api.newprovider.com/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          html: email.html,
          from: email.fromEmail || mailbox.email
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || `New Provider API error: ${response.status}`
        const errorObject = { message: errorMessage, statusCode: response.status }
        const errorType = classifyError(errorObject)

        if (errorType === 'authentication') {
          throw new AuthenticationError(errorMessage, { status: response.status, error_data: errorData })
        } else if (errorType === 'transient') {
          throw new TransientError(errorMessage, { status: response.status, error_data: errorData })
        } else {
          throw new Error(errorMessage)
        }
      }
      
      return response
    }

    const response = await retryWithBackoff(() => sendOnce(accessToken!), {
      maxRetries: 2,
      initialDelay: 1000,
      maxDelay: 5000,
    })

    const data = await response.json()
    return {
      success: true,
      providerMessageId: data.id
    }
  } catch (error: any) {
    const userFriendlyError = getUserFriendlyErrorMessage(error)
    console.error('New Provider send exception', {
      error: error.message,
      stack: error.stack,
      mailbox_id: mailbox.id,
      mailbox_email: mailbox.email,
      error_type: classifyError(error),
      user_friendly_message: userFriendlyError
    })
    return {
      success: false,
      error: userFriendlyError
    }
  }
}
```

### Step 7: Integrate with Email Sending

Update `lib/email/sendViaMailbox.ts` to include the new provider:

```typescript
import { newProviderSend } from './providers/newprovider'

// In sendViaMailbox function
if (mailbox.provider === 'newprovider') {
  return await newProviderSend(mailbox, email, supabase)
}
```

### Step 8: Add Environment Variables

Add to `.env.example` and document in `EMAIL_ENVIRONMENT_SETUP.md`:

```bash
NEW_PROVIDER_CLIENT_ID=your_client_id
NEW_PROVIDER_CLIENT_SECRET=your_client_secret
```

### Step 9: Update Database Schema

Ensure the `mailboxes` table supports the new provider (it should already if using the `provider` enum/string column).

### Step 10: Add Tests

Create tests in `tests/email/providers/newprovider.test.ts`:

```typescript
import { newProviderSend } from '@/lib/email/providers/newprovider'
import { Mailbox, EmailPayload } from '@/lib/email/types'

describe('NewProvider Send', () => {
  it('should send email successfully', async () => {
    // Test implementation
  })
  
  it('should refresh token when expired', async () => {
    // Test implementation
  })
  
  // Add more tests...
})
```

## Checklist

- [ ] Create provider authentication class
- [ ] Add token refresh support
- [ ] Create OAuth callback route
- [ ] Create OAuth initiate route
- [ ] Add provider to types
- [ ] Create email sending provider
- [ ] Integrate with email sending
- [ ] Add environment variables
- [ ] Update documentation
- [ ] Add tests
- [ ] Test OAuth flow end-to-end
- [ ] Test token refresh
- [ ] Test error handling

## Best Practices

1. **Follow Existing Patterns**: Use Gmail/Outlook implementations as templates
2. **Error Handling**: Always use the error classes from `lib/email/errors.ts`
3. **Token Management**: Use `TokenPersistence` for token operations
4. **Retry Logic**: Use `retryWithBackoff` for API calls
5. **Logging**: Log errors with context (mailbox_id, provider, etc.)
6. **Testing**: Write comprehensive tests for all scenarios

## Related Documentation

- [OAuth Email Integration](./oauth-email-integration.md)
- [Token Refresh Strategy](./token-refresh-strategy.md)
- [Error Handling Guide](./error-handling-guide.md)




