/**
 * Symphony Integration for Campaign Processing
 * Provides functions to migrate campaign processing to Symphony
 */

import { dispatchCampaignMessage } from '../utils/message-builders'
import { shouldUseSymphonyForCampaigns } from '../utils/feature-flags'

// Re-export for convenience
export { shouldUseSymphonyForCampaigns }

/**
 * Dispatch campaign processing via Symphony (if enabled)
 */
export async function dispatchCampaignProcessing(
  campaignId: string,
  userId: string,
  options?: {
    recipientId?: string
    stepNumber?: number
    action?: 'process' | 'send_step' | 'complete'
  }
): Promise<{ messageId?: string; useLegacy: boolean }> {
  if (!shouldUseSymphonyForCampaigns()) {
    return { useLegacy: true }
  }

  try {
    const result = await dispatchCampaignMessage(
      {
        campaignId,
        userId,
        recipientId: options?.recipientId,
        stepNumber: options?.stepNumber,
        action: options?.action || 'process',
      },
      {
        idempotencyKey: `campaign-${campaignId}-${options?.action || 'process'}-${options?.recipientId || 'all'}`,
      }
    )

    return { messageId: result.messageId, useLegacy: false }
  } catch (error) {
    // If Symphony dispatch fails, fall back to legacy processing
    console.error('Symphony dispatch failed, falling back to legacy:', error)
    return { useLegacy: true }
  }
}

/**
 * Dispatch campaign step sending via Symphony
 */
export async function dispatchCampaignStep(
  campaignId: string,
  userId: string,
  recipientId: string,
  stepNumber: number
): Promise<{ messageId?: string; useLegacy: boolean }> {
  return dispatchCampaignProcessing(campaignId, userId, {
    recipientId,
    stepNumber,
    action: 'send_step',
  })
}


