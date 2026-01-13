# Realtime Gmail Listener Reference

This document references the [Realtime-Gmail-Listener](https://github.com/sangnandar/Realtime-Gmail-Listener) project, which has been added as a git submodule to this repository.

## Location

The project is located at: `external/realtime-gmail-listener/`

## Purpose

This reference implementation demonstrates best practices for:
- **Gmail push notifications** using Pub/Sub (no polling)
- **Cloud Run webhook proxy** for reliable Pub/Sub delivery
- **Serverless architecture** with Google Cloud services
- **Apps Script integration** for email processing
- **Automatic watch renewal** to prevent subscription expiration

## Key Concepts

### Why Not Direct Apps Script Webhook?

According to the [reference project](https://github.com/sangnandar/Realtime-Gmail-Listener), Apps Script **cannot act as a direct webhook endpoint** for Pub/Sub because:

1. Apps Script Web Apps redirect from `script.google.com` → `script.googleusercontent.com`
2. Pub/Sub doesn't follow redirects (returns 302, not 200 OK)
3. Pub/Sub treats this as failure and retries repeatedly
4. This causes unreliable delivery and quota exhaustion

**Solution:** Use Cloud Run as a webhook proxy that:
- Receives Pub/Sub push notifications
- Forwards to Apps Script Web App
- Returns 200 OK to Pub/Sub (preventing retries)
- Ensures reliable delivery

### Architecture Pattern

```
Gmail Inbox → Gmail API watch() → Pub/Sub Topic → Cloud Run → Apps Script
```

This pattern is similar to our current implementation, but uses Cloud Run instead of Next.js API routes.

## Comparison with Our Implementation

### Our Current Setup
- **Webhook Endpoint:** Next.js API route (`/api/webhooks/gmail`)
- **Processing:** Direct database sync via `syncGmailMessages()`
- **Token Management:** Unified refreshToken with automatic decryption
- **Storage:** Supabase (`email_threads`, `email_messages`)

### Reference Implementation
- **Webhook Endpoint:** Cloud Run service
- **Processing:** Apps Script (e.g., Google Sheets)
- **Token Management:** Apps Script OAuth
- **Storage:** Google Sheets

## Key Learnings

### 1. Pub/Sub Message Format
The reference shows how Gmail sends notifications:
```json
{
  "message": {
    "data": "<base64-encoded-json>",
    "attributes": {}
  }
}
```

Decoded data contains:
- `emailAddress`: The Gmail address
- `historyId`: Gmail history ID for incremental sync

### 2. Watch Subscription Management
- Gmail watch subscriptions expire after 7 days
- Need automatic renewal before expiration
- Store `watch_expiration` timestamp
- Renew when expiration is within 24 hours

### 3. Security Best Practices
- Use Secret Manager for sensitive data (API keys, URLs)
- Principle of least privilege for service accounts
- API key authentication for Apps Script endpoints
- HTTPS-only for webhook endpoints

### 4. Error Handling
- Return 200 OK to prevent Pub/Sub retries
- Log errors for monitoring
- Graceful handling of missing mailboxes
- Clear error messages for debugging

## Integration Opportunities

### Potential Improvements to Our Implementation

1. **Watch Renewal Automation**
   - We have `app/api/cron/gmail-watch-renewal/route.ts`
   - Reference shows Apps Script time-based triggers for renewal
   - Could enhance our cron job with better scheduling

2. **Pub/Sub Verification**
   - Reference uses verification tokens
   - We have `GMAIL_PUBSUB_VERIFICATION_TOKEN` support
   - Could enhance verification logic

3. **Error Recovery**
   - Reference shows retry patterns
   - We have unified refreshToken with retry logic
   - Could add more sophisticated retry strategies

4. **Monitoring & Logging**
   - Reference emphasizes comprehensive logging
   - We've added extensive logging in recent fixes
   - Could add metrics/monitoring dashboards

## Using the Reference

### To Update the Submodule
```bash
cd external/realtime-gmail-listener
git pull origin main
cd ../..
git add external/realtime-gmail-listener
git commit -m "Update Realtime-Gmail-Listener reference"
```

### To Clone Repository with Submodules
```bash
git clone --recurse-submodules <repository-url>
# Or if already cloned:
git submodule update --init --recursive
```

## Related Documentation

- [Gmail Watch API Documentation](https://developers.google.com/gmail/api/guides/push)
- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Our Gmail Webhook Implementation](../app/api/webhooks/gmail/route.ts)
- [Our Gmail Watch Renewal](../app/api/cron/gmail-watch-renewal/route.ts)
- [Unibox Email Fix Summary](./UNIBOX_EMAIL_FIX_SUMMARY.md)

## Notes

- This is a **reference implementation**, not a direct dependency
- Our implementation uses Next.js API routes instead of Cloud Run
- We use Supabase instead of Google Sheets
- Both approaches achieve similar goals with different tech stacks
- The reference provides valuable patterns and best practices

