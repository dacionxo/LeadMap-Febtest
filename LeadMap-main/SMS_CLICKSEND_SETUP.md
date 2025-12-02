# ClickSend SMS Integration Setup Guide

This guide walks you through setting up ClickSend SMS integration for LeadMap's SMS functionality.

## Prerequisites

1. A ClickSend account ([Sign up here](https://www.clicksend.com/us/))
2. A verified phone number in ClickSend
3. Access to your ClickSend API credentials

## Step 1: Get ClickSend API Credentials

1. Log in to your [ClickSend Dashboard](https://dashboard.clicksend.com/)
2. Navigate to **Account** → **API Credentials**
3. Copy your:
   - **Username** (your ClickSend username)
   - **API Key** (your API key)
4. Note your **verified phone number** (the number you'll send SMS from)

## Step 2: Configure Environment Variables

### For Local Development

Add these to your `.env.local` file in the project root:

```env
# ClickSend SMS Configuration
CLICKSEND_USERNAME=your_clicksend_username
CLICKSEND_API_KEY=your_clicksend_api_key
CLICKSEND_FROM_NUMBER=+15551234567  # Your ClickSend verified phone number (E.164 format)

# Webhook Security (optional but recommended)
CLICKSEND_WEBHOOK_SECRET=your_secure_random_string_here

# App URL (for webhook configuration)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### For Vercel Production

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:

#### ClickSend Core
- **Key:** `CLICKSEND_USERNAME`
- **Value:** Your ClickSend username
- **Environments:** ✅ Production ✅ Preview ✅ Development

- **Key:** `CLICKSEND_API_KEY`
- **Value:** Your ClickSend API key
- **Environments:** ✅ Production ✅ Preview ✅ Development

- **Key:** `CLICKSEND_FROM_NUMBER`
- **Value:** Your ClickSend phone number (E.164 format, e.g., `+15551234567`)
- **Environments:** ✅ Production ✅ Preview ✅ Development

#### Webhook Security (Optional)
- **Key:** `CLICKSEND_WEBHOOK_SECRET`
- **Value:** Generate a secure random string (see below)
- **Environments:** ✅ Production ✅ Preview ✅ Development

#### App URL
- **Key:** `NEXT_PUBLIC_APP_URL`
- **Value:** `https://your-domain.com` (no trailing slash)
- **Environments:** ✅ Production ✅ Preview ✅ Development

### Generating CLICKSEND_WEBHOOK_SECRET

**On Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

**On Mac/Linux:**
```bash
openssl rand -hex 32
```

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Configure ClickSend Webhooks

1. Log in to your [ClickSend Dashboard](https://dashboard.clicksend.com/)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add New Webhook**
4. Configure:

   **Webhook URL:**
   ```
   https://your-domain.com/api/clicksend/webhook
   ```
   (Replace `your-domain.com` with your actual domain)

   **Events to Subscribe:**
   - ✅ Inbound SMS
   - ✅ Delivery Receipts
   - ✅ Failed Messages

   **HTTP Method:** POST

   **Content Type:** application/json

5. Click **Save**

## Step 4: Verify Phone Number Format

ClickSend requires phone numbers in **E.164 format**:
- ✅ Correct: `+15551234567`
- ❌ Incorrect: `5551234567`, `(555) 123-4567`, `555-123-4567`

Make sure your `CLICKSEND_FROM_NUMBER` is in E.164 format.

## Step 5: Test the Integration

### Test Sending SMS

You can test by making a POST request to your API:

```bash
curl -X POST https://your-domain.com/api/sms/messages \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "test-listing-id",
    "leadPhone": "+15551234567",
    "text": "Test message from LeadMap"
  }'
```

### Test Webhook (Local Development)

For local testing, use a tool like [ngrok](https://ngrok.com/) to expose your local server:

1. Install ngrok: `npm install -g ngrok`
2. Start your dev server: `npm run dev`
3. In another terminal: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Set webhook URL in ClickSend to: `https://abc123.ngrok.io/api/clicksend/webhook`

## Step 6: Run Database Migration

Execute the SMS schema migration:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Open `supabase/sms_schema.sql`
5. Copy and paste the entire file
6. Click **Run**

## Verification Checklist

- [ ] ClickSend account created
- [ ] API credentials obtained (username and API key)
- [ ] Phone number verified in ClickSend
- [ ] Environment variables set in `.env.local` (local) and Vercel (production)
- [ ] Webhook configured in ClickSend dashboard
- [ ] Database schema migrated
- [ ] Test SMS sent successfully
- [ ] Inbound SMS received and processed

## Troubleshooting

### SMS Not Sending

1. **Check API Credentials:**
   - Verify `CLICKSEND_USERNAME` and `CLICKSEND_API_KEY` are correct
   - Ensure no extra spaces or quotes

2. **Check Phone Number Format:**
   - Must be E.164 format: `+15551234567`
   - Include country code

3. **Check ClickSend Account:**
   - Ensure account has credits
   - Verify phone number is active

### Webhooks Not Working

1. **Check Webhook URL:**
   - Must be publicly accessible (not localhost)
   - Use ngrok for local testing

2. **Check ClickSend Webhook Settings:**
   - Verify webhook is enabled
   - Check webhook logs in ClickSend dashboard

3. **Check Server Logs:**
   - Look for errors in Vercel function logs
   - Check Supabase logs for database errors

### Database Errors

1. **Verify Schema:**
   - Ensure `sms_schema.sql` was run successfully
   - Check that all tables exist in Supabase

2. **Check RLS Policies:**
   - Verify Row Level Security is configured
   - Test with authenticated user

## Next Steps

After setup is complete:

1. ✅ Test sending SMS from the application
2. ✅ Test receiving inbound SMS
3. ✅ Verify delivery status updates
4. ✅ Set up SMS drip campaigns
5. ✅ Configure analytics views

## Support

- [ClickSend API Documentation](https://developers.clicksend.com/docs)
- [ClickSend Support](https://www.clicksend.com/us/support)


