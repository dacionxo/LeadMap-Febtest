'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Mail } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saveListingsToCampaign } from '../utils/listUtils'

interface Campaign {
  id: string
  name: string
  status: string
  created_at?: string
  updated_at?: string
}

interface AddToCampaignModalProps {
  supabase: SupabaseClient
  profileId?: string
  selectedListings: Listing[]
  onClose: () => void
  onSuccess?: () => void
  isDark?: boolean
}

interface Listing {
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
}

export default function AddToCampaignModal({
  supabase,
  profileId,
  selectedListings,
  onClose,
  onSuccess,
  isDark = false
}: AddToCampaignModalProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    if (!profileId) {
      setCampaigns([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setCampaigns([])
        return
      }

      // Fetch campaigns from API
      const response = await fetch('/api/campaigns', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        console.error('Error loading campaigns')
        setCampaigns([])
        return
      }

      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error('Error:', err)
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!selectedCampaignId || !profileId) {
      alert('Please select a campaign')
      return
    }

    if (selectedListings.length === 0) {
      alert('No listings selected')
      return
    }

    try {
      setAdding(true)
      
      // Extract listing IDs from selected listings
      // Use listing_id first, fallback to property_url
      const listingIds = selectedListings
        .map(listing => {
          // Prefer listing_id, but use property_url if listing_id is not available
          return listing.listing_id || listing.property_url
        })
        .filter(Boolean) as string[]

      if (listingIds.length === 0) {
        alert('No valid listing IDs found')
        return
      }

      // Save listings to campaign using the utility function
      await saveListingsToCampaign(
        supabase,
        profileId,
        selectedCampaignId,
        listingIds
      )

      // Show success message
      alert(`Successfully added ${listingIds.length} listing(s) to campaign`)
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess()
      }
      
      // Close modal
      onClose()
    } catch (error: any) {
      console.error('Error adding to campaign:', error)
      alert(error.message || 'Failed to add listings to campaign')
    } finally {
      setAdding(false)
    }
  }

  // Filter campaigns by search query
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: isDark ? '#e2e8f0' : '#111827',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            Add to Campaign
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#6b7280',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{
          fontSize: '14px',
          color: isDark ? '#94a3b8' : '#6b7280',
          marginBottom: '20px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Add {selectedListings.length} selected listing{selectedListings.length > 1 ? 's' : ''} to a campaign
        </p>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#e2e8f0' : '#111827',
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          />
          <Mail 
            size={16} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: isDark ? '#94a3b8' : '#6b7280',
              pointerEvents: 'none'
            }} 
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              {filteredCampaigns.length === 0 ? (
                <div style={{
                  padding: '16px',
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#f3f4f6',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: isDark ? '#94a3b8' : '#6b7280',
                  fontSize: '14px'
                }}>
                  {searchQuery ? 'No campaigns match your search' : 'No campaigns found. Create a campaign first.'}
                </div>
              ) : (
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  {filteredCampaigns.map((campaign) => (
                    <label
                      key={campaign.id}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid #f3f4f6',
                        backgroundColor: selectedCampaignId === campaign.id
                          ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#f3f4f6')
                          : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCampaignId !== campaign.id) {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(99, 102, 241, 0.1)' : '#f9fafb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCampaignId !== campaign.id) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="campaign"
                        value={campaign.id}
                        checked={selectedCampaignId === campaign.id}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        style={{
                          marginRight: '12px',
                          accentColor: '#6366f1'
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{
                          color: isDark ? '#e2e8f0' : '#111827',
                          fontSize: '14px',
                          fontWeight: 500,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          {campaign.name}
                        </span>
                        <span style={{
                          color: isDark ? '#94a3b8' : '#6b7280',
                          fontSize: '12px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          textTransform: 'capitalize'
                        }}>
                          {campaign.status}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: isDark ? '#94a3b8' : '#6b7280',
                  border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!selectedCampaignId || adding}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !selectedCampaignId || adding ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  opacity: !selectedCampaignId || adding ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {adding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add to Campaign'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

