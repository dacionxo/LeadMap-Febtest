import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Mailboxes API
 * GET: Get all mailboxes for a campaign
 * POST: Set mailboxes for a campaign (replaces existing)
 */

export async function GET(
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

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get campaign mailboxes
    const { data: campaignMailboxes, error: mailboxesError } = await supabase
      .from('campaign_mailboxes')
      .select(`
        mailbox_id,
        mailboxes:mailbox_id (
          id,
          email,
          display_name,
          provider,
          active
        )
      `)
      .eq('campaign_id', campaignId)

    if (mailboxesError) {
      console.error('Error fetching campaign mailboxes:', mailboxesError)
      // If table doesn't exist, return empty array (backward compatibility)
      if (mailboxesError.code === '42P01' || mailboxesError.message?.includes('does not exist')) {
        return NextResponse.json({ mailboxes: [] })
      }
      return NextResponse.json({ error: 'Failed to fetch campaign mailboxes' }, { status: 500 })
    }

    const mailboxes = (campaignMailboxes || [])
      .map((cm: any) => cm.mailboxes)
      .filter(Boolean)

    return NextResponse.json({ mailboxes })
  } catch (error: any) {
    console.error('GET campaign mailboxes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // Verify campaign belongs to user and is draft
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Mailboxes can only be changed for draft campaigns' 
      }, { status: 400 })
    }

    const body = await request.json()
    const { mailboxIds } = body

    if (!Array.isArray(mailboxIds)) {
      return NextResponse.json({ error: 'mailboxIds must be an array' }, { status: 400 })
    }

    if (mailboxIds.length === 0) {
      return NextResponse.json({ error: 'At least one mailbox is required' }, { status: 400 })
    }

    // Verify all mailboxes belong to user and are active
    const { data: mailboxes, error: mailboxesError } = await supabase
      .from('mailboxes')
      .select('id, active')
      .in('id', mailboxIds)
      .eq('user_id', user.id)

    if (mailboxesError) {
      return NextResponse.json({ error: 'Failed to verify mailboxes' }, { status: 500 })
    }

    if (!mailboxes || mailboxes.length !== mailboxIds.length) {
      return NextResponse.json({ error: 'One or more mailboxes not found or do not belong to user' }, { status: 404 })
    }

    const inactiveMailboxes = mailboxes.filter(m => !m.active)
    if (inactiveMailboxes.length > 0) {
      return NextResponse.json({ error: 'One or more mailboxes are not active' }, { status: 400 })
    }

    // Delete existing campaign mailboxes
    const { error: deleteError } = await supabase
      .from('campaign_mailboxes')
      .delete()
      .eq('campaign_id', campaignId)

    if (deleteError && deleteError.code !== '42P01') { // Ignore if table doesn't exist
      console.error('Error deleting existing campaign mailboxes:', deleteError)
      // Continue anyway - might be first time setting mailboxes
    }

    // Insert new campaign mailboxes
    const campaignMailboxInserts = mailboxIds.map((mailboxId: string) => ({
      campaign_id: campaignId,
      mailbox_id: mailboxId,
      user_id: user.id
    }))

    const { error: insertError } = await supabase
      .from('campaign_mailboxes')
      .insert(campaignMailboxInserts)

    if (insertError) {
      console.error('Error inserting campaign mailboxes:', insertError)
      // If table doesn't exist, fall back to updating mailbox_id on campaign
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        // Update campaign with first mailbox (backward compatibility)
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ mailbox_id: mailboxIds[0] })
          .eq('id', campaignId)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update campaign mailbox' }, { status: 500 })
        }
        return NextResponse.json({ 
          success: true, 
          message: 'Mailbox updated (using legacy single mailbox mode)',
          mailboxIds: [mailboxIds[0]]
        })
      }
      return NextResponse.json({ error: 'Failed to save campaign mailboxes' }, { status: 500 })
    }

    // Also update the campaign's mailbox_id to the first one for backward compatibility
    await supabase
      .from('campaigns')
      .update({ mailbox_id: mailboxIds[0] })
      .eq('id', campaignId)

    return NextResponse.json({ 
      success: true, 
      message: `Successfully set ${mailboxIds.length} mailbox(es) for campaign`,
      mailboxIds 
    })
  } catch (error: any) {
    console.error('POST campaign mailboxes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

