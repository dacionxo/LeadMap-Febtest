'use client'

import { useState, useEffect } from 'react'
import { formatHour } from '@/lib/email/time-analysis'

interface EngagementHeatmapProps {
  mailboxId?: string
  period?: '7d' | '30d' | '90d' | 'all'
}

interface HeatmapData {
  hour: number
  dayOfWeek: number
  value: number
  opens: number
  clicks: number
}

/**
 * Engagement Heatmap Component
 * Visualizes engagement patterns by hour and day of week
 * Following Mautic dashboard patterns for time-based analysis
 */
export default function EngagementHeatmap({ mailboxId = 'all', period = '30d' }: EngagementHeatmapProps) {
  const [loading, setLoading] = useState(true)
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])

  useEffect(() => {
    fetchHeatmapData()
  }, [mailboxId, period])

  const fetchHeatmapData = async () => {
    try {
      setLoading(true)
      const startDate = getStartDate(period)
      const params = new URLSearchParams({
        days: period === '7d' ? '7' : period === '30d' ? '30' : period === '90d' ? '90' : '90',
        ...(mailboxId !== 'all' && { mailboxId })
      })

      const response = await fetch(`/api/email/analytics/optimal-send-time?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        // Transform hourly and daily patterns into heatmap data
        const heatmap: HeatmapData[] = []
        
        // Create grid for all hours (0-23) and days (0-6)
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            // Find matching data from hourly pattern
            const hourlyMatch = data.hourlyPattern?.find((h: any) => h.hour === hour)
            const dailyMatch = data.dailyPattern?.find((d: any) => d.dayOfWeek === day)
            
            const value = hourlyMatch && dailyMatch
              ? (hourlyMatch.engagementRate + dailyMatch.engagementRate) / 2
              : hourlyMatch
              ? hourlyMatch.engagementRate
              : dailyMatch
              ? dailyMatch.engagementRate
              : 0

            heatmap.push({
              hour,
              dayOfWeek: day,
              value,
              opens: hourlyMatch?.opens || 0,
              clicks: hourlyMatch?.clicks || 0
            })
          }
        }
        
        setHeatmapData(heatmap)
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStartDate = (period: string): string | null => {
    const now = new Date()
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return null
    }
  }

  const getCellColor = (value: number, maxValue: number): string => {
    if (value === 0) return 'bg-gray-100 dark:bg-gray-900'
    
    const intensity = value / maxValue
    if (intensity >= 0.8) return 'bg-green-600 dark:bg-green-500'
    if (intensity >= 0.6) return 'bg-green-500 dark:bg-green-600'
    if (intensity >= 0.4) return 'bg-yellow-400 dark:bg-yellow-500'
    if (intensity >= 0.2) return 'bg-yellow-300 dark:bg-yellow-600'
    return 'bg-yellow-200 dark:bg-yellow-700'
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxValue = heatmapData.length > 0
    ? Math.max(...heatmapData.map(d => d.value))
    : 1

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading heatmap...</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Engagement Heatmap (Hour × Day of Week)
      </h3>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs text-gray-600 dark:text-gray-400 font-medium text-left">
                  Day \ Hour
                </th>
                {Array.from({ length: 24 }, (_, i) => (
                  <th
                    key={i}
                    className="p-1 text-xs text-gray-600 dark:text-gray-400 font-medium text-center"
                  >
                    {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayNames.map((dayName, dayIndex) => (
                <tr key={dayIndex}>
                  <td className="p-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    {dayName}
                  </td>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cellData = heatmapData.find(
                      d => d.dayOfWeek === dayIndex && d.hour === hour
                    )
                    const value = cellData?.value || 0

                    return (
                      <td
                        key={hour}
                        className={`p-1 border border-gray-200 dark:border-gray-700 ${getCellColor(
                          value,
                          maxValue
                        )} cursor-pointer hover:opacity-80 transition-opacity`}
                        title={`${dayName} ${formatHour(hour)}: ${value.toFixed(1)}% engagement (${cellData?.opens || 0} opens, ${cellData?.clicks || 0} clicks)`}
                      >
                        <div className="w-8 h-8 flex items-center justify-center text-xs text-gray-900 dark:text-white font-medium">
                          {value > 0 ? value.toFixed(0) : ''}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"></div>
            <span>No data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-200 dark:bg-yellow-700"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 dark:bg-yellow-500"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 dark:bg-green-600"></div>
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 dark:bg-green-500"></div>
            <span>Very High</span>
          </div>
        </div>
        <div>Hover over cells for details</div>
      </div>
    </div>
  )
}




