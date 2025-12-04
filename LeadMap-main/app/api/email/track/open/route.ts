import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordEmailEvent } from '@/lib/email/event-tracking'

/**
 * Email Open Tracking
 * GET /api/email/track/open?email_id=...&recipient_id=...
 * Tracks email opens via 1x1 pixel image
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('email_id')
    const recipientId = searchParams.get('recipient_id')
    const campaignId = searchParams.get('campaign_id')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      // Record open event
      if (emailId || recipientId) {
        try {
          const { error } = await supabase
            .from('email_opens')
            .insert({
              email_id: emailId || null,
              campaign_recipient_id: recipientId || null,
              campaign_id: campaignId || null,
              opened_at: new Date().toISOString(),
              ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
              user_agent: request.headers.get('user-agent') || null
            })
          if (error) {
            // Log but don't fail if table doesn't exist yet
            console.warn('Failed to log open:', error)
          }
        } catch (err) {
          // Log but don't fail if table doesn't exist yet
          console.warn('Failed to log open:', err)
        }

        // Update email/campaign recipient if applicable
        if (emailId) {
          try {
            await supabase
              .from('emails')
              .update({ opened_at: new Date().toISOString() })
              .eq('id', emailId)
          } catch {
            // Ignore errors
          }
        }

        if (recipientId) {
          try {
            await supabase
              .from('campaign_recipients')
              .update({ opened: true, opened_at: new Date().toISOString() })
              .eq('id', recipientId)
          } catch {
            // Ignore errors
          }
        }

        // Update variant assignment if this is a split test email
        if (emailId) {
          try {
            const { data: email } = await supabase
              .from('emails')
              .select('campaign_step_id, campaign_recipient_id')
              .eq('id', emailId)
              .single()

            if (email?.campaign_step_id && email?.campaign_recipient_id) {
              await supabase
                .from('campaign_recipient_variant_assignments')
                .update({
                  was_opened: true,
                  opened_at: new Date().toISOString()
                })
                .eq('step_id', email.campaign_step_id)
                .eq('recipient_id', email.campaign_recipient_id)
            }
          } catch (err) {
            // Ignore errors - variant assignments table might not exist
            console.warn('Failed to update variant assignment for open:', err)
          }
        }

        // Record event in unified email_events table
        if (emailId) {
          try {
            // Fetch email record to get user_id, mailbox_id, campaign_id, to_email
            const { data: emailRecord } = await supabase
              .from('emails')
              .select('user_id, mailbox_id, campaign_id, campaign_recipient_id, to_email')
              .eq('id', emailId)
              .single()

            if (emailRecord && emailRecord.user_id && emailRecord.to_email) {
              await recordEmailEvent({
                userId: emailRecord.user_id,
                eventType: 'opened',
                emailId: emailId,
                mailboxId: emailRecord.mailbox_id || undefined,
                campaignId: emailRecord.campaign_id || campaignId || undefined,
                campaignRecipientId: emailRecord.campaign_recipient_id || recipientId || undefined,
                recipientEmail: emailRecord.to_email,
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                userAgent: request.headers.get('user-agent') || undefined,
              }).catch(err => {
                console.warn('Failed to record open event in email_events:', err)
                // Don't fail tracking if event recording fails
              })
            }
          } catch (err) {
            console.warn('Failed to fetch email record for event tracking:', err)
          }
        } else if (recipientId) {
          // If we only have recipientId, try to get email info from campaign_recipients
          try {
            const { data: recipient } = await supabase
              .from('campaign_recipients')
              .select('email, campaign_id, campaign:campaigns(user_id, mailbox_id)')
              .eq('id', recipientId)
              .single()

            if (recipient && recipient.campaign) {
              const campaign = recipient.campaign as any
              if (campaign.user_id && recipient.email) {
                await recordEmailEvent({
                  userId: campaign.user_id,
                  eventType: 'opened',
                  mailboxId: campaign.mailbox_id || undefined,
                  campaignId: recipient.campaign_id || campaignId || undefined,
                  campaignRecipientId: recipientId,
                  recipientEmail: recipient.email,
                  ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                  userAgent: request.headers.get('user-agent') || undefined,
                }).catch(err => {
                  console.warn('Failed to record open event in email_events:', err)
                })
              }
            }
          } catch (err) {
            console.warn('Failed to fetch recipient record for event tracking:', err)
          }
        }
      }
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    console.error('Open tracking error:', error)
    // Return pixel even on error
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )
    return new NextResponse(pixel, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' }
    })
  }
}
