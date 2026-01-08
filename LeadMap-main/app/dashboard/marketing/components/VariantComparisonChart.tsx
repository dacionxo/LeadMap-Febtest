'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Trophy } from 'lucide-react'

interface VariantComparisonChartProps {
  variants: Array<{
    variant_name: string
    performance: {
      open_rate: number
      click_rate: number
      reply_rate: number
    }
    is_winner: boolean
  }>
  metrics?: ('open_rate' | 'click_rate' | 'reply_rate')[]
  height?: number
}

/**
 * Variant Comparison Chart Component
 * Side-by-side bar chart comparing A/B test variant performance
 * Following Mautic A/B test bargraph patterns
 */
export default function VariantComparisonChart({
  variants,
  metrics = ['open_rate', 'click_rate', 'reply_rate'],
  height = 400,
}: VariantComparisonChartProps) {
  // Transform data for Recharts
  const chartData = variants.map((variant) => ({
    name: `Variant ${variant.variant_name}`,
    variant_name: variant.variant_name,
    is_winner: variant.is_winner,
    open_rate: variant.performance.open_rate,
    click_rate: variant.performance.click_rate,
    reply_rate: variant.performance.reply_rate,
  }))

  // Color scheme: winner gets green, others get blue gradient
  const getBarColor = (entry: any, index: number) => {
    if (entry.is_winner) {
      return '#10b981' // green-500
    }
    // Blue gradient for non-winners
    const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'] // blue-500, blue-400, blue-300, blue-100
    return colors[index % colors.length]
  }

  const COLORS = chartData.map((entry, index) => getBarColor(entry, index))

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
          {data.is_winner && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs mb-2">
              <Trophy className="h-3 w-3" />
              <span className="font-medium">Winner</span>
            </div>
          )}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {entry.name}:
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {entry.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Variant Performance Comparison
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Compare variant performance across key metrics
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="name"
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            stroke="currentColor"
          />
          <YAxis
            label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            stroke="currentColor"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="rect"
          />
          {metrics.includes('open_rate') && (
            <Bar
              dataKey="open_rate"
              name="Open Rate"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry, index)} />
              ))}
            </Bar>
          )}
          {metrics.includes('click_rate') && (
            <Bar
              dataKey="click_rate"
              name="Click Rate"
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-click-${index}`} fill={getBarColor(entry, index)} />
              ))}
            </Bar>
          )}
          {metrics.includes('reply_rate') && (
            <Bar
              dataKey="reply_rate"
              name="Reply Rate"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-reply-${index}`} fill={getBarColor(entry, index)} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend for winner */}
      {variants.some((v) => v.is_winner) && (
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>Winner</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>Other Variants</span>
          </div>
        </div>
      )}
    </div>
  )
}










