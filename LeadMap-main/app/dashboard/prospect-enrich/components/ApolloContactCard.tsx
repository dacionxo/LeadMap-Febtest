'use client'

import { useState } from 'react'
import {
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  ExternalLink,
  DollarSign,
  Target,
  Bookmark,
  BookmarkCheck
} from 'lucide-react'
import SaveButton from './AddToCrmButton'

// Helper function to format bathroom count with proper decimal display
function formatBaths(baths: number | null | undefined): string {
  if (baths === null || baths === undefined) return '-'
  // Convert to number if it's a string
  const numBaths = typeof baths === 'string' ? parseFloat(baths) : baths
  if (isNaN(numBaths)) return '-'
  // Remove trailing zeros for whole numbers, keep decimals for fractional values
  return numBaths % 1 === 0 ? numBaths.toString() : numBaths.toFixed(1)
}

// Helper function to extract description from other JSONB field
function getDescription(listing: Listing): string {
  // First, try to get description from other JSONB field
  if (listing.other) {
    try {
      const other = typeof listing.other === 'string' ? JSON.parse(listing.other) : listing.other
      // Try common keys for description in JSONB
      const description = other?.description || other?.Description || other?.listing_description || other?.property_description || other?.text
      if (description && typeof description === 'string' && description.trim()) {
        return description
      }
    } catch (error) {
      // If JSON parsing fails, continue to fallback
      console.warn('Failed to parse other JSONB field:', error)
    }
  }
  // Fallback to text field if nothing found in other JSONB
  return listing.text || '-'
}

interface Listing {
  listing_id: string
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  list_price?: number | null
  beds?: number | null
  full_baths?: number | null
  sqft?: number | null
  status?: string | null
  active?: boolean
  ai_investment_score?: number | null
  agent_email?: string | null
  agent_phone?: string | null
  agent_name?: string | null
  agent_phone_2?: string | null
  listing_agent_phone_2?: string | null
  listing_agent_phone_5?: string | null
  /** Property description text from Supabase 'text' field (fallback) */
  text?: string | null
  /** Other JSONB field containing additional property data including description */
  other?: any
  year_built?: number | null
  last_sale_price?: number | null
  last_sale_date?: string | null
  created_at?: string
  property_url?: string | null | undefined
  in_crm?: boolean
  price_per_sqft?: number | null
}

interface ApolloContactCardProps {
  listing: Listing
  isSelected: boolean
  onSelect: (listingId: string, selected: boolean) => void
  columns?: string[]
  onAction?: (action: string, listing: Listing) => void
  onClick?: () => void
  isSaved?: boolean
  onSave?: (listing: Listing, saved: boolean) => void
  isDark?: boolean
  category?: string // Category to assign saved listings to
}

