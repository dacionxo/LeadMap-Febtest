import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Step Variants API
 * GET: Get all variants for a step
 * POST: Create a new variant
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

    // Get all variants for the step
    const { data: variants, error: variantsError } = await supabase
      .from('campaign_step_variants')
      .select('*')
      .eq('step_id', stepId)
      .order('variant_number', { ascending: true })

    if (variantsError) {
      console.error('Variants fetch error:', variantsError)
      return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 })
    }

    return NextResponse.json({ variants: variants || [] })
  } catch (error) {
    console.error('Campaign step variants GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
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
        error: 'Cannot modify variants for non-draft campaigns' 
      }, { status: 400 })
    }

    // Verify step exists and belongs to campaign
    const { data: step, error: stepError } = await supabase
      .from('campaign_steps')
      .select('id, subject, html, plain_text')
      .eq('id', stepId)
      .eq('campaign_id', id)
      .single()

    if (stepError || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const body = await request.json()
    const { subject, html, plain_text, name, send_percentage } = body

    // Get the next variant number
    const { data: existingVariants } = await supabase
      .from('campaign_step_variants')
      .select('variant_number')
      .eq('step_id', stepId)
      .order('variant_number', { ascending: false })
      .limit(1)

    const nextVariantNumber = existingVariants && existingVariants.length > 0
      ? existingVariants[0].variant_number + 1
      : 1

    // Create the variant
    const { data: variant, error: variantError } = await supabase
      .from('campaign_step_variants')
      .insert({
        step_id: stepId,
        variant_number: nextVariantNumber,
        name: name || `Variant ${nextVariantNumber}`,
        subject: subject || step.subject || '<Empty subject>',
        html: html || step.html || '',
        plain_text: plain_text || step.plain_text || null,
        is_active: true,
        send_percentage: send_percentage || 100
      })
      .select()
      .single()

    if (variantError) {
      console.error('Variant creation error:', variantError)
      return NextResponse.json({ error: 'Failed to create variant' }, { status: 500 })
    }

    return NextResponse.json({ variant })
  } catch (error) {
    console.error('Campaign step variants POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


