import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign API by ID
 * GET: Get campaign details
 * PATCH: Update campaign
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get campaign (including all advanced options fields)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get campaign steps
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', id)
      .order('step_number', { ascending: true })

    // Get campaign recipients with stats
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('campaign_id', id)

    // Get mailbox info
    const { data: mailbox } = await supabase
      .from('mailboxes')
      .select('id, email, display_name, provider')
      .eq('id', campaign.mailbox_id)
      .single()

    // Get email stats
    const { data: emails } = await supabase
      .from('emails')
      .select('status, sent_at')
      .eq('campaign_id', id)

    interface EmailStat {
      status: string
      sent_at: string | null
    }

    interface RecipientStat {
      status: string
    }

    const totalSent = emails?.filter((e: EmailStat) => e.status === 'sent').length || 0
    const totalFailed = emails?.filter((e: EmailStat) => e.status === 'failed').length || 0
    const totalQueued = emails?.filter((e: EmailStat) => e.status === 'queued' || e.status === 'sending').length || 0

    return NextResponse.json({
      campaign: {
        ...campaign,
        mailbox,
        steps: steps || [],
        recipients: recipients || [],
        stats: {
          total_recipients: recipients?.length || 0,
          total_sent: totalSent,
          total_failed: totalFailed,
          total_queued: totalQueued,
          completed: recipients?.filter((r: RecipientStat) => r.status === 'completed').length || 0,
          pending: recipients?.filter((r: RecipientStat) => r.status === 'pending' || r.status === 'queued').length || 0,
          bounced: recipients?.filter((r: RecipientStat) => r.status === 'bounced').length || 0,
          unsubscribed: recipients?.filter((r: RecipientStat) => r.status === 'unsubscribed').length || 0
        }
      }
    })
  } catch (error) {
    console.error('Campaign GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: any = {}

    // Allowed fields to update
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.start_at !== undefined) updates.start_at = body.start_at
    if (body.timezone !== undefined) updates.timezone = body.timezone
    if (body.mailbox_id !== undefined) updates.mailbox_id = body.mailbox_id
    if (body.daily_cap !== undefined) updates.daily_cap = body.daily_cap
    if (body.hourly_cap !== undefined) updates.hourly_cap = body.hourly_cap
    if (body.total_cap !== undefined) updates.total_cap = body.total_cap
    if (body.stop_on_reply !== undefined) updates.stop_on_reply = body.stop_on_reply
    if (body.open_tracking_enabled !== undefined) updates.open_tracking_enabled = body.open_tracking_enabled
    if (body.link_tracking_enabled !== undefined) updates.link_tracking_enabled = body.link_tracking_enabled
    if (body.text_only_mode !== undefined) updates.text_only_mode = body.text_only_mode
    if (body.first_email_text_only !== undefined) updates.first_email_text_only = body.first_email_text_only
    if (body.warmup_enabled !== undefined) updates.warmup_enabled = body.warmup_enabled
    if (body.warmup_schedule !== undefined) updates.warmup_schedule = body.warmup_schedule
    // CRM
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id
    if (body.tags !== undefined) updates.tags = body.tags
    // Sending Pattern
    if (body.time_gap_min !== undefined) updates.time_gap_min = body.time_gap_min
    if (body.time_gap_random !== undefined) updates.time_gap_random = body.time_gap_random
    if (body.max_new_leads_per_day !== undefined) updates.max_new_leads_per_day = body.max_new_leads_per_day
    if (body.prioritize_new_leads !== undefined) updates.prioritize_new_leads = body.prioritize_new_leads
    // Auto Optimize A/B Testing
    if (body.auto_optimize_split_test !== undefined) updates.auto_optimize_split_test = body.auto_optimize_split_test
    if (body.split_test_winning_metric !== undefined) updates.split_test_winning_metric = body.split_test_winning_metric
    // Provider Matching
    if (body.provider_matching_enabled !== undefined) updates.provider_matching_enabled = body.provider_matching_enabled
    if (body.esp_routing_rules !== undefined) updates.esp_routing_rules = body.esp_routing_rules
    // Email Compliance
    if (body.stop_company_on_reply !== undefined) updates.stop_company_on_reply = body.stop_company_on_reply
    if (body.stop_on_auto_reply !== undefined) updates.stop_on_auto_reply = body.stop_on_auto_reply
    if (body.unsubscribe_link_header !== undefined) updates.unsubscribe_link_header = body.unsubscribe_link_header
    if (body.allow_risky_emails !== undefined) updates.allow_risky_emails = body.allow_risky_emails
    if (body.status !== undefined) {
      // Validate status transition
      const allowedTransitions: Record<string, string[]> = {
        'draft': ['scheduled', 'running', 'cancelled'],
        'scheduled': ['running', 'paused', 'cancelled'],
        'running': ['paused', 'completed', 'cancelled'],
        'paused': ['running', 'cancelled'],
        'completed': [],
        'cancelled': []
      }

      const currentStatus = existingCampaign.status
      const allowed = allowedTransitions[currentStatus] || []

      if (!allowed.includes(body.status)) {
        return NextResponse.json({
          error: `Cannot transition from ${currentStatus} to ${body.status}`
        }, { status: 400 })
      }

      updates.status = body.status

      // Auto-set start_at if starting now
      if (body.status === 'running' && !existingCampaign.start_at) {
        updates.start_at = new Date().toISOString()
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: campaign, error: updateError } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Campaign update error:', updateError)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Campaign PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Only allow deletion of draft or cancelled campaigns
    // For safety, running campaigns should be cancelled first
    if (!['draft', 'cancelled', 'completed'].includes(existingCampaign.status)) {
      return NextResponse.json({ 
        error: 'Cannot delete campaign with status: ' + existingCampaign.status + '. Please cancel the campaign first.' 
      }, { status: 400 })
    }

    // Delete campaign (cascade will delete related records)
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Campaign delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Campaign DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

