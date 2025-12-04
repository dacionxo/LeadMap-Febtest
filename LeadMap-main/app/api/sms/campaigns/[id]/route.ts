// app/api/sms/campaigns/[id]/route.ts
/**
 * SMS Campaign API (Single)
 * GET: Get campaign details
 * PATCH: Update campaign
 * DELETE: Delete campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  req: NextRequest,
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

    const { data: campaign, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get steps
    const { data: steps } = await supabase
      .from('sms_campaign_steps')
      .select('*')
      .eq('campaign_id', id)
      .order('step_order', { ascending: true })

    // Get enrollment count
    const { count: enrollmentCount } = await supabase
      .from('sms_campaign_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id)

    return NextResponse.json({
      campaign: {
        ...campaign,
        steps: steps || [],
        enrollment_count: enrollmentCount || 0
      }
    })
  } catch (error: any) {
    console.error('Campaign GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json()
    const { name, description, status, segment_filters } = body

    // Verify ownership
    const { data: existing } = await supabase
      .from('sms_campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (status !== undefined) updateData.status = status
    if (segment_filters !== undefined) updateData.segment_filters = segment_filters

    const { data: campaign, error } = await supabase
      .from('sms_campaigns')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Campaign update error:', error)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    return NextResponse.json({ campaign })
  } catch (error: any) {
    console.error('Campaign PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('sms_campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Delete campaign (cascade will delete steps and enrollments)
    const { error } = await supabase
      .from('sms_campaigns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Campaign delete error:', error)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Campaign DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

