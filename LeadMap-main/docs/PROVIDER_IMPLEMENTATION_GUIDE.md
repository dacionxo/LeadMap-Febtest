# OAuth Provider Implementation Guide

## Overview

This guide documents all implemented OAuth providers for the Postiz integration. Each provider follows the `BaseOAuthProvider` interface and is registered in the provider registry.

## Implemented Providers

### 1. X (Twitter) Provider

**Identifier**: `x` or `twitter`  
**OAuth Type**: OAuth 1.0a  
**Package**: `twitter-api-v2`

#### Environment Variables
```env
X_API_KEY=your_twitter_api_key
X_API_SECRET=your_twitter_api_secret
```

#### Features
- OAuth 1.0a three-legged flow
- Stores tokens as `accessToken:accessSecret` format
- Tokens don't expire (no refresh mechanism)
- Detects verified account status

#### Usage
```typescript
import { getProvider } from '@/lib/postiz/oauth/providers'

const provider = getProvider('x')
const authUrl = await provider.generateAuthUrl()
// Redirect user to authUrl.url
```

#### Token Refresh
X/Twitter tokens don't expire. If authentication fails, user must re-authenticate.

---

### 2. LinkedIn Provider

**Identifier**: `linkedin`  
**OAuth Type**: OAuth 2.0  
**Package**: Native fetch API

#### Environment Variables
```env
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

#### Scopes
- `openid`
- `profile`
- `email`
- `w_member_social`

#### Features
- Standard OAuth 2.0 authorization code flow
- Token refresh support
- Fetches user info and vanity name (username)

#### Token Refresh
LinkedIn provides refresh tokens that can be used to obtain new access tokens before expiration.

---

### 3. Instagram Standalone Provider

**Identifier**: `instagram-standalone`  
**OAuth Type**: OAuth 2.0  
**Package**: Native fetch API

#### Environment Variables
```env
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
```

#### Scopes
- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_comments`
- `instagram_business_manage_insights`

#### Features
- Two-step token exchange (short-lived → long-lived)
- Long-lived tokens last 60 days
- Special refresh endpoint (uses same token as refresh token)
- Handles HTTPS redirect requirements in production

#### Token Refresh
Instagram uses the same token as both access and refresh token. The refresh endpoint extends the token's lifetime.

#### Important Notes
- Requires HTTPS in production (uses redirect service if HTTP)
- Instagram Business Account required
- Long-lived tokens must be refreshed before 60-day expiration

---

### 4. Facebook Provider

**Identifier**: `facebook`  
**OAuth Type**: OAuth 2.0  
**Package**: Native fetch API

#### Environment Variables
```env
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

#### Scopes
- `pages_show_list`
- `business_management`
- `pages_manage_posts`
- `pages_manage_engagement`
- `pages_read_engagement`
- `read_insights`

#### Features
- Facebook Pages OAuth 2.0 flow
- Exchanges short-lived token for long-lived token (60 days)
- Fetches user's Facebook Pages
- Supports token refresh

#### Token Refresh
Facebook long-lived tokens can be refreshed before expiration by exchanging them again.

#### Important Notes
- Focused on Facebook Pages (not personal profiles)
- Returns user token; page-specific tokens available via `/me/accounts`
- Long-lived tokens last 60 days

---

## Provider Registry

All providers are automatically registered when the module is imported:

```typescript
import '@/lib/postiz/oauth/providers' // Registers all providers
import { getProvider, isProviderSupported } from '@/lib/postiz/oauth/providers'

// Check if provider is supported
if (isProviderSupported('x')) {
  const provider = getProvider('x')
  // Use provider
}
```

## Adding New Providers

To add a new provider:

1. **Create Provider Class**
   ```typescript
   import { BaseOAuthProvider } from './base-provider'
   
   export class MyProvider extends BaseOAuthProvider {
     identifier = 'my-provider'
     name = 'My Provider'
     scopes = ['scope1', 'scope2']
     
     async generateAuthUrl() { /* ... */ }
     async authenticate() { /* ... */ }
     async refreshToken() { /* ... */ }
   }
   ```

2. **Register in Registry**
   ```typescript
   // In lib/postiz/oauth/providers/index.ts
   import { MyProvider } from './my-provider'
   registerProvider(new MyProvider())
   ```

3. **Add to TypeScript Types**
   ```typescript
   // In lib/postiz/oauth/types.ts
   export enum SocialProviderIdentifier {
     // ...
     MY_PROVIDER = 'my-provider',
   }
   ```

## Testing Providers

Each provider should be tested with:

1. **OAuth Flow**
   - Initiate OAuth flow
   - Handle callback
   - Store credentials
   - Verify token validity

2. **Token Refresh** (if supported)
   - Wait for token expiration (or use test expired token)
   - Trigger refresh
   - Verify new token works

3. **Error Handling**
   - Invalid authorization code
   - Missing environment variables
   - Network errors
   - Scope mismatches

## Environment Variable Checklist

Before deploying, ensure all required environment variables are set:

- [ ] `X_API_KEY` and `X_API_SECRET` (for X/Twitter)
- [ ] `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` (for LinkedIn)
- [ ] `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` (for Instagram)
- [ ] `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` (for Facebook)
- [ ] `EMAIL_ENCRYPTION_KEY` (for credential encryption)
- [ ] `NEXT_PUBLIC_APP_URL` or `FRONTEND_URL` (for redirect URIs)

## Security Considerations

1. **Credential Storage**: All tokens are encrypted at rest using AES-256-GCM
2. **State Validation**: OAuth states expire after 15 minutes
3. **RLS Policies**: Database RLS ensures users can only access their own credentials
4. **HTTPS Required**: All OAuth flows should use HTTPS in production
5. **Scope Validation**: Providers validate requested scopes match granted scopes

## Troubleshooting

### Common Issues

**"Missing environment variables"**
- Ensure all required env vars are set for the provider
- Check `.env.local` or deployment environment

**"Invalid redirect URI"**
- Verify redirect URI matches exactly what's registered in provider's app settings
- Check `NEXT_PUBLIC_APP_URL` or `FRONTEND_URL`

**"Token refresh failed"**
- Some providers (X/Twitter) don't support refresh - user must re-authenticate
- For others, ensure refresh token is valid and not expired
- Check provider's refresh endpoint status

**"Scope mismatch"**
- Verify scopes in provider implementation match what's registered in provider app
- Some providers require exact scope matches

## API Endpoints

All providers use the same API endpoints:

- `GET /api/postiz/oauth/[provider]/initiate` - Start OAuth flow
- `GET /api/postiz/oauth/[provider]/callback` - Handle OAuth callback
- `POST /api/postiz/oauth/refresh` - Refresh expired tokens

Replace `[provider]` with the provider identifier (e.g., `x`, `linkedin`, `instagram-standalone`, `facebook`).
