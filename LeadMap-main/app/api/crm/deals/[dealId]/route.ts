import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Valid stages according to database constraint
 */
const VALID_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const

/**
 * Normalize a stage name to match database constraint
 * Maps common pipeline stage names to valid database stages
 */
function normalizeStage(stage: string | null | undefined): string {
  if (!stage) return 'new'
  
  const normalized = stage.toLowerCase().trim()
  
  // Direct match
  if (VALID_STAGES.includes(normalized as any)) {
    return normalized
  }
  
  // Map common variations to valid stages
  const stageMap: Record<string, string> = {
    'new lead': 'new',
    'new leads': 'new',
    'lead': 'new',
    'leads': 'new',
    'contact': 'contacted',
    'initial contact': 'contacted',
    'qualify': 'qualified',
    'qualified lead': 'qualified',
    'proposal sent': 'proposal',
    'in negotiation': 'negotiation',
    'negotiating': 'negotiation',
    'under contract': 'negotiation',
    'closed': 'closed_won',
    'won': 'closed_won',
    'closed won': 'closed_won',
    'closed-won': 'closed_won',
    'lost': 'closed_lost',
    'closed lost': 'closed_lost',
    'closed-lost': 'closed_lost',
  }
  
  // Check for partial matches (e.g., "New Lead" -> "new lead")
  const mapped = stageMap[normalized]
  if (mapped) {
    return mapped
  }
  
  // Check if it contains any valid stage keywords
  if (normalized.includes('closed') && normalized.includes('won')) return 'closed_won'
  if (normalized.includes('closed') && normalized.includes('lost')) return 'closed_lost'
  if (normalized.includes('won') && !normalized.includes('lost')) return 'closed_won'
  if (normalized.includes('lost')) return 'closed_lost'
  if (normalized.includes('negotiat')) return 'negotiation'
  if (normalized.includes('proposal')) return 'proposal'
  if (normalized.includes('qualif')) return 'qualified'
  if (normalized.includes('contact')) return 'contacted'
  if (normalized.includes('new')) return 'new'
  
  // Default to 'new' if no match found
  console.warn(`Unknown stage "${stage}", defaulting to "new"`)
  return 'new'
}

/**
 * GET /api/crm/deals/:dealId
 * Get a single deal with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params

    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Fetch deal with related data
    // Note: owner_id and assigned_to are columns that reference auth.users,
    // but we can't easily join auth.users from public schema, so we return the IDs
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone, company)
      `)
      .eq('id', dealId)
      .eq('user_id', user.id)
      .single()

    if (dealError || !deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Fetch all contacts linked to this deal
    const { data: dealContacts } = await supabase
      .from('deal_contacts')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('deal_id', dealId)

    // Fetch activities
    const { data: activities } = await supabase
      .from('deal_activities')
      .select(`
        *,
        user:user_id(id, email)
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(100)

    // Fetch tasks related to this deal
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('related_type', 'deal')
      .eq('related_id', dealId)
      .order('due_date', { ascending: true, nullsFirst: false })

    // Fetch documents
    const { data: documents } = await supabase
      .from('deal_documents')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    // Fetch watchers
    const { data: watchers } = await supabase
      .from('deal_watchers')
      .select(`
        *,
        user:user_id(id, email)
      `)
      .eq('deal_id', dealId)

    return NextResponse.json({
      data: {
        ...deal,
        deal_contacts: dealContacts || [],
        activities: activities || [],
        tasks: tasks || [],
        documents: documents || [],
        watchers: watchers || [],
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/crm/deals/:dealId:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/crm/deals/:dealId
 * Update a deal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params

    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Verify deal exists and belongs to user
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, stage')
      .eq('id', dealId)
      .eq('user_id', user.id)
      .single()

    if (!existingDeal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      value,
      stage,
      probability,
      expected_close_date,
      closed_date,
      contact_id,
      listing_id,
      pipeline_id,
      owner_id,
      assigned_to,
      notes,
      tags,
      closed_won_reason,
      closed_lost_reason,
      contact_company,
    } = body

    // Handle contact_company - find contact by company if contact_id not provided
    let finalContactId = contact_id
    if (contact_company && contact_id === undefined) {
      // Try to find existing contact by company
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .ilike('company', contact_company.trim())
        .limit(1)
        .single()
      
      if (existingContact) {
        finalContactId = existingContact.id
      }
    }

    // Build update object
    const updates: any = {}
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (value !== undefined) updates.value = value ? parseFloat(value) : null
    if (stage !== undefined) updates.stage = normalizeStage(stage)
    if (probability !== undefined) updates.probability = probability ? parseInt(probability) : 0
    if (expected_close_date !== undefined) updates.expected_close_date = expected_close_date || null
    if (closed_date !== undefined) updates.closed_date = closed_date || null
    if (finalContactId !== undefined) updates.contact_id = finalContactId || null
    if (listing_id !== undefined) updates.listing_id = listing_id || null
    if (pipeline_id !== undefined) updates.pipeline_id = pipeline_id || null
    if (owner_id !== undefined) updates.owner_id = owner_id || null
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null
    if (notes !== undefined) updates.notes = notes
    if (tags !== undefined) updates.tags = tags
    if (closed_won_reason !== undefined) updates.closed_won_reason = closed_won_reason || null
    if (closed_lost_reason !== undefined) updates.closed_lost_reason = closed_lost_reason || null

    // Create activity log entry for stage changes
    if (stage && stage !== existingDeal.stage) {
      await supabase
        .from('deal_activities')
        .insert([{
          deal_id: dealId,
          user_id: user.id,
          activity_type: 'stage_changed',
          title: 'Stage changed',
          description: `Deal stage changed from "${existingDeal.stage}" to "${stage}"`,
          metadata: {
            old_stage: existingDeal.stage,
            new_stage: stage,
          },
        }])
    }

    const { data: deal, error: updateError } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', dealId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating deal:', updateError)
      return NextResponse.json(
        { error: 'Failed to update deal', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: deal })
  } catch (error: any) {
    console.error('Error in PUT /api/crm/deals/:dealId:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/crm/deals/:dealId
 * Delete a deal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params

    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Verify deal exists and belongs to user
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('id', dealId)
      .eq('user_id', user.id)
      .single()

    if (!existingDeal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Delete deal (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId)

    if (deleteError) {
      console.error('Error deleting deal:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete deal', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/crm/deals/:dealId:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

