import DashboardLayout from '../components/DashboardLayout'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function EnrichmentPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Lead Enrichment</h1>
        <p className="text-gray-400">Enrich leads with owner contact information and property details.</p>
        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-sm text-gray-400">
            Use the "Enrich" button on individual leads in the{' '}
            <a href="/dashboard/leads" className="text-blue-400 hover:text-blue-300">
              Leads Table
            </a>{' '}
            to enrich them with owner contact information.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}

