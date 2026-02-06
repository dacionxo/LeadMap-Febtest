'use client'

import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import MapView from '@/components/MapView'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useApp } from '@/app/providers'
import MapsOnboardingModal from './components/MapsOnboardingModal'

const LeadDetailModal = lazy(() => import('../prospect-enrich/components/LeadDetailModal'))

interface Listing {
  listing_id: string
  address?: string
  street?: string
  unit?: string
  city?: string
  state?: string
  zip?: string
  zip_code?: string
  price?: number
  list_price?: number
  list_price_min?: number
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  property_type?: string
  beds?: number
  baths?: number
  sqft?: number
  year_built?: number
  expired?: boolean
  geo_source?: string | null
  listing_source_name?: string | null
  owner_email?: string
  enrichment_confidence?: number | null
  primary_photo?: string
  url?: string
  property_url?: string
  text?: string
  description?: string
  agent_name?: string
  agent_email?: string
  time_listed?: string
  created_at?: string
}

export default function MapPage() {
  const { profile } = useApp()
  const supabase = useMemo(() => createClientComponentClient(), [])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.id) {
      fetchListings()
      checkOnboardingStatus()
    }
  }, [profile?.id])

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/maps/onboarding-status', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setShowOnboarding(!data.completed)
      } else {
        setShowOnboarding(true)
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      setShowOnboarding(true)
    }
  }

  const handleBeginSetup = async () => {
    try {
      const response = await fetch('/api/maps/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (response.ok) {
        setShowOnboarding(false)
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  const handleMaybeLater = () => {
    setShowOnboarding(false)
  }

  const fetchListings = async () => {
    try {
      setLoading(true)
      
      // Fetch from all prospect tables (same as prospect-enrich page)
      const tablesToFetch = [
        'listings',
        'expired_listings',
        'probate_leads',
        'fsbo_leads',
        'frbo_leads',
        'imports',
        'trash',
        'foreclosure_listings'
      ]

      // Fetch in parallel with error handling
      const promises = tablesToFetch.map(async (table) => {
        try {
          const result = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2000) // Increased limit for map view
        
          if (result.error) {
            console.warn(`Error fetching from ${table}:`, result.error)
            return []
          }
          return result.data || []
        } catch (error) {
          console.warn(`Exception fetching from ${table}:`, error)
          return []
        }
      })

      const results = await Promise.allSettled(promises)
      
      // Aggregate all successful results
      const allListings: Listing[] = []
      results.forEach((result) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allListings.push(...result.value)
        }
      })

      setListings(allListings)
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Convert listings to leads format for MapView
  const leads = useMemo(() => {
    return listings.map(listing => {
      // Build address from multiple possible fields
      const hasValue = (val: any): boolean => val != null && String(val).trim().length > 0
      
      // Try address field first, then street, then build from parts
      let address = listing.address || listing.street || ''
      
      // If no direct address field, try to build from parts
      if (!address || address.trim() === '') {
        const addressParts = [
          listing.street,
          listing.unit
        ].filter(val => hasValue(val))
          .map(val => String(val).trim())
        
        if (addressParts.length > 0) {
          address = addressParts.join(' ')
        }
      }
      
      // Build full address string for display
      const city = listing.city || ''
      const state = listing.state || ''
      const zip = listing.zip || listing.zip_code || ''
      
      // If we have city/state/zip but no street address, show location info
      const locationInfo = [city, state, zip].filter(val => hasValue(val)).join(', ')
      
      // Calculate price drop percentage
      let priceDropPercent = 0
      if (listing.list_price_min && listing.list_price && listing.list_price_min > listing.list_price) {
        priceDropPercent = ((listing.list_price_min - listing.list_price) / listing.list_price_min) * 100
      }

      // Calculate days on market
      let daysOnMarket = 0
      if (listing.time_listed) {
        daysOnMarket = parseInt(listing.time_listed) || 0
      } else if (listing.created_at) {
        const createdDate = new Date(listing.created_at)
        const now = new Date()
        daysOnMarket = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      }
      
      return {
        id: listing.listing_id || listing.property_url || '',
        address: address || (locationInfo ? `Property in ${locationInfo}` : 'Address not available'),
        city: city,
        state: state,
        zip: zip,
        price: listing.price || listing.list_price || 0,
        price_drop_percent: priceDropPercent,
        days_on_market: daysOnMarket,
        url: listing.url || listing.property_url || '',
        latitude: listing.latitude || (listing.lat ? Number(listing.lat) : undefined),
        longitude: listing.longitude || (listing.lng ? Number(listing.lng) : undefined),
        property_type: listing.property_type,
        beds: listing.beds,
        sqft: listing.sqft,
        year_built: listing.year_built,
        description: listing.text || listing.description,
        agent_name: listing.agent_name,
        agent_email: listing.agent_email,
        expired: listing.expired,
        geo_source: listing.geo_source || listing.listing_source_name,
        owner_email: listing.owner_email,
        enrichment_confidence: listing.enrichment_confidence,
        primary_photo: listing.primary_photo
      }
    })
  }, [listings])

  // Handle Street View click from map
  const handleStreetViewClick = (leadId: string) => {
    setSelectedListingId(leadId)
  }

  // Close property detail modal
  const handleCloseModal = () => {
    setSelectedListingId(null)
  }

  return (
    <DashboardLayout hideHeader fullBleed>
      <div className="flex flex-col h-full w-full min-h-0 bg-white dark:bg-gray-900">
        {/* Main Content Area - Map and Sidebar (full screen) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Map Section - full screen */}
          <div className="flex-1 relative">
            {/* Map Component - full screen */}
            <div className="w-full h-full">
              <MapView
                isActive={true}
                listings={leads}
                loading={loading}
                onStreetViewListingClick={handleStreetViewClick}
                fullScreen
              />
            </div>
          </div>
        </div>

        {/* Onboarding Modal */}
        {showOnboarding && (
          <MapsOnboardingModal
            isOpen={showOnboarding}
            onClose={handleMaybeLater}
            onBeginSetup={handleBeginSetup}
            onMaybeLater={handleMaybeLater}
          />
        )}

        {/* Property Detail Modal with Street View */}
        {selectedListingId && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="text-white">Loading...</div>
            </div>
          }>
            <LeadDetailModal
              listingId={selectedListingId}
              listingList={listings}
              onClose={handleCloseModal}
            />
          </Suspense>
        )}
      </div>
    </DashboardLayout>
  )
}
