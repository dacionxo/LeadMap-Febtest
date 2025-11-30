import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Campaign Schedule API
 * PATCH /api/campaigns/[id]/schedule - Update campaign schedule settings
 * GET /api/campaigns/[id]/schedule - Get campaign schedule settings
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

    // Get campaign schedule settings
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, start_at, timezone, send_window_start, send_window_end, send_days_of_week')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({
      schedule: {
        name: campaign.name,
        start_at: campaign.start_at,
        timezone: campaign.timezone || 'UTC',
        send_window_start: campaign.send_window_start || '09:00:00',
        send_window_end: campaign.send_window_end || '17:00:00',
        send_days_of_week: campaign.send_days_of_week || [1, 2, 3, 4, 5]
      }
    })
  } catch (error: any) {
    console.error('Get schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
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
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Only allow updates if campaign is in draft or paused status
    if (!['draft', 'paused'].includes(existingCampaign.status)) {
      return NextResponse.json({ 
        error: 'Schedule can only be updated for draft or paused campaigns' 
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      schedule_name,
      start_at,
      timezone,
      send_window_start,
      send_window_end,
      send_days_of_week
    } = body

    const updates: any = {
      updated_at: new Date().toISOString()
    }

    // Update schedule name if provided
    if (schedule_name !== undefined) {
      updates.name = schedule_name
    }

    // Update start_at
    if (start_at !== undefined) {
      updates.start_at = start_at
      
      // Update status if start_at is in the future
      if (start_at && new Date(start_at) > new Date()) {
        updates.status = 'scheduled'
      } else if (start_at && new Date(start_at) <= new Date() && existingCampaign.status === 'scheduled') {
        updates.status = 'draft'
      }
    }

    // Update timezone
    if (timezone !== undefined) {
      updates.timezone = timezone
    }

    // Update send window start
    if (send_window_start !== undefined) {
      // Ensure format is HH:MM:SS
      const timeFormatted = send_window_start.includes(':') 
        ? (send_window_start.split(':').length === 2 ? `${send_window_start}:00` : send_window_start)
        : `${send_window_start}:00:00`
      updates.send_window_start = timeFormatted
    }

    // Update send window end
    if (send_window_end !== undefined) {
      // Ensure format is HH:MM:SS
      const timeFormatted = send_window_end.includes(':')
        ? (send_window_end.split(':').length === 2 ? `${send_window_end}:00` : send_window_end)
        : `${send_window_end}:00:00`
      updates.send_window_end = timeFormatted
    }

    // Update days of week
    if (send_days_of_week !== undefined) {
      // Validate days are 1-7
      const validDays = send_days_of_week.filter((day: number) => day >= 1 && day <= 7)
      if (validDays.length === 0) {
        return NextResponse.json({ 
          error: 'At least one day of the week must be selected' 
        }, { status: 400 })
      }
      updates.send_days_of_week = validDays.sort()
    }

    // Update campaign
    const { data: campaign, error: updateError } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Schedule update error:', updateError)
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
    }

    return NextResponse.json({ 
      campaign,
      message: 'Schedule updated successfully' 
    })
  } catch (error: any) {
    console.error('Update schedule error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

