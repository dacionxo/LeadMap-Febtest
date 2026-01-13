'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { Smartphone, Monitor, Tablet, Globe } from 'lucide-react'

interface DeviceAnalyticsProps {
  mailboxId?: string
  period?: '7d' | '30d' | '90d' | 'all'
}

interface DeviceData {
  deviceTypeBreakdown: Array<{
    deviceType: string
    total: number
    opens: number
    clicks: number
    percentage: number
  }>
  browserBreakdown: Array<{
    browser: string
    total: number
    opens: number
    clicks: number
    percentage: number
  }>
  osBreakdown: Array<{
    os: string
    total: number
    opens: number
    clicks: number
    percentage: number
  }>
  totals: {
    totalEvents: number
    totalOpens: number
    totalClicks: number
  }
}

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#8b5cf6',
  warning: '#f59e0b',
  danger: '#ef4444'
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

/**
 * Device Analytics Component
 * Displays device type, browser, and OS breakdowns
 * Following Mautic dashboard visualization patterns
 */
export default function DeviceAnalytics({ mailboxId = 'all', period = '30d' }: DeviceAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DeviceData | null>(null)

  useEffect(() => {
    fetchDeviceAnalytics()
  }, [mailboxId, period])

  const fetchDeviceAnalytics = async () => {
    try {
      setLoading(true)
      const startDate = getStartDate(period)
      const params = new URLSearchParams({
        mailboxId,
        ...(startDate && { startDate }),
        endDate: new Date().toISOString()
      })

      const response = await fetch(`/api/email/analytics/device?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching device analytics:', error)
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

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />
      case 'desktop':
        return <Monitor className="w-4 h-4" />
      case 'tablet':
        return <Tablet className="w-4 h-4" />
      default:
        return <Globe className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading device analytics...</div>
      </div>
    )
  }

  if (!data || data.totals.totalEvents === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No device data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Events</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.totalEvents.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Opens</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.totalOpens.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Clicks</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.totalClicks.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Device Type Breakdown */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Device Type Breakdown
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.deviceTypeBreakdown}
                  dataKey="total"
                  nameKey="deviceType"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                >
                  {data.deviceTypeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.deviceTypeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="deviceType" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="opens" fill={COLORS.secondary} name="Opens" />
                <Bar dataKey="clicks" fill={COLORS.accent} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device Type List */}
        <div className="mt-6 space-y-2">
          {data.deviceTypeBreakdown.map((device, index) => (
            <div
              key={device.deviceType}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-600 dark:text-gray-400">
                  {getDeviceIcon(device.deviceType)}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">
                    {device.deviceType}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {device.opens} opens, {device.clicks} clicks
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {device.percentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {device.total.toLocaleString()} events
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Browser Breakdown */}
      {data.browserBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Browser Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.browserBreakdown.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="browser" 
                tick={{ fill: '#6b7280', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="opens" fill={COLORS.secondary} name="Opens" />
              <Bar dataKey="clicks" fill={COLORS.accent} name="Clicks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* OS Breakdown */}
      {data.osBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Operating System Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.osBreakdown.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="os" 
                tick={{ fill: '#6b7280', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="opens" fill={COLORS.secondary} name="Opens" />
              <Bar dataKey="clicks" fill={COLORS.accent} name="Clicks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

