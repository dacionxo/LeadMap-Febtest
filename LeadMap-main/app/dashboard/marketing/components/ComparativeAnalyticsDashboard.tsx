'use client'

import { useState, useEffect } from 'react'
import ComparisonSelector from './ComparisonSelector'
import ComparisonTable from './ComparisonTable'
import ComparisonChart from './ComparisonChart'
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Download,
  BarChart3,
  Table,
  TrendingUp,
} from 'lucide-react'

interface ComparativeAnalyticsDashboardProps {
  comparisonType?: 'campaigns' | 'templates' | 'mailboxes' | 'time_periods'
  defaultMetric?: 'open_rate' | 'click_rate' | 'reply_rate' | 'delivery_rate' | 'bounce_rate'
  onComparisonChange?: (comparison: any) => void
}

/**
 * Comparative Analytics Dashboard Component
 * Allows users to compare campaigns, templates, mailboxes, or time periods
 * Following Mautic comparative analytics patterns
 */
export default function ComparativeAnalyticsDashboard({
  comparisonType: initialType = 'campaigns',
  defaultMetric = 'open_rate',
  onComparisonChange,
}: ComparativeAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(false)
  const [comparisonType, setComparisonType] = useState(initialType)
  const [availableEntities, setAvailableEntities] = useState<Array<{ id: string; name: string }>>([])
  const [selectedEntities, setSelectedEntities] = useState<string[]>([])
  const [comparisonData, setComparisonData] = useState<any[]>([])
  const [selectedMetric, setSelectedMetric] = useState(defaultMetric)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAvailableEntities()
  }, [comparisonType])

  const fetchAvailableEntities = async () => {
    try {
      setLoading(true)
      setError(null)

      let entities: Array<{ id: string; name: string }> = []

      switch (comparisonType) {
        case 'campaigns': {
          const response = await fetch('/api/campaigns', { credentials: 'include' })
          if (response.ok) {
            const data = await response.json()
            entities = (data.campaigns || []).map((c: any) => ({
              id: c.id,
              name: c.name,
            }))
          }
          break
        }
        case 'templates': {
          const response = await fetch('/api/email/analytics/templates', {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            entities = (data.templates || []).map((t: any) => ({
              id: t.id,
              name: t.title || t.name,
            }))
          }
          break
        }
        case 'mailboxes': {
          const response = await fetch('/api/mailboxes', { credentials: 'include' })
          if (response.ok) {
            const data = await response.json()
            entities = (data.mailboxes || []).map((m: any) => ({
              id: m.id,
              name: m.display_name || m.email,
            }))
          }
          break
        }
        case 'time_periods': {
          // For time periods, create predefined periods
          const now = new Date()
          const periods = [
            { id: 'last_7d', name: 'Last 7 Days' },
            { id: 'last_30d', name: 'Last 30 Days' },
            { id: 'last_90d', name: 'Last 90 Days' },
            { id: 'this_month', name: 'This Month' },
            { id: 'last_month', name: 'Last Month' },
          ]
          entities = periods
          break
        }
      }

      setAvailableEntities(entities)
      setSelectedEntities([])
      setComparisonData([])
    } catch (err: any) {
      console.error('Error fetching entities:', err)
      setError(err.message || 'Failed to load entities')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyComparison = async () => {
    if (selectedEntities.length < 2) {
      setError('Please select at least 2 entities to compare')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('type', comparisonType)
      params.set('ids', selectedEntities.join(','))
      params.set('metric', selectedMetric)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/email/analytics/compare?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch comparison data')
      }

      const data = await response.json()
      setComparisonData(data.comparisonData || [])

      if (onComparisonChange) {
        onComparisonChange(data)
      }
    } catch (err: any) {
      console.error('Error fetching comparison data:', err)
      setError(err.message || 'Failed to load comparison data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    try {
      const dataToExport = {
        comparisonType,
        selectedEntities,
        selectedMetric,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        comparisonData,
        exportedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comparative-analytics-${comparisonType}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Comparative Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Compare performance across campaigns, templates, mailboxes, or time periods
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Toggle view mode"
          >
            {viewMode === 'table' ? (
              <>
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Chart View</span>
                <span className="sm:hidden">Chart</span>
              </>
            ) : (
              <>
                <Table className="h-4 w-4" />
                <span className="hidden sm:inline">Table View</span>
                <span className="sm:hidden">Table</span>
              </>
            )}
          </button>
          {comparisonData.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              aria-label="Export comparison data"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Comparison Selector */}
      <ComparisonSelector
        comparisonType={comparisonType}
        availableEntities={availableEntities}
        selectedEntities={selectedEntities}
        onTypeChange={(type) => {
          setComparisonType(type as any)
          setSelectedEntities([])
          setComparisonData([])
        }}
        onEntitiesChange={setSelectedEntities}
        onDateRangeChange={(start, end) => {
          setStartDate(start)
          setEndDate(end)
        }}
        onMetricChange={(metric: string) => setSelectedMetric(metric as typeof selectedMetric)}
        onApply={handleApplyComparison}
        loading={loading}
        defaultMetric={selectedMetric}
      />

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <div className="space-y-6">
          {/* View Mode Toggle for Chart */}
          {viewMode === 'chart' && (
            <div className="flex items-center justify-end gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Chart Type:</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'bar' | 'line')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
              </select>
            </div>
          )}

          {/* Results Display */}
          {viewMode === 'table' ? (
            <ComparisonTable comparisons={comparisonData} metric={selectedMetric} />
          ) : (
            <ComparisonChart
              comparisons={comparisonData}
              metric={selectedMetric}
              chartType={chartType}
            />
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Best Performer
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {comparisonData.find((c) => c.is_best)?.name || 'N/A'}
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-sm font-medium text-green-900 dark:text-green-200 mb-2">
                Best {selectedMetric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {(() => {
                  const best = comparisonData.find((c) => c.is_best)
                  const value = best?.metrics[selectedMetric] || 0
                  return selectedMetric.includes('rate')
                    ? `${value.toFixed(1)}%`
                    : value.toLocaleString()
                })()}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Entities Compared
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {comparisonData.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {comparisonData.length === 0 && !loading && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Comparison Data
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select entities and click "Apply Comparison" to view results
          </p>
        </div>
      )}
    </div>
  )
}

