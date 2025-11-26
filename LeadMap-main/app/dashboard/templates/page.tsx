import DashboardLayout from '../components/DashboardLayout'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Email Templates</h1>
        <p className="text-gray-400">Email templates management coming soon...</p>
        <p className="text-sm text-gray-500">
          For now, you can manage templates from the{' '}
          <a href="/admin" className="text-blue-400 hover:text-blue-300">
            Admin Panel
          </a>
        </p>
      </div>
    </DashboardLayout>
  )
}

