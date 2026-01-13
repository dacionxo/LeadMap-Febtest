# Stripe Configuration Instructions for Your Account

## 🎯 Quick Setup

Here's exactly what to configure with your Stripe account:

### Environment Variables

Add these to your `.env.local` (and Vercel/environment variables):

```env
# Stripe Live Keys (from your Stripe Dashboard)
STRIPE_SECRET_KEY=sk_live_...  # Your secret key from Stripe Dashboard → Developers → API keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Your publishable key from Stripe Dashboard

# Webhook Secret (from your Stripe webhook endpoint)
STRIPE_WEBHOOK_SECRET=whsec_...  # Get this after creating webhook endpoint (see below)

# Price IDs - YOU NEED TO GET THESE FROM STRIPE
# See instructions below to find them
STRIPE_PRICE_ID_MONTHLY=price_XXXXX  # Get from Stripe Dashboard
STRIPE_PRICE_ID_YEARLY=price_XXXXX   # Get from Stripe Dashboard

# Your app URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## 🔍 Important: Get Your Price IDs

You provided **Product IDs** (`prod_TPvY0ZlIUDCcQf` and `prod_TPvaOClwMCJijr`), but the code needs **Price IDs** (which start with `price_...`).

### How to Find Your Price IDs:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products**
3. Click on **"Pro Plan Monthly"** (Product ID: `prod_TPvY0ZlIUDCcQf`)
4. Scroll down to see the **Prices** section
5. Find the price entry and **copy the Price ID** (starts with `price_...`)
6. Repeat for **"Pro Plan Yearly"** (Product ID: `prod_TPvaOClwMCJijr`)

**Example:**
- Product: `prod_TPvY0ZlIUDCcQf` → Price: `price_1ABC123...` (Monthly)
- Product: `prod_TPvaOClwMCJijr` → Price: `price_1XYZ789...` (Yearly)

### Alternative: If Products Don't Have Prices

If your products don't show prices, you may need to add prices:

1. Go to the product
2. Click **"Add another price"** or **"Create price"**
3. Set:
   - Amount: Your monthly/yearly amount
   - Billing period: Monthly or Yearly
   - Currency: USD
4. Save and copy the Price ID

## 🔗 Webhook Configuration

### Step 1: Create Webhook Endpoint in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **"Add endpoint"**
4. Enter your webhook URL:
   ```
   https://yourdomain.com/api/stripe/webhook
   ```
   Replace `yourdomain.com` with your actual domain

5. **Select these events:**
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

6. Click **"Add endpoint"**

### Step 2: Get Webhook Secret

1. After creating the webhook, click on it
2. Find **"Signing secret"**
3. Click **"Reveal"** or **"Click to reveal"**
4. Copy the secret (starts with `whsec_...`)

**Note:** After creating the webhook endpoint, you'll get a new webhook secret. Use that one, not any old or test webhook secrets you may have.

## ✅ Configuration Checklist

- [ ] Added `STRIPE_SECRET_KEY` to environment variables
- [ ] Added `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to environment variables
- [ ] Found Monthly Price ID from Stripe Dashboard → Added to `STRIPE_PRICE_ID_MONTHLY`
- [ ] Found Yearly Price ID from Stripe Dashboard → Added to `STRIPE_PRICE_ID_YEARLY`
- [ ] Created webhook endpoint in Stripe → Added secret to `STRIPE_WEBHOOK_SECRET`
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Run database migration (if not done already)
- [ ] Test subscription flow

## 🧪 Testing

1. **Test Checkout:**
   - Try clicking "Upgrade to Pro" on the billing page
   - Should redirect to Stripe checkout

2. **Test Webhook:**
   - Complete a test checkout (use test card: `4242 4242 4242 4242`)
   - Check Stripe Dashboard → Webhooks → Recent events
   - Verify webhook was delivered successfully
   - Check your database - `subscription_status` should be `'active'`

3. **Test Subscription Gate:**
   - Expire a test user's trial in database
   - Access dashboard - should see modal popup

## 🚨 Important Notes

1. **Live Mode:** You're using **live keys** (`sk_live_...`). These are for production and will charge real money. Make sure you're ready!

2. **Security:** Never commit these keys to git. They should only be in environment variables.

3. **Webhook URL:** The webhook must be accessible from the internet. For local testing, use Stripe CLI.

4. **Multiple Plans:** The code now supports both monthly and yearly plans. The billing page can pass `plan: 'monthly'` or `plan: 'yearly'` when calling the checkout API.

## 📞 Need Help?

If you can't find your Price IDs:
1. Check the Stripe Dashboard → Products → [Your Product] → Prices section
2. Or create new prices for your existing products
3. The Price ID format is: `price_XXXXXXXXXXXXXXXXXXXXXX`

