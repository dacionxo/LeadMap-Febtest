# Google APIs Node.js Client Library Integration Guide

This guide documents the integration and usage of the [Google APIs Node.js Client Library](https://github.com/googleapis/google-api-nodejs-client) in the LeadMap repository.

## 📦 Package Information

The `googleapis` package is already installed in this repository:

```json
{
  "dependencies": {
    "googleapis": "^144.0.0"
  }
}
```

- **Package**: [googleapis](https://www.npmjs.com/package/googleapis)
- **GitHub**: [googleapis/google-api-nodejs-client](https://github.com/googleapis/google-api-nodejs-client)
- **Documentation**: [googleapis.dev/nodejs/googleapis/latest](https://googleapis.dev/nodejs/googleapis/latest)
- **Current Version**: 144.0.0

## 🎯 What is the Google APIs Node.js Client Library?

The Google APIs Node.js Client Library is Google's officially supported Node.js client library for accessing Google APIs. It provides:

- ✅ Support for all Google APIs (Gmail, Calendar, Drive, Sheets, etc.)
- ✅ OAuth 2.0 authorization and authentication
- ✅ API Keys and JWT (Service Tokens) support
- ✅ TypeScript support with full type definitions
- ✅ Automatic retry logic and error handling
- ✅ Multipart media uploads
- ✅ HTTP/2 support
- ✅ Request/response interceptors

## 📋 Installation

The package is already installed. To update to the latest version:

```bash
npm install googleapis@latest
```

Or if you need a specific version:

```bash
npm install googleapis@^144.0.0
```

## 🔧 Basic Usage

### 1. Import the Library

```typescript
import { google } from 'googleapis';
```

### 2. Authentication

#### OAuth 2.0 Client (Recommended for User APIs)

```typescript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials (after OAuth flow)
oauth2Client.setCredentials({
  access_token: 'your-access-token',
  refresh_token: 'your-refresh-token',
  expiry_date: 1234567890
});
```

#### API Key (for Public APIs)

```typescript
const auth = new google.auth.GoogleAuth({
  key: process.env.GOOGLE_API_KEY,
  scopes: []
});
```

#### Service Account (for Server-to-Server)

```typescript
const auth = new google.auth.GoogleAuth({
  keyFile: '/path/to/service-account-key.json',
  scopes: ['https://www.googleapis.com/auth/calendar']
});
```

### 3. Create API Client

```typescript
// Gmail API
const gmail = google.gmail({
  version: 'v1',
  auth: oauth2Client
});

// Calendar API
const calendar = google.calendar({
  version: 'v3',
  auth: oauth2Client
});

// Drive API
const drive = google.drive({
  version: 'v3',
  auth: oauth2Client
});
```

## 💡 Integration Examples

### Gmail API Example

```typescript
import { google } from 'googleapis';

async function sendGmailEmail(auth: any, to: string, subject: string, body: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    body
  ].join('\n');
  
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });
  
  return res.data;
}
```

### Google Calendar API Example

```typescript
import { google } from 'googleapis';

async function createCalendarEvent(auth: any, summary: string, start: Date, end: Date) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  const event = {
    summary,
    start: {
      dateTime: start.toISOString(),
      timeZone: 'UTC'
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'UTC'
    }
  };
  
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event
  });
  
  return res.data;
}

async function listCalendarEvents(auth: any, timeMin: Date, timeMax: Date) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime'
  });
  
  return res.data.items || [];
}
```

### Token Refresh Example

```typescript
import { google } from 'googleapis';

async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return {
    accessToken: credentials.access_token,
    expiryDate: credentials.expiry_date
  };
}
```

## 🔄 Migration from Direct Fetch Calls

Currently, some parts of the codebase use direct `fetch()` calls to Google APIs. Here's how to migrate:

### Before (Direct Fetch)

```typescript
const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ raw: encodedMessage })
});
```

### After (Using googleapis Client)

```typescript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(/* ... */);
oauth2Client.setCredentials({ access_token: accessToken });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const response = await gmail.users.messages.send({
  userId: 'me',
  requestBody: { raw: encodedMessage }
});
```

**Benefits of Migration:**
- ✅ Automatic token refresh
- ✅ Better error handling
- ✅ Type safety with TypeScript
- ✅ Consistent API interface
- ✅ Built-in retry logic
- ✅ Request/response interceptors

## 📚 Available APIs

The client library supports all Google APIs. Common ones used in LeadMap:

- **Gmail API** (`google.gmail`)
- **Calendar API** (`google.calendar`)
- **Drive API** (`google.drive`)
- **Sheets API** (`google.sheets`)
- **Maps APIs** (via REST, not through this client)

To see all available APIs:

```typescript
import { google } from 'googleapis';

const apis = google.getSupportedAPIs();
console.log(apis); // Object with API names and versions
```

## 🔐 Authentication Best Practices

### 1. Environment Variables

Store credentials securely:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth/callback
GOOGLE_API_KEY=your-api-key (for public APIs)
```

### 2. Token Storage

- Store refresh tokens securely (encrypted in database)
- Access tokens are short-lived (1 hour)
- Refresh tokens don't expire (unless revoked)

### 3. Token Refresh

The client library handles token refresh automatically if you provide a refresh token:

```typescript
oauth2Client.setCredentials({
  access_token: accessToken,
  refresh_token: refreshToken,
  expiry_date: expiryDate
});

// The client will automatically refresh when needed
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
```

## 🎨 TypeScript Support

The library is written in TypeScript and provides full type definitions:

```typescript
import { google, gmail_v1 } from 'googleapis';

const gmail: gmail_v1.Gmail = google.gmail({
  version: 'v1',
  auth: oauth2Client
});

// Fully typed request parameters
const listParams: gmail_v1.Params$Resource$Users$Messages$List = {
  userId: 'me',
  maxResults: 10
};

// Fully typed response
const response: gmail_v1.Schema$ListMessagesResponse = await gmail.users.messages.list(listParams);
```

## 🔧 Advanced Features

### Request Options

You can specify options at global, service, or request level:

```typescript
// Global options
google.options({
  timeout: 1000,
  auth: oauth2Client
});

// Service-level options
const gmail = google.gmail({
  version: 'v1',
  auth: oauth2Client,
  timeout: 5000
});

// Request-level options
const response = await gmail.users.messages.list({
  userId: 'me'
}, {
  timeout: 10000
});
```

### HTTP/2 Support

Enable HTTP/2 for better performance:

```typescript
google.options({
  http2: true
});
```

### Media Uploads

```typescript
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const fileMetadata = {
  name: 'test.pdf'
};

const media = {
  mimeType: 'application/pdf',
  body: fs.createReadStream('test.pdf')
};

const file = await drive.files.create({
  requestBody: fileMetadata,
  media: media
});
```

## 🐛 Error Handling

The library throws errors that you should handle:

```typescript
import { google } from 'googleapis';
import { GaxiosError } from 'gaxios';

try {
  const response = await gmail.users.messages.send({ /* ... */ });
} catch (error) {
  if (error instanceof GaxiosError) {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      await refreshToken();
    } else if (error.response?.status === 429) {
      // Rate limit exceeded
      await waitForRateLimit();
    }
  }
  throw error;
}
```

## 📖 Resources

- **Official Documentation**: [googleapis.dev/nodejs/googleapis/latest](https://googleapis.dev/nodejs/googleapis/latest)
- **GitHub Repository**: [github.com/googleapis/google-api-nodejs-client](https://github.com/googleapis/google-api-nodejs-client)
- **NPM Package**: [npmjs.com/package/googleapis](https://www.npmjs.com/package/googleapis)
- **API Reference**: See individual API documentation pages

## ✅ Current Usage in LeadMap

The `googleapis` package is installed but currently underutilized. The codebase uses direct `fetch()` calls for:

- Gmail API (in `lib/email/providers/gmail.ts`)
- Calendar API (in `app/api/calendar/sync/google/route.ts`)
- Token refresh (in `lib/google-calendar-sync.ts`)

**Recommendation**: Consider migrating to the `googleapis` client library for:
- Better error handling
- Automatic token refresh
- Type safety
- Consistency across the codebase

## 🔄 Next Steps

1. ✅ Package is installed
2. 📝 Documentation created (this file)
3. 🔄 Consider migrating existing code to use the client library
4. 🧪 Add examples and utilities for common operations
5. 📚 Update codebase to use the library for new features

---

**Last Updated**: 2026-01-04  
**Package Version**: 144.0.0  
**Maintained by**: Google

