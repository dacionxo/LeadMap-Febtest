'use client'

import { useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'

export default function AdManagerContent() {
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([])
  const [showGetStarted, setShowGetStarted] = useState(false)

  const handleConnectAccount = (accountId: string) => {
    if (connectedAccounts.includes(accountId)) {
      setConnectedAccounts(connectedAccounts.filter(id => id !== accountId))
    } else {
      setConnectedAccounts([...connectedAccounts, accountId])
    }
  }

  const handleGetStarted = () => {
    // Navigate to ad manager dashboard or create first campaign
    alert('Ad Manager dashboard coming soon!')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Get Started with Ad Manager
          </h1>
        </div>

        <div className="space-y-8">
          {/* Step 1: Manage Accounts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                1
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Manage accounts
              </h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We Recommend connecting {connectedAccounts.length === 0 ? '1' : connectedAccounts.length} account{connectedAccounts.length !== 1 ? 's' : ''} to start with
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Connect Google */}
              <button
                onClick={() => handleConnectAccount('google')}
                className={`p-4 border-2 rounded-lg transition-all flex items-center gap-3 ${
                  connectedAccounts.includes('google')
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded flex items-center justify-center border border-gray-200 dark:border-gray-600">
                  <span className="text-lg font-bold text-blue-600">G</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">Connect Google</span>
              </button>

              {/* Connect Facebook */}
              <button
                onClick={() => handleConnectAccount('facebook')}
                className={`p-4 border-2 rounded-lg transition-all flex items-center gap-3 ${
                  connectedAccounts.includes('facebook')
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded flex items-center justify-center border border-gray-200 dark:border-gray-600">
                  <span className="text-lg font-bold text-blue-600">f</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">Connect Facebook</span>
              </button>

              {/* Connect LinkedIn */}
              <button
                onClick={() => handleConnectAccount('linkedin')}
                className={`p-4 border-2 rounded-lg transition-all flex items-center gap-3 ${
                  connectedAccounts.includes('linkedin')
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded flex items-center justify-center border border-gray-200 dark:border-gray-600">
                  <span className="text-lg font-bold text-blue-600">in</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">Connect LinkedIn</span>
              </button>
            </div>
          </div>

          {/* Step 2: Get Started */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                2
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Get Started
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Illustration */}
              <div className="flex items-center justify-center">
                <div className="relative">
                  {/* Screen/Ad Outline */}
                  <div className="w-64 h-80 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 p-4">
                    {/* Profile Icon */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-500"></div>
                      </div>
                      <div className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                        ADS
                      </div>
                    </div>
                    
                    {/* Content Lines */}
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                      <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                      <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    Connect multiple Ad account and run Ads based on your objectives.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    Create multiple Facebook forms.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    3 Steps to create a campaign by adding content, budget, audience and review.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    Use Template Library to boost your content.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    Get better Analytics and Reporting.
                  </p>
                </div>
              </div>
            </div>

            {/* Get Started Button */}
            <div className="mt-8">
              <button
                onClick={handleGetStarted}
                className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


