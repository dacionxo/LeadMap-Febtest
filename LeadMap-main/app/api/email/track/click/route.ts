import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordEmailEvent } from '@/lib/email/event-tracking'

/**
 * Email Click Tracking
 * GET /api/email/track/click?url=...&email_id=...&recipient_id=...
 * Tracks email link clicks and redirects to original URL
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const emailId = searchParams.get('email_id')
    const recipientId = searchParams.get('recipient_id')
    const campaignId = searchParams.get('campaign_id')

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      // If no database, just redirect
      return NextResponse.redirect(url)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Record click event
    if (emailId || recipientId) {
      try {
        const { error } = await supabase
          .from('email_clicks')
          .insert({
            email_id: emailId || null,
            campaign_recipient_id: recipientId || null,
            campaign_id: campaignId || null,
            clicked_url: url,
            clicked_at: new Date().toISOString(),
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            user_agent: request.headers.get('user-agent') || null
          })
        if (error) {
          // Log but don't fail if table doesn't exist yet
          console.warn('Failed to log click:', error)
        }
      } catch (err) {
        // Log but don't fail if table doesn't exist yet
        console.warn('Failed to log click:', err)
      }

      // Update email/campaign recipient if applicable
      if (emailId) {
        try {
          await supabase
            .from('emails')
            .update({ clicked_at: new Date().toISOString() })
            .eq('id', emailId)
        } catch {
          // Ignore errors
        }
      }

      if (recipientId) {
        try {
          await supabase
            .from('campaign_recipients')
            .update({ clicked: true, clicked_at: new Date().toISOString() })
            .eq('id', recipientId)
        } catch {
          // Ignore errors
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
              eventType: 'clicked',
              emailId: emailId,
              mailboxId: emailRecord.mailbox_id || undefined,
              campaignId: emailRecord.campaign_id || campaignId || undefined,
              campaignRecipientId: emailRecord.campaign_recipient_id || recipientId || undefined,
              recipientEmail: emailRecord.to_email,
              clickedUrl: url,
              ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
              userAgent: request.headers.get('user-agent') || undefined,
            }).catch(err => {
              console.warn('Failed to record click event in email_events:', err)
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
                eventType: 'clicked',
                mailboxId: campaign.mailbox_id || undefined,
                campaignId: recipient.campaign_id || campaignId || undefined,
                campaignRecipientId: recipientId,
                recipientEmail: recipient.email,
                clickedUrl: url,
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                userAgent: request.headers.get('user-agent') || undefined,
              }).catch(err => {
                console.warn('Failed to record click event in email_events:', err)
              })
            }
          }
        } catch (err) {
          console.warn('Failed to fetch recipient record for event tracking:', err)
        }
      }
    }

    // Redirect to original URL
    return NextResponse.redirect(url)
  } catch (error: any) {
    console.error('Click tracking error:', error)
    // Even on error, try to redirect
    const url = new URL(request.url).searchParams.get('url')
    if (url) {
      return NextResponse.redirect(url)
    }
    return NextResponse.json({ error: 'Tracking error' }, { status: 500 })
  }
}

