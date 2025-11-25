'use client'

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useApp } from '@/app/providers'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import LeadsTable from '@/components/LeadsTable'
import GoogleMapsView from '@/components/GoogleMapsView'
import EmailTemplateModal from '@/components/EmailTemplateModal'
import { postEnrichLeads } from '@/lib/api'
import { Search, Filter, Download } from 'lucide-react'

interface Listing {
  listing_id: string
  property_url: string
  permalink?: string | null
  scrape_date?: string | null
  last_scraped_at?: string | null
  active?: boolean
  street?: string | null
  unit?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  beds?: number | null
  full_baths?: number | null
  half_baths?: number | null
  sqft?: number | null
  year_built?: number | null
  list_price?: number | null
  list_price_min?: number | null
  list_price_max?: number | null
  status?: string | null
  mls?: string | null
  agent_name?: string | null
  agent_email?: string | null
  agent_phone?: string | null
  photos?: string | null
  photos_json?: any
  other?: any
  price_per_sqft?: number | null
  listing_source_name?: string | null
  listing_source_id?: string | null
  monthly_payment_estimate?: string | null
  ai_investment_score?: number | null
  time_listed?: string | null
  created_at?: string
  updated_at?: string
}

type FilterType = 'all' | 'expired' | 'probate' | 'geo' | 'enriched'
type ViewType = 'table' | 'map' | 'analytics'

function LeadsPageContent() {
  const { profile } = useApp()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeView, setActiveView] = useState<ViewType>('table')
  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get('filter') as FilterType) || 'all'
  )
  const [listings, setListings] = useState<Listing[]>([])
  const [probateLeads, setProbateLeads] = useState<any[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Listing | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClientComponentClient(), [])
  
  // Track if fetch is in progress to prevent loops
  const fetchingRef = useRef(false)

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
    // Prevent concurrent fetches
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    try {
      setListingsLoading(true)
      
      let data: any[] = []
      let error: any = null

      if (filter === 'expired') {
        // Filter for expired listings (status contains "Expired" or similar)
        const { data: expiredData, error: expiredError } = await supabase
          .from('listings')
          .select('*')
          .or('status.ilike.%expired%,status.ilike.%sold%,status.ilike.%off market%')
          .order('created_at', { ascending: false })
        data = expiredData || []
        error = expiredError
      } else if (filter === 'probate') {
        const response = await fetch('/api/probate-leads')
        const result = await response.json()
        setProbateLeads(result.leads || [])
        data = []
      } else if (filter === 'geo') {
        // Filter for listings with location data
        const { data: geoData, error: geoError } = await supabase
          .from('listings')
          .select('*')
          .not('city', 'is', null)
          .not('state', 'is', null)
          .order('created_at', { ascending: false })
        data = geoData || []
        error = geoError
      } else if (filter === 'enriched') {
        // Filter for listings with agent contact info
        const { data: enrichedData, error: enrichedError } = await supabase
          .from('listings')
          .select('*')
          .or('agent_email.not.is.null,agent_phone.not.is.null,agent_name.not.is.null')
          .order('created_at', { ascending: false })
        data = enrichedData || []
        error = enrichedError
      } else {
        const { data: allData, error: allError } = await supabase
          .from('listings')
          .select('*')
          .order('created_at', { ascending: false })
        data = allData || []
        error = allError
      }

      if (error) throw error
      setListings(data)
      
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
      fetchingRef.current = false
    }
  }, [supabase, filter])

  useEffect(() => {
    if (profile?.id && !fetchingRef.current) {
      fetchListings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, filter]) // Remove fetchListings from deps to prevent loops

  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam === 'map') {
      setActiveView('map')
    }
  }, [searchParams])

  const handleExportCSV = () => {
    const headers = ['Listing ID', 'Property URL', 'Street', 'Unit', 'City', 'State', 'Zip Code', 'List Price', 'Beds', 'Baths', 'Sqft', 'Status', 'Agent Name', 'Agent Email', 'Agent Phone', 'MLS']
    const rows = listings.map(l => [
      l.listing_id || '',
      l.property_url || '',
      l.street || '',
      l.unit || '',
      l.city || '',
      l.state || '',
      l.zip_code || '',
      (l.list_price || 0).toString(),
      (l.beds || '').toString(),
      (l.full_baths || '').toString(),
      (l.sqft || '').toString(),
      l.status || '',
      l.agent_name || '',
      l.agent_email || '',
      l.agent_phone || '',
      l.mls || ''
    ])
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${filter}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            {(['all', 'expired', 'probate', 'geo', 'enriched'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f)
                  router.push(`/dashboard/leads?filter=${f}`)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors duration-200 ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'All Leads' : f}
              </button>
            ))}
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {listings.length} {filter === 'all' ? 'leads' : filter + ' leads'}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* View Tabs */}
      <div>
        <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveView('table')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-200 ${
              activeView === 'table'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-200 ${
              activeView === 'map'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Map View
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-200 ${
              activeView === 'analytics'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="mt-6">
        {activeView === 'table' && (
          <LeadsTable 
            listings={listings.filter(l => {
              // Filter by search term (street or city) - using 'street' property, not 'address'
              const matchesSearch = !searchTerm || 
                (l.street?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                (l.city?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
              // Filter by status (active/expired)
              const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && l.active) ||
                (statusFilter === 'expired' && !l.active)
              return matchesSearch && matchesStatus
            })}
            loading={listingsLoading}
            onRefresh={fetchListings}
            onEnrich={handleEnrich}
            onGenerateEmail={handleGenerateEmail}
          />
        )}
        {activeView === 'map' && (
          <GoogleMapsView 
            isActive={activeView === 'map'}
            listings={listings.map((l): {
              id: string;
              address: string;
              city: string;
              state: string;
              zip: string;
              price: number;
              price_drop_percent: number;
              days_on_market: number;
              url: string;
              latitude?: number;
              longitude?: number;
              beds?: number;
              sqft?: number;
              year_built?: number;
              agent_name?: string;
              agent_email?: string;
              expired?: boolean;
              geo_source?: string | null;
              enrichment_confidence?: number | null;
            } => ({
              id: l.listing_id,
              address: l.street || '',
              city: l.city || '',
              state: l.state || '',
              zip: l.zip_code || '',
              price: l.list_price || 0,
              price_drop_percent: 0, // Not available in Listing type
              days_on_market: 0, // Not available in Listing type
              url: l.property_url || '',
              latitude: l.lat || undefined,
              longitude: l.lng || undefined,
              beds: l.beds || undefined,
              sqft: l.sqft || undefined,
              year_built: l.year_built || undefined,
              agent_name: l.agent_name || undefined,
              agent_email: l.agent_email || undefined,
              expired: !l.active,
              geo_source: null,
              enrichment_confidence: null
            }))}
            loading={listingsLoading}
          />
        )}
        {activeView === 'analytics' && (
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">Analytics view coming soon...</p>
          </div>
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

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading leads...</p>
        </div>
      </div>
    }>
      <LeadsPageContent />
    </Suspense>
  )
}

