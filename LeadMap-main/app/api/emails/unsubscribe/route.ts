import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Unsubscribe Email API
 * GET /api/emails/unsubscribe?token=xxx - Unsubscribe via token
 * POST /api/emails/unsubscribe - Unsubscribe via email
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token && !email) {
      return NextResponse.json({ error: 'Token or email is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // If token provided, find user_id from unsubscribe record
    if (token) {
      const { data: unsubscribe, error } = await supabase
        .from('email_unsubscribes')
        .select('user_id, email')
        .eq('unsubscribe_token', token)
        .single()

      if (error || !unsubscribe) {
        return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 404 })
      }

      // Create or update unsubscribe record
      await supabase
        .from('email_unsubscribes')
        .upsert({
          user_id: unsubscribe.user_id,
          email: unsubscribe.email.toLowerCase(),
          unsubscribed_at: new Date().toISOString(),
          source: 'link'
        }, {
          onConflict: 'user_id,email'
        })

      // Update campaign recipients if applicable
      await supabase
        .from('campaign_recipients')
        .update({
          unsubscribed: true,
          status: 'unsubscribed'
        })
        .eq('email', unsubscribe.email.toLowerCase())
        .eq('campaign_id', '(SELECT campaign_id FROM campaigns WHERE user_id = $1)', { params: [unsubscribe.user_id] })

      // Return HTML success page
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribed</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <h1>Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from all future emails.</p>
            <p>If you change your mind, you can contact us to resubscribe.</p>
          </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Email-only unsubscribe (less secure, but useful for manual requests)
    if (email) {
      // This would require user authentication or additional verification
      return NextResponse.json({ error: 'Email-only unsubscribe requires authentication. Please use the unsubscribe link from your email.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, userId, reason } = body

    if (!email || !userId) {
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create unsubscribe record
    const { error } = await supabase
      .from('email_unsubscribes')
      .upsert({
        user_id: userId,
        email: email.toLowerCase(),
        unsubscribed_at: new Date().toISOString(),
        reason,
        source: 'manual'
      }, {
        onConflict: 'user_id,email'
      })

    if (error) {
      console.error('Unsubscribe creation error:', error)
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
    }

    // Update campaign recipients
    await supabase
      .from('campaign_recipients')
      .update({
        unsubscribed: true,
        status: 'unsubscribed'
      })
      .eq('email', email.toLowerCase())

    return NextResponse.json({ success: true, message: 'Successfully unsubscribed' })
  } catch (error: any) {
    console.error('Unsubscribe POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

