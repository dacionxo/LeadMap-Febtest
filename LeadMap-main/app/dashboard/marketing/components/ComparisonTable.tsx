'use client'

import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Comparison {
  id: string
  name: string
  type: string
  metrics: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    open_rate: number
    click_rate: number
    reply_rate: number
    delivery_rate?: number
    bounce_rate?: number
  }
  difference?: number
  difference_percent?: number
  is_best: boolean
}

interface ComparisonTableProps {
  comparisons: Comparison[]
  metric: string
  onSort?: (column: string) => void
}

/**
 * Comparison Table Component
 * Side-by-side comparison table with difference calculations following Mautic patterns
 */
export default function ComparisonTable({ comparisons, metric, onSort }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">No comparison data available</p>
      </div>
    )
  }

  // Find best and worst performers for the selected metric
  const sortedByMetric = [...comparisons].sort((a, b) => {
    const aValue = a.metrics[metric as keyof typeof a.metrics] || 0
    const bValue = b.metrics[metric as keyof typeof b.metrics] || 0
    return bValue - aValue
  })

  const bestValue = sortedByMetric[0]?.metrics[metric as keyof Comparison["metrics"]] || 0

  const formatValue = (value: number, isPercentage: boolean = false) => {
    if (isPercentage) {
      return `${value.toFixed(1)}%`
    }
    return value.toLocaleString()
  }

  const getDifferenceColor = (difference?: number) => {
    if (difference === undefined || difference === 0) return 'text-gray-600 dark:text-gray-400'
    return difference > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
  }

  const getDifferenceIcon = (difference?: number) => {
    if (difference === undefined || difference === 0) {
      return <Minus className="h-4 w-4" />
    }
    return difference > 0 ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Comparison Results
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Side-by-side metrics with difference calculations
        </p>
      </div>

      <div className="overflow-x-auto -mx-6 sm:mx-0">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Delivered
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Opened
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Clicked
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Open Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Click Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Difference
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {comparisons.map((comparison, index) => {
              const isBest = comparison.is_best
              const metricValue = comparison.metrics[metric as keyof typeof comparison.metrics] || 0

              return (
                <tr
                  key={comparison.id}
                  className={isBest ? 'bg-green-50 dark:bg-green-900/20' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {isBest && <Trophy className="h-4 w-4 text-green-500" />}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {comparison.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        ({comparison.type})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                    {formatValue(comparison.metrics.sent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                    {formatValue(comparison.metrics.delivered)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                    {formatValue(comparison.metrics.opened)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                    {formatValue(comparison.metrics.clicked)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                    {formatValue(comparison.metrics.open_rate, true)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                    {formatValue(comparison.metrics.click_rate, true)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {comparison.difference !== undefined && comparison.difference_percent !== undefined ? (
                      <div className={`flex items-center justify-end gap-1 ${getDifferenceColor(comparison.difference)}`}>
                        {getDifferenceIcon(comparison.difference)}
                        <span className="font-medium">
                          {comparison.difference > 0 ? '+' : ''}
                          {formatValue(comparison.difference_percent, true)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-400">
            Best Performer: <span className="font-semibold text-gray-900 dark:text-white">
              {sortedByMetric[0]?.name}
            </span>
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            Best {metric.replace('_', ' ')}: <span className="font-semibold text-gray-900 dark:text-white">
              {formatValue(bestValue, true)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

