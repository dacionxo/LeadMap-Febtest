/**
 * Symphony Messenger Example Messages
 * Example message types and payloads for common use cases
 */

import type { Message } from '@/lib/types/symphony'

/**
 * Email message payload
 */
export interface EmailMessagePayload {
  emailId: string
  userId: string
  mailboxId: string
  toEmail: string
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
  type?: string
  campaignId?: string
  campaignRecipientId?: string
  priority?: number
  scheduledAt?: Date
}

/**
 * Email message
 */
export class EmailMessage implements Message {
  type = 'EmailMessage'
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>

  constructor(payload: EmailMessagePayload, metadata?: Record<string, unknown>) {
    this.payload = payload as unknown as Record<string, unknown>
    this.metadata = metadata
  }
}

/**
 * Campaign message payload
 */
export interface CampaignMessagePayload {
  campaignId: string
  userId: string
  recipientId?: string
  stepNumber?: number
  action: 'process' | 'send_step' | 'complete'
}

/**
 * Campaign message
 */
export class CampaignMessage implements Message {
  type = 'CampaignMessage'
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>

  constructor(
    payload: CampaignMessagePayload,
    metadata?: Record<string, unknown>
  ) {
    this.payload = payload as unknown as Record<string, unknown>
    this.metadata = metadata
  }
}

/**
 * SMS message payload
 */
export interface SMSMessagePayload {
  to: string
  message: string
  campaignId?: string
  userId?: string
  scheduledAt?: Date
}

/**
 * SMS message
 */
export class SMSMessage implements Message {
  type = 'SMSMessage'
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>

  constructor(payload: SMSMessagePayload, metadata?: Record<string, unknown>) {
    this.payload = payload as unknown as Record<string, unknown>
    this.metadata = metadata
  }
}

/**
 * Example message factory
 */
export class ExampleMessageFactory {
  /**
   * Create an email message
   */
  static createEmailMessage(
    payload: EmailMessagePayload,
    metadata?: Record<string, unknown>
  ): EmailMessage {
    return new EmailMessage(payload, metadata)
  }

  /**
   * Create a campaign message
   */
  static createCampaignMessage(
    payload: CampaignMessagePayload,
    metadata?: Record<string, unknown>
  ): CampaignMessage {
    return new CampaignMessage(payload, metadata)
  }

  /**
   * Create an SMS message
   */
  static createSMSMessage(
    payload: SMSMessagePayload,
    metadata?: Record<string, unknown>
  ): SMSMessage {
    return new SMSMessage(payload, metadata)
  }
}


