import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { sendViaMailbox } from '@/lib/email/sendViaMailbox'

export const runtime = 'nodejs'

/**
 * POST /api/unibox/threads/[id]/reply
 * Reply to a thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get thread
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .select(`
        *,
        mailboxes!inner(*),
        email_messages(
          id,
          direction,
          subject,
          in_reply_to,
          references,
          email_participants(type, email, name)
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const {
      mailboxId,
      bodyHtml,
      bodyText,
      replyAll = false,
      cc = [],
      bcc = []
    } = body

    if (!mailboxId || (!bodyHtml && !bodyText)) {
      return NextResponse.json(
        { error: 'Mailbox ID and email body are required' },
        { status: 400 }
      )
    }

    // Find mailbox
    const mailbox = (thread.mailboxes as any[]).find((m: any) => m.id === mailboxId)
    if (!mailbox) {
      return NextResponse.json({ error: 'Mailbox not found in thread' }, { status: 404 })
    }

    // Get last inbound message to determine reply recipients
    const messages = (thread.email_messages || []) as any[]
    const lastInboundMessage = messages
      .filter((m: any) => m.direction === 'inbound')
      .sort((a: any, b: any) => {
        const dateA = new Date(a.received_at || 0).getTime()
        const dateB = new Date(b.received_at || 0).getTime()
        return dateB - dateA
      })[0]

    if (!lastInboundMessage) {
      return NextResponse.json({ error: 'No inbound message found to reply to' }, { status: 400 })
    }

    // Build recipients
    const participants = lastInboundMessage.email_participants || []
    const fromParticipant = participants.find((p: any) => p.type === 'from')
    const toParticipants = participants.filter((p: any) => p.type === 'to')
    const ccParticipants = participants.filter((p: any) => p.type === 'cc')

    let to: string[] = []
    let replyCc: string[] = []

    if (replyAll && fromParticipant) {
      // Reply all: reply to sender, include original recipients
      to = [fromParticipant.email]
      replyCc = [
        ...toParticipants.map((p: any) => p.email),
        ...ccParticipants.map((p: any) => p.email)
      ].filter((email: string) => email !== mailbox.email)
    } else {
      // Reply: just to sender
      to = fromParticipant ? [fromParticipant.email] : []
    }

    // Merge with provided cc/bcc
    const finalCc = Array.from(new Set([...replyCc, ...cc]))
    const finalBcc = bcc

    // Build subject (add Re: if not already present)
    let subject = thread.subject || lastInboundMessage.subject || '(No Subject)'
    if (!subject.toLowerCase().startsWith('re:')) {
      subject = `Re: ${subject}`
    }

    // Build reply body with quoted original
    const quotedHtml = lastInboundMessage.body_html
      ? `<blockquote style="border-left: 3px solid #ccc; margin: 0; padding-left: 1em; color: #666;">${lastInboundMessage.body_html}</blockquote>`
      : ''
    
    const finalBodyHtml = bodyHtml 
      ? `${bodyHtml}<br><br>${quotedHtml}`
      : `${bodyText?.replace(/\n/g, '<br>') || ''}<br><br>${quotedHtml}`

    // Send email via mailbox
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const fullMailbox = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('id', mailboxId)
      .eq('user_id', user.id)
      .single()

    if (!fullMailbox.data) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
    }

    // Build email payload with reply headers
    const sendResult = await sendViaMailbox(fullMailbox.data, {
      to: to.join(', '),
      cc: finalCc.length > 0 ? finalCc.join(', ') : undefined,
      bcc: finalBcc.length > 0 ? finalBcc.join(', ') : undefined,
      subject,
      html: finalBodyHtml,
      fromName: fullMailbox.data.from_name || fullMailbox.data.display_name,
      fromEmail: fullMailbox.data.from_email || fullMailbox.data.email,
      inReplyTo: lastInboundMessage.in_reply_to || lastInboundMessage.raw_headers?.find((h: any) => h.name === 'Message-ID')?.value || undefined,
      references: lastInboundMessage.references || lastInboundMessage.raw_headers?.find((h: any) => h.name === 'References')?.value || undefined
    })

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send reply' },
        { status: 500 }
      )
    }

    // Log outbound message to thread
    // CRITICAL: Use service role client to bypass RLS (same pattern as receiving route)
    // This ensures inserts work even if RLS policies aren't fully configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Reply] Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    
    const { data: outboundMessage, error: messageError } = await supabaseAdmin
      .from('email_messages')
      .insert({
        thread_id: id,
        user_id: user.id,
        mailbox_id: mailboxId,
        direction: 'outbound',
        provider_message_id: sendResult.providerMessageId || `temp-${Date.now()}`,
        subject,
        snippet: bodyText?.substring(0, 200) || bodyHtml?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
        body_html: finalBodyHtml,
        body_plain: bodyText || bodyHtml?.replace(/<[^>]*>/g, '') || '',
        in_reply_to: lastInboundMessage.in_reply_to,
        references: lastInboundMessage.references ? `${lastInboundMessage.references} ${lastInboundMessage.in_reply_to}`.trim() : lastInboundMessage.in_reply_to || '',
        sent_at: new Date().toISOString(),
        read: true
      })
      .select()
      .maybeSingle()
    
    if (messageError || !outboundMessage) {
      // CRITICAL: Log detailed error information
      const errorDetails = messageError?.details || messageError?.hint || messageError?.message || 'Unknown error'
      const errorCode = (messageError as any)?.code || 'UNKNOWN'
      
      console.error(`[Reply] Failed to insert outbound message:`, {
        error: messageError,
        errorCode,
        errorDetails,
        threadId: id,
        userId: user.id,
        mailboxId,
        possibleCauses: [
          errorCode === '42501' ? 'RLS policy violation - check if service_role is allowed' : null,
          errorCode === '23505' ? 'Duplicate message (unique constraint violation)' : null,
          errorCode === '23503' ? 'Foreign key violation - thread_id or mailbox_id invalid' : null,
          'Check SUPABASE_SERVICE_ROLE_KEY is set correctly',
          'Verify RLS policies allow service_role access',
          'Run supabase/unibox_rls_service_role_fix.sql migration'
        ].filter(Boolean)
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to save message to database',
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        },
        { status: 500 }
      )
    }

    // Insert participants for outbound message
    if (outboundMessage) {
      const allParticipants = [
        { type: 'from', email: fullMailbox.data.email, name: fullMailbox.data.display_name },
        ...to.map((email: string) => ({ type: 'to' as const, email, name: '' })),
        ...finalCc.map((email: string) => ({ type: 'cc' as const, email, name: '' })),
        ...finalBcc.map((email: string) => ({ type: 'bcc' as const, email, name: '' }))
      ]

      for (const participant of allParticipants) {
        const { error: participantError } = await supabaseAdmin
          .from('email_participants')
          .insert({
            message_id: outboundMessage.id,
            type: participant.type,
            email: participant.email,
            name: participant.name || null
          })
        
        if (participantError) {
          console.error(`[Reply] Failed to insert participant ${participant.email}:`, participantError)
          // Continue - don't fail the whole request if participant insert fails
        }
      }
    }

    // Update thread status (use service role client)
    const { error: threadUpdateError } = await supabaseAdmin
      .from('email_threads')
      .update({
        status: 'open',
        unread: false
      })
      .eq('id', id)
    
    if (threadUpdateError) {
      console.error(`[Reply] Failed to update thread status:`, threadUpdateError)
      // Continue - don't fail the whole request if thread update fails
    }

    return NextResponse.json({
      success: true,
      message: outboundMessage,
      providerMessageId: sendResult.providerMessageId
    })

  } catch (error: any) {
    console.error('Error in POST /api/unibox/threads/[id]/reply:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

