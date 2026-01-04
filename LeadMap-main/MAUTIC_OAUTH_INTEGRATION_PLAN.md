# Mautic OAuth Email Integration Plan

This document outlines the integration plan for enhancing LeadMap's OAuth email sending features based on patterns and best practices from [Mautic](https://github.com/mautic/mautic), the world's largest open-source marketing automation platform.

## Executive Summary

Mautic provides robust OAuth2 implementation patterns for email integrations that we can adapt for LeadMap's Node.js/TypeScript codebase. Key improvements focus on:
1. Centralized token persistence and management
2. Standardized authentication interfaces
3. Enhanced error handling and token refresh strategies
4. Better abstraction for OAuth flows

## Research Findings from Mautic

### 1. Token Persistence Pattern

**Mautic's Approach:**
- Uses `TokenPersistenceInterface` to abstract token storage
- Automatically manages `access_token`, `refresh_token`, and `expires_at`
- Stores tokens in encrypted format within the integration entity
- Provides factory pattern (`TokenPersistenceFactory`) for creating persistence instances

**Key Code Pattern:**
```php
$tokenPersistence = $tokenPersistenceFactory->create($integration);
// Automatically handles storage, encryption, and retrieval
```

**LeadMap Current State:**
- ✅ Has encryption utilities (`encryptMailboxTokens`/`decryptMailboxTokens`)
- ✅ Stores tokens in `mailboxes` table
- ❌ No centralized token persistence interface
- ❌ Token refresh logic scattered across multiple files

### 2. Authentication Interface Pattern

**Mautic's Approach:**
- Defines `AuthenticationInterface` with standardized methods:
  - `isAuthenticated(): bool` - Check if integration is authorized
  - `authenticateIntegration(Request $request): string` - Handle OAuth flow

**Key Benefits:**
- Consistent authentication checking across providers
- Unified OAuth flow handling
- Better testability and maintainability

**LeadMap Current State:**
- ❌ No standardized authentication interface
- ✅ Has OAuth flow implementations but they're provider-specific
- ✅ Has authentication checks but not abstracted

### 3. OAuth2 Authorization Code Flow

**Mautic's Standard Flow:**
1. Redirect to authorization endpoint with `client_id`, `redirect_uri`, `state`, `response_type=code`
2. User grants permission, gets redirected back with `code` and `state`
3. Exchange `code` for `access_token` and `refresh_token` via token endpoint
4. Store tokens using token persistence service
5. Refresh tokens automatically when expired

**LeadMap Current State:**
- ✅ Implements OAuth2 Authorization Code flow for Gmail and Outlook
- ✅ Has token refresh logic
- ✅ Stores tokens with encryption
- ❌ Token refresh logic is duplicated across providers
- ❌ No unified token refresh strategy

### 4. Error Handling and Token Refresh

**Mautic's Patterns:**
- Automatic token refresh on expiration
- Centralized error handling for OAuth failures
- Graceful degradation when refresh fails
- Clear separation between authentication errors and API errors

**LeadMap Current State:**
- ✅ Has retry logic with exponential backoff
- ✅ Handles 401 errors with token refresh
- ✅ Has cron jobs for proactive token refresh
- ❌ Token refresh logic duplicated in multiple places
- ❌ Inconsistent error handling patterns

## Integration Plan

### Phase 1: Create Token Persistence Abstraction

**Goal:** Centralize token management with a unified interface

**Tasks:**
1. Create `lib/email/token-persistence.ts` with:
   - `TokenPersistenceInterface` interface
   - `TokenPersistence` class implementing the interface
   - Methods: `getAccessToken()`, `getRefreshToken()`, `setTokens()`, `clearTokens()`, `isAuthenticated()`

2. Refactor existing token encryption/decryption to use the persistence interface

3. Update mailbox providers (Gmail, Outlook) to use token persistence

**Files to Create/Modify:**
- `lib/email/token-persistence.ts` (new)
- `lib/email/providers/gmail.ts` (refactor)
- `lib/email/providers/outlook.ts` (refactor)

### Phase 2: Standardize Authentication Interface

**Goal:** Create consistent authentication patterns across providers

**Tasks:**
1. Create `lib/email/auth/interface.ts` with:
   - `OAuthProvider` interface
   - `isAuthenticated(mailbox: Mailbox): boolean` function
   - `authenticateIntegration(code: string, state: string): Promise<TokenResult>` function

2. Implement provider-specific authentication classes:
   - `GmailAuth` implementing `OAuthProvider`
   - `OutlookAuth` implementing `OAuthProvider`

3. Refactor OAuth callback routes to use new interfaces

**Files to Create/Modify:**
- `lib/email/auth/interface.ts` (new)
- `lib/email/auth/gmail.ts` (new)
- `lib/email/auth/outlook.ts` (new)
- `app/api/mailboxes/oauth/gmail/callback/route.ts` (refactor)
- `app/api/mailboxes/oauth/outlook/callback/route.ts` (refactor)

### Phase 3: Unified Token Refresh Strategy

**Goal:** Consolidate token refresh logic and improve reliability

