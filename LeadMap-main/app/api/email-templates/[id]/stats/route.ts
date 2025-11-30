import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Template Stats API
 * GET: Get performance statistics for a template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get stats for all versions or specific version
    const { searchParams } = new URL(request.url)
    const version = searchParams.get('version')

    let query = supabase
      .from('template_stats')
      .select('*')
      .eq('template_id', id)

    if (version) {
      query = query.eq('version', parseInt(version))
    }

    const { data, error } = await query.order('version', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // If no stats exist, return empty stats
    if (!data || data.length === 0) {
      return NextResponse.json({
        stats: [{
          template_id: id,
          version: version ? parseInt(version) : 1,
          total_sent: 0,
          total_opened: 0,
          total_clicked: 0,
          total_replied: 0,
          total_bounced: 0,
          total_unsubscribed: 0,
          open_rate: 0,
          click_rate: 0,
          reply_rate: 0,
          bounce_rate: 0,
        }],
      })
    }

    return NextResponse.json({ stats: data })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

