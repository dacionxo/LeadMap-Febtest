# SendGrid Signup Email Verification Setup

This guide explains how signup confirmation emails now use SendGrid instead of Supabase's built-in email service.

## ✅ What's Been Implemented

- ✅ **Email verification tokens table** - Stores hashed verification tokens
- ✅ **Send verification email API** - `/api/auth/send-verification-email` uses SendGrid
- ✅ **Verify email API** - `/api/auth/verify-email` handles token verification
- ✅ **Updated signup flow** - Both `SignUpPage.tsx` and `LandingPage.tsx` now use SendGrid
- ✅ **Updated resend verification** - `/api/auth/resend-verification` now uses SendGrid

## 📋 Setup Steps

### 1. Run Database Migration

Execute the SQL migration file to create the `email_verification_tokens` table:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/email_verification_tokens.sql`
5. Click **Run** (or press Ctrl+Enter)
6. Wait for "Success" message

The migration creates:
- `email_verification_tokens` table with proper indexes
- RLS policies for security
- Cleanup function for expired tokens

### 2. Configure SendGrid

Make sure SendGrid is configured in your `.env.local`:

```env
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

See [SENDGRID_SETUP.md](./SENDGRID_SETUP.md) for complete SendGrid setup instructions.

### 3. Disable Supabase Email Confirmation (Recommended)

To prevent Supabase from sending duplicate emails:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Settings**
4. Under **Email Auth**, disable **"Enable email confirmations"**
5. Save changes

**Note:** Even if email confirmations are enabled, our custom system will still work, but users might receive two emails (one from Supabase, one from SendGrid).

## 🚀 How It Works

### Signup Flow

1. User submits signup form (`SignUpPage.tsx` or `LandingPage.tsx`)
2. System checks if user exists via `/api/auth/signup`
3. If new user, Supabase creates account via `supabase.auth.signUp()`
4. **Custom email sending** - System calls `/api/auth/send-verification-email`
5. SendGrid sends verification email with custom token
6. User receives email with verification link

### Email Verification Flow

1. User clicks verification link in email
2. Link goes to `/api/auth/verify-email?token=...`
3. System validates token (compares hash)
4. System marks email as verified in Supabase Auth
5. System creates user profile if it doesn't exist
6. User is redirected to `/verify-email?verified=true`

### Resend Verification Flow

1. User requests to resend verification email
2. System calls `/api/auth/resend-verification`
3. System calls `/api/auth/send-verification-email` internally
4. SendGrid sends new verification email
5. User receives email with new verification link

## 📧 Email Template

The verification email includes:
- Professional HTML design with gradient header
- Clear call-to-action button
- Fallback text link
- Security warnings (24-hour expiration)
- Branded footer

## 🔒 Security Features

### Token Hashing
- Tokens are hashed with bcrypt (12 rounds) before storage
- Even if database is compromised, tokens cannot be used
- Industry-standard security practice

### Token Expiration
- Tokens expire after 24 hours
- Expired tokens are automatically rejected

### One-Time Use
- Tokens are marked as used after successful verification
- Prevents token reuse attacks

## 📁 Files Created/Modified

### New Files
- `supabase/email_verification_tokens.sql` - Database migration
- `app/api/auth/send-verification-email/route.ts` - Send verification email endpoint
- `app/api/auth/verify-email/route.ts` - Verify email endpoint

### Modified Files
- `components/SignUpPage.tsx` - Updated to use SendGrid
- `components/LandingPage.tsx` - Updated to use SendGrid
- `app/api/auth/resend-verification/route.ts` - Updated to use SendGrid

## 🧪 Testing

### Test Signup Flow

1. Go to `/signup` or landing page
2. Enter email, password, and name
3. Submit form
4. Check email inbox for verification email from SendGrid
5. Click verification link
6. Should redirect to `/verify-email?verified=true`

### Test Resend Verification

1. Go to `/signup` with an unverified email
2. System should automatically resend verification email
3. Or call `/api/auth/resend-verification` directly
4. Check email inbox for new verification email

### Verify SendGrid Integration

1. Check SendGrid Activity dashboard
2. Look for "Verify Your Email Address" emails
3. Verify delivery status

## 🐛 Troubleshooting

### "Failed to send verification email"

**Problem:** Email not sending after signup

**Solution:**
- Verify `SENDGRID_API_KEY` is set in `.env.local`
- Check SendGrid dashboard for API key validity
- Verify sender email is verified in SendGrid
- Check server logs for detailed error messages

### "Invalid token" or "Token expired"

**Problem:** Verification link doesn't work

**Solution:**
- Token may have expired (24 hours)
- Token may have already been used
- Request a new verification email

### "User not found"

**Problem:** Verification fails with user not found error

**Solution:**
- User may have been deleted
- Check that user exists in Supabase Auth
- Verify token belongs to correct user

### Database errors

**Problem:** Migration or table access errors

**Solution:**
- Ensure migration was run successfully
- Check Supabase dashboard for table existence
- Verify RLS policies are set correctly
- Check service role key is configured

## 📊 Monitoring

### SendGrid Dashboard

Monitor verification email sending:
- **Activity Feed:** [https://app.sendgrid.com/email_activity](https://app.sendgrid.com/email_activity)
- **Stats:** [https://app.sendgrid.com/statistics](https://app.sendgrid.com/statistics)

### Key Metrics to Monitor

- **Delivery Rate** - Should be > 95%
- **Open Rate** - Track engagement
- **Click Rate** - Track verification link clicks
- **Bounce Rate** - Should be < 5%

## ✅ Checklist

- [ ] Ran database migration (`email_verification_tokens.sql`)
- [ ] Configured SendGrid API key in `.env.local`
- [ ] Verified sender email in SendGrid dashboard
- [ ] (Optional) Disabled Supabase email confirmations
- [ ] Tested signup flow
- [ ] Tested email verification
- [ ] Tested resend verification
- [ ] Verified emails in SendGrid dashboard
- [ ] Checked server logs for errors

## 🎉 You're Done!

Signup confirmation emails now use SendGrid instead of Supabase. All verification emails will be sent through your SendGrid account, giving you full control over email delivery and branding.

## 📚 Additional Resources

- [SendGrid Setup Guide](./SENDGRID_SETUP.md)
- [SendGrid Quick Start](./SENDGRID_QUICK_START.md)
- [Password Reset Setup](./FORGOT_PASSWORD_SETUP.md)
