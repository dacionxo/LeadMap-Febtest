# Subscription Gating - Usage Examples

This document shows practical examples of how to use the subscription gating system in your API routes.

## Example: Protecting an API Route

### Before (Basic Auth Only)

```typescript
// app/api/lists/route.ts (old)
export async function GET(request: NextRequest) {
  // Authenticate user
  const cookieStore = await cookies()
  const supabaseAuth = createRouteHandlerClient({
    cookies: () => cookieStore,
  })
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // User is authenticated, but trial/subscription not checked!
  // ... rest of your logic
}
```

### After (With Entitlement Guard)

```typescript
// app/api/lists/route.ts (new)
import { requireEntitledApiUser } from '@/lib/requireEntitledApiUser'

export async function GET(request: NextRequest) {
  // Check authentication AND entitlement
  const guard = await requireEntitledApiUser(request)
  if (!guard.ok) return guard.res // Returns 401 or 402

  // User is authenticated AND has active trial/subscription
  const { user, ent } = guard
  
  // Access user info
  console.log('User ID:', user.id)
  console.log('Access reason:', ent.reason) // 'paid' | 'trial' | 'expired'
  
  // ... rest of your logic
}
```

## Example: Different Behavior for Trial vs Paid Users

```typescript
import { requireEntitledApiUser } from '@/lib/requireEntitledApiUser'

export async function POST(request: NextRequest) {
  const guard = await requireEntitledApiUser(request)
  if (!guard.ok) return guard.res

  const { user, ent } = guard

  // Different limits based on subscription
  if (ent.reason === 'trial') {
    // Trial users: limit to 10 items
    const limit = 10
    // ... logic with trial limit
  } else {
    // Paid users: unlimited
    const limit = Infinity
    // ... logic with paid limit
  }
}
```

## Example: Bypassing Check for Specific Routes

Some routes should be accessible even when trial expires (like billing):

```typescript
// app/api/billing/checkout/route.ts
// This route should be accessible even if trial expired

import { getUserIdFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Only check auth, NOT entitlement
  const userId = await getUserIdFromRequest(req)
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Allow access even if trial expired (user needs to pay!)
  // ... billing logic
}
```

## Example: Adding Trial Warning Banner

Show a banner when trial is ending soon:

```typescript
// In a client component
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function TrialWarningBanner() {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    checkTrialStatus()
  }, [])

  async function checkTrialStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('users')
      .select('trial_end, subscription_status')
      .eq('id', user.id)
      .single()

    if (!data) return

    // Only show if on trial (subscription_status is 'none')
    if (data.subscription_status === 'none' && data.trial_end) {
      const trialEnd = new Date(data.trial_end)
      const now = new Date()
      const days = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (days > 0 && days <= 3) {
        setDaysRemaining(days)
      }
    }
  }

  if (!daysRemaining) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <p className="text-sm text-yellow-800">
        ⚠️ Your trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. 
        <a href="/billing" className="underline ml-1">Upgrade now</a>
      </p>
    </div>
  )
}
```

## Example: Server Component Check

For server components (not API routes), check entitlement directly:

```typescript
// app/dashboard/leads/page.tsx
import { redirect } from 'next/navigation'
import { getEntitlement } from '@/lib/entitlements'
import { getCurrentUser } from '@/lib/auth'
import { getServiceRoleClient } from '@/lib/supabase-singleton'

export default async function LeadsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = getServiceRoleClient()
  const { data: userData } = await supabase
    .from('users')
    .select('trial_end, subscription_status')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  const ent = getEntitlement({
    trialEndsAt: userData.trial_end,
    subscriptionStatus: userData.subscription_status || 'none',
  })

  // This shouldn't happen if dashboard layout is protecting, but good to check
  if (!ent.canUseApp) {
    redirect('/billing?reason=trial_ended')
  }

  // Render page
  return <div>Leads Page</div>
}
```

## Common Patterns

### Pattern 1: Protect All Routes in a Folder

Create a `layout.tsx` in the folder:

```typescript
// app/api/leads/layout.tsx (doesn't exist, but you could create it)
// Actually, Next.js doesn't support layouts for API routes
// Instead, use the guard in each route or create a wrapper function
```

### Pattern 2: Rate Limiting Based on Plan

```typescript
const guard = await requireEntitledApiUser(request)
if (!guard.ok) return guard.res

const { user, ent } = guard

// Different rate limits
const rateLimit = ent.reason === 'paid' ? 1000 : 100 // requests per hour
```

### Pattern 3: Feature Flags Based on Subscription

```typescript
const guard = await requireEntitledApiUser(request)
if (!guard.ok) return guard.res

const { user } = guard
const supabase = getServiceRoleClient()

// Fetch full user to check plan_tier
const { data } = await supabase
  .from('users')
  .select('plan_tier')
  .eq('id', user.id)
  .single()

const canUseAdvancedFeatures = data?.plan_tier === 'pro'
```

## Migration Checklist

When migrating existing routes:

- [ ] Import `requireEntitledApiUser`
- [ ] Replace basic auth check with entitlement guard
- [ ] Update error handling (now returns 402 for expired trial)
- [ ] Test with expired trial user
- [ ] Test with active subscription user
- [ ] Test with active trial user

