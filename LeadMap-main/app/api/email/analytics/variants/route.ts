import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * A/B Testing Variants Analytics API
 * GET /api/email/analytics/variants?parentEmailId=...
 * Returns A/B test variant performance data following Mautic patterns
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parentEmailId = searchParams.get('parentEmailId')

    if (!parentEmailId) {
      return NextResponse.json({ error: 'parentEmailId parameter is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify parent email belongs to user
    const { data: parentEmail, error: emailError } = await supabaseAdmin
      .from('emails')
      .select('id, user_id')
      .eq('id', parentEmailId)
      .eq('user_id', user.id)
      .single()

    if (emailError || !parentEmail) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Get all variants for this parent email
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from('email_variants')
      .select('*')
      .eq('parent_email_id', parentEmailId)
      .eq('user_id', user.id)
      .order('variant_name', { ascending: true })

    if (variantsError) {
      console.error('Error fetching variants:', variantsError)
      return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 })
    }

    // Get performance data for each variant
    const variantsWithPerformance = await Promise.all(
      (variants || []).map(async (variant) => {
        // Calculate performance
        const { data: performance, error: perfError } = await supabaseAdmin.rpc(
          'calculate_variant_performance',
          { p_variant_id: variant.id }
        )

        // Get performance record
        const { data: perfRecord } = await supabaseAdmin
          .from('variant_performance')
          .select('*')
          .eq('variant_id', variant.id)
          .single()

        return {
          ...variant,
          performance: perfRecord || {
            sent_count: 0,
            delivered_count: 0,
            opened_count: 0,
            clicked_count: 0,
            replied_count: 0,
            open_rate: 0,
            click_rate: 0,
            reply_rate: 0,
          },
        }
      })
    )

    // Determine winner if test is running
    const runningVariants = variantsWithPerformance.filter((v) => v.status === 'running')
    if (runningVariants.length > 0) {
      const { data: winnerId } = await supabaseAdmin.rpc('determine_ab_test_winner', {
        p_parent_email_id: parentEmailId,
      })
    }

    return NextResponse.json({
      parentEmailId,
      variants: variantsWithPerformance,
    })
  } catch (error: any) {
    console.error('A/B testing variants API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/analytics/variants
 * Create a new A/B test variant
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      parentEmailId,
      variantName,
      variantType,
      subject,
      htmlContent,
      fromName,
      fromEmail,
      winnerCriteria,
      minimumSampleSize,
      confidenceLevel,
    } = body

    if (!parentEmailId || !variantName || !variantType) {
      return NextResponse.json(
        { error: 'parentEmailId, variantName, and variantType are required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify parent email belongs to user
    const { data: parentEmail, error: emailError } = await supabaseAdmin
      .from('emails')
      .select('id, user_id')
      .eq('id', parentEmailId)
      .eq('user_id', user.id)
      .single()

    if (emailError || !parentEmail) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Create variant
    const { data: variant, error: variantError } = await supabaseAdmin
      .from('email_variants')
      .insert({
        user_id: user.id,
        parent_email_id: parentEmailId,
        variant_name: variantName,
        variant_type: variantType,
        subject,
        html_content: htmlContent,
        from_name: fromName,
        from_email: fromEmail,
        winner_criteria: winnerCriteria || 'open_rate',
        minimum_sample_size: minimumSampleSize || 100,
        confidence_level: confidenceLevel || 95.0,
        status: 'draft',
      })
      .select()
      .single()

    if (variantError) {
      console.error('Error creating variant:', variantError)
      return NextResponse.json({ error: 'Failed to create variant' }, { status: 500 })
    }

    return NextResponse.json({ variant }, { status: 201 })
  } catch (error: any) {
    console.error('A/B testing variants POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}










