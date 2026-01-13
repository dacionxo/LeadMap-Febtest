/**
 * Analytics Chart Component
 * 
 * Chart component for displaying analytics metrics using Recharts.
 * Compatible with Postiz's ChartSocial component structure.
 * 
 * Phase 8: Native Postiz UI Component Integration
 */

'use client'

import { useMemo } from 'react'
import { LineChart, Line, Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartDataPoint {
  total: number
  date: string
}

interface AnalyticsChartProps {
  data: ChartDataPoint[]
  label: string
}

/**
 * Analytics Chart Component
 * Uses Recharts to render analytics data in Postiz-style format
 */
export default function AnalyticsChart({ data, label }: AnalyticsChartProps) {
  // Merge data points for better visualization (like Postiz does with chunk)
  const mergedData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    // Postiz merges data into ~7 points for better visualization
    const targetPoints = 7
    const chunkSize = Math.ceil(data.length / targetPoints)
    const merged: ChartDataPoint[] = []

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      if (chunk.length > 0) {
        merged.push({
          date: chunk.length > 1 ? `${chunk[0].date} - ${chunk[chunk.length - 1].date}` : chunk[0].date,
          total: chunk.reduce((sum, d) => sum + d.total, 0),
        })
      }
    }

    return merged
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={mergedData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(90, 46, 203, 0.8)" />
            <stop offset="100%" stopColor="rgba(65, 38, 136, 0.8)" />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="total"
          stroke="rgba(255, 255, 255, 0.8)"
          fill={`url(#gradient-${label})`}
          strokeWidth={1}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <XAxis dataKey="date" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
          }}
          labelStyle={{ color: '#fff', fontSize: '12px' }}
          itemStyle={{ color: '#fff', fontSize: '12px' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
