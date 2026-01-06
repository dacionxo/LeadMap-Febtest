/**
 * Time-Based Engagement Analysis
 * Analyzes engagement patterns by time of day, day of week, and provides optimal send time recommendations
 * Following Mautic patterns for send time optimization
 */

/**
 * Time analysis result for a specific time period
 */
export interface TimePeriodAnalysis {
  hour?: number // 0-23
  dayOfWeek?: number // 0-6 (Sunday = 0)
  opens: number
  clicks: number
  replies: number
  totalEvents: number
  engagementRate: number // Percentage of sent emails that resulted in engagement
  averageScore: number // Average engagement score for this time period
}

/**
 * Optimal send time recommendation
 */
export interface OptimalSendTime {
  hour: number // 0-23
  dayOfWeek: number // 0-6
  dayName: string
  score: number // Recommendation score (0-100)
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Engagement pattern analysis
 */
export interface EngagementPattern {
  bestHour: number
  bestDayOfWeek: number
  bestDayName: string
  worstHour: number
  worstDayOfWeek: number
  worstDayName: string
  hourlyPattern: TimePeriodAnalysis[]
  dailyPattern: TimePeriodAnalysis[]
  recommendations: OptimalSendTime[]
}

/**
 * Analyze engagement by hour of day
 */
export function analyzeByHour(
  events: Array<{
    event_type: string
    event_timestamp: string | Date
  }>
): TimePeriodAnalysis[] {
  const hourlyData = new Map<number, {
    opens: number
    clicks: number
    replies: number
    total: number
  }>()

  // Initialize all hours
  for (let hour = 0; hour < 24; hour++) {
    hourlyData.set(hour, { opens: 0, clicks: 0, replies: 0, total: 0 })
  }

  // Aggregate events by hour
  for (const event of events) {
    const timestamp = event.event_timestamp instanceof Date
      ? event.event_timestamp
      : new Date(event.event_timestamp)
    
    const hour = timestamp.getHours()

    const data = hourlyData.get(hour)!
    data.total++

    switch (event.event_type) {
      case 'opened':
        data.opens++
        break
      case 'clicked':
        data.clicks++
        break
      case 'replied':
        data.replies++
        break
    }
  }

  // Convert to analysis format
  return Array.from(hourlyData.entries()).map(([hour, data]) => ({
    hour,
    opens: data.opens,
    clicks: data.clicks,
    replies: data.replies,
    totalEvents: data.total,
    engagementRate: data.total > 0 ? (data.total / events.length) * 100 : 0,
    averageScore: calculateAverageScore(data)
  }))
}

/**
 * Analyze engagement by day of week
 */
export function analyzeByDayOfWeek(
  events: Array<{
    event_type: string
    event_timestamp: string | Date
  }>
): TimePeriodAnalysis[] {
  const dailyData = new Map<number, {
    opens: number
    clicks: number
    replies: number
    total: number
  }>()

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Initialize all days
  for (let day = 0; day < 7; day++) {
    dailyData.set(day, { opens: 0, clicks: 0, replies: 0, total: 0 })
  }

  // Aggregate events by day of week
  for (const event of events) {
    const timestamp = event.event_timestamp instanceof Date
      ? event.event_timestamp
      : new Date(event.event_timestamp)
    
    const dayOfWeek = timestamp.getDay()

    const data = dailyData.get(dayOfWeek)!
    data.total++

    switch (event.event_type) {
      case 'opened':
        data.opens++
        break
      case 'clicked':
        data.clicks++
        break
      case 'replied':
        data.replies++
        break
    }
  }

  // Convert to analysis format
  return Array.from(dailyData.entries()).map(([dayOfWeek, data]) => ({
    dayOfWeek,
    opens: data.opens,
    clicks: data.clicks,
    replies: data.replies,
    totalEvents: data.total,
    engagementRate: data.total > 0 ? (data.total / events.length) * 100 : 0,
    averageScore: calculateAverageScore(data)
  }))
}

/**
 * Calculate average engagement score for time period
 */
function calculateAverageScore(data: {
  opens: number
  clicks: number
  replies: number
  total: number
}): number {
  if (data.total === 0) {
    return 0
  }

  // Simple scoring: opens = 1, clicks = 2, replies = 5
  const score = (data.opens * 1) + (data.clicks * 2) + (data.replies * 5)
  return score / data.total
}

/**
 * Analyze engagement patterns and generate recommendations
 */
export function analyzeEngagementPatterns(
  events: Array<{
    event_type: string
    event_timestamp: string | Date
  }>,
  sentCounts?: Array<{
    hour?: number
    dayOfWeek?: number
    count: number
  }>
): EngagementPattern {
  const hourlyAnalysis = analyzeByHour(events)
  const dailyAnalysis = analyzeByDayOfWeek(events)

  // Find best and worst times
  const bestHour = hourlyAnalysis.reduce((best, current) =>
    current.engagementRate > best.engagementRate ? current : best
  )
  const worstHour = hourlyAnalysis.reduce((worst, current) =>
    current.engagementRate < worst.engagementRate ? current : worst
  )

  const bestDay = dailyAnalysis.reduce((best, current) =>
    current.engagementRate > best.engagementRate ? current : best
  )
  const worstDay = dailyAnalysis.reduce((worst, current) =>
    current.engagementRate < worst.engagementRate ? current : worst
  )

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Generate recommendations
  const recommendations = generateOptimalSendTimeRecommendations(
    hourlyAnalysis,
    dailyAnalysis,
    sentCounts
  )

  return {
    bestHour: bestHour.hour!,
    bestDayOfWeek: bestDay.dayOfWeek!,
    bestDayName: dayNames[bestDay.dayOfWeek!],
    worstHour: worstHour.hour!,
    worstDayOfWeek: worstDay.dayOfWeek!,
    worstDayName: dayNames[worstDay.dayOfWeek!],
    hourlyPattern: hourlyAnalysis,
    dailyPattern: dailyAnalysis,
    recommendations
  }
}

/**
 * Generate optimal send time recommendations
 */
function generateOptimalSendTimeRecommendations(
  hourlyAnalysis: TimePeriodAnalysis[],
  dailyAnalysis: TimePeriodAnalysis[],
  sentCounts?: Array<{
    hour?: number
    dayOfWeek?: number
    count: number
  }>
): OptimalSendTime[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const recommendations: OptimalSendTime[] = []

  // Find top 3 hour/day combinations
  const combinations: Array<{
    hour: number
    dayOfWeek: number
    score: number
    engagementRate: number
    sampleSize: number
  }> = []

  for (const hourData of hourlyAnalysis) {
    for (const dayData of dailyAnalysis) {
      // Calculate combined score
      const engagementScore = (hourData.engagementRate + dayData.engagementRate) / 2
      const sampleSize = hourData.totalEvents + dayData.totalEvents

      // Adjust score based on sample size (more data = higher confidence)
      const sampleSizeMultiplier = Math.min(1, sampleSize / 100) // Normalize to 0-1
      const finalScore = engagementScore * (0.7 + 0.3 * sampleSizeMultiplier)

      combinations.push({
        hour: hourData.hour!,
        dayOfWeek: dayData.dayOfWeek!,
        score: finalScore,
        engagementRate: engagementScore,
        sampleSize
      })
    }
  }

  // Sort by score and take top 3
  const topCombinations = combinations
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  for (const combo of topCombinations) {
    let confidence: 'high' | 'medium' | 'low'
    if (combo.sampleSize >= 50) {
      confidence = 'high'
    } else if (combo.sampleSize >= 20) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    let reason = `High engagement rate (${combo.engagementRate.toFixed(1)}%)`
    if (combo.sampleSize < 20) {
      reason += ' - Limited data, consider testing'
    }

    recommendations.push({
      hour: combo.hour,
      dayOfWeek: combo.dayOfWeek,
      dayName: dayNames[combo.dayOfWeek],
      score: Math.round(combo.score),
      reason,
      confidence
    })
  }

  return recommendations
}

/**
 * Get time zone-aware hour for a timestamp
 */
export function getLocalHour(timestamp: Date, timezone?: string): number {
  if (timezone) {
    // Use timezone if provided
    return parseInt(
      timestamp.toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      })
    )
  }
  
  // Default to local time
  return timestamp.getHours()
}

/**
 * Format hour for display
 */
export function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}




