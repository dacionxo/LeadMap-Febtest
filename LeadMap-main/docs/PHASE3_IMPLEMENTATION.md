# Phase 3 Implementation: Provider Connections

## Overview

Phase 3 implements OAuth authentication flows for connecting social media accounts to Postiz. This phase establishes the foundation for secure, encrypted credential storage and token management.

## Completed Components

### 1. OAuth Infrastructure

#### Type Definitions (`lib/postiz/oauth/types.ts`)
- `AuthTokenDetails`: Token information structure
- `GenerateAuthUrlResponse`: OAuth URL generation response
- `OAuthAuthenticateParams`: Authentication parameters
- `SocialProviderIdentifier`: Enum of supported providers
- `OAuthState`: Temporary state storage structure

#### Credential Management (`lib/postiz/oauth/credentials.ts`)
- **Encryption**: Uses existing AES-256-GCM encryption from `lib/email/encryption`
- **Storage**: Stores encrypted tokens in `credentials` table (TEXT columns for hex strings)
- Functions:
  - `storeOAuthCredentials()`: Store encrypted tokens after OAuth flow
  - `getOAuthCredentials()`: Retrieve and decrypt tokens
  - `updateOAuthCredentials()`: Update tokens (e.g., after refresh)
  - `deleteOAuthCredentials()`: Remove credentials on disconnect
  - `areCredentialsExpired()`: Check token expiration status

#### State Management (`lib/postiz/oauth/state-manager.ts`)
- **Temporary Storage**: Uses `oauth_states` table (15-minute expiration)
- Functions:
  - `storeOAuthState()`: Store OAuth state during flow
  - `getOAuthState()`: Retrieve and validate state
  - `deleteOAuthState()`: Clean up after use
  - `cleanupExpiredOAuthStates()`: Cron job cleanup function

### 2. Database Schema

#### OAuth States Table (`supabase/migrations/create_oauth_states_table.sql`)
- Stores temporary OAuth state during authentication flows
- 15-minute expiration for security
- RLS policies for user isolation
- Auto-cleanup function for expired states

#### Credentials Table Update
- Changed `BYTEA` to `TEXT` for encrypted tokens (hex strings from Node.js encryption)
- Compatible with existing encryption utility

### 3. API Endpoints

#### OAuth Initiation (`app/api/postiz/oauth/[provider]/initiate/route.ts`)
- **GET** `/api/postiz/oauth/[provider]/initiate`
- Generates OAuth authorization URL
- Stores state for validation
- Returns URL for client-side redirect

#### OAuth Callback (`app/api/postiz/oauth/[provider]/callback/route.ts`)
- **GET** `/api/postiz/oauth/[provider]/callback`
- Validates OAuth callback
- Authenticates with provider
- Creates/updates social account
- Stores encrypted credentials
- Redirects to success/error page

#### Token Refresh (`app/api/postiz/oauth/refresh/route.ts`)
- **POST** `/api/postiz/oauth/refresh`
- Checks token expiration
- Refreshes expired tokens
- Updates stored credentials
- Handles providers without refresh tokens

### 4. Provider Infrastructure

#### Base Provider (`lib/postiz/oauth/providers/base-provider.ts`)
- Abstract base class for OAuth providers
- PKCE utilities (code verifier/challenge generation)
- State generation utilities
- Scope validation helpers

#### Provider Registry (`lib/postiz/oauth/providers/index.ts`)
- Central registry for provider implementations
- Functions: `registerProvider()`, `getProvider()`, `getAllProviders()`, `isProviderSupported()`

#### Provider Implementations

**X Provider** (`lib/postiz/oauth/providers/x-provider.ts`)
- ✅ Full OAuth 1.0a implementation using `twitter-api-v2` package
- Handles token format (accessToken:accessSecret)
- Tokens don't expire (no refresh mechanism)
- Supports verified account status

**LinkedIn Provider** (`lib/postiz/oauth/providers/linkedin-provider.ts`)
- ✅ Full OAuth 2.0 implementation
- Standard authorization code flow
- Token refresh support
- Fetches user info and vanity name

**Instagram Standalone Provider** (`lib/postiz/oauth/providers/instagram-provider.ts`)
- ✅ Full OAuth 2.0 implementation for Instagram Basic Display API
- Two-step token exchange (short-lived → long-lived)
- Special refresh mechanism using Instagram's refresh endpoint
- Handles HTTPS redirect requirements

**Facebook Provider** (`lib/postiz/oauth/providers/facebook-provider.ts`)
- ✅ Full OAuth 2.0 implementation for Facebook Pages
- Long-lived token exchange (60 days)
- Token refresh support
- Fetches user pages for Facebook Page management

## Architecture Decisions