**Tasks:**
1. Create `lib/email/token-refresh.ts` with:
   - Unified token refresh function that works for all providers
   - Automatic retry with exponential backoff
   - Proper error handling and logging
   - Integration with token persistence

2. Remove duplicate token refresh logic from:
   - `lib/email/providers/gmail.ts`
   - `lib/email/providers/outlook.ts`
   - `lib/email/unibox/gmail-connector.ts`
   - `lib/email/unibox/outlook-connector.ts`

3. Update cron jobs to use unified token refresh

**Files to Create/Modify:**
- `lib/email/token-refresh.ts` (new)
- `lib/email/providers/gmail.ts` (refactor - remove duplicate)
- `lib/email/providers/outlook.ts` (refactor - remove duplicate)
- `app/api/cron/sync-mailboxes/route.ts` (refactor)
- `app/api/cron/gmail-watch-renewal/route.ts` (refactor)

### Phase 4: Enhanced Error Handling

**Goal:** Improve error handling patterns based on Mautic's approach

**Tasks:**
1. Create error types for OAuth errors:
   - `OAuthError` - Base class for OAuth-related errors
   - `TokenExpiredError` - Token has expired
   - `TokenRefreshError` - Token refresh failed
   - `AuthenticationError` - Authentication failed

2. Enhance retry logic to distinguish between:
   - Transient errors (network, rate limits)
   - Authentication errors (token expired - trigger refresh)
   - Permanent errors (invalid credentials, permissions)

3. Add better logging and monitoring for OAuth operations

**Files to Create/Modify:**
- `lib/email/errors.ts` (new or enhance)
- `lib/email/retry.ts` (enhance)
- `lib/email/providers/gmail.ts` (enhance error handling)
- `lib/email/providers/outlook.ts` (enhance error handling)

### Phase 5: Documentation and Testing

**Goal:** Document patterns and ensure reliability

**Tasks:**
1. Create comprehensive documentation:
   - OAuth flow diagrams
   - Token refresh strategy documentation
   - Error handling guide
   - Integration guide for new providers

2. Add unit tests for:
   - Token persistence
   - Token refresh
   - Authentication interfaces
   - Error handling

3. Add integration tests for:
   - OAuth flows
   - Token refresh scenarios
   - Error scenarios

**Files to Create:**
- `docs/oauth-email-integration.md` (new)
- `docs/token-refresh-strategy.md` (new)
- `tests/email/token-persistence.test.ts` (new)
- `tests/email/token-refresh.test.ts` (new)

## Implementation Priority

### High Priority (Core Functionality)
1. ✅ **Phase 1: Token Persistence Abstraction** - Critical for maintainability
2. ✅ **Phase 3: Unified Token Refresh** - Eliminates code duplication and improves reliability

### Medium Priority (Code Quality)
3. **Phase 2: Authentication Interface** - Improves consistency and testability
4. **Phase 4: Enhanced Error Handling** - Improves debugging and user experience

### Low Priority (Polish)
5. **Phase 5: Documentation and Testing** - Important but can be done incrementally

## Key Differences: Mautic (PHP) vs LeadMap (Node.js/TypeScript)

| Aspect | Mautic (PHP) | LeadMap (Node.js/TypeScript) |
|--------|--------------|------------------------------|
| Language | PHP 8.1+ | TypeScript/Node.js |
| Framework | Symfony | Next.js |
| Database | Doctrine ORM | Supabase (PostgreSQL) |
| Token Storage | Integration entity API keys | `mailboxes` table |
| Encryption | Symfony encryption | Custom AES-256-GCM |
| Async Processing | Symfony Messenger | Cron jobs + queue system |

**Adaptation Strategy:**
- Translate PHP patterns to TypeScript/Node.js idioms
- Use TypeScript interfaces instead of PHP interfaces
- Leverage Next.js API routes instead of Symfony controllers
- Use Supabase client instead of Doctrine ORM
- Maintain existing encryption approach (AES-256-GCM)

## References

- [Mautic Repository](https://github.com/mautic/mautic)
- [Mautic Developer Documentation](https://developer.mautic.org/)
- [Mautic Integration Authentication Docs](https://github.com/mautic/developer-documentation-new/blob/5.x/docs/components/integrations_authentication.rst)
- [OAuth 2.0 Specification](https://oauth.net/2/)

## Next Steps

1. **Review and Approve Plan** - Get stakeholder approval on integration approach
2. **Create Feature Branch** - `feature/mautic-oauth-patterns`
3. **Implement Phase 1** - Token persistence abstraction
4. **Implement Phase 3** - Unified token refresh (can be done in parallel with Phase 1)
5. **Test and Refine** - Ensure backward compatibility
6. **Merge and Deploy** - Deploy improvements incrementally

## Notes

- **Backward Compatibility**: All changes must maintain backward compatibility with existing mailboxes
- **Incremental Migration**: Refactor existing code incrementally, not all at once
- **Testing**: Test thoroughly with real Gmail and Outlook accounts before deploying
- **Monitoring**: Add logging/monitoring for OAuth operations to catch issues early

