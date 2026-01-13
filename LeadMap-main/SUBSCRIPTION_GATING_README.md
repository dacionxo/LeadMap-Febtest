# Subscription Gating Implementation

This document explains the subscription gating system implemented in LeadMap. This system ensures users can only access the app if they have an active trial or paid subscription.

## Architecture Overview

The subscription gating system follows a centralized architecture:

1. **Single Source of Truth**: `lib/entitlements.ts` - One function (`getEntitlement`) determines access
2. **Backend Guards**: API routes are protected using `requireEntitledApiUser`
3. **Frontend Guards**: Dashboard pages are protected via `app/dashboard/layout.tsx`
4. **Stripe Integration**: Webhooks keep subscription status in sync

## Key Components

### 1. Entitlement Logic (`lib/entitlements.ts`)

The core logic that determines if a user can access the app:

```typescript
getEntitlement(user: {
  trialEndsAt: Date | null;
  subscriptionStatus: SubscriptionStatus;
}): UserEntitlement
```

**Rules:**
- If subscription is `active` or `trialing` → Access granted (`reason: "paid"`)
- If trial hasn't expired (current date < trialEndsAt) → Access granted (`reason: "trial"`)
- Otherwise → Access denied (`reason: "expired"`)

### 2. Database Schema

The `users` table includes:

- `trial_end` (TIMESTAMPTZ) - When the trial period ends
- `subscription_status` (TEXT) - One of: `none`, `active`, `trialing`, `past_due`, `canceled`, `incomplete`
- `is_subscribed` (BOOLEAN) - Legacy field (kept for compatibility)
- `stripe_customer_id` (TEXT) - Stripe customer ID
- `stripe_subscription_id` (TEXT) - Stripe subscription ID

### 3. API Route Guard (`lib/requireEntitledApiUser.ts`)

Use this in any protected API route:

```typescript
import { requireEntitledApiUser } from '@/lib/requireEntitledApiUser'

export async function GET(req: Request) {
  const guard = await requireEntitledApiUser(req)
  if (!guard.ok) return guard.res // Returns 401 or 402
  
  // User is authenticated and entitled
  const { user, ent } = guard
  // ... your logic here
}
```

**Response Codes:**
- `401` - Not authenticated
- `402` - Payment required (trial expired, no subscription)

### 4. Dashboard Layout Guard (`app/dashboard/layout.tsx`)

All dashboard routes are automatically protected. The layout:
1. Checks authentication
2. Fetches user from database
3. Checks entitlement
4. Redirects to `/billing?reason=trial_ended` if access denied

### 5. Stripe Webhook (`app/api/stripe/webhook/route.ts`)

Handles Stripe events to keep subscription status in sync:

- `checkout.session.completed` - Sets subscription to active
- `customer.subscription.created` / `updated` - Updates subscription status
- `customer.subscription.deleted` - Sets subscription to canceled

### 6. Billing Page (`app/billing/page.tsx`)

Shows:
- Current subscription status
- Trial period status
- Upgrade/subscribe button
- Pricing plans

**Access**: Always accessible (even when trial expired) so users can upgrade.

## Setup Instructions

### 1. Run Database Migration

Run the migration to add `subscription_status` column:

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migration_add_subscription_status.sql
```

This will:
- Add `subscription_status` column
- Set default values for existing users
- Update the trigger function
- Create an index

### 2. Environment Variables

Ensure these are set in your `.env.local`:

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 3. Stripe Webhook Configuration

In Stripe Dashboard:
1. Go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

### 4. User Signup Flow

When a user signs up:
1. Supabase Auth creates user in `auth.users`
2. Database trigger `handle_new_user()` creates profile with:
   - `trial_end` = NOW() + 14 days
   - `subscription_status` = 'none'
3. User can access the app during trial

### 5. Adding Protection to New API Routes

For any new protected API route, use the guard:

```typescript
import { requireEntitledApiUser } from '@/lib/requireEntitledApiUser'

export async function POST(req: Request) {
  const guard = await requireEntitledApiUser(req)
  if (!guard.ok) return guard.res
  
  // Protected logic here
  const { user } = guard
  // ...
}
```

## Trial Period

Default trial period is **14 days**. To change:

1. Update `trial_end` calculation in:
   - `app/api/users/create-profile/route.ts` (line 82)
   - `supabase/migration_add_subscription_status.sql` (trigger function)
   - `supabase/complete_schema.sql` (trigger function)

2. Update database default:
   ```sql
   ALTER TABLE users 
   ALTER COLUMN trial_end SET DEFAULT (NOW() + INTERVAL '14 days');
   ```

## Subscription Status Flow

1. **Trial Active**: `subscription_status = 'none'`, `trial_end` in future → Access granted
2. **Subscription Active**: `subscription_status = 'active'` → Access granted
3. **Trial Expired**: `subscription_status = 'none'`, `trial_end` in past → Access denied → Redirect to billing
4. **Subscription Canceled**: `subscription_status = 'canceled'` → Access denied → Redirect to billing

## Testing

### Test Trial Access
1. Create a test user
2. Verify `trial_end` is set to future date
3. Access should be granted

### Test Expired Trial
1. Manually set `trial_end` to past date in database
2. Attempt to access dashboard → Should redirect to `/billing`
3. Attempt API call → Should return `402 Payment Required`

### Test Subscription
1. Complete Stripe checkout
2. Verify webhook updates `subscription_status = 'active'`
3. Access should be granted even after trial ends

## Common Issues

### Issue: Users can still access after trial expires

**Solution**: Ensure:
1. Migration has been run (subscription_status column exists)
2. Dashboard layout is checking entitlement
3. API routes are using `requireEntitledApiUser`

### Issue: Webhook not updating subscription status

**Solution**: 
1. Check Stripe webhook logs for errors
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Check webhook endpoint is accessible (not behind auth)

### Issue: Trial period not being set

**Solution**:
1. Check database trigger `handle_new_user()` exists
2. Verify trigger is firing on user creation
3. Check `app/api/users/create-profile/route.ts` is being called

## Files Modified/Created

### Created Files:
- `lib/entitlements.ts` - Core entitlement logic
- `lib/auth.ts` - Auth helper functions
- `lib/requireEntitledApiUser.ts` - API route guard
- `app/billing/page.tsx` - Billing/subscription page
- `app/api/billing/checkout/route.ts` - Stripe checkout endpoint
- `app/dashboard/layout.tsx` - Dashboard route guard
- `supabase/migration_add_subscription_status.sql` - Database migration

### Modified Files:
- `app/api/stripe/webhook/route.ts` - Updated to handle subscription_status
- `app/api/users/create-profile/route.ts` - Added subscription_status on creation
- `supabase/complete_schema.sql` - Updated table definition and trigger

## Next Steps

1. **Run the migration** in Supabase SQL Editor
2. **Configure Stripe webhook** in Stripe Dashboard
3. **Test the flow** with a test account
4. **Add guards to additional API routes** as needed
5. **Customize billing page** UI if needed

