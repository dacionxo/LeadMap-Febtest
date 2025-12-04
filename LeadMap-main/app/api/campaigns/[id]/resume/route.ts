import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { queueDripFeedEmails } from '@/lib/email/campaigns/drip-feed'

/**
 * Resume Campaign API
 * POST /api/campaigns/[id]/resume - Resume a paused campaign
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get campaign and verify ownership
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check if campaign can be resumed/started
    if (!['paused', 'draft'].includes(campaign.status)) {
      return NextResponse.json({ 
        error: `Campaign cannot be resumed. Current status: ${campaign.status}. Only paused or draft campaigns can be resumed.` 
      }, { status: 400 })
    }

    // Determine new status based on start_at
    const now = new Date()
    const startAt = campaign.start_at ? new Date(campaign.start_at) : null
    let newStatus = 'running'
    
    if (startAt && startAt > now) {
      newStatus = 'scheduled'
    } else if (!startAt && campaign.status === 'draft') {
      // If no start_at and it's a draft, set start_at to now and make it running
      // This will be handled in the update
    }

    // Prepare update object
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    // Only set resumed_at if campaign was paused (not if it's a draft being started)
    if (campaign.status === 'paused') {
      updateData.resumed_at = new Date().toISOString()
    }
    
    // If draft and no start_at, set start_at to now
    if (campaign.status === 'draft' && !campaign.start_at) {
      updateData.start_at = new Date().toISOString()
    }

    // Update campaign status
    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      console.error('Campaign resume error:', updateError)
      // Check if it's a column that doesn't exist error
      if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database schema error. Please run the migration to add the resumed_at column.',
          details: updateError.message 
        }, { status: 500 })
      }
      return NextResponse.json({ 
        error: 'Failed to resume campaign',
        details: updateError.message || 'Unknown error'
      }, { status: 500 })
    }

    // Queue initial emails with drip feed if campaign is starting or resuming
    if ((campaign.status === 'draft' && newStatus === 'running') || 
        (campaign.status === 'paused' && newStatus === 'running')) {
      try {
        // Get first step
        const { data: firstStep } = await supabaseAdmin
          .from('campaign_steps')
          .select('*')
          .eq('campaign_id', campaignId)
          .eq('step_number', 1)
          .single()

        if (firstStep) {
          // Get all pending/queued recipients that don't have step 1 emails queued yet
          const { data: recipients } = await supabaseAdmin
            .from('campaign_recipients')
            .select('id, email, first_name, last_name')
            .eq('campaign_id', campaignId)
            .in('status', ['pending', 'queued'])

          if (recipients && recipients.length > 0) {
            // Get campaign with all fields needed for drip feed
            const { data: fullCampaign } = await supabaseAdmin
              .from('campaigns')
              .select('*')
              .eq('id', campaignId)
              .single()

            if (fullCampaign) {
              const result = await queueDripFeedEmails(
                supabaseAdmin,
                fullCampaign,
                recipients,
                firstStep
              )
              console.log(`Queued ${result.queued} emails with drip feed for campaign ${campaignId}`)
            }
          }
        }
      } catch (dripFeedError: any) {
        console.error('Error queueing drip feed emails:', dripFeedError)
        // Don't fail the resume if drip feed fails - emails can be queued later
      }
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: 'Campaign resumed successfully'
    })
  } catch (error: any) {
    console.error('Campaign resume error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
