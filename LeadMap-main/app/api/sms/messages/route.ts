// app/api/sms/messages/route.ts
/**
 * SMS Messages API
 * GET: List messages for a conversation
 * POST: Send a new SMS message
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { 
  getOrCreateConversationForLead, 
  sendConversationMessage 
} from '@/lib/twilio'
import { renderTemplate } from '@/lib/api'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from('sms_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Messages fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark conversation as read
    await supabase
      .from('sms_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)

    return NextResponse.json({ messages: messages || [] })
  } catch (error: any) {
    console.error('Messages GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { conversationId, listingId, leadPhone, text, templateBody, mediaUrls = [] } = body

    if (!conversationId && !listingId) {
      return NextResponse.json(
        { error: 'Either conversationId or listingId required' }, 
        { status: 400 }
      )
    }

    if (!text && !templateBody) {
      return NextResponse.json(
        { error: 'Either text or templateBody required' }, 
        { status: 400 }
      )
    }

    let convoRow

    // Get or create conversation
    if (conversationId) {
      const { data: existing } = await supabase
        .from('sms_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      convoRow = existing
    } else {
      // Create new conversation
      if (!leadPhone) {
        return NextResponse.json({ error: 'leadPhone required for new conversation' }, { status: 400 })
      }

      convoRow = await getOrCreateConversationForLead({
        leadId: listingId,
        userId: user.id,
        leadPhone
      })
    }

    // Render template if provided, otherwise use text
    let finalText = text?.trim()
    if (!finalText && templateBody) {
      // Fetch listing data for personalization
      const listingIdToUse = listingId || convoRow.listing_id
      if (listingIdToUse) {
        const { data: listing } = await supabase
          .from('listings')
          .select('*')
          .eq('id', listingIdToUse)
          .maybeSingle()
        
        finalText = renderTemplate(templateBody, listing || {})
      } else {
        finalText = renderTemplate(templateBody, {})
      }
    }

    if (!finalText) {
      return NextResponse.json({ error: 'Message text required' }, { status: 400 })
    }

    // Send message
    const msgRow = await sendConversationMessage({
      conversationSid: convoRow.twilio_conversation_sid,
      conversationId: convoRow.id,
      userId: user.id,
      body: finalText,
      mediaUrls
    })

    return NextResponse.json({ 
      message: msgRow,
      conversation: convoRow
    })
  } catch (error: any) {
    console.error('Messages POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' }, 
      { status: 500 }
    )
  }
}

