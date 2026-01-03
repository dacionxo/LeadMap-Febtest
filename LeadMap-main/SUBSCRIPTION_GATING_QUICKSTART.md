# Subscription Gating - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migration_add_subscription_status.sql`
3. Click "Run"
4. Verify success message

### Step 2: Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copy webhook secret → Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### Step 3: Verify Environment Variables

Ensure these are in `.env.local`:

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 4: Test

1. **Test Trial Access**:
   - Create a new user account
   - Should be able to access dashboard
   - Check database: `trial_end` should be ~14 days from now

2. **Test Expired Trial**:
   - In database, set `trial_end` to past date
   - Try to access dashboard → Should redirect to `/billing`

3. **Test Subscription**:
   - Complete Stripe checkout
   - Check webhook logs in Stripe
   - Verify database: `subscription_status` = `'active'`

## ✅ What's Already Protected

- ✅ All dashboard routes (`/app/dashboard/*`) - Protected by layout
- ✅ Stripe webhook - Updates subscription status
- ✅ User creation - Sets trial period

## 🔧 What You Need to Do

### Option A: Protect Existing API Routes

For each protected API route, add:

```typescript
import { requireEntitledApiUser } from '@/lib/requireEntitledApiUser'

export async function GET(req: Request) {
  const guard = await requireEntitledApiUser(req)
  if (!guard.ok) return guard.res
  
  // Your logic here
}
```

### Option B: Leave API Routes Unprotected (Not Recommended)

The dashboard is protected, but users could still call APIs directly. For production, protect your API routes.

## 📁 Files Created

- `lib/entitlements.ts` - Core logic
- `lib/auth.ts` - Auth helpers
- `lib/requireEntitledApiUser.ts` - API guard
- `app/billing/page.tsx` - Billing page
- `app/api/billing/checkout/route.ts` - Checkout endpoint
- `app/dashboard/layout.tsx` - Dashboard guard
- `supabase/migration_add_subscription_status.sql` - Database migration

## 📖 Documentation

- **Full Guide**: See `SUBSCRIPTION_GATING_README.md`
- **Examples**: See `SUBSCRIPTION_GATING_EXAMPLE.md`

## 🐛 Troubleshooting

### Issue: Migration fails
- **Fix**: Ensure you have admin access to Supabase SQL Editor
- **Fix**: Check if `subscription_status` column already exists

### Issue: Webhook not working
- **Fix**: Verify webhook URL is accessible (not behind auth)
- **Fix**: Check webhook secret matches Stripe dashboard
- **Fix**: Check Stripe webhook logs for errors

### Issue: Users can still access after trial
- **Fix**: Verify migration was run successfully
- **Fix**: Check `app/dashboard/layout.tsx` exists and is correct
- **Fix**: Clear Next.js cache: `rm -rf .next`

## 🎯 Next Steps

1. ✅ Run migration
2. ✅ Configure Stripe webhook
3. ✅ Test trial flow
4. ⬜ Add guards to critical API routes
5. ⬜ Customize billing page UI
6. ⬜ Add trial warning banner (optional)
7. ⬜ Set up monitoring/alerts for failed payments

---

**Need Help?** See the full documentation in `SUBSCRIPTION_GATING_README.md`

