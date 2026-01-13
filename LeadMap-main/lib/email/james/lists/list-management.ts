/**
 * Email List Management and Unsubscription Handling
 * 
 * List management patterns following james-project and industry best practices
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project list management patterns
 */

/**
 * Unsubscription reason
 */
export type UnsubscriptionReason =
  | 'user_request'
  | 'hard_bounce'
  | 'complaint'
  | 'spam'
  | 'administrative'
  | 'other'

/**
 * Unsubscription record
 */
export interface UnsubscriptionRecord {
  email: string
  listId?: string
  campaignId?: string
  reason: UnsubscriptionReason
  unsubscribedAt: Date
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Email list
 */
export interface EmailList {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  subscriberCount: number
  active: boolean
}

/**
 * List subscriber
 */
export interface ListSubscriber {
  email: string
  listId: string
  subscribedAt: Date
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  metadata?: Record<string, unknown>
}

/**
 * List manager
 * Following james-project list management patterns
 */
export class ListManager {
  private lists: Map<string, EmailList> = new Map()
  private subscribers: Map<string, ListSubscriber[]> = new Map() // listId -> subscribers
  private unsubscriptions: Map<string, UnsubscriptionRecord> = new Map() // email -> record

  /**
   * Create email list
   * 
   * @param name - List name
   * @param description - Optional description
   * @returns Email list
   */
  createList(name: string, description?: string): EmailList {
    const id = `list_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const list: EmailList = {
      id,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      subscriberCount: 0,
      active: true,
    }

    this.lists.set(id, list)
    this.subscribers.set(id, [])
    return list
  }

  /**
   * Get list
   * 
   * @param listId - List ID
   * @returns Email list or undefined
   */
  getList(listId: string): EmailList | undefined {
    return this.lists.get(listId)
  }

  /**
   * Add subscriber to list
   * 
   * @param listId - List ID
   * @param email - Subscriber email
   * @param metadata - Optional metadata
   * @returns Subscriber record
   */
  addSubscriber(listId: string, email: string, metadata?: Record<string, unknown>): ListSubscriber {
    const list = this.lists.get(listId)
    if (!list) {
      throw new Error(`List ${listId} not found`)
    }

    // Check if already unsubscribed
    if (this.isUnsubscribed(email, listId)) {
      throw new Error(`Email ${email} is unsubscribed from list ${listId}`)
    }

    const subscribers = this.subscribers.get(listId) || []
    const existing = subscribers.find(s => s.email === email)

    if (existing) {
      // Update existing subscriber
      existing.status = 'active'
      existing.metadata = { ...existing.metadata, ...metadata }
      return existing
    }

    // Add new subscriber
    const subscriber: ListSubscriber = {
      email,
      listId,
      subscribedAt: new Date(),
      status: 'active',
      metadata,
    }

    subscribers.push(subscriber)
    this.subscribers.set(listId, subscribers)
    list.subscriberCount = subscribers.length
    list.updatedAt = new Date()

    return subscriber
  }

  /**
   * Remove subscriber from list
   * 
   * @param listId - List ID
   * @param email - Subscriber email
   */
  removeSubscriber(listId: string, email: string): void {
    const subscribers = this.subscribers.get(listId) || []
    const index = subscribers.findIndex(s => s.email === email)
    if (index >= 0) {
      subscribers.splice(index, 1)
      this.subscribers.set(listId, subscribers)

      const list = this.lists.get(listId)
      if (list) {
        list.subscriberCount = subscribers.length
        list.updatedAt = new Date()
      }
    }
  }

  /**
   * Unsubscribe email
   * 
   * @param email - Email address
   * @param listId - Optional list ID (if not provided, unsubscribes from all lists)
   * @param reason - Unsubscription reason
   * @param metadata - Optional metadata
   * @returns Unsubscription record
   */
  unsubscribe(
    email: string,
    listId?: string,
    reason: UnsubscriptionReason = 'user_request',
    metadata?: Record<string, unknown>
  ): UnsubscriptionRecord {
    const record: UnsubscriptionRecord = {
      email,
      listId,
      reason,
      unsubscribedAt: new Date(),
      metadata,
    }

    this.unsubscriptions.set(email, record)

    if (listId) {
      // Unsubscribe from specific list
      const subscribers = this.subscribers.get(listId) || []
      const subscriber = subscribers.find(s => s.email === email)
      if (subscriber) {
        subscriber.status = 'unsubscribed'
      }
    } else {
      // Unsubscribe from all lists
      for (const [lid, subscribers] of Array.from(this.subscribers.entries())) {
        const subscriber = subscribers.find(s => s.email === email)
        if (subscriber) {
          subscriber.status = 'unsubscribed'
        }
      }
    }

    return record
  }

  /**
   * Check if email is unsubscribed
   * 
   * @param email - Email address
   * @param listId - Optional list ID
   * @returns True if unsubscribed
   */
  isUnsubscribed(email: string, listId?: string): boolean {
    const record = this.unsubscriptions.get(email)
    if (!record) return false

    // If no listId specified, check global unsubscription
    if (!listId) return true

    // Check if unsubscribed from specific list
    return record.listId === undefined || record.listId === listId
  }

  /**
   * Get unsubscription record
   * 
   * @param email - Email address
   * @returns Unsubscription record or undefined
   */
  getUnsubscription(email: string): UnsubscriptionRecord | undefined {
    return this.unsubscriptions.get(email)
  }

  /**
   * Get list subscribers
   * 
   * @param listId - List ID
   * @param status - Optional status filter
   * @returns Array of subscribers
   */
  getSubscribers(listId: string, status?: 'active' | 'unsubscribed' | 'bounced' | 'complained'): ListSubscriber[] {
    const subscribers = this.subscribers.get(listId) || []
    if (status) {
      return subscribers.filter(s => s.status === status)
    }
    return subscribers
  }

  /**
   * Generate unsubscribe URL
   * 
   * @param email - Email address
   * @param listId - Optional list ID
   * @param baseUrl - Base URL
   * @returns Unsubscribe URL
   */
  generateUnsubscribeUrl(email: string, listId?: string, baseUrl: string = ''): string {
    const token = Buffer.from(`${email}:${listId || 'all'}:${Date.now()}`).toString('base64')
    return `${baseUrl}/api/emails/unsubscribe?token=${encodeURIComponent(token)}`
  }
}

/**
 * Create list manager
 * 
 * @returns List manager instance
 */
export function createListManager(): ListManager {
  return new ListManager()
}

