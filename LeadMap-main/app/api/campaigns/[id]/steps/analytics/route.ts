import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Step Analytics API
 * GET: Get analytics aggregated per step
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

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

    // Get all steps for this campaign
    const { data: steps, error: stepsError } = await supabase
      .from('campaign_steps')
      .select('id, step_number, subject')
      .eq('campaign_id', campaignId)
      .order('step_number', { ascending: true })

    if (stepsError) {
      console.error('Steps fetch error:', stepsError)
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 })
    }

    if (!steps || steps.length === 0) {
      return NextResponse.json({ step_analytics: [] })
    }

    // Get emails for each step
    const stepIds = steps.map(s => s.id)
    let emailsQuery = supabase
      .from('emails')
      .select('id, campaign_step_id, to_email, sent_at, opened_at, clicked_at, status')
      .eq('campaign_id', campaignId)
      .in('campaign_step_id', stepIds)

    if (startDate) {
      emailsQuery = emailsQuery.gte('sent_at', startDate)
    }
    if (endDate) {
      emailsQuery = emailsQuery.lte('sent_at', endDate)
    }

    const { data: emails, error: emailsError } = await emailsQuery

    if (emailsError) {
      console.error('Emails fetch error:', emailsError)
      return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
    }

    // Aggregate metrics per step
    const stepAnalytics = steps.map((step: any) => {
      const stepEmails = emails?.filter((e: any) => e.campaign_step_id === step.id) || []
      const sent = stepEmails.filter((e: any) => e.status === 'sent' && e.sent_at).length
      const delivered = sent // Assuming sent means delivered
      const opened = stepEmails.filter((e: any) => e.opened_at).length
      const clicked = stepEmails.filter((e: any) => e.clicked_at).length

      return {
        step_id: step.id,
        step_number: step.step_number,
        subject: step.subject,
        metrics: {
          sent,
          delivered,
          opened,
          clicked,
          open_rate: delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : '0.00',
          click_rate: delivered > 0 ? ((clicked / delivered) * 100).toFixed(2) : '0.00'
        }
      }
    })

    return NextResponse.json({ step_analytics: stepAnalytics })
  } catch (error: any) {
    console.error('Step analytics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

