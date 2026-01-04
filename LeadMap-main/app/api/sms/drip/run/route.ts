// app/api/sms/drip/run/route.ts
/**
 * Drip Campaign Runner
 * 
 * Processes due campaign enrollments and sends next steps.
 * Should be called by a cron job every minute.
 * 
 * Features:
 * - Processes enrollments with next_run_at <= now
 * - Respects quiet hours
 * - Handles stop-on-reply
 * - Personalizes messages with template variables
 * - Logs all events for analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendConversationMessage } from '@/lib/twilio'
import { renderTemplate } from '@/lib/api'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import { dispatchSMSDripMessage, type SMSEnrollment, type SMSStep } from '@/lib/symphony/integration/sms-drip'
import { shouldUseSymphonyForSMSDrip } from '@/lib/symphony/utils/feature-flags'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * SMS Drip Campaign Runner
 * 
 * Processes due campaign enrollments and sends next steps.
 * Should be called by a cron job every minute.
 * 
 * Features:
 * - Processes enrollments with next_run_at <= now
 * - Respects quiet hours
 * - Handles stop-on-reply
 * - Personalizes messages with template variables
 * - Logs all events for analytics
 * 
 * Authentication: Requires CRON_SECRET or CALENDAR_SERVICE_KEY via:
 * - Authorization: Bearer <token>
 * - x-vercel-cron-secret header
 * - x-service-key header
 */
