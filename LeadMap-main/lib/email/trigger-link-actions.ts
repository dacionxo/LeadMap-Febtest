/**
 * Trigger Link Actions Handler
 * Processes actions configured on trigger links (Mautic-style)
 * 
 * Actions can include:
 * - Add contact to segment/list
 * - Remove contact from segment/list
 * - Trigger campaign
 * - Update contact fields
 * - Send webhook
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface TriggerLinkAction {
  type: 'add_to_segment' | 'remove_from_segment' | 'trigger_campaign' | 'update_contact' | 'webhook'
  config: {
    // For add_to_segment/remove_from_segment
    list_id?: string
    segment_id?: string
    
    // For trigger_campaign
    campaign_id?: string
    
    // For update_contact
    fields?: Record<string, any>
    
    // For webhook
    webhook_url?: string
    webhook_method?: 'GET' | 'POST' | 'PUT'
    webhook_headers?: Record<string, string>
    webhook_body?: Record<string, any>
  }
}

export interface TriggerLink {
  id: string
  user_id: string
  name: string
  link_url: string
  link_key: string
  actions?: TriggerLinkAction[] | null
}

export interface ProcessTriggerLinkActionsParams {
  supabase: SupabaseClient
  triggerLink: TriggerLink
  recipientEmail?: string
  emailId?: string
  recipientId?: string
  campaignId?: string
  userId: string
  clickMetadata: Record<string, any>
}

/**
 * Process all actions configured on a trigger link
 * Based on Mautic's action execution pattern
 */
export async function processTriggerLinkActions(
  params: ProcessTriggerLinkActionsParams
): Promise<void> {
  const { supabase, triggerLink, recipientEmail, userId, clickMetadata } = params

  if (!triggerLink.actions || !Array.isArray(triggerLink.actions)) {
    return
  }

  // Process each action
  for (const action of triggerLink.actions) {
    try {
      switch (action.type) {
        case 'add_to_segment':
          await handleAddToSegment(supabase, action, recipientEmail, userId)
          break
        
        case 'remove_from_segment':
          await handleRemoveFromSegment(supabase, action, recipientEmail, userId)
          break
        
        case 'trigger_campaign':
          await handleTriggerCampaign(supabase, action, params)
          break
        
        case 'update_contact':
          await handleUpdateContact(supabase, action, recipientEmail, userId)
          break
        
        case 'webhook':
          await handleWebhook(action, params)
          break
        
        default:
          console.warn(`Unknown trigger link action type: ${(action as any).type}`)
      }
    } catch (error) {
      console.error(`Error processing trigger link action ${action.type}:`, error)
      // Continue processing other actions even if one fails
    }
  }
}

/**
 * Add contact to segment/list
 */
async function handleAddToSegment(
  supabase: SupabaseClient,
  action: TriggerLinkAction,
  recipientEmail: string | undefined,
  userId: string
): Promise<void> {
  if (!recipientEmail) {
    console.warn('Cannot add to segment: recipient email not provided')
    return
  }

  const listId = action.config.list_id || action.config.segment_id
  if (!listId) {
    console.warn('Cannot add to segment: list_id or segment_id not configured')
    return
  }

  // Find or create contact
  let contactId: string | null = null
  
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()

  if (existingContact) {
    contactId = existingContact.id
  } else {
    // Create contact if it doesn't exist
    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        email: recipientEmail.toLowerCase(),
        status: 'new',
        source: 'trigger_link'
      })
      .select('id')
      .single()

    if (createError) {
      console.error('Error creating contact for trigger link:', createError)
      return
    }

    contactId = newContact.id
  }

  // Add to list
  const { error: membershipError } = await supabase
    .from('list_memberships')
    .insert({
      list_id: listId,
      item_type: 'contact',
      item_id: contactId
    })

  if (membershipError) {
    // Ignore duplicate errors (contact already in list)
    if (membershipError.code !== '23505') {
      console.error('Error adding contact to list:', membershipError)
    }
  }
}

/**
 * Remove contact from segment/list
 */
