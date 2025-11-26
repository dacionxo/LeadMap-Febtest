import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/leads/:leadId/lists
 * 
 * Gets all lists that a specific lead/item belongs to
 * 
 * Query params:
 * - itemType: 'listing' | 'contact' | 'company' (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params
    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get('itemType') as 'listing' | 'contact' | 'company' | null

    if (!itemType || !['listing', 'contact', 'company'].includes(itemType)) {
      return NextResponse.json(
        { error: 'itemType query parameter is required and must be "listing", "contact", or "company"' },
        { status: 400 }
      )
    }

    // Authenticate user - await cookies first, then pass sync function
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

    // Get all memberships for this item
    const { data: memberships, error: membershipsError } = await supabase
      .from('list_memberships')
      .select('list_id')
      .eq('item_id', leadId)
      .eq('item_type', itemType)

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError)
      return NextResponse.json(
        { error: 'Failed to fetch list memberships' },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ lists: [] })
    }

    // Get list details for these memberships (only user's lists)
    const listIds = memberships.map(m => m.list_id)
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('id, name, type, created_at, updated_at')
      .in('id', listIds)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (listsError) {
      console.error('Error fetching lists:', listsError)
      return NextResponse.json(
        { error: 'Failed to fetch lists' },
        { status: 500 }
      )
    }

    return NextResponse.json({ lists: lists || [] })
  } catch (error: any) {
    console.error('API Error fetching lead lists:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

