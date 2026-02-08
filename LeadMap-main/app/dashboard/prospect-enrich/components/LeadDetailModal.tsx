'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  X, ChevronLeft, ChevronRight, User, Tag, List,
  Share2, Heart, Mail, Phone, Info, Activity, ChevronDown, Home, Check,
  ExternalLink, Plus, Minus, Maximize2, Compass, MapPin
} from 'lucide-react'
import OwnerSelector from './OwnerSelector'
import ListsManager from './ListsManager'
import TagsInput from './TagsInput'
import PipelineDropdown from './PipelineDropdown'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { geocodeAddress, buildAddressString } from '@/lib/utils/geocoding'

// Helper function to format bathroom count with proper decimal display
function formatBaths(baths: number | null | undefined): string {
  if (baths === null || baths === undefined) return '--'
  // Convert to number if it's a string
  const numBaths = typeof baths === 'string' ? parseFloat(baths) : baths
  if (isNaN(numBaths)) return '--'
  // Remove trailing zeros for whole numbers, keep decimals for fractional values
  return numBaths % 1 === 0 ? numBaths.toString() : numBaths.toFixed(1)
}

type TabType = 'info' | 'comps' | 'mail' | 'activity'

interface Listing {
  listing_id: string
  property_url?: string | null
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
  agent_phone_2?: string | null
  listing_agent_phone_2?: string | null
  listing_agent_phone_5?: string | null
  text?: string | null
  last_sale_price?: number | null
  last_sale_date?: string | null
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
  in_crm?: boolean
  owner_id?: string | null
  tags?: string[] | null
  lists?: string[] | null
  pipeline_status?: string | null
  lat?: number | null
  lng?: number | null
  // Compatibility fields for probate_leads (which uses latitude/longitude)
  latitude?: number | null
  longitude?: number | null
}

interface LeadDetailModalProps {
  listingId: string | null
  listingList: Listing[] // Array of all listings for pagination
  onClose: () => void
  onUpdate?: (updatedListing: Listing) => void
}

