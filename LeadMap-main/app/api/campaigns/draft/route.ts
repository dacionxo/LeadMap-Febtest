import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Create Draft Campaign
 * POST /api/campaigns/draft
 * Creates a minimal draft campaign with just a name
 * Automatically selects the user's first active mailbox
 */

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    // Get user's first active mailbox
    const { data: mailboxes, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)

    if (mailboxError) {
      console.error('Error fetching mailboxes:', mailboxError)
      return NextResponse.json({ error: 'Failed to fetch mailboxes' }, { status: 500 })
    }

    if (!mailboxes || mailboxes.length === 0) {
      return NextResponse.json({ 
        error: 'No active mailboxes found. Please connect a mailbox first.' 
      }, { status: 400 })
    }

    const mailboxId = mailboxes[0].id

    // Create draft campaign with minimal info
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        mailbox_id: mailboxId,
        name: name.trim(),
        description: '',
        status: 'draft',
        send_strategy: 'single', // Default, can be changed later
        timezone: 'UTC'
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Create a default first step for the campaign
    const { error: stepError } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id: campaign.id,
        step_number: 1,
        delay_hours: 0,
        subject: '',
        html: '',
        stop_on_reply: true
      })

    if (stepError) {
      console.error('Error creating default step:', stepError)
      // Continue anyway - step can be created later
    }

    return NextResponse.json({ 
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status
      }
    })
  } catch (error: any) {
    console.error('Error in create draft campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


