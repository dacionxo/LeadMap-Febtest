'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2, Calendar, CreditCard, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import PricingPage from '@/components/PricingPage'

interface UserSubscription {
  trial_end: string | null
  subscription_status: string | null
  is_subscribed: boolean
  plan_tier: string
  stripe_customer_id: string | null
}

function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  async function loadSubscriptionData() {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('trial_end, subscription_status, is_subscribed, plan_tier, stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading subscription:', error)
        return
      }

      setSubscription(data as UserSubscription)
      if (data.trial_end) {
        setTrialEndsAt(new Date(data.trial_end))
      }
    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe() {
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error)
      alert(error.message || 'Failed to start checkout. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const now = new Date()
  const trialActive = trialEndsAt && now < trialEndsAt
  const trialExpired = trialEndsAt && now >= trialEndsAt
  const isPaid = subscription?.subscription_status === 'active' || subscription?.subscription_status === 'trialing'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status Banner */}
      {reason === 'trial_ended' && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Your trial has ended
                </h3>
                <p className="text-sm text-yellow-700">
                  Subscribe to continue using LeadMap
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Subscription Status</h2>
          
          <div className="space-y-4">
            {/* Subscription Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isPaid ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">Subscription</p>
                  <p className="text-sm text-gray-500">
                    {isPaid 
                      ? `Active (${subscription?.plan_tier || 'pro'} plan)`
                      : subscription?.subscription_status === 'canceled'
                      ? 'Canceled'
                      : 'No active subscription'}
                  </p>
                </div>
              </div>
            </div>

            {/* Trial Status */}
            {trialEndsAt && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Trial Period</p>
                    <p className="text-sm text-gray-500">
                      {trialActive 
                        ? `Ends on ${trialEndsAt.toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}`
                        : trialExpired
                        ? `Ended on ${trialEndsAt.toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}`
                        : 'No trial'}
                    </p>
                  </div>
                </div>
                {trialActive && (
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    Active
                  </span>
                )}
                {trialExpired && !isPaid && (
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                    Expired
                  </span>
                )}
              </div>
            )}

            {/* Action Button */}
            {!isPaid && (
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={handleSubscribe}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {trialActive ? 'Upgrade to Pro' : 'Subscribe to Continue'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Plans */}
        <div>
          <PricingPage />
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  )
}