export default function LeadDetailModal({
  listingId,
  listingList,
  onClose,
  onUpdate
}: LeadDetailModalProps) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [isFavorite, setIsFavorite] = useState(false)
  const [showOwnerSelector, setShowOwnerSelector] = useState(false)
  const [showListsManager, setShowListsManager] = useState(false)
  const [showTagsInput, setShowTagsInput] = useState(false)
  const supabase = createClientComponentClient()

  // Use listing from listingList directly for instant load, only fetch if needed for updates
  useEffect(() => {
    if (!listingId) return
    
    const index = listingList.findIndex(l => l.listing_id === listingId)
    if (index >= 0) {
      setCurrentIndex(index)
      // Use the listing from the list directly - no need to fetch
      setListing(listingList[index])
    }
  }, [listingId, listingList])

  const fetchListing = useCallback(async (id: string) => {
    // Only fetch if we need fresh data (e.g., after updates)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('listing_id', id)
        .single()

      if (error) {
        console.error('Error fetching listing:', error)
        // Fallback to listing from list if fetch fails
        const fallbackListing = listingList.find(l => l.listing_id === id)
        setListing(fallbackListing || null)
      } else {
        setListing(data)
      }
    } catch (err) {
      console.error('Error:', err)
      // Fallback to listing from list if fetch fails
      const fallbackListing = listingList.find(l => l.listing_id === id)
      setListing(fallbackListing || null)
    } finally {
      setLoading(false)
    }
  }, [supabase, listingList])

  const handleUpdate = useCallback(async (updates: Partial<Listing>) => {
    if (!listing) return

    try {
      const { data, error } = await supabase
        .from('listings')
        .update(updates)
        .eq('listing_id', listing.listing_id)
        .select()
        .single()

      if (error) {
        console.error('Failed to update listing:', error)
        return
      }

      setListing(data)
      onUpdate?.(data)
    } catch (err) {
      console.error('Error updating listing:', err)
    }
  }, [listing, supabase, onUpdate])

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      // Use listing directly from list - no fetch needed
      setListing(listingList[newIndex])
    }
  }

  const goToNext = () => {
    if (currentIndex < listingList.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      // Use listing directly from list - no fetch needed
      setListing(listingList[newIndex])
    }
  }

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Handle arrow keys for navigation
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        const newIndex = currentIndex - 1
        setCurrentIndex(newIndex)
        setListing(listingList[newIndex])
      }
      if (e.key === 'ArrowRight' && currentIndex < listingList.length - 1) {
        const newIndex = currentIndex + 1
        setCurrentIndex(newIndex)
        setListing(listingList[newIndex])
      }
    }
    window.addEventListener('keydown', handleArrowKeys)
    return () => window.removeEventListener('keydown', handleArrowKeys)
  }, [currentIndex, listingList])

  if (!listingId) return null

  // Memoize address calculations
  const address = useMemo(() => {
    if (!listing) return 'Address not available'
    
    const hasValue = (val: any): boolean => val != null && String(val).trim().length > 0
    
    // Try direct fields first
    const parts = [
      listing.street,
      listing.city,
      listing.state,
      listing.zip_code
    ]
      .filter(val => hasValue(val))
      .map(val => String(val).trim())
    
    if (parts.length > 0) {
      return parts.join(', ')
    }
    
    // Check other JSONB field for alternative address fields
    if (listing.other) {
      const other = listing.other as any
      const otherParts = [
        other.address,
        other.street_address,
        other.full_address,
        other.city,
        other.state,
        other.zip,
        other.zip_code,
        other.postal_code
      ]
        .filter(val => hasValue(val))
        .map(val => String(val).trim())
      
      if (otherParts.length > 0) {
        return otherParts.join(', ')
      }
    }
    
    return 'Address not available'
  }, [listing])

  // Helper function to check if a value is actually present (not null, undefined, or empty string)
  const hasValue = (val: any): boolean => {
    return val != null && String(val).trim().length > 0
  }

  // Build streetAddress - use street if available, otherwise try to build from available fields
  const streetAddress = useMemo(() => {
    if (!listing) return ''
    
    // Try direct street field first
    if (hasValue(listing.street)) {
      return String(listing.street).trim()
    }
    
    // Check other JSONB field for alternative address fields
    if (listing.other) {
      const other = listing.other as any
      // Check for common alternative field names
      if (hasValue(other.address)) {
        return String(other.address).trim()
      }
      if (hasValue(other.street_address)) {
        return String(other.street_address).trim()
      }
      if (hasValue(other.full_address)) {
        return String(other.full_address).trim()
      }
    }
    
    // If no street, try to build from city, state, zip
    const cityStateZip = [
      listing.city, 
      listing.state, 
      listing.zip_code
    ]
      .filter(val => hasValue(val))
      .map(val => String(val).trim())
      .join(', ')
    
    if (cityStateZip) {
      return cityStateZip
    }
    
    // Check other JSONB for city/state/zip
    if (listing.other) {
      const other = listing.other as any
      const otherCityStateZip = [
        other.city,
        other.state,
        other.zip,
        other.zip_code,
        other.postal_code
      ]
        .filter(val => hasValue(val))
        .map(val => String(val).trim())
        .join(', ')
      
      if (otherCityStateZip) {
        return otherCityStateZip
      }
    }
    
    // If still nothing, try property_url as last resort
    if (listing.property_url) {
      return 'Property Listing'
    }
    
    return ''
  }, [listing])
  
  const cityStateZip = useMemo(() => {
    if (!listing) return ''
    
    const hasValue = (val: any): boolean => val != null && String(val).trim().length > 0
    
    const parts = [
      listing.city, 
      listing.state, 
      listing.zip_code
    ]
      .filter(val => hasValue(val))
      .map(val => String(val).trim())
    
    // Also check other JSONB if direct fields are empty
    if (parts.length === 0 && listing.other) {
      const other = listing.other as any
      const otherParts = [
        other.city,
        other.state,
        other.zip,
        other.zip_code,
        other.postal_code
      ]
        .filter(val => hasValue(val))
        .map(val => String(val).trim())
      
      if (otherParts.length > 0) {
        return otherParts.join(', ')
      }
    }
    
    return parts.join(', ')
  }, [listing])

  // Memoize property badges
  const propertyBadges = useMemo(() => {
    const badges: string[] = []
    if (listing?.status && listing.status.toLowerCase().includes('off')) badges.push('Off Market')
    if (listing?.list_price && listing?.last_sale_price && listing.list_price >= listing.last_sale_price * 1.5) {
      badges.push('High Equity')
    }
    if (!listing?.agent_email && !listing?.agent_phone) badges.push('Free And Clear')
    if (listing?.year_built && listing.year_built < 1970) badges.push('Senior Property')
    return badges
  }, [listing?.status, listing?.list_price, listing?.last_sale_price, listing?.agent_email, listing?.agent_phone, listing?.year_built])

  const tabLabels: Record<TabType, string> = { info: 'Details', comps: 'Comps', mail: 'Owner', activity: 'Activity' }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Property details"
    >
      <div
        className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl border border-gray-100 flex overflow-hidden relative shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - absolute top right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/90 hover:bg-white text-gray-400 hover:text-gray-900 transition-colors shadow-sm"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Left Panel: Street View (55%) */}
        <div className="hidden lg:block w-[55%] h-full relative bg-gray-900 group">
          <div className="absolute inset-0 min-h-[400px]">
            {listing && <StreetViewPanorama listing={listing} />}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/5 pointer-events-none" />
          <div className="absolute top-8 left-8">
            <div className="bg-white/10 backdrop-blur-sm border border-white/30 text-white px-5 py-3 rounded-lg flex flex-col shadow-lg">
              <span className="font-bold text-lg tracking-tight">{streetAddress || 'Address not available'}</span>
              <span className="text-white/70 text-sm font-light">{cityStateZip}</span>
            </div>
          </div>
          <div className="absolute bottom-4 left-6 text-[11px] text-white/50 font-medium tracking-wide">© {new Date().getFullYear()} Google</div>
        </div>

        {/* Right Panel: Content (45%) */}
        <div className="w-full lg:w-[45%] h-full flex flex-col bg-white relative">
          <div className="flex-grow overflow-y-auto px-10 py-10">
            {/* Header: Address + Share / Favorite */}
            <div className="mb-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 leading-none tracking-tight">{streetAddress || 'Address not available'}</h1>
                  <p className="text-slate-500 mt-2 text-lg font-light">{cityStateZip || '—'}</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-zinc-900 hover:bg-gray-50 rounded-full transition-colors border border-transparent hover:border-gray-200" aria-label="Share">
                    <Share2 size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFavorite(!isFavorite)}
                    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors border border-transparent hover:border-red-100"
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart size={20} className={isFavorite ? 'fill-red-500 text-red-500' : ''} />
                  </button>
                  <button type="button" onClick={() => setShowOwnerSelector(!showOwnerSelector)} className="relative w-10 h-10 flex items-center justify-center text-slate-500 hover:text-zinc-900 hover:bg-gray-50 rounded-full transition-colors" aria-label="Assign owner">
                    <User size={20} />
                    {listing?.owner_id && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">1</span>}
                  </button>
                  <button type="button" onClick={() => setShowListsManager(!showListsManager)} className="relative w-10 h-10 flex items-center justify-center text-slate-500 hover:text-zinc-900 hover:bg-gray-50 rounded-full transition-colors" aria-label="Manage lists">
                    <List size={20} />
                    {(listing?.lists?.length ?? 0) > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">{listing!.lists!.length}</span>}
                  </button>
                  <button type="button" onClick={() => setShowTagsInput(!showTagsInput)} className="relative w-10 h-10 flex items-center justify-center text-slate-500 hover:text-zinc-900 hover:bg-gray-50 rounded-full transition-colors" aria-label="Manage tags">
                    <Tag size={20} />
                    {(listing?.tags?.length ?? 0) > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">{listing!.tags!.length}</span>}
                  </button>
                  <div className="relative">
                    <PipelineDropdown value={listing?.pipeline_status || 'new'} onChange={(pipeline_status) => handleUpdate({ pipeline_status })} />
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-extrabold text-slate-900 tracking-tighter">
                  {listing?.list_price ? `$${listing.list_price.toLocaleString()}` : '—'}
                </span>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">Est. Value</span>
                  {propertyBadges.length > 0 ? (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-0.5">{propertyBadges[0]}</span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-0.5">Free & Clear</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Tabs */}
            <div className="flex items-center gap-8 border-b border-gray-100 mb-8 sticky top-0 bg-white z-10 pt-2">
              {(['info', 'comps', 'mail', 'activity'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab ? 'text-zinc-900 border-zinc-900 font-semibold' : 'text-slate-500 hover:text-slate-900 border-transparent'}`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-10">
              {activeTab === 'info' && <InfoTab listing={listing} />}
              {activeTab === 'comps' && <CompsTab />}
              {activeTab === 'mail' && <MailTab />}
              {activeTab === 'activity' && <ActivityTab />}
            </div>
          </div>

          {/* Conditional Popups - absolute within right panel */}
          {showOwnerSelector && (
            <div className="absolute top-20 right-10 z-[60] bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[280px]">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-slate-900">Assign Owner</label>
                <button type="button" onClick={() => setShowOwnerSelector(false)} className="p-1 text-slate-500 hover:text-slate-900">
                  <X size={16} />
                </button>
              </div>
              <OwnerSelector supabase={supabase} value={listing?.owner_id || null} onChange={(owner_id) => { handleUpdate({ owner_id }); setShowOwnerSelector(false) }} />
            </div>
          )}
          {showListsManager && (
            <div className="absolute top-20 right-10 z-[60] bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[280px]">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-slate-900">Manage Lists</label>
                <button type="button" onClick={() => setShowListsManager(false)} className="p-1 text-slate-500 hover:text-slate-900">
                  <X size={16} />
                </button>
              </div>
              <ListsManager supabase={supabase} listing={listing} onChange={(lists) => handleUpdate({ lists })} />
            </div>
          )}
          {showTagsInput && (
            <div className="absolute top-20 right-10 z-[60] bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[280px]">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-slate-900">Manage Tags</label>
                <button type="button" onClick={() => setShowTagsInput(false)} className="p-1 text-slate-500 hover:text-slate-900">
                  <X size={16} />
                </button>
              </div>
              <TagsInput supabase={supabase} initialTags={listing?.tags || []} onChange={(tags) => handleUpdate({ tags })} />
            </div>
          )}

          {/* Footer: Pagination + View Full Listing */}
          <div className="px-10 py-6 border-t border-gray-100 bg-white/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={goToPrevious}
                disabled={currentIndex <= 0}
                className="text-slate-500 hover:text-slate-900 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-500"
              >
                <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={currentIndex >= listingList.length - 1}
                className="text-slate-500 hover:text-slate-900 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-500"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="text-xs font-medium text-slate-400 tracking-wide hidden sm:block">
              Item {currentIndex + 1} / {listingList.length}
            </div>
            {listing?.property_url ? (
              <a
                href={listing.property_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-gray-200 flex items-center gap-2 transition-all hover:-translate-y-0.5"
              >
                View Full Listing
                <ExternalLink size={14} />
              </a>
            ) : (
              <span className="px-8 py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-semibold cursor-not-allowed">View Full Listing</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Interactive Street View Panorama component
function StreetViewPanorama({ listing }: { listing: Listing | null }) {
  const panoramaRef = useRef<HTMLDivElement>(null)
  const panoramaInstanceRef = useRef<google.maps.StreetViewPanorama | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [apiReadyAttempt, setApiReadyAttempt] = useState(0)

  useEffect(() => {
    if (!listing || !panoramaRef.current) return

    // ✅ Ensure Maps JS is ready - retry if not available yet
    if (typeof window === 'undefined' || !window.google?.maps) {
      // Try again in 100ms (faster retry), but cap the number of attempts (30 attempts = 3 seconds max)
      if (apiReadyAttempt < 30) {
        const id = window.setTimeout(() => setApiReadyAttempt(a => a + 1), 100)
        return () => window.clearTimeout(id)
      }
      setError('Google Maps API not loaded')
      setIsLoading(false)
      return
    }

    let cancelled = false

    const initializeStreetView = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Get coordinates - ALWAYS prefer stored lat/lng from database first
        // Only geocode as a fallback if coordinates are missing
        let position: { lat: number; lng: number } | null = null

        // Priority 1: Use stored lat/lng from database (fastest path)
        if (listing.lat != null && listing.lng != null) {
          position = {
            lat: Number(listing.lat),
            lng: Number(listing.lng)
          }
        } 
        // Priority 2: Check for latitude/longitude fields (for probate_leads compatibility)
        else if (listing.latitude != null && listing.longitude != null) {
          position = {
            lat: Number(listing.latitude),
            lng: Number(listing.longitude)
          }
        }
        // Priority 3: Fallback to geocoding (only if no stored coordinates)
        else {
          // Geocode address as last resort
          const address = buildAddressString(listing)
          if (address) {
            try {
              const result = await geocodeAddress(address)
              position = { lat: result.lat, lng: result.lng }
            } catch (geocodeError) {
              console.warn('Geocoding failed:', geocodeError)
              setError('Could not find location for this address')
              setIsLoading(false)
              return
            }
          }
        }

        if (!position) {
          setError('No location data available')
          setIsLoading(false)
          return
        }

        // Ensure the container element exists
        if (!panoramaRef.current) {
          setError('Street View container not available')
          setIsLoading(false)
          return
        }

        if (cancelled || !panoramaRef.current) return

        // Create or update Street View panorama
        if (!panoramaInstanceRef.current) {
          panoramaInstanceRef.current = new window.google.maps.StreetViewPanorama(panoramaRef.current, {
            position,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: true,
            zoomControl: true,
            fullscreenControl: true,
            panControl: true,
            linksControl: true,
            enableCloseButton: false
          })

          // Listen for panorama status changes
          window.google.maps.event.addListener(panoramaInstanceRef.current, 'status_changed', () => {
            const status = panoramaInstanceRef.current?.getStatus()
            if (status === 'OK') {
              setIsLoading(false)
              setError(null)
            } else if (status === 'ZERO_RESULTS') {
              setError('Street View is not available for this location')
              setIsLoading(false)
            } else {
              setError('Street View could not be loaded')
              setIsLoading(false)
            }
          })

          setIsInitialized(true)
        } else {
          // Update position if panorama already exists
          panoramaInstanceRef.current.setPosition(position)
          setIsLoading(false)
    }
      } catch (err: any) {
        console.error('Error initializing Street View:', err)
        if (!cancelled) {
          setError(err.message || 'Failed to load Street View')
          setIsLoading(false)
        }
      }
    }

    // Start initialization immediately (no delay needed if container is already visible)
    initializeStreetView()

    return () => {
      cancelled = true
      if (panoramaInstanceRef.current) {
        window.google.maps.event.clearInstanceListeners(panoramaInstanceRef.current)
        panoramaInstanceRef.current.setVisible(false)
      }
    }
  }, [listing?.listing_id, listing?.lat, listing?.lng, listing?.street, listing?.city, listing?.state, listing?.zip_code, apiReadyAttempt])

  // Fallback to static image if Street View fails
  if (error && listing) {
    const lat = listing.lat ? Number(listing.lat) : null
    const lng = listing.lng ? Number(listing.lng) : null
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (lat && lng && googleMapsApiKey) {
      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=640x480&markers=color:red%7C${lat},${lng}&key=${googleMapsApiKey}`
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <img
            src={staticMapUrl}
            alt="Property location"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Loading state */}
      {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f3f4f6',
            zIndex: 1
          }}>
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #3b82f6',
                borderRadius: '50%',
                margin: '0 auto 12px',
                animation: 'spin 1s linear infinite'
              }}></div>
              <div>Loading Street View...</div>
            </div>
          </div>
        )}

      {/* Error state */}
      {error && !isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f3f4f6',
            color: '#6b7280',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            textAlign: 'center',
          padding: '20px',
          zIndex: 1
          }}>
          <div>
            <MapPin size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div>{error}</div>
          </div>
      </div>
      )}

      {/* Street View container */}
      <div
        ref={panoramaRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px'
      }}
      />
    </div>
  )
}

