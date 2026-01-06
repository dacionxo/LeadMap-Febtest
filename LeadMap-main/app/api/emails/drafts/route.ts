/**
 * Email Drafts API
 * Handles saving and loading email drafts
 * Following Mautic patterns for draft management
 * 
 * GET /api/emails/drafts - List user's drafts
 * POST /api/emails/drafts - Save new draft
 * GET /api/emails/drafts/[id] - Get draft by ID
 * PUT /api/emails/drafts/[id] - Update draft
 * DELETE /api/emails/drafts/[id] - Delete draft
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * List user's email drafts
 * GET /api/emails/drafts
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
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: drafts, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching drafts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch drafts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ drafts: drafts || [] })
  } catch (error: any) {
    console.error('Error in GET /api/emails/drafts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Save new email draft
 * POST /api/emails/drafts
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
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

    if (!subject && !htmlContent) {
      return NextResponse.json(
        { error: 'Subject or HTML content is required' },
        { status: 400 }
      )
    }

    const { data: draft, error } = await supabase
      .from('email_drafts')
      .insert({
        user_id: user.id,
        subject: subject || '',
        html_content: htmlContent || '',
        to_emails: Array.isArray(to) ? to : (to ? [to] : []),
        mailbox_id: mailboxId || null,
        from_name: fromName || null,
        from_email: fromEmail || null,
        reply_to: replyTo || null,
        preview_text: previewText || null,
        editor_mode: editorMode || 'html',
        tracking_config: trackingConfig || {},
        schedule_config: scheduleConfig || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving draft:', error)
      return NextResponse.json(
        { error: 'Failed to save draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({ draft }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/emails/drafts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



