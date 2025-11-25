'use client'

import { useMemo, useEffect, useState } from 'react'
import {
  LineChart,
  Line,
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
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts'

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  MapPin,
  Target,
  Sparkles,
  AlertCircle,
  Lightbulb,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react'

interface Listing {
  listing_id: string
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  list_price?: number | null
  beds?: number | null
  full_baths?: number | null
  sqft?: number | null
  year_built?: number | null
  status?: string | null
  active?: boolean
  ai_investment_score?: number | null
  agent_email?: string | null
  agent_phone?: string | null
  agent_name?: string | null
  created_at?: string
  updated_at?: string
  list_price_min?: number | null
  list_price_max?: number | null
  price_per_sqft?: number | null
}

interface ProspectAnalyticsProps {
  listings: Listing[]
  loading?: boolean
}

const COLORS = {
  primary: '#7F63C7',
  secondary: '#4A90E2',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F97316'
}

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.info,
  COLORS.purple,
  COLORS.pink
]

export default function ProspectAnalytics({ listings, loading }: ProspectAnalyticsProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])
  // Calculate time-based trends
  const timeSeriesData = useMemo(() => {
    const now = new Date()
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now)
      date.setDate(date.getDate() - (29 - i))
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateValue: date,
        leads: 0,
        value: 0,
        avgScore: 0,
        expired: 0
      }
    })

    listings.forEach(listing => {
      if (!listing.created_at) return
      const createdDate = new Date(listing.created_at)
      const daysAgo = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysAgo >= 0 && daysAgo < 30) {
        const dayData = last30Days[29 - daysAgo]
        dayData.leads += 1
        dayData.value += listing.list_price || 0
        if (listing.ai_investment_score) {
          dayData.avgScore = (dayData.avgScore * (dayData.leads - 1) + listing.ai_investment_score) / dayData.leads
        }
        if (listing.status && (
          listing.status.toLowerCase().includes('expired') ||
          listing.status.toLowerCase().includes('sold')
        )) {
          dayData.expired += 1
        }
      }
    })

    return last30Days
  }, [listings])

  // Price distribution
  const priceDistribution = useMemo(() => {
    const ranges = [
      { name: '$0-100K', min: 0, max: 100000, count: 0, value: 0 },
      { name: '$100-250K', min: 100000, max: 250000, count: 0, value: 0 },
      { name: '$250-500K', min: 250000, max: 500000, count: 0, value: 0 },
      { name: '$500K-1M', min: 500000, max: 1000000, count: 0, value: 0 },
      { name: '$1M+', min: 1000000, max: Infinity, count: 0, value: 0 }
    ]

    listings.forEach(listing => {
      const price = listing.list_price || 0
      const range = ranges.find(r => price >= r.min && price < r.max)
      if (range) {
        range.count += 1
        range.value += price
      }
    })

    return ranges.filter(r => r.count > 0)
  }, [listings])

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statuses: Record<string, number> = {}
    listings.forEach(listing => {
      const status = listing.active 
        ? 'Active' 
        : listing.status?.toLowerCase().includes('expired') 
        ? 'Expired'
        : listing.status?.toLowerCase().includes('sold')
        ? 'Sold'
        : listing.status || 'Unknown'
      statuses[status] = (statuses[status] || 0) + 1
    })
    return Object.entries(statuses).map(([name, value]) => ({ name, value }))
  }, [listings])

  // Geographic distribution
  const geographicData = useMemo(() => {
    const states: Record<string, { count: number; value: number; avgScore: number; scores: number[] }> = {}
    listings.forEach(listing => {
      if (!listing.state) return
      if (!states[listing.state]) {
        states[listing.state] = { count: 0, value: 0, avgScore: 0, scores: [] }
      }
      states[listing.state].count += 1
      states[listing.state].value += listing.list_price || 0
      if (listing.ai_investment_score) {
        states[listing.state].scores.push(listing.ai_investment_score)
      }
    })

    return Object.entries(states)
      .map(([state, data]) => ({
        state,
        count: data.count,
        value: data.value,
        avgScore: data.scores.length > 0 
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [listings])

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const ranges = [
      { name: '0-20', min: 0, max: 20, count: 0 },
      { name: '20-40', min: 20, max: 40, count: 0 },
      { name: '40-60', min: 40, max: 60, count: 0 },
      { name: '60-80', min: 60, max: 80, count: 0 },
      { name: '80-100', min: 80, max: 100, count: 0 }
    ]

    listings.forEach(listing => {
      const score = listing.ai_investment_score
      if (score !== null && score !== undefined) {
        const range = ranges.find(r => score >= r.min && score < r.max)
        if (range) range.count += 1
      }
    })

    return ranges.filter(r => r.count > 0)
  }, [listings])

  // Price vs Score correlation
  const priceScoreData = useMemo(() => {
    return listings
      .filter(l => l.list_price && l.ai_investment_score)
      .map(l => ({
        price: (l.list_price || 0) / 1000, // in thousands
        score: l.ai_investment_score || 0,
        size: l.sqft || 0
      }))
      .slice(0, 100) // Limit for performance
  }, [listings])

  // Key metrics
  const metrics = useMemo(() => {
    const totalValue = listings.reduce((sum, l) => sum + (l.list_price || 0), 0)
    const avgPrice = listings.length > 0 ? totalValue / listings.length : 0
    const enrichedCount = listings.filter(l => 
      l.agent_email || l.agent_phone || l.agent_name || l.ai_investment_score
    ).length
    const enrichedLeads = listings.filter(l => l.ai_investment_score !== null && l.ai_investment_score !== undefined)
    const avgScore = enrichedLeads.length > 0
      ? enrichedLeads.reduce((sum, l) => sum + (l.ai_investment_score || 0), 0) / enrichedLeads.length
      : 0
    const highValueCount = listings.filter(l => (l.list_price || 0) >= 500000).length
    const expiredCount = listings.filter(l => 
      l.status && (l.status.toLowerCase().includes('expired') || l.status.toLowerCase().includes('sold'))
    ).length

    // Calculate trends
    const last7Days = listings.filter(l => {
      if (!l.created_at) return false
      const daysAgo = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo <= 7
    }).length
    const previous7Days = listings.filter(l => {
      if (!l.created_at) return false
      const daysAgo = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo > 7 && daysAgo <= 14
    }).length
    const growthRate = previous7Days > 0 ? ((last7Days - previous7Days) / previous7Days) * 100 : 0

    return {
      total: listings.length,
      totalValue,
      avgPrice,
      enrichedCount,
      enrichmentRate: listings.length > 0 ? (enrichedCount / listings.length) * 100 : 0,
      avgScore,
      highValueCount,
      expiredCount,
      growthRate,
      last7Days
    }
  }, [listings])

  // AI Insights
  const insights = useMemo(() => {
    const insightsList: Array<{ type: 'success' | 'warning' | 'info'; icon: any; title: string; description: string }> = []

    // High-value opportunity
    if (metrics.highValueCount > 0) {
      insightsList.push({
        type: 'success',
        icon: DollarSign,
        title: 'High-Value Opportunities',
        description: `${metrics.highValueCount} properties over $500K identified. Focus on these for maximum ROI.`
      })
    }

    // Growth trend
    if (metrics.growthRate > 20) {
      insightsList.push({
        type: 'success',
        icon: TrendingUp,
        title: 'Strong Growth Trend',
        description: `Lead volume increased ${metrics.growthRate.toFixed(0)}% in the last 7 days. Market is heating up!`
      })
    } else if (metrics.growthRate < -10) {
      insightsList.push({
        type: 'warning',
        icon: TrendingDown,
        title: 'Declining Lead Volume',
        description: `Lead volume decreased ${Math.abs(metrics.growthRate).toFixed(0)}%. Consider expanding your search criteria.`
      })
    }

    // Enrichment opportunity
    if (metrics.enrichmentRate < 50) {
      insightsList.push({
        type: 'info',
        icon: Sparkles,
        title: 'Enrichment Opportunity',
        description: `Only ${metrics.enrichmentRate.toFixed(0)}% of leads are enriched. Run enrichment to unlock more insights.`
      })
    }

    // Score distribution
    const highScoreLeads = listings.filter(l => (l.ai_investment_score || 0) >= 70).length
    if (highScoreLeads > 0) {
      insightsList.push({
        type: 'success',
        icon: Target,
        title: 'High-Score Prospects',
        description: `${highScoreLeads} prospects with AI scores ≥70. These are your top priority leads.`
      })
    }

    // Geographic concentration
    if (geographicData.length > 0) {
      const topState = geographicData[0]
      if (topState.count > listings.length * 0.3) {
        insightsList.push({
          type: 'info',
          icon: MapPin,
          title: 'Geographic Concentration',
          description: `${topState.state} represents ${((topState.count / listings.length) * 100).toFixed(0)}% of your leads. Consider diversifying.`
        })
      }
    }

    return insightsList.slice(0, 4)
  }, [metrics, listings, geographicData])

  if (loading || !isMounted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-xxl)',
        color: 'var(--color-ui-text-base-tertiary)'
      }}>
        Loading analytics...
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-lg)',
      padding: 'var(--spacing-lg)',
      background: 'var(--color-ui-background-secondary)',
      height: '100%',
      overflowY: 'auto'
    }}>
      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)'
      }}>
        <MetricCard
          icon={Target}
          label="Total Prospects"
          value={metrics.total.toLocaleString()}
          change={metrics.growthRate > 0 ? `+${metrics.growthRate.toFixed(0)}%` : `${metrics.growthRate.toFixed(0)}%`}
          trend={metrics.growthRate > 0 ? 'up' : 'down'}
          color={COLORS.primary}
        />
        <MetricCard
          icon={DollarSign}
          label="Total Value"
          value={`$${(metrics.totalValue / 1000000).toFixed(1)}M`}
          change={`${metrics.highValueCount} high-value`}
          trend="neutral"
          color={COLORS.success}
        />
        <MetricCard
          icon={Sparkles}
          label="Enrichment Rate"
          value={`${metrics.enrichmentRate.toFixed(0)}%`}
          change={`${metrics.enrichedCount} enriched`}
          trend="up"
          color={COLORS.purple}
        />
        <MetricCard
          icon={Activity}
          label="Avg AI Score"
          value={metrics.avgScore.toFixed(1)}
          change={`${listings.filter(l => (l.ai_investment_score || 0) >= 70).length} high-score`}
          trend="up"
          color={COLORS.info}
        />
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div style={{
          background: 'var(--color-ui-background-primary)',
          border: `1px solid var(--color-ui-border-default)`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-lg)',
          boxShadow: 'var(--elevation-2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-md)'
          }}>
            <Lightbulb style={{ width: '20px', height: '20px', color: COLORS.warning }} />
            <h3 style={{
              fontFamily: 'var(--family-base-body)',
              fontSize: 'var(--type-size-step-4)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--color-ui-text-base-primary)',
              margin: 0
            }}>
              AI-Powered Insights
            </h3>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--spacing-md)'
          }}>
            {insights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: 'var(--spacing-md)',
                  background: insight.type === 'success' 
                    ? 'rgba(16, 185, 129, 0.1)'
                    : insight.type === 'warning'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(6, 182, 212, 0.1)',
                  border: `1px solid ${
                    insight.type === 'success'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : insight.type === 'warning'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(6, 182, 212, 0.3)'
                  }`,
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <insight.icon style={{
                    width: '16px',
                    height: '16px',
                    color: insight.type === 'success' ? COLORS.success : insight.type === 'warning' ? COLORS.warning : COLORS.info
                  }} />
                  <h4 style={{
                    fontFamily: 'var(--family-base-body)',
                    fontSize: 'var(--type-size-step-2)',
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--color-ui-text-base-primary)',
                    margin: 0
                  }}>
                    {insight.title}
                  </h4>
                </div>
                <p style={{
                  fontFamily: 'var(--family-base-body)',
                  fontSize: 'var(--type-size-step-1)',
                  color: 'var(--color-ui-text-base-secondary)',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  {insight.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 'var(--spacing-lg)'
      }}>
        {/* Time Series Trend */}
        <ChartCard title="30-Day Lead Trend" icon={Activity}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ui-border-default)" />
              <XAxis 
                dataKey="date" 
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-ui-background-primary)',
                  border: `1px solid var(--color-ui-border-default)`,
                  borderRadius: 'var(--radius-sm)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="leads" 
                stroke={COLORS.primary} 
                fillOpacity={1} 
                fill="url(#colorLeads)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Price Distribution */}
        <ChartCard title="Price Distribution" icon={DollarSign}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priceDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ui-border-default)" />
              <XAxis 
                dataKey="name" 
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-ui-background-primary)',
                  border: `1px solid var(--color-ui-border-default)`,
                  borderRadius: 'var(--radius-sm)'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Properties']}
              />
              <Bar dataKey="count" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status Distribution */}
        <ChartCard title="Status Distribution" icon={PieChartIcon}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--color-ui-background-primary)',
                  border: `1px solid var(--color-ui-border-default)`,
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Geographic Distribution */}
        <ChartCard title="Top States by Volume" icon={MapPin}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={geographicData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ui-border-default)" />
              <XAxis 
                type="number"
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                dataKey="state" 
                type="category"
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-ui-background-primary)',
                  border: `1px solid var(--color-ui-border-default)`,
                  borderRadius: 'var(--radius-sm)'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Properties']}
              />
              <Bar dataKey="count" fill={COLORS.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Score Distribution */}
        <ChartCard title="AI Score Distribution" icon={Target}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ui-border-default)" />
              <XAxis 
                dataKey="name" 
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="var(--color-ui-text-base-tertiary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-ui-background-primary)',
                  border: `1px solid var(--color-ui-border-default)`,
                  borderRadius: 'var(--radius-sm)'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Properties']}
              />
              <Bar dataKey="count" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Price vs Score Correlation */}
        {priceScoreData.length > 0 && (
          <ChartCard title="Price vs AI Score Correlation" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={priceScoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ui-border-default)" />
                <XAxis 
                  type="number" 
                  dataKey="price" 
                  name="Price (K)"
                  stroke="var(--color-ui-text-base-tertiary)"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Price (Thousands)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="score" 
                  name="AI Score"
                  stroke="var(--color-ui-text-base-tertiary)"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'AI Score', angle: -90, position: 'insideLeft' }}
                />
                <ZAxis type="number" dataKey="size" range={[50, 400]} name="Size (sqft)" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: 'var(--color-ui-background-primary)',
                    border: `1px solid var(--color-ui-border-default)`,
                    borderRadius: 'var(--radius-sm)'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Price (K)') return [`$${value.toLocaleString()}K`, 'Price']
                    if (name === 'AI Score') return [value.toFixed(1), 'Score']
                    return [value.toLocaleString(), 'Size (sqft)']
                  }}
                />
                <Scatter name="Properties" data={priceScoreData} fill={COLORS.info} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  change, 
  trend, 
  color 
}: { 
  icon: any
  label: string
  value: string
  change: string
  trend: 'up' | 'down' | 'neutral'
  color: string
}) {
  return (
    <div style={{
      background: 'var(--color-ui-background-primary)',
      border: `1px solid var(--color-ui-border-default)`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--spacing-lg)',
      boxShadow: 'var(--elevation-2)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-sm)'
      }}>
        <span style={{
          fontFamily: 'var(--family-base-body)',
          fontSize: 'var(--type-size-step-1)',
          color: 'var(--color-ui-text-base-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {label}
        </span>
        <Icon style={{ width: '20px', height: '20px', color }} />
      </div>
      <div style={{
        fontFamily: 'var(--family-base-body)',
        fontSize: 'var(--type-size-step-6)',
        fontWeight: 'var(--weight-bold)',
        color: 'var(--color-ui-text-base-primary)',
        marginBottom: 'var(--spacing-xs)'
      }}>
        {value}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        fontFamily: 'var(--family-base-body)',
        fontSize: 'var(--type-size-step-1)',
        color: trend === 'up' ? COLORS.success : trend === 'down' ? COLORS.danger : 'var(--color-ui-text-base-tertiary)'
      }}>
        {trend === 'up' && <TrendingUp style={{ width: '14px', height: '14px' }} />}
        {trend === 'down' && <TrendingDown style={{ width: '14px', height: '14px' }} />}
        <span>{change}</span>
      </div>
    </div>
  )
}

function ChartCard({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--color-ui-background-primary)',
      border: `1px solid var(--color-ui-border-default)`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--spacing-lg)',
      boxShadow: 'var(--elevation-2)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-md)'
      }}>
        <Icon style={{ width: '18px', height: '18px', color: COLORS.primary }} />
        <h3 style={{
          fontFamily: 'var(--family-base-body)',
          fontSize: 'var(--type-size-step-3)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-ui-text-base-primary)',
          margin: 0
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}
