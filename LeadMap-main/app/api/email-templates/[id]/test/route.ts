import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { renderTemplate, renderSubject } from '@/lib/api'
import { sendEmail } from '@/lib/api'

/**
 * Test Email API
 * POST: Send a test email using a template
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { test_email, test_context, mailbox_id } = body

    if (!test_email) {
      return NextResponse.json({ error: 'Test email address is required' }, { status: 400 })
    }

    if (!mailbox_id) {
      return NextResponse.json({ error: 'Mailbox ID is required' }, { status: 400 })
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Use test_context if provided, otherwise use sample data
    const context = test_context || {
      address: '123 Sample Street',
      city: 'Sample City',
      state: 'CA',
      zip: '12345',
      owner_name: 'John Doe',
      price: 500000,
      price_drop_percent: 5,
      days_on_market: 30,
    }

    // Render template
    const renderedBody = renderTemplate(template.body, context as any)
    const renderedSubject = renderSubject(
      template.subject || template.title || 'Test Email',
      context as any
    )

    // Send test email
    try {
      const sendResult = await sendEmail({
        mailboxId: mailbox_id,
        to: test_email,
        subject: renderedSubject,
        html: renderedBody,
        type: 'campaign',
      })

      // Record test send
      const { error: testSendError } = await supabase
        .from('template_test_sends')
        .insert({
          template_id: id,
          version: template.version || 1,
          test_email,
          rendered_subject: renderedSubject,
          rendered_body: renderedBody,
          test_context: context,
          sent_by: user.id,
        })

      if (testSendError) {
        console.error('Failed to record test send:', testSendError)
      }

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        email: sendResult.email,
        rendered_subject: renderedSubject,
        rendered_body_preview: renderedBody.substring(0, 200) + '...',
      })
    } catch (sendError) {
      console.error('Send email error:', sendError)
      return NextResponse.json(
        {
          error: 'Failed to send test email',
          details: sendError instanceof Error ? sendError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

