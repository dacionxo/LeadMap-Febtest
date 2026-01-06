/**
 * Email Tracking and Analytics
 * 
 * Email tracking patterns following james-project and industry best practices
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project email tracking patterns
 */

/**
 * Tracking event type
 */
export type TrackingEventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complained' | 'unsubscribed'

/**
 * Tracking event
 */
export interface TrackingEvent {
  eventId: string
  messageId: string
  recipient: string
  eventType: TrackingEventType
  timestamp: Date
  metadata?: {
    ipAddress?: string
    userAgent?: string
    device?: string
    browser?: string
    os?: string
    location?: {
      country?: string
      city?: string
    }
    url?: string // For click events
    subject?: string
    campaignId?: string
  }
}

/**
 * Email tracking manager
 * Following james-project tracking patterns
 */
export class EmailTrackingManager {
  private events: Map<string, TrackingEvent[]> = new Map()

  /**
   * Record tracking event
   * 
   * @param event - Tracking event
   */
  recordEvent(event: TrackingEvent): void {
    const messageEvents = this.events.get(event.messageId) || []
    messageEvents.push(event)
    this.events.set(event.messageId, messageEvents)
  }

  /**
   * Get tracking events for message
   * 
   * @param messageId - Message ID
   * @returns Array of tracking events
   */
  getEvents(messageId: string): TrackingEvent[] {
    return this.events.get(messageId) || []
  }

  /**
   * Get tracking statistics for message
   * 
   * @param messageId - Message ID
   * @returns Tracking statistics
   */
  getStatistics(messageId: string): {
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    bounced: number
    complained: number
    unsubscribed: number
    openRate: number
    clickRate: number
    replyRate: number
    bounceRate: number
  } {
    const events = this.getEvents(messageId)
    const stats = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
    }

    for (const event of events) {
      switch (event.eventType) {
        case 'sent':
          stats.sent++
          break
        case 'delivered':
          stats.delivered++
          break
        case 'opened':
          stats.opened++
          break
        case 'clicked':
          stats.clicked++
          break
        case 'replied':
          stats.replied++
          break
        case 'bounced':
          stats.bounced++
          break
        case 'complained':
          stats.complained++
          break
        case 'unsubscribed':
          stats.unsubscribed++
          break
      }
    }

    const total = stats.sent || 1
    return {
      ...stats,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
      clickRate: stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0,
      replyRate: stats.delivered > 0 ? (stats.replied / stats.delivered) * 100 : 0,
      bounceRate: (stats.bounced / total) * 100,
    }
  }

  /**
   * Get recipient engagement profile
   * 
   * @param recipient - Recipient email
   * @returns Engagement profile
   */
  getRecipientProfile(recipient: string): {
    totalSent: number
    totalOpened: number
    totalClicked: number
    totalReplied: number
    openRate: number
    clickRate: number
    replyRate: number
    lastOpened?: Date
    lastClicked?: Date
    lastReplied?: Date
  } {
    let totalSent = 0
    let totalOpened = 0
    let totalClicked = 0
    let totalReplied = 0
    let lastOpened: Date | undefined
    let lastClicked: Date | undefined
    let lastReplied: Date | undefined

    for (const events of this.events.values()) {
      for (const event of events) {
        if (event.recipient !== recipient) continue

        switch (event.eventType) {
          case 'sent':
            totalSent++
            break
          case 'opened':
            totalOpened++
            if (!lastOpened || event.timestamp > lastOpened) {
              lastOpened = event.timestamp
            }
            break
          case 'clicked':
            totalClicked++
            if (!lastClicked || event.timestamp > lastClicked) {
              lastClicked = event.timestamp
            }
            break
          case 'replied':
            totalReplied++
            if (!lastReplied || event.timestamp > lastReplied) {
              lastReplied = event.timestamp
            }
            break
        }
      }
    }

    return {
      totalSent,
      totalOpened,
      totalClicked,
      totalReplied,
      openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      replyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
      lastOpened,
      lastClicked,
      lastReplied,
    }
  }

  /**
   * Generate tracking pixel URL
   * 
   * @param messageId - Message ID
   * @param recipient - Recipient email
   * @returns Tracking pixel URL
   */
  generateTrackingPixel(messageId: string, recipient: string): string {
    const eventId = `open_${Date.now()}_${Math.random().toString(36).substring(7)}`
    return `/api/email/track/open?messageId=${encodeURIComponent(messageId)}&recipient=${encodeURIComponent(recipient)}&eventId=${encodeURIComponent(eventId)}`
  }

  /**
   * Generate tracking link URL
   * 
   * @param messageId - Message ID
   * @param recipient - Recipient email
   * @param originalUrl - Original URL
   * @returns Tracking link URL
   */
  generateTrackingLink(messageId: string, recipient: string, originalUrl: string): string {
    const eventId = `click_${Date.now()}_${Math.random().toString(36).substring(7)}`
    return `/api/email/track/click?messageId=${encodeURIComponent(messageId)}&recipient=${encodeURIComponent(recipient)}&url=${encodeURIComponent(originalUrl)}&eventId=${encodeURIComponent(eventId)}`
  }
}

/**
 * Create email tracking manager
 * 
 * @returns Email tracking manager instance
 */
export function createEmailTrackingManager(): EmailTrackingManager {
  return new EmailTrackingManager()
}

