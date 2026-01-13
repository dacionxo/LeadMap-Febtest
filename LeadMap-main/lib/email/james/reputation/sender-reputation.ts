/**
 * Email Reputation and Sender Scoring
 * 
 * Sender reputation patterns following james-project and industry best practices
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project reputation patterns
 */

/**
 * Reputation score
 */
export interface ReputationScore {
  sender: string
  domain: string
  score: number // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  factors: {
    deliveryRate: number
    openRate: number
    clickRate: number
    bounceRate: number
    complaintRate: number
    spamRate: number
    volume: number
  }
  lastUpdated: Date
}

/**
 * Reputation factor weights
 */
export interface ReputationWeights {
  deliveryRate: number // Default: 0.3
  openRate: number // Default: 0.2
  clickRate: number // Default: 0.15
  bounceRate: number // Default: 0.2
  complaintRate: number // Default: 0.1
  spamRate: number // Default: 0.05
}

/**
 * Default reputation weights
 */
export const DEFAULT_REPUTATION_WEIGHTS: ReputationWeights = {
  deliveryRate: 0.3,
  openRate: 0.2,
  clickRate: 0.15,
  bounceRate: 0.2,
  complaintRate: 0.1,
  spamRate: 0.05,
}

/**
 * Sender reputation manager
 * Following james-project reputation patterns
 */
export class SenderReputationManager {
  private scores: Map<string, ReputationScore> = new Map()
  private weights: ReputationWeights

  constructor(weights: ReputationWeights = DEFAULT_REPUTATION_WEIGHTS) {
    this.weights = weights
  }

  /**
   * Calculate reputation score
   * 
   * @param sender - Sender email
   * @param stats - Statistics
   * @returns Reputation score
   */
  calculateScore(
    sender: string,
    stats: {
      sent: number
      delivered: number
      opened: number
      clicked: number
      bounced: number
      complained: number
      spam: number
    }
  ): ReputationScore {
    const domain = this.extractDomain(sender)
    const total = stats.sent || 1

    const factors = {
      deliveryRate: (stats.delivered / total) * 100,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
      clickRate: stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0,
      bounceRate: (stats.bounced / total) * 100,
      complaintRate: (stats.complained / total) * 100,
      spamRate: (stats.spam / total) * 100,
      volume: Math.min(stats.sent / 1000, 1) * 100, // Normalize to 0-100
    }

    // Calculate weighted score
    let score = 0
    score += factors.deliveryRate * this.weights.deliveryRate
    score += factors.openRate * this.weights.openRate
    score += factors.clickRate * this.weights.clickRate
    score -= factors.bounceRate * this.weights.bounceRate
    score -= factors.complaintRate * this.weights.complaintRate
    score -= factors.spamRate * this.weights.spamRate

    // Normalize to 0-100
    score = Math.max(0, Math.min(100, score))

    const level = this.getScoreLevel(score)

    const reputationScore: ReputationScore = {
      sender,
      domain,
      score,
      level,
      factors,
      lastUpdated: new Date(),
    }

    this.scores.set(sender, reputationScore)
    return reputationScore
  }

  /**
   * Get reputation score
   * 
   * @param sender - Sender email
   * @returns Reputation score or undefined
   */
  getScore(sender: string): ReputationScore | undefined {
    return this.scores.get(sender)
  }

  /**
   * Get domain reputation
   * 
   * @param domain - Domain
   * @returns Average reputation score for domain
   */
  getDomainReputation(domain: string): {
    score: number
    level: string
    senderCount: number
  } {
    let totalScore = 0
    let count = 0

    for (const [sender, score] of Array.from(this.scores.entries())) {
      if (this.extractDomain(sender) === domain) {
        totalScore += score.score
        count++
      }
    }

    if (count === 0) {
      return {
        score: 50, // Default neutral score
        level: 'fair',
        senderCount: 0,
      }
    }

    const avgScore = totalScore / count
    return {
      score: avgScore,
      level: this.getScoreLevel(avgScore),
      senderCount: count,
    }
  }

  /**
   * Get score level
   * 
   * @param score - Score (0-100)
   * @returns Score level
   */
  private getScoreLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    if (score >= 20) return 'poor'
    return 'critical'
  }

  /**
   * Extract domain from email
   * 
   * @param email - Email address
   * @returns Domain
   */
  private extractDomain(email: string): string {
    const match = email.match(/@(.+)$/)
    return match ? match[1] : email
  }
}

/**
 * Create sender reputation manager
 * 
 * @param weights - Optional reputation weights
 * @returns Sender reputation manager instance
 */
export function createSenderReputationManager(weights?: ReputationWeights): SenderReputationManager {
  return new SenderReputationManager(weights)
}

