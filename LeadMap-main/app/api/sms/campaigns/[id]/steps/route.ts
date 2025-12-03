// app/api/sms/campaigns/[id]/steps/route.ts
/**
 * SMS Campaign Steps API
 * GET: List steps for a campaign
 * POST: Create a new step
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('sms_campaigns')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { data: steps, error } = await supabase
      .from('sms_campaign_steps')
      .select('*')
      .eq('campaign_id', params.id)
      .order('step_order', { ascending: true })

    if (error) {
      console.error('Steps fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 })
    }

    return NextResponse.json({ steps: steps || [] })
  } catch (error: any) {
    console.error('Steps GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('sms_campaigns')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      step_order,
      delay_minutes = 0,
      template_body,
      stop_on_reply = true,
      quiet_hours_start,
      quiet_hours_end,
      metadata = {}
    } = body

    if (step_order === undefined || step_order === null) {
      return NextResponse.json({ error: 'step_order required' }, { status: 400 })
    }

    if (!template_body || !template_body.trim()) {
      return NextResponse.json({ error: 'template_body required' }, { status: 400 })
    }

    const { data: step, error } = await supabase
      .from('sms_campaign_steps')
      .insert({
        campaign_id: params.id,
        step_order: parseInt(step_order, 10),
        delay_minutes: parseInt(delay_minutes, 10),
        template_body: template_body.trim(),
        stop_on_reply: stop_on_reply === true,
        quiet_hours_start: quiet_hours_start || null,
        quiet_hours_end: quiet_hours_end || null,
        metadata
      })
      .select('*')
      .single()

    if (error) {
      console.error('Step create error:', error)
      return NextResponse.json({ error: 'Failed to create step' }, { status: 500 })
    }

    return NextResponse.json({ step })
  } catch (error: any) {
    console.error('Steps POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

