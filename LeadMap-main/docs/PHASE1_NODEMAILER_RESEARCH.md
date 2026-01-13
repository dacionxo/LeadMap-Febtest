# Phase 1: nodemailer OAuth2 Research

## Overview

Research findings on nodemailer OAuth2 capabilities for Gmail and Outlook integration, based on Context7 documentation and best practices.

## 1. nodemailer OAuth2 Configuration

### 1.1 Gmail OAuth2 Setup

**Basic Configuration**:
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: "me@gmail.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});
```

**Key Points**:
- Requires one-time consent flow to obtain refresh token
- Nodemailer automatically refreshes access tokens
- Uses `https://mail.google.com/` scope

### 1.2 Outlook OAuth2 Setup

**Configuration**:
```typescript
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // TLS
  auth: {
    type: "OAuth2",
    user: "user@outlook.com",
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    refreshToken: process.env.MICROSOFT_REFRESH_TOKEN,
    accessUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  },
});
```

**Key Points**:
- Requires `https://outlook.office.com/SMTP.Send` scope
- Uses Microsoft OAuth2 token endpoint
- Supports both Office 365 and Outlook.com

## 2. OAuth2 Authentication Patterns

### 2.1 Using Existing Access Token

```typescript
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    user: "user@example.com",
    accessToken: "ya29.Xx_XX0xxxxx-xX0X0XxXXxXxXXXxX0x",
  },
});
```

**Use Case**: When you have a valid access token that hasn't expired yet.

### 2.2 Custom Token Handler

```typescript
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    user: "user@example.com",
  },
});

transporter.set("oauth2_provision_cb", (user, renew, callback) => {
  // Custom token retrieval logic
  const tokens = getUserTokens(user);
  callback(null, tokens);
});
```

**Use Case**: When you need custom token management logic.

### 2.3 Full 3-Legged OAuth Flow

```typescript
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    user: "user@example.com",
    clientId: "000000000000-xxx.apps.googleusercontent.com",
    clientSecret: "XxxxxXXxX0xxxxxxxx0XXxX0",
    refreshToken: "1/XXxXxsss-xxxXXXXXxXxx0XXXxxXXx0x00xxx",
    accessToken: "ya29.Xx_XX0xxxxx-xX0X0XxXXxXxXXXxX0x",
    expires: 1484314697598, // UNIX timestamp
  },
});
```

**Use Case**: Complete OAuth2 setup with all credentials.

### 2.4 Per-Message Authentication

```typescript
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    clientId: "000000000000-xxx.apps.googleusercontent.com",
    clientSecret: "XxxxxXXxX0xxxxxxxx0XXxX0",
  },
});

transporter.sendMail({
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Message",
  text: "I hope this message gets through!",
  auth: {
    user: "user@example.com",
    refreshToken: "1/XXxXxsss-xxxXXXXXxXxx0XXXxxXXx0x00xxx",
    accessToken: "ya29.Xx_XX0xxxxx-xX0X0XxXXxXxXXXxX0x",
    expires: 1484314697598,
  },
});
```

**Use Case**: When different users send emails through the same transporter.

## 3. Token Management Best Practices

### 3.1 Token Refresh Strategy

**Pattern**: Nodemailer automatically refreshes tokens, but we should:
1. Store refresh tokens securely (encrypted)
2. Monitor token expiration
3. Handle refresh failures gracefully
4. Implement retry logic

**Implementation**:
```typescript
class TokenManager {
  async getValidAccessToken(mailboxId: string): Promise<string> {
    const mailbox = await this.getMailbox(mailboxId);
    
    // Check if token is expired or will expire soon
    if (this.isTokenExpiringSoon(mailbox.accessToken, mailbox.expiresAt)) {
      const refreshed = await this.refreshToken(mailbox);
      await this.updateMailbox(mailboxId, refreshed);
      return refreshed.accessToken;
    }
    
    return mailbox.accessToken;
  }
  
  private isTokenExpiringSoon(expiresAt: Date): boolean {
    const now = new Date();
    const expiresIn = expiresAt.getTime() - now.getTime();
    // Refresh if expires in less than 5 minutes
    return expiresIn < 5 * 60 * 1000;
  }
}
```

### 3.2 Connection Pooling

**Pattern**: Reuse transporters per mailbox to avoid connection overhead.

