'use client'

import { cn } from '@/app/lib/utils'
import { Icon } from '@iconify/react'
import { ElDisclosure, ElDialog, ElDropdown, ElSelect } from '@tailwindplus/elements/react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Search as SearchIcon,
  Sparkles,
  Target,
  Upload,
  Users
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  gradient: string
}


interface RecentActivity {
  id: string
  type: 'enrichment' | 'campaign' | 'deal' | 'lead'
  title: string
  description: string
  time: string
  icon: React.ComponentType<{ className?: string }>
}

const quickActions: QuickAction[] = [
  {
    id: 'prospect',
    title: 'Find Prospects',
    description: 'Discover new property leads and opportunities',
    icon: SearchIcon,
    href: '/dashboard/prospect-enrich',
    color: 'bg-blue-500',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'enrich',
    title: 'Enrich Leads',
    description: 'Add contact information and data to your leads',
    icon: Sparkles,
    href: '/dashboard/enrichment',
    color: 'bg-purple-500',
    gradient: 'from-purple-500 to-indigo-500'
  },
  {
    id: 'campaign',
    title: 'Start Campaign',
    description: 'Launch an outreach campaign to engage prospects',
    icon: Target,
    href: '/dashboard/engage',
    color: 'bg-green-500',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    id: 'import',
    title: 'Import Data',
    description: 'Upload CSV files or sync from external sources',
    icon: Upload,
    href: '/admin',
    color: 'bg-orange-500',
    gradient: 'from-orange-500 to-red-500'
  }
]

export default function DashboardContent() {
  const router = useRouter()
  const supabase = useMemo(() => createClientComponentClient(), [])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-refresh every 5 minutes
  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

  useEffect(() => {
    fetchDashboardData()
    
    // Set up auto-refresh
    autoRefreshIntervalRef.current = setInterval(() => {
      fetchDashboardData(true) // Silent refresh
    }, AUTO_REFRESH_INTERVAL)
    
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set up real-time subscription for listings
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-content-listings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings'
        },
        () => {
          // Refresh data when listings change
          fetchDashboardData(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const fetchDashboardData = async (silent = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    try {
      if (!silent) {
        setLoading(true)
        setRefreshing(true)
      }
      setError(null)
      
      // Fetch all leads for recent activities
      let allLeads: any[] = []
      let allError: any = null
      let retries = 3
      
      while (retries > 0) {
        const { data, error } = await supabase
          .from('listings')
          .select('listing_id, status, active, agent_email, agent_phone, agent_name, ai_investment_score, list_price, created_at, updated_at')
          .order('created_at', { ascending: false })
        
        if (!error) {
          allLeads = data || []
          break
        }
        allError = error
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retry
        }
      }
      
      if (allError) throw allError

      // Generate recent activities from actual data
      const activities: RecentActivity[] = []
      
      // Get recent listings (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentListings = allLeads?.filter(l => {
        const created = new Date(l.created_at)
        return created >= oneDayAgo
      }) || []
      
      if (recentListings.length > 0) {
        activities.push({
          id: 'recent-listings',
          type: 'lead',
          title: 'New prospects added',
          description: `${recentListings.length} new property listing${recentListings.length > 1 ? 's' : ''} imported`,
          time: 'Recently',
          icon: Users
        })
      }
      
      // Get recently enriched leads
      const recentEnriched = allLeads?.filter(l => {
        const hasEnrichment = (l.ai_investment_score !== null && l.ai_investment_score !== undefined) ||
          l.agent_email || l.agent_phone || l.agent_name
        if (!hasEnrichment) return false
        const updated = l.updated_at ? new Date(l.updated_at) : new Date(l.created_at)
        return updated >= oneDayAgo
      }) || []
      
      if (recentEnriched.length > 0) {
        activities.push({
          id: 'recent-enriched',
          type: 'enrichment',
          title: 'Lead enrichment completed',
          description: `${recentEnriched.length} lead${recentEnriched.length > 1 ? 's' : ''} enriched with contact information`,
          time: 'Recently',
          icon: Sparkles
        })
      }
      
      // Add default activity if no recent activity
      if (activities.length === 0) {
        activities.push({
          id: 'default',
          type: 'lead',
          title: 'Dashboard ready',
          description: 'Your dashboard is up to date',
          time: 'Just now',
          icon: CheckCircle2
        })
      }
      
      setRecentActivities(activities)

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      setError(error?.message || 'Failed to load dashboard data. Please try refreshing.')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastUpdated(new Date())
      fetchingRef.current = false
    }
  }


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard and Reporting
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your prospects, campaigns, and deals in one place
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={() => router.push(action.href)}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${action.gradient} shadow-md group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{action.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View All
            </button>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No recent activity
              </p>
            ) : (
              recentActivities.map((activity) => {
                const Icon = activity.icon
                return (
                  <div key={activity.id} className="flex items-start space-x-3 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{activity.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Overview</h2>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              7D
            </button>
            <button className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              30D
            </button>
            <button className="px-3 py-1.5 text-sm bg-blue-600 text-white border border-blue-600 rounded-lg">
              90D
            </button>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Chart visualization coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}
