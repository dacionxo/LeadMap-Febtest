'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import TemplatePerformanceCard from './TemplatePerformanceCard'
import TemplateComparisonView from './TemplateComparisonView'
import CampaignPerformanceChart from './CampaignPerformanceChart'
import LoadingSkeleton from './LoadingSkeleton'
import ErrorBoundary from './ErrorBoundary'
import DateRangePicker from './DateRangePicker'
import {
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
  Download,
  Calendar,
  TrendingUp,
  Filter,
} from 'lucide-react'

interface TemplatePerformanceDashboardProps {
  templateId?: string
  startDate?: string
  endDate?: string
  showAll?: boolean
}

/**
 * Template Performance Dashboard Component
 * Template-level performance analytics following Mautic patterns
 */
export default function TemplatePerformanceDashboard({
  templateId,
  startDate,
  endDate,
  showAll = false,
}: TemplatePerformanceDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [dailyPerformance, setDailyPerformance] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'comparison'>('list')
  const [sortBy, setSortBy] = useState<'open_rate' | 'click_rate' | 'total_sent'>('open_rate')
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const [localStartDate, setLocalStartDate] = useState(startDate || '')
  const [localEndDate, setLocalEndDate] = useState(endDate || '')
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (startDate) setLocalStartDate(startDate)
    if (endDate) setLocalEndDate(endDate)
  }, [startDate, endDate])

  useEffect(() => {
    if (templateId) {
      fetchTemplatePerformance(templateId)
    } else {
      fetchAllTemplates()
    }
  }, [templateId, localStartDate, localEndDate])

  // Set up real-time subscriptions for template performance updates
  useEffect(() => {
    if (!realtimeEnabled) return

    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`template-performance-realtime-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'template_performance',
          },
          () => {
            // Refresh template performance when updates occur
            if (templateId) {
              fetchTemplatePerformance(templateId)
            } else {
              fetchAllTemplates()
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'email_events',
            filter: templateId ? `email_id=in.(SELECT id FROM emails WHERE template_id=eq.${templateId})` : undefined,
          },
          () => {
            // Refresh when new events occur for templates
            if (templateId) {
              fetchTemplatePerformance(templateId)
            } else {
              fetchAllTemplates()
            }
          }
        )
        .subscribe()

      return () => {
        if (channel) {
          supabase.removeChannel(channel)
        }
      }
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [realtimeEnabled, templateId])

  const fetchTemplatePerformance = async (id: string) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('templateId', id)
      if (localStartDate) params.set('startDate', localStartDate)
      if (localEndDate) params.set('endDate', localEndDate)

      const response = await fetch(`/api/email/analytics/templates?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch template performance data')
      }

      const data = await response.json()
      setSelectedTemplate(data.template)
      setDailyPerformance(data.dailyPerformance || [])
    } catch (err: any) {
      console.error('Error fetching template performance:', err)
      setError(err.message || 'Failed to load template performance data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (localStartDate) params.set('startDate', localStartDate)
      if (localEndDate) params.set('endDate', localEndDate)

      const response = await fetch(`/api/email/analytics/templates?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch templates data')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err: any) {
      console.error('Error fetching templates:', err)
      setError(err.message || 'Failed to load templates data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    if (templateId) {
      await fetchTemplatePerformance(templateId)
    } else {
      await fetchAllTemplates()
    }
    setRefreshing(false)
  }

  const handleExport = () => {
    try {
      const dataToExport = selectedTemplate
        ? {
            template: selectedTemplate,
            dailyPerformance,
            dateRange: {
              start: localStartDate,
              end: localEndDate,
            },
          }
        : {
            templates,
            dateRange: {
              start: localStartDate,
              end: localEndDate,
            },
          }

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template-performance-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Template Performance</h3>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  // Single template view
  if (selectedTemplate) {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedTemplate.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Template performance analytics
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRealtimeEnabled(!realtimeEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                realtimeEnabled
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label={realtimeEnabled ? 'Disable real-time updates' : 'Enable real-time updates'}
            >
              {realtimeEnabled ? '● Live' : '○ Paused'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              aria-label="Export template performance data"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Refresh template data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <DateRangePicker
            startDate={localStartDate}
            endDate={localEndDate}
            onStartDateChange={setLocalStartDate}
            onEndDateChange={setLocalEndDate}
            maxDate={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Template Performance Card */}
        <TemplatePerformanceCard
          template={{
            id: selectedTemplate.id,
            title: selectedTemplate.title,
            performance: selectedTemplate.performance,
          }}
        />

        {/* Daily Performance Chart */}
        {dailyPerformance.length > 0 && (
          <CampaignPerformanceChart
            dailyPerformance={dailyPerformance.map((day) => ({
              report_date: day.report_date,
              emails_sent: day.total_sent,
              emails_delivered: day.total_delivered,
              emails_opened: day.total_opened,
              emails_clicked: day.total_clicked,
              conversions: 0,
            }))}
            showROI={false}
            chartType="area"
          />
        )}
      </div>
      </ErrorBoundary>
    )
  }

  // All templates view
  return (
    <ErrorBoundary>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Template Performance
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Compare template performance and identify best performers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'comparison' : 'list')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Toggle view mode"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{viewMode === 'list' ? 'Comparison View' : 'List View'}</span>
            <span className="sm:hidden">{viewMode === 'list' ? 'Compare' : 'List'}</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* View Mode Toggle */}
      {templates.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="open_rate">Open Rate</option>
              <option value="click_rate">Click Rate</option>
              <option value="total_sent">Total Sent</option>
            </select>
          </div>
        </div>
      )}

      {/* Templates Display */}
      {templates.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Templates Found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create email templates to start tracking performance.
          </p>
        </div>
      ) : viewMode === 'comparison' ? (
        <TemplateComparisonView
          templates={templates}
          sortBy={sortBy}
          onTemplateSelect={(id) => {
            // Navigate to single template view
            window.location.href = `/dashboard/marketing/analytics?view=template-performance&templateId=${id}`
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates
            .sort((a, b) => {
              const aValue = a.performance[sortBy] || 0
              const bValue = b.performance[sortBy] || 0
              return bValue - aValue
            })
            .map((template) => (
              <TemplatePerformanceCard
                key={template.id}
                template={template}
                onClick={() => {
                  fetchTemplatePerformance(template.id)
                }}
              />
            ))}
        </div>
      )}
      </div>
      </ErrorBoundary>
    )
  }
}

