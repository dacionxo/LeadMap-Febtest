import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import DashboardLayout from '../components/DashboardLayout'
import NextSteps from '../components/NextSteps'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to LeadMap
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Get started by completing these recommended actions to unlock the full potential of your account.
          </p>
        </div>
        <NextSteps />
      </div>
    </DashboardLayout>
  )
}
