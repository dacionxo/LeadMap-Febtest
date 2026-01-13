import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export const runtime = 'nodejs'

/**
 * Create Stripe Checkout Session for subscription
 * This endpoint should be accessible even if user's trial has expired
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceRoleClient()

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Type assertion for Supabase query result
    const userData = user as { email: string | null; stripe_customer_id: string | null }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    // Get plan type from request body or default to monthly
    let planType = 'monthly'
    try {
      const body = await req.json()
      if (body?.plan === 'yearly') {
        planType = 'yearly'
      }
    } catch {
      // Empty body or invalid JSON, use default
    }
    
    // Get price ID from environment - try new vars first, fallback to old var
    let priceId = planType === 'yearly' 
      ? process.env.STRIPE_PRICE_ID_YEARLY 
      : process.env.STRIPE_PRICE_ID_MONTHLY

    // Fallback to old STRIPE_PRICE_ID if new vars not set
    if (!priceId) {
      priceId = process.env.STRIPE_PRICE_ID
    }

    if (!priceId) {
      const missingVar = planType === 'yearly' 
        ? 'STRIPE_PRICE_ID_YEARLY' 
        : 'STRIPE_PRICE_ID_MONTHLY'
      console.error(`Stripe price ID not configured. Please set ${missingVar} or STRIPE_PRICE_ID in environment variables.`)
      return NextResponse.json(
        { 
          error: 'Subscription not configured',
          details: `Missing ${missingVar} environment variable. Please configure Stripe price IDs.`
        },
        { status: 500 }
      )
    }

    let customerId = userData.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email ?? undefined,
        metadata: { userId },
      })
      customerId = customer.id

      // Update user with customer ID
      // Type assertion needed because service role client doesn't have database schema types
      const { error: updateError } = await (supabase
        .from('users') as any)
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
      
      if (updateError) {
        console.error('Error updating user with customer ID:', updateError)
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing`,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

