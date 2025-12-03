// app/api/sms/campaigns/route.ts
/**
 * SMS Campaigns API
 * GET: List campaigns for the authenticated user
 * POST: Create a new campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    let query = supabase
      .from('sms_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data: campaigns, error } = await query

    if (error) {
      console.error('Campaigns fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    return NextResponse.json({ campaigns: campaigns || [] })
  } catch (error: any) {
    console.error('Campaigns GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, type = 'drip', segment_filters = {} } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Campaign name required' }, { status: 400 })
    }

    const { data: campaign, error } = await supabase
      .from('sms_campaigns')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        type,
        status: 'draft',
        segment_filters
      })
      .select('*')
      .single()

    if (error) {
      console.error('Campaign create error:', error)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Log event
    await supabase.from('sms_events').insert({
      event_type: 'campaign_started',
      user_id: user.id,
      campaign_id: campaign.id,
      occurred_at: new Date().toISOString(),
      details: { name, type }
    })

    return NextResponse.json({ campaign })
  } catch (error: any) {
    console.error('Campaigns POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

