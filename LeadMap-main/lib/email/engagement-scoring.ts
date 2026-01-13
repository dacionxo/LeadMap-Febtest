/**
 * Mautic-Inspired Engagement Scoring System
 * Calculates contact engagement based on email interactions with time decay
 * Following Mautic patterns for behavior scoring
 */

/**
 * Engagement score factors
 * Each action contributes points that decay over time
 */
export interface EngagementFactors {
  opens: number
  clicks: number
  replies: number
  timeDecay: number
  recentActivity: number
}

/**
 * Engagement score result
 */
export interface EngagementScore {
  score: number // 0-100
  factors: EngagementFactors
  lastEngagement: Date | null
  trend: 'increasing' | 'stable' | 'decreasing'
  level: 'high' | 'medium' | 'low' | 'inactive'
}

/**
 * Engagement event data for scoring
 */
export interface EngagementEvent {
  eventType: 'opened' | 'clicked' | 'replied'
  timestamp: Date
  emailId: string
}

/**
 * Engagement scoring configuration
 * Following Mautic point system patterns
 */
export interface EngagementConfig {
  /** Points for opening an email */
  openPoints: number
  /** Points for clicking a link */
  clickPoints: number
  /** Points for replying */
  replyPoints: number
  /** Time decay factor (0-1, higher = faster decay) */
  decayFactor: number
  /** Days until engagement fully decays */
  decayPeriod: number
  /** Bonus for recent activity (within last N days) */
  recentActivityDays: number
  /** Bonus multiplier for recent activity */
  recentActivityMultiplier: number
}

/**
 * Default engagement scoring configuration
 * Based on Mautic best practices
 */
export const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  openPoints: 5,
  clickPoints: 10,
  replyPoints: 25,
  decayFactor: 0.95, // 5% decay per day
  decayPeriod: 90, // 90 days for full decay
  recentActivityDays: 7, // Last 7 days
  recentActivityMultiplier: 1.5 // 50% bonus for recent activity
}

/**
 * Calculate time decay factor
 * Engagement decreases over time following exponential decay
 */
function calculateTimeDecay(
  daysSinceEvent: number,
  config: EngagementConfig
): number {
  if (daysSinceEvent <= 0) {
    return 1.0
  }

  if (daysSinceEvent >= config.decayPeriod) {
    return 0.0
  }

  // Exponential decay: decayFactor^daysSinceEvent
  return Math.pow(config.decayFactor, daysSinceEvent)
}

/**
 * Calculate engagement score from events
 * Following Mautic behavior scoring patterns
 */
