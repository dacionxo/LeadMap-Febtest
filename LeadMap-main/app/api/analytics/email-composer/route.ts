/**
 * Email Composer Analytics API
 * Handles analytics event tracking for email composer
 * Following Mautic patterns for analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Track email composer analytics event
 * POST /api/analytics/email-composer
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore errors in server components
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, timestamp, properties, sessionId } = body

    if (!type || !timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields: type, timestamp' },
        { status: 400 }
      )
    }

    // Store analytics event in database (if analytics table exists)
    // For now, we'll just log it and return success
    // In production, you'd want to store this in a dedicated analytics table

    console.log('Analytics event:', {
      type,
      timestamp,
      userId: user.id,
      sessionId,
      properties,
    })

    // TODO: Store in analytics table when available
    // await supabase.from('email_composer_analytics').insert({
    //   user_id: user.id,
    //   event_type: type,
    //   timestamp: new Date(timestamp),
    //   session_id: sessionId,
    //   properties: properties || {},
    // })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error tracking analytics event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

