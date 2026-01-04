'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Trophy } from 'lucide-react'

interface Comparison {
  id: string
  name: string
  metrics: {
    [key: string]: number
  }
  is_best: boolean
}

interface ComparisonChartProps {
  comparisons: Comparison[]
  metric: string
  chartType?: 'bar' | 'line'
  height?: number
}

/**
 * Comparison Chart Component
 * Multi-series bar/line chart comparing selected entities following Mautic patterns
 */
export default function ComparisonChart({
  comparisons,
  metric,
  chartType = 'bar',
  height = 400,
}: ComparisonChartProps) {
  // Transform data for charts
  const chartData = comparisons.map((comparison) => ({
    name: comparison.name.length > 15 ? comparison.name.substring(0, 15) + '...' : comparison.name,
    fullName: comparison.name,
    is_best: comparison.is_best,
    open_rate: comparison.metrics.open_rate || 0,
    click_rate: comparison.metrics.click_rate || 0,
    reply_rate: comparison.metrics.reply_rate || 0,
    delivery_rate: comparison.metrics.delivery_rate || 0,
    bounce_rate: comparison.metrics.bounce_rate || 0,
    [metric]: comparison.metrics[metric] || 0,
  }))

  // Color scheme: best performer gets green, others get gradient
  const COLORS = [
    '#10b981', // green-500 for best
    '#3b82f6', // blue-500
    '#8b5cf6', // purple-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
  ]

  const getBarColor = (entry: any, index: number) => {
    if (entry.is_best) {
      return COLORS[0] // Green for best performer
    }
    return COLORS[(index % (COLORS.length - 1)) + 1] || COLORS[1]
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{data.fullName}</p>
          {data.is_best && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs mb-2">
              <Trophy className="h-3 w-3" />
              <span className="font-medium">Best Performer</span>
            </div>
          )}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {entry.name}:
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof entry.value === 'number' && entry.name.includes('rate')
                  ? `${entry.value.toFixed(2)}%`
                  : entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">No comparison data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Comparison Chart
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Visual comparison of {metric.replace('_', ' ')} across selected entities
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'bar' ? (
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              className="text-xs"
              tick={{ fill: 'currentColor', fontSize: 12 }}
              stroke="currentColor"
            />
            <YAxis
              label={{ value: metric.includes('rate') ? 'Percentage (%)' : 'Count', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar
              dataKey={metric}
              name={metric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry, index)} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              className="text-xs"
              tick={{ fill: 'currentColor', fontSize: 12 }}
              stroke="currentColor"
            />
            <YAxis
              label={{ value: metric.includes('rate') ? 'Percentage (%)' : 'Count', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line
              type="monotone"
              dataKey={metric}
              name={metric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              stroke={COLORS[0]}
              strokeWidth={3}
              dot={{ r: 6, fill: COLORS[0] }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Legend for best performer */}
      {comparisons.some((c) => c.is_best) && (
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>Best Performer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>Other Entities</span>
          </div>
        </div>
      )}
    </div>
  )
}


