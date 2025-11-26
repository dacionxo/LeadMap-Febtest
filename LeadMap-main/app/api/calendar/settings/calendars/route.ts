import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/settings/calendars
 * Get all calendars with their settings
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role for queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get calendars with their settings
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)

    if (connectionsError) throw connectionsError

    // Get settings for each calendar
    const calendarsWithSettings = await Promise.all(
      (connections || []).map(async (connection) => {
        const { data: settings } = await supabase
          .from('calendar_settings')
          .select('*')
          .eq('user_id', user.id)
          .eq('calendar_id', connection.id)
          .single()

        return {
          connection,
          settings: settings || null,
        }
      })
    )

    return NextResponse.json({ calendars: calendarsWithSettings })
  } catch (error: any) {
    console.error('Error in GET /api/calendar/settings/calendars:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

