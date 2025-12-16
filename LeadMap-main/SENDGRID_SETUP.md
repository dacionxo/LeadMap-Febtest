# SendGrid Email Integration Setup Guide

This guide will help you set up SendGrid for sending transactional emails (like password reset emails) in your LeadMap application.

## ✅ What's Been Configured

- ✅ **@sendgrid/mail package installed** - Official SendGrid Node.js SDK
- ✅ **Email utility updated** - `lib/sendEmail.ts` now uses the official SendGrid SDK
- ✅ **Password reset integration** - Already configured to use SendGrid when API key is set

## 📋 Setup Steps

### 1. Configure Environment Variables

Add the following to your `.env.local` file in the project root:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

**Important Notes:**
- Replace `noreply@yourdomain.com` with your verified sender email address in SendGrid
- The API key provided starts with `SG.` which is correct
- Never commit `.env.local` to version control (it's already in `.gitignore`)

### 2. Verify Sender Email in SendGrid

Before sending emails, you must verify your sender email address in SendGrid:

1. Go to [SendGrid Dashboard](https://app.sendgrid.com/)
2. Navigate to **Settings** → **Sender Authentication**
3. Click **Verify a Single Sender**
4. Enter your email address and complete verification
5. Use this verified email address as `SENDGRID_FROM_EMAIL`

**Alternative:** Set up Domain Authentication for better deliverability:
1. Go to **Settings** → **Sender Authentication** → **Authenticate Your Domain**
2. Follow the DNS setup instructions
3. Use any email address from your verified domain

### 3. For Production (Vercel)

If deploying to Vercel, add the environment variables in the Vercel dashboard:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name:** `SENDGRID_API_KEY`
   - **Value:** `SG.your_api_key_here` (use your actual SendGrid API key)
   - **Environment:** Select all (Production, Preview, Development)
5. Add:
   - **Name:** `SENDGRID_FROM_EMAIL`
   - **Value:** `noreply@yourdomain.com` (your verified email)
   - **Environment:** Select all
6. Click **Save**

### 4. Restart Development Server

After adding environment variables, restart your development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## 🚀 How It Works

The email system automatically uses SendGrid when `SENDGRID_API_KEY` is set. The system checks for email services in this order:

1. **Resend** (if `RESEND_API_KEY` is set)
2. **SendGrid** (if `SENDGRID_API_KEY` is set) ← **You're using this**
3. **Mailgun** (if `MAILGUN_API_KEY` is set)
4. **Generic Email API** (if `EMAIL_SERVICE_URL` is set)

### Email Sending Flow

When a user requests a password reset:

1. User clicks "Forgot password?" and enters email
2. System generates secure reset token
3. `sendEmail()` function is called with:
   - `to`: User's email address
   - `subject`: "Reset Your Password"
   - `html`: Beautiful HTML email template
4. SendGrid SDK sends the email via their API
5. User receives email with reset link

## 📧 Email Features

### Password Reset Emails

The password reset email includes:
- Professional HTML design with gradient header
- Clear call-to-action button
- Fallback text link
- Security warnings (15-minute expiration)
- Branded footer

### Customization

To customize email templates, edit:
- `app/api/auth/forgot-password/route.ts` - Password reset email HTML

## 🧪 Testing

### Test SendGrid Integration

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Test password reset:**
   - Go to `/login`
   - Click "Forgot password?"
   - Enter a valid email address
   - Check your email inbox (and spam folder)

3. **Check server logs:**
   - If email fails, check the console for error messages
   - SendGrid errors will be logged with details

### Verify SendGrid API Key

You can verify your API key is working by checking SendGrid dashboard:
1. Go to [SendGrid Activity](https://app.sendgrid.com/email_activity)
2. Look for recent email sends
3. Check delivery status

## 🔒 Security Best Practices

1. **Never commit API keys** - `.env.local` is in `.gitignore`
2. **Use different keys for dev/prod** - Create separate API keys for different environments
3. **Restrict API key permissions** - In SendGrid, create API keys with only `mail.send` permission
4. **Rotate keys regularly** - Update API keys periodically for security
5. **Monitor usage** - Check SendGrid dashboard for unusual activity

## 🐛 Troubleshooting

### "No email service configured"

**Problem:** Email not sending, see this error in logs

**Solution:**
- Verify `SENDGRID_API_KEY` is set in `.env.local`
- Restart development server after adding environment variables
- Check that the API key starts with `SG.`

### "SendGrid error: Unauthorized"

**Problem:** API key is invalid or expired

**Solution:**
- Verify the API key in SendGrid dashboard
- Check that the key has `mail.send` permission
- Regenerate the API key if needed

### "SendGrid error: Forbidden"

**Problem:** Sender email is not verified

**Solution:**
- Verify your sender email in SendGrid dashboard
- Use a verified email address for `SENDGRID_FROM_EMAIL`
- Complete domain authentication if using a custom domain

### Emails going to spam

**Solution:**
- Set up Domain Authentication (SPF, DKIM, DMARC)
- Use a verified sender email
- Avoid spam trigger words in subject/content
- Warm up your domain gradually if new

### Email not received

**Check:**
1. Spam/junk folder
2. SendGrid Activity dashboard for delivery status
3. Server logs for error messages
4. Email address is correct
5. Sender email is verified in SendGrid

## 📊 Monitoring

### SendGrid Dashboard

Monitor your email sending:
- **Activity Feed:** [https://app.sendgrid.com/email_activity](https://app.sendgrid.com/email_activity)
- **Stats:** [https://app.sendgrid.com/statistics](https://app.sendgrid.com/statistics)
- **API Usage:** [https://app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys)

### Key Metrics to Monitor

- **Delivery Rate** - Should be > 95%
- **Open Rate** - Track engagement
- **Bounce Rate** - Should be < 5%
- **Spam Reports** - Should be minimal

## 🔄 API Key Management

### Creating Additional API Keys

1. Go to [SendGrid API Keys](https://app.sendgrid.com/settings/api_keys)
2. Click **Create API Key**
3. Name it (e.g., "LeadMap Production")
4. Select **Restricted Access**
5. Grant only **Mail Send** permission
6. Copy the key immediately (you can't see it again)
7. Add to `.env.local` or Vercel environment variables

### Rotating API Keys

1. Create a new API key
2. Update environment variables
3. Test email sending
4. Delete old API key after confirming new one works

## 📝 Environment Variables Reference

```env
# Required for SendGrid
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=verified@yourdomain.com

# Optional - App URL for password reset links
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Or for production:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## ✅ Checklist

- [ ] Added `SENDGRID_API_KEY` to `.env.local`
- [ ] Added `SENDGRID_FROM_EMAIL` to `.env.local` (verified email)
- [ ] Verified sender email in SendGrid dashboard
- [ ] Restarted development server
- [ ] Tested password reset email
- [ ] Verified email received in inbox
- [ ] Added environment variables to Vercel (for production)
- [ ] Checked SendGrid Activity dashboard

## 🎉 You're Done!

SendGrid is now configured and ready to send emails. Your password reset system will automatically use SendGrid to send emails to users who forget their passwords.

## 📚 Additional Resources

- [SendGrid Node.js Documentation](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid API Reference](https://docs.sendgrid.com/api-reference)
- [SendGrid Best Practices](https://docs.sendgrid.com/for-developers/sending-email/best-practices)
- [Domain Authentication Guide](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication)
