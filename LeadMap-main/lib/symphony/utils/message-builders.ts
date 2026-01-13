/**
 * Symphony Messenger Message Builders
 * Helper functions for creating common message types
 * Provides type-safe message creation with validation
 */

import type { Message, DispatchOptions } from '@/lib/types/symphony'
import { dispatch } from '../dispatcher'

/**
 * Email message payload
 */
export interface EmailMessagePayload extends Record<string, unknown> {
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
 * Campaign message payload
 */
export interface CampaignMessagePayload extends Record<string, unknown> {
  campaignId: string
  userId: string
  recipientId?: string
  stepNumber?: number
  action: 'process' | 'send_step' | 'complete'
}

/**
 * SMS message payload
 */
export interface SMSMessagePayload extends Record<string, unknown> {
  to: string
  message: string
  campaignId?: string
  userId?: string
  scheduledAt?: Date
}

/**
 * Build and dispatch an email message
 */
export async function dispatchEmailMessage(
  payload: EmailMessagePayload,
  options?: DispatchOptions
): Promise<{ messageId: string }> {
  const message: Message = {
    type: 'EmailMessage',
    payload,
    metadata: {
      emailId: payload.emailId,
      userId: payload.userId,
      mailboxId: payload.mailboxId,
      ...(payload.campaignId && { campaignId: payload.campaignId }),
    },
  }

  const dispatchOptions: DispatchOptions = {
    ...options,
    transport: options?.transport || 'email',
    priority: payload.priority || options?.priority || 7,
    scheduledAt: payload.scheduledAt || options?.scheduledAt,
    idempotencyKey: options?.idempotencyKey || `email-${payload.emailId}`,
  }

  const result = await dispatch(message, dispatchOptions)
  return { messageId: result.messageId }
}

/**
 * Build and dispatch a campaign message
 */
export async function dispatchCampaignMessage(
  payload: CampaignMessagePayload,
  options?: DispatchOptions
): Promise<{ messageId: string }> {
  const message: Message = {
    type: 'CampaignMessage',
    payload,
    metadata: {
      campaignId: payload.campaignId,
      userId: payload.userId,
      ...(payload.recipientId && { recipientId: payload.recipientId }),
      ...(payload.stepNumber !== undefined && { stepNumber: payload.stepNumber }),
    },
  }

  const dispatchOptions: DispatchOptions = {
    ...options,
    transport: options?.transport || 'async',
    priority: options?.priority || 5,
    idempotencyKey:
      options?.idempotencyKey ||
      `campaign-${payload.campaignId}-${payload.action}-${payload.recipientId || 'all'}`,
  }

  const result = await dispatch(message, dispatchOptions)
  return { messageId: result.messageId }
}

/**
 * Build and dispatch an SMS message
 */
export async function dispatchSMSMessage(
  payload: SMSMessagePayload,
  options?: DispatchOptions
): Promise<{ messageId: string }> {
  const message: Message = {
    type: 'SMSMessage',
    payload,
    metadata: {
      ...(payload.campaignId && { campaignId: payload.campaignId }),
      ...(payload.userId && { userId: payload.userId }),
    },
  }

  const dispatchOptions: DispatchOptions = {
    ...options,
    transport: options?.transport || 'async',
    priority: options?.priority || 6,
    scheduledAt: payload.scheduledAt || options?.scheduledAt,
    idempotencyKey:
      options?.idempotencyKey || `sms-${payload.to}-${Date.now()}`,
  }

  const result = await dispatch(message, dispatchOptions)
  return { messageId: result.messageId }
}

/**
 * Build a message object (without dispatching)
 */
export function buildEmailMessage(
  payload: EmailMessagePayload
): Message {
  return {
    type: 'EmailMessage',
    payload,
    metadata: {
      emailId: payload.emailId,
      userId: payload.userId,
      mailboxId: payload.mailboxId,
      ...(payload.campaignId && { campaignId: payload.campaignId }),
    },
  }
}

/**
 * Build a campaign message object (without dispatching)
 */
export function buildCampaignMessage(
  payload: CampaignMessagePayload
): Message {
  return {
    type: 'CampaignMessage',
    payload,
    metadata: {
      campaignId: payload.campaignId,
      userId: payload.userId,
      ...(payload.recipientId && { recipientId: payload.recipientId }),
      ...(payload.stepNumber !== undefined && { stepNumber: payload.stepNumber }),
    },
  }
}

/**
 * Build an SMS message object (without dispatching)
 */
export function buildSMSMessage(payload: SMSMessagePayload): Message {
  return {
    type: 'SMSMessage',
    payload,
    metadata: {
      ...(payload.campaignId && { campaignId: payload.campaignId }),
      ...(payload.userId && { userId: payload.userId }),
    },
  }
}

