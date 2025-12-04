import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * Pause Campaign API
 * POST /api/campaigns/[id]/pause - Pause a running campaign
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

    // Check if campaign can be paused
    if (campaign.status === 'paused') {
      return NextResponse.json({ error: 'Campaign is already paused' }, { status: 400 })
    }

    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot pause a completed or cancelled campaign' }, { status: 400 })
    }

    // Update campaign status
    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      console.error('Campaign pause error:', updateError)
      // Check if it's a column that doesn't exist error
      if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database schema error. Please run the migration to add the paused_at column.',
          details: updateError.message 
        }, { status: 500 })
      }
      return NextResponse.json({ 
        error: 'Failed to pause campaign',
        details: updateError.message || 'Unknown error'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: 'Campaign paused successfully'
    })
  } catch (error: any) {
    console.error('Campaign pause error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
