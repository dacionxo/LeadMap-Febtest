import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Email Click Tracking
 * GET /api/email/track/click?url=...&email_id=...&recipient_id=...
 * Tracks email link clicks and redirects to original URL
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const emailId = searchParams.get('email_id')
    const recipientId = searchParams.get('recipient_id')
    const campaignId = searchParams.get('campaign_id')

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      // If no database, just redirect
      return NextResponse.redirect(url)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Record click event
    if (emailId || recipientId) {
      await supabase
        .from('email_clicks')
        .insert({
          email_id: emailId || null,
          campaign_recipient_id: recipientId || null,
          campaign_id: campaignId || null,
          clicked_url: url,
          clicked_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          user_agent: request.headers.get('user-agent') || null
        })
        .catch(err => {
          // Log but don't fail if table doesn't exist yet
          console.warn('Failed to log click:', err)
        })

      // Update email/campaign recipient if applicable
      if (emailId) {
        await supabase
          .from('emails')
          .update({ clicked_at: new Date().toISOString() })
          .eq('id', emailId)
          .catch(() => {}) // Ignore errors
      }

      if (recipientId) {
        await supabase
          .from('campaign_recipients')
          .update({ clicked: true, clicked_at: new Date().toISOString() })
          .eq('id', recipientId)
          .catch(() => {}) // Ignore errors
      }
    }

    // Redirect to original URL
    return NextResponse.redirect(url)
  } catch (error: any) {
    console.error('Click tracking error:', error)
    // Even on error, try to redirect
    const url = new URL(request.url).searchParams.get('url')
    if (url) {
      return NextResponse.redirect(url)
    }
    return NextResponse.json({ error: 'Tracking error' }, { status: 500 })
  }
}

