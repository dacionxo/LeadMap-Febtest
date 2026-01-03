import { redirect } from 'next/navigation'
import { getEntitlement } from '@/lib/entitlements'
import { getCurrentUser } from '@/lib/auth'
import { getServiceRoleClient } from '@/lib/supabase-singleton'

// Force dynamic rendering to prevent caching entitlement decisions
export const dynamic = 'force-dynamic'

/**
 * Protected Dashboard Layout
 * This layout guards all dashboard routes and ensures users have
 * active trial or subscription before accessing the app
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {

  // Check authentication
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    redirect('/login')
  }

  // Get user from database
  const supabase = getServiceRoleClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, trial_end, subscription_status')
    .eq('id', sessionUser.id)
    .single()

  if (error || !user) {
    console.error('Error fetching user:', error)
    redirect('/login')
  }

  // Check entitlement
  const ent = getEntitlement({
    trialEndsAt: user.trial_end,
    subscriptionStatus: (user.subscription_status as string) || 'none',
  })

  // Redirect to billing if access is denied
  if (!ent.canUseApp) {
    redirect('/billing?reason=trial_ended')
  }

  // User has access, render children
  return <>{children}</>
}

