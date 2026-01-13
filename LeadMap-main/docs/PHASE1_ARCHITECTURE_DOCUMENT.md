# Phase 1: Architecture Document - Unibox OAuth System Rebuild

## Executive Summary

This document outlines the comprehensive architecture for rebuilding the Unibox OAuth-enabled email system using james-project patterns, enhanced nodemailer integration, and best practices from Context7 and .cursorrules.

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Unibox Email System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   API Layer  │  │  Sync Layer  │      │
│  │   (React)    │  │  (Next.js)   │  │  (Cron/Jobs) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│  ┌─────────────────────────┼─────────────────────────────┐  │
│  │         Unified OAuth Service                          │  │
│  │  - Token Management                                     │  │
│  │  - Token Refresh                                        │  │
│  │  - Error Recovery                                       │  │
│  └─────────────────────────┼─────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────┼─────────────────────────────┐  │
│  │         Email Service Layer                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │   Gmail      │  │   Outlook    │  │    IMAP      │ │  │
│  │  │  Connector   │  │  Connector   │  │  Connector   │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │  │
│  └─────────┼─────────────────┼─────────────────┼─────────┘  │
│            │                 │                 │            │
│  ┌─────────┼─────────────────┼─────────────────┼─────────┐  │
│  │    nodemailer Service Wrapper                            │  │
│  │  - OAuth2/XOAUTH2 Support                                │  │
│  │  - Connection Pooling                                    │  │
│  │  - Transporter Management                                │  │
│  │  - Error Handling                                        │  │
│  └─────────┼─────────────────┼─────────────────┼─────────┘  │
│            │                 │                 │            │
│  ┌─────────┴─────────────────┴─────────────────┴─────────┐  │
│  │              External Services                           │  │
│  │  - Gmail API / SMTP                                      │  │
│  │  - Microsoft Graph API / SMTP                            │  │
│  │  - IMAP Servers                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Supabase Database                          │  │
│  │  - mailboxes, email_threads, email_messages             │  │
│  │  - email_participants, email_attachments                │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Separation of Concerns**: Each component has a single responsibility
2. **Unified OAuth**: Single OAuth service for all providers
3. **Connection Pooling**: Reuse connections for efficiency
4. **Error Recovery**: Automatic retry and recovery
5. **Type Safety**: Full TypeScript type coverage
6. **Security**: Encrypted token storage, secure OAuth flows

## 2. Component Design

### 2.1 Unified OAuth Service

**Location**: `lib/email/auth/oauth-service.ts`

**Responsibilities**:
- Token management (refresh, validation, storage)
- OAuth flow coordination
- Error recovery
- Token encryption/decryption

**Interface**:
```typescript
interface OAuthService {
  // Token Management
  getValidAccessToken(mailboxId: string): Promise<string>
  refreshToken(mailboxId: string): Promise<TokenResult>
  validateToken(mailboxId: string): Promise<boolean>
  
  // OAuth Flow
  initiateOAuthFlow(provider: 'gmail' | 'outlook', userId: string): Promise<string>
  handleOAuthCallback(provider: 'gmail' | 'outlook', code: string, state: string): Promise<TokenResult>
  
  // Error Recovery
  handleTokenError(mailboxId: string, error: Error): Promise<boolean>
}
```

**Key Features**:
- Automatic token refresh before expiration
- Token refresh on 401 errors
- Token encryption at rest
- Unified error handling
- Retry logic with exponential backoff

### 2.2 nodemailer Service Wrapper

**Location**: `lib/email/nodemailer-service.ts`

**Responsibilities**:
- Transporter creation and management
- OAuth2/XOAUTH2 configuration
- Connection pooling
- Health checks
- Error handling

**Interface**:
```typescript
interface NodemailerService {
  // Transporter Management
  getTransporter(mailboxId: string): Promise<nodemailer.Transporter>
  createTransporter(mailbox: Mailbox): Promise<nodemailer.Transporter>
  verifyTransporter(mailboxId: string): Promise<boolean>
  
  // Connection Pooling
  getPooledTransporter(mailboxId: string): Promise<nodemailer.Transporter>
  releaseTransporter(mailboxId: string): void
  
  // OAuth2 Support
  configureOAuth2(mailbox: Mailbox): OAuth2Config
  refreshOAuth2Token(mailboxId: string): Promise<string>
}
```

**Key Features**:
- OAuth2/XOAUTH2 support for Gmail and Outlook
- Connection pooling per mailbox
- Automatic token refresh
- Health checks and verification
- Error recovery

### 2.3 Enhanced Connectors

#### 2.3.1 Gmail Connector

**Location**: `lib/email/unibox/gmail-connector.ts`

**Enhancements**:
- Automatic token refresh integration
- Rate limit handling
- Retry logic with exponential backoff
- Connection pooling
- Enhanced error recovery
- Improved threading algorithm

