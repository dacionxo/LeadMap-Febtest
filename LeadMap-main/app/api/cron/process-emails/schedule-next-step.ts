/**
 * Schedule Next Step Helper
 * Schedules the next step in a sequence campaign after an email is sent
 */

import { executeSelectOperation, executeUpdateOperation, executeInsertOperation } from '@/lib/cron/database'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Schedules the next step in a sequence campaign
 * 
 * @param supabase - Supabase client
 * @param campaignId - Campaign ID
 * @param recipientId - Recipient ID
 * @param currentStepId - Current step ID that was just sent
 */
export async function scheduleNextStep(
  supabase: SupabaseClient,
  campaignId: string,
  recipientId: string,
  currentStepId: string
): Promise<void> {
  try {
    // Get campaign to check campaign-level stop_on_reply and get user_id/mailbox_id
    const campaignResult = await executeSelectOperation<{ 
      stop_on_reply: boolean
      user_id: string
      mailbox_id: string
    }>(
      supabase,
      'campaigns',
      'stop_on_reply, user_id, mailbox_id',
      (query) => {
        return (query as any).eq('id', campaignId).single()
      },
      {
        operation: 'fetch_campaign_for_reply_check',
        campaignId,
      }
    )

    // Get current step
    const stepResult = await executeSelectOperation<{
      step_number: number
      delay_hours: number
      delay_days: number
      stop_on_reply: boolean
    }>(
      supabase,
      'campaign_steps',
      'step_number, delay_hours, delay_days, stop_on_reply',
      (query) => {
        return (query as any).eq('id', currentStepId).single()
      },
      {
        operation: 'fetch_current_step',
        stepId: currentStepId,
      }
    )

    // Handle .single() result - it returns a single object, not an array
    if (!stepResult.success || !stepResult.data) {
      return
    }

    // .single() returns a single object, not an array
    const currentStep = Array.isArray(stepResult.data) ? stepResult.data[0] : stepResult.data
    if (!currentStep) {
      return
    }

    // Check if recipient has replied - also get email and campaign_id in same query
    const recipientResult = await executeSelectOperation<{ 
      replied: boolean
      status: string
      email: string
      campaign_id: string
    }>(
      supabase,
      'campaign_recipients',
      'replied, status, email, campaign_id',
      (query) => {
        return (query as any).eq('id', recipientId).single()
      },
      {
        operation: 'check_recipient_reply',
        recipientId,
      }
    )

    // Handle .single() result
    if (!recipientResult.success || !recipientResult.data) {
      return
    }

    const recipient = Array.isArray(recipientResult.data) ? recipientResult.data[0] : recipientResult.data
    if (!recipient) {
      return
    }

    // Normalize campaignResult.data to handle T | T[] return type
    // Do this early so it's available for both reply check and email creation
    const campaignData = campaignResult.success && campaignResult.data
      ? (Array.isArray(campaignResult.data) ? campaignResult.data[0] : campaignResult.data)
      : null

    // Check if recipient has replied
    if (recipient.replied) {
      // Check if we should stop (campaign-level setting takes precedence, then step-level)
      const campaignStopOnReply =
        campaignData?.stop_on_reply !== false // Default to true if not set
      const stepStopOnReply = currentStep.stop_on_reply !== false // Default to true if not set

      // If either campaign or step has stop_on_reply enabled, don't schedule next step
      if (campaignStopOnReply || stepStopOnReply) {
        await executeUpdateOperation(
          supabase,
          'campaign_recipients',
          {
            status: 'stopped',
          },
          (query) => (query as any).eq('id', recipientId),
          {
            operation: 'stop_recipient_on_reply',
            recipientId,
          }
        )
        return
      }
    }

    // Get next step
    const nextStepResult = await executeSelectOperation<{
      id: string
      step_number: number
      delay_hours: number
      delay_days: number
      subject: string
      html: string
    }>(
      supabase,
      'campaign_steps',
      'id, step_number, delay_hours, delay_days, subject, html',
      (query) => {
        return (query as any)
          .eq('campaign_id', campaignId)
          .eq('step_number', currentStep.step_number + 1)
          .single()
      },
      {
        operation: 'fetch_next_step',
        campaignId,
        currentStepNumber: currentStep.step_number,
      }
    )

    // Handle .single() result
    if (!nextStepResult.success || !nextStepResult.data) {
      // No more steps, mark as completed
      await executeUpdateOperation(
        supabase,
        'campaign_recipients',
        {
          status: 'completed',
        },
        (query) => (query as any).eq('id', recipientId),
        {
          operation: 'mark_recipient_completed',
          recipientId,
        }
      )
      return
    }

    // .single() returns a single object, not an array
    const nextStep = Array.isArray(nextStepResult.data) ? nextStepResult.data[0] : nextStepResult.data
    if (!nextStep) {
      return
    }

    // Calculate next send time
    const now = new Date()
    const delayMs =
      (nextStep.delay_hours || 0) * 60 * 60 * 1000 + (nextStep.delay_days || 0) * 24 * 60 * 60 * 1000
    const nextSendAt = new Date(now.getTime() + delayMs)

    // Use campaign data already fetched (includes user_id and mailbox_id)
    if (!campaignData) {
      console.error(`[Schedule Next Step] Campaign data not available for campaign ${campaignId}`)
      return
    }

    // Create email record for next step
    const insertResult = await executeInsertOperation(
      supabase,
      'emails',
      {
        user_id: campaignData.user_id,
        mailbox_id: campaignData.mailbox_id,
        campaign_id: campaignId,
        campaign_step_id: nextStep.id,
        campaign_recipient_id: recipientId,
        to_email: recipient.email,
        subject: nextStep.subject,
        html: nextStep.html,
        status: 'queued',
        scheduled_at: nextSendAt.toISOString(),
        direction: 'sent',
        type: 'campaign',
      },
      {
        operation: 'create_next_step_email',
        campaignId,
        recipientId,
        stepId: nextStep.id,
      }
    )

    // Update recipient next_send_at
    await executeUpdateOperation(
      supabase,
      'campaign_recipients',
      {
        next_send_at: nextSendAt.toISOString(),
      },
      (query) => (query as any).eq('id', recipientId),
      {
        operation: 'update_recipient_next_send',
        recipientId,
      }
    )
  } catch (error) {
    console.error('[Schedule Next Step] Error scheduling next step:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      campaignId,
      recipientId,
      currentStepId,
    })
    // Don't throw - this is a helper function that shouldn't break the main flow
  }
}