// Info Tab Component
function InfoTab({ listing }: { listing: Listing | null }) {
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [showMoreLandInfo, setShowMoreLandInfo] = useState(false)
  const [showMoreTaxInfo, setShowMoreTaxInfo] = useState(false)
  const [helpTooltip, setHelpTooltip] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  // Smooth expand animation with scroll
  const handleExpand = (setter: (val: boolean) => void, currentValue: boolean) => {
    setIsAnimating(true)
    setter(!currentValue)
    setTimeout(() => {
      setIsAnimating(false)
      if (!currentValue) {
        // Smooth scroll to expanded section
        const expandedSection = document.querySelector('[data-expanded-section]')
        if (expandedSection) {
          expandedSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }
    }, 100)
  }

  // Add smooth scroll effect when sections expand
  useEffect(() => {
    if (showMoreDetails || showMoreLandInfo || showMoreTaxInfo) {
      const timer = setTimeout(() => {
        const expandedSection = document.querySelector('[data-expanded-section]')
        if (expandedSection) {
          expandedSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [showMoreDetails, showMoreLandInfo, showMoreTaxInfo])

  // Calculate bathrooms display - format with proper decimals
  const bathroomsDisplay = listing?.full_baths !== null && listing?.full_baths !== undefined
    ? formatBaths(listing.full_baths)
    : '--'

  // Property details data structure - using actual listing data where available
  const propertyDetails = [
    { label: 'Living area', value: listing?.sqft ? `${listing.sqft.toLocaleString()} sqft` : '--', help: 'Total square footage of living space in the property' },
    { label: 'Year built', value: listing?.year_built?.toString() || '--', help: 'The year the property was originally constructed' },
    { label: 'Bedrooms', value: listing?.beds?.toString() || '--', help: 'Number of bedrooms in the property' },
    { label: 'Bathrooms', value: bathroomsDisplay, help: 'Number of full and half bathrooms' },
    { label: 'Property type', value: listing?.other?.property_type || 'Single Family', help: 'The type of property (e.g., Single Family, Condo, Townhouse)' },
    { label: 'Construction type', value: listing?.other?.construction_type || 'Frame', help: 'Primary construction material used for the property' },
    { label: 'Building style', value: listing?.other?.building_style || 'Conventional', help: 'Architectural style of the building' },
    { label: 'Effective year built', value: listing?.other?.effective_year_built || listing?.year_built?.toString() || '--', help: 'Year of construction after accounting for major renovations' },
    { label: 'Number of units', value: listing?.other?.num_units?.toString() || '--', help: 'Total number of residential units in the property' },
    { label: 'Number of buildings', value: listing?.other?.num_buildings?.toString() || '--', help: 'Number of separate buildings on the property' },
    { label: 'Number of commercial units', value: listing?.other?.num_commercial_units?.toString() || '--', help: 'Number of commercial units if mixed-use property' },
    { label: 'Stories', value: listing?.other?.stories || '2 Stories', help: 'Number of stories or levels in the building' },
    { label: 'Garage area', value: listing?.other?.garage_area ? `${listing.other.garage_area} sqft` : '344 sqft', help: 'Total square footage of garage space' },
    { label: 'Heating type', value: listing?.other?.heating_type || 'Heat Pump', help: 'Type of heating system installed' },
    { label: 'Heating fuel', value: listing?.other?.heating_fuel || '--', help: 'Fuel source for the heating system' },
    { label: 'Air conditioning', value: listing?.other?.air_conditioning || 'Central', help: 'Type of air conditioning system' },
    { label: 'Basement', value: listing?.other?.basement || '--', help: 'Presence and type of basement' },
    { label: 'Deck', value: listing?.other?.deck || 'No', help: 'Whether the property has a deck' },
    { label: 'Exterior walls', value: listing?.other?.exterior_walls || 'Siding (Alum/Vinyl)', help: 'Material used for exterior walls' },
    { label: 'Interior Walls', value: listing?.other?.interior_walls || 'Gypsum Board/Drywall/Sheetrock/Wallboard', help: 'Material used for interior walls' },
    { label: 'Number of fireplaces', value: listing?.other?.num_fireplaces?.toString() || '1', help: 'Total number of fireplaces in the property' },
    { label: 'Floor cover', value: listing?.other?.floor_cover || '--', help: 'Primary flooring material' },
    { label: 'Garage', value: listing?.other?.garage || 'Attached Garage', help: 'Type and configuration of garage' },
    { label: 'Driveway', value: listing?.other?.driveway || '--', help: 'Type of driveway surface' },
    { label: 'Amenities', value: listing?.other?.amenities || '--', help: 'Special features and amenities of the property' },
    { label: 'Other rooms', value: listing?.other?.other_rooms || '--', help: 'Additional rooms beyond standard bedrooms and bathrooms' },
    { label: 'Pool', value: listing?.other?.pool || 'No', help: 'Whether the property has a pool' },
    { label: 'Patio', value: listing?.other?.patio || '--', help: 'Presence and type of patio' },
    { label: 'Porch', value: listing?.other?.porch || '--', help: 'Presence and type of porch' },
    { label: 'Roof cover', value: listing?.other?.roof_cover || 'Asphalt', help: 'Material used for roof covering' },
    { label: 'Roof type', value: listing?.other?.roof_type || 'Gable', help: 'Architectural style of the roof' },
    { label: 'Sewer', value: listing?.other?.sewer || '--', help: 'Type of sewer system (public, septic, etc.)' },
    { label: 'Topography', value: listing?.other?.topography || '--', help: 'Land topography and terrain features' },
    { label: 'Water', value: listing?.other?.water || '--', help: 'Water source and supply type' },
    { label: 'Geographic features', value: listing?.other?.geographic_features || '--', help: 'Notable geographic features near the property' },
  ]

  // Land information data structure
  const landDetails = [
    { label: 'APN (Parcel ID)', value: listing?.other?.apn || listing?.other?.parcel_id || '17819000', help: 'Assessor Parcel Number - unique identifier for the property parcel' },
    { label: 'Lot size (Sqft)', value: listing?.other?.lot_size_sqft ? `${parseInt(listing.other.lot_size_sqft).toLocaleString()} sqft` : '6,416 sqft', help: 'Total lot size in square feet' },
    { label: 'Legal description', value: listing?.other?.legal_description || '60 GHENT COMMONS', help: 'Official legal description of the property as recorded in public records' },
    { label: 'Subdivision name', value: listing?.other?.subdivision_name || 'Ghent Commons Sd', help: 'Name of the subdivision or development where the property is located' },
    { label: 'Property class', value: listing?.other?.property_class || 'Residential', help: 'Classification of the property type (Residential, Commercial, etc.)' },
    { label: 'Standardized Land Use', value: listing?.other?.standardized_land_use || 'Single Family Residential', help: 'Standardized classification of land use type' },
    { label: 'County land use code', value: listing?.other?.county_land_use_code || '513', help: 'County-specific code for land use classification' },
    { label: 'County name', value: listing?.other?.county_name || listing?.city ? `${listing.city} City` : 'Norfolk City', help: 'Name of the county where the property is located' },
    { label: 'Census tract', value: listing?.other?.census_tract || '003600', help: 'Census tract number for demographic and statistical purposes' },
    { label: 'Lot Width (Ft)', value: listing?.other?.lot_width_ft || '--', help: 'Width of the lot in feet' },
    { label: 'Lot Depth (Ft)', value: listing?.other?.lot_depth_ft || '--', help: 'Depth of the lot in feet' },
    { label: 'Lot number', value: listing?.other?.lot_number || '--', help: 'Lot number within the subdivision' },
    { label: 'School district', value: listing?.other?.school_district || 'Norfolk City Public Schools', help: 'School district serving the property' },
    { label: 'Zoning', value: listing?.other?.zoning || 'PDMU4', help: 'Zoning classification that determines permitted uses and building requirements' },
    { label: 'Flood zone', value: listing?.other?.flood_zone || 'X', help: 'FEMA flood zone designation indicating flood risk level' },
  ]

  // Tax information data structure
  const taxDetails = [
    { label: 'Tax delinquent?', value: listing?.other?.tax_delinquent || 'No', help: 'Whether the property has delinquent tax payments' },
    { label: 'Tax delinquent year', value: listing?.other?.tax_delinquent_year || '--', help: 'Year in which taxes became delinquent' },
    { label: 'Tax year', value: listing?.other?.tax_year || new Date().getFullYear().toString(), help: 'Tax year for which the tax information applies' },
    { label: 'Tax amount', value: listing?.other?.tax_amount ? `$${parseInt(listing.other.tax_amount).toLocaleString()}` : '$6,255', help: 'Total annual property tax amount' },
    { label: 'Assessment year', value: listing?.other?.assessment_year || new Date().getFullYear().toString(), help: 'Year of the property assessment' },
    { label: 'Total assessed value', value: listing?.other?.total_assessed_value ? `$${parseInt(listing.other.total_assessed_value).toLocaleString()}` : '$500,400', help: 'Total assessed value of the property for tax purposes' },
    { label: 'Assessed land value', value: listing?.other?.assessed_land_value ? `$${parseInt(listing.other.assessed_land_value).toLocaleString()}` : '$191,500', help: 'Assessed value of the land portion' },
    { label: 'Assessed improvement value', value: listing?.other?.assessed_improvement_value ? `$${parseInt(listing.other.assessed_improvement_value).toLocaleString()}` : '$308,900', help: 'Assessed value of improvements (buildings, structures)' },
    { label: 'Total market value', value: listing?.other?.total_market_value ? `$${parseInt(listing.other.total_market_value).toLocaleString()}` : '$500,400', help: 'Total estimated market value of the property' },
    { label: 'Market land value', value: listing?.other?.market_land_value ? `$${parseInt(listing.other.market_land_value).toLocaleString()}` : '$191,500', help: 'Estimated market value of the land' },
    { label: 'Market improvement value', value: listing?.other?.market_improvement_value ? `$${parseInt(listing.other.market_improvement_value).toLocaleString()}` : '$308,900', help: 'Estimated market value of improvements' },
  ]

  // First 4 property facts for initial display (Living Area, Year Built, Bedrooms, Bathrooms)
  const displayPropertyFacts = propertyDetails.slice(0, 4)
  const morePropertyFacts = propertyDetails.slice(4)
  const displayLandDetails = landDetails.slice(0, 3)
  const moreLandDetailsDisplay = landDetails.slice(3)
  const displayTaxDetails = taxDetails.slice(0, 3)
  const moreTaxDetailsDisplay = taxDetails.slice(3)

  return (
    <div className="space-y-10">
      {/* Property Facts */}
      <section>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Property Facts</h3>
        <div className="divide-y divide-dashed divide-gray-200">
          {displayPropertyFacts.map((detail, idx) => (
            <div key={idx} className="py-3 flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">{detail.label}</span>
                <button type="button" onMouseEnter={() => setHelpTooltip(detail.label)} onMouseLeave={() => setHelpTooltip(null)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-help" title={detail.help}>
                  <Info size={16} className="text-gray-300" />
                </button>
              </div>
              <span className="text-base font-semibold text-slate-900">{detail.value}</span>
            </div>
          ))}
        </div>
        {morePropertyFacts.length > 0 && (
          <>
            {!showMoreDetails && (
              <button type="button" onClick={() => handleExpand(setShowMoreDetails, showMoreDetails)} className="mt-3 text-sm font-medium text-zinc-900 hover:text-zinc-800 flex items-center gap-1">
                Show more facts
                <ChevronDown size={16} />
              </button>
            )}
            {showMoreDetails && (
              <div data-expanded-section className="divide-y divide-dashed divide-gray-200 mt-2">
                {morePropertyFacts.map((detail, idx) => (
                  <div key={idx} className="py-3 flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500">{detail.label}</span>
                      <button type="button" onMouseEnter={() => setHelpTooltip(detail.label)} onMouseLeave={() => setHelpTooltip(null)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-help" title={detail.help}>
                        <Info size={16} className="text-gray-300" />
                      </button>
                    </div>
                    <span className="text-base font-semibold text-slate-900">{detail.value}</span>
                  </div>
                ))}
                <button type="button" onClick={() => handleExpand(setShowMoreDetails, showMoreDetails)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  Show less
                  <ChevronDown size={16} className="rotate-180" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Land Details */}
      <section>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Land Details</h3>
        <div className="divide-y divide-dashed divide-gray-200">
          {displayLandDetails.map((detail, idx) => (
            <div key={idx} className="py-3 flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">{detail.label}</span>
                <button type="button" onMouseEnter={() => setHelpTooltip(detail.label)} onMouseLeave={() => setHelpTooltip(null)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-help" title={detail.help}>
                  <Info size={16} className="text-gray-300" />
                </button>
              </div>
              <span className="text-base font-semibold text-slate-900 font-mono">{detail.value}</span>
            </div>
          ))}
        </div>
        {moreLandDetailsDisplay.length > 0 && (
          <>
            {!showMoreLandInfo && (
              <button type="button" onClick={() => handleExpand(setShowMoreLandInfo, showMoreLandInfo)} className="mt-3 text-sm font-medium text-zinc-900 hover:text-zinc-800 flex items-center gap-1">
                Show more land details
                <ChevronDown size={16} />
              </button>
            )}
            {showMoreLandInfo && (
              <div data-expanded-section className="divide-y divide-dashed divide-gray-200 mt-2">
                {moreLandDetailsDisplay.map((detail, idx) => (
                  <div key={idx} className="py-3 flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500">{detail.label}</span>
                      <button type="button" onMouseEnter={() => setHelpTooltip(detail.label)} onMouseLeave={() => setHelpTooltip(null)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-help" title={detail.help}>
                        <Info size={16} className="text-gray-300" />
                      </button>
                    </div>
                    <span className="text-base font-semibold text-slate-900">{detail.value}</span>
                  </div>
                ))}
                <button type="button" onClick={() => handleExpand(setShowMoreLandInfo, showMoreLandInfo)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  Show less
                  <ChevronDown size={16} className="rotate-180" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Tax Status */}
      <section className="pb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tax Status</h3>
        <div className="divide-y divide-dashed divide-gray-200">
          {displayTaxDetails.map((detail, idx) => (
            <div key={idx} className="py-3 flex justify-between items-center group">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">{detail.label}</span>
              </div>
              {detail.label.toLowerCase().includes('delinquent') && (detail.value === 'Yes' || detail.value === 'No') ? (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detail.value === 'No' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {detail.value}
                </span>
              ) : (
                <span className="text-base font-semibold text-slate-900">{detail.value}</span>
              )}
            </div>
          ))}
        </div>
        {moreTaxDetailsDisplay.length > 0 && (
          <>
            {!showMoreTaxInfo && (
              <button type="button" onClick={() => handleExpand(setShowMoreTaxInfo, showMoreTaxInfo)} className="mt-3 text-sm font-medium text-zinc-900 hover:text-zinc-800 flex items-center gap-1">
                Show more tax details
                <ChevronDown size={16} />
              </button>
            )}
            {showMoreTaxInfo && (
              <div data-expanded-section className="divide-y divide-dashed divide-gray-200 mt-2">
                {moreTaxDetailsDisplay.map((detail, idx) => (
                  <div key={idx} className="py-3 flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500">{detail.label}</span>
                      <button type="button" onMouseEnter={() => setHelpTooltip(detail.label)} onMouseLeave={() => setHelpTooltip(null)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-help" title={detail.help}>
                        <Info size={16} className="text-gray-300" />
                      </button>
                    </div>
                    <span className="text-base font-semibold text-slate-900">{detail.value}</span>
                  </div>
                ))}
                <button type="button" onClick={() => handleExpand(setShowMoreTaxInfo, showMoreTaxInfo)} className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  Show less
                  <ChevronDown size={16} className="rotate-180" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

// Comps Tab Component
function CompsTab() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Home size={48} style={{ color: '#d1d5db', marginBottom: '16px' }} />
      <h3 style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
        marginBottom: '8px'
      }}>
        Comparable Properties
      </h3>
      <p style={{
        fontSize: '14px',
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: '1.6'
      }}>
        View similar properties in the area to help determine market value and investment potential.
      </p>
      <button style={{
        marginTop: '24px',
        padding: '10px 20px',
        background: '#6366f1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer'
      }}>
        Find Comps
      </button>
    </div>
  )
}

// Mail Tab Component
function MailTab() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Mail size={48} style={{ color: '#d1d5db', marginBottom: '16px' }} />
      <h3 style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
        marginBottom: '8px'
      }}>
        Mail Campaigns
      </h3>
      <p style={{
        fontSize: '14px',
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: '1.6'
      }}>
        Send direct mail campaigns to this property owner to generate leads and build relationships.
      </p>
      <button style={{
        marginTop: '24px',
        padding: '10px 20px',
        background: '#ef4444',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer'
      }}>
        Start Mail Campaign
      </button>
    </div>
  )
}

// Activity Tab Component
function ActivityTab() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Activity size={48} style={{ color: '#d1d5db', marginBottom: '16px' }} />
      <h3 style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
        marginBottom: '8px'
      }}>
        Activity Timeline
      </h3>
      <p style={{
        fontSize: '14px',
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: '1.6'
      }}>
        Track all interactions, notes, and changes related to this property in one place.
      </p>
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: '#f9fafb',
        borderRadius: '8px',
        width: '100%',
        textAlign: 'center',
        fontSize: '14px',
        color: '#6b7280'
      }}>
        No activity yet
      </div>
    </div>
  )
}

