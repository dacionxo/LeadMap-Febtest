'use client'

import { useState, Suspense } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import EmailAnalyticsDashboard from '../components/EmailAnalyticsDashboard'
import CrossChannelReporting from '../components/CrossChannelReporting'

function EmailAnalyticsPageContent() {
  const [activeTab, setActiveTab] = useState<'email' | 'cross-channel'>('email')

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
            }`}
          >
            Email Analytics
          </button>
          <button
            onClick={() => setActiveTab('cross-channel')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'cross-channel'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
            }`}
          >
            Cross-Channel Reporting
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'email' && <EmailAnalyticsDashboard />}
      {activeTab === 'cross-channel' && <CrossChannelReporting />}
    </div>
  )
}

export default function EmailAnalyticsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <EmailAnalyticsPageContent />
      </Suspense>
    </DashboardLayout>
  )
}

