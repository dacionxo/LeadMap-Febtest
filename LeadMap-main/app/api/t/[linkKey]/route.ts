import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordEmailEvent } from '@/lib/email/event-tracking'
import { processTriggerLinkActions } from '@/lib/email/trigger-link-actions'

/**
 * Trigger Link Click Handler
 * GET /t/[linkKey]?email_id=...&recipient_id=...&campaign_id=...&email=...
 * 
 * Based on Mautic patterns, this handler:
 * 1. Looks up the trigger link by link_key
 * 2. Records the click event
 * 3. Executes configured actions (add to segment, trigger campaign, etc.)
 * 4. Redirects to the original URL
 * 
 * This is similar to Mautic's click tracking with action triggers
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkKey: string }> }
) {
  try {
    const { linkKey } = await params
    const { searchParams } = new URL(request.url)
    
    // Extract tracking parameters from query string
    const emailId = searchParams.get('email_id')
    const recipientId = searchParams.get('recipient_id')
    const campaignId = searchParams.get('campaign_id')
    const recipientEmail = searchParams.get('email') || searchParams.get('recipient_email')
    
    if (!linkKey) {
      return NextResponse.json({ error: 'Link key is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Look up trigger link by link_key
    const { data: triggerLink, error: linkError } = await supabase
      .from('trigger_links')
      .select('*')
      .eq('link_key', linkKey)
      .single()

    if (linkError || !triggerLink) {
      console.warn(`Trigger link not found: ${linkKey}`, linkError)
      // If link not found, try to redirect to a default URL or return error
      return NextResponse.json({ error: 'Trigger link not found' }, { status: 404 })
    }

    // Extract request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     null
    const userAgent = request.headers.get('user-agent') || null
    const referrer = request.headers.get('referer') || request.headers.get('referrer') || null

    // Record click in trigger_link_clicks table
    const clickMetadata: Record<string, any> = {
      email_id: emailId || null,
      recipient_id: recipientId || null,
      campaign_id: campaignId || null,
      recipient_email: recipientEmail || null,
      referrer: referrer,
      timestamp: new Date().toISOString()
    }

    const { data: clickRecord, error: clickError } = await supabase
      .from('trigger_link_clicks')
      .insert({
        trigger_link_id: triggerLink.id,
        user_id: triggerLink.user_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        referrer: referrer,
        metadata: clickMetadata
      })
      .select()
      .single()

    // Update click count on trigger link (fire and forget)
    supabase
      .from('trigger_links')
      .update({ 
        click_count: (triggerLink.click_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', triggerLink.id)
      .then(() => {})
      .catch(err => console.warn('Failed to update click count:', err))

    // Record email event if we have email context
    if (emailId || recipientId || recipientEmail) {
      try {
        // Try to get user_id from email or campaign
        let userId = triggerLink.user_id
        
        if (emailId) {
          const { data: emailRecord } = await supabase
            .from('emails')
            .select('user_id, to_email, campaign_id, mailbox_id')
            .eq('id', emailId)
            .single()
          
          if (emailRecord) {
            userId = emailRecord.user_id || userId
            const finalRecipientEmail = recipientEmail || emailRecord.to_email
            
            if (finalRecipientEmail) {
              await recordEmailEvent({
                userId: userId,
                eventType: 'clicked',
                emailId: emailId,
                mailboxId: emailRecord.mailbox_id || undefined,
                campaignId: emailRecord.campaign_id || campaignId || undefined,
                campaignRecipientId: recipientId || undefined,
                recipientEmail: finalRecipientEmail,
                clickedUrl: triggerLink.link_url,
                ipAddress: ipAddress || undefined,
                userAgent: userAgent || undefined,
                metadata: {
                  source: 'trigger_link',
                  trigger_link_id: triggerLink.id,
                  trigger_link_key: linkKey,
                  trigger_link_name: triggerLink.name
                }
              }).catch(err => {
                console.warn('Failed to record email event for trigger link:', err)
              })
            }
          }
        } else if (recipientId) {
          // Try to get info from campaign_recipients
          const { data: recipient } = await supabase
            .from('campaign_recipients')
            .select('email, campaign_id, campaign:campaigns(user_id, mailbox_id)')
            .eq('id', recipientId)
            .single()
          
          if (recipient && recipient.campaign) {
            const campaign = recipient.campaign as any
            const finalRecipientEmail = recipientEmail || recipient.email
            
            if (finalRecipientEmail && campaign.user_id) {
              await recordEmailEvent({
                userId: campaign.user_id,
                eventType: 'clicked',
                mailboxId: campaign.mailbox_id || undefined,
                campaignId: recipient.campaign_id || campaignId || undefined,
                campaignRecipientId: recipientId,
                recipientEmail: finalRecipientEmail,
                clickedUrl: triggerLink.link_url,
                ipAddress: ipAddress || undefined,
                userAgent: userAgent || undefined,
                metadata: {
                  source: 'trigger_link',
                  trigger_link_id: triggerLink.id,
                  trigger_link_key: linkKey,
                  trigger_link_name: triggerLink.name
                }
              }).catch(err => {
                console.warn('Failed to record email event for trigger link:', err)
              })
            }
          }
        } else if (recipientEmail) {
          // Record with just email if we have it
          await recordEmailEvent({
            userId: triggerLink.user_id,
            eventType: 'clicked',
            recipientEmail: recipientEmail,
            clickedUrl: triggerLink.link_url,
            ipAddress: ipAddress || undefined,
            userAgent: userAgent || undefined,
            metadata: {
              source: 'trigger_link',
              trigger_link_id: triggerLink.id,
              trigger_link_key: linkKey,
              trigger_link_name: triggerLink.name
            }
          }).catch(err => {
            console.warn('Failed to record email event for trigger link:', err)
          })
        }
      } catch (err) {
        console.warn('Error recording email event for trigger link:', err)
        // Don't fail the redirect if event recording fails
      }
    }

    // Process trigger link actions (add to segment, trigger campaign, etc.)
    // This is the key Mautic-style functionality
    if (triggerLink.actions && typeof triggerLink.actions === 'object') {
      try {
        await processTriggerLinkActions({
          supabase,
          triggerLink,
          recipientEmail: recipientEmail || undefined,
          emailId: emailId || undefined,
          recipientId: recipientId || undefined,
          campaignId: campaignId || undefined,
          userId: triggerLink.user_id,
          clickMetadata
        }).catch(err => {
          console.warn('Error processing trigger link actions:', err)
          // Don't fail the redirect if actions fail
        })
      } catch (err) {
        console.warn('Exception processing trigger link actions:', err)
      }
    }

    // Redirect to original URL
    return NextResponse.redirect(triggerLink.link_url)
  } catch (error: any) {
    console.error('Trigger link click error:', error)
    
    // Try to get link_key from params to attempt redirect
    try {
      const { linkKey } = await params
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
        
        const { data: triggerLink } = await supabase
          .from('trigger_links')
          .select('link_url')
          .eq('link_key', linkKey)
          .single()
        
        if (triggerLink?.link_url) {
          return NextResponse.redirect(triggerLink.link_url)
        }
      }
    } catch {
      // Fall through to error response
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

