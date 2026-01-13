import { redirect } from 'next/navigation'
import { getEntitlement } from '@/lib/entitlements'
import { getCurrentUser } from '@/lib/auth'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import SubscriptionGateModal from './components/SubscriptionGateModal'

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
    .select('id, name, email, trial_end, subscription_status')
    .eq('id', sessionUser.id)
    .single()

  if (error || !user) {
    console.error('Error fetching user:', error)
    redirect('/login')
  }

  // Type assertion needed because service role client doesn't have database schema types
  const userData = user as {
    id: string
    name: string | null
    email: string | null
    trial_end: string | null
    subscription_status: string | null
  }

  // Check entitlement
  const ent = getEntitlement({
    trialEndsAt: userData.trial_end,
    subscriptionStatus: (userData.subscription_status as string) || 'none',
  })

  // Show subscription gate modal if access is denied
  if (!ent.canUseApp) {
    return (
      <>
        {/* Render children in background (blocked by modal) */}
        <div className="pointer-events-none opacity-30">
          {children}
        </div>
        
        {/* Subscription Gate Modal */}
        <SubscriptionGateModal
          userName={userData.name || undefined}
          trialEndsAt={userData.trial_end || null}
          workspaceId={userData.id}
        />
      </>
    )
  }

  // User has access, render children
  return <>{children}</>
}