async function handleRemoveFromSegment(
  supabase: SupabaseClient,
  action: TriggerLinkAction,
  recipientEmail: string | undefined,
  userId: string
): Promise<void> {
  if (!recipientEmail) {
    console.warn('Cannot remove from segment: recipient email not provided')
    return
  }

  const listId = action.config.list_id || action.config.segment_id
  if (!listId) {
    console.warn('Cannot remove from segment: list_id or segment_id not configured')
    return
  }

  // Find contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()

  if (!contact) {
    return // Contact doesn't exist, nothing to remove
  }

  // Remove from list
  const { error } = await supabase
    .from('list_memberships')
    .delete()
    .eq('list_id', listId)
    .eq('item_type', 'contact')
    .eq('item_id', contact.id)

  if (error) {
    console.error('Error removing contact from list:', error)
  }
}

/**
 * Trigger campaign for contact
 */
async function handleTriggerCampaign(
  supabase: SupabaseClient,
  action: TriggerLinkAction,
  params: ProcessTriggerLinkActionsParams
): Promise<void> {
  const campaignId = action.config.campaign_id
  if (!campaignId) {
    console.warn('Cannot trigger campaign: campaign_id not configured')
    return
  }

  const { recipientEmail, recipientId, userId } = params

  // If we have a recipientId, use it directly
  if (recipientId) {
    // Check if recipient is already in campaign
    const { data: existing } = await supabase
      .from('campaign_recipients')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('id', recipientId)
      .maybeSingle()

    if (existing) {
      // Recipient already in campaign, nothing to do
      return
    }
  }

  // If we have email, find or create contact and add to campaign
  if (recipientEmail) {
    // Find or create contact
    let contactId: string | null = null
    
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('email', recipientEmail.toLowerCase())
      .maybeSingle()

    if (existingContact) {
      contactId = existingContact.id
    } else {
      // Create contact
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          email: recipientEmail.toLowerCase(),
          status: 'new',
          source: 'trigger_link'
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating contact for campaign trigger:', createError)
        return
      }

      contactId = newContact.id
    }

    // Add contact to campaign
    const { error: addError } = await supabase
      .from('campaign_recipients')
      .insert({
        campaign_id: campaignId,
        email: recipientEmail.toLowerCase(),
        contact_id: contactId,
        status: 'active'
      })

    if (addError) {
      // Ignore duplicate errors
      if (addError.code !== '23505') {
        console.error('Error adding contact to campaign:', addError)
      }
    }
  }
}

/**
 * Update contact fields
 */
async function handleUpdateContact(
  supabase: SupabaseClient,
  action: TriggerLinkAction,
  recipientEmail: string | undefined,
  userId: string
): Promise<void> {
  if (!recipientEmail) {
    console.warn('Cannot update contact: recipient email not provided')
    return
  }

  const fields = action.config.fields
  if (!fields || Object.keys(fields).length === 0) {
    console.warn('Cannot update contact: no fields configured')
    return
  }

  // Find contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()

  if (!contact) {
    // Create contact with fields
    const { error: createError } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        email: recipientEmail.toLowerCase(),
        ...fields,
        status: 'new',
        source: 'trigger_link'
      })

    if (createError) {
      console.error('Error creating contact with fields:', createError)
    }
    return
  }

  // Update existing contact
  const { error: updateError } = await supabase
    .from('contacts')
    .update({
      ...fields,
      updated_at: new Date().toISOString()
    })
    .eq('id', contact.id)

  if (updateError) {
    console.error('Error updating contact:', updateError)
  }
}

/**
 * Send webhook
 */
async function handleWebhook(
  action: TriggerLinkAction,
  params: ProcessTriggerLinkActionsParams
): Promise<void> {
  const webhookUrl = action.config.webhook_url
  if (!webhookUrl) {
    console.warn('Cannot send webhook: webhook_url not configured')
    return
  }

  const method = action.config.webhook_method || 'POST'
  const headers = action.config.webhook_headers || {}
  const body = action.config.webhook_body || {}

  // Merge click metadata into body
  const webhookBody = {
    ...body,
    trigger_link: {
      id: params.triggerLink.id,
      name: params.triggerLink.name,
      key: params.triggerLink.link_key
    },
    click: params.clickMetadata,
    recipient: {
      email: params.recipientEmail,
      email_id: params.emailId,
      recipient_id: params.recipientId,
      campaign_id: params.campaignId
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: method !== 'GET' ? JSON.stringify(webhookBody) : undefined
    })

    if (!response.ok) {
      console.warn(`Webhook returned non-OK status: ${response.status}`)
    }
  } catch (error) {
    console.error('Error sending webhook:', error)
    // Don't throw - webhook failures shouldn't block the redirect
  }
}

