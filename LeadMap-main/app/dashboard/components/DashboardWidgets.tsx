'use client'

import { Badge, BadgeProps } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { Icon } from '@iconify/react'
import { ApexOptions } from 'apexcharts'
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
  GitBranch,
  GripVertical,
  LineChart,
  Percent,
  PieChart,
  Search as SearchIcon,
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
import React, { useEffect, useState } from 'react'
import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'
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
  const hasOwnCard = widget.id === 'recent-activity' || widget.id === 'upcoming-tasks' || widget.id === 'pipeline-funnel' || widget.id === 'deal-stage-distribution'
  
  return (
    <div className={`relative ${hasOwnCard ? '' : 'bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'} hover:shadow-lg transition-all duration-200 ${
      widget.size === 'large' ? 'col-span-2' : ''
    }`}>
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
  
  return (
    <div className="space-y-2">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className={`text-xs flex items-center space-x-1 ${
        trend === 'up' ? 'text-green-600 dark:text-green-400' : 
        trend === 'down' ? 'text-red-600 dark:text-red-400' : 
        'text-gray-600 dark:text-gray-400'
      }`}>
        <TrendingUp className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : ''}`} />
        <span>{change} from last month</span>
      </div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.id}
            onClick={() => router.push(action.href)}
            className="p-3 text-left bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 group"
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
    if (typeof iconName === 'string' && !iconName.startsWith('tabler:')) {
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
    <Card>
      <h4 className="card-title">Recent Activity</h4>
      <p className="card-subtitle">Preparation for the upcoming activity</p>
      <SimpleBar className="mt-10 max-h-[248px] pr-6">
        <div className="flex flex-col gap-6">
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
  // Map API data to TailwindAdmin format or use defaults
  const stagesData = data?.stages || [
    { name: 'New', value: 1, percentage: 100 },
    { name: 'Contacted', value: 1, percentage: 33 },
    { name: 'Qualified', value: 1, percentage: 33 },
    { name: 'Proposal', value: 0, percentage: 0 },
    { name: 'Closed', value: 0, percentage: 0 }
  ]

  // Transform API data to match TailwindAdmin structure
  const stages = stagesData.map((stage: any) => ({
    name: stage.name,
    value: stage.value || 0,
    percentage: stage.percentage || 0
  }))

  // Find the maximum value for relative sizing
  const maxValue = Math.max(...stages.map(s => s.value), 1)

  // Color mapping for stages
  const stageColors: Record<string, string> = {
    'New': 'bg-primary',
    'Contacted': 'bg-secondary',
    'Qualified': 'bg-success',
    'Proposal': 'bg-warning',
    'Closed': 'bg-info'
  }

  return (
    <Card className="h-full">
      <div className="mb-5">
        <h4 className="card-title">Pipeline Funnel</h4>
        <p className="card-subtitle">Deal progression through stages</p>
      </div>
      <div className="flex flex-col gap-3">
        {stages.map((stage: any, index: number) => {
          const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
          const color = stageColors[stage.name] || 'bg-primary'
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground dark:text-white">{stage.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground dark:text-white">{stage.value}</span>
                  <span className="text-xs text-muted-foreground">({stage.percentage}%)</span>
                </div>
              </div>
              <div className="relative w-full">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden" style={{ height: '32px' }}>
                  <div
                    className={`h-full ${color} rounded-md transition-all duration-500 flex items-center justify-end pr-3`}
                    style={{ width: `${widthPercentage}%` }}
                  >
                    {widthPercentage > 10 && (
                      <span className="text-xs font-medium text-white">{stage.value}</span>
                    )}
                  </div>
                </div>
                {/* Funnel shape effect - narrower at bottom */}
                <div
                  className="absolute top-0 left-0 h-full pointer-events-none"
                  style={{
                    clipPath: `polygon(0% 0%, ${100 - (index * 5)}% 0%, ${100 - ((index + 1) * 5)}% 100%, 0% 100%)`,
                    opacity: 0.1
                  }}
                />
              </div>
            </motion.div>
          )
        })}
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

  // Prepare chart data
  const chartSeries = stages.map(s => s.value)
  const chartLabels = stages.map(s => s.name)
  
  // Color mapping for stages
  const stageColors = [
    'var(--color-primary, #3b82f6)',
    'var(--color-secondary, #49beff)',
    'var(--color-success, #10b981)',
    'var(--color-warning, #f59e0b)',
    'var(--color-info, #3b82f6)'
  ]

  // Detect dark mode - use a state hook for reactivity
  const [isDark, setIsDark] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'))
      // Watch for dark mode changes
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.classList.contains('dark'))
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      })
      return () => observer.disconnect()
    }
  }, [])

  const ChartData: ApexOptions = {
    series: chartSeries,
    labels: chartLabels,
    chart: {
      height: 300,
      type: 'pie',
      fontFamily: 'inherit',
      foreColor: isDark ? 'var(--color-white40, rgba(255, 255, 255, 0.4))' : 'var(--color-black40, rgba(0, 0, 0, 0.4))',
    },
    stroke: {
      show: true,
      colors: [isDark ? 'var(--color-dark, #1f2937)' : 'var(--color-white, #ffffff)'],
      width: 2,
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number, opts: any) {
        return opts.w.config.labels[opts.seriesIndex] + '\n' + val.toFixed(0) + '%'
      },
      style: {
        fontSize: '12px',
        fontWeight: 600,
      },
    },
    legend: {
      show: true,
      position: 'bottom',
      fontSize: '14px',
      fontFamily: 'inherit',
      fontWeight: 400,
      labels: {
        colors: isDark ? 'var(--color-white, #ffffff)' : 'var(--color-foreground, #1f2937)',
      },
      markers: {
        width: 8,
        height: 8,
        radius: 4,
      },
    },
    colors: stageColors.slice(0, stages.length),
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      fillSeriesColor: false,
      y: {
        formatter: function (val: number, opts: any) {
          return opts.w.config.labels[opts.seriesIndex] + ': ' + val
        }
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '0%',
        },
        expandOnClick: false,
      },
    },
  }

  return (
    <Card className="h-full">
      <div className="mb-5">
        <h4 className="card-title">Deal Stage Distribution</h4>
        <p className="card-subtitle">Breakdown of deals by stage</p>
      </div>
      <div className="flex flex-col gap-6">
        <div>
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="pie"
            height="300px"
            width="100%"
          />
        </div>
        <div className="flex flex-col gap-2">
          {stages.map((stage: any, index: number) => {
            const color = stageColors[index] || stageColors[0]
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
                    ({stage.percentage}%)
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
    <Card className="h-full">
      <div className="mb-5">
        <h4 className="card-title">Tasks</h4>
        <p className="card-subtitle">The power of prioritizing your tasks</p>
      </div>
      <SimpleBar className="max-h-[500px]">
        <div className="space-y-6">
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
    <div className="space-y-4">
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
    <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
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
  {
    id: 'manual-actions',
    type: 'activity',
    title: 'Manual Actions',
    icon: Zap,
    component: ManualActionsWidget,
    defaultEnabled: false,
    category: 'actions',
    size: 'medium'
  },
  // Quick Actions
  {
    id: 'quick-actions',
    type: 'actions',
    title: 'Quick Actions',
    icon: Zap,
    component: QuickActionsWidget,
    defaultEnabled: true,
    category: 'actions',
    size: 'large'
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