async function runCronJob(req: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication using centralized auth utility
    const authError = verifyCronRequestOrError(req)
    if (authError) {
      return authError
    }

    const now = new Date().toISOString()

    // Pull a batch of due enrollments
    const { data: enrollments, error } = await supabase
      .from('sms_campaign_enrollments')
      .select('*')
      .lte('next_run_at', now)
      .eq('status', 'active')
      .eq('unsubscribed', false)
      .limit(100)

    if (error) {
      console.error('[Drip Runner] Error fetching enrollments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!enrollments || enrollments.length === 0) {
      return createNoDataResponse('No enrollments due')
    }

    let processed = 0
    let errors = 0
    let dispatched = 0
    let legacy = 0
    const errorsList: Array<{ enrollmentId: string; error: string }> = []

    // Check if Symphony is enabled for SMS drip
    const useSymphony = shouldUseSymphonyForSMSDrip()

    for (const enrollment of enrollments) {
      try {
        // Get the next step
        const { data: stepRow, error: stepError } = await supabase
          .from('sms_campaign_steps')
          .select('*')
          .eq('campaign_id', enrollment.campaign_id)
          .eq('step_order', enrollment.current_step_order + 1)
          .single()

        if (stepError || !stepRow) {
          // No more steps -> mark as completed
          await supabase
            .from('sms_campaign_enrollments')
            .update({
              status: 'completed',
              updated_at: now
            })
            .eq('id', enrollment.id)

          await supabase.from('sms_events').insert({
            event_type: 'campaign_completed',
            campaign_id: enrollment.campaign_id,
            conversation_id: enrollment.conversation_id,
            user_id: enrollment.user_id,
            occurred_at: now,
            details: { reason: 'no_more_steps' }
          })

          continue
        }

        // Quiet hours check
        if (stepRow.quiet_hours_start && stepRow.quiet_hours_end) {
          const localNow = new Date()
          const hour = localNow.getHours()
          const minute = localNow.getMinutes()
          const currentTimeMinutes = hour * 60 + minute

          const [qsHour, qsMin] = stepRow.quiet_hours_start.split(':').map((n: string) => parseInt(n, 10))
          const [qeHour, qeMin] = stepRow.quiet_hours_end.split(':').map((n: string) => parseInt(n, 10))
          const quietStartMinutes = qsHour * 60 + (qsMin || 0)
          const quietEndMinutes = qeHour * 60 + (qeMin || 0)

          let inQuiet = false
          if (quietStartMinutes < quietEndMinutes) {
            // Normal case: 21:00 to 08:00 -> 21:00 to 24:00 OR 00:00 to 08:00
            inQuiet = currentTimeMinutes >= quietStartMinutes || currentTimeMinutes < quietEndMinutes
          } else {
            // Wraps midnight: e.g., 21:00 to 08:00
            inQuiet = currentTimeMinutes >= quietStartMinutes || currentTimeMinutes < quietEndMinutes
          }

          if (inQuiet) {
            // Push next_run_at forward to end of quiet hours
            const nextRun = new Date(localNow)
            if (currentTimeMinutes >= quietStartMinutes) {
              // We're in the evening quiet hours, schedule for next morning
              nextRun.setDate(nextRun.getDate() + 1)
              nextRun.setHours(qeHour, qeMin || 0, 0, 0)
            } else {
              // We're in the morning quiet hours, schedule for later today
              nextRun.setHours(qeHour, qeMin || 0, 0, 0)
            }

            await supabase
              .from('sms_campaign_enrollments')
              .update({
                next_run_at: nextRun.toISOString()
              })
              .eq('id', enrollment.id)

            continue
          }
        }

        // Fetch conversation and listing for personalization
        const [{ data: convo }, { data: listing }] = await Promise.all([
          supabase
            .from('sms_conversations')
            .select('*')
            .eq('id', enrollment.conversation_id)
            .single(),
          enrollment.listing_id
            ? supabase
                .from('listings')
                .select('*')
                .eq('id', enrollment.listing_id)
                .maybeSingle()
            : Promise.resolve({ data: null })
        ])

        if (!convo) {
          console.warn(`[Drip Runner] Conversation not found: ${enrollment.conversation_id}`)
          errors++
          continue
        }

        // Render template with listing data
        const smsText = renderTemplate(stepRow.template_body, listing || {})

        // Check if Symphony is enabled and dispatch to Symphony
        if (useSymphony) {
          try {
            const result = await dispatchSMSDripMessage(
              enrollment as SMSEnrollment,
              stepRow as SMSStep,
              smsText
            )
            if (!result.useLegacy) {
              dispatched++
              processed++
              continue
            } else {
              legacy++
            }
          } catch (symphonyError) {
            console.error('Symphony dispatch failed, falling back to legacy:', symphonyError)
            legacy++
          }
        }

        // Legacy processing: Send message directly
        const msgRow = await sendConversationMessage({
          conversationSid: convo.twilio_conversation_sid,
          conversationId: convo.id,
          userId: enrollment.user_id,
          body: smsText
        })

        // Calculate next run time
        const nextRunAt = new Date(
          Date.now() + stepRow.delay_minutes * 60 * 1000
        ).toISOString()

        // Update enrollment
        await supabase
          .from('sms_campaign_enrollments')
          .update({
            current_step_order: stepRow.step_order,
            next_run_at: nextRunAt,
            last_step_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', enrollment.id)

        // Log event
        await supabase.from('sms_events').insert({
          event_type: 'campaign_step_sent',
          campaign_id: enrollment.campaign_id,
          conversation_id: convo.id,
          message_id: msgRow.id,
          user_id: enrollment.user_id,
          occurred_at: new Date().toISOString(),
          details: {
            step_order: stepRow.step_order,
            delay_minutes: stepRow.delay_minutes
          }
        })

        processed++
      } catch (enrollmentError: any) {
        const errorMessage = enrollmentError instanceof Error 
          ? enrollmentError.message 
          : 'Unknown error'
        console.error(`[Drip Runner] Error processing enrollment ${enrollment.id}:`, enrollmentError)
        errors++
        errorsList.push({
          enrollmentId: enrollment.id,
          error: errorMessage
        })
      }
    }

    const duration = Date.now() - startTime

    return createSuccessResponse(
      {
        processed,
        errors,
        dispatched: useSymphony ? dispatched : undefined,
        legacy: useSymphony ? legacy : undefined,
        total: enrollments.length,
        duration,
        errorDetails: errorsList.length > 0 ? errorsList : undefined
      },
      {
        message: useSymphony
          ? `Processed ${processed} enrollments (${dispatched} via Symphony, ${legacy} legacy, ${errors} errors)`
          : `Processed ${processed} enrollments (${errors} errors)`,
        processed
      }
    )
  } catch (error) {
    return handleCronError(error, {
      cronJob: 'sms-drip-run',
      operation: 'runCronJob',
    })
  }
}

/**
 * POST handler for cron triggers
 */
export async function POST(req: NextRequest) {
  return runCronJob(req)
}

/**
 * GET handler for manual testing
 */
export async function GET(req: NextRequest) {
  return runCronJob(req)
}


