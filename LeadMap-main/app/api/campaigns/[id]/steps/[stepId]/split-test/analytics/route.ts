import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Split Test Analytics API
 * GET: Get detailed analytics for a split test
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

    // Get split test
    const { data: splitTest } = await supabase
      .from('campaign_step_split_tests')
      .select('*')
      .eq('step_id', stepId)
      .single()

    if (!splitTest) {
      return NextResponse.json({ error: 'Split test not found' }, { status: 404 })
    }

    // Get analytics from view
    const { data: analytics, error: analyticsError } = await supabase
      .from('split_test_analytics')
      .select('*')
      .eq('split_test_id', splitTest.id)
      .order('variant_number', { ascending: true })

    if (analyticsError) {
      console.error('Analytics fetch error:', analyticsError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Get detailed assignment data
    const { data: assignments, error: assignmentsError } = await supabase
      .from('campaign_recipient_variant_assignments')
      .select(`
        id,
        variant_id,
        recipient_id,
        assigned_at,
        sent_at,
        opened_at,
        clicked_at,
        replied_at,
        was_opened,
        was_clicked,
        was_replied,
        was_bounced,
        was_unsubscribed
      `)
      .eq('step_id', stepId)

    // Calculate additional metrics
    const variantStats = (analytics || []).map((variant: any) => {
      const variantAssignments = (assignments || []).filter(
        (a: any) => a.variant_id === variant.variant_id
      )

      return {
        ...variant,
        total_assigned: variantAssignments.length,
        total_sent: variantAssignments.filter((a: any) => a.sent_at).length,
        total_opened: variantAssignments.filter((a: any) => a.was_opened).length,
        total_clicked: variantAssignments.filter((a: any) => a.was_clicked).length,
        total_replied: variantAssignments.filter((a: any) => a.was_replied).length,
        total_bounced: variantAssignments.filter((a: any) => a.was_bounced).length,
        total_unsubscribed: variantAssignments.filter((a: any) => a.was_unsubscribed).length,
        // Calculate rates
        open_rate: variantAssignments.filter((a: any) => a.sent_at).length > 0
          ? (variantAssignments.filter((a: any) => a.was_opened).length /
             variantAssignments.filter((a: any) => a.sent_at).length) * 100
          : 0,
        click_rate: variantAssignments.filter((a: any) => a.sent_at).length > 0
          ? (variantAssignments.filter((a: any) => a.was_clicked).length /
             variantAssignments.filter((a: any) => a.sent_at).length) * 100
          : 0,
        reply_rate: variantAssignments.filter((a: any) => a.sent_at).length > 0
          ? (variantAssignments.filter((a: any) => a.was_replied).length /
             variantAssignments.filter((a: any) => a.sent_at).length) * 100
          : 0
      }
    })

    // Determine winner based on criteria
    let winner: any = null
    if (splitTest.winner_variant_id) {
      winner = variantStats.find((v: any) => v.variant_id === splitTest.winner_variant_id)
    } else if (splitTest.winner_selection_criteria && variantStats.length > 0) {
      // Auto-determine winner based on criteria
      const criteria = splitTest.winner_selection_criteria
      if (criteria === 'open_rate') {
        winner = variantStats.reduce((best: any, current: any) => 
          current.open_rate > best.open_rate ? current : best
        )
      } else if (criteria === 'click_rate') {
        winner = variantStats.reduce((best: any, current: any) => 
          current.click_rate > best.click_rate ? current : best
        )
      } else if (criteria === 'reply_rate') {
        winner = variantStats.reduce((best: any, current: any) => 
          current.reply_rate > best.reply_rate ? current : best
        )
      }
    }

    return NextResponse.json({
      splitTest,
      variants: variantStats,
      winner,
      total_recipients: (assignments || []).length,
      total_sent: (assignments || []).filter((a: any) => a.sent_at).length
    })
  } catch (error) {
    console.error('Split test analytics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

