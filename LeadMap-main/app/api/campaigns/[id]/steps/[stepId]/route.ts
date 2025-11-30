import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Step API by ID
 * GET: Get step details
 * PATCH: Update step
 * DELETE: Delete step
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get step with variants
    const { data: step, error: stepError } = await supabase
      .from('campaign_steps')
      .select(`
        *,
        variants:campaign_step_variants(*)
      `)
      .eq('id', stepId)
      .eq('campaign_id', id)
      .single()

    if (stepError || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    return NextResponse.json({ step })
  } catch (error) {
    console.error('Campaign step GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user and is draft
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Cannot modify steps for non-draft campaigns' 
      }, { status: 400 })
    }

    const body = await request.json()
    const updates: any = {}

    // Allowed fields to update
    if (body.delay_hours !== undefined) updates.delay_hours = body.delay_hours
    if (body.delay_days !== undefined) updates.delay_days = body.delay_days
    if (body.subject !== undefined) updates.subject = body.subject
    if (body.html !== undefined) updates.html = body.html
    if (body.plain_text !== undefined) updates.plain_text = body.plain_text
    if (body.template_id !== undefined) {
      updates.template_id = body.template_id === null || body.template_id === '' ? null : body.template_id
    }
    if (body.stop_on_reply !== undefined) updates.stop_on_reply = body.stop_on_reply
    if (body.stop_on_bounce !== undefined) updates.stop_on_bounce = body.stop_on_bounce
    if (body.stop_on_unsubscribe !== undefined) updates.stop_on_unsubscribe = body.stop_on_unsubscribe

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: step, error: updateError } = await supabase
      .from('campaign_steps')
      .update(updates)
      .eq('id', stepId)
      .eq('campaign_id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Step update error:', updateError)
      return NextResponse.json({ error: 'Failed to update step' }, { status: 500 })
    }

    return NextResponse.json({ step })
  } catch (error) {
    console.error('Campaign step PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user and is draft
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Cannot delete steps for non-draft campaigns' 
      }, { status: 400 })
    }

    // Delete step (variants will be deleted via CASCADE)
    const { error: deleteError } = await supabase
      .from('campaign_steps')
      .delete()
      .eq('id', stepId)
      .eq('campaign_id', id)

    if (deleteError) {
      console.error('Step deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Campaign step DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

