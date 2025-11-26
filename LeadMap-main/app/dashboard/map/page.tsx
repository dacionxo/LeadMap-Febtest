import DashboardLayout from '../components/DashboardLayout'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Map View</h1>
        <p className="text-gray-400">View your leads on an interactive map.</p>
        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-sm text-gray-400 mb-4">
            Navigate to{' '}
            <a href="/dashboard/leads?view=map" className="text-blue-400 hover:text-blue-300">
              Leads → Map View
            </a>{' '}
            to see your leads on the map.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}

