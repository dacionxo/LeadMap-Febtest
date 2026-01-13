/**
 * Email Analytics & Monitoring Utilities
 * Usage tracking and performance monitoring for email composer
 * Following Mautic patterns, .cursorrules guidelines
 * 
 * @module email-analytics
 * @description Provides analytics tracking for email composition features,
 * performance monitoring, and usage statistics following Mautic analytics patterns.
 */

/**
 * Analytics event types
 */
export type AnalyticsEventType =
  | 'email_composed'
  | 'email_sent'
  | 'email_saved'
  | 'email_previewed'
  | 'email_validated'
  | 'template_used'
  | 'token_inserted'
  | 'trigger_link_inserted'
  | 'ab_test_created'
  | 'campaign_linked'
  | 'draft_loaded'
  | 'draft_autosaved'
  | 'editor_mode_changed'
  | 'test_email_sent'

/**
 * Analytics event interface
 */
export interface AnalyticsEvent {
  type: AnalyticsEventType
  timestamp: number
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  componentLoadTime?: number
  editorInitTime?: number
  saveTime?: number
  sendTime?: number
  previewRenderTime?: number
}

/**
 * Analytics service class
 * Handles event tracking and performance monitoring
 */
class EmailAnalytics {
  private events: AnalyticsEvent[] = []
  private sessionId: string
  private userId?: string
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map()

  constructor() {
    this.sessionId = this.generateSessionId()
    this.loadUserId()
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Load user ID from storage or context
   */
  private loadUserId(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('email_composer_user_id')
        if (stored) {
          this.userId = stored
        }
      } catch (error) {
        console.warn('Failed to load user ID:', error)
      }
    }
  }

  /**
   * Set user ID for analytics
   */
  setUserId(userId: string): void {
    this.userId = userId
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('email_composer_user_id', userId)
      } catch (error) {
        console.warn('Failed to save user ID:', error)
      }
    }
  }

  /**
   * Track an analytics event
   */
  track(eventType: AnalyticsEventType, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      type: eventType,
      timestamp: Date.now(),
      properties,
      userId: this.userId,
      sessionId: this.sessionId,
    }

    this.events.push(event)

    // Send to analytics endpoint (if configured)
    this.sendEvent(event)

    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100)
    }
  }

  /**
   * Send event to analytics endpoint
   */
  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Only send in production or if analytics endpoint is configured
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true') {
        await fetch('/api/analytics/email-composer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          credentials: 'include',
        }).catch((error) => {
          // Silently fail - analytics should not break the app
          console.debug('Analytics event failed to send:', error)
        })
      }
    } catch (error) {
      // Silently fail - analytics should not break the app
      console.debug('Analytics error:', error)
    }
  }

  /**
   * Track performance metric
   */
  trackPerformance(componentId: string, metrics: PerformanceMetrics): void {
    this.performanceMetrics.set(componentId, metrics)

    // Log slow operations
    if (metrics.componentLoadTime && metrics.componentLoadTime > 1000) {
      console.warn(`Slow component load: ${componentId} took ${metrics.componentLoadTime}ms`)
    }
  }

  /**
   * Get performance metrics for a component
   */
  getPerformanceMetrics(componentId: string): PerformanceMetrics | undefined {
    return this.performanceMetrics.get(componentId)
  }

  /**
   * Get all events (for debugging)
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events]
  }

  /**
   * Clear events (for testing)
   */
  clearEvents(): void {
    this.events = []
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    totalEvents: number
    eventsByType: Record<string, number>
    sessionDuration: number
  } {
    const eventsByType: Record<string, number> = {}
    let firstEventTime: number | null = null
    let lastEventTime: number | null = null

    this.events.forEach((event) => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
      if (!firstEventTime || event.timestamp < firstEventTime) {
        firstEventTime = event.timestamp
      }
      if (!lastEventTime || event.timestamp > lastEventTime) {
        lastEventTime = event.timestamp
      }
    })

    return {
      totalEvents: this.events.length,
      eventsByType,
      sessionDuration: firstEventTime && lastEventTime ? lastEventTime - firstEventTime : 0,
    }
  }
}

// Singleton instance
let analyticsInstance: EmailAnalytics | null = null

/**
 * Get analytics instance (singleton)
 */
export function getEmailAnalytics(): EmailAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new EmailAnalytics()
  }
  return analyticsInstance
}

/**
 * Track email composition event
 */
export function trackEmailComposed(properties?: Record<string, any>): void {
  getEmailAnalytics().track('email_composed', properties)
}

/**
 * Track email sent event
 */
export function trackEmailSent(properties?: Record<string, any>): void {
  getEmailAnalytics().track('email_sent', properties)
}

/**
 * Track email saved event
 */
export function trackEmailSaved(properties?: Record<string, any>): void {
  getEmailAnalytics().track('email_saved', properties)
}

/**
 * Track email previewed event
 */
export function trackEmailPreviewed(properties?: Record<string, any>): void {
  getEmailAnalytics().track('email_previewed', properties)
}

/**
 * Track email validated event
 */
export function trackEmailValidated(properties?: Record<string, any>): void {
  getEmailAnalytics().track('email_validated', properties)
}

/**
 * Track template used event
 */
export function trackTemplateUsed(templateId: string, properties?: Record<string, any>): void {
  getEmailAnalytics().track('template_used', { templateId, ...properties })
}

/**
 * Track token inserted event
 */
export function trackTokenInserted(tokenId: string, properties?: Record<string, any>): void {
  getEmailAnalytics().track('token_inserted', { tokenId, ...properties })
}

/**
 * Track trigger link inserted event
 */
export function trackTriggerLinkInserted(linkKey: string, properties?: Record<string, any>): void {
  getEmailAnalytics().track('trigger_link_inserted', { linkKey, ...properties })
}

/**
 * Track A/B test created event
 */
export function trackABTestCreated(properties?: Record<string, any>): void {
  getEmailAnalytics().track('ab_test_created', properties)
}

/**
 * Track campaign linked event
 */
export function trackCampaignLinked(campaignId: string, properties?: Record<string, any>): void {
  getEmailAnalytics().track('campaign_linked', { campaignId, ...properties })
}

/**
 * Track draft loaded event
 */
export function trackDraftLoaded(draftId: string, properties?: Record<string, any>): void {
  getEmailAnalytics().track('draft_loaded', { draftId, ...properties })
}

/**
 * Track draft autosaved event
 */
export function trackDraftAutosaved(properties?: Record<string, any>): void {
  getEmailAnalytics().track('draft_autosaved', properties)
}

/**
 * Track editor mode changed event
 */
export function trackEditorModeChanged(fromMode: string, toMode: string, properties?: Record<string, any>): void {
  getEmailAnalytics().track('editor_mode_changed', { fromMode, toMode, ...properties })
}

/**
 * Track test email sent event
 */
export function trackTestEmailSent(properties?: Record<string, any>): void {
  getEmailAnalytics().track('test_email_sent', properties)
}

/**
 * Track performance metric
 */
export function trackPerformance(componentId: string, metrics: PerformanceMetrics): void {
  getEmailAnalytics().trackPerformance(componentId, metrics)
}

