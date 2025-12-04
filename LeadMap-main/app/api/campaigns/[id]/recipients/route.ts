import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Recipients API
 * GET: Get all recipients for a campaign
 * POST: Add recipients to a campaign
 */

interface ExistingRecipient {
  email: string
}

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

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get all recipients for this campaign with address data from contacts/listings
    const { data: recipients, error: recipientsError } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })

    if (recipientsError) {
      console.error('Recipients fetch error:', recipientsError)
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
    }

    // Enrich recipients with address data from contacts or listings
    const enrichedRecipients = await Promise.all(
      (recipients || []).map(async (recipient: any) => {
        let address_street = null
        let address_city = null
        let address_state = null
        let address_zip = null

        // Try to get address from contact
        if (recipient.contact_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('address, street, city, state, zip_code')
            .eq('id', recipient.contact_id)
            .single()

          if (contact) {
            address_street = contact.street || contact.address || null
            address_city = contact.city || null
            address_state = contact.state || null
            address_zip = contact.zip_code || null
          }
        }

        // If no address from contact, try to get from listing
        if (!address_street && !address_city && recipient.listing_id) {
          const listingTables = ['listings', 'expired_listings', 'probate_leads', 'fsbo_leads', 'frbo_leads']
          
          for (const table of listingTables) {
            try {
              const { data: listing } = await supabase
                .from(table)
                .select('street, address, city, state, zip_code')
                .eq('listing_id', recipient.listing_id)
                .single()

              if (listing) {
                address_street = listing.street || listing.address || null
                address_city = listing.city || null
                address_state = listing.state || null
                address_zip = listing.zip_code || null
                break
              }
            } catch (tableError) {
              // Table might not exist, continue
              continue
            }
          }
        }

        return {
          ...recipient,
          address_street: address_street,
          address_city: address_city,
          address_state: address_state,
          address_zip: address_zip
        }
      })
    )

    return NextResponse.json({ recipients: enrichedRecipients })
  } catch (error) {
    console.error('Recipients GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
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

    // Verify campaign belongs to user and get max_new_leads_per_day setting
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, send_strategy, max_new_leads_per_day')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check max_new_leads_per_day limit if enabled
    if (campaign.max_new_leads_per_day) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Count recipients added today
      const { data: todayRecipients, error: countError } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      const todayCount = todayRecipients || 0
      if (todayCount >= campaign.max_new_leads_per_day) {
        return NextResponse.json({
          error: `Daily limit of ${campaign.max_new_leads_per_day} new leads reached. Please try again tomorrow.`,
          added: 0,
          skipped: 0,
          dailyLimitReached: true
        }, { status: 400 })
      }
    }

    const body = await request.json()
    const { recipients, contactIds, listingIds } = body

    // Collect all recipients to add
    const allRecipients: any[] = []

    // Add direct recipients if provided
    if (recipients && Array.isArray(recipients)) {
      allRecipients.push(...recipients)
    }

    // Fetch contacts if contactIds provided
    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, company')
        .in('id', contactIds)
        .eq('user_id', user.id)

      if (!contactsError && contacts) {
        contacts.forEach((contact: any) => {
          allRecipients.push({
            email: contact.email,
            firstName: contact.first_name || '',
            lastName: contact.last_name || '',
            company: contact.company || '',
            contactId: contact.id
          })
        })
      }
    }

    // Fetch listings if listingIds provided
    if (listingIds && Array.isArray(listingIds) && listingIds.length > 0) {
      const listingTables = ['listings', 'expired_listings', 'probate_leads', 'fsbo_leads', 'frbo_leads']
      
      for (const table of listingTables) {
        try {
          const { data: listings, error: listingsError } = await supabase
            .from(table)
            .select('listing_id, agent_email, agent_name')
            .in('listing_id', listingIds)
            .not('agent_email', 'is', null)

          if (!listingsError && listings) {
            listings.forEach((listing: any) => {
              if (listing.agent_email) {
                const nameParts = (listing.agent_name || '').split(' ')
                allRecipients.push({
                  email: listing.agent_email.toLowerCase(),
                  firstName: nameParts[0] || '',
                  lastName: nameParts.slice(1).join(' ') || '',
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

    if (allRecipients.length === 0) {
      return NextResponse.json({ error: 'No recipients to add' }, { status: 400 })
    }

    // Deduplicate recipients by email
    const uniqueRecipients = new Map<string, any>()
    allRecipients.forEach(recipient => {
      const email = recipient.email.toLowerCase()
      if (!uniqueRecipients.has(email)) {
        uniqueRecipients.set(email, recipient)
      }
    })

    // Get existing recipients to avoid duplicates
    const { data: existingRecipients } = await supabase
      .from('campaign_recipients')
      .select('email')
      .eq('campaign_id', id)

    const existingEmails = new Set((existingRecipients || []).map((r: ExistingRecipient) => r.email.toLowerCase()))

    // Prepare inserts
    const recipientInserts: any[] = []
    const skippedRecipients: any[] = []

    for (const recipient of Array.from(uniqueRecipients.values())) {
      const email = recipient.email.toLowerCase()
      
      // Skip if already exists
      if (existingEmails.has(email)) {
        skippedRecipients.push({
          email,
          reason: 'Already in campaign'
        })
        continue
      }

      // Generate dedupe hash
      const dedupeHash = generateDedupeHash(email, campaign.send_strategy)

      recipientInserts.push({
        campaign_id: id,
        contact_id: recipient.contactId || null,
        listing_id: recipient.listingId || null,
        email,
        first_name: recipient.firstName || null,
        last_name: recipient.lastName || null,
        company: recipient.company || null,
        status: 'pending',
        dedupe_hash: dedupeHash,
        metadata: recipient.metadata || null
      })
    }

    if (recipientInserts.length === 0) {
      return NextResponse.json({
        message: 'All recipients already exist in campaign',
        added: 0,
        skipped: skippedRecipients.length
      })
    }

    // Insert recipients
    const { error: insertError } = await supabase
      .from('campaign_recipients')
      .insert(recipientInserts)

    if (insertError) {
      console.error('Recipients insert error:', insertError)
      return NextResponse.json({ error: 'Failed to add recipients' }, { status: 500 })
    }

    return NextResponse.json({
      message: `Added ${recipientInserts.length} recipient(s) to campaign`,
      added: recipientInserts.length,
      skipped: skippedRecipients.length
    })
  } catch (error) {
    console.error('Recipients POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateDedupeHash(email: string, campaignType: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(`${email}:${campaignType}`).digest('hex')
}

