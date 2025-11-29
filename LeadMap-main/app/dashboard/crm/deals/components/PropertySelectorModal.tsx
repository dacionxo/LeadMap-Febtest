'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Loader2, MapPin, DollarSign } from 'lucide-react'

interface Property {
  id: string
  listing_id: string
  display_name: string
  street?: string
  city?: string
  state?: string
  zip_code?: string
  property_url?: string
  list_price?: number
}

interface PropertySelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (property: Property) => void
  selectedPropertyId?: string | null
  isDark?: boolean
}

export default function PropertySelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedPropertyId,
  isDark = false,
}: PropertySelectorModalProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/crm/deals/properties', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch properties')
      }

      const data = await response.json()
      setProperties(data.data || [])
    } catch (err: any) {
      console.error('Error fetching properties:', err)
      setError(err.message || 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchProperties()
      setSearchQuery('')
    }
  }, [isOpen, fetchProperties])

  const filteredProperties = properties.filter((property) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      property.display_name.toLowerCase().includes(query) ||
      property.street?.toLowerCase().includes(query) ||
      property.city?.toLowerCase().includes(query) ||
      property.state?.toLowerCase().includes(query) ||
      property.zip_code?.toLowerCase().includes(query)
    )
  })

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Select Property
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search properties by address, city, state, or ZIP..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Properties List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading properties...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchProperties}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No properties found matching your search.' : 'No properties available.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProperties.map((property) => {
                const isSelected = selectedPropertyId === property.listing_id
                return (
                  <div
                    key={property.listing_id}
                    onClick={() => {
                      onSelect(property)
                      onClose()
                    }}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {property.display_name}
                          </h3>
                          {isSelected && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                              Selected
                            </span>
                          )}
                        </div>
                        {property.street && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                            {property.street}
                            {property.city && `, ${property.city}`}
                            {property.state && `, ${property.state}`}
                            {property.zip_code && ` ${property.zip_code}`}
                          </p>
                        )}
                      </div>
                      {property.list_price && (
                        <div className="flex items-center gap-2 ml-4">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatPrice(property.list_price)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

