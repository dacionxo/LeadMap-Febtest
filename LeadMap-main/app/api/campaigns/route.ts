import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Campaigns API
 * GET: List user's campaigns
 * POST: Create a new campaign
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get campaigns with basic stats
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (campaignsError) {
      console.error('Database error:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Get stats for each campaign
    interface Campaign {
      id: string
      [key: string]: any
    }

    interface RecipientStatus {
      status: string
    }

    const campaignsWithStats = await Promise.all(
      (campaigns || []).map(async (campaign: Campaign) => {
        // Get recipient count and status breakdown
        const { data: recipients, error: recipientsError } = await supabase
          .from('campaign_recipients')
          .select('status')
          .eq('campaign_id', campaign.id)

        if (recipientsError) {
          return {
            ...campaign,
            total_recipients: 0,
            sent_count: 0,
            completed_count: 0,
            pending_count: 0,
            failed_count: 0
          }
        }

        const total = recipients?.length || 0
        const sent = recipients?.filter((r: RecipientStatus) => ['queued', 'in_progress', 'completed'].includes(r.status)).length || 0
        const completed = recipients?.filter((r: RecipientStatus) => r.status === 'completed').length || 0
        const pending = recipients?.filter((r: RecipientStatus) => r.status === 'pending' || r.status === 'queued').length || 0
        const failed = recipients?.filter((r: RecipientStatus) => r.status === 'failed' || r.status === 'bounced').length || 0

        return {
          ...campaign,
          total_recipients: total,
          sent_count: sent,
          completed_count: completed,
          pending_count: pending,
          failed_count: failed
        }
      })
    )

    return NextResponse.json({ campaigns: campaignsWithStats })
  } catch (error) {
    console.error('Campaigns GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      mailboxId,
      name,
      description,
      sendStrategy,
      startAt,
      timezone,
      steps,
      recipients, // Individual recipients (legacy)
      listIds // NEW: List-based recipient selection
    } = body

    if (!mailboxId || !name || !sendStrategy) {
      return NextResponse.json({ error: 'Mailbox ID, name, and send strategy are required' }, { status: 400 })
    }
    
    // Must provide either recipients or listIds
    if ((!recipients || !Array.isArray(recipients) || recipients.length === 0) && 
        (!listIds || !Array.isArray(listIds) || listIds.length === 0)) {
      return NextResponse.json({ error: 'Either recipients array or listIds array is required' }, { status: 400 })
    }

    // Verify mailbox belongs to user
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('id, active')
      .eq('id', mailboxId)
      .eq('user_id', user.id)
      .single()

    if (mailboxError || !mailbox) {
      return NextResponse.json({ error: 'Mailbox not found or does not belong to user' }, { status: 404 })
    }

    if (!mailbox.active) {
      return NextResponse.json({ error: 'Mailbox is not active' }, { status: 400 })
    }

    // Validate steps
    if (sendStrategy === 'sequence' && (!steps || !Array.isArray(steps) || steps.length === 0)) {
      return NextResponse.json({ error: 'Sequence campaigns require at least one step' }, { status: 400 })
    }

    if (sendStrategy === 'single' && (!steps || steps.length !== 1)) {
      return NextResponse.json({ error: 'Single email campaigns require exactly one step' }, { status: 400 })
    }

    // Build recipients from lists if listIds provided
    let allRecipients: any[] = recipients || []
    
    if (listIds && Array.isArray(listIds) && listIds.length > 0) {
      // Use service role to fetch list memberships
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
      }
      
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
      
      // Verify lists belong to user
      const { data: lists, error: listsError } = await supabaseAdmin
        .from('lists')
        .select('id, type, name')
        .in('id', listIds)
        .eq('user_id', user.id)
      
      if (listsError || !lists || lists.length !== listIds.length) {
        return NextResponse.json({ error: 'One or more lists not found or unauthorized' }, { status: 404 })
      }
      
      // Fetch all list memberships for these lists
      const { data: memberships, error: membershipsError } = await supabaseAdmin
        .from('list_memberships')
        .select('list_id, item_type, item_id')
        .in('list_id', listIds)
      
      if (membershipsError) {
        console.error('Error fetching list memberships:', membershipsError)
        return NextResponse.json({ error: 'Failed to fetch list members' }, { status: 500 })
      }
      
      // Group memberships by item_type
      const contactsMap = new Map<string, any>()
      const listingsMap = new Map<string, any>()
      
      memberships?.forEach((membership: any) => {
        if (membership.item_type === 'contact') {
          contactsMap.set(membership.item_id, true)
        } else if (membership.item_type === 'listing') {
          listingsMap.set(membership.item_id, true)
        }
      })
      
      // Fetch contacts from list
      if (contactsMap.size > 0) {
        const { data: contacts, error: contactsError } = await supabaseAdmin
          .from('contacts')
          .select('id, email, first_name, last_name, company')
          .in('id', Array.from(contactsMap.keys()))
          .eq('user_id', user.id)
          .not('email', 'is', null)
        
        if (contactsError) {
          console.error('Error fetching contacts:', contactsError)
        } else if (contacts) {
          contacts.forEach((contact: any) => {
            if (contact.email) {
              allRecipients.push({
                email: contact.email.toLowerCase(),
                firstName: contact.first_name,
                lastName: contact.last_name,
                company: contact.company,
                contactId: contact.id
              })
            }
          })
        }
      }
      
      // Fetch listings and extract email addresses
      if (listingsMap.size > 0) {
        // Try multiple listing tables
        const listingTables = ['listings', 'expired_listings', 'probate_leads', 'fsbo_leads', 'frbo_leads']
        
        for (const table of listingTables) {
          try {
            const { data: listings, error: listingsError } = await supabaseAdmin
              .from(table)
              .select('listing_id, agent_email, agent_name')
              .in('listing_id', Array.from(listingsMap.keys()))
              .not('agent_email', 'is', null)
            
            if (!listingsError && listings) {
              listings.forEach((listing: any) => {
                if (listing.agent_email) {
                  const nameParts = (listing.agent_name || '').split(' ')
                  allRecipients.push({
                    email: listing.agent_email.toLowerCase(),
                    firstName: nameParts[0] || null,
                    lastName: nameParts.slice(1).join(' ') || null,
                    listingId: listing.listing_id
                  })
                }
              })
            }
          } catch (tableError) {
            // Table might not exist, continue
            console.warn(`Table ${table} not accessible or doesn't exist`)
          }
        }
      }
      
      // Deduplicate recipients by email
      const uniqueRecipients = new Map<string, any>()
      allRecipients.forEach(recipient => {
        const email = recipient.email.toLowerCase()
        if (!uniqueRecipients.has(email)) {
          uniqueRecipients.set(email, recipient)
        }
      })
      allRecipients = Array.from(uniqueRecipients.values())
    }
    
    // Validate we have recipients
    if (!allRecipients || allRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients found in selected lists' }, { status: 400 })
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        mailbox_id: mailboxId,
        name,
        description,
        send_strategy: sendStrategy,
        start_at: startAt || null,
        timezone: timezone || 'UTC',
        status: startAt && new Date(startAt) > new Date() ? 'scheduled' : 'draft'
      })
      .select()
      .single()

    if (campaignError || !campaign) {
      console.error('Campaign creation error:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Create campaign steps
    const stepInserts = steps.map((step: any, index: number) => ({
      campaign_id: campaign.id,
      step_number: index + 1,
      delay_hours: step.delayHours || (index === 0 ? 0 : 48),
      template_id: step.templateId || null,
      subject: step.subject,
      html: step.html,
      stop_on_reply: step.stopOnReply !== undefined ? step.stopOnReply : true
    }))

    const { error: stepsError } = await supabase
      .from('campaign_steps')
      .insert(stepInserts)

    if (stepsError) {
      console.error('Campaign steps creation error:', stepsError)
      // Rollback campaign creation
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: 'Failed to create campaign steps' }, { status: 500 })
    }

    // Dedupe check and create campaign recipients
    const { checkCampaignDedupe, generateDedupeHash } = await import('@/lib/email/campaigns/dedupe')
    const recipientInserts = []
    const skippedRecipients = []

    for (const recipient of allRecipients) {
      // Check for duplicates
      const dedupeCheck = await checkCampaignDedupe(
        recipient.email,
        campaign.id,
        user.id,
        supabase
      )

      if (!dedupeCheck.allowed) {
        skippedRecipients.push({
          email: recipient.email,
          reason: dedupeCheck.reason
        })
        continue
      }

      // Generate dedupe hash
      const dedupeHash = generateDedupeHash(recipient.email, campaign.send_strategy)

      recipientInserts.push({
        campaign_id: campaign.id,
        contact_id: recipient.contactId || null,
        listing_id: recipient.listingId || null,
        email: recipient.email.toLowerCase(),
        first_name: recipient.firstName || null,
        last_name: recipient.lastName || null,
        company: recipient.company || null,
        status: 'pending',
        dedupe_hash: dedupeHash,
        metadata: recipient.metadata || null
      })
    }

    const { error: recipientsError } = await supabase
      .from('campaign_recipients')
      .insert(recipientInserts)

    if (recipientsError) {
      console.error('Campaign recipients creation error:', recipientsError)
      // Rollback campaign and steps
      await supabase.from('campaign_steps').delete().eq('campaign_id', campaign.id)
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: 'Failed to create campaign recipients' }, { status: 500 })
    }

    // If campaign is scheduled and start_at is in the future, create queued emails for step 1
    if (campaign.status === 'scheduled' && campaign.start_at) {
      const firstStep = stepInserts[0]
      if (firstStep) {
        // Queue emails will be created by the scheduler
        // For now, we'll mark recipients as queued
        await supabase
          .from('campaign_recipients')
          .update({ status: 'queued' })
          .eq('campaign_id', campaign.id)
      }
    }

    // Return complete campaign with steps and recipients
    const { data: campaignSteps } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('step_number', { ascending: true })

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        steps: campaignSteps || [],
        recipient_count: recipientInserts.length
      },
      skipped_recipients: skippedRecipients.length > 0 ? skippedRecipients : undefined,
      message: skippedRecipients.length > 0 
        ? `Campaign created with ${recipientInserts.length} recipients. ${skippedRecipients.length} skipped due to duplicate enrollments.`
        : `Campaign created successfully with ${recipientInserts.length} recipients.`
    })
  } catch (error) {
    console.error('Campaigns POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

