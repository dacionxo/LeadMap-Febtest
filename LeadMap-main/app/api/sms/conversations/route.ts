// app/api/sms/conversations/route.ts
/**
 * SMS Conversations API
 * GET: List conversations for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const unread = searchParams.get('unread') === 'true'
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('sms_conversations')
      .select(`
        *,
        listings:listings(
          id,
          address,
          city,
          state,
          owner_name
        )
      `)
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    // Apply filters
    if (unread) {
      query = query.gt('unread_count', 0)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`lead_phone.ilike.%${search}%,metadata->>search.ilike.%${search}%`)
    }

    const { data: conversations, error } = await query

    if (error) {
      console.error('Conversations fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Get message counts and last message for each conversation
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (convo) => {
        // Get message count
        const { count: messageCount } = await supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convo.id)

        // Get last message
        const { data: lastMessage } = await supabase
          .from('sms_messages')
          .select('body, direction, created_at')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...convo,
          message_count: messageCount || 0,
          last_message: lastMessage || null
        }
      })
    )

    return NextResponse.json({ conversations: conversationsWithDetails })
  } catch (error: any) {
    console.error('Conversations GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