**Patterns from james-project**:
- OAuth token validation before operations
- Structured error responses
- Connection state management
- Message parsing patterns

#### 2.3.2 Outlook Connector

**Location**: `lib/email/unibox/outlook-connector.ts`

**Enhancements**:
- Integrated token refresh
- Microsoft Graph batch requests
- Delta queries for incremental sync
- Rate limit handling
- Enhanced error recovery

**Patterns from james-project**:
- OAuth token validation
- Error handling patterns
- Connection management

#### 2.3.3 IMAP Connector

**Location**: `lib/email/unibox/imap-connector.ts`

**Enhancements**:
- OAuth2/XOAUTH2 support
- IDLE support (where possible)
- Connection pooling
- Serverless-friendly architecture
- Enhanced folder management

**Patterns from james-project**:
- IMAP OAuth authentication
- IDLE implementation patterns
- Folder and flag management
- Search capabilities

### 2.4 Unified Mailbox Sync Service

**Location**: `lib/email/unibox/sync-service.ts`

**Responsibilities**:
- Coordinate all connectors
- Sync state management
- Error recovery
- Rate limit coordination
- Backoff strategies

**Interface**:
```typescript
interface SyncService {
  syncMailbox(mailboxId: string): Promise<SyncResult>
  syncAllMailboxes(userId: string): Promise<SyncResult[]>
  handleSyncError(mailboxId: string, error: Error): Promise<void>
  getSyncState(mailboxId: string): Promise<SyncState>
}
```

## 3. Integration Patterns

### 3.1 james-project Pattern Adaptation

#### 3.1.1 OAuth Authentication Pattern

**james-project Pattern**:
```java
// OAuth token validation
new OidcJwtTokenVerifier(oidcSASLConfiguration).validateToken(token)
    .ifPresentOrElse(authenticatedUser -> {
        authSuccess(authenticatedUser, session, request, responder);
    }, () -> {
        manageFailureCount(session, request, responder);
    });
```

**TypeScript Adaptation**:
```typescript
async function validateOAuthToken(token: string, config: OAuthConfig): Promise<User | null> {
  try {
    const verifier = new OAuthTokenVerifier(config);
    const user = await verifier.verifyToken(token);
    if (user) {
      return user;
    }
    await handleAuthFailure();
    return null;
  } catch (error) {
    await handleAuthFailure();
    return null;
  }
}
```

#### 3.1.2 Error Handling Pattern

**james-project Pattern**:
- Structured error responses
- Error code constants
- Detailed error messages
- Failure count tracking

**TypeScript Adaptation**:
```typescript
interface EmailError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

class ErrorHandler {
  static handle(error: Error, context: string): EmailError {
    // Map errors to structured format
    return {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      status: this.getStatusCode(error),
      details: { context }
    };
  }
}
```

#### 3.1.3 Connection State Management

**james-project Pattern**:
- Session-based state
- Line handlers for multi-step operations
- Connection lifecycle management

**TypeScript Adaptation**:
```typescript
interface ConnectionState {
  authenticated: boolean;
  currentOperation?: string;
  lastActivity: Date;
  retryCount: number;
}

class ConnectionManager {
  private state: Map<string, ConnectionState> = new Map();
  
  async getConnection(mailboxId: string): Promise<Connection> {
    const state = this.state.get(mailboxId);
    if (!state || !state.authenticated) {
      await this.authenticate(mailboxId);
    }
    return this.connections.get(mailboxId)!;
  }
}
```

### 3.2 nodemailer Integration Pattern

#### 3.2.1 OAuth2 Configuration

```typescript
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: mailbox.email,
    clientId: mailbox.oauth_client_id,
    clientSecret: mailbox.oauth_client_secret,
    refreshToken: mailbox.refresh_token,
  },
});
```

#### 3.2.2 Connection Pooling

```typescript
class TransporterPool {
  private transporters: Map<string, nodemailer.Transporter> = new Map();
  
  async getTransporter(mailboxId: string): Promise<nodemailer.Transporter> {
    if (this.transporters.has(mailboxId)) {
      const transporter = this.transporters.get(mailboxId)!;
      // Verify connection health
      if (await this.isHealthy(transporter)) {
        return transporter;
      }
    }
    
    // Create new transporter
    const transporter = await this.createTransporter(mailboxId);
    this.transporters.set(mailboxId, transporter);
    return transporter;
  }
}
```

#### 3.2.3 Error Recovery

```typescript
async function sendEmailWithRetry(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
  maxRetries = 3
): Promise<nodemailer.SentMessageInfo> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error: any) {
      if (error.code === 'EAUTH' && attempt < maxRetries) {
        // OAuth error - refresh token
        await refreshTransporterAuth(transporter);
        continue;
      }
      if (attempt < maxRetries) {
        // Exponential backoff
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to send email after retries');
}
```