### Encryption Strategy
- **Choice**: Use existing `lib/email/encryption.ts` utility (AES-256-GCM)
- **Rationale**: Consistent with existing codebase, proven security, hex string output
- **Storage**: TEXT columns in Supabase (hex strings) instead of BYTEA

### State Management
- **Choice**: Supabase `oauth_states` table instead of Redis
- **Rationale**: Consistent with Supabase-first architecture, no additional infrastructure
- **Trade-off**: Slightly slower than Redis, but acceptable for OAuth flows

### Provider Pattern
- **Choice**: Abstract base class with registry pattern
- **Rationale**: Extensible, type-safe, follows Postiz architecture
- **Future**: Easy to add new providers by implementing `BaseOAuthProvider`

## Environment Variables Required

```env
# X/Twitter OAuth (when implementing X provider)
X_API_KEY=your_twitter_api_key
X_API_SECRET=your_twitter_api_secret

# LinkedIn OAuth (when implementing LinkedIn provider)
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Instagram OAuth (when implementing Instagram provider)
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret

# Encryption
EMAIL_ENCRYPTION_KEY=your_64_character_hex_encryption_key

# Frontend URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```

## Implementation Status

### ✅ Completed Providers

All major providers have been fully implemented:

1. **X/Twitter Provider** - ✅ Complete
   - OAuth 1.0a flow using `twitter-api-v2`
   - Token format handling (accessToken:accessSecret)
   - Verified account status detection

2. **LinkedIn Provider** - ✅ Complete
   - OAuth 2.0 flow
   - Token refresh mechanism
   - User info and vanity name fetching

3. **Instagram Standalone Provider** - ✅ Complete
   - Instagram Basic Display API
   - Two-step token exchange
   - Special refresh mechanism

4. **Facebook Provider** - ✅ Complete
   - Facebook Pages OAuth 2.0
   - Long-lived token exchange (60 days)
   - Token refresh support

### Additional Providers (Future)

The following providers from Postiz can be added later if needed:
- TikTok
- YouTube
- Threads
- Pinterest
- LinkedIn Pages
- Instagram (via Facebook Business)

### Webhook Endpoints (Future)

5. **Create Webhook Handlers**
   - `/api/postiz/webhooks/[provider]` endpoints
   - Handle delivery confirmations
   - Map to `webhook_events` table
   - Update `queue_jobs` status

### Token Refresh Cron Job

6. **Set Up Scheduled Token Refresh**
   - Supabase Edge Function or Next.js API route
   - Run periodically (e.g., every hour)
   - Refresh tokens expiring within 24 hours
   - Log failures to activity logs

## Testing Checklist

- [ ] OAuth initiation endpoint generates valid URLs
- [ ] OAuth state is stored and retrieved correctly
- [ ] OAuth callback validates state and creates account
- [ ] Credentials are encrypted and stored correctly
- [ ] Credentials can be decrypted and retrieved
- [ ] Token refresh works for providers with refresh tokens
- [ ] Expired states are cleaned up correctly
- [ ] RLS policies prevent cross-user access
- [ ] Error handling for invalid states, expired tokens, etc.

## Security Considerations

1. **Encryption**: All tokens encrypted at rest using AES-256-GCM
2. **State Expiration**: OAuth states expire after 15 minutes
3. **RLS**: Row-level security ensures users can only access their own credentials
4. **Validation**: State validation prevents CSRF attacks
5. **Error Messages**: Production error messages don't leak sensitive information

## Integration Points

- **Phase 1**: Uses `workspaces` table for multi-tenancy
- **Phase 2**: Uses `social_accounts` and `credentials` tables from data model
- **Phase 4**: Will use credentials for publishing posts
- **Phase 6**: Will use credentials for analytics API calls

## Files Created/Modified

### New Files
- `lib/postiz/oauth/types.ts`
- `lib/postiz/oauth/credentials.ts`
- `lib/postiz/oauth/state-manager.ts`
- `lib/postiz/oauth/providers/base-provider.ts`
- `lib/postiz/oauth/providers/index.ts`
- `lib/postiz/oauth/providers/x-provider.ts` (placeholder)
- `app/api/postiz/oauth/[provider]/initiate/route.ts`
- `app/api/postiz/oauth/[provider]/callback/route.ts`
- `app/api/postiz/oauth/refresh/route.ts`
- `supabase/migrations/create_oauth_states_table.sql`
- `docs/PHASE3_IMPLEMENTATION.md`

### Modified Files
- `supabase/migrations/create_postiz_data_model.sql` (changed BYTEA to TEXT)

## Notes

- X/Twitter provider requires `twitter-api-v2` package installation
- OAuth 1.0a (X/Twitter) and OAuth 2.0 (LinkedIn, Instagram) have different flows
- Some providers (X/Twitter) don't use refresh tokens - users must re-authenticate
- Webhook endpoints will be implemented in Phase 4 or Phase 7
- Token refresh cron job should be set up before production deployment
