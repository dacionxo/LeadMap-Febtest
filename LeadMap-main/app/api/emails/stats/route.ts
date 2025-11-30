import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Email Statistics API
 * GET: Get email statistics for a mailbox or all mailboxes
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
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

    // Calculate statistics - only for sent emails
    const sentEmails = emails?.filter((e: any) => 
      e.direction === 'sent' && e.status === 'sent'
    ) || []
    const delivered = sentEmails.length
    const failed = emails?.filter((e: any) => 
      e.direction === 'sent' && e.status === 'failed'
    ).length || 0
    
    // Note: opened_at and clicked_at tracking is not yet implemented
    // These fields exist in the schema but are not populated by email sending
    // Until tracking pixels/links are implemented, these will always be 0
    const opened = 0 // sentEmails.filter((e: any) => e.opened_at).length
    const clicked = 0 // sentEmails.filter((e: any) => e.clicked_at).length

    // For now, we don't track orders, bounces, unsubscribes, or spam complaints
    // These would need to be added to the emails table or tracked separately
    const stats = {
      delivered,
      opened,
      clicked,
      ordered: 0, // TODO: Track orders
      bounced: failed, // Use failed emails as bounce indicator for now
      unsubscribed: 0, // TODO: Track unsubscribes
      spamComplaints: 0, // TODO: Track spam complaints
      openRate: 0, // Will be 0 until open tracking is implemented
      clickRate: 0, // Will be 0 until click tracking is implemented
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Email stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

