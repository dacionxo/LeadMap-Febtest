import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UserLeaderboardData {
  userId: string
  userName: string
  userEmail: string
  totalDeals: number
  dealsClosed: number
  dealsWon: number
  totalWeightedForecastedRevenue: number
  winRate: number
  avgSalesCycleDays: number
  totalAmountWon: number
}

/**
 * GET /api/crm/deals/analytics/leaderboard
 * Returns leaderboard data grouped by user/rep
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

    // Fetch all deals for the user
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (dealsError) {
      console.error('Error fetching deals:', dealsError)
      return NextResponse.json(
        { error: 'Failed to fetch deals' },
        { status: 500 }
      )
    }

    const allDeals = deals || []

    // Group deals by user_id (for multi-user setups, this would group by rep/owner)
    const userMap = new Map<string, UserLeaderboardData>()

    // Get user info
    const { data: userData } = await supabaseAuth.auth.getUser()
    const userName = userData?.user?.user_metadata?.name || 
                     userData?.user?.email?.split('@')[0] || 
                     'User'
    const userEmail = userData?.user?.email || ''

    // Process deals for current user
    const userDeals = allDeals.filter(d => d.user_id === user.id)
    
    const closedDeals = userDeals.filter(d => 
      d.stage === 'closed_won' || d.stage === 'closed_lost'
    )
    const wonDeals = userDeals.filter(d => d.stage === 'closed_won')
    
    // Calculate weighted forecasted revenue (for open deals)
    const weightedForecastedRevenue = userDeals
      .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
      .reduce((sum, deal) => {
        const value = parseFloat(deal.value?.toString() || '0') || 0
        const probability = deal.probability || 0
        return sum + (value * probability / 100)
      }, 0)

    // Calculate win rate
    const winRate = closedDeals.length > 0 
      ? (wonDeals.length / closedDeals.length) * 100 
      : 0

    // Calculate average sales cycle (days from created_at to closed_date)
    const wonDealsWithDates = wonDeals.filter(d => d.closed_date)
    const avgSalesCycle = wonDealsWithDates.length > 0
      ? wonDealsWithDates.reduce((sum, deal) => {
          const created = new Date(deal.created_at)
          const closed = new Date(deal.closed_date!)
          const days = Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / wonDealsWithDates.length
      : 0

    // Total amount won
    const totalAmountWon = wonDeals.reduce((sum, deal) => {
      const value = parseFloat(deal.value?.toString() || '0') || 0
      return sum + value
    }, 0)

    userMap.set(user.id, {
      userId: user.id,
      userName,
      userEmail,
      totalDeals: userDeals.length,
      dealsClosed: closedDeals.length,
      dealsWon: wonDeals.length,
      totalWeightedForecastedRevenue: weightedForecastedRevenue,
      winRate,
      avgSalesCycleDays: Math.round(avgSalesCycle * 100) / 100,
      totalAmountWon,
    })

    // Convert to array and sort by total deals (descending)
    const leaderboard = Array.from(userMap.values())
      .sort((a, b) => b.totalDeals - a.totalDeals)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }))

    return NextResponse.json({
      leaderboard,
      activityByRep: leaderboard.map(item => ({
        userId: item.userId,
        userName: item.userName,
        activitiesCount: item.totalDeals,
        lastActivityDate: new Date().toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('API Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


