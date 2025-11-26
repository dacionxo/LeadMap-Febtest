import DashboardLayout from '../components/DashboardLayout'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DocsPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Documentation</h1>
        <p className="text-gray-400">Learn how to use LeadMap effectively.</p>
        <div className="space-y-4">
          <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-2">Getting Started</h2>
            <p className="text-sm text-gray-400">
              Learn the basics of finding and managing property leads.
            </p>
          </div>
          <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-2">Lead Enrichment</h2>
            <p className="text-sm text-gray-400">
              Discover how to enrich leads with owner contact information.
            </p>
          </div>
          <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-2">Email Templates</h2>
            <p className="text-sm text-gray-400">
              Create and manage email templates for property owner outreach.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

