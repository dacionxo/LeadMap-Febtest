import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import { createClient } from '@supabase/supabase-js'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

/**
 * Send Email API
 * POST /api/emails/send
 * For sending a single email from composer (outside of campaigns)
 */

export async function POST(request: NextRequest) {
  try {
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:13',message:'POST handler entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:18',message:'auth check',data:{hasUser:!!user,hasAuthError:!!authError,authError:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      mailboxId,
      to,
      subject,
      html,
      scheduleAt
    } = body

    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:32',message:'request body parsed',data:{mailboxId:!!mailboxId,to:!!to,subject:!!subject,html:!!html,scheduleAt:!!scheduleAt},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!mailboxId || !to || !subject || !html) {
      return NextResponse.json({
        error: 'Mailbox ID, recipient email, subject, and HTML content are required'
      }, { status: 400 })
    }

    // Get mailbox (we need service role to read tokens)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: mailbox, error: mailboxError } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .eq('id', mailboxId)
      .eq('user_id', user.id)
      .single()

    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:60',message:'mailbox fetch result',data:{hasMailbox:!!mailbox,hasError:!!mailboxError,error:mailboxError?.message,active:mailbox?.active,provider:mailbox?.provider},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'})}).catch(()=>{});
    // #endregion
    if (mailboxError || !mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
    }

    if (!mailbox.active) {
      return NextResponse.json({ error: 'Mailbox is not active' }, { status: 400 })
    }

    // Check if scheduling
    const scheduleDate = scheduleAt ? new Date(scheduleAt) : null
    const now = new Date()

    if (scheduleDate && scheduleDate > now) {
      // Schedule for later - create email record with queued status
      const { data: emailRecord, error: emailError } = await supabase
        .from('emails')
        .insert({
          user_id: user.id,
          mailbox_id: mailboxId,
          to_email: to,
          subject,
          html,
          status: 'queued',
          scheduled_at: scheduleAt,
          direction: 'sent' // Explicitly mark as sent email
        })
        .select()
        .single()

      if (emailError) {
        console.error('Email scheduling error:', emailError)
        return NextResponse.json({ error: 'Failed to schedule email' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        email: emailRecord,
        message: 'Email scheduled successfully'
      })
    }

    // Send immediately - check rate limits first
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Count emails sent in last hour and day
    const { data: recentEmails } = await supabase
      .from('emails')
      .select('sent_at')
      .eq('mailbox_id', mailboxId)
      .eq('status', 'sent')
      .not('sent_at', 'is', null)

    interface EmailWithSentAt {
      sent_at: string | null
    }

    const hourlyCount = recentEmails?.filter((e: EmailWithSentAt) => 
      e.sent_at && new Date(e.sent_at) >= oneHourAgo
    ).length || 0

    const dailyCount = recentEmails?.filter((e: EmailWithSentAt) => 
      e.sent_at && new Date(e.sent_at) >= oneDayAgo
    ).length || 0

    const limitCheck = await checkMailboxLimits(mailbox, {
      hourly: hourlyCount,
      daily: dailyCount
    }, supabaseAdmin)

    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: limitCheck.reason || 'Rate limit exceeded',
        remainingHourly: limitCheck.remainingHourly,
        remainingDaily: limitCheck.remainingDaily
      }, { status: 429 })
    }

    // Create email record with sending status
    const { data: emailRecord, error: emailCreateError } = await supabase
      .from('emails')
      .insert({
        user_id: user.id,
        mailbox_id: mailboxId,
        to_email: to,
        subject,
        html,
        status: 'sending',
        scheduled_at: null,
        direction: 'sent' // Explicitly mark as sent email
      })
      .select()
      .single()

    if (emailCreateError || !emailRecord) {
      console.error('Email record creation error:', emailCreateError)
      return NextResponse.json({ error: 'Failed to create email record' }, { status: 500 })
    }

    // Send email (pass supabaseAdmin for transactional providers)
    const fromName = mailbox.from_name || mailbox.display_name
    const fromEmail = mailbox.from_email || mailbox.email

    let sendResult
    try {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:164',message:'calling sendViaMailbox',data:{provider:mailbox.provider,to,hasSubject:!!subject},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      sendResult = await sendViaMailbox(mailbox, {
        to,
        subject,
        html,
        fromName,
        fromEmail
      }, supabaseAdmin)
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:174',message:'sendViaMailbox result',data:{success:sendResult.success,error:sendResult.error,hasMessageId:!!sendResult.providerMessageId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      console.error('Error sending email via mailbox:', error)
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/emails/send/route.ts:177',message:'sendViaMailbox exception',data:{error:error?.message,errorType:error?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ 
        error: error.message || 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500 })
    }

    // Update email record with result
    if (sendResult.success) {
      await supabase
        .from('emails')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: sendResult.providerMessageId
        })
        .eq('id', emailRecord.id)
    } else {
      await supabase
        .from('emails')
        .update({
          status: 'failed',
          error: sendResult.error
        })
        .eq('id', emailRecord.id)

      // Update mailbox last_error
      await supabaseAdmin
        .from('mailboxes')
        .update({
          last_error: sendResult.error
        })
        .eq('id', mailboxId)

      return NextResponse.json({
        success: false,
        error: sendResult.error || 'Failed to send email',
        email: {
          ...emailRecord,
          status: 'failed',
          error: sendResult.error
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email: {
        ...emailRecord,
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: sendResult.providerMessageId
      },
      message: 'Email sent successfully'
    })
  } catch (error: any) {
    console.error('Email send error:', error)
    // Always return JSON, never HTML - this prevents the "<!DOCTYPE" error
    return NextResponse.json({
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
