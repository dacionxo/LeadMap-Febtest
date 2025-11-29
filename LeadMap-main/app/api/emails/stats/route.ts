import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Email Statistics API
 * GET: Get email statistics for a mailbox or all mailboxes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mailboxId = searchParams.get('mailboxId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)

    if (mailboxId && mailboxId !== 'all') {
      query = query.eq('mailbox_id', mailboxId)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: emails, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch email statistics' }, { status: 500 })
    }

    // Calculate statistics
    const sentEmails = emails?.filter((e: any) => e.status === 'sent') || []
    const delivered = sentEmails.length
    const opened = sentEmails.filter((e: any) => e.opened_at).length
    const clicked = sentEmails.filter((e: any) => e.clicked_at).length
    const failed = emails?.filter((e: any) => e.status === 'failed').length || 0

    // For now, we don't track orders, bounces, unsubscribes, or spam complaints
    // These would need to be added to the emails table or tracked separately
    const stats = {
      delivered,
      opened,
      clicked,
      ordered: 0, // TODO: Track orders
      bounced: 0, // TODO: Track bounces
      unsubscribed: 0, // TODO: Track unsubscribes
      spamComplaints: 0, // TODO: Track spam complaints
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Email stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