export default function ApolloContactCard({
  listing,
  isSelected,
  onSelect,
  columns = ['address', 'price', 'details', 'status', 'score', 'agent', 'actions'],
  onAction,
  onClick,
  isSaved = false,
  onSave,
  isDark = false,
  category
}: ApolloContactCardProps) {
  const [showActions, setShowActions] = useState(false)

  const streetAddress = listing.street || 'N/A'
  const cityStateZip = [listing.city, listing.state, listing.zip_code]
    .filter(Boolean)
    .join(', ') || ''

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'N/A'
    return `$${price.toLocaleString()}`
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 18px',
        borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid rgba(99, 102, 241, 0.08)',
        background: isSelected 
          ? (isDark 
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)')
          : (isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)'),
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        minHeight: '76px',
        minWidth: 'max-content',
        width: 'max-content',
        boxSizing: 'border-box',
        borderLeft: isSelected ? '4px solid #6366f1' : '4px solid transparent',
        boxShadow: isSelected 
          ? '0 4px 12px -2px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)' 
          : '0 1px 2px rgba(0, 0, 0, 0.02)'
      }}
      onMouseEnter={(e) => {
        setShowActions(true)
        if (!isSelected) {
          e.currentTarget.style.background = isDark
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.03) 100%)'
          e.currentTarget.style.borderLeft = '4px solid rgba(99, 102, 241, 0.5)'
          e.currentTarget.style.transform = 'translateX(4px)'
          e.currentTarget.style.boxShadow = isDark
            ? '0 4px 12px -2px rgba(99, 102, 241, 0.25)'
            : '0 4px 12px -2px rgba(99, 102, 241, 0.15)'
        }
      }}
      onMouseLeave={(e) => {
        setShowActions(false)
        if (!isSelected) {
          e.currentTarget.style.background = isDark
            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)'
          e.currentTarget.style.borderLeft = '4px solid transparent'
          e.currentTarget.style.transform = 'translateX(0)'
          e.currentTarget.style.boxShadow = isDark ? '0 1px 2px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.02)'
        }
      }}
    >
      {/* Checkbox */}
      <div style={{ marginRight: '16px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onSelect(listing.listing_id, e.target.checked)
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
            accentColor: '#6366f1',
            margin: 0
          }}
        />
      </div>

      {/* Address/Name Column - Apollo-style primary field */}
      {columns.includes('address') && (
        <div style={{ 
          flex: '0 0 280px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            marginBottom: '4px'
          }}>
            {/* Street Address - Top Line */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              lineHeight: '1.4'
            }}>
              <MapPin style={{ 
                width: '14px', 
                height: '14px', 
                color: isDark ? '#94a3b8' : '#6b7280', 
                flexShrink: 0
              }} />
              <span style={{ 
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: isDark ? '#e2e8f0' : '#111827',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {streetAddress}
              </span>
            </div>
            {/* City, State, Zip - Bottom Line */}
            {cityStateZip && (
              <div style={{
                paddingLeft: '20px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
                fontSize: '12px',
                fontWeight: 400,
                color: isDark ? '#94a3b8' : '#6b7280',
                letterSpacing: '-0.005em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '1.4'
              }}>
                {cityStateZip}
              </div>
            )}
          </div>
          {listing.property_url && (
            <a
              href={listing.property_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClick?.()
                onAction?.('view', listing)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '13px',
                color: isDark ? '#818cf8' : '#6366f1',
                textDecoration: 'none',
                fontWeight: 400,
                transition: 'color 0.15s ease',
                cursor: 'pointer',
                marginTop: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isDark ? '#a5b4fc' : '#4f46e5'
                e.currentTarget.style.textDecoration = 'underline'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isDark ? '#818cf8' : '#6366f1'
                e.currentTarget.style.textDecoration = 'none'
              }}
            >
              View Property
              <ExternalLink style={{ width: '12px', height: '12px' }} />
            </a>
          )}
        </div>
      )}

      {/* Price Column */}
      {columns.includes('price') && (
        <div style={{ 
          flex: '0 0 130px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <div style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '15px',
            fontWeight: 500,
            color: isDark ? '#e2e8f0' : '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            lineHeight: '1.4'
          }}>
            <DollarSign style={{ 
              width: '16px', 
              height: '16px', 
              color: isDark ? '#94a3b8' : '#6b7280',
              flexShrink: 0
            }} />
            <span>{formatPrice(listing.list_price)}</span>
          </div>
          {listing.price_per_sqft && (
            <div style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '13px',
              color: isDark ? '#94a3b8' : '#6b7280',
              marginTop: '2px'
            }}>
              ${listing.price_per_sqft.toLocaleString()}/sqft
            </div>
          )}
        </div>
      )}

      {/* Status Column */}
      {columns.includes('status') && (
        <div style={{ 
          flex: '0 0 120px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '12px',
            background: listing.active 
              ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5')
              : listing.status?.toLowerCase().includes('expired') || listing.status?.toLowerCase().includes('sold')
              ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
              : (isDark ? 'rgba(99, 102, 241, 0.15)' : '#f3f4f6'),
            color: listing.active
              ? (isDark ? '#10b981' : '#065f46')
              : listing.status?.toLowerCase().includes('expired') || listing.status?.toLowerCase().includes('sold')
              ? (isDark ? '#ef4444' : '#991b1b')
              : (isDark ? '#e2e8f0' : '#374151'),
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '12px',
            fontWeight: 500,
            lineHeight: '1.4'
          }}>
            {listing.status || (listing.active ? 'Active' : 'Inactive')}
          </span>
        </div>
      )}

      {/* AI Score Column */}
      {columns.includes('score') && (
        <div style={{ 
          flex: '0 0 100px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          {listing.ai_investment_score !== null && listing.ai_investment_score !== undefined ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Target style={{ 
                width: '16px', 
                height: '16px', 
                color: isDark ? '#818cf8' : '#6366f1',
                flexShrink: 0
              }} />
              <span style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '15px',
                fontWeight: 500,
                color: listing.ai_investment_score >= 70 
                  ? (isDark ? '#10b981' : '#059669')
                  : listing.ai_investment_score >= 50 
                  ? (isDark ? '#f59e0b' : '#d97706')
                  : (isDark ? '#94a3b8' : '#6b7280')
              }}>
                {listing.ai_investment_score.toFixed(1)}
              </span>
            </div>
          ) : (
            <span style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px',
              color: isDark ? '#64748b' : '#9ca3af'
            }}>
              -
            </span>
          )}
        </div>
      )}

      {/* Total Beds Column */}
      {columns.includes('beds') && (
        <div style={{ 
          flex: '0 0 100px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#374151'
          }}>
            {listing.beds ?? '-'}
          </span>
        </div>
      )}

      {/* Total Baths Column */}
      {columns.includes('full_baths') && (
        <div style={{ 
          flex: '0 0 110px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#374151'
          }}>
            {formatBaths(listing.full_baths)}
          </span>
        </div>
      )}

      {/* Housing Square Feet Column */}
      {columns.includes('sqft') && (
        <div style={{ 
          flex: '0 0 140px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#374151'
          }}>
            {listing.sqft ? listing.sqft.toLocaleString() : '-'}
          </span>
        </div>
      )}

      {/* Description Column - Property description from Supabase 'other' JSONB field */}
      {columns.includes('description') && (
        <div style={{ 
          flex: '0 0 200px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#e2e8f0' : '#374151',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4'
          }}>
            {getDescription(listing)}
          </span>
        </div>
      )}

      {/* Agent Name Column */}
      {columns.includes('agent_name') && (
        <div style={{ 
          flex: '0 0 150px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#374151',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block'
          }}>
            {listing.agent_name || '-'}
          </span>
        </div>
      )}

      {/* Agent Email Column */}
      {columns.includes('agent_email') && (
        <div style={{ 
          flex: '0 0 180px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#94a3b8' : '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block'
          }}>
            {listing.agent_email || '-'}
          </span>
        </div>
      )}

      {/* Agent Phone Column */}
      {columns.includes('agent_phone') && (
        <div style={{ 
          flex: '0 0 130px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#94a3b8' : '#6b7280'
          }}>
            {listing.agent_phone || '-'}
          </span>
        </div>
      )}

      {/* Agent Phone 2 Column */}
      {columns.includes('agent_phone_2') && (
        <div style={{ 
          flex: '0 0 130px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#94a3b8' : '#6b7280'
          }}>
            {listing.agent_phone_2 || '-'}
          </span>
        </div>
      )}

      {/* Listing Agent Phone 2 Column */}
      {columns.includes('listing_agent_phone_2') && (
        <div style={{ 
          flex: '0 0 160px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#94a3b8' : '#6b7280'
          }}>
            {listing.listing_agent_phone_2 || '-'}
          </span>
        </div>
      )}

      {/* Listing Agent Phone Column */}
      {columns.includes('listing_agent_phone_5') && (
        <div style={{ 
          flex: '0 0 160px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#94a3b8' : '#6b7280'
          }}>
            {listing.listing_agent_phone_5 || '-'}
          </span>
        </div>
      )}

      {/* Year Built Column */}
      {columns.includes('year_built') && (
        <div style={{ 
          flex: '0 0 100px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#374151'
          }}>
            {listing.year_built ?? '-'}
          </span>
        </div>
      )}

      {/* Last Sale Price Column */}
      {columns.includes('last_sale_price') && (
        <div style={{ 
          flex: '0 0 130px', 
          marginRight: '24px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            color: isDark ? '#e2e8f0' : '#374151'
          }}>
            {listing.last_sale_price ? formatPrice(listing.last_sale_price) : '-'}
          </span>
        </div>
      )}

      {/* Last Sale Date Column */}
      {columns.includes('last_sale_date') && (
        <div style={{ 
          flex: '0 0 130px', 
          marginRight: '24px',
          minWidth: 0
        }}>
          <span style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            color: isDark ? '#94a3b8' : '#6b7280'
          }}>
            {listing.last_sale_date ? new Date(listing.last_sale_date).toLocaleDateString() : '-'}
          </span>
        </div>
      )}

      {/* Actions Column - Apollo-style action icons */}
      {columns.includes('actions') && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexShrink: 0,
          width: '120px',
          justifyContent: 'flex-end',
          opacity: showActions ? 1 : 0.4,
          transition: 'opacity 0.15s ease'
        }}>
          {listing.agent_email && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAction?.('email', listing)
              }}
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                color: '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                width: '32px',
                height: '32px'
              }}
              title="Send Email"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
                e.currentTarget.style.color = '#374151'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#6b7280'
              }}
            >
              <Mail style={{ width: '18px', height: '18px' }} />
            </button>
          )}

          {listing.agent_phone && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAction?.('call', listing)
              }}
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                color: '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                width: '32px',
                height: '32px'
              }}
              title="Call"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
                e.currentTarget.style.color = '#374151'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#6b7280'
              }}
            >
              <Phone style={{ width: '18px', height: '18px' }} />
            </button>
          )}

          {/* Save/Unsave Button */}
          {onSave && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSave(listing, !isSaved)
              }}
              style={{
                padding: '6px',
                border: 'none',
                background: 'transparent',
                color: isSaved ? '#f59e0b' : '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                width: '32px',
                height: '32px'
              }}
              title={isSaved ? 'Unsave prospect' : 'Save prospect'}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6'
                e.currentTarget.style.color = isSaved ? '#d97706' : '#374151'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = isSaved ? '#f59e0b' : '#6b7280'
              }}
            >
              {isSaved ? (
                <BookmarkCheck style={{ width: '18px', height: '18px', fill: 'currentColor' }} />
              ) : (
                <Bookmark style={{ width: '18px', height: '18px' }} />
              )}
            </button>
          )}

          <SaveButton
            listing={listing}
            saved={listing.in_crm || isSaved}
            onSaved={() => {
              onSave?.(listing, true)
              onAction?.('save', listing)
            }}
            onUnsaved={() => {
              onSave?.(listing, false)
              onAction?.('unsave', listing)
            }}
            variant="icon"
            category={category}
          />

          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowActions(!showActions)
            }}
            style={{
              padding: '6px',
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              width: '32px',
              height: '32px'
            }}
            title="More Actions"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6'
              e.currentTarget.style.color = '#374151'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <MoreVertical style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      )}
    </div>
  )
}

