'use client'

import DashboardLayout from '../components/DashboardLayout'
import { Zap, Search, MapPin, Globe, Workflow } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ToolsPage() {
  const router = useRouter()

  const handleViewMap = () => {
    router.push('/dashboard/leads?view=map')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tools & Automation</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Automate your workflow and integrate with your favorite tools
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <Workflow className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Workflows</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create automated workflows to streamline your processes
            </p>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Create Workflow →
            </button>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <Search className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Enrichment</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Automatically enrich leads with contact information
            </p>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Configure →
            </button>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <MapPin className="w-8 h-8 text-green-600 dark:text-green-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Maps</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Visualize your prospects on an interactive map
            </p>
            <button 
              onClick={handleViewMap}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View Map →
            </button>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <Globe className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Integrations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect with CRM, email, and other tools
            </p>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Browse Integrations →
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

