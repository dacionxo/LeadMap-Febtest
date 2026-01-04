/**
 * Symphony Messenger Dashboard Component
 * Main dashboard with tabs for different views
 */

'use client'

import { useState } from 'react'
import QueueOverview from './QueueOverview'
import MessageSearch from './MessageSearch'
import FailedMessages from './FailedMessages'
import Statistics from './Statistics'
import MessageInspector from './MessageInspector'

// Export MessageInspector for use
export { MessageInspector }

type Tab = 'overview' | 'messages' | 'failed' | 'stats' | 'inspector'

export default function SymphonyDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: '📊' },
    { id: 'messages' as Tab, label: 'Messages', icon: '📨' },
    { id: 'failed' as Tab, label: 'Failed', icon: '❌' },
    { id: 'stats' as Tab, label: 'Statistics', icon: '📈' },
    { id: 'inspector' as Tab, label: 'Inspector', icon: '🔍' },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id !== 'inspector') {
                  setSelectedMessageId(null)
                }
              }}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && <QueueOverview />}
        {activeTab === 'messages' && (
          <MessageSearch onMessageSelect={setSelectedMessageId} />
        )}
        {activeTab === 'failed' && (
          <FailedMessages onMessageSelect={setSelectedMessageId} />
        )}
        {activeTab === 'stats' && <Statistics />}
        {activeTab === 'inspector' && (
          <MessageInspector
            messageId={selectedMessageId}
            onMessageIdChange={setSelectedMessageId}
          />
        )}
      </div>
    </div>
  )
}

