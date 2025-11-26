'use client'

import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { 
  Facebook, 
  Instagram, 
  Linkedin, 
  Youtube, 
  Twitter, 
  Calendar as CalendarIcon,
  Upload,
  RefreshCw,
  Rss,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Heart,
  MessageCircle,
  Share2,
  Plus,
  Clock,
  Repeat,
  ArrowRight
} from 'lucide-react'

type MarketingTab = 'social-planner' | 'emails' | 'snippets' | 'countdown-timers' | 'trigger-links' | 'affiliate-manager' | 'brand-boards' | 'ad-manager'

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('social-planner')

  const tabs = [
    { id: 'social-planner' as MarketingTab, label: 'Social Planner' },
    { id: 'emails' as MarketingTab, label: 'Emails' },
    { id: 'snippets' as MarketingTab, label: 'Snippets' },
    { id: 'countdown-timers' as MarketingTab, label: 'Countdown Timers' },
    { id: 'trigger-links' as MarketingTab, label: 'Trigger Links' },
    { id: 'affiliate-manager' as MarketingTab, label: 'Affiliate Manager' },
    { id: 'brand-boards' as MarketingTab, label: 'Brand Boards' },
    { id: 'ad-manager' as MarketingTab, label: 'Ad Manager' }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'social-planner' && <SocialPlannerContent />}
        {activeTab === 'emails' && <div className="p-8 text-center text-gray-500">Emails feature coming soon...</div>}
        {activeTab === 'snippets' && <div className="p-8 text-center text-gray-500">Snippets feature coming soon...</div>}
        {activeTab === 'countdown-timers' && <div className="p-8 text-center text-gray-500">Countdown Timers feature coming soon...</div>}
        {activeTab === 'trigger-links' && <div className="p-8 text-center text-gray-500">Trigger Links feature coming soon...</div>}
        {activeTab === 'affiliate-manager' && <div className="p-8 text-center text-gray-500">Affiliate Manager feature coming soon...</div>}
        {activeTab === 'brand-boards' && <div className="p-8 text-center text-gray-500">Brand Boards feature coming soon...</div>}
        {activeTab === 'ad-manager' && <div className="p-8 text-center text-gray-500">Ad Manager feature coming soon...</div>}
      </div>
    </DashboardLayout>
  )
}

function SocialPlannerContent() {
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([])

  const socialPlatforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-br from-purple-600 to-pink-600' },
    { id: 'threads', name: 'Threads', icon: Twitter, color: 'bg-black' },
    { id: 'gbp', name: 'GBP', icon: ImageIcon, color: 'bg-blue-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
    { id: 'tiktok', name: 'TikTok', icon: Youtube, color: 'bg-black' },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-600' },
    { id: 'pinterest', name: 'Pinterest', icon: ImageIcon, color: 'bg-red-500' },
    { id: 'community', name: 'Community', icon: MessageCircle, color: 'bg-gray-600' },
    { id: 'bluesky', name: 'Bluesky', icon: Twitter, color: 'bg-blue-500' }
  ]

  const toggleAccount = (accountId: string) => {
    setConnectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }

  return (
    <div className="space-y-8">
      {/* Top Section: Calendar Overview and Post Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Social Media Calendar Overview */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Grow faster with a smarter social media calendar
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Keep your social presence active by publishing posts across multiple social media networks at once!
            </p>
          </div>

          {/* Social Account Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Select the social accounts you want to connect
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {socialPlatforms.map((platform) => {
                const Icon = platform.icon
                const isConnected = connectedAccounts.includes(platform.id)
                return (
                  <button
                    key={platform.id}
                    onClick={() => toggleAccount(platform.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                      isConnected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded flex items-center justify-center mb-2 ${platform.color} text-white`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 text-center">{platform.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Schedule Posts Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Save time by scheduling posts</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Keep your social channels active by scheduling posts!
                </p>
              </div>
              <button className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                <span>Schedule Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Social Post Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Spark Aesthetics</h3>
          </div>
          
          {/* Post Image */}
          <div className="relative mb-4">
            <div className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-gray-400" />
            </div>
            
            {/* Suggestions Overlay */}
            <div className="absolute top-4 left-4 space-y-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-[200px] border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  Confused with content? Use content Planner AI
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-[200px] border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  Do not want to post today? Schedule a Post
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-[200px] border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  Posting on multiple platforms? Try bulk Posting
                </p>
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Heart className="w-4 h-4" />
              <span>1,246</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircle className="w-4 h-4" />
              <span>568</span>
            </div>
            <div className="flex items-center space-x-1">
              <Share2 className="w-4 h-4" />
              <span>120</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Management Features */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Content Management Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Bulk Scheduling with CSV */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">20+</span>
                </div>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Bulk Scheduling with CSV</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Import and schedule multiple posts at once using CSV files for efficient content management.
            </p>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
              Upload A CSV
            </button>
          </div>

          {/* Evergreen Queue Post */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-center mb-4 space-x-2">
              <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
              <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Evergreen Queue Post</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create a library of timeless content that automatically recycles to keep your feed fresh.
            </p>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
              Create Evergreen Post
            </button>
          </div>

          {/* Recurring Post */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Recurring Post</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set up posts that automatically repeat on a schedule to maintain consistent engagement.
            </p>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
              Create Recurring Post
            </button>
          </div>

          {/* Generate Feed from RSS Post */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center relative">
                <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] px-1 rounded">Best Seller</div>
                <div className="text-center">
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Pottery Set</div>
                  <div className="text-xs text-gray-500 line-through">$49.99</div>
                  <div className="text-xs font-bold text-red-600">$25.99</div>
                </div>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Generate Feed from RSS Post</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Automatically create and share posts from your favorite RSS feeds to stay current.
            </p>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
              Create RSS Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

