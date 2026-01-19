/**
 * Customizable Dashboard V2
 * World-class dashboard with drag & drop widgets, preserving all API routes
 */

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Settings2, Save, RefreshCw, X } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useApp } from '@/app/providers'
import { availableWidgets, getWidgetDefinition } from '../widgets/registry'
import { WidgetDefinition, RefreshPolicy } from '../widgets/types'
import { WidgetGrid, LayoutItem } from '../widgets/components/WidgetGrid'

export default function CustomizableDashboardV2() {
  const { profile } = useApp()
  const supabase = useMemo(() => createClientComponentClient(), [])
  const [isEditMode, setIsEditMode] = useState(false)
  const [enabledWidgetIds, setEnabledWidgetIds] = useState<string[]>([])
  const [widgetLayouts, setWidgetLayouts] = useState<{ lg?: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] }>({})
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [widgetData, setWidgetData] = useState<Record<string, any>>({})
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>({})
  const [widgetErrors, setWidgetErrors] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullscreenWidgetId, setFullscreenWidgetId] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const previousDataRef = useRef<Record<string, any>>({})
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const widgetRefreshIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({})

  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

  // Get enabled widgets
  const enabledWidgets = useMemo(() => {
    return availableWidgets.filter(w => enabledWidgetIds.includes(w.id))
  }, [enabledWidgetIds])

  useEffect(() => {
    if (profile?.id) {
      loadDashboardConfig()
      fetchWidgetData()
      
      // Set up global auto-refresh
      autoRefreshIntervalRef.current = setInterval(() => {
        fetchWidgetData(true)
      }, AUTO_REFRESH_INTERVAL)
    }
    
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
      // Clear all widget-specific refresh intervals
      Object.values(widgetRefreshIntervalsRef.current).forEach(interval => {
        clearInterval(interval)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Set up per-widget refresh intervals based on refresh policies
  useEffect(() => {
    // Clear existing intervals
    Object.values(widgetRefreshIntervalsRef.current).forEach(interval => {
      clearInterval(interval)
    })
    widgetRefreshIntervalsRef.current = {}

    // Set up new intervals for each widget
    enabledWidgets.forEach(widget => {
      const refreshPolicy = widget.refreshPolicy || 'inherit'
      if (refreshPolicy === 'realtime' || refreshPolicy === 'manual') {
        return // Skip for realtime (handled by subscriptions) or manual
      }

      const intervalMs = getRefreshIntervalMs(refreshPolicy)
      if (intervalMs) {
        widgetRefreshIntervalsRef.current[widget.id] = setInterval(() => {
          refreshWidgetData(widget.id)
        }, intervalMs)
      }
    })

    return () => {
      Object.values(widgetRefreshIntervalsRef.current).forEach(interval => {
        clearInterval(interval)
      })
      widgetRefreshIntervalsRef.current = {}
    }
  }, [enabledWidgets])

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
          fetchWidgetData(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, supabase])

  // Main data fetching function (PRESERVED from original)
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

      if (userError && userError.code !== 'PGRST116') throw userError

      const hasRealData = userData?.has_real_data || false

      // Fetch all leads with retry logic (PRESERVED)
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
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      if (allError) throw allError

      // Fetch contacts and deals (PRESERVED)
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, status, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      const { data: deals } = await supabase
        .from('deals')
        .select('id, stage, value, created_at, updated_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, created_at')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5)

      // Calculate metrics (PRESERVED)
      const total = allLeads?.length || 0
      const active = allLeads?.filter(l => l.active === true).length || 0
      const expired = allLeads?.filter(l => 
        l.status && (l.status.toLowerCase().includes('expired') || 
        l.status.toLowerCase().includes('sold') || 
        l.status.toLowerCase().includes('off market'))
      ).length || 0
      
      // Fetch probate leads (PRESERVED)
      let probate = 0
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
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

      const enriched = allLeads?.filter(l => 
        (l.ai_investment_score !== null && l.ai_investment_score !== undefined) ||
        l.agent_email || l.agent_phone || l.agent_name
      ).length || 0

      const totalValue = allLeads?.reduce((sum, l) => {
        const price = typeof l.list_price === 'number' ? l.list_price : parseFloat(l.list_price || '0') || 0
        return sum + price
      }, 0) || 0
      const avgValue = total > 0 ? Math.round(totalValue / total) : 0

      const activeDeals = deals?.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length || 0
      const pipelineValue = deals?.reduce((sum, d) => {
        const value = typeof d.value === 'number' ? d.value : parseFloat(d.value?.toString() || '0') || 0
        return sum + value
      }, 0) || 0
      const closedDeals = deals?.filter(d => d.stage === 'closed_won').length || 0
      const totalDeals = deals?.length || 0
      const conversionRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0

      // Calculate trends (PRESERVED)
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
      const activeDealsTrend = calculateTrend(activeDeals, previous.activeDeals || 0)
      const pipelineValueTrend = calculateTrend(pipelineValue, previous.pipelineValue || 0)
      const conversionRateTrend = calculateTrend(conversionRate, previous.conversionRate || 0)

      previousDataRef.current = {
        total, active, enriched, avgValue, expired, probate,
        activeDeals, pipelineValue, conversionRate
      }

      // Set widget data (PRESERVED logic, adapted for new system)
      const newWidgetData: Record<string, any> = {
        'total-prospects': { 
          value: total, 
          formattedValue: total.toLocaleString(),
          change: totalTrend.change, 
          trend: totalTrend.trend 
        },
        'active-listings': { 
          value: active, 
          formattedValue: active.toLocaleString(),
          change: activeTrend.change, 
          trend: activeTrend.trend 
        },
        'enriched-leads': { 
          value: enriched, 
          formattedValue: enriched.toLocaleString(),
          change: enrichedTrend.change, 
          trend: enrichedTrend.trend 
        },
        'avg-property-value': { 
          value: avgValue, 
          formattedValue: `$${(avgValue / 1000).toFixed(0)}K`,
          change: avgValueTrend.change, 
          trend: avgValueTrend.trend 
        },
        'expired-listings': { 
          value: expired, 
          formattedValue: expired.toLocaleString(),
          change: expiredTrend.change, 
          trend: expiredTrend.trend 
        },
        'probate-leads': { 
          value: probate, 
          formattedValue: probate.toLocaleString(),
          change: probateTrend.change, 
          trend: probateTrend.trend 
        },
        'active-deals': { 
          value: activeDeals, 
          formattedValue: activeDeals.toLocaleString(),
          change: activeDealsTrend.change, 
          trend: activeDealsTrend.trend 
        },
        'pipeline-value': { 
          value: pipelineValue, 
          formattedValue: `$${(pipelineValue / 1000).toFixed(0)}K`,
          change: pipelineValueTrend.change, 
          trend: pipelineValueTrend.trend 
        },
        'conversion-rate': { 
          value: conversionRate, 
          formattedValue: `${conversionRate}%`,
          change: conversionRateTrend.change, 
          trend: conversionRateTrend.trend 
        },
        'recent-activity': hasRealData && contacts && contacts.length > 0 ? 
          contacts.slice(0, 5).map((c: any) => ({
            id: `contact-${c.id}`,
            type: 'contact',
            title: 'New contact added',
            description: 'Contact added to CRM',
            time: new Date(c.created_at).toLocaleDateString(),
            icon: 'tabler:users'
          })) : [],
        'upcoming-tasks': tasks && tasks.length > 0 ? tasks.map((t: any) => ({
          id: t.id,
          title: t.title || 'Untitled Task',
          due: t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date',
          priority: t.priority
        })) : [],
        'pipeline-funnel': deals && deals.length > 0 ? {
          stages: [
            { name: 'New', value: deals.filter((d: any) => d.stage === 'new').length },
            { name: 'Contacted', value: deals.filter((d: any) => d.stage === 'contacted').length },
            { name: 'Qualified', value: deals.filter((d: any) => d.stage === 'qualified').length },
            { name: 'Proposal', value: deals.filter((d: any) => d.stage === 'proposal').length },
            { name: 'Closed', value: deals.filter((d: any) => ['closed_won', 'closed_lost'].includes(d.stage)).length }
          ]
        } : { stages: [] },
        'deal-stage-distribution': deals && deals.length > 0 ? {
          stages: [
            { name: 'New', value: deals.filter((d: any) => d.stage === 'new').length },
            { name: 'Contacted', value: deals.filter((d: any) => d.stage === 'contacted').length },
            { name: 'Qualified', value: deals.filter((d: any) => d.stage === 'qualified').length },
            { name: 'Proposal', value: deals.filter((d: any) => d.stage === 'proposal').length }
          ]
        } : { stages: [] }
      }

      setWidgetData(newWidgetData)
      setWidgetLoading({})
      setWidgetErrors({})

    } catch (error: any) {
      console.error('Error fetching widget data:', error)
      setError(error?.message || 'Failed to load dashboard data. Please try refreshing.')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastUpdated(new Date())
      fetchingRef.current = false
    }
  }

  const refreshWidgetData = async (widgetId: string) => {
    setWidgetLoading(prev => ({ ...prev, [widgetId]: true }))
    try {
      await fetchWidgetData(true)
    } finally {
      setWidgetLoading(prev => ({ ...prev, [widgetId]: false }))
    }
  }

  const loadDashboardConfig = async () => {
    if (!profile?.id) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('dashboard_config')
        .eq('id', profile.id)
        .single()

      if (!error && data?.dashboard_config) {
        const config = data.dashboard_config
        setEnabledWidgetIds(config.enabledWidgets || [])
        setWidgetLayouts(config.layouts || {})
      } else {
        // Default configuration
        const defaultWidgets = availableWidgets
          .filter(w => w.defaultEnabled)
          .map(w => w.id)
        setEnabledWidgetIds(defaultWidgets)
      }
    } catch (error) {
      console.error('Error loading dashboard config:', error)
      const defaultWidgets = availableWidgets
        .filter(w => w.defaultEnabled)
        .map(w => w.id)
      setEnabledWidgetIds(defaultWidgets)
    }
  }

  const saveDashboardConfig = async () => {
    if (!profile?.id) return

    try {
      const config = {
        enabledWidgets: enabledWidgetIds,
        layouts: widgetLayouts,
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
    if (!enabledWidgetIds.includes(widgetId)) {
      setEnabledWidgetIds([...enabledWidgetIds, widgetId])
    }
    setShowAddWidget(false)
  }

  const removeWidget = (widgetId: string) => {
    setEnabledWidgetIds(enabledWidgetIds.filter(id => id !== widgetId))
    // Remove from layouts
    const newLayouts = { ...widgetLayouts }
    Object.keys(newLayouts).forEach(breakpoint => {
      const bp = breakpoint as keyof typeof newLayouts
      if (newLayouts[bp]) {
        newLayouts[bp] = newLayouts[bp]!.filter(
          (l: LayoutItem) => l.i !== widgetId
        )
      }
    })
    setWidgetLayouts(newLayouts)
  }

  const getAvailableWidgets = () => {
    return availableWidgets.filter(w => !enabledWidgetIds.includes(w.id))
  }

  const handleLayoutChange = (layouts: { lg?: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] }) => {
    setWidgetLayouts(layouts)
  }

  const handleManualRefresh = () => {
    fetchWidgetData(false)
  }

  const handleWidgetRefresh = (widgetId: string) => {
    refreshWidgetData(widgetId)
  }

  const getRefreshIntervalMs = (policy: RefreshPolicy): number | null => {
    switch (policy) {
      case '1m': return 60 * 1000
      case '5m': return 5 * 60 * 1000
      case '15m': return 15 * 60 * 1000
      case '30m': return 30 * 60 * 1000
      case '1h': return 60 * 60 * 1000
      case 'inherit': return AUTO_REFRESH_INTERVAL
      default: return null
    }
  }

  const isFullscreen = fullscreenWidgetId !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <p className="text-gray-600 dark:text-gray-400">
              Track your prospects, campaigns, and deals in one place.
            </p>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
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
        {!isFullscreen && (
          <div className="flex items-center space-x-3">
            {isEditMode ? (
              <>
                <button
                  onClick={() => setShowAddWidget(!showAddWidget)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Widget</span>
                </button>
                <button
                  onClick={saveDashboardConfig}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
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
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditMode(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                <span>Customize</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Widget Dropdown */}
      {showAddWidget && !isFullscreen && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Widget</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {getAvailableWidgets().map(widget => (
              <button
                key={widget.id}
                onClick={() => addWidget(widget.id)}
                className="p-3 text-left bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
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

      {/* Widget Grid */}
      {loading && !widgetData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <WidgetGrid
          widgets={enabledWidgets}
          widgetData={widgetData}
          widgetLoading={widgetLoading}
          widgetErrors={widgetErrors}
          layouts={widgetLayouts}
          isEditable={isEditMode}
          isFullscreen={isFullscreen}
          fullscreenWidgetId={fullscreenWidgetId}
          onLayoutChange={handleLayoutChange}
          onRemove={isEditMode ? removeWidget : undefined}
          onRefresh={handleWidgetRefresh}
          onSettings={(id) => console.log('Settings for widget:', id)}
          onFullscreen={setFullscreenWidgetId}
          onExitFullscreen={() => setFullscreenWidgetId(null)}
        />
      )}

      {enabledWidgets.length === 0 && !isFullscreen && (
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
