'use client'

// Inline normalization function to avoid import issues
function normalizeListingIdentifier(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  
  const lower = trimmed.toLowerCase()
  const isUrl = lower.includes('http://') || lower.includes('https://') || 
                lower.startsWith('www.') || lower.includes('.com') || 
                lower.includes('.net') || lower.includes('.org') || lower.includes('.io')
  
  if (isUrl) {
    let working = trimmed
    if (!working.toLowerCase().startsWith('http')) {
      working = `https://${working}`
    }
    try {
      const url = new URL(working)
      let pathname = url.pathname || ''
      pathname = pathname.replace(/\/+$/, '')
      const normalized = `${url.protocol}//${url.host}${pathname}${url.search ? url.search : ''}`
      return normalized.toLowerCase()
    } catch {
      return working.toLowerCase()
    }
  }
  return trimmed
}

/**
 * Utility function to add a listing to a list or save it as a contact
 * @param supabase - Supabase client instance
 * @param profileId - User profile ID
 * @param listingId - Listing ID to save
 * @param listing - Listing data
 * @param targetListId - Optional list ID to add to specific list
 * @param category - Optional category to assign the saved listing to ('all', 'expired', 'probate', 'fsbo', 'frbo', 'foreclosure', 'imports', 'trash')
 */
export async function add_to_list(
  supabase: any,
  profileId: string,
  listingId: string,
  listing: {
    listing_id?: string
    property_url?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
    agent_name?: string | null
    agent_email?: string | null
    agent_phone?: string | null
    list_price?: number | null
  },
  targetListId?: string,
  category?: string
) {
  if (!profileId) {
    throw new Error('Please log in to save listings')
  }

  if (targetListId) {
    // WORLD-CLASS SOLUTION: Add to specific list with robust verification
    // Strategy: Always use listing_id as primary identifier, with fallback to property_url
    // This ensures maximum compatibility when fetching
    
    let itemIdToStore: string | null = null
    let verificationDetails: any = {}
    
    // Step 1: Try to find the listing in the database to get the canonical ID
    if (listing.listing_id) {
      const { data: foundListing, error: findError } = await supabase
        .from('listings')
        .select('listing_id, property_url')
        .eq('listing_id', listing.listing_id)
        .maybeSingle()
      
      if (!findError && foundListing) {
        itemIdToStore = foundListing.listing_id
        verificationDetails.method = 'listing_id_direct'
        verificationDetails.found = true
      } else {
        verificationDetails.method = 'listing_id_direct'
        verificationDetails.found = false
        verificationDetails.error = findError?.message
      }
    }
    
    // Step 2: If not found by listing_id, try property_url
    if (!itemIdToStore && listing.property_url) {
      const { data: foundListing, error: findError } = await supabase
        .from('listings')
        .select('listing_id, property_url')
        .eq('property_url', listing.property_url)
        .maybeSingle()
      
      if (!findError && foundListing) {
        // CRITICAL: Prefer listing_id from database, fallback to property_url
        itemIdToStore = foundListing.listing_id || foundListing.property_url
        verificationDetails.method = 'property_url_lookup'
        verificationDetails.found = true
        verificationDetails.canonicalId = foundListing.listing_id
      } else {
        // Last resort: use the property_url we have (listing might not be in DB yet)
        itemIdToStore = listing.property_url
        verificationDetails.method = 'property_url_fallback'
        verificationDetails.found = false
        verificationDetails.warning = 'Listing not found in database, using property_url'
      }
    }
    
    // Step 3: Final fallback
    if (!itemIdToStore) {
      itemIdToStore = listing.listing_id || listing.property_url || listingId
      verificationDetails.method = 'fallback'
      verificationDetails.warning = 'Using fallback identifier'
    }
    
    if (!itemIdToStore) {
      throw new Error('Cannot add to list: listing has no listing_id or property_url')
    }

    // Apollo Pattern: Store the canonical ID from database when available
    // Only normalize if it's a URL and we don't have a canonical listing_id
    // This ensures maximum compatibility when fetching
    let finalItemId: string
    if (verificationDetails.found && verificationDetails.canonicalId) {
      // We found the listing in DB and have canonical listing_id - use it as-is
      finalItemId = verificationDetails.canonicalId
      console.log('✅ Using canonical listing_id from database:', finalItemId)
    } else if (verificationDetails.found && itemIdToStore) {
      // We found the listing but no canonical ID - use what we found
      finalItemId = itemIdToStore
      console.log('✅ Using found listing identifier:', finalItemId)
    } else {
      // Listing not in DB yet - normalize for consistency
      const normalized = normalizeListingIdentifier(itemIdToStore)
      if (!normalized) {
        throw new Error('Cannot add to list: failed to normalize listing identifier')
      }
      finalItemId = normalized
      console.log('⚠️ Listing not in DB, using normalized identifier:', finalItemId)
    }
    
    // Step 4: Verify list exists and is accessible
    const { data: listData, error: listCheckError } = await supabase
      .from('lists')
      .select('id, type, user_id')
      .eq('id', targetListId)
      .single()
    
    if (listCheckError || !listData) {
      throw new Error(`List not found or inaccessible: ${listCheckError?.message || 'Unknown error'}`)
    }
    
    // Step 5: Use the new API endpoint to add to list_memberships
    console.log('💾 Adding to list:', {
      list_id: targetListId,
      list_name: listData.name || 'Unknown',
      list_type: listData.type,
      item_id: finalItemId,
      original_listing_id: listing.listing_id,
      original_property_url: listing.property_url,
      passed_listingId: listingId,
      verification: verificationDetails
    })
    
    // Use the new API endpoint (Apollo-grade workflow)
    const response = await fetch(`/api/lists/${targetListId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: finalItemId,
        itemType: 'listing'
      })
    })

    const data = await response.json()

    if (!response.ok) {
      // If it's a duplicate, that's fine - return silently
      if (data.error?.includes('duplicate') || data.error?.includes('already')) {
        console.log('ℹ️ Item already in list, skipping duplicate')
        return
      }
      console.error('❌ Error adding to list:', {
        error: data.error,
        status: response.status
      })
      throw new Error(data.error || 'Failed to add item to list')
    }
    
    console.log('✅ Successfully added to list:', {
      membership: data.membership,
      item_id: finalItemId,
      list_id: targetListId
    })
    
    // Return success (backward compatible - callers don't need return value)
    return
  } else {
    // Save to contacts (default behavior)
    const sourceId = listing.listing_id || listing.property_url
    if (!sourceId) {
      throw new Error('Invalid listing: missing listing_id or property_url')
    }

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, tags')
      .eq('user_id', profileId)
      .eq('source', 'listing')
      .eq('source_id', sourceId)
      .maybeSingle()

    // Prepare category tag - use provided category or default to 'all'
    const categoryTag = category || 'all'
    const tags = existingContact?.tags || []
    const categoryValues = ['all', 'expired', 'probate', 'fsbo', 'frbo', 'foreclosure', 'imports', 'trash']
    const updatedTags = tags.includes(categoryTag) ? tags : [...tags.filter((t: string) => !categoryValues.includes(t)), categoryTag]

    if (!existingContact) {
      // Parse agent name
      const nameParts = listing.agent_name?.split(' ') || []
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(' ') || 'Property Owner'

      // Create contact from listing with category in tags
      const contactData = {
        user_id: profileId,
        first_name: firstName,
        last_name: lastName,
        email: listing.agent_email || null,
        phone: listing.agent_phone || null,
        address: listing.street || null,
        city: listing.city || null,
        state: listing.state || null,
        zip_code: listing.zip_code || null,
        source: 'listing',
        source_id: sourceId,
        status: 'new',
        tags: updatedTags, // Store category in tags array
        notes: `Saved from property listing: ${listing.property_url || 'N/A'}\nList Price: ${listing.list_price ? `$${listing.list_price.toLocaleString()}` : 'N/A'}\nCategory: ${categoryTag}`
      }

      const { error: contactError } = await supabase
        .from('contacts')
        .insert([contactData])

      if (contactError) {
        if (contactError.code === '23505') {
          // Already saved, but update category
          await supabase
            .from('contacts')
            .update({ tags: updatedTags, updated_at: new Date().toISOString() })
            .eq('user_id', profileId)
            .eq('source', 'listing')
            .eq('source_id', sourceId)
          return
        }
        throw contactError
      }

      // Mark user as having real data
      await supabase
        .from('users')
        .update({ has_real_data: true })
        .eq('id', profileId)
    } else {
      // Update existing contact with new category
      await supabase
        .from('contacts')
        .update({ tags: updatedTags, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id)
    }
  }
}

