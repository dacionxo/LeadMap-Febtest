'use client'

import { Badge, BadgeProps } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Filter,
  GitBranch,
  GripVertical,
  LineChart,
  MoreVertical,
  Percent,
  PieChart,
  RefreshCw,
  Search as SearchIcon,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { LabelList, Pie, PieChart as RechartsPieChart } from 'recharts'
import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'
import 'react-funnel-pipeline/dist/index.css'
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

export interface DashboardWidget {
  id: string
  type: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType<{ widget: DashboardWidget; data?: any }>
  defaultEnabled: boolean
  category: 'metrics' | 'activity' | 'charts' | 'actions' | 'crm' | 'prospects'
  size: 'small' | 'medium' | 'large'
  position?: number
}

interface WidgetProps {
  widget: DashboardWidget
  onRemove?: (id: string) => void
  isEditable?: boolean
  data?: any
}

export function WidgetContainer({ widget, onRemove, isEditable = false, data }: WidgetProps) {
  const Icon = widget.icon

  // Components that have their own Card wrapper with title (1-to-1 TailwindAdmin match)
  const hasOwnCard = widget.id === 'recent-activity' ||
    widget.id === 'upcoming-tasks' ||
    widget.id === 'pipeline-funnel' ||
    widget.id === 'deal-stage-distribution' ||
    widget.type === 'metric' // Metric widgets have their own card styling

  return (
    <div 
      className={`relative h-full ${hasOwnCard ? '' : 'bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'} hover:shadow-lg transition-all duration-200 ${widget.size === 'large' ? 'col-span-2' : ''
      }`}
      style={hasOwnCard && widget.type === 'metric' ? { boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' } : undefined}
    >
      {isEditable && (
        <>
          <div className="absolute top-2 left-2 cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10">
            <GripVertical className="w-4 h-4" />
          </div>
          {onRemove && (
            <button
              onClick={() => onRemove(widget.id)}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors z-10"
              aria-label="Remove widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </>
      )}
      {!hasOwnCard && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{widget.title}</h3>
          </div>
        </div>
      )}
      <widget.component widget={widget} data={data} />
    </div>
  )
}

// Widget Components - NextDeal Specific
function ProspectMetricsWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  const value = data?.value || 0
  const change = data?.change || '+0%'
  const trend = data?.trend || 'neutral'

  // Format trend indicator
  const getTrendText = () => {
    if (!change || change === '+0%' || trend === 'neutral') {
      return '+0% from last month'
    }
    return `${change} from last month`
  }

  // Format value based on type
  const formatValue = (val: any): string => {
    if (typeof val === 'string') {
      // Already formatted (e.g., "$42.5K", "3%")
      return val
    }
    if (typeof val === 'number') {
      return val.toLocaleString()
    }
    return String(val || '0')
  }

  const formattedValue = formatValue(value)
  const trendText = getTrendText()

  const handleFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: Implement filter functionality
    console.log('Filter clicked for', widget.title)
  }

  return (
    <div className="relative bg-white dark:bg-gray-900 rounded-lg border-[1.5px] border-teal-500 dark:border-teal-600 transition-all duration-200 overflow-hidden p-4" style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
      {/* Header Section */}
      <div className="relative flex items-center justify-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        {/* Filter button - positioned on left */}
        <button
          onClick={handleFilterClick}
          className="absolute left-0 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          aria-label="Filter"
        >
          <Filter className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Title - centered */}
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white text-center">
            {widget.title}
          </h3>
        </div>

        {/* Three-dot menu - positioned on right */}
        <div className="absolute right-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                aria-label="Widget options"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Widget Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleFilterClick}>
                <Filter className="w-4 h-4 mr-2" />
                Filter Data
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings2 className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area - Centered */}
      <div className="mt-3 text-center">
        <div className="mb-1">
          <p className="text-3xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
            {formattedValue}
          </p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {trendText}
        </p>
      </div>

      {/* Small teal dot in bottom-right corner (resize/decorative indicator) */}
      <div className="absolute bottom-3 right-3 w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full" />
    </div>
  )
}