export function calculateEngagementScore(
  events: EngagementEvent[],
  config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG,
  referenceDate: Date = new Date()
): EngagementScore {
  if (events.length === 0) {
    return {
      score: 0,
      factors: {
        opens: 0,
        clicks: 0,
        replies: 0,
        timeDecay: 0,
        recentActivity: 0
      },
      lastEngagement: null,
      trend: 'stable',
      level: 'inactive'
    }
  }

  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  )

  const lastEngagement = sortedEvents[0].timestamp
  const daysSinceLastEngagement = Math.floor(
    (referenceDate.getTime() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calculate points for each event type with time decay
  let totalPoints = 0
  let opens = 0
  let clicks = 0
  let replies = 0
  let recentActivityPoints = 0

  for (const event of sortedEvents) {
    const daysSinceEvent = Math.floor(
      (referenceDate.getTime() - event.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Skip events older than decay period
    if (daysSinceEvent >= config.decayPeriod) {
      continue
    }

    const decay = calculateTimeDecay(daysSinceEvent, config)
    const isRecent = daysSinceEvent <= config.recentActivityDays

    let eventPoints = 0

    switch (event.eventType) {
      case 'opened':
        eventPoints = config.openPoints
        opens++
        break
      case 'clicked':
        eventPoints = config.clickPoints
        clicks++
        break
      case 'replied':
        eventPoints = config.replyPoints
        replies++
        break
    }

    // Apply time decay
    const decayedPoints = eventPoints * decay

    // Apply recent activity bonus
    const finalPoints = isRecent
      ? decayedPoints * config.recentActivityMultiplier
      : decayedPoints

    totalPoints += finalPoints

    if (isRecent) {
      recentActivityPoints += finalPoints
    }
  }

  // Normalize score to 0-100 scale
  // Maximum possible score: (openPoints + clickPoints + replyPoints) * recentActivityMultiplier
  // For default config: (5 + 10 + 25) * 1.5 = 60 points max per event
  // We'll use a scaling factor to normalize to 0-100
  const maxPossibleScore = 100 // Normalized maximum
  const rawMaxScore = (config.openPoints + config.clickPoints + config.replyPoints) * config.recentActivityMultiplier * 10
  const normalizedScore = Math.min(100, (totalPoints / rawMaxScore) * maxPossibleScore)

  // Determine engagement level
  let level: 'high' | 'medium' | 'low' | 'inactive'
  if (normalizedScore >= 70) {
    level = 'high'
  } else if (normalizedScore >= 40) {
    level = 'medium'
  } else if (normalizedScore >= 10) {
    level = 'low'
  } else {
    level = 'inactive'
  }

  // Determine trend (simplified - compare recent vs older activity)
  const recentEvents = sortedEvents.filter(
    e => (referenceDate.getTime() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24) <= config.recentActivityDays
  )
  const olderEvents = sortedEvents.filter(
    e => (referenceDate.getTime() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24) > config.recentActivityDays
  )

  let trend: 'increasing' | 'stable' | 'decreasing'
  if (recentEvents.length > olderEvents.length * 1.5) {
    trend = 'increasing'
  } else if (recentEvents.length < olderEvents.length * 0.5) {
    trend = 'decreasing'
  } else {
    trend = 'stable'
  }

  return {
    score: Math.round(normalizedScore * 100) / 100, // Round to 2 decimal places
    factors: {
      opens,
      clicks,
      replies,
      timeDecay: 1 - calculateTimeDecay(daysSinceLastEngagement, config),
      recentActivity: recentActivityPoints
    },
    lastEngagement,
    trend,
    level
  }
}

/**
 * Calculate engagement score from email events data
 * Helper function to convert database events to engagement score
 */
export function calculateEngagementFromEvents(
  events: Array<{
    event_type: string
    event_timestamp: string | Date
    email_id: string
  }>,
  config?: EngagementConfig
): EngagementScore {
  const engagementEvents: EngagementEvent[] = events
    .filter(e => ['opened', 'clicked', 'replied'].includes(e.event_type))
    .map(e => ({
      eventType: e.event_type as 'opened' | 'clicked' | 'replied',
      timestamp: e.event_timestamp instanceof Date
        ? e.event_timestamp
        : new Date(e.event_timestamp),
      emailId: e.email_id
    }))

  return calculateEngagementScore(engagementEvents, config)
}

/**
 * Get engagement level description
 */
export function getEngagementLevelDescription(level: EngagementScore['level']): string {
  switch (level) {
    case 'high':
      return 'Highly engaged - frequent opens, clicks, and replies'
    case 'medium':
      return 'Moderately engaged - regular email interactions'
    case 'low':
      return 'Low engagement - occasional email interactions'
    case 'inactive':
      return 'Inactive - no recent email engagement'
    default:
      return 'Unknown engagement level'
  }
}

/**
 * Get engagement trend description
 */
export function getEngagementTrendDescription(trend: EngagementScore['trend']): string {
  switch (trend) {
    case 'increasing':
      return 'Engagement is increasing - more activity recently'
    case 'stable':
      return 'Engagement is stable - consistent activity levels'
    case 'decreasing':
      return 'Engagement is decreasing - less activity recently'
    default:
      return 'Unknown trend'
  }
}










