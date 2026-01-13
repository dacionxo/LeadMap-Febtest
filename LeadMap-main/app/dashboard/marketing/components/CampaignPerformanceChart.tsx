'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from 'recharts'
// Date formatting helper (avoiding date-fns dependency)
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')}`
}

interface CampaignPerformanceChartProps {
  dailyPerformance: Array<{
    report_date: string
    emails_sent: number
    emails_delivered: number
    emails_opened: number
    emails_clicked: number
    conversions?: number
    revenue?: number
    roi_percentage?: number
  }>
  showROI?: boolean
  height?: number
  chartType?: 'line' | 'area' | 'composed'
}

/**
 * Campaign Performance Chart Component
 * Time-series chart showing campaign performance over time with optional ROI overlay
 * Following Mautic campaign analytics patterns
 */
export default function CampaignPerformanceChart({
  dailyPerformance,
  showROI = false,
  height = 400,
  chartType = 'composed',
}: CampaignPerformanceChartProps) {
  // Transform data for charts
  const chartData = dailyPerformance.map((day) => ({
    date: formatDate(day.report_date),
    fullDate: day.report_date,
    sent: day.emails_sent,
    delivered: day.emails_delivered,
    opened: day.emails_opened,
    clicked: day.emails_clicked,
    conversions: day.conversions || 0,
    revenue: day.revenue || 0,
    roi: day.roi_percentage || 0,
  }))

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-3">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-2">
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
                {entry.name === 'Revenue' || entry.name === 'ROI'
                  ? entry.name === 'ROI'
                    ? `${entry.value.toFixed(2)}%`
                    : `$${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        <p className="text-gray-600 dark:text-gray-400">No performance data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Campaign Performance Over Time
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Daily metrics and {showROI ? 'ROI' : 'engagement'} trends
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'composed' ? (
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <YAxis
              yAxisId="left"
              label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            {showROI && (
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'ROI (%)', angle: 90, position: 'insideRight' }}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                stroke="currentColor"
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="sent"
              fill="#e0e7ff"
              stroke="#6366f1"
              name="Sent"
              fillOpacity={0.3}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="delivered"
              fill="#dbeafe"
              stroke="#3b82f6"
              name="Delivered"
              fillOpacity={0.3}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="opened"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Opened"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="clicked"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Clicked"
            />
            {showROI && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="roi"
                stroke="#8b5cf6"
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={{ r: 5 }}
                name="ROI %"
              />
            )}
            {showROI && (
              <Bar
                yAxisId="left"
                dataKey="conversions"
                fill="#ec4899"
                name="Conversions"
                radius={[4, 4, 0, 0]}
              />
            )}
          </ComposedChart>
        ) : chartType === 'area' ? (
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Area
              type="monotone"
              dataKey="sent"
              stackId="1"
              stroke="#6366f1"
              fill="#e0e7ff"
              name="Sent"
            />
            <Area
              type="monotone"
              dataKey="delivered"
              stackId="1"
              stroke="#3b82f6"
              fill="#dbeafe"
              name="Delivered"
            />
            <Area
              type="monotone"
              dataKey="opened"
              stackId="1"
              stroke="#10b981"
              fill="#86efac"
              name="Opened"
            />
            <Area
              type="monotone"
              dataKey="clicked"
              stackId="1"
              stroke="#f59e0b"
              fill="#fde68a"
              name="Clicked"
            />
          </AreaChart>
        ) : (
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              stroke="currentColor"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line
              type="monotone"
              dataKey="sent"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Sent"
            />
            <Line
              type="monotone"
              dataKey="delivered"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Delivered"
            />
            <Line
              type="monotone"
              dataKey="opened"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Opened"
            />
            <Line
              type="monotone"
              dataKey="clicked"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Clicked"
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

