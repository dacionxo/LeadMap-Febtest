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
import { MapPin, Globe } from 'lucide-react'

interface LocationAnalyticsProps {
  mailboxId?: string
  period?: '7d' | '30d' | '90d' | 'all'
}

interface LocationData {
  countryBreakdown: Array<{
    country: string
    total: number
    opens: number
    clicks: number
    percentage: number
  }>
  cityBreakdown: Array<{
    city: string
    country: string
    total: number
    opens: number
    clicks: number
    percentage: number
  }>
  timezoneBreakdown: Array<{
    timezone: string
    total: number
    opens: number
    clicks: number
    percentage: number
  }>
  totals: {
    totalEvents: number
    totalOpens: number
    totalClicks: number
    uniqueCountries: number
    uniqueCities: number
    uniqueTimezones: number
  }
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

/**
 * Location Analytics Component
 * Displays geographic breakdown of email engagement
 * Following Mautic patterns for location analytics
 */
export default function LocationAnalytics({ mailboxId = 'all', period = '30d' }: LocationAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LocationData | null>(null)

  useEffect(() => {
    fetchLocationAnalytics()
  }, [mailboxId, period])

  const fetchLocationAnalytics = async () => {
    try {
      setLoading(true)
      const startDate = getStartDate(period)
      const params = new URLSearchParams({
        mailboxId,
        ...(startDate && { startDate }),
        endDate: new Date().toISOString()
      })

      const response = await fetch(`/api/email/analytics/location?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching location analytics:', error)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading location analytics...</div>
      </div>
    )
  }

  if (!data || data.totals.totalEvents === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No location data available</p>
        <p className="text-sm text-gray-400 mt-2">
          Location data requires IP geolocation service integration
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Events</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.totalEvents.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Countries</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.uniqueCountries}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Cities</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.uniqueCities}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Timezones</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data.totals.uniqueTimezones}
          </div>
        </div>
      </div>

      {/* Country Breakdown */}
      {data.countryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Country Breakdown
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.countryBreakdown.slice(0, 10)}
                    dataKey="total"
                    nameKey="country"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {data.countryBreakdown.slice(0, 10).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.countryBreakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="country"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="opens" fill="#10b981" name="Opens" />
                  <Bar dataKey="clicks" fill="#8b5cf6" name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Country List */}
          <div className="mt-6 space-y-2">
            {data.countryBreakdown.slice(0, 10).map((country, index) => (
              <div
                key={country.country}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {country.country}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {country.opens} opens, {country.clicks} clicks
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {country.percentage.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {country.total.toLocaleString()} events
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cities */}
      {data.cityBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Cities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.cityBreakdown.slice(0, 12).map((city, index) => (
              <div
                key={`${city.city}-${city.country}`}
                className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <div className="font-medium text-gray-900 dark:text-white">{city.city}</div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{city.country}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {city.opens} opens, {city.clicks} clicks
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {city.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timezone Breakdown */}
      {data.timezoneBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Timezone Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.timezoneBreakdown.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="timezone"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="opens" fill="#10b981" name="Opens" />
              <Bar dataKey="clicks" fill="#8b5cf6" name="Clicks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

