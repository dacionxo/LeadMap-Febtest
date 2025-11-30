/**
 * ClickSend Webhook Handler
 * Processes inbound SMS messages and delivery status updates from ClickSend
 */

import { NextRequest, NextResponse } from 'next/server'
import { processInboundMessage, updateMessageStatus } from '@/lib/clicksend'

export async function POST(req: NextRequest) {
  try {
    // ClickSend webhooks can be JSON or form-encoded
    let body: any
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      // Handle form-encoded data
      const formData = await req.formData()
      body = Object.fromEntries(formData.entries())
    }

    // ClickSend webhook format varies, but typically includes:
    // - For inbound: from, to, body, message_id, timestamp
    // - For delivery: message_id, status, error_code, error_message

    // Determine webhook type
    const webhookType = body.type || body.event_type || (body.from ? 'inbound' : 'delivery')

    if (webhookType === 'inbound' || body.from) {
      // Inbound SMS message
      const from = body.from || body.sender || body.phone_number
      const to = body.to || body.destination || body.number
      const messageBody = body.body || body.message || body.text
      const messageId = body.message_id || body.messageId || body.id || body.message_sid

      if (!from || !to || !messageBody) {
        console.warn('Missing required fields for inbound message:', { from, to, body: messageBody })
        return NextResponse.json(
          { error: 'Missing required fields: from, to, body' },
          { status: 400 }
        )
      }

      const messageIdValue = messageId || `inbound-${Date.now()}`

      await processInboundMessage({
        from: from.toString(),
        to: to.toString(),
        body: messageBody.toString(),
        messageId: messageIdValue.toString(),
        timestamp: body.timestamp || body.created_at || body.date_created,
      })

      return NextResponse.json({ ok: true, processed: 'inbound' })
    } else if (webhookType === 'delivery' || body.status) {
      // Delivery status update
      const messageId = body.message_id || body.messageId || body.id || body.message_sid
      const status = body.status || body.delivery_status || body.state
      const errorCode = body.error_code || body.errorCode || body.error
      const errorMessage = body.error_message || body.errorMessage || body.error_description

      if (!messageId || !status) {
        console.warn('Missing required fields for delivery update:', { messageId, status })
        return NextResponse.json(
          { error: 'Missing required fields: message_id, status' },
          { status: 400 }
        )
      }

      await updateMessageStatus({
        clicksendMessageId: messageId.toString(),
        status: status.toString(),
        errorCode: errorCode?.toString(),
        errorMessage: errorMessage?.toString(),
      })

      return NextResponse.json({ ok: true, processed: 'delivery' })
    } else {
      // Unknown webhook type - log for debugging
      console.warn('Unknown ClickSend webhook type:', { webhookType, body })
      return NextResponse.json({ ok: true, processed: 'unknown', received: body })
    }
  } catch (error: any) {
    console.error('ClickSend webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support GET for webhook verification (if ClickSend requires it)
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'ok', service: 'ClickSend Webhook' })
}

