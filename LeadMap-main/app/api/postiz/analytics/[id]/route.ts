/**
 * Analytics API Endpoint
 * 
 * Returns analytics data for a specific social account in the format
 * expected by Postiz's RenderAnalytics component.
 * 
 * Phase 6: Analytics & Insights - API Endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAccountAnalytics } from '@/lib/postiz/analytics/rollups'

/**
 * GET /api/postiz/analytics/[id]?date=7|30|90
 * 
 * Returns analytics metrics for a social account over the specified date range.
 * Format matches Postiz's expected structure:
 * [
 *   {
 *     label: "Impressions",
 *     data: [{ total: 100, date: "2024-01-01" }, ...],
 *     average: false
 *   },
 *   ...
 * ]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: socialAccountId } = await params
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get date parameter (7, 30, or 90 days)
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const days = dateParam ? parseInt(dateParam, 10) : 7

    // Validate days parameter
    if (![7, 30, 90].includes(days)) {
      return NextResponse.json(
        { error: 'Invalid date parameter. Must be 7, 30, or 90' },
        { status: 400 }
      )
    }

    // Verify user has access to this social account
    const { data: socialAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('id, workspace_id')
      .eq('id', socialAccountId)
      .single()

    if (accountError || !socialAccount) {
      return NextResponse.json(
        { error: 'Social account not found' },
        { status: 404 }
      )
    }

    // Verify user is a member of the workspace
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', socialAccount.workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to this workspace' },
        { status: 403 }
      )
    }

    // Get analytics data
    const analytics = await getAccountAnalytics(socialAccountId, days)

    // Return empty array if no analytics data (matches Postiz behavior)
    if (!analytics || analytics.length === 0) {
      return NextResponse.json([])
    }

    // Transform to match Postiz format exactly
    const formattedAnalytics = analytics.map((metric) => ({
      label: metric.label,
      data: metric.data.map((point) => ({
        total: point.total,
        date: point.date,
      })),
      average: metric.average || false,
    }))

    return NextResponse.json(formattedAnalytics)
  } catch (error: any) {
    console.error('[GET /api/postiz/analytics/[id]] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
