import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Steps API
 * GET: Get all steps for a campaign
 * POST: Create a new step
 */

export async function GET(
  request: NextRequest,
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

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get all steps with variants
    const { data: steps, error: stepsError } = await supabase
      .from('campaign_steps')
      .select(`
        *,
        variants:campaign_step_variants(*)
      `)
      .eq('campaign_id', id)
      .order('step_number', { ascending: true })

    if (stepsError) {
      console.error('Steps fetch error:', stepsError)
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 })
    }

    return NextResponse.json({ steps: steps || [] })
  } catch (error) {
    console.error('Campaign steps GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
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

    // Only allow editing steps for draft campaigns
    if (campaign.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Cannot modify steps for non-draft campaigns' 
      }, { status: 400 })
    }

    const body = await request.json()
    const { step_number, delay_hours, delay_days, subject, html, plain_text, template_id } = body

    // Get the next step number if not provided
    let finalStepNumber = step_number
    if (!finalStepNumber) {
      const { data: existingSteps } = await supabase
        .from('campaign_steps')
        .select('step_number')
        .eq('campaign_id', id)
        .order('step_number', { ascending: false })
        .limit(1)

      finalStepNumber = existingSteps && existingSteps.length > 0 
        ? existingSteps[0].step_number + 1 
        : 1
    }

    // Create the step
    const { data: step, error: stepError } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id: id,
        step_number: finalStepNumber,
        delay_hours: delay_hours || 0,
        delay_days: delay_days || 0,
        subject: subject || '<Empty subject>',
        html: html || '',
        plain_text: plain_text || null,
        template_id: template_id || null,
        stop_on_reply: true,
        stop_on_bounce: true,
        stop_on_unsubscribe: true
      })
      .select()
      .single()

    if (stepError) {
      console.error('Step creation error:', stepError)
      return NextResponse.json({ error: 'Failed to create step' }, { status: 500 })
    }

    // Create default variant for the step
    const { data: variant, error: variantError } = await supabase
      .from('campaign_step_variants')
      .insert({
        step_id: step.id,
        variant_number: 1,
        subject: step.subject,
        html: step.html,
        plain_text: step.plain_text,
        is_active: true,
        send_percentage: 100
      })
      .select()
      .single()

    if (variantError) {
      console.error('Variant creation error:', variantError)
      // Step was created but variant failed - still return the step
    }

    return NextResponse.json({ 
      step: {
        ...step,
        variants: variant ? [variant] : []
      }
    })
  } catch (error) {
    console.error('Campaign steps POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

