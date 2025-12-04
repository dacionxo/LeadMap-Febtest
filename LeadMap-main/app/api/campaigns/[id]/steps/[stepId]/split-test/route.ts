import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Split Test Configuration API
 * GET: Get split test configuration for a step
 * POST: Create/update split test configuration
 * DELETE: Disable split test
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: campaignId, stepId } = await params
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
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get split test configuration
    const { data: splitTest, error: splitTestError } = await supabase
      .from('campaign_step_split_tests')
      .select('*')
      .eq('step_id', stepId)
      .single()

    if (splitTestError && splitTestError.code !== 'PGRST116') {
      console.error('Split test fetch error:', splitTestError)
      return NextResponse.json({ error: 'Failed to fetch split test' }, { status: 500 })
    }

    // Get variant distributions if split test exists
    let distributions: any[] = []
    if (splitTest) {
      const { data: distData, error: distError } = await supabase
        .from('campaign_variant_distributions')
        .select('*, variant:campaign_step_variants(id, variant_number, name)')
        .eq('split_test_id', splitTest.id)
        .order('variant:campaign_step_variants(variant_number)', { ascending: true })

      if (!distError) {
        distributions = distData || []
      }
    }

    // Get analytics
    let analytics: any[] = []
    if (splitTest) {
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('split_test_analytics')
        .select('*')
        .eq('split_test_id', splitTest.id)
        .order('variant_number', { ascending: true })

      if (!analyticsError) {
        analytics = analyticsData || []
      }
    }

    return NextResponse.json({
      splitTest: splitTest || null,
      distributions,
      analytics
    })
  } catch (error) {
    console.error('Split test GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: campaignId, stepId } = await params
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
        error: 'Cannot modify split test for non-draft campaigns' 
      }, { status: 400 })
    }

    // Verify step exists
    const { data: step } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('id', stepId)
      .eq('campaign_id', campaignId)
      .single()

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      is_enabled,
      distribution_method,
      winner_selection_criteria,
      auto_select_winner,
      min_recipients_per_variant,
      min_time_hours,
      confidence_level,
      test_duration_hours,
      test_duration_recipients,
      notes,
      distributions // Array of { variant_id, send_percentage, weight }
    } = body

    // Check if split test exists
    const { data: existingSplitTest } = await supabase
      .from('campaign_step_split_tests')
      .select('id')
      .eq('step_id', stepId)
      .single()

    let splitTestId: string

    if (existingSplitTest) {
      // Update existing split test
      const { data: updated, error: updateError } = await supabase
        .from('campaign_step_split_tests')
        .update({
          is_enabled,
          distribution_method: distribution_method || 'equal',
          winner_selection_criteria: winner_selection_criteria || 'open_rate',
          auto_select_winner: auto_select_winner || false,
          min_recipients_per_variant: min_recipients_per_variant || 100,
          min_time_hours: min_time_hours || 24,
          confidence_level: confidence_level || 95.00,
          test_duration_hours,
          test_duration_recipients,
          notes,
          started_at: is_enabled && !existingSplitTest.is_enabled ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSplitTest.id)
        .select()
        .single()

      if (updateError) {
        console.error('Split test update error:', updateError)
        return NextResponse.json({ error: 'Failed to update split test' }, { status: 500 })
      }

      splitTestId = updated.id
    } else {
      // Create new split test
      const { data: created, error: createError } = await supabase
        .from('campaign_step_split_tests')
        .insert({
          step_id: stepId,
          user_id: user.id,
          is_enabled,
          distribution_method: distribution_method || 'equal',
          winner_selection_criteria: winner_selection_criteria || 'open_rate',
          auto_select_winner: auto_select_winner || false,
          min_recipients_per_variant: min_recipients_per_variant || 100,
          min_time_hours: min_time_hours || 24,
          confidence_level: confidence_level || 95.00,
          test_duration_hours,
          test_duration_recipients,
          notes,
          started_at: is_enabled ? new Date().toISOString() : null
        })
        .select()
        .single()

      if (createError) {
        console.error('Split test creation error:', createError)
        return NextResponse.json({ error: 'Failed to create split test' }, { status: 500 })
      }

      splitTestId = created.id
    }

    // Update or create distributions
    if (distributions && Array.isArray(distributions)) {
      // Delete existing distributions
      await supabase
        .from('campaign_variant_distributions')
        .delete()
        .eq('split_test_id', splitTestId)

      // Insert new distributions
      if (distributions.length > 0) {
        const distRows = distributions.map((dist: any) => ({
          split_test_id: splitTestId,
          variant_id: dist.variant_id,
          send_percentage: dist.send_percentage || 50,
          weight: dist.weight || 1
        }))

        const { error: distError } = await supabase
          .from('campaign_variant_distributions')
          .insert(distRows)

        if (distError) {
          console.error('Distribution insert error:', distError)
          // Don't fail the whole request, just log it
        }
      }
    }

    // Fetch updated split test with distributions
    const { data: updatedSplitTest } = await supabase
      .from('campaign_step_split_tests')
      .select('*')
      .eq('id', splitTestId)
      .single()

    const { data: updatedDistributions } = await supabase
      .from('campaign_variant_distributions')
      .select('*, variant:campaign_step_variants(id, variant_number, name)')
      .eq('split_test_id', splitTestId)

    return NextResponse.json({
      splitTest: updatedSplitTest,
      distributions: updatedDistributions || []
    })
  } catch (error) {
    console.error('Split test POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: campaignId, stepId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
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
        error: 'Cannot delete split test for non-draft campaigns' 
      }, { status: 400 })
    }

    // Disable split test (don't delete, just disable)
    const { error: updateError } = await supabase
      .from('campaign_step_split_tests')
      .update({
        is_enabled: false,
        ended_at: new Date().toISOString()
      })
      .eq('step_id', stepId)

    if (updateError) {
      console.error('Split test disable error:', updateError)
      return NextResponse.json({ error: 'Failed to disable split test' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Split test DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

