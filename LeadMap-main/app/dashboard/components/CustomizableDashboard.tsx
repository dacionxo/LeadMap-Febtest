'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Settings2, Save, RefreshCw } from 'lucide-react'
import { availableWidgets, WidgetContainer, DashboardWidget } from './DashboardWidgets'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useApp } from '@/app/providers'

export default function CustomizableDashboard() {
  const { profile } = useApp()
  const supabase = useMemo(() => createClientComponentClient(), [])
  const [isEditMode, setIsEditMode] = useState(false)
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>([])
  const [widgetPositions, setWidgetPositions] = useState<Record<string, number>>({})
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [widgetData, setWidgetData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const previousDataRef = useRef<Record<string, any>>({})
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-refresh every 5 minutes
  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

  useEffect(() => {
    if (profile?.id) {
      loadDashboardConfig()
      fetchWidgetData()
      
      // Set up auto-refresh
      autoRefreshIntervalRef.current = setInterval(() => {
        fetchWidgetData(true) // Silent refresh
      }, AUTO_REFRESH_INTERVAL)
    }
    
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Set up real-time subscription for listings
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel('dashboard-listings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings'
        },
        () => {
          // Refresh data when listings change
          fetchWidgetData(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, supabase])

  const fetchWidgetData = async (silent = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    try {
      if (!silent) {
        setLoading(true)
        setRefreshing(true)
      }
      setError(null)
      
      if (!profile?.id) {
        throw new Error('User profile not available')
      }

      // Check if user has real data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('has_real_data')
        .eq('id', profile.id)
        .single()

      if (userError && userError.code !== 'PGRST116') throw userError // PGRST116 is "not found", which is ok

      const hasRealData = userData?.has_real_data || false

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

      // Fetch contacts and deals for real data
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, status, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (contactsError) console.warn('Error fetching contacts:', contactsError)

      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, stage, value, created_at, updated_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (dealsError) console.warn('Error fetching deals:', dealsError)

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, created_at')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5)

      if (tasksError) console.warn('Error fetching tasks:', tasksError)

      // Calculate metrics with validation
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

      // Calculate real CRM metrics
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

      // Get recent activities from real data
      const recentActivities: any[] = []
      if (hasRealData) {
        // Get recent contacts
        const recentContacts = contacts?.slice(0, 2).map(c => ({
          id: `contact-${c.id}`,
          type: 'contact',
          title: 'New contact added',
          description: `Contact added to CRM`,
          time: new Date(c.created_at).toLocaleDateString(),
          iconType: 'users'
        })) || []

        // Get recent deals
        const recentDeals = deals?.slice(0, 1).map(d => ({
          id: `deal-${d.id}`,
          type: 'deal',
          title: 'Deal updated',
          description: `Deal moved to ${d.stage}`,
          time: new Date(d.created_at).toLocaleDateString(),
          iconType: 'target'
        })) || []

        recentActivities.push(...recentContacts, ...recentDeals)
      }

      // Calculate trends
      const totalTrend = calculateTrend(total, previous.total || 0)
      const activeTrend = calculateTrend(active, previous.active || 0)
      const enrichedTrend = calculateTrend(enriched, previous.enriched || 0)
      const avgValueTrend = calculateTrend(avgValue, previous.avgValue || 0)
      const expiredTrend = calculateTrend(expired, previous.expired || 0)
      const probateTrend = calculateTrend(probate, previous.probate || 0)
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

      // Set widget data - use real data if available, otherwise show sample data
      setWidgetData({
        'total-prospects': { value: total, change: totalTrend.change, trend: totalTrend.trend },
        'active-listings': { value: active, change: activeTrend.change, trend: activeTrend.trend },
        'enriched-leads': { value: enriched, change: enrichedTrend.change, trend: enrichedTrend.trend },
        'avg-property-value': { value: `$${(avgValue / 1000).toFixed(0)}K`, change: avgValueTrend.change, trend: avgValueTrend.trend },
        'expired-listings': { value: expired, change: expiredTrend.change, trend: expiredTrend.trend },
        'probate-leads': { value: probate, change: probateTrend.change, trend: probateTrend.trend },
        'active-deals': { value: activeDeals, change: activeDealsTrend.change, trend: activeDealsTrend.trend },
        'pipeline-value': { value: `$${(pipelineValue / 1000).toFixed(0)}K`, change: pipelineValueTrend.change, trend: pipelineValueTrend.trend },
        'conversion-rate': { value: `${conversionRate}%`, change: conversionRateTrend.change, trend: conversionRateTrend.trend },
        'recent-activity': hasRealData && recentActivities.length > 0 ? recentActivities : [
          {
            id: '1',
            type: 'enrichment',
            title: 'Lead enrichment completed',
            description: '25 leads enriched with contact information',
            time: '2 hours ago',
            iconType: 'sparkles'
          },
          {
            id: '2',
            type: 'campaign',
            title: 'Campaign launched',
            description: 'Expired listings outreach campaign started',
            time: '5 hours ago',
            iconType: 'target'
          },
          {
            id: '3',
            type: 'lead',
            title: 'New prospects added',
            description: `${total} new property listings imported`,
            time: '1 day ago',
            iconType: 'users'
          }
        ],
        'upcoming-tasks': tasks && tasks.length > 0 ? tasks.map(t => ({
          id: t.id,
          title: t.title || 'Untitled Task',
          due: t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date',
          priority: t.priority
        })) : [],
        'pipeline-funnel': hasRealData && deals && deals.length > 0 ? {
          stages: [
            { name: 'New', value: deals.filter(d => d.stage === 'new').length, percentage: 100 },
            { name: 'Contacted', value: deals.filter(d => d.stage === 'contacted').length, percentage: Math.round((deals.filter(d => d.stage === 'contacted').length / deals.length) * 100) },
            { name: 'Qualified', value: deals.filter(d => d.stage === 'qualified').length, percentage: Math.round((deals.filter(d => d.stage === 'qualified').length / deals.length) * 100) },
            { name: 'Proposal', value: deals.filter(d => d.stage === 'proposal').length, percentage: Math.round((deals.filter(d => d.stage === 'proposal').length / deals.length) * 100) },
            { name: 'Closed', value: deals.filter(d => ['closed_won', 'closed_lost'].includes(d.stage)).length, percentage: Math.round((deals.filter(d => ['closed_won', 'closed_lost'].includes(d.stage)).length / deals.length) * 100) }
          ]
        } : {
          stages: [
            { name: 'New Leads', value: total, percentage: 100 },
            { name: 'Contacted', value: Math.round(total * 0.6), percentage: 60 },
            { name: 'Qualified', value: Math.round(total * 0.3), percentage: 30 },
            { name: 'Proposal', value: Math.round(total * 0.13), percentage: 13 },
            { name: 'Closed', value: Math.round(total * 0.05), percentage: 5 }
          ]
        },
        'deal-stage-distribution': hasRealData && deals && deals.length > 0 ? {
          stages: [
            { name: 'New', value: deals.filter(d => d.stage === 'new').length, color: 'bg-blue-500' },
            { name: 'Contacted', value: deals.filter(d => d.stage === 'contacted').length, color: 'bg-purple-500' },
            { name: 'Qualified', value: deals.filter(d => d.stage === 'qualified').length, color: 'bg-green-500' },
            { name: 'Proposal', value: deals.filter(d => d.stage === 'proposal').length, color: 'bg-orange-500' }
          ]
        } : {
          stages: [
            { name: 'New', value: 45, color: 'bg-blue-500' },
            { name: 'Contacted', value: 30, color: 'bg-purple-500' },
            { name: 'Qualified', value: 20, color: 'bg-green-500' },
            { name: 'Proposal', value: 5, color: 'bg-orange-500' }
          ]
        },
        'lead-source-report': {
          sources: [
            { name: 'Expired Listings', count: expired, percentage: expired > 0 ? Math.round((expired / total) * 100) : 0 },
            { name: 'Probate Leads', count: probate, percentage: probate > 0 ? Math.round((probate / total) * 100) : 0 },
            { name: 'Geo Leads', count: Math.round(total * 0.2), percentage: 20 },
            { name: 'Property Listings', count: active, percentage: active > 0 ? Math.round((active / total) * 100) : 0 },
            { name: 'Other', count: Math.round(total * 0.1), percentage: 10 }
          ]
        },
        'manual-actions': {
          phone: 0,
          sms: 0,
          email: 0,
          total: 0
        },
        'sales-efficiency': {
          avgResponseTime: '2.5h',
          conversionRate: '12%',
          avgDealSize: '$45K',
          salesCycle: '28 days'
        }
      })

    } catch (error: any) {
      console.error('Error fetching widget data:', error)
      setError(error?.message || 'Failed to load dashboard data. Please try refreshing.')
      // Don't clear widget data on error, keep showing previous data
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastUpdated(new Date())
      fetchingRef.current = false
    }
  }

  const handleManualRefresh = () => {
    fetchWidgetData(false)
  }

  const loadDashboardConfig = async () => {
    if (!profile?.id) return

    try {
      // Try to load from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('dashboard_config')
        .eq('id', profile.id)
        .single()

      if (!error && data?.dashboard_config) {
        const config = data.dashboard_config
        setEnabledWidgets(config.enabledWidgets || [])
        setWidgetPositions(config.positions || {})
      } else {
        // Default configuration
        const defaultWidgets = availableWidgets
          .filter(w => w.defaultEnabled)
          .map(w => w.id)
        setEnabledWidgets(defaultWidgets)
      }
    } catch (error) {
      console.error('Error loading dashboard config:', error)
      // Fallback to defaults
      const defaultWidgets = availableWidgets
        .filter(w => w.defaultEnabled)
        .map(w => w.id)
      setEnabledWidgets(defaultWidgets)
    }
  }

  const saveDashboardConfig = async () => {
    if (!profile?.id) return

    try {
      const config = {
        enabledWidgets,
        positions: widgetPositions,
        updatedAt: new Date().toISOString()
      }

      const { error } = await supabase
        .from('users')
        .update({ dashboard_config: config })
        .eq('id', profile.id)

      if (error) throw error
      
      setIsEditMode(false)
      setShowAddWidget(false)
    } catch (error) {
      console.error('Error saving dashboard config:', error)
      alert('Failed to save dashboard configuration')
    }
  }

  const addWidget = (widgetId: string) => {
    if (!enabledWidgets.includes(widgetId)) {
      setEnabledWidgets([...enabledWidgets, widgetId])
    }
    setShowAddWidget(false)
  }

  const removeWidget = (widgetId: string) => {
    setEnabledWidgets(enabledWidgets.filter(id => id !== widgetId))
    const newPositions = { ...widgetPositions }
    delete newPositions[widgetId]
    setWidgetPositions(newPositions)
  }

  const getEnabledWidgets = () => {
    return availableWidgets
      .filter(w => enabledWidgets.includes(w.id))
      .sort((a, b) => {
        const posA = widgetPositions[a.id] ?? 999
        const posB = widgetPositions[b.id] ?? 999
        return posA - posB
      })
  }

  const getAvailableWidgets = () => {
    return availableWidgets.filter(w => !enabledWidgets.includes(w.id))
  }

  return (
    <div className="space-y-6">
      {/* Header with Edit Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <p className="text-gray-600 dark:text-gray-400">
              Track your prospects, campaigns, and deals in one place. Customize your dashboard to see what matters most.
            </p>
            {lastUpdated && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {isEditMode ? (
            <>
              <button
                onClick={() => setShowAddWidget(!showAddWidget)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              >
                <Plus className="w-4 h-4" />
                <span>Add Widget</span>
              </button>
              <button
                onClick={saveDashboardConfig}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false)
                  setShowAddWidget(false)
                  loadDashboardConfig()
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
            >
              <Settings2 className="w-4 h-4" />
              <span>Customize</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Widget Dropdown */}
      {showAddWidget && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Widget</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {getAvailableWidgets().map(widget => (
              <button
                key={widget.id}
                onClick={() => addWidget(widget.id)}
                className="p-3 text-left bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <widget.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{widget.title}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{widget.category}</span>
              </button>
            ))}
          </div>
          {getAvailableWidgets().length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              All available widgets are already added
            </p>
          )}
        </div>
      )}

      {/* Widgets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getEnabledWidgets().map(widget => (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              onRemove={isEditMode ? removeWidget : undefined}
              isEditable={isEditMode}
              data={widgetData[widget.id]}
            />
          ))}
        </div>
      )}

      {getEnabledWidgets().length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No widgets added yet</p>
          {isEditMode ? (
            <button
              onClick={() => setShowAddWidget(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Widget</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditMode(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              <span>Customize Dashboard</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

