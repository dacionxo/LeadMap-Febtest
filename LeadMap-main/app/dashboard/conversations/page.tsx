'use client'

import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { 
  Search, 
  Filter, 
  Edit3, 
  ChevronDown,
  Phone,
  MessageCircle,
  Bell,
  HelpCircle,
  User
} from 'lucide-react'

export default function ConversationsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'conversations' | 'manual-actions' | 'snippets' | 'trigger-links'>('conversations')
  const [activeSidebarTab, setActiveSidebarTab] = useState<'unread' | 'recents' | 'starred' | 'all'>('unread')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [selectedContact, setSelectedContact] = useState<string | null>(null)

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] bg-white dark:bg-gray-900">
        {/* Top Header Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          {/* Left: Title and Main Tabs */}
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Conversations</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveMainTab('conversations')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === 'conversations'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Conversations
              </button>
              <button
                onClick={() => setActiveMainTab('manual-actions')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === 'manual-actions'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Manual Actions
              </button>
              <button
                onClick={() => setActiveMainTab('snippets')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeMainTab === 'snippets'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Snippets
              </button>
              <button
                onClick={() => setActiveMainTab('trigger-links')}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  activeMainTab === 'trigger-links'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Trigger Links
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right: Icons */}
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center hover:bg-green-200 dark:hover:bg-green-800 transition-colors">
              <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
            </button>
            <button className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
              <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
            <button className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800 transition-colors relative">
              <Bell className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
            <button className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors">
              <HelpCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </button>
            <button className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors">
              <HelpCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </button>
            <button className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-white font-semibold text-xs">
              DW
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Sidebar Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-4 pt-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveSidebarTab('unread')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'unread'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setActiveSidebarTab('recents')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'recents'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Recents
                </button>
                <button
                  onClick={() => setActiveSidebarTab('starred')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'starred'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Starred
                </button>
                <button
                  onClick={() => setActiveSidebarTab('all')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSidebarTab === 'all'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <Filter className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results Count and Sort */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">0 RESULTS</span>
              <select className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option>Latest-All</option>
                <option>Oldest First</option>
                <option>Newest First</option>
              </select>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-auto">
              {/* Empty State */}
              <div className="flex flex-col items-center justify-center h-full py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <div className="relative">
                    <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute -bottom-1 -right-1" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  No unread conversations found
                </p>
              </div>
            </div>
          </div>

          {/* Main Content - Split View */}
          <div className="flex-1 flex">
            {/* Left: Conversation View */}
            <div className="flex-1 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  <div className="relative">
                    <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute -bottom-1 -right-1" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No conversation selected
                </p>
              </div>
            </div>

            {/* Right: Contact/Details View */}
            <div className="w-80 bg-white dark:bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  <div className="relative">
                    <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute -bottom-1 -right-1" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No contact selected
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

