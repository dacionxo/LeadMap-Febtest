/**
 * Symphony Integration for SMS Drip Processing
 * Provides functions to migrate SMS drip processing to Symphony
 */

import { dispatchSMSMessage } from '../utils/message-builders'
import { shouldUseSymphonyForSMSDrip } from '../utils/feature-flags'

/**
 * SMS enrollment structure
 */
export interface SMSEnrollment {
  id: string
  campaign_id: string
  phone_number: string
  current_step_order: number
  next_run_at: string
  status: string
  unsubscribed: boolean
  user_id?: string
}

/**
 * SMS step structure
 */
export interface SMSStep {
  id: string
  campaign_id: string
  step_order: number
  message: string
  delay_hours: number
  stop_on_reply: boolean
}

/**
 * Dispatch SMS drip message via Symphony (if enabled)
 */
export async function dispatchSMSDripMessage(
  enrollment: SMSEnrollment,
  step: SMSStep,
  message: string
): Promise<{ messageId?: string; useLegacy: boolean }> {
  if (!shouldUseSymphonyForSMSDrip()) {
    return { useLegacy: true }
  }

  try {
    const result = await dispatchSMSMessage(
      {
        to: enrollment.phone_number,
        message,
        campaignId: enrollment.campaign_id,
        userId: enrollment.user_id,
        scheduledAt: enrollment.next_run_at
          ? new Date(enrollment.next_run_at)
          : undefined,
      },
      {
        idempotencyKey: `sms-drip-${enrollment.id}-${step.step_order}`,
      }
    )

    return { messageId: result.messageId, useLegacy: false }
  } catch (error) {
    // If Symphony dispatch fails, fall back to legacy processing
    console.error('Symphony dispatch failed, falling back to legacy:', error)
    return { useLegacy: true }
  }
}


