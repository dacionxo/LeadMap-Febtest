import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Recipient API
 * DELETE: Remove a recipient from a campaign
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipientId: string }> }
) {
  try {
    const { id, recipientId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Only allow deletion if campaign is in draft status
    if (campaign.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Can only remove leads from draft campaigns' 
      }, { status: 400 })
    }

    // Verify recipient belongs to this campaign
    const { data: recipient, error: recipientError } = await supabase
      .from('campaign_recipients')
      .select('id')
      .eq('id', recipientId)
      .eq('campaign_id', id)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // Delete the recipient
    const { error: deleteError } = await supabase
      .from('campaign_recipients')
      .delete()
      .eq('id', recipientId)
      .eq('campaign_id', id)

    if (deleteError) {
      console.error('Recipient delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to remove recipient' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Recipient removed successfully' })
  } catch (error) {
    console.error('Recipient DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