function QuickActionsWidget({ widget }: { widget: DashboardWidget; data?: any }) {
  const router = useRouter()

  const actions = [
    { id: 'prospect', title: 'Find Prospects', description: 'Discover new property leads', icon: SearchIcon, href: '/dashboard/prospect-enrich', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'enrich', title: 'Enrich Leads', description: 'Add contact information', icon: Sparkles, href: '/dashboard/enrichment', gradient: 'from-purple-500 to-indigo-500' },
    { id: 'campaign', title: 'Start Campaign', description: 'Launch outreach campaign', icon: Target, href: '/dashboard/crm/sequences', gradient: 'from-green-500 to-emerald-500' },
    { id: 'import', title: 'Import Data', description: 'Upload CSV files', icon: Upload, href: '/admin', gradient: 'from-orange-500 to-red-500' }
  ]

  return (
    <Card className="h-full flex flex-col">
      <div className="mb-3">
        <h4 className="card-title">Quick Actions</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              onClick={() => router.push(action.href)}
              className="p-2 text-left bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${action.gradient} shadow-md group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-200" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{action.title}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">{action.description}</p>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function RecentActivityWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  // Map API data to TailwindAdmin format or use defaults
  const activitiesData = data || [
    { id: '1', type: 'enrichment', title: 'Lead enrichment completed', description: '25 leads enriched with contact information', time: '2 hours ago', icon: 'tabler:sparkles' },
    { id: '2', type: 'campaign', title: 'Campaign launched', description: 'Expired listings outreach campaign started', time: '5 hours ago', icon: 'tabler:target' },
    { id: '3', type: 'lead', title: 'New prospects added', description: '150 new property listings imported', time: '1 day ago', icon: 'tabler:users' }
  ]

  // Transform API data to match TailwindAdmin structure exactly
  const activities = activitiesData.map((activity: any) => {
    // Map icon names to iconify format if needed
    let iconName = activity.icon
    if (!iconName && activity.iconType) {
      // Map iconType to iconify format
      const iconTypeMap: Record<string, string> = {
        'users': 'tabler:users',
        'target': 'tabler:target',
        'sparkles': 'tabler:sparkles',
        'activity': 'tabler:activity',
        'mail': 'tabler:mail',
        'phone': 'tabler:phone',
        'mappin': 'tabler:map-pin',
        'calendar': 'tabler:calendar',
      }
      iconName = iconTypeMap[activity.iconType.toLowerCase()] || 'tabler:activity'
    }
    if (typeof iconName === 'string' && !iconName.startsWith('tabler:') && !iconName.startsWith('lucide:')) {
      // Convert lucide icon names to iconify format
      const iconMap: Record<string, string> = {
        'Sparkles': 'tabler:sparkles',
        'Target': 'tabler:target',
        'Users': 'tabler:users',
        'Activity': 'tabler:activity',
        'Mail': 'tabler:mail',
        'Phone': 'tabler:phone',
        'MapPin': 'tabler:map-pin',
        'Calendar': 'tabler:calendar',
      }
      iconName = iconMap[iconName] || 'tabler:activity'
    }

    // Map activity types to TailwindAdmin color classes
    const colorMap: Record<string, { bg: string; text: string }> = {
      'enrichment': { bg: 'bg-lightprimary', text: 'text-primary' },
      'campaign': { bg: 'bg-lightsuccess', text: 'text-success' },
      'lead': { bg: 'bg-lightinfo dark:bg-darkinfo', text: 'text-info' },
      'contact': { bg: 'bg-lightprimary', text: 'text-primary' },
      'deal': { bg: 'bg-lightsuccess', text: 'text-success' },
      'default': { bg: 'bg-lightprimary', text: 'text-primary' }
    }
    const colors = colorMap[activity.type] || colorMap.default

    return {
      key: activity.id?.toString() || activity.key,
      icon: iconName,
      title: activity.title,
      desc: activity.description || activity.desc || 'working on',
      time: activity.time || activity.date || '12:00 AM',
      bgColor: colors.bg,
      color: colors.text,
    }
  })

  return (
    <Card className="h-full flex flex-col rounded-xl" style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
      <div className="mb-3">
        <h4 className="card-title text-center">Recent Activity</h4>
        <p className="card-subtitle text-center">Preparation for the upcoming activity</p>
        <div className="border-b border-border dark:border-darkborder mt-3"></div>
      </div>
      <SimpleBar className="flex-1 max-h-[320px] pr-4">
        <div className="flex flex-col gap-4">
          {activities.map((item: any, i: number) => {
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.4,
                }}
                className="flex items-center justify-between"
              >
                <div className="flex gap-3 items-center">
                  <div
                    className={`h-11 w-11 rounded-full ${item.bgColor} ${item.color} flex justify-center items-center`}
                  >
                    <Icon icon={item.icon} className="text-xl" />
                  </div>
                  <div>
                    <h6 className="text-sm">{item.title}</h6>
                    <p>{item.desc}</p>
                  </div>
                </div>
                <span className="text-xs">{item.time}</span>
              </motion.div>
            )
          })}
        </div>
      </SimpleBar>
    </Card>
  )
}

function PipelineFunnelWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState<number>(400)
  const [FunnelChartComponent, setFunnelChartComponent] = useState<React.ComponentType<any> | null>(null)

  // Dynamically import FunnelChart to avoid SSR issues
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DashboardWidgets.tsx:377',message:'FunnelChart import started',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    import('react-funnel-pipeline').then((module) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DashboardWidgets.tsx:379',message:'FunnelChart imported successfully',data:{hasFunnelChart:!!module.FunnelChart},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setFunnelChartComponent(() => module.FunnelChart)
    })
  }, [])

  // Calculate chart width based on container - using ResizeObserver for proper tracking
  useEffect(() => {
    const updateWidth = () => {
      // #region agent log
      const logData1 = {location:'DashboardWidgets.tsx:386',message:'updateWidth called',data:{hasRef:!!chartContainerRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', logData1);
      fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch(()=>{});
      // #endregion
      if (chartContainerRef.current) {
        // Use clientWidth (content area) instead of offsetWidth for better accuracy
        const containerWidth = chartContainerRef.current.clientWidth
        const offsetWidth = chartContainerRef.current.offsetWidth
        const scrollWidth = chartContainerRef.current.scrollWidth
        const computedStyle = window.getComputedStyle(chartContainerRef.current)
        const paddingLeft = parseInt(computedStyle.paddingLeft) || 0
        const paddingRight = parseInt(computedStyle.paddingRight) || 0
        // Use the full clientWidth without subtracting padding (chartWidth is max-width)
        // Ensure minimum width for readability
        const newWidth = Math.max(containerWidth, 400)
        // #region agent log
        const logData2 = {location:'DashboardWidgets.tsx:394',message:'Width measurements',data:{offsetWidth,clientWidth:containerWidth,scrollWidth,paddingLeft,paddingRight,calculatedWidth:newWidth,parentWidth:chartContainerRef.current.parentElement?.clientWidth,cardWidth:chartContainerRef.current.closest('.h-full')?.clientWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
        console.log('[DEBUG] Width measurements:', logData2);
        fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
        // #endregion
        setChartWidth(newWidth)
        // #region agent log
        const logData3 = {location:'DashboardWidgets.tsx:397',message:'chartWidth state updated',data:{newWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
        console.log('[DEBUG] chartWidth updated:', logData3);
        fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
        // #endregion
      } else {
        // #region agent log
        const logData4 = {location:'DashboardWidgets.tsx:399',message:'Ref not available in updateWidth',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', logData4);
        fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(()=>{});
        // #endregion
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DashboardWidgets.tsx:404',message:'Width calculation effect mounted',data:{hasRef:!!chartContainerRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Initial call
    updateWidth()
    
    // Use ResizeObserver for proper container size tracking (Hypothesis A, B, F)
    let resizeObserver: ResizeObserver | null = null
    if (chartContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateWidth()
      })
      resizeObserver.observe(chartContainerRef.current)
    }
    
    // Fallback: setTimeout and window resize (for older browsers)
    const timeoutId1 = setTimeout(updateWidth, 100)
    const timeoutId2 = setTimeout(updateWidth, 500) // Extra delay to ensure layout is complete
    window.addEventListener('resize', updateWidth)
    
    return () => {
      if (resizeObserver && chartContainerRef.current) {
        resizeObserver.unobserve(chartContainerRef.current)
      }
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  // Map API data to TailwindAdmin format or use defaults
  const stagesData = data?.stages || [
    { name: 'New', value: 1, percentage: 100 },
    { name: 'Contacted', value: 1, percentage: 33 },
    { name: 'Qualified', value: 1, percentage: 33 },
    { name: 'Proposal', value: 0, percentage: 0 },
    { name: 'Closed', value: 0, percentage: 0 }
  ]

  // Transform API data to match react-funnel-pipeline format
  // The FunnelChart expects an array of objects with 'name' and 'value' properties
  const funnelData = stagesData
    .filter((stage: any) => stage.value > 0) // Filter out stages with 0 values for better visualization
    .map((stage: any) => ({
      name: stage.name,
      value: stage.value || 0
    }))

  // Color palette matching TailwindAdmin theme
  // react-funnel-pipeline expects hex color strings
  const colorPalette = [
    '#3b82f6',  // New - primary blue
    '#49beff',  // Contacted - secondary blue
    '#10b981',  // Qualified - green
    '#f59e0b',  // Proposal - orange
    '#8b5cf6'   // Closed - purple
  ]

  return (
    <Card className="h-full flex flex-col rounded-xl" style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
      <div className="mb-3">
        <h4 className="card-title text-center">Pipeline Funnel</h4>
        <p className="card-subtitle text-center">Deal progression through stages</p>
        <div className="border-b border-border dark:border-darkborder mt-3"></div>
      </div>
      <div 
        ref={chartContainerRef}
        className="w-full flex-1 min-h-0 p-4"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {FunnelChartComponent && funnelData.length > 0 ? (
          <>
            {/* #region agent log */}
            {(() => {
              const logData5 = {location:'DashboardWidgets.tsx:441',message:'Rendering FunnelChart',data:{chartWidth,hasComponent:!!FunnelChartComponent,dataLength:funnelData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
              console.log('[DEBUG] Rendering FunnelChart:', logData5);
              fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch(()=>{});
              return null;
            })()}
            {/* #endregion */}
            {/* Remove nested flex container that might constrain width (Hypothesis E) */}
            <div style={{ width: '100%', maxWidth: `${chartWidth}px`, margin: '0 auto' }}>
              <FunnelChartComponent
                data={funnelData}
                pallette={colorPalette}
                showValues={true}
                showNames={true}
                chartWidth={chartWidth}
                chartHeight={280}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading chart...
          </div>
        )}
      </div>
    </Card>
  )
}

function DealStageDistributionWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  // Map API data to TailwindAdmin format or use defaults
  const stagesData = data?.stages || [
    { name: 'New', value: 1, percentage: 33 },
    { name: 'Contacted', value: 1, percentage: 33 },
    { name: 'Qualified', value: 1, percentage: 33 },
    { name: 'Proposal', value: 0, percentage: 0 }
  ]

  // Transform API data to match TailwindAdmin structure
  const stages = stagesData.map((stage: any) => ({
    name: stage.name,
    value: stage.value || 0,
    percentage: stage.percentage || 0
  }))

  // Calculate total for percentage calculation
  const total = stages.reduce((sum: number, s: { name: string; value: number; percentage: number }) => sum + s.value, 0) || 1

  // Prepare chart data for recharts (Label List pattern)
  const chartData = stages.map((stage: any, index: number) => {
    // Color mapping for stages - matching the original colors
    const colorMap = [
      'var(--color-chart-1, #3b82f6)',
      'var(--color-chart-2, #49beff)',
      'var(--color-chart-3, #10b981)',
      'var(--color-chart-4, #f59e0b)',
      'var(--color-chart-5, #8b5cf6)'
    ]

    // Map stage names to chart keys
    const stageKeyMap: Record<string, string> = {
      'New': 'new',
      'Contacted': 'contacted',
      'Qualified': 'qualified',
      'Proposal': 'proposal',
      'Closed': 'closed'
    }

    const stageKey = stageKeyMap[stage.name] || `stage${index}`

    return {
      [stageKey]: stage.value,
      browser: stageKey,
      visitors: stage.value,
      fill: colorMap[index] || colorMap[0],
      name: stage.name,
      value: stage.value,
      percentage: total > 0 ? Math.round((stage.value / total) * 100) : 0
    }
  })

  const chartConfig: ChartConfig = {
    visitors: {
      label: 'Deals',
    },
    new: {
      label: 'New',
      color: 'var(--color-chart-1, #3b82f6)',
    },
    contacted: {
      label: 'Contacted',
      color: 'var(--color-chart-2, #49beff)',
    },
    qualified: {
      label: 'Qualified',
      color: 'var(--color-chart-3, #10b981)',
    },
    proposal: {
      label: 'Proposal',
      color: 'var(--color-chart-4, #f59e0b)',
    },
    closed: {
      label: 'Closed',
      color: 'var(--color-chart-5, #8b5cf6)',
    },
  } satisfies ChartConfig

  return (
    <Card className="h-full flex flex-col rounded-xl" style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
      <div className="mb-3">
        <h4 className="card-title text-center">Deal Stage Distribution</h4>
        <p className="card-subtitle text-center">Breakdown of deals by stage</p>
        <div className="border-b border-border dark:border-darkborder mt-3"></div>
      </div>
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="h-[180px]">
          <ChartContainer
            config={chartConfig}
            className='h-full [&_.recharts-text]:fill-background'>
            <RechartsPieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey='visitors' hideLabel />}
              />
              <Pie data={chartData} dataKey='visitors'>
                <LabelList
                  dataKey='browser'
                  className='fill-link'
                  stroke='none'
                  fontSize={12}
                  formatter={(value: any) => {
                    const key = value as keyof typeof chartConfig
                    return chartConfig[key]?.label || value
                  }}
                />
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[140px]">
          {stages.map((stage: any, index: number) => {
            const colorMap = [
              'var(--color-chart-1, #3b82f6)',
              'var(--color-chart-2, #49beff)',
              'var(--color-chart-3, #10b981)',
              'var(--color-chart-4, #f59e0b)',
              'var(--color-chart-5, #8b5cf6)'
            ]
            const color = colorMap[index] || colorMap[0]
            const percentage = stage.percentage !== undefined ? stage.percentage : (total > 0 ? Math.round((stage.value / total) * 100) : 0)

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="py-2.5 border-b border-border dark:border-darkborder flex items-center justify-between last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  ></span>
                  <p className="text-sm font-medium text-foreground dark:text-white">
                    {stage.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground dark:text-white">
                    {stage.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ({percentage}%)
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function TasksWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  // Map API data to TailwindAdmin format or use defaults
  const tasksData = data || [
    { id: 1, title: 'Follow up with expired listing owner', due: 'Today', priority: 'high', date: '21 August 2025', description: 'Contact expired listing owner to discuss property', tasks: 2, comments: 0 },
    { id: 2, title: 'Review probate leads', due: 'Tomorrow', priority: 'medium', date: '22 August 2025', description: 'Review and qualify new probate leads', tasks: 1, comments: 3 },
    { id: 3, title: 'Schedule property viewing', due: 'In 2 days', priority: 'low', date: '23 August 2025', description: 'Schedule viewing for interested prospects', tasks: 0, comments: 1 }
  ]

  // Transform API data to match TailwindAdmin structure exactly
  const tasks = tasksData.map((task: any) => {
    // Map priority to status and badge color
    const statusMap: Record<string, { status: string; badgeColor: string }> = {
      'high': { status: 'Inprogress', badgeColor: 'lightPrimary' },
      'medium': { status: 'Inpending', badgeColor: 'lightError' },
      'low': { status: 'Completed', badgeColor: 'lightSuccess' },
      'completed': { status: 'Completed', badgeColor: 'lightSuccess' },
      'pending': { status: 'Inpending', badgeColor: 'lightError' },
      'inprogress': { status: 'Inprogress', badgeColor: 'lightPrimary' },
    }
    const statusInfo = statusMap[task.priority?.toLowerCase()] || statusMap['medium']

    return {
      key: task.id?.toString() || task.key,
      status: task.status || statusInfo.status,
      date: task.date || task.due || '21 August 2025',
      title: task.title,
      description: task.description || task.desc || '',
      tasks: task.tasks || 0,
      comments: task.comments || 0,
      badgeColor: task.badgeColor || statusInfo.badgeColor,
    }
  })

  return (
    <Card className="h-full flex flex-col rounded-xl" style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
      <div className="mb-3">
        <h4 className="card-title text-center">Tasks</h4>
        <p className="card-subtitle text-center">The power of prioritizing your tasks</p>
        <div className="border-b border-border dark:border-darkborder mt-3"></div>
      </div>
      <SimpleBar className="flex-1 max-h-[320px]">
        <div className="space-y-4">
          {tasks.map((item: any, i: number) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.2 }}
              className="pb-6 border-b last:border-none border-border dark:border-darkborder"
            >
              <div className="flex items-center justify-between">
                <Badge
                  variant={item.badgeColor as BadgeProps["variant"]}
                  className="rounded-md py-1.5 text-sm"
                >
                  {item.status}
                </Badge>
                <span className="text-sm">{item.date}</span>
              </div>
              <h6 className="mt-4 text-sm font-medium">{item.title}</h6>
              {item.description && (
                <p className="pt-1 line-clamp-2">{item.description}</p>
              )}
              <div className="flex gap-4 items-center mt-4">
                <div className="flex gap-2 items-center">
                  <Icon
                    icon="tabler:clipboard"
                    className="text-lg text-primary"
                    aria-label="task count"
                  />
                  <span>{`${item.tasks} Tasks`}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <Icon
                    icon="tabler:message-dots"
                    className="text-lg text-primary"
                    aria-label="comment count"
                  />
                  <span>{`${item.comments} Comments`}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </SimpleBar>
    </Card>
  )
}

function ManualActionsWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  const actions = data || {
    phone: 0,
    sms: 0,
    email: 0,
    total: 0
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="mb-3">
        <h4 className="card-title">Manual Actions</h4>
      </div>
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Phone</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{actions.phone}</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">SMS</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{actions.sms}</p>
          </div>
          <div className="text-center p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{actions.total}</p>
          </div>
        </div>
        <button className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center space-x-1">
          <span>Go to Manual Actions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </Card>
  )
}

function LeadSourceWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  const sources = data?.sources || [
    { name: 'Expired Listings', count: 45, percentage: 35 },
    { name: 'Probate Leads', count: 30, percentage: 23 },
    { name: 'Geo Leads', count: 25, percentage: 19 },
    { name: 'Property Listings', count: 20, percentage: 15 },
    { name: 'Other', count: 10, percentage: 8 }
  ]

  return (
    <div className="space-y-3">
      {sources.map((source: any, index: number) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">{source.name}</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{source.count}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${source.percentage}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right ml-2">{source.percentage}%</span>
        </div>
      ))}
    </div>
  )
}

function PerformanceChartWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  return (
    <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg" style={{ boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)' }}>
      <div className="text-center">
        <LineChart className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Performance chart visualization</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Last 30 days</p>
      </div>
    </div>
  )
}

function SalesEfficiencyWidget({ widget, data }: { widget: DashboardWidget; data?: any }) {
  const metrics = data || {
    avgResponseTime: '2.5h',
    conversionRate: '12%',
    avgDealSize: '$45K',
    salesCycle: '28 days'
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Response Time</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{metrics.avgResponseTime}</p>
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Conversion Rate</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{metrics.conversionRate}</p>
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Deal Size</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{metrics.avgDealSize}</p>
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sales Cycle</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{metrics.salesCycle}</p>
      </div>
    </div>
  )
}

// Available Widgets Registry - NextDeal Specific
export const availableWidgets: DashboardWidget[] = [
  // Core Metrics
  {
    id: 'total-prospects',
    type: 'metric',
    title: 'Total Prospects',
    icon: Users,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'prospects',
    size: 'small'
  },
  {
    id: 'active-listings',
    type: 'metric',
    title: 'Active Listings',
    icon: Building2,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'prospects',
    size: 'small'
  },
  {
    id: 'enriched-leads',
    type: 'metric',
    title: 'Enriched Leads',
    icon: Sparkles,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'prospects',
    size: 'small'
  },
  {
    id: 'avg-property-value',
    type: 'metric',
    title: 'Avg Property Value',
    icon: DollarSign,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'metrics',
    size: 'small'
  },
  {
    id: 'expired-listings',
    type: 'metric',
    title: 'Expired Listings',
    icon: Clock,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'prospects',
    size: 'small'
  },
  {
    id: 'probate-leads',
    type: 'metric',
    title: 'Probate Leads',
    icon: FileText,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'prospects',
    size: 'small'
  },
  // CRM Metrics
  {
    id: 'active-deals',
    type: 'metric',
    title: 'Active Deals',
    icon: Briefcase,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'crm',
    size: 'small'
  },
  {
    id: 'pipeline-value',
    type: 'metric',
    title: 'Pipeline Value',
    icon: DollarSign,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'crm',
    size: 'small'
  },
  {
    id: 'conversion-rate',
    type: 'metric',
    title: 'Conversion Rate',
    icon: Percent,
    component: ProspectMetricsWidget,
    defaultEnabled: true,
    category: 'crm',
    size: 'small'
  },
  {
    id: 'win-rate',
    type: 'metric',
    title: 'Win Rate',
    icon: Target,
    component: ProspectMetricsWidget,
    defaultEnabled: false,
    category: 'crm',
    size: 'small'
  },
  // Activity Widgets
  {
    id: 'recent-activity',
    type: 'activity',
    title: 'Recent Activity',
    icon: Activity,
    component: RecentActivityWidget,
    defaultEnabled: true,
    category: 'activity',
    size: 'medium'
  },
  {
    id: 'upcoming-tasks',
    type: 'activity',
    title: 'Upcoming Tasks',
    icon: Calendar,
    component: TasksWidget,
    defaultEnabled: true,
    category: 'activity',
    size: 'medium'
  },
  // Charts
  {
    id: 'pipeline-funnel',
    type: 'chart',
    title: 'Pipeline Funnel',
    icon: GitBranch,
    component: PipelineFunnelWidget,
    defaultEnabled: true,
    category: 'charts',
    size: 'medium'
  },
  {
    id: 'deal-stage-distribution',
    type: 'chart',
    title: 'Deal Stage Distribution',
    icon: PieChart,
    component: DealStageDistributionWidget,
    defaultEnabled: true,
    category: 'charts',
    size: 'medium'
  },
  {
    id: 'lead-source-report',
    type: 'chart',
    title: 'Lead Source Report',
    icon: BarChart3,
    component: LeadSourceWidget,
    defaultEnabled: false,
    category: 'charts',
    size: 'medium'
  },
  {
    id: 'performance-overview',
    type: 'chart',
    title: 'Performance Overview',
    icon: LineChart,
    component: PerformanceChartWidget,
    defaultEnabled: true,
    category: 'charts',
    size: 'large'
  },
  {
    id: 'sales-efficiency',
    type: 'chart',
    title: 'Sales Efficiency',
    icon: TrendingUp,
    component: SalesEfficiencyWidget,
    defaultEnabled: false,
    category: 'crm',
    size: 'medium'
  }
]