## 4. Data Flow

### 4.1 Email Sending Flow

```
User Action (Send Email)
    ↓
API Endpoint (/api/unibox/threads/[id]/reply)
    ↓
OAuth Service (getValidAccessToken)
    ↓
nodemailer Service (getTransporter)
    ↓
SMTP Provider (sendViaNodemailer)
    ↓
External SMTP Server (Gmail/Outlook)
    ↓
Database (Store sent message)
    ↓
Response to User
```

### 4.2 Email Receiving Flow

```
Cron Job (sync-mailboxes)
    ↓
Sync Service (syncMailbox)
    ↓
OAuth Service (getValidAccessToken)
    ↓
Connector (Gmail/Outlook/IMAP)
    ↓
External API/Server
    ↓
Message Parser
    ↓
Threading Algorithm
    ↓
Database (Store messages)
    ↓
Update Sync State
```

### 4.3 OAuth Flow

```
User Initiates OAuth
    ↓
OAuth Service (initiateOAuthFlow)
    ↓
Provider OAuth Page
    ↓
Callback Handler
    ↓
OAuth Service (handleOAuthCallback)
    ↓
Token Exchange
    ↓
Token Encryption
    ↓
Database (Store tokens)
    ↓
Connection Test
    ↓
Response to User
```

## 5. Security Considerations

### 5.1 Token Security

- **Encryption**: All tokens encrypted at rest
- **Token Rotation**: Automatic token rotation
- **Secure Storage**: Tokens stored in encrypted database fields
- **Access Control**: RLS policies ensure users only access their tokens

### 5.2 OAuth Flow Security

- **State Validation**: CSRF protection via state parameter
- **Redirect URI Validation**: Strict redirect URI validation
- **Token Validation**: JWT token validation
- **Scope Validation**: Verify required scopes are granted

### 5.3 Connection Security

- **TLS/SSL**: All connections use TLS/SSL
- **Certificate Validation**: Proper certificate validation
- **Connection Timeout**: Timeout handling for connections
- **Rate Limiting**: Rate limiting to prevent abuse

## 6. Error Handling Strategy

### 6.1 Error Categories

1. **OAuth Errors**: Token expired, invalid token, revoked access
2. **Network Errors**: Connection timeout, DNS errors
3. **Rate Limit Errors**: API quota exceeded, rate limit hit
4. **Validation Errors**: Invalid email, missing fields
5. **System Errors**: Database errors, configuration errors

### 6.2 Error Recovery

1. **Automatic Retry**: Retry with exponential backoff
2. **Token Refresh**: Automatic token refresh on 401 errors
3. **Rate Limit Backoff**: Backoff on rate limit errors
4. **Error Logging**: Comprehensive error logging
5. **User Notification**: User-friendly error messages

## 7. Performance Optimization

### 7.1 Connection Pooling

- Reuse transporters per mailbox
- Health checks before reuse
- Automatic cleanup of stale connections

### 7.2 Batch Operations

- Batch API requests where possible
- Parallel processing of independent operations
- Efficient database queries

### 7.3 Caching

- Cache mailbox metadata
- Cache OAuth tokens (encrypted)
- Cache connection states

## 8. Monitoring and Logging

### 8.1 Metrics

- Sync success/failure rates
- Token refresh frequency
- API quota usage
- Connection health
- Error rates by type

### 8.2 Logging

- OAuth operations
- Token refresh events
- Sync operations
- Error details
- Performance metrics

## 9. Implementation Roadmap

### Phase 2: nodemailer Integration Enhancement
1. Create nodemailer service wrapper
2. Implement OAuth2 support
3. Add connection pooling
4. Implement error recovery

### Phase 3: james-project Pattern Integration
1. Extract SMTP patterns
2. Extract IMAP patterns
3. Extract OAuth patterns
4. Create TypeScript utilities

### Phase 4: OAuth System Rebuild
1. Create unified OAuth service
2. Enhance callback handlers
3. Implement token refresh service
4. Add connection testing

### Phase 5: Unibox System Rebuild
1. Rebuild Gmail connector
2. Rebuild Outlook connector
3. Rebuild IMAP connector
4. Create unified sync service

## 10. Success Criteria

- [ ] All OAuth tokens automatically refreshed
- [ ] nodemailer OAuth2 support for Gmail and Outlook
- [ ] Connection pooling implemented
- [ ] Error recovery with retry logic
- [ ] Rate limiting handled
- [ ] Enhanced threading algorithm
- [ ] Comprehensive error handling
- [ ] Security best practices followed
- [ ] Performance optimized
- [ ] Monitoring and logging in place

## 11. References

- james-project: `james-project/`
- nodemailer Documentation: Context7
- .cursorrules: `LeadMap-main/.cursorrules`
- Current Implementation: `LeadMap-main/lib/email/`


