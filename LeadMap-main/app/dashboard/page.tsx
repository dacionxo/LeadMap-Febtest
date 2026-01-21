import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import DashboardLayout from './components/DashboardLayout'
import DashboardClient from './components/DashboardClient'
import WelcomeCardClient from './components/WelcomeCardClient'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <WelcomeCardClient />
        <DashboardClient />
      </div>
    </DashboardLayout>
  )
}
