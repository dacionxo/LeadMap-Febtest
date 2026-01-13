'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { 
  X, ChevronLeft, ChevronRight, MapPin, User, Tag, List, Workflow,
  Camera, Star, Mail, Phone, Info, Activity, ChevronDown, Home, Check
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        padding: '20px',
        animation: 'fadeIn 0.4s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e7eb',
          maxWidth: '1100px',
          width: '85vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: 'scale(1)',
          transition: 'transform 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Action Icons */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          {/* Left side - Close & Address */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="Close"
            >
              <X size={18} style={{ color: '#6b7280' }} />
            </button>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <h2
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#111827',
                    margin: 0,
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: '1.4'
                  }}
                >
                  {streetAddress || 'Address not available'}
                </h2>
                {/* Only show cityStateZip if streetAddress doesn't already include it (i.e., when we have a street address) */}
                {cityStateZip && listing?.street && (
                  <p
                    style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                      fontSize: '13px',
                      fontWeight: 400,
                      color: '#6b7280',
                      margin: 0,
                      letterSpacing: '-0.005em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.4'
                    }}
                  >
                    {cityStateZip}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Camera Icon */}
            <button
              className="action-icon"
              title="Add Photo"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Camera size={16} style={{ color: '#6b7280' }} />
            </button>

            {/* Favorite/Star Icon */}
            <button
              className="action-icon"
              title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              onClick={() => setIsFavorite(!isFavorite)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Star 
                size={16} 
                style={{ 
                  color: isFavorite ? '#f59e0b' : '#6b7280', 
                  fill: isFavorite ? '#f59e0b' : 'none',
                  transition: 'all 0.15s ease'
                }} 
              />
            </button>

            {/* Owner Assignment */}
            <button
              className="action-icon-badge"
              title="Assign Owner"
              onClick={() => setShowOwnerSelector(!showOwnerSelector)}
              style={{
                position: 'relative',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <User size={16} style={{ color: '#6b7280' }} />
              {listing?.owner_id && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: '8px',
                  background: '#6366f1',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                }}>
                  1
                </span>
              )}
            </button>

            {/* List Management */}
            <button
              className="action-icon-badge"
              title="Manage Lists"
              onClick={() => setShowListsManager(!showListsManager)}
              style={{
                position: 'relative',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <List size={16} style={{ color: '#6b7280' }} />
              {listing?.lists && listing.lists.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: '8px',
                  background: '#6366f1',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                }}>
                  {listing.lists.length}
                </span>
              )}
            </button>

            {/* Tag Management */}
            <button
              className="action-icon-badge"
              title="Manage Tags"
              onClick={() => setShowTagsInput(!showTagsInput)}
              style={{
                position: 'relative',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Tag size={16} style={{ color: '#6b7280' }} />
              {listing?.tags && listing.tags.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: '8px',
                  background: '#6366f1',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                }}>
                  {listing.tags.length}
                </span>
              )}
            </button>

            {/* Pipeline Status Dropdown */}
            <div style={{ position: 'relative' }}>
              <PipelineDropdown
                value={listing?.pipeline_status || 'new'}
                onChange={(pipeline_status) => handleUpdate({ pipeline_status })}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          {/* Left Panel: Street View Image & Property Info */}
          <div
            style={{
              width: '50%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Google Street View Interactive */}
            <div
              style={{
                minHeight: '400px',
                background: '#f3f4f6',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {listing && <StreetViewPanorama listing={listing} />}
            </div>

            {/* Property Valuation Section */}
            <div style={{
              padding: '20px 24px',
              background: '#ffffff',
              borderTop: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                <span style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: '#111827',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                  letterSpacing: '-0.02em'
                }}>
                  {listing?.list_price ? `$${listing.list_price.toLocaleString()}` : 'N/A'}
                </span>
                <span style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                  fontWeight: 400
                }}>
                  Est. Value
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: 400,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                marginBottom: '12px'
              }}>
                {listing?.beds && <span>{listing.beds} bd</span>}
                {listing?.beds && listing?.full_baths && <span style={{ color: '#d1d5db' }}>·</span>}
                {listing?.full_baths && <span>{formatBaths(listing.full_baths)} ba</span>}
                {listing?.full_baths && listing?.sqft && <span style={{ color: '#d1d5db' }}>·</span>}
                {listing?.sqft && <span>{listing.sqft.toLocaleString()} sqft</span>}
              </div>

              {/* Property Tags/Badges */}
              {propertyBadges.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  {propertyBadges.map((badge, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: '#f3f4f6',
                        color: '#374151',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: 'none',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                      }}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Contact Information Section */}
            {(listing?.agent_name || listing?.agent_email || listing?.agent_phone) && (
              <div style={{
                padding: '20px 24px',
                borderTop: '1px solid #e5e7eb',
                overflow: 'auto',
                flex: 1,
                background: '#ffffff'
              }}>
                <h3 style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                }}>
                  Contact Information
                </h3>
                
                {/* Primary Contact */}
                <div style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h4 style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#111827',
                    margin: '0 0 6px 0',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                  }}>
                    {listing.agent_name || 'Property Contact'}
                  </h4>
                  <p style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    lineHeight: '1.5',
                    margin: '0 0 14px 0',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                  }}>
                    {address}
                  </p>
                  
                  <button style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#4f46e5'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#6366f1'
                  }}>
                    Start Mail
                  </button>
                </div>

                {/* Associated Contact Card */}
                {listing.agent_name && (
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '14px',
                    background: '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h5 style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#111827',
                          margin: '0 0 6px 0',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                        }}>
                          {listing.agent_name}
                        </h5>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#f3f4f6',
                            fontSize: '11px',
                            color: '#374151',
                            fontWeight: 500,
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif'
                          }}>
                            <Check size={10} style={{ color: '#6b7280' }} />
                            Agent
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {listing.agent_email && (
                          <a
                            href={`mailto:${listing.agent_email}`}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              background: '#f3f4f6',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#e5e7eb'
                              e.currentTarget.style.color = '#374151'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#f3f4f6'
                              e.currentTarget.style.color = '#6b7280'
                            }}
                          >
                            <Mail size={14} />
                          </a>
                        )}
                        {listing.agent_phone && (
                          <a
                            href={`tel:${listing.agent_phone}`}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              background: '#f3f4f6',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#e5e7eb'
                              e.currentTarget.style.color = '#374151'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#f3f4f6'
                              e.currentTarget.style.color = '#6b7280'
                            }}
                          >
                            <Phone size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Tabbed Interface */}
          <div
            style={{
              width: '50%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 24px',
              background: '#ffffff'
            }}>
              {(['info', 'comps', 'mail', 'activity'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    fontWeight: activeTab === tab ? 500 : 400,
                    color: activeTab === tab ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    top: '1px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                    textTransform: 'capitalize',
                    letterSpacing: '-0.01em'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab) {
                      e.currentTarget.style.color = '#374151'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab) {
                      e.currentTarget.style.color = '#6b7280'
                    }
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
              }}
            >
              {activeTab === 'info' && (
                <InfoTab listing={listing} />
              )}
              
              {activeTab === 'comps' && (
                <CompsTab />
              )}
              
              {activeTab === 'mail' && (
                <MailTab />
              )}
              
              {activeTab === 'activity' && (
                <ActivityTab />
              )}
            </div>

            {/* Conditional Popups */}
            {showOwnerSelector && (
              <div style={{
                position: 'absolute',
                top: '70px',
                right: '20px',
                zIndex: 10,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '16px',
                minWidth: '280px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Assign Owner
                  </label>
                  <button
                    onClick={() => setShowOwnerSelector(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                  >
                    <X size={16} style={{ color: '#6b7280' }} />
                  </button>
                </div>
                <OwnerSelector
                  supabase={supabase}
                  value={listing?.owner_id || null}
                  onChange={(owner_id) => {
                    handleUpdate({ owner_id })
                    setShowOwnerSelector(false)
                  }}
                />
              </div>
            )}

            {showListsManager && (
              <div style={{
                position: 'absolute',
                top: '70px',
                right: '20px',
                zIndex: 10,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '16px',
                minWidth: '280px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Manage Lists
                  </label>
                  <button
                    onClick={() => setShowListsManager(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                  >
                    <X size={16} style={{ color: '#6b7280' }} />
                  </button>
                </div>
                <ListsManager
                  supabase={supabase}
                  listing={listing}
                  onChange={(lists) => {
                    handleUpdate({ lists })
                  }}
                />
              </div>
            )}

            {showTagsInput && (
              <div style={{
                position: 'absolute',
                top: '70px',
                right: '20px',
                zIndex: 10,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '16px',
                minWidth: '280px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    Manage Tags
                  </label>
                  <button
                    onClick={() => setShowTagsInput(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                  >
                    <X size={16} style={{ color: '#6b7280' }} />
                  </button>
                </div>
                <TagsInput
                  supabase={supabase}
                  initialTags={listing?.tags || []}
                  onChange={(tags) => {
                    handleUpdate({ tags })
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer with Pagination */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <button
              onClick={goToPrevious}
              disabled={currentIndex <= 0}
              style={{
                padding: '8px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: currentIndex <= 0 ? '#f9fafb' : '#ffffff',
                color: currentIndex <= 0 ? '#9ca3af' : '#374151',
                cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (currentIndex > 0) {
                  e.currentTarget.style.background = '#f3f4f6'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }
              }}
              onMouseLeave={(e) => {
                if (currentIndex > 0) {
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }
              }}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex >= listingList.length - 1}
              style={{
                padding: '8px 14px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: currentIndex >= listingList.length - 1 ? '#f9fafb' : '#ffffff',
                color: currentIndex >= listingList.length - 1 ? '#9ca3af' : '#374151',
                cursor: currentIndex >= listingList.length - 1 ? 'not-allowed' : 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (currentIndex < listingList.length - 1) {
                  e.currentTarget.style.background = '#f3f4f6'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }
              }}
              onMouseLeave={(e) => {
                if (currentIndex < listingList.length - 1) {
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }
              }}
            >
              Next
              <ChevronRight size={16} />
            </button>
            <span
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                color: '#6b7280',
                marginLeft: '8px'
              }}
            >
              {currentIndex + 1} of {listingList.length}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px'
            }}
          >
            {listing?.property_url && (
              <a
                href={listing.property_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#374151',
                  textDecoration: 'none',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                View Property
                <ChevronRight size={14} />
              </a>
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

  // Get first two items for the initial display
  const initialDetails = propertyDetails.slice(0, 2)
  const moreDetails = propertyDetails.slice(2)

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

  // Get first two items for the initial display (APN and Lot Size)
  const initialLandDetails = landDetails.slice(0, 2)
  const moreLandDetails = landDetails.slice(2)

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

  // Get first two items for the initial display (Tax delinquent? and Tax delinquent year)
  const initialTaxDetails = taxDetails.slice(0, 2)
  const moreTaxDetails = taxDetails.slice(2)

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif' }}>
      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '16px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <label style={{
            fontSize: '12px',
            color: '#6b7280',
            fontWeight: 500,
            marginBottom: '8px',
            display: 'block',
            letterSpacing: '0.02em'
          }}>
            Estimated equity
          </label>
          <div style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#111827',
            letterSpacing: '-0.02em'
          }}>
            {listing?.list_price ? `$${listing.list_price.toLocaleString()}` : 'N/A'}
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <label style={{
            fontSize: '12px',
            color: '#6b7280',
            fontWeight: 500,
            marginBottom: '8px',
            display: 'block',
            letterSpacing: '0.02em'
          }}>
            Percent equity
          </label>
          <div style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#111827',
            letterSpacing: '-0.02em'
          }}>
            100%
          </div>
        </div>
      </div>

      {/* Property Characteristics */}
      <div style={{
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
          letterSpacing: '-0.01em'
        }}>
          Property Characteristics
        </h3>

        {/* Initial Two-Column Row: Living Area and Year Built */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '12px'
        }}>
          {initialDetails.map((detail, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.1)',
                animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)'
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)'
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)'
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.1)'
              }}
            >
              {/* Help Icon */}
              <button
                onMouseEnter={() => setHelpTooltip(detail.label)}
                onMouseLeave={() => setHelpTooltip(null)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'help',
                  padding: 0,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                  e.currentTarget.style.borderColor = '#6366f1'
                  e.currentTarget.style.transform = 'scale(1.15)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)'
                }}
              >
                <Info size={12} style={{ color: '#6366f1', transition: 'color 0.3s ease' }} />
              </button>
              
              {/* Tooltip */}
              {helpTooltip === detail.label && (
                <div style={{
                  position: 'absolute',
                  top: '36px',
                  right: '0',
                  zIndex: 1000,
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  maxWidth: '250px',
                  minWidth: '150px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)',
                  whiteSpace: 'normal',
                  lineHeight: '1.5',
                  pointerEvents: 'none',
                  animation: 'fadeInUp 0.2s ease-out',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  {detail.help}
                </div>
              )}

              <div style={{
                fontSize: '11px',
                color: '#6366f1',
                fontWeight: 600,
                marginBottom: '6px',
                paddingRight: '32px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {detail.label}:
              </div>
              <div style={{
                fontSize: '20px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 700
              }}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>

        {/* Click for More Button */}
        {!showMoreDetails && (
          <button
            onClick={() => handleExpand(setShowMoreDetails, showMoreDetails)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
              width: 'fit-content'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <ChevronDown size={14} />
            Click for more
          </button>
        )}

        {/* Expanded Details Section */}
        {showMoreDetails && (
          <div 
            data-expanded-section
            style={{
              marginTop: '16px',
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(168, 85, 247, 0.03) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.1)',
              animation: 'fadeInUp 0.4s ease-out'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              {moreDetails.map((detail, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    padding: '12px 14px',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    borderRadius: '8px',
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                    transition: 'all 0.3s ease',
                    animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)'
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Help Icon */}
                  <button
                    onMouseEnter={() => setHelpTooltip(detail.label)}
                    onMouseLeave={() => setHelpTooltip(null)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'help',
                      padding: 0,
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.transform = 'scale(1.2) rotate(360deg)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                      e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)'
                    }}
                  >
                    <Info size={11} style={{ color: '#6366f1', transition: 'color 0.3s ease' }} />
                  </button>
                  
                  {/* Tooltip */}
                  {helpTooltip === detail.label && (
                    <div style={{
                      position: 'absolute',
                      top: '32px',
                      right: '0',
                      zIndex: 1000,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      maxWidth: '250px',
                      minWidth: '150px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)',
                      whiteSpace: 'normal',
                      lineHeight: '1.5',
                      pointerEvents: 'none',
                      animation: 'fadeInUp 0.2s ease-out',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      {detail.help}
                    </div>
                  )}

                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: 500,
                    marginBottom: '4px',
                    paddingRight: '26px'
                  }}>
                    {detail.label}:
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#111827',
                    fontWeight: 500
                  }}>
                    {detail.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Collapse Button */}
            <button
              onClick={() => handleExpand(setShowMoreDetails, showMoreDetails)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                marginTop: '16px',
                border: 'none',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                borderRadius: '8px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'
                e.currentTarget.style.color = '#374151'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                e.currentTarget.style.color = '#6b7280'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(180deg)', transition: 'transform 0.3s ease' }} />
              Show less
            </button>
          </div>
        )}
      </div>

      {/* Land Information */}
      <div style={{
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
          letterSpacing: '-0.01em'
        }}>
          Land Information
        </h3>

        {/* Initial Two-Column Row: APN and Lot Size */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '12px'
        }}>
          {initialLandDetails.map((detail, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
                animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)'
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)'
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.15)'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.1)'
              }}
            >
              {/* Help Icon */}
              <button
                onMouseEnter={() => setHelpTooltip(detail.label)}
                onMouseLeave={() => setHelpTooltip(null)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'help',
                  padding: 0,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  e.currentTarget.style.borderColor = '#10b981'
                  e.currentTarget.style.transform = 'scale(1.15)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)'
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.1)'
                }}
              >
                <Info size={12} style={{ color: '#10b981', transition: 'color 0.3s ease' }} />
              </button>
              
              {/* Tooltip */}
              {helpTooltip === detail.label && (
                <div style={{
                  position: 'absolute',
                  top: '36px',
                  right: '0',
                  zIndex: 1000,
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  maxWidth: '250px',
                  minWidth: '150px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(16, 185, 129, 0.2)',
                  whiteSpace: 'normal',
                  lineHeight: '1.5',
                  pointerEvents: 'none',
                  animation: 'fadeInUp 0.2s ease-out',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  {detail.help}
                </div>
              )}

              <div style={{
                fontSize: '11px',
                color: '#10b981',
                fontWeight: 600,
                marginBottom: '6px',
                paddingRight: '32px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {detail.label}:
              </div>
              <div style={{
                fontSize: '20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 700
              }}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>

        {/* Click for More Button */}
        {!showMoreLandInfo && (
          <button
            onClick={() => handleExpand(setShowMoreLandInfo, showMoreLandInfo)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
              width: 'fit-content'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <ChevronDown size={14} />
            Click for more
          </button>
        )}

        {/* Expanded Land Details Section */}
        {showMoreLandInfo && (
          <div 
            data-expanded-section
            style={{
              marginTop: '16px',
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(5, 150, 105, 0.03) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.1)',
              animation: 'fadeInUp 0.4s ease-out'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              {moreLandDetails.map((detail, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    padding: '12px 14px',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    transition: 'all 0.3s ease',
                    animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Help Icon */}
                  <button
                    onMouseEnter={() => setHelpTooltip(detail.label)}
                    onMouseLeave={() => setHelpTooltip(null)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'help',
                      padding: 0,
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.transform = 'scale(1.2) rotate(360deg)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                      e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)'
                    }}
                  >
                    <Info size={11} style={{ color: '#6366f1', transition: 'color 0.3s ease' }} />
                  </button>
                  
                  {/* Tooltip */}
                  {helpTooltip === detail.label && (
                    <div style={{
                      position: 'absolute',
                      top: '32px',
                      right: '0',
                      zIndex: 1000,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      maxWidth: '250px',
                      minWidth: '150px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)',
                      whiteSpace: 'normal',
                      lineHeight: '1.5',
                      pointerEvents: 'none',
                      animation: 'fadeInUp 0.2s ease-out',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      {detail.help}
                    </div>
                  )}

                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: 500,
                    marginBottom: '4px',
                    paddingRight: '26px'
                  }}>
                    {detail.label}:
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#111827',
                    fontWeight: 500
                  }}>
                    {detail.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Collapse Button */}
            <button
              onClick={() => handleExpand(setShowMoreLandInfo, showMoreLandInfo)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                marginTop: '16px',
                border: 'none',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                borderRadius: '8px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'
                e.currentTarget.style.color = '#374151'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                e.currentTarget.style.color = '#6b7280'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(180deg)', transition: 'transform 0.3s ease' }} />
              Show less
            </button>
          </div>
        )}
      </div>

      {/* Tax Information */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
          letterSpacing: '-0.01em'
        }}>
          Tax Information
        </h3>

        {/* Initial Two-Column Row: Tax delinquent? and Tax delinquent year */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '12px'
        }}>
          {initialTaxDetails.map((detail, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(219, 39, 119, 0.05) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(236, 72, 153, 0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 8px rgba(236, 72, 153, 0.1)',
                animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.1) 100%)'
                e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.3)'
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(236, 72, 153, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(219, 39, 119, 0.05) 100%)'
                e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.15)'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(236, 72, 153, 0.1)'
              }}
            >
              {/* Help Icon */}
              <button
                onMouseEnter={() => setHelpTooltip(detail.label)}
                onMouseLeave={() => setHelpTooltip(null)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '1px solid rgba(236, 72, 153, 0.2)',
                  background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'help',
                  padding: 0,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(236, 72, 153, 0.1)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                  e.currentTarget.style.borderColor = '#ec4899'
                  e.currentTarget.style.transform = 'scale(1.15)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)'
                  e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(236, 72, 153, 0.1)'
                }}
              >
                <Info size={12} style={{ color: '#ec4899', transition: 'color 0.3s ease' }} />
              </button>
              
              {/* Tooltip */}
              {helpTooltip === detail.label && (
                <div style={{
                  position: 'absolute',
                  top: '36px',
                  right: '0',
                  zIndex: 1000,
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  maxWidth: '250px',
                  minWidth: '150px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(236, 72, 153, 0.2)',
                  whiteSpace: 'normal',
                  lineHeight: '1.5',
                  pointerEvents: 'none',
                  animation: 'fadeInUp 0.2s ease-out',
                  border: '1px solid rgba(236, 72, 153, 0.3)'
                }}>
                  {detail.help}
                </div>
              )}

              <div style={{
                fontSize: '11px',
                color: '#ec4899',
                fontWeight: 600,
                marginBottom: '6px',
                paddingRight: '32px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {detail.label}:
              </div>
              <div style={{
                fontSize: '20px',
                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 700
              }}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>

        {/* Click for More Button */}
        {!showMoreTaxInfo && (
          <button
            onClick={() => handleExpand(setShowMoreTaxInfo, showMoreTaxInfo)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
              width: 'fit-content'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <ChevronDown size={14} />
            Click for more
          </button>
        )}

        {/* Expanded Tax Details Section */}
        {showMoreTaxInfo && (
          <div 
            data-expanded-section
            style={{
              marginTop: '16px',
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.03) 0%, rgba(219, 39, 119, 0.03) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(236, 72, 153, 0.1)',
              animation: 'fadeInUp 0.4s ease-out'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              {moreTaxDetails.map((detail, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    padding: '12px 14px',
                    background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
                    borderRadius: '8px',
                    border: '1px solid rgba(236, 72, 153, 0.1)',
                    transition: 'all 0.3s ease',
                    animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)'
                    e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.3)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)'
                    e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Help Icon */}
                  <button
                    onMouseEnter={() => setHelpTooltip(detail.label)}
                    onMouseLeave={() => setHelpTooltip(null)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'help',
                      padding: 0,
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.transform = 'scale(1.2) rotate(360deg)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                      e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)'
                    }}
                  >
                    <Info size={11} style={{ color: '#6366f1', transition: 'color 0.3s ease' }} />
                  </button>
                  
                  {/* Tooltip */}
                  {helpTooltip === detail.label && (
                    <div style={{
                      position: 'absolute',
                      top: '32px',
                      right: '0',
                      zIndex: 1000,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      maxWidth: '250px',
                      minWidth: '150px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)',
                      whiteSpace: 'normal',
                      lineHeight: '1.5',
                      pointerEvents: 'none',
                      animation: 'fadeInUp 0.2s ease-out',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      {detail.help}
                    </div>
                  )}

                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: 500,
                    marginBottom: '4px',
                    paddingRight: '26px'
                  }}>
                    {detail.label}:
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#111827',
                    fontWeight: 500
                  }}>
                    {detail.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Collapse Button */}
            <button
              onClick={() => handleExpand(setShowMoreTaxInfo, showMoreTaxInfo)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                marginTop: '16px',
                border: 'none',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                borderRadius: '8px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'
                e.currentTarget.style.color = '#374151'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                e.currentTarget.style.color = '#6b7280'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <ChevronDown size={16} style={{ transform: 'rotate(180deg)', transition: 'transform 0.3s ease' }} />
              Show less
            </button>
          </div>
        )}
      </div>
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

