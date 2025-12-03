import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Steps Reorder API
 * POST: Reorder steps by updating step numbers
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

    // Verify campaign belongs to user and is draft
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Can only reorder steps for draft campaigns' 
      }, { status: 400 })
    }

    const body = await request.json()
    const { stepOrders } = body // Array of { step_id, step_number }

    if (!Array.isArray(stepOrders) || stepOrders.length === 0) {
      return NextResponse.json({ error: 'Invalid step orders' }, { status: 400 })
    }

    // Update each step's step_number
    const updates = stepOrders.map(({ step_id, step_number }: { step_id: string; step_number: number }) =>
      supabase
        .from('campaign_steps')
        .update({ step_number })
        .eq('id', step_id)
        .eq('campaign_id', campaignId)
    )

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)

    if (errors.length > 0) {
      console.error('Step reorder errors:', errors)
      return NextResponse.json({ error: 'Failed to reorder some steps' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Steps reordered successfully',
      step_orders: stepOrders
    })
  } catch (error: any) {
    console.error('Step reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

