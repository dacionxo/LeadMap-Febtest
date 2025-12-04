'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Upload, Plus, Trash2, Loader2, FileText, Users, Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface AddLeadsModalProps {
  campaignId: string
  onClose: () => void
  onSuccess: () => void
}

interface Recipient {
  email: string
  firstName: string
  lastName: string
  company: string
}

export default function AddLeadsModal({ campaignId, onClose, onSuccess }: AddLeadsModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'lists' | 'csv' | 'contacts' | 'listings'>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Create Supabase client at component level
  const supabase = useMemo(() => createClientComponentClient(), [])
  
  // Manual entry
  const [manualRecipients, setManualRecipients] = useState<Recipient[]>([
    { email: '', firstName: '', lastName: '', company: '' }
  ])
  
  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<Recipient[]>([])
  
  // Lists
  const [lists, setLists] = useState<any[]>([])
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [loadingLists, setLoadingLists] = useState(false)

  // Contacts/Listings
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set())
  const [contacts, setContacts] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)
  
  // Pagination for listings
  const [listingsCurrentPage, setListingsCurrentPage] = useState(1)
  const [listingsPageSize] = useState(20)
  const [listingsTotalCount, setListingsTotalCount] = useState(0)
  const [listingsTotalPages, setListingsTotalPages] = useState(0)

  const handleAddManualRow = () => {
    setManualRecipients([...manualRecipients, { email: '', firstName: '', lastName: '', company: '' }])
  }

  const handleRemoveManualRow = (index: number) => {
    setManualRecipients(manualRecipients.filter((_, i) => i !== index))
  }

  const handleManualChange = (index: number, field: keyof Recipient, value: string) => {
    const updated = [...manualRecipients]
    updated[index] = { ...updated[index], [field]: value }
    setManualRecipients(updated)
  }

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    setError(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row')
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const emailIndex = headers.findIndex(h => h.includes('email'))
      
      if (emailIndex === -1) {
        throw new Error('CSV must contain an "email" column')
      }

      const firstNameIndex = headers.findIndex(h => h.includes('first') || h.includes('name'))
      const lastNameIndex = headers.findIndex(h => h.includes('last') || h.includes('surname'))
      const companyIndex = headers.findIndex(h => h.includes('company') || h.includes('organization'))

      const parsed: Recipient[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const email = values[emailIndex]?.toLowerCase().trim()
        
        if (email && email.includes('@')) {
          parsed.push({
            email,
            firstName: values[firstNameIndex] || '',
            lastName: values[lastNameIndex] || '',
            company: values[companyIndex] || ''
          })
        }
      }

      setCsvPreview(parsed)
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV')
      setCsvFile(null)
      setCsvPreview([])
    }
  }

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true)
      const response = await fetch('/api/crm/contacts?limit=1000')
      if (response.ok) {
        const data = await response.json()
        // Enrich contacts with formatted address
        const enrichedContacts = (data.contacts || []).map((contact: any) => {
          // Build address from available fields
          const addressParts = []
          if (contact.street) addressParts.push(contact.street)
          else if (contact.address) addressParts.push(contact.address)
          
          if (contact.city && contact.state) {
            addressParts.push(`${contact.city}, ${contact.state}${contact.zip_code ? ' ' + contact.zip_code : ''}`)
          } else if (contact.city) {
            addressParts.push(contact.city)
          } else if (contact.state) {
            addressParts.push(contact.state)
          }
          
          return {
            ...contact,
            formatted_address: addressParts.length > 0 ? addressParts.join(', ') : null
          }
        })
        setContacts(enrichedContacts)
      }
    } catch (err) {
      console.error('Error loading contacts:', err)
    } finally {
      setLoadingContacts(false)
    }
  }

  // Fetch lists when tab becomes active - same as /dashboard/lists page
  const fetchLists = useCallback(async () => {
    try {
      setLoadingLists(true)
      // Use the same API call as /dashboard/lists page
      const response = await fetch('/api/lists?includeCount=true', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        console.error('Failed to fetch lists')
        setLists([])
        return
      }

      const data = await response.json()
      // Show all lists (both people and properties) - same as /dashboard/lists
      // Both types can have email addresses for campaigns
      setLists(data.lists || [])
    } catch (err) {
      console.error('Error fetching lists:', err)
      setLists([])
    } finally {
      setLoadingLists(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'lists') {
      fetchLists()
    }
  }, [activeTab, fetchLists])


  // Define fetchListingsFromContacts first since fetchListings uses it
  const fetchListingsFromContacts = useCallback(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setListings([])
        return
      }
      
      // Fallback: Fetch saved listings from contacts table (user's saved listings)
      // Saved listings are stored as contacts with source='listing'
      
      // Step 1: Fetch contacts that are saved listings
      const { data: savedListingContacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, name, address, city, state, zip_code, source_id, source, phone')
        .eq('user_id', user.id)
        .eq('source', 'listing')
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
      
      // Handle error gracefully - if contacts table doesn't exist, return empty list
      if (contactsError) {
        // Check if it's a "table doesn't exist" error
        // Empty error object often means table doesn't exist in Supabase
        const isTableMissing = contactsError.code === 'PGRST116' || 
                               contactsError.code === '42P01' || // PostgreSQL relation does not exist
                               contactsError.message?.includes('does not exist') ||
                               contactsError.message?.includes('relation') ||
                               contactsError.message?.includes('table') ||
                               Object.keys(contactsError).length === 0 || // Empty error object
                               (contactsError.hint && contactsError.hint.includes('relation'))
        
        if (isTableMissing) {
          // Table doesn't exist - silently return empty list (this is expected if contacts table hasn't been created yet)
          setListings([])
          return
        }
        
        // For other unexpected errors, log but don't show to user
        console.warn('Error loading saved listings contacts:', contactsError)
        setListings([])
        return
      }
      
      if (!savedListingContacts || savedListingContacts.length === 0) {
        setListings([])
        return
      }
      
      // Step 2: Extract source_ids (listing IDs) from contacts
      const sourceIds = savedListingContacts
        .map(contact => contact.source_id)
        .filter(Boolean) as string[]
      
      if (sourceIds.length === 0) {
        setListings([])
        return
      }
      
      const uniqueSourceIds = Array.from(new Set(sourceIds))
      
      // Step 3: Query all listing tables to get full listing details
      const tableNames = [
        'listings',
        'expired_listings',
        'fsbo_leads',
        'frbo_leads',
        'imports',
        'foreclosure_listings',
        'probate_leads'
      ]
      
      // Build queries for each table
      const queryPromises = tableNames.map(async (tableName) => {
        try {
          // Query by listing_id
          let queryById = supabase
            .from(tableName)
            .select('listing_id, street, city, state, zip_code, property_url, agent_email, owner_email, agent_name, owner_name, address')
            .in('listing_id', uniqueSourceIds)
          
          // Query by property_url as well (since source_id might be property_url)
          let queryByUrl = supabase
            .from(tableName)
            .select('listing_id, street, city, state, zip_code, property_url, agent_email, owner_email, agent_name, owner_name, address')
            .in('property_url', uniqueSourceIds)
          
          // Only filter by active for listings table
          if (tableName === 'listings') {
            queryById = queryById.eq('active', true)
            queryByUrl = queryByUrl.eq('active', true)
          }
          
          // Execute both queries in parallel
          const [resultById, resultByUrl] = await Promise.all([
            queryById,
            queryByUrl
          ])
          
          const { data: dataById, error: errorById } = resultById
          const { data: dataByUrl, error: errorByUrl } = resultByUrl
          
          // Combine results and handle errors gracefully
          let allData: any[] = []
          
          if (errorById && errorById.code !== 'PGRST116' && !errorById.message?.includes('does not exist')) {
            console.warn(`Error querying ${tableName} by ID:`, errorById.message)
          } else if (dataById) {
            allData = allData.concat(dataById)
          }
          
          if (errorByUrl && errorByUrl.code !== 'PGRST116' && !errorByUrl.message?.includes('does not exist')) {
            console.warn(`Error querying ${tableName} by URL:`, errorByUrl.message)
          } else if (dataByUrl) {
            allData = allData.concat(dataByUrl)
          }
          
          // Handle table not found gracefully
          if ((errorById?.code === 'PGRST116' || errorById?.message?.includes('does not exist')) &&
              (errorByUrl?.code === 'PGRST116' || errorByUrl?.message?.includes('does not exist'))) {
            return { tableName, data: [] }
          }
          
          return { tableName, data: allData || [] }
        } catch (err: any) {
          console.error(`Exception fetching from ${tableName}:`, err)
          return { tableName, data: [] }
        }
      })
      
      // Execute all queries in parallel
      const results = await Promise.allSettled(queryPromises)
      
      // Step 4: Combine results from all tables
      let allListings: any[] = []
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { data } = result.value
          if (data && data.length > 0) {
            allListings = allListings.concat(data)
          }
        }
      })
      
      // Step 5: Create a comprehensive map of listings indexed by both listing_id and property_url
      // This allows us to find listings whether source_id is listing_id or property_url
      const listingsByIdMap = new Map<string, any>()
      const listingsByUrlMap = new Map<string, any>()
      
      allListings.forEach(listing => {
        if (listing.listing_id) {
          listingsByIdMap.set(listing.listing_id, listing)
        }
        if (listing.property_url) {
          // Normalize URL for matching (similar to how it's stored in contacts)
          const normalizedUrl = listing.property_url.toLowerCase().trim()
          listingsByUrlMap.set(normalizedUrl, listing)
        }
      })
      
      // Step 6: Create a map of contacts by source_id for easy lookup
      // Also normalize URLs to match properly
      const contactsMap = new Map<string, any>()
      savedListingContacts.forEach(contact => {
        if (contact.source_id) {
          // Store by original source_id
          contactsMap.set(contact.source_id, contact)
          
          // Also store by normalized URL if it's a URL (for flexible matching)
          if (contact.source_id.includes('http') || contact.source_id.includes('://')) {
            const normalizedUrl = contact.source_id.toLowerCase().trim()
            if (normalizedUrl !== contact.source_id) {
              contactsMap.set(normalizedUrl, contact)
            }
          }
        }
      })
      
      // Step 7: Build a set of all saved listings (combining contacts with listing data)
      const processedListingIds = new Set<string>()
      const savedListings: any[] = []
      
      // First, process all contacts and try to match with listings
      savedListingContacts.forEach(contact => {
        if (!contact.source_id || !contact.email) return
        
        const sourceId = contact.source_id
        const normalizedSourceId = sourceId.toLowerCase().trim()
        
        // Try multiple matching strategies:
        // 1. Direct match by source_id (could be listing_id or property_url)
        let listing = listingsByIdMap.get(sourceId) || listingsByUrlMap.get(sourceId)
        
        // 2. Try normalized URL match
        if (!listing && normalizedSourceId !== sourceId) {
          listing = listingsByUrlMap.get(normalizedSourceId) || listingsByIdMap.get(normalizedSourceId)
        }
        
        // 3. Search all listings for cross-reference match
        // (e.g., contact has listing_id but listing found by property_url, or vice versa)
        if (!listing) {
          // Check if source_id matches any listing's listing_id or property_url
          for (const [listingId, listItem] of listingsByIdMap.entries()) {
            if (listingId === sourceId || listingId === normalizedSourceId ||
                listItem.property_url === sourceId || 
                (listItem.property_url && listItem.property_url.toLowerCase().trim() === normalizedSourceId)) {
              listing = listItem
              break
            }
          }
          // Also check by URL map
          if (!listing) {
            for (const [url, listItem] of listingsByUrlMap.entries()) {
              if (url === sourceId || url === normalizedSourceId ||
                  listItem.listing_id === sourceId) {
                listing = listItem
                break
              }
            }
          }
        }
        
        // If we found a listing, merge contact data with listing data
        if (listing) {
          const listingId = listing.listing_id || listing.property_url || sourceId
          
          // Skip if already processed
          if (processedListingIds.has(listingId)) return
          processedListingIds.add(listingId)
          
          // Merge contact data (email/name) with listing data (address)
          const email = contact.email || listing.agent_email || listing.owner_email
          if (!email) return // Skip if no email
          
          const name = contact.first_name && contact.last_name
            ? `${contact.first_name} ${contact.last_name}`
            : contact.first_name || contact.last_name || contact.name || listing.agent_name || listing.owner_name || 'Unknown'
          
          savedListings.push({
            listing_id: listingId,
            id: listingId,
            address: listing.street || listing.address || contact.address || (listing.city && listing.state 
              ? `${listing.city}, ${listing.state}` 
              : contact.city && contact.state ? `${contact.city}, ${contact.state}` : 'Address not available'),
            street: listing.street || listing.address || contact.address,
            city: listing.city || contact.city,
            state: listing.state || contact.state,
            zip_code: listing.zip_code || contact.zip_code,
            agent_email: email,
            owner_email: email,
            agent_name: name,
            owner_name: name,
          })
        } else {
          // Listing not found in tables, but we have contact data - use contact data only
          // This handles cases where listings were saved but might not be in the listing tables anymore
          const listingId = sourceId
          
          // Skip if already processed
          if (processedListingIds.has(listingId)) return
          processedListingIds.add(listingId)
          
          const email = contact.email
          if (!email) return // Skip if no email
          
          const name = contact.first_name && contact.last_name
            ? `${contact.first_name} ${contact.last_name}`
            : contact.first_name || contact.last_name || contact.name || 'Unknown'
          
          savedListings.push({
            listing_id: listingId,
            id: listingId,
            address: contact.address || (contact.city && contact.state 
              ? `${contact.city}, ${contact.state}` 
              : 'Address not available'),
            street: contact.address,
            city: contact.city,
            state: contact.state,
            zip_code: contact.zip_code,
            agent_email: email,
            owner_email: email,
            agent_name: name,
            owner_name: name,
          })
        }
      })
      
      setListings(savedListings)
      setListingsTotalCount(savedListings.length)
      setListingsTotalPages(1)
    } catch (err) {
      console.error('Error loading saved listings:', err)
      setListings([])
      setListingsTotalCount(0)
      setListingsTotalPages(0)
    } finally {
      setLoadingListings(false)
    }
  }, [supabase])

  const fetchListings = useCallback(async () => {
    try {
      setLoadingListings(true)
      
      // Use paginated endpoint similar to lists detail page
      const params = new URLSearchParams({
        page: listingsCurrentPage.toString(),
        pageSize: listingsPageSize.toString(),
        sortBy: 'created_at',
        sortOrder: 'desc'
      })

      const response = await fetch(`/api/campaigns/${campaignId}/listings/paginated?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        // If paginated endpoint fails, fall back to non-paginated
        console.warn('Paginated endpoint failed, trying fallback')
        try {
          const fallbackResponse = await fetch(`/api/campaigns/${campaignId}/listings`)
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json()
            if (fallbackData.listings && fallbackData.listings.length > 0) {
              const formattedListings = fallbackData.listings.map((listing: any) => ({
                listing_id: listing.listing_id,
                id: listing.listing_id,
                address: listing.street || listing.address || (listing.city && listing.state 
                  ? `${listing.city}, ${listing.state}` 
                  : 'Address not available'),
                street: listing.street || listing.address,
                city: listing.city,
                state: listing.state,
                zip_code: listing.zip_code,
                agent_email: listing.agent_email,
                owner_email: listing.owner_email,
                agent_name: listing.agent_name,
                owner_name: listing.owner_name,
              }))
              setListings(formattedListings)
              setListingsTotalCount(formattedListings.length)
              setListingsTotalPages(1)
              return
            }
          }
        } catch (fallbackErr) {
          console.warn('Fallback also failed:', fallbackErr)
        }
        
        // If both fail, try contacts fallback
        await fetchListingsFromContacts()
        return
      }

      const data = await response.json()
      
      // Format listings for display
      const formattedListings = (data.data || []).map((listing: any) => ({
        listing_id: listing.listing_id,
        id: listing.listing_id,
        address: listing.street || listing.address || (listing.city && listing.state 
          ? `${listing.city}, ${listing.state}` 
          : 'Address not available'),
        street: listing.street || listing.address,
        city: listing.city,
        state: listing.state,
        zip_code: listing.zip_code,
        agent_email: listing.agent_email,
        owner_email: listing.owner_email,
        agent_name: listing.agent_name,
        owner_name: listing.owner_name,
      }))
      
      setListings(formattedListings)
      setListingsTotalCount(data.totalCount || data.count || 0)
      setListingsTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error('Error fetching campaign listings:', err)
      // Fallback to contacts
      await fetchListingsFromContacts()
    } finally {
      setLoadingListings(false)
    }
  }, [campaignId, listingsCurrentPage, fetchListingsFromContacts])

  // Fetch listings when tab becomes active or pagination/search changes
  useEffect(() => {
    if (activeTab === 'listings') {
      fetchListings()
    }
  }, [activeTab, fetchListings])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      let recipients: Recipient[] = []

      if (activeTab === 'manual') {
        recipients = manualRecipients.filter(r => r.email && r.email.includes('@'))
        if (recipients.length === 0) {
          throw new Error('Please add at least one recipient with a valid email')
        }
      } else if (activeTab === 'lists') {
        if (selectedLists.size === 0) {
          throw new Error('Please select at least one list')
        }

        // Fetch all items from selected lists
        const allRecipients: Recipient[] = []
        const allListingIds: string[] = []
        const processedEmails = new Set<string>() // Deduplicate by email

        for (const listId of Array.from(selectedLists)) {
          try {
            // Use paginated endpoint to get all items (both listings and contacts)
            // Fetch in batches if needed, but start with a large page size
            let page = 1
            let hasMore = true
            const pageSize = 1000

            while (hasMore) {
              const response = await fetch(`/api/lists/${listId}/paginated?page=${page}&pageSize=${pageSize}`, {
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                }
              })

              if (!response.ok) {
                console.warn(`Failed to fetch items from list ${listId}, page ${page}`)
                break
              }

              const data = await response.json()
              const listItems = data.data || []

              if (listItems.length === 0) {
                hasMore = false
                break
              }

              // Process both listings and contacts
              for (const item of listItems) {
                // Get email from various possible fields
                const email = (
                  item.email || 
                  item.agent_email || 
                  item.owner_email || 
                  ''
                ).toLowerCase().trim()

                // Skip if no email or already processed
                if (!email || !email.includes('@') || processedEmails.has(email)) {
                  continue
                }

                processedEmails.add(email)

                // Extract name - handle both listing and contact formats
                let firstName = ''
                let lastName = ''
                let company = ''

                if (item._item_type === 'contact' || item.contact_id) {
                  // Contact format
                  firstName = item.first_name || ''
                  lastName = item.last_name || ''
                  company = item.company || ''
                } else {
                  // Listing format
                  const nameParts = (item.agent_name || item.owner_name || '').split(' ')
                  firstName = nameParts[0] || ''
                  lastName = nameParts.slice(1).join(' ') || ''
                  company = ''
                }

                allRecipients.push({
                  email,
                  firstName,
                  lastName,
                  company
                })

                // Collect listing IDs for campaign_listings (only for actual listings)
                if (item._item_type === 'listing' || (!item._item_type && item.listing_id)) {
                  const listingId = item.listing_id || item.property_url
                  if (listingId && !listingId.startsWith('contact-')) {
                    allListingIds.push(listingId)
                  }
                }
              }

              // Check if there are more pages
              hasMore = data.hasNextPage === true
              page++
            }
          } catch (err) {
            console.error(`Error fetching items from list ${listId}:`, err)
          }
        }

        if (allRecipients.length === 0) {
          throw new Error('No valid recipients found in selected lists. Make sure the lists contain items with email addresses.')
        }

        recipients = allRecipients

        // Save listing IDs to campaign_listings
        if (allListingIds.length > 0) {
          try {
            await fetch(`/api/campaigns/${campaignId}/listings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listingIds: allListingIds })
            })
          } catch (err) {
            console.warn('Failed to save listings to campaign_listings:', err)
            // Don't throw - this is not critical, recipients are still being added
          }
        }
      } else if (activeTab === 'csv') {
        recipients = csvPreview
        if (recipients.length === 0) {
          throw new Error('No valid recipients found in CSV')
        }
      } else if (activeTab === 'contacts') {
        const selected = contacts.filter(c => selectedContacts.has(c.id))
        recipients = selected.map(c => ({
          email: c.email,
          firstName: c.first_name || '',
          lastName: c.last_name || '',
          company: c.company || ''
        }))
        if (recipients.length === 0) {
          throw new Error('Please select at least one contact')
        }
      } else if (activeTab === 'listings') {
        const selected = listings.filter(l => selectedListings.has(l.listing_id || l.id))
        recipients = selected
          .filter(l => l.agent_email || l.owner_email)
          .map(l => {
            const email = (l.agent_email || l.owner_email || '').toLowerCase()
            const nameParts = (l.agent_name || l.owner_name || '').split(' ')
            return {
              email,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              company: ''
            }
          })
        if (recipients.length === 0) {
          throw new Error('Please select at least one listing with an email')
        }
        
        // Also save listing IDs to campaign_listings
        const listingIds = selected.map(l => l.listing_id || l.id).filter(Boolean)
        if (listingIds.length > 0) {
          try {
            await fetch(`/api/campaigns/${campaignId}/listings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listingIds })
            })
          } catch (err) {
            console.warn('Failed to save listings to campaign_listings:', err)
            // Don't throw - this is not critical, recipients are still being added
          }
        }
      }

      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: recipients.map(r => ({
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            company: r.company
          }))
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add recipients')
      }

      const data = await response.json()
      onSuccess()
      alert(`Successfully added ${data.added || recipients.length} recipient(s)`)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to add recipients')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Leads</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('lists')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'lists'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Lists
            </button>
            <button
              onClick={() => setActiveTab('csv')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'csv'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              CSV Upload
            </button>
            <button
              onClick={() => {
                setActiveTab('contacts')
                if (contacts.length === 0) fetchContacts()
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contacts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Contacts
            </button>
            <button
              onClick={() => {
                setActiveTab('listings')
                if (listings.length === 0) {
                  fetchListings()
                }
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'listings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Listings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Manual Entry */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {manualRecipients.map((recipient, index) => (
                  <div key={index} className="grid grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={recipient.email}
                        onChange={(e) => handleManualChange(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={recipient.firstName}
                        onChange={(e) => handleManualChange(index, 'firstName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={recipient.lastName}
                        onChange={(e) => handleManualChange(index, 'lastName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company
                      </label>
                      <input
                        type="text"
                        value={recipient.company}
                        onChange={(e) => handleManualChange(index, 'company', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Company Inc"
                      />
                    </div>
                    <div className="flex items-end">
                      {manualRecipients.length > 1 && (
                        <button
                          onClick={() => handleRemoveManualRow(index)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddManualRow}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add Another
              </button>
            </div>
          )}

          {/* Lists */}
          {activeTab === 'lists' && (
            <div className="space-y-4">
              {loadingLists ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : lists.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">
                    No lists found. Create a list first.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedLists.size === lists.length && lists.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLists(new Set(lists.map(l => l.id)))
                                } else {
                                  setSelectedLists(new Set())
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">List Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Items</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {lists.map((list) => (
                            <tr key={list.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedLists.has(list.id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedLists)
                                    if (e.target.checked) {
                                      newSelected.add(list.id)
                                    } else {
                                      newSelected.delete(list.id)
                                    }
                                    setSelectedLists(newSelected)
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">
                                {list.name}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {list.item_count || 0}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400 capitalize">
                                {list.type}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedLists.size > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedLists.size} list{selectedLists.size > 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          )}

          {/* CSV Upload */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {csvFile ? csvFile.name : 'Click to upload CSV file'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      CSV should have columns: email, first_name (optional), last_name (optional), company (optional)
                    </span>
                  </label>
                </div>
              </div>

              {csvPreview.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview ({csvPreview.length} recipients)
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {csvPreview.slice(0, 10).map((r, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 text-gray-900 dark:text-white">{r.email}</td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {r.firstName} {r.lastName}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.company}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreview.length > 10 && (
                        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                          ... and {csvPreview.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contacts */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">No contacts found</p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedContacts.size === contacts.length && contacts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedContacts(new Set(contacts.map(c => c.id)))
                                } else {
                                  setSelectedContacts(new Set())
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {contacts.map((contact: any) => (
                          <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedContacts.has(contact.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedContacts)
                                  if (e.target.checked) {
                                    newSelected.add(contact.id)
                                  } else {
                                    newSelected.delete(contact.id)
                                  }
                                  setSelectedContacts(newSelected)
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{contact.email}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {contact.first_name || contact.name || ''} {contact.last_name || ''}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {contact.formatted_address || contact.street || contact.address || 
                               (contact.city && contact.state 
                                 ? `${contact.city}, ${contact.state}${contact.zip_code ? ' ' + contact.zip_code : ''}`.trim()
                                 : '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Listings */}
          {activeTab === 'listings' && (
            <div className="space-y-4">
              {loadingListings ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">
                    No listings saved to this campaign yet
                  </p>
                </div>
              ) : (
                <>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="max-h-[60vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-2 text-left">
                              <input
                                type="checkbox"
                                checked={selectedListings.size === listings.filter(l => l.agent_email || l.owner_email).length && listings.length > 0}
                                onChange={(e) => {
                                  const withEmail = listings.filter(l => l.agent_email || l.owner_email)
                                  if (e.target.checked) {
                                    setSelectedListings(new Set(withEmail.map(l => l.listing_id || l.id)))
                                  } else {
                                    setSelectedListings(new Set())
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                              />
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Address</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {listings
                            .filter(l => l.agent_email || l.owner_email)
                            .map((listing) => {
                              const listingId = listing.listing_id || listing.id
                              return (
                                <tr key={listingId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-4 py-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedListings.has(listingId)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedListings)
                                        if (e.target.checked) {
                                          newSelected.add(listingId)
                                        } else {
                                          newSelected.delete(listingId)
                                        }
                                        setSelectedListings(newSelected)
                                      }}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                                    {listing.address || listing.street || '-'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                    {listing.agent_email || listing.owner_email || '-'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                    {listing.agent_name || listing.owner_name || '-'}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {listingsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Showing {(listingsCurrentPage - 1) * listingsPageSize + 1} to {Math.min(listingsCurrentPage * listingsPageSize, listingsTotalCount)} of {listingsTotalCount} listings
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setListingsCurrentPage(p => Math.max(1, p - 1))}
                          disabled={listingsCurrentPage === 1}
                          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Page {listingsCurrentPage} of {listingsTotalPages}
                        </span>
                        <button
                          onClick={() => setListingsCurrentPage(p => Math.min(listingsTotalPages, p + 1))}
                          disabled={listingsCurrentPage === listingsTotalPages}
                          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Leads
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
