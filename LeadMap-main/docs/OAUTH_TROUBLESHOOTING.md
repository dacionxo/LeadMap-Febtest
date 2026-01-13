# OAuth Email Receiving Troubleshooting Guide

## Error: "OAuth callback missing required parameters"

### What This Error Means

This error occurs when the OAuth callback URL is accessed without the required `code` and `state` parameters. These parameters are added by Google/Microsoft after the user grants permission.

### Common Causes

1. **Direct URL Access**: You copied and pasted the initial authorization URL, but then navigated directly to the callback URL without completing OAuth
2. **Redirect URI Mismatch**: The redirect URI in your OAuth app doesn't match the callback URL
3. **OAuth Flow Not Completed**: The user didn't complete the OAuth consent flow
4. **Missing Scopes**: The OAuth app doesn't have the required scopes configured

### How to Fix

#### Step 1: Verify OAuth App Configuration

**For Gmail:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Select your OAuth 2.0 Client ID
4. Verify **Authorized redirect URIs** includes:
   ```
   http://localhost:3000/api/mailboxes/oauth/gmail/callback
   ```
   (Replace with your production URL in production)

5. Verify **Authorized JavaScript origins** includes:
   ```
   http://localhost:3000
   ```

**For Outlook:**
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your app
4. Go to **Authentication**
5. Verify **Redirect URIs** includes:
   ```
   http://localhost:3000/api/mailboxes/oauth/outlook/callback
   ```

#### Step 2: Use the Correct OAuth Flow

**DO NOT** manually copy and paste the callback URL. Instead:

1. **Get the authorization URL from the API:**
   ```bash
   # For Gmail
   curl -X GET "http://localhost:3000/api/mailboxes/oauth/gmail" \
     -H "Cookie: your-auth-cookie"
   
   # Response will contain:
   # { "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..." }
   ```

2. **Open the `authUrl` in your browser** (not the callback URL)

3. **Complete the OAuth flow:**
   - Sign in to Google/Microsoft
   - Grant permissions
   - You'll be automatically redirected to the callback URL with `code` and `state` parameters

4. **The callback handler will process the tokens** and redirect you back to the app

#### Step 3: Verify Required Scopes

**Gmail Required Scopes:**
- `https://www.googleapis.com/auth/gmail.send` (sending)
- `https://www.googleapis.com/auth/gmail.readonly` (receiving) ✅ **REQUIRED**
- `https://www.googleapis.com/auth/userinfo.email` (user info)

**Outlook Required Scopes:**
- `https://graph.microsoft.com/Mail.Send` (sending)
- `https://graph.microsoft.com/Mail.Read` (receiving) ✅ **REQUIRED**
- `https://graph.microsoft.com/Mail.ReadWrite` (full access) ✅ **REQUIRED**
- `https://graph.microsoft.com/User.Read` (user info)
- `offline_access` (refresh tokens)

#### Step 4: Check Server Logs

When the error occurs, check your server logs for detailed information:

```bash
# Look for logs like:
# "OAuth callback missing required parameters: { code: 'missing', state: 'missing', ... }"
```

This will show you exactly which parameters are missing and the full callback URL.

### Correct OAuth Flow

```
1. User clicks "Connect Gmail/Outlook" in UI
   ↓
2. Frontend calls GET /api/mailboxes/oauth/gmail (or /outlook)
   ↓
3. Backend returns { authUrl: "https://accounts.google.com/..." }
   ↓
4. Frontend redirects user to authUrl
   ↓
5. User signs in and grants permissions
   ↓
6. Google/Microsoft redirects to callback URL with code & state
   ↓
7. Callback handler processes tokens and saves mailbox
   ↓
8. User redirected back to app with success message
```

### Testing Steps

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Ensure you're logged in** to your application

3. **Get the authorization URL:**
   - Use the UI (recommended) OR
   - Call the API endpoint directly

4. **Open the authorization URL** (not the callback URL) in your browser

5. **Complete OAuth flow** - don't manually navigate to callback

6. **Verify success** - you should be redirected back to the app

### Quick Test Script

```typescript
// test-oauth-flow.ts
async function testOAuthFlow() {
  // 1. Get auth URL
  const response = await fetch('http://localhost:3000/api/mailboxes/oauth/gmail', {
    credentials: 'include' // Include cookies for auth
  })
  
  const { authUrl } = await response.json()
  console.log('Authorization URL:', authUrl)
  
  // 2. Open in browser (user must do this manually)
  console.log('\n👉 Open this URL in your browser:')
  console.log(authUrl)
  console.log('\n⚠️  DO NOT navigate directly to the callback URL!')
  console.log('   Complete the OAuth flow in the browser.')
}
```

### Still Having Issues?

1. **Check environment variables:**
   ```bash
   # Required for Gmail
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   
   # Required for Outlook
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...
   
   # Required for both
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. **Verify OAuth app is in correct state:**
   - Gmail: OAuth consent screen must be configured
   - Outlook: App must be registered and permissions granted

3. **Check browser console** for any JavaScript errors

4. **Check network tab** to see the actual callback URL and parameters

5. **Try incognito/private browsing** to rule out cookie/cache issues

