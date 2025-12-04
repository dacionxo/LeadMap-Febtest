import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { detectAndLinkReply } from '@/lib/email/reply-detection'

/**
 * GET /api/emails/received
 * Get user's received emails for Unibox
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const mailboxId = searchParams.get('mailboxId') || null

    // Build query for received emails only
    let query = supabase
      .from('emails')
      .select(`
        *,
        mailboxes!inner(
          id,
          email,
          display_name,
          provider
        )
      `)
      .eq('user_id', user.id)
      .eq('direction', 'received')
      .order('received_at', { ascending: false, nullsLast: true })
      .range(offset, offset + limit - 1)

    // Filter by mailbox if specified
    if (mailboxId) {
      query = query.eq('mailbox_id', mailboxId)
    }

    const { data: emails, error } = await query

    if (error) {
      console.error('Error fetching received emails:', error)
      // If direction column doesn't exist yet, return empty array
      if (error.message?.includes('column') && error.message?.includes('direction')) {
        return NextResponse.json({ emails: [], count: 0 })
      }
      throw error
    }

    // Transform the data to match the Email interface
    const transformedEmails = (emails || []).map((email: any) => ({
      id: email.id,
      from_email: email.from_email || email.mailboxes?.email,
      from_name: email.from_name || email.mailboxes?.display_name,
      to_email: email.to_email,
      subject: email.subject || 'No Subject',
      html: email.html,
      body: email.body || email.html?.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
      status: 'received' as const,
      sent_at: null,
      received_at: email.received_at || email.created_at,
      opened_at: email.opened_at,
      clicked_at: email.clicked_at,
      error: email.error,
      thread_id: email.thread_id,
      is_read: email.is_read || false,
      is_starred: email.is_starred || false,
    }))

    return NextResponse.json({
      emails: transformedEmails,
      count: transformedEmails.length
    })
  } catch (error: any) {
    console.error('Error in GET /api/emails/received:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/emails/received
 * Log a received email (typically called by webhook or email sync service)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      mailbox_id,
      from_email,
      from_name,
      to_email,
      subject,
      html,
      body: textBody,
      received_at,
      raw_message_id,
      thread_id,
      in_reply_to,
    } = body

    // Validate required fields
    if (!mailbox_id || !from_email || !to_email || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: mailbox_id, from_email, to_email, subject' },
        { status: 400 }
      )
    }

    // Verify mailbox belongs to user
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('id', mailbox_id)
      .eq('user_id', user.id)
      .single()

    if (mailboxError || !mailbox) {
      return NextResponse.json(
        { error: 'Mailbox not found or access denied' },
        { status: 404 }
      )
    }

    // Insert received email
    const { data: email, error: insertError } = await supabase
      .from('emails')
      .insert([{
        user_id: user.id,
        mailbox_id,
        from_email,
        from_name: from_name || null,
        to_email,
        subject,
        html: html || textBody || '',
        direction: 'received',
        status: 'sent', // Received emails are considered 'sent' by the sender
        received_at: received_at ? new Date(received_at).toISOString() : new Date().toISOString(),
        raw_message_id: raw_message_id || null,
        thread_id: thread_id || null,
        in_reply_to: in_reply_to || null,
        is_read: false,
        is_starred: false,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting received email:', insertError)
      throw insertError
    }

    // Detect if this is a reply to a campaign email
    try {
      const replyDetection = await detectAndLinkReply(supabase, {
        fromEmail,
        toEmail,
        subject,
        inReplyTo: in_reply_to || undefined,
        references: undefined, // Could extract from email headers if needed
        messageId: raw_message_id || undefined,
        threadId: thread_id || undefined
      })

      if (replyDetection.isReply) {
        console.log('Reply detected for campaign:', {
          emailId: email.id,
          originalEmailId: replyDetection.sentEmailId,
          campaignRecipientId: replyDetection.campaignRecipientId
        })
      }
    } catch (replyError) {
      // Don't fail the email insertion if reply detection fails
      console.error('Error detecting reply:', replyError)
    }

    return NextResponse.json({ email }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/emails/received:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

