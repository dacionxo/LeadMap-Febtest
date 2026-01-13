/**
 * Email Draft API (Single Draft)
 * GET, PUT, DELETE operations for individual drafts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Get draft by ID
 * GET /api/emails/drafts/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data: draft, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ draft })
  } catch (error: any) {
    console.error('Error in GET /api/emails/drafts/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Update draft
 * PUT /api/emails/drafts/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify draft belongs to user
    const { data: existingDraft, error: checkError } = await supabase
      .from('email_drafts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existingDraft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    const {
      subject,
      htmlContent,
      to,
      mailboxId,
      fromName,
      fromEmail,
      replyTo,
      previewText,
      editorMode,
      trackingConfig,
      scheduleConfig,
    } = body

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (subject !== undefined) updateData.subject = subject
    if (htmlContent !== undefined) updateData.html_content = htmlContent
    if (to !== undefined) updateData.to_emails = Array.isArray(to) ? to : (to ? [to] : [])
    if (mailboxId !== undefined) updateData.mailbox_id = mailboxId
    if (fromName !== undefined) updateData.from_name = fromName
    if (fromEmail !== undefined) updateData.from_email = fromEmail
    if (replyTo !== undefined) updateData.reply_to = replyTo
    if (previewText !== undefined) updateData.preview_text = previewText
    if (editorMode !== undefined) updateData.editor_mode = editorMode
    if (trackingConfig !== undefined) updateData.tracking_config = trackingConfig
    if (scheduleConfig !== undefined) updateData.schedule_config = scheduleConfig

    const { data: draft, error } = await supabase
      .from('email_drafts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating draft:', error)
      return NextResponse.json(
        { error: 'Failed to update draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({ draft })
  } catch (error: any) {
    console.error('Error in PUT /api/emails/drafts/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Delete draft
 * DELETE /api/emails/drafts/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify draft belongs to user
    const { error: deleteError } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting draft:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/emails/drafts/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}









