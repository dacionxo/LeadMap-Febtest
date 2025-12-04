'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/app/providers'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Navigation from './Navigation'
import LeadsTable from './LeadsTable'
import MapView from './MapView'
import TrialExpired from './TrialExpired'
import EmailTemplateModal from './EmailTemplateModal'
import { postEnrichLeads } from '@/lib/api'

interface Listing {
  listing_id: string
  property_url: string
  street?: string | null
  unit?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  list_price?: number | null
  list_price_min?: number | null
  list_price_max?: number | null
  beds?: number | null
  full_baths?: number | null
  sqft?: number | null
  status?: string | null
  agent_name?: string | null
  agent_email?: string | null
  agent_phone?: string | null
  active?: boolean
  last_scraped_at?: string | null
  created_at?: string
  lat?: number | null
  lng?: number | null
}

type FilterType = 'all' | 'expired' | 'probate' | 'geo' | 'enriched'

// Type for MapboxView Lead interface - must match exactly
interface MapLead {
  id: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  price_drop_percent: number
  days_on_market: number
  url: string
  latitude?: number
  longitude?: number
  property_type?: string
  beds?: number
  sqft?: number
  year_built?: number
  description?: string
  agent_name?: string
  agent_email?: string
  primary_photo?: string
  expired?: boolean
  geo_source?: string | null
  owner_email?: string
  enrichment_confidence?: number | null
}

// Helper function to transform Listing to MapLead
function transformListingToLead(listing: Listing): MapLead {
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
    address: listing.street || 'Address not available',
    city: listing.city || '',
    state: listing.state || '',
    zip: listing.zip_code || '',
    price: listing.list_price || 0,
    price_drop_percent: priceDropPercent,
    days_on_market: daysOnMarket,
    url: listing.property_url || '',
    latitude: listing.lat ? Number(listing.lat) : undefined,
    longitude: listing.lng ? Number(listing.lng) : undefined,
    property_type: undefined,
    beds: listing.beds ?? undefined,
    sqft: listing.sqft ?? undefined,
    year_built: listing.year_built ?? undefined,
    description: listing.text || undefined,
    agent_name: listing.agent_name ?? undefined,
    agent_email: listing.agent_email ?? undefined,
    primary_photo: undefined,
    expired: !listing.active,
    geo_source: listing.listing_source_name || null,
    owner_email: undefined,
    enrichment_confidence: null
  }
}

export default function Dashboard() {
  const { user, profile, loading } = useApp()
  const [activeTab, setActiveTab] = useState<'table' | 'map'>('table')
  const [filter, setFilter] = useState<FilterType>('all')
  const [listings, setListings] = useState<Listing[]>([])
  const [probateLeads, setProbateLeads] = useState<any[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Listing | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const supabase = createClientComponentClient()

  const handleEnrich = async (listingId: string) => {
    try {
      await postEnrichLeads([listingId])
      fetchListings()
      alert('Lead enriched successfully!')
    } catch (error) {
      console.error('Enrich error:', error)
      alert('Failed to enrich lead')
    }
  }

  const handleGenerateEmail = (lead: Listing) => {
    setSelectedLead(lead)
    setShowEmailModal(true)
  }


  const fetchListings = useCallback(async () => {
    try {
      setListingsLoading(true)
      
      let data: any[] = []
      let error: any = null

      // Fetch based on filter
      if (filter === 'expired') {
        const response = await fetch('/api/leads/expired')
        const result = await response.json()
        data = result.leads || []
      } else if (filter === 'probate') {
        const response = await fetch('/api/probate-leads')
        const result = await response.json()
        setProbateLeads(result.leads || [])
        data = [] // Show in separate section
      } else if (filter === 'geo') {
        const { data: geoData, error: geoError } = await supabase
          .from('listings')
          .select('*')
          .not('city', 'is', null)
          .not('state', 'is', null)
          .order('created_at', { ascending: false })
        data = geoData || []
        error = geoError
      } else if (filter === 'enriched') {
        const { data: enrichedData, error: enrichedError } = await supabase
          .from('listings')
          .select('*')
          .or('agent_email.not.is.null,agent_phone.not.is.null,agent_name.not.is.null')
          .order('created_at', { ascending: false })
        data = enrichedData || []
        error = enrichedError
      } else {
        // All leads
        const { data: allData, error: allError } = await supabase
          .from('listings')
          .select('*')
          .order('created_at', { ascending: false })
        data = allData || []
        error = allError
      }

      if (error) throw error
      setListings(data)
      
      // Get the most recent last_scraped_at timestamp
      if (data && data.length > 0) {
        const mostRecent = data.reduce((latest, listing) => {
          const listingDate = listing.last_scraped_at ? new Date(listing.last_scraped_at) : null
          const latestDate = latest.last_scraped_at ? new Date(latest.last_scraped_at) : null
          if (!listingDate) return latest
          if (!latestDate) return listing
          return listingDate > latestDate ? listing : latest
        })
        
        if (mostRecent.last_scraped_at) {
          setLastUpdated(mostRecent.last_scraped_at)
        }
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      setListingsLoading(false)
    }
  }, [supabase, filter])

  useEffect(() => {
    if (profile) {
      fetchListings()
    }
  }, [profile?.id, filter, fetchListings])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-300 mb-4">Loading profile...</p>
          <p className="text-sm text-gray-400">
            If this takes too long, please check the browser console for errors.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // Check if trial has expired
  // BYPASSED FOR DEVELOPMENT - Trial check disabled
  // const trialEnd = new Date(profile.trial_end)
  // const now = new Date()
  // const isTrialExpired = !profile.is_subscribed && now > trialEnd

  // if (isTrialExpired) {
  //   return <TrialExpired />
  // }
  
  // Always allow access (development mode)
  const isTrialExpired = false

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-2">
              {(['all', 'expired', 'probate', 'geo', 'enriched'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize ${
                    filter === f
                      ? 'bg-gray-800 text-white border-b-2 border-primary-500'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {f === 'all' ? 'All Leads' : f}
                </button>
              ))}
            </div>
            {lastUpdated && (
              <div className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Showing {listings.length} {filter === 'all' ? 'leads' : filter + ' leads'}
          </div>
        </div>

        {/* Tab Navigation (Table/Map) */}
        <div className="mb-8">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('table')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'table'
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Leads Table
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'map'
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Map View
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'table' ? (
          <LeadsTable 
            listings={listings} 
            loading={listingsLoading}
            onRefresh={fetchListings}
            onEnrich={handleEnrich}
            onGenerateEmail={handleGenerateEmail}
          />
        ) : (
          <MapView 
            isActive={activeTab === 'map'}
            listings={listings.map(transformListingToLead)}
            loading={listingsLoading}
          />
        )}
      </div>

      {/* Email Template Modal */}
      {showEmailModal && selectedLead && (
        <EmailTemplateModal
          lead={selectedLead}
          onClose={() => {
            setShowEmailModal(false)
            setSelectedLead(null)
          }}
        />
      )}
    </div>
  )
}
