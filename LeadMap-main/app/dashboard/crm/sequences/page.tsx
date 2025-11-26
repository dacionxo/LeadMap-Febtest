'use client'

import { useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { Plus, Search, Filter, LayoutGrid, Save, Calendar, Settings, MoreVertical, Upload } from 'lucide-react'

interface EmailSequence {
  id: string
  name: string
  recipients: number
  opens: number
  clicks: number
  replies: number
  status: 'active' | 'paused' | 'draft'
  lastSent: string
}

// Mock data - replace with actual API call
const mockSequences: EmailSequence[] = [
  {
    id: '1',
    name: 'Follow-up Sequence',
    recipients: 150,
    opens: 120,
    clicks: 45,
    replies: 12,
    status: 'active',
    lastSent: '2 days ago'
  },
  {
    id: '2',
    name: 'Welcome Sequence',
    recipients: 89,
    opens: 67,
    clicks: 23,
    replies: 8,
    status: 'active',
    lastSent: '1 week ago'
  },
  {
    id: '3',
    name: 'Re-engagement Campaign',
    recipients: 234,
    opens: 156,
    clicks: 78,
    replies: 34,
    status: 'active',
    lastSent: '3 days ago'
  },
  {
    id: '4',
    name: 'Nurture Sequence',
    recipients: 445,
    opens: 389,
    clicks: 123,
    replies: 56,
    status: 'paused',
    lastSent: '2 weeks ago'
  },
  {
    id: '5',
    name: 'Onboarding Series',
    recipients: 67,
    opens: 52,
    clicks: 19,
    replies: 5,
    status: 'active',
    lastSent: '5 days ago'
  },
  {
    id: '6',
    name: 'Product Launch',
    recipients: 312,
    opens: 267,
    clicks: 134,
    replies: 67,
    status: 'active',
    lastSent: '1 day ago'
  },
  {
    id: '7',
    name: 'Holiday Campaign',
    recipients: 523,
    opens: 489,
    clicks: 234,
    replies: 89,
    status: 'active',
    lastSent: '4 days ago'
  },
  {
    id: '8',
    name: 'Win-back Sequence',
    recipients: 178,
    opens: 134,
    clicks: 67,
    replies: 23,
    status: 'draft',
    lastSent: 'Never'
  }
]

export default function SequencesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview')
  const [sequences] = useState<EmailSequence[]>(mockSequences)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      case 'draft':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%'
    return `${Math.round((value / total) * 100)}%`
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            {/* Left: Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Sequences</h1>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create sequence
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Analytics
              <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                New
              </span>
            </button>
          </div>
        </div>

        {/* Toolbar/Filter Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Left Side Controls */}
            <div className="flex items-center gap-3 flex-1">
              <div className="relative">
                <select className="appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>All Sequences</option>
                </select>
                <LayoutGrid className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <button className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Show Filters
              </button>

              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sequences"
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save as new view
              </button>

              <div className="relative">
                <select className="appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>Created date</option>
                </select>
                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <button className="p-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Scrollable Table */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg m-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Sequence name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Recipients
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Opens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Clicks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Replies
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last sent
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sequences.map((sequence) => (
                    <tr
                      key={sequence.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {sequence.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-300">
                          {sequence.recipients.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-300">
                          {sequence.opens.toLocaleString()}
                          <span className="text-gray-500 dark:text-gray-400 ml-1">
                            ({formatPercentage(sequence.opens, sequence.recipients)})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-300">
                          {sequence.clicks.toLocaleString()}
                          <span className="text-gray-500 dark:text-gray-400 ml-1">
                            ({formatPercentage(sequence.clicks, sequence.recipients)})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-300">
                          {sequence.replies.toLocaleString()}
                          <span className="text-gray-500 dark:text-gray-400 ml-1">
                            ({formatPercentage(sequence.replies, sequence.recipients)})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            sequence.status
                          )}`}
                        >
                          {sequence.status.charAt(0).toUpperCase() + sequence.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {sequence.lastSent}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
