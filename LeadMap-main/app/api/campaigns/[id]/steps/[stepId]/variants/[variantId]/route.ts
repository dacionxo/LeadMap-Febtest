import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Step Variant API by ID
 * GET: Get variant details
 * PATCH: Update variant
 * DELETE: Delete variant
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string; variantId: string }> }
) {
  try {
    const { id, stepId, variantId } = await params
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

    // Get variant
    const { data: variant, error: variantError } = await supabase
      .from('campaign_step_variants')
      .select('*')
      .eq('id', variantId)
      .eq('step_id', stepId)
      .single()

    if (variantError || !variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json({ variant })
  } catch (error) {
    console.error('Campaign step variant GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string; variantId: string }> }
) {
  try {
    const { id, stepId, variantId } = await params
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
        error: 'Cannot modify variants for non-draft campaigns' 
      }, { status: 400 })
    }

    const body = await request.json()
    const updates: any = {}

    // Allowed fields to update
    if (body.subject !== undefined) updates.subject = body.subject
    if (body.html !== undefined) updates.html = body.html
    if (body.plain_text !== undefined) updates.plain_text = body.plain_text
    if (body.name !== undefined) updates.name = body.name
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.send_percentage !== undefined) updates.send_percentage = body.send_percentage

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: variant, error: updateError } = await supabase
      .from('campaign_step_variants')
      .update(updates)
      .eq('id', variantId)
      .eq('step_id', stepId)
      .select()
      .single()

    if (updateError) {
      console.error('Variant update error:', updateError)
      return NextResponse.json({ error: 'Failed to update variant' }, { status: 500 })
    }

    return NextResponse.json({ variant })
  } catch (error) {
    console.error('Campaign step variant PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string; variantId: string }> }
) {
  try {
    const { id, stepId, variantId } = await params
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
        error: 'Cannot delete variants for non-draft campaigns' 
      }, { status: 400 })
    }

    // Prevent deleting the last variant
    const { data: variants } = await supabase
      .from('campaign_step_variants')
      .select('id')
      .eq('step_id', stepId)

    if (variants && variants.length <= 1) {
      return NextResponse.json({ 
        error: 'Cannot delete the last variant. Each step must have at least one variant.' 
      }, { status: 400 })
    }

    // Delete variant
    const { error: deleteError } = await supabase
      .from('campaign_step_variants')
      .delete()
      .eq('id', variantId)
      .eq('step_id', stepId)

    if (deleteError) {
      console.error('Variant deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete variant' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Campaign step variant DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


