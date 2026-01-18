'use client'

import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/lib/utils'
import { Icon } from '@iconify/react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Percent,
  RefreshCw,
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

interface MetricCard {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  gradient: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  iconify?: string
  bgColor?: string
  txtColor?: string
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
  const [metrics, setMetrics] = useState<MetricCard[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const previousDataRef = useRef<Record<string, number>>({})
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
      
      // Fetch all leads with retry logic
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

      const total = allLeads?.length || 0
      const active = allLeads?.filter(l => l.active === true).length || 0
      const expired = allLeads?.filter(l => 
        l.status && (l.status.toLowerCase().includes('expired') || 
        l.status.toLowerCase().includes('sold') || 
        l.status.toLowerCase().includes('off market'))
      ).length || 0
      
      // Fetch probate leads with error handling
      let probate = 0
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
        const probateResponse = await fetch('/api/probate-leads', { 
          cache: 'no-store',
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (probateResponse.ok) {
          const probateData = await probateResponse.json()
          probate = probateData?.leads?.length || 0
        }
      } catch (err) {
        console.warn('Error fetching probate leads:', err)
      }

      // Calculate enriched count
      const enriched = allLeads?.filter(l => 
        (l.ai_investment_score !== null && l.ai_investment_score !== undefined) ||
        l.agent_email || l.agent_phone || l.agent_name
      ).length || 0

      // Calculate total value with validation
      const totalValue = allLeads?.reduce((sum, l) => {
        const price = typeof l.list_price === 'number' ? l.list_price : parseFloat(l.list_price || '0') || 0
        return sum + price
      }, 0) || 0
      const avgValue = total > 0 ? Math.round(totalValue / total) : 0

      // Fetch deals for CRM metrics
      let deals: any[] = []
      try {
        const { data: dealsData, error: dealsError } = await supabase
          .from('deals')
          .select('id, stage, value, created_at, updated_at')
          .order('created_at', { ascending: false })
        
        if (!dealsError && dealsData) {
          deals = dealsData
        }
      } catch (err) {
        console.warn('Error fetching deals:', err)
      }

      // Calculate CRM metrics
      const activeDeals = deals?.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length || 0
      const pipelineValue = deals?.reduce((sum, d) => {
        const value = typeof d.value === 'number' ? d.value : parseFloat(d.value?.toString() || '0') || 0
        return sum + value
      }, 0) || 0
      const closedDeals = deals?.filter(d => d.stage === 'closed_won').length || 0
      const totalDeals = deals?.length || 0
      const conversionRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0

      // Calculate trends from previous data
      const previous = previousDataRef.current
      const calculateTrend = (current: number, previous: number): { change: string; trend: 'up' | 'down' | 'neutral' } => {
        if (!previous || previous === 0) {
          return { change: '', trend: 'neutral' }
        }
        const percentChange = Math.round(((current - previous) / previous) * 100)
        if (Math.abs(percentChange) < 1) {
          return { change: '', trend: 'neutral' }
        }
        return {
          change: `${percentChange > 0 ? '+' : ''}${percentChange}%`,
          trend: percentChange > 0 ? 'up' : 'down'
        }
      }

      const totalTrend = calculateTrend(total, previous.total || 0)
      const activeTrend = calculateTrend(active, previous.active || 0)
      const enrichedTrend = calculateTrend(enriched, previous.enriched || 0)
      const avgValueTrend = calculateTrend(avgValue, previous.avgValue || 0)
      const expiredTrend = calculateTrend(expired, previous.expired || 0)
      const probateTrend = calculateTrend(probate, previous.probate || 0)

      // Calculate CRM trends
      const activeDealsTrend = calculateTrend(activeDeals, previous.activeDeals || 0)
      const pipelineValueTrend = calculateTrend(pipelineValue, previous.pipelineValue || 0)
      const conversionRateTrend = calculateTrend(conversionRate, previous.conversionRate || 0)

      // Store current data for next trend calculation
      previousDataRef.current = {
        total,
        active,
        enriched,
        avgValue,
        expired,
        probate,
        activeDeals,
        pipelineValue,
        conversionRate
      }

      setMetrics([
        {
          label: 'Total Prospects',
          value: total.toLocaleString(),
          icon: Users,
          color: 'text-blue-400',
          gradient: 'from-blue-500 to-cyan-500',
          change: totalTrend.change,
          trend: totalTrend.trend,
          iconify: 'tabler:users',
          bgColor: 'lightprimary',
          txtColor: 'primary'
        },
        {
          label: 'Active Listings',
          value: active.toLocaleString(),
          icon: Building2,
          color: 'text-green-400',
          gradient: 'from-green-500 to-emerald-500',
          change: activeTrend.change,
          trend: activeTrend.trend,
          iconify: 'tabler:building',
          bgColor: 'lightsuccess',
          txtColor: 'success'
        },
        {
          label: 'Enriched Leads',
          value: enriched.toLocaleString(),
          icon: Sparkles,
          color: 'text-purple-400',
          gradient: 'from-purple-500 to-indigo-500',
          change: enrichedTrend.change,
          trend: enrichedTrend.trend,
          iconify: 'tabler:sparkles',
          bgColor: 'lightsecondary',
          txtColor: 'secondary'
        },
        {
          label: 'Avg Property Value',
          value: `$${(avgValue / 1000).toFixed(0)}K`,
          icon: DollarSign,
          color: 'text-orange-400',
          gradient: 'from-orange-500 to-red-500',
          change: avgValueTrend.change,
          trend: avgValueTrend.trend,
          iconify: 'tabler:currency-dollar',
          bgColor: 'lightwarning',
          txtColor: 'warning'
        },
        {
          label: 'Expired Listings',
          value: expired.toLocaleString(),
          icon: Clock,
          color: 'text-red-400',
          gradient: 'from-red-500 to-pink-500',
          change: expiredTrend.change,
          trend: expiredTrend.trend,
          iconify: 'tabler:clock',
          bgColor: 'lighterror',
          txtColor: 'error'
        },
        {
          label: 'Probate Leads',
          value: probate.toLocaleString(),
          icon: FileText,
          color: 'text-indigo-400',
          gradient: 'from-indigo-500 to-purple-500',
          change: probateTrend.change,
          trend: probateTrend.trend,
          iconify: 'tabler:file-text',
          bgColor: 'lightinfo',
          txtColor: 'info'
        },
        {
          label: 'Active Deals',
          value: activeDeals.toLocaleString(),
          icon: Briefcase,
          color: 'text-blue-400',
          gradient: 'from-blue-500 to-cyan-500',
          change: activeDealsTrend.change,
          trend: activeDealsTrend.trend,
          iconify: 'tabler:briefcase',
          bgColor: 'lightprimary',
          txtColor: 'primary'
        },
        {
          label: 'Pipeline Value',
          value: `$${(pipelineValue / 1000).toFixed(0)}K`,
          icon: DollarSign,
          color: 'text-green-400',
          gradient: 'from-green-500 to-emerald-500',
          change: pipelineValueTrend.change,
          trend: pipelineValueTrend.trend,
          iconify: 'tabler:currency-dollar',
          bgColor: 'lightsuccess',
          txtColor: 'success'
        },
        {
          label: 'Conversion Rate',
          value: `${conversionRate}%`,
          icon: Percent,
          color: 'text-purple-400',
          gradient: 'from-purple-500 to-indigo-500',
          change: conversionRateTrend.change,
          trend: conversionRateTrend.trend,
          iconify: 'tabler:percentage',
          bgColor: 'lightsecondary',
          txtColor: 'secondary'
        }
      ])

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

  const handleManualRefresh = () => {
    fetchDashboardData(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your prospects, campaigns, and deals in one place
        </p>
      </div>

      {/* Metrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Key Metrics</h2>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push('/dashboard/prospect-enrich')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3 2xl:gap-7.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-7.5 animate-pulse">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-3 2xl:gap-7.5">
            {metrics.map((metric, index) => {
              const badgeVariant = metric.trend === 'up' ? 'lightSuccess' : metric.trend === 'down' ? 'lightError' : 'gray'
              return (
                <div 
                  key={metric.label} 
                  className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card md:p-6 xl:p-7.5 cursor-pointer hover:shadow-lg transition-shadow" 
                  onClick={() => router.push('/dashboard/prospect-enrich')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-heading-6 font-bold text-dark dark:text-white">
                          {metric.value}
                        </h3>
                        <p className="text-sm font-medium text-dark-6 dark:text-gray-400">
                          {metric.label}
                        </p>
                      </div>
                      {metric.change && (
                        <div>
                          <Badge variant={badgeVariant} className="rounded-md text-sm">
                            {metric.trend === 'down' && <Icon icon="tabler:chevron-down" className="text-lg shrink-0 inline-block me-1" />}
                            {metric.trend === 'up' && <Icon icon="tabler:chevron-up" className="text-lg shrink-0 inline-block me-1" />}
                            {metric.change}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "p-3 rounded-lg",
                      metric.bgColor === 'lightprimary' && "bg-lightprimary text-primary",
                      metric.bgColor === 'lightsuccess' && "bg-lightsuccess text-success",
                      metric.bgColor === 'lightwarning' && "bg-lightwarning text-warning",
                      metric.bgColor === 'lighterror' && "bg-lighterror text-error",
                      metric.bgColor === 'lightinfo' && "bg-lightinfo text-info",
                      metric.bgColor === 'lightsecondary' && "bg-lightsecondary text-secondary",
                      !metric.bgColor && "bg-lightprimary text-primary"
                    )}>
                      <Icon icon={metric.iconify || 'tabler:chart'} width={24} height={24} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
