import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Email Open Tracking
 * GET /api/email/track/open?email_id=...&recipient_id=...
 * Tracks email opens via 1x1 pixel image
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('email_id')
    const recipientId = searchParams.get('recipient_id')
    const campaignId = searchParams.get('campaign_id')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      // Record open event
      if (emailId || recipientId) {
        await supabase
          .from('email_opens')
          .insert({
            email_id: emailId || null,
            campaign_recipient_id: recipientId || null,
            campaign_id: campaignId || null,
            opened_at: new Date().toISOString(),
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            user_agent: request.headers.get('user-agent') || null
          })
          .catch(err => {
            // Log but don't fail if table doesn't exist yet
            console.warn('Failed to log open:', err)
          })

        // Update email/campaign recipient if applicable
        if (emailId) {
          await supabase
            .from('emails')
            .update({ opened_at: new Date().toISOString() })
            .eq('id', emailId)
            .catch(() => {}) // Ignore errors
        }

        if (recipientId) {
          await supabase
            .from('campaign_recipients')
            .update({ opened: true, opened_at: new Date().toISOString() })
            .eq('id', recipientId)
            .catch(() => {}) // Ignore errors
        }
      }
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    console.error('Open tracking error:', error)
    // Return pixel even on error
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )
    return new NextResponse(pixel, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' }
    })
  }
}