**Implementation**:
```typescript
class TransporterPool {
  private transporters: Map<string, nodemailer.Transporter> = new Map();
  
  async getTransporter(mailboxId: string): Promise<nodemailer.Transporter> {
    if (this.transporters.has(mailboxId)) {
      return this.transporters.get(mailboxId)!;
    }
    
    const mailbox = await this.getMailbox(mailboxId);
    const transporter = this.createTransporter(mailbox);
    this.transporters.set(mailboxId, transporter);
    
    return transporter;
  }
  
  private createTransporter(mailbox: Mailbox): nodemailer.Transporter {
    return nodemailer.createTransport({
      service: mailbox.provider === 'gmail' ? 'gmail' : undefined,
      host: mailbox.smtp_host,
      port: mailbox.smtp_port,
      secure: mailbox.smtp_port === 465,
      auth: {
        type: "OAuth2",
        user: mailbox.email,
        clientId: mailbox.oauth_client_id,
        clientSecret: mailbox.oauth_client_secret,
        refreshToken: mailbox.refresh_token,
      },
    });
  }
}
```

## 4. Error Handling Patterns

### 4.1 OAuth2 Error Handling

**Common Errors**:
- `invalid_grant`: Refresh token expired or revoked
- `invalid_client`: Client credentials invalid
- `access_denied`: User revoked access

**Handling Strategy**:
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
        // OAuth error - try refreshing token
        await refreshTransporterAuth(transporter);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to send email after retries');
}
```

### 4.2 Rate Limiting Handling

**Gmail Limits**:
- 500 emails per day (free accounts)
- 2000 emails per day (Google Workspace)

**Outlook Limits**:
- 10,000 recipients per day (Office 365)

**Implementation**:
```typescript
class RateLimiter {
  private limits: Map<string, { count: number; resetAt: Date }> = new Map();
  
  async checkLimit(mailboxId: string, limit: number): Promise<boolean> {
    const current = this.limits.get(mailboxId);
    const now = new Date();
    
    if (!current || now > current.resetAt) {
      this.limits.set(mailboxId, { count: 1, resetAt: this.getNextReset() });
      return true;
    }
    
    if (current.count >= limit) {
      return false;
    }
    
    current.count++;
    return true;
  }
}
```

## 5. Integration with Unibox System

### 5.1 Hybrid Approach: API + SMTP

**Strategy**:
- **Receiving**: Use Gmail API / Microsoft Graph API
- **Sending**: Use nodemailer with OAuth2 SMTP

**Benefits**:
- Reliable sending via SMTP
- Rich receiving via APIs
- Better error handling
- Unified OAuth token management

### 5.2 Service Architecture

```typescript
interface EmailService {
  // Receiving
  syncMessages(mailboxId: string): Promise<SyncResult>;
  
  // Sending
  sendEmail(mailboxId: string, email: EmailPayload): Promise<SendResult>;
  replyToThread(mailboxId: string, threadId: string, reply: ReplyPayload): Promise<SendResult>;
  forwardMessage(mailboxId: string, messageId: string, forward: ForwardPayload): Promise<SendResult>;
}

class NodemailerEmailService implements EmailService {
  constructor(
    private transporterPool: TransporterPool,
    private tokenManager: TokenManager
  ) {}
  
  async sendEmail(mailboxId: string, email: EmailPayload): Promise<SendResult> {
    const transporter = await this.transporterPool.getTransporter(mailboxId);
    const accessToken = await this.tokenManager.getValidAccessToken(mailboxId);
    
    // Update transporter with fresh token if needed
    await this.updateTransporterAuth(transporter, accessToken);
    
    try {
      const info = await transporter.sendMail({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          'In-Reply-To': email.inReplyTo,
          'References': email.references,
        },
      });
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

## 6. Recommendations

1. **Use nodemailer for SMTP sending** with OAuth2
2. **Keep API-based receiving** for Gmail/Outlook (richer features)
3. **Implement connection pooling** for transporter reuse
4. **Automatic token refresh** before expiration
5. **Comprehensive error handling** with retry logic
6. **Rate limiting** per mailbox
7. **Monitoring and logging** for OAuth operations

## 7. Next Steps

1. Implement nodemailer service wrapper
2. Create transporter pool
3. Integrate with existing OAuth system
4. Add error handling and retry logic
5. Implement rate limiting
6. Add monitoring and logging


