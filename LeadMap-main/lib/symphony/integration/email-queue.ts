/**
 * Symphony Integration for Email Queue Processing
 * Provides functions to migrate email queue processing to Symphony
 */

import { dispatchEmailMessage } from '../utils/message-builders'
import { shouldUseSymphonyForEmailQueue } from '../utils/feature-flags'

/**
 * Email queue item structure (from process-email-queue route)
 */
export interface EmailQueueItem {
  id: string
  user_id: string
  mailbox_id: string
  to_email: string
  subject: string
  html: string
  from_name?: string | null
  from_email?: string | null
  type?: string | null
  campaign_id?: string | null
  campaign_recipient_id?: string | null
  status: 'queued' | 'processing' | 'sent' | 'failed'
  priority: number
  scheduled_at?: string | null
  retry_count: number
  max_retries: number
  last_error?: string | null
  created_at: string
  processed_at?: string | null
}

/**
 * Convert email queue item to Symphony message payload
 */
export function emailQueueItemToMessage(
  item: EmailQueueItem
): Parameters<typeof dispatchEmailMessage>[0] {
  return {
    emailId: item.id,
    userId: item.user_id,
    mailboxId: item.mailbox_id,
    toEmail: item.to_email,
    subject: item.subject,
    html: item.html,
    fromName: item.from_name || undefined,
    fromEmail: item.from_email || undefined,
    type: item.type || undefined,
    campaignId: item.campaign_id || undefined,
    campaignRecipientId: item.campaign_recipient_id || undefined,
    priority: item.priority,
    scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : undefined,
  }
}

/**
 * Dispatch email queue item via Symphony (if enabled)
 * Falls back to legacy processing if Symphony is disabled
 */
export async function dispatchEmailQueueItem(
  item: EmailQueueItem
): Promise<{ messageId?: string; useLegacy: boolean }> {
  if (!shouldUseSymphonyForEmailQueue()) {
    return { useLegacy: true }
  }

  try {
    const payload = emailQueueItemToMessage(item)
    const result = await dispatchEmailMessage(payload, {
      idempotencyKey: `email-queue-${item.id}`,
    })

    return { messageId: result.messageId, useLegacy: false }
  } catch (error) {
    // If Symphony dispatch fails, fall back to legacy processing
    console.error('Symphony dispatch failed, falling back to legacy:', error)
    return { useLegacy: true }
  }
}

/**
 * Batch dispatch email queue items via Symphony
 */
export async function dispatchEmailQueueBatch(
  items: EmailQueueItem[]
): Promise<{
  dispatched: number
  legacy: number
  errors: number
}> {
  if (!shouldUseSymphonyForEmailQueue()) {
    return { dispatched: 0, legacy: items.length, errors: 0 }
  }

  let dispatched = 0
  let legacy = 0
  let errors = 0

  for (const item of items) {
    try {
      const result = await dispatchEmailQueueItem(item)
      if (result.useLegacy) {
        legacy++
      } else {
        dispatched++
      }
    } catch (error) {
      errors++
      console.error('Failed to dispatch email queue item:', error)
    }
  }

  return { dispatched, legacy, errors }
}

