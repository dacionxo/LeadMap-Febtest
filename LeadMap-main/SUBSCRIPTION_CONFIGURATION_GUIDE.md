# Subscription Configuration Guide

This guide walks you through configuring the subscription gating system for LeadMap.

## 📋 Prerequisites

- Supabase project set up
- Stripe account (test or live)
- Next.js application running

## 🔧 Step-by-Step Configuration

### 1. Database Setup

#### Run the Migration

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy and paste the contents of `supabase/migration_add_subscription_status.sql`
5. Click **"Run"** (or press Ctrl+Enter)
6. Verify success message appears

**What this does:**
- Adds `subscription_status` column to `users` table
- Updates the trigger function to set subscription status on signup
- Sets default trial period to 14 days
- Creates index for faster queries

#### Verify Migration

Run this query to verify:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'subscription_status';
```

You should see `subscription_status` with type `text` and default `'none'`.

### 2. Environment Variables

Add these to your `.env.local` file (and Vercel/your hosting platform):

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# App URL (for Stripe redirects)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
# Or for Vercel, this is auto-detected

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### Getting Stripe Keys

1. **Stripe Secret Key:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Navigate to **Developers** → **API keys**
   - Copy **Secret key** (starts with `sk_test_` or `sk_live_`)

2. **Stripe Price ID:**
   - Go to **Products** in Stripe Dashboard
   - Create a product (e.g., "LeadMap Pro")
   - Add a price (monthly or annual)
   - Copy the **Price ID** (starts with `price_`)

3. **Stripe Webhook Secret:**
   - See Step 3 below (created after setting up webhook)

### 3. Stripe Webhook Configuration

#### Create Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **"Add endpoint"**
4. Enter your webhook URL:
   ```
   https://yourdomain.com/api/stripe/webhook
   ```
   For local testing with Stripe CLI:
   ```
   https://yourdomain.com/api/stripe/webhook
   ```

5. **Select events to listen to:**
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

6. Click **"Add endpoint"**

7. **Copy the webhook signing secret:**
   - Click on your newly created webhook
   - Find **"Signing secret"**
   - Click **"Reveal"** and copy it
   - Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

#### Test Webhook Locally (Optional)

If testing locally, use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will give you a webhook secret starting with `whsec_` - use this for local testing.

### 4. Configure Trial Period

The default trial period is **14 days**. To change it:

#### Option A: Update Database Default

```sql
ALTER TABLE users 
ALTER COLUMN trial_end SET DEFAULT (NOW() + INTERVAL '14 days');
```

#### Option B: Update Code

1. **Update trigger function** (`supabase/migration_add_subscription_status.sql`):
   ```sql
   NOW() + INTERVAL '14 days'  -- Change 14 to your desired days
   ```

2. **Update user creation API** (`app/api/users/create-profile/route.ts`):
   ```typescript
   trialEnd.setDate(trialEnd.getDate() + 14)  // Change 14 to your desired days
   ```

3. **Re-run migration** or update manually

### 5. Configure Subscription Plans

#### Create Plans in Stripe

1. Go to **Products** in Stripe Dashboard
2. Create products for each tier:
   - **Free** (no product needed - handled by trial)
   - **Pro** (monthly/annual)
   - **Enterprise** (if needed)

3. For each product:
   - Set name (e.g., "LeadMap Pro")
   - Add price (monthly or annual)
   - Copy the **Price ID**

4. Update environment variable:
   ```env
   STRIPE_PRICE_ID=price_1234567890  # Your Pro plan price ID
   ```

#### Multiple Plans (Advanced)

If you need multiple plans, modify `app/api/billing/checkout/route.ts`:

```typescript
// Get plan from query parameter or user selection
const plan = req.nextUrl.searchParams.get('plan') || 'pro'
const priceId = plan === 'pro' 
  ? process.env.STRIPE_PRICE_ID_PRO 
  : process.env.STRIPE_PRICE_ID_ENTERPRISE
```

### 6. Testing the Configuration

#### Test Trial Access

1. Create a new user account
2. Check database:
   ```sql
   SELECT id, email, trial_end, subscription_status 
   FROM users 
   WHERE email = 'test@example.com';
   ```
3. Verify `trial_end` is ~14 days from now
4. Verify `subscription_status` is `'none'`
5. Access dashboard - should work ✅

#### Test Expired Trial

1. Manually expire trial in database:
   ```sql
   UPDATE users 
   SET trial_end = NOW() - INTERVAL '1 day'
   WHERE email = 'test@example.com';
   ```

2. Try to access dashboard
3. Should see subscription gate modal ✅

#### Test Subscription Flow

1. Click "Upgrade to Pro" in modal
2. Complete Stripe checkout (use test card: `4242 4242 4242 4242`)
3. Check webhook logs in Stripe Dashboard
4. Verify database updated:
   ```sql
   SELECT subscription_status, is_subscribed 
   FROM users 
   WHERE email = 'test@example.com';
   ```
5. Should show `subscription_status = 'active'` ✅
6. Dashboard should be accessible ✅

#### Test Webhook

1. Go to Stripe Dashboard → **Webhooks**
2. Click on your webhook endpoint
3. View **"Recent events"**
4. Check for successful deliveries
5. If failed, check error logs

### 7. Production Checklist

Before going live:

- [ ] Run database migration in production Supabase
- [ ] Set `STRIPE_SECRET_KEY` to live key (starts with `sk_live_`)
- [ ] Create live Stripe products and prices
- [ ] Set `STRIPE_PRICE_ID` to live price ID
- [ ] Configure production webhook endpoint
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Test complete subscription flow in production
- [ ] Monitor webhook deliveries
- [ ] Set up Stripe webhook retry policy
- [ ] Configure email notifications in Stripe (optional)

### 8. Monitoring & Maintenance

#### Check Subscription Status

```sql
-- Users with active subscriptions
SELECT email, subscription_status, trial_end, is_subscribed
FROM users
WHERE subscription_status = 'active';

-- Users with expired trials
SELECT email, subscription_status, trial_end
FROM users
WHERE subscription_status = 'none' 
AND trial_end < NOW();
```

#### Webhook Monitoring

- Check Stripe Dashboard → **Webhooks** → **Recent events**
- Monitor for failed deliveries
- Set up alerts for webhook failures

#### Common Issues

**Issue: Webhook not updating subscription**
- Check webhook secret matches
- Verify webhook endpoint is accessible
- Check Stripe webhook logs for errors

**Issue: Users can still access after trial**
- Verify migration was run
- Check `subscription_status` column exists
- Verify dashboard layout is checking entitlement

**Issue: Trial not being set on signup**
- Check database trigger exists
- Verify `handle_new_user()` function is correct
- Check API route `/api/users/create-profile` is being called

## 📚 Additional Resources

- **Full Documentation**: See `SUBSCRIPTION_GATING_README.md`
- **Usage Examples**: See `SUBSCRIPTION_GATING_EXAMPLE.md`
- **Quick Start**: See `SUBSCRIPTION_GATING_QUICKSTART.md`
- **Stripe Docs**: https://stripe.com/docs/subscriptions
- **Next.js Docs**: https://nextjs.org/docs

## 🆘 Need Help?

If you encounter issues:

1. Check the error logs in your hosting platform
2. Verify all environment variables are set
3. Check Stripe webhook logs
4. Verify database schema matches migration
5. Review the documentation files mentioned above

