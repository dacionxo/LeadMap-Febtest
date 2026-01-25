'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Filter
} from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Checkbox } from '@/app/components/ui/checkbox'

interface FilterGroup {
  id: string
  title: string
  type: 'multi-select' | 'checkbox' | 'range' | 'text'
  options?: Array<{ label: string; value: string; count?: number }>
  category: 'person' | 'company' | 'property'
  pinned?: boolean
}

interface ProspectFilterSidebarProps {
  filters: Record<string, any>
  onFiltersChange: (filters: Record<string, any>) => void
  totalCount: number
  netNewCount: number
  savedCount: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  listings?: any[]
  isDark?: boolean
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'status',
    title: 'Status',
    type: 'multi-select',
    category: 'property',
    options: [
      { label: 'Active', value: 'active', count: 0 },
      { label: 'Expired', value: 'expired', count: 0 },
      { label: 'Sold', value: 'sold', count: 0 },
      { label: 'Pending', value: 'pending', count: 0 }
    ]
  },
  {
    id: 'price_range',
    title: 'Price Range',
    type: 'range',
    category: 'property',
    pinned: true
  },
  {
    id: 'location',
    title: 'Location',
    type: 'multi-select',
    category: 'property',
    options: [],
    pinned: true
  },
  {
    id: 'beds',
    title: 'Bedrooms',
    type: 'multi-select',
    category: 'property',
    options: [
      { label: '1', value: '1', count: 0 },
      { label: '2', value: '2', count: 0 },
      { label: '3', value: '3', count: 0 },
      { label: '4', value: '4', count: 0 },
      { label: '5+', value: '5+', count: 0 }
    ]
  },
  {
    id: 'baths',
    title: 'Bathrooms',
    type: 'multi-select',
    category: 'property',
    options: [
      { label: '1', value: '1', count: 0 },
      { label: '2', value: '2', count: 0 },
      { label: '3', value: '3', count: 0 },
      { label: '4+', value: '4+', count: 0 }
    ]
  },
  {
    id: 'sqft',
    title: 'Square Footage',
    type: 'range',
    category: 'property'
  },
  {
    id: 'year_built',
    title: 'Year Built',
    type: 'range',
    category: 'property'
  },
  {
    id: 'ai_score',
    title: 'AI Investment Score',
    type: 'range',
    category: 'property',
    pinned: true
  },
  {
    id: 'agent_name',
    title: 'Agent Name',
    type: 'text',
    category: 'person'
  },
  {
    id: 'agent_email',
    title: 'Has Agent Email',
    type: 'checkbox',
    category: 'person'
  },
  {
    id: 'agent_phone',
    title: 'Has Agent Phone',
    type: 'checkbox',
    category: 'person'
  },
  {
    id: 'enriched',
    title: 'Enriched',
    type: 'checkbox',
    category: 'property',
    pinned: true
  },
  {
    id: 'high_value',
    title: 'High Value ($500K+)',
    type: 'checkbox',
    category: 'property'
  },
  {
    id: 'price_drop',
    title: 'Price Reduction',
    type: 'checkbox',
    category: 'property'
  }
]

export default function ProspectFilterSidebar({
  filters,
  onFiltersChange,
  totalCount,
  netNewCount,
  savedCount,
  isCollapsed,
  onToggleCollapse,
  listings = [],
  isDark = false
}: ProspectFilterSidebarProps) {
  const [filterType, setFilterType] = useState<'person' | 'company' | 'property' | 'all'>('all')
  const [pinnedFilters, setPinnedFilters] = useState<Set<string>>(new Set(['price_range', 'location', 'ai_score', 'enriched']))
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['status', 'price_range', 'location']))
  const [filterSearch, setFilterSearch] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [locationSearch, setLocationSearch] = useState<Record<'city' | 'state' | 'zip_code', string>>({
    city: '',
    state: '',
    zip_code: ''
  })
  const [debouncedLocationSearch, setDebouncedLocationSearch] = useState<Record<'city' | 'state' | 'zip_code', string>>({
    city: '',
    state: '',
    zip_code: ''
  })
  const [activeLocationTab, setActiveLocationTab] = useState<'city' | 'state' | 'zip_code'>('city')

  // Debounce location search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocationSearch({ ...locationSearch })
    }, 300)
    return () => clearTimeout(timer)
  }, [locationSearch])

  // Calculate city options from listings
  const cityOptions = useMemo(() => {
    const cities = new Map<string, number>()
    
    listings.forEach(listing => {
      if (listing.city) {
        const city = listing.city.trim()
        if (city) {
          cities.set(city, (cities.get(city) || 0) + 1)
        }
      }
    })

    return Array.from(cities.entries())
      .map(([label, count]) => ({ label, value: label, count }))
      .filter(option => 
        !debouncedLocationSearch.city || 
        option.label.toLowerCase().includes(debouncedLocationSearch.city.toLowerCase())
      )
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.label.localeCompare(b.label)
      })
      .slice(0, 50)
  }, [listings, debouncedLocationSearch.city])

  // Calculate state options from listings
  const stateOptions = useMemo(() => {
    const states = new Map<string, number>()
    
    listings.forEach(listing => {
      if (listing.state) {
        const state = listing.state.trim()
        if (state) {
          states.set(state, (states.get(state) || 0) + 1)
        }
      }
    })

    return Array.from(states.entries())
      .map(([label, count]) => ({ label, value: label, count }))
      .filter(option => 
        !debouncedLocationSearch.state || 
        option.label.toLowerCase().includes(debouncedLocationSearch.state.toLowerCase())
      )
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.label.localeCompare(b.label)
      })
      .slice(0, 50)
  }, [listings, debouncedLocationSearch.state])

  // Calculate zip code options from listings
  const zipCodeOptions = useMemo(() => {
    const zipCodes = new Map<string, number>()
    
    listings.forEach(listing => {
      if (listing.zip_code) {
        const zip = String(listing.zip_code).trim()
        if (zip) {
          zipCodes.set(zip, (zipCodes.get(zip) || 0) + 1)
        }
      }
    })

    return Array.from(zipCodes.entries())
      .map(([label, count]) => ({ label, value: label, count }))
      .filter(option => 
        !debouncedLocationSearch.zip_code || 
        option.label.includes(debouncedLocationSearch.zip_code)
      )
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.label.localeCompare(b.label)
      })
      .slice(0, 50)
  }, [listings, debouncedLocationSearch.zip_code])

  // Calculate filter option counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    
    counts.status = {
      active: listings.filter(l => l.active === true).length,
      expired: listings.filter(l => l.status?.toLowerCase().includes('expired')).length,
      sold: listings.filter(l => l.status?.toLowerCase().includes('sold')).length,
      pending: listings.filter(l => l.status?.toLowerCase().includes('pending')).length
    }

    counts.beds = {
      '1': listings.filter(l => (l.beds || 0) === 1).length,
      '2': listings.filter(l => (l.beds || 0) === 2).length,
      '3': listings.filter(l => (l.beds || 0) === 3).length,
      '4': listings.filter(l => (l.beds || 0) === 4).length,
      '5+': listings.filter(l => (l.beds || 0) >= 5).length
    }

    counts.baths = {
      '1': listings.filter(l => (l.full_baths || 0) === 1).length,
      '2': listings.filter(l => (l.full_baths || 0) === 2).length,
      '3': listings.filter(l => (l.full_baths || 0) === 3).length,
      '4+': listings.filter(l => (l.full_baths || 0) >= 4).length
    }

    return counts
  }, [listings])

  const visibleFilters = useMemo(() => {
    let filtered = FILTER_GROUPS.filter(fg => {
      if (filterType !== 'all' && fg.category !== filterType) return false
      if (filterSearch && !fg.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
      return true
    })

    const pinned = filtered.filter(f => pinnedFilters.has(f.id))
    const unpinned = filtered.filter(f => !pinnedFilters.has(f.id))
    const visibleUnpinned = showMoreFilters ? unpinned : unpinned.slice(0, 5)

    return [...pinned, ...visibleUnpinned]
  }, [filterType, filterSearch, pinnedFilters, showMoreFilters])

  const togglePin = (filterId: string) => {
    setPinnedFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
  }

  const toggleExpand = (filterId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
  }

  const updateFilter = (filterId: string, value: any) => {
    if (value === undefined || value === null || value === '' || 
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && !Array.isArray(value) && 
         (!value.min && !value.max))) {
      const newFilters = { ...filters }
      delete newFilters[filterId]
      onFiltersChange(newFilters)
    } else {
      onFiltersChange({
        ...filters,
        [filterId]: value
      })
    }
  }

  const clearFilter = (filterId: string) => {
    const newFilters = { ...filters }
    
    if (filterId === 'location') {
      delete newFilters.city
      delete newFilters.state
      delete newFilters.zip_code
      setLocationSearch({ city: '', state: '', zip_code: '' })
    } else {
      delete newFilters[filterId]
    }
    
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    onFiltersChange({})
  }

  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key]
    if (key === 'location') {
      return (filters.city && filters.city.length > 0) || 
             (filters.state && filters.state.length > 0) || 
             (filters.zip_code && filters.zip_code.length > 0)
    }
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object' && value !== null) {
      return value.min !== undefined || value.max !== undefined
    }
    return value !== undefined && value !== null && value !== ''
  }).length

  if (isCollapsed) {
    return (
      <div className={cn(
        "w-12 flex flex-col items-center p-2 gap-2",
        "bg-white dark:bg-dark border-r border-ld",
        "shadow-sm"
      )}>
        <button
          onClick={onToggleCollapse}
          className={cn(
            "p-2 rounded-md",
            "hover:bg-lightprimary dark:hover:bg-lightprimary",
            "transition-colors duration-200"
          )}
          title="Show Filters"
          aria-label="Show Filters"
        >
          <Filter className="h-5 w-5 text-ld" />
        </button>
        {activeFiltersCount > 0 && (
          <div className={cn(
            "min-w-[20px] h-5 rounded-full",
            "bg-primary text-white",
            "flex items-center justify-center",
            "text-xs font-semibold px-1.5"
          )}>
            {activeFiltersCount}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "w-80 flex flex-col h-full overflow-hidden",
      "bg-white dark:bg-dark border-r border-ld",
      "shadow-sm"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b border-ld",
        "flex items-center justify-between",
        "bg-white dark:bg-dark"
      )}>
        <h3 className={cn(
          "text-lg font-semibold",
          "text-dark dark:text-white"
        )}>
          Search Filters
        </h3>
        <button
          onClick={onToggleCollapse}
          className={cn(
            "p-1.5 rounded-md",
            "hover:bg-lightprimary dark:hover:bg-lightprimary",
            "transition-colors duration-200"
          )}
          title="Hide Filters"
          aria-label="Hide Filters"
        >
          <X className="h-4 w-4 text-bodytext dark:text-white/70" />
        </button>
      </div>

      {/* Summary Stats */}
      <div className={cn(
        "px-4 py-3 border-b border-ld",
        "flex gap-4",
        "bg-white dark:bg-dark"
      )}>
        <div className="flex-1 text-center">
          <div className={cn(
            "text-xl font-bold",
            "text-dark dark:text-white"
          )}>
            {totalCount.toLocaleString()}
          </div>
          <div className={cn(
            "text-xs",
            "text-bodytext dark:text-white/70"
          )}>
            Total
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className={cn(
            "text-xl font-bold",
            "text-dark dark:text-white"
          )}>
            {netNewCount.toLocaleString()}
          </div>
          <div className={cn(
            "text-xs",
            "text-bodytext dark:text-white/70"
          )}>
            Net New
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className={cn(
            "text-xl font-bold",
            "text-dark dark:text-white"
          )}>
            {savedCount.toLocaleString()}
          </div>
          <div className={cn(
            "text-xs",
            "text-bodytext dark:text-white/70"
          )}>
            Saved
          </div>
        </div>
      </div>

      {/* Filter Search */}
      <div className={cn(
        "px-4 py-3 border-b border-ld",
        "relative",
        "bg-white dark:bg-dark"
      )}>
        <Search className={cn(
          "absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4",
          "text-bodytext dark:text-white/50",
          "pointer-events-none"
        )} />
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Search filters..."
          className={cn(
            "w-full pl-9 pr-3 py-2 rounded-md",
            "border border-ld bg-white dark:bg-dark",
            "text-sm text-ld",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "transition-all duration-200"
          )}
        />
      </div>

      {/* Filter Type Selector */}
      <div className={cn(
        "px-4 py-3 border-b border-ld",
        "bg-white dark:bg-dark"
      )}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          aria-label="Filter type"
          className={cn(
            "w-full px-3 py-2 rounded-md",
            "border border-ld bg-white dark:bg-dark",
            "text-sm text-ld",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "cursor-pointer transition-all duration-200"
          )}
        >
          <option value="all">All Filters</option>
          <option value="property">Property Info</option>
          <option value="person">Person Info</option>
          <option value="company">Company Info</option>
        </select>
      </div>

      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <div className={cn(
          "px-4 py-3 border-b border-ld",
          "bg-lightprimary dark:bg-lightprimary/20"
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              "text-xs font-medium",
              "text-dark dark:text-white"
            )}>
              {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
            </span>
            <button
              onClick={clearAllFilters}
              className={cn(
                "px-2 py-1 text-xs underline",
                "text-primary hover:text-primary/80",
                "transition-colors duration-200"
              )}
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Filter Groups */}
      <div className={cn(
        "flex-1 overflow-y-auto p-2",
        "bg-gray-50 dark:bg-gray-900/50"
      )}>
        {visibleFilters.map((filterGroup) => {
          const isExpanded = expandedGroups.has(filterGroup.id)
          const isPinned = pinnedFilters.has(filterGroup.id)
          const filterValue = filters[filterGroup.id]

          return (
            <div
              key={filterGroup.id}
              className={cn(
                "mb-1 border rounded-md",
                "border-ld",
                isPinned 
                  ? "bg-yellow-50/50 dark:bg-yellow-900/10" 
                  : "bg-white dark:bg-dark",
                "shadow-sm"
              )}
            >
              {/* Filter Header */}
              <div
                className={cn(
                  "px-3 py-2 flex items-center justify-between",
                  "cursor-pointer select-none",
                  "hover:bg-lightprimary dark:hover:bg-lightprimary/20",
                  "transition-colors duration-200"
                )}
                onClick={() => toggleExpand(filterGroup.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-bodytext dark:text-white/50 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-bodytext dark:text-white/50 flex-shrink-0" />
                  )}
                  <span className={cn(
                    "text-sm font-medium truncate",
                    "text-dark dark:text-white"
                  )}>
                    {filterGroup.title}
                  </span>
                  {(() => {
                    if (filterGroup.id === 'location') {
                      const cityCount = Array.isArray(filters.city) ? filters.city.length : 0
                      const stateCount = Array.isArray(filters.state) ? filters.state.length : 0
                      const zipCount = Array.isArray(filters.zip_code) ? filters.zip_code.length : 0
                      const totalCount = cityCount + stateCount + zipCount
                      return totalCount > 0 ? (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          "bg-primary text-white",
                          "flex-shrink-0"
                        )}>
                          {totalCount}
                        </span>
                      ) : null
                    }
                    return filterValue ? (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-xs font-medium",
                        "bg-primary text-white",
                        "flex-shrink-0"
                      )}>
                        {Array.isArray(filterValue) ? filterValue.length : 1}
                      </span>
                    ) : null
                  })()}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(filterGroup.id)
                  }}
                  className={cn(
                    "p-1 rounded hover:bg-lightprimary dark:hover:bg-lightprimary/20",
                    "transition-colors duration-200",
                    "flex-shrink-0"
                  )}
                  title={isPinned ? 'Unpin filter' : 'Pin filter'}
                  aria-label={isPinned ? 'Unpin filter' : 'Pin filter'}
                >
                  {isPinned ? (
                    <Pin className={cn(
                      "h-4 w-4",
                      "text-primary"
                    )} />
                  ) : (
                    <PinOff className={cn(
                      "h-4 w-4",
                      "text-bodytext dark:text-white/50"
                    )} />
                  )}
                </button>
              </div>

              {/* Filter Content */}
              {isExpanded && (
                <div className={cn(
                  "px-3 py-3 border-t border-ld",
                  "bg-white dark:bg-dark"
                )}>
                  {filterGroup.type === 'multi-select' && (
                    <div className="flex flex-col gap-2">
                      {filterGroup.id === 'location' ? (
                        <>
                          {/* Location Type Tabs */}
                          <div className={cn(
                            "flex gap-1 border-b border-ld mb-2"
                          )}>
                            {(['city', 'state', 'zip_code'] as const).map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setActiveLocationTab(tab)}
                                className={cn(
                                  "flex-1 px-2 py-1 text-xs font-medium",
                                  "border-b-2 transition-colors duration-200",
                                  activeLocationTab === tab
                                    ? "border-primary text-primary"
                                    : "border-transparent text-bodytext dark:text-white/70 hover:text-primary"
                                )}
                              >
                                {tab === 'zip_code' ? 'Zip Code' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                              </button>
                            ))}
                          </div>
                          
                          {/* Search input for active tab */}
                          <div className="relative mb-2">
                            <Search className={cn(
                              "absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4",
                              "text-bodytext dark:text-white/50",
                              "pointer-events-none"
                            )} />
                            <input
                              type="text"
                              value={locationSearch[activeLocationTab]}
                              onChange={(e) => setLocationSearch(prev => ({ ...prev, [activeLocationTab]: e.target.value }))}
                              placeholder={`Search ${activeLocationTab === 'zip_code' ? 'zip codes' : activeLocationTab + 's'}...`}
                              className={cn(
                                "w-full pl-8 pr-2 py-1.5 rounded-md text-sm",
                                "border border-ld bg-white dark:bg-dark",
                                "text-ld",
                                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                                "transition-all duration-200"
                              )}
                            />
                          </div>
                          
                          {/* Options list for active tab */}
                          <div className="max-h-[200px] overflow-y-auto">
                            {(() => {
                              const options = activeLocationTab === 'city' ? cityOptions 
                                            : activeLocationTab === 'state' ? stateOptions 
                                            : zipCodeOptions
                              const currentFilterValue = filters[activeLocationTab] || []
                              
                              return options.length > 0 ? (
                                options.map((option) => {
                                  const isSelected = Array.isArray(currentFilterValue) && currentFilterValue.includes(option.value)
                                  return (
                                    <label
                                      key={option.value}
                                      className={cn(
                                        "flex items-center gap-2 cursor-pointer",
                                        "px-2 py-1 rounded",
                                        isSelected && "bg-lightprimary dark:bg-lightprimary/20"
                                      )}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                          const current = Array.isArray(currentFilterValue) ? currentFilterValue : []
                                          if (checked) {
                                            updateFilter(activeLocationTab, [...current, option.value])
                                          } else {
                                            updateFilter(activeLocationTab, current.filter(v => v !== option.value))
                                          }
                                        }}
                                      />
                                      <span className={cn(
                                        "text-sm flex-1",
                                        "text-dark dark:text-white"
                                      )}>
                                        {option.label}
                                      </span>
                                      {option.count !== undefined && (
                                        <span className={cn(
                                          "text-xs",
                                          "text-bodytext dark:text-white/70"
                                        )}>
                                          {option.count.toLocaleString()}
                                        </span>
                                      )}
                                    </label>
                                  )
                                })
                              ) : (
                                <div className={cn(
                                  "px-2 py-2 text-sm text-center",
                                  "text-bodytext dark:text-white/70"
                                )}>
                                  No {activeLocationTab === 'zip_code' ? 'zip codes' : activeLocationTab + 's'} found
                                </div>
                              )
                            })()}
                          </div>
                        </>
                      ) : filterGroup.options ? (
                        filterGroup.options.map((option) => {
                          const isSelected = Array.isArray(filterValue) && filterValue.includes(option.value)
                          const count = filterCounts[filterGroup.id]?.[option.value] ?? option.count ?? 0
                          return (
                            <label
                              key={option.value}
                              className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                "px-2 py-1 rounded",
                                isSelected && "bg-lightprimary dark:bg-lightprimary/20"
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  const current = Array.isArray(filterValue) ? filterValue : []
                                  if (checked) {
                                    updateFilter(filterGroup.id, [...current, option.value])
                                  } else {
                                    updateFilter(filterGroup.id, current.filter(v => v !== option.value))
                                  }
                                }}
                              />
                              <span className={cn(
                                "text-sm flex-1",
                                "text-dark dark:text-white"
                              )}>
                                {option.label}
                              </span>
                              {count > 0 && (
                                <span className={cn(
                                  "text-xs",
                                  "text-bodytext dark:text-white/70"
                                )}>
                                  {count.toLocaleString()}
                                </span>
                              )}
                            </label>
                          )
                        })
                      ) : null}
                    </div>
                  )}

                  {filterGroup.type === 'checkbox' && (
                    <label className={cn(
                      "flex items-center gap-2 cursor-pointer"
                    )}>
                      <Checkbox
                        checked={!!filterValue}
                        onCheckedChange={(checked) => updateFilter(filterGroup.id, checked || undefined)}
                      />
                      <span className={cn(
                        "text-sm",
                        "text-dark dark:text-white"
                      )}>
                        {filterGroup.title}
                      </span>
                    </label>
                  )}

                  {filterGroup.type === 'range' && (
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className={cn(
                          "block text-xs mb-1",
                          "text-bodytext dark:text-white/70"
                        )}>
                          Min{filterGroup.id === 'price_range' ? ' ($)' : filterGroup.id === 'sqft' ? ' (sqft)' : filterGroup.id === 'ai_score' ? ' (0-100)' : filterGroup.id === 'year_built' ? ' (year)' : ''}
                        </label>
                        <input
                          type="number"
                          value={filterValue?.min !== undefined ? filterValue.min : ''}
                          onChange={(e) => {
                            const value = e.target.value
                            updateFilter(filterGroup.id, {
                              ...filterValue,
                              min: value ? (filterGroup.id === 'year_built' ? parseInt(value) : parseFloat(value)) : undefined
                            })
                          }}
                          placeholder={filterGroup.id === 'price_range' ? 'e.g. 100000' : filterGroup.id === 'year_built' ? 'e.g. 1950' : 'Min'}
                          min={filterGroup.id === 'ai_score' ? 0 : filterGroup.id === 'year_built' ? 1800 : undefined}
                          max={filterGroup.id === 'ai_score' ? 100 : filterGroup.id === 'year_built' ? new Date().getFullYear() : undefined}
                          className={cn(
                            "w-full px-2 py-1.5 rounded-md text-sm",
                            "border border-ld bg-white dark:bg-dark",
                            "text-ld",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                            "transition-all duration-200"
                          )}
                        />
                      </div>
                      <div>
                        <label className={cn(
                          "block text-xs mb-1",
                          "text-bodytext dark:text-white/70"
                        )}>
                          Max{filterGroup.id === 'price_range' ? ' ($)' : filterGroup.id === 'sqft' ? ' (sqft)' : filterGroup.id === 'ai_score' ? ' (0-100)' : filterGroup.id === 'year_built' ? ' (year)' : ''}
                        </label>
                        <input
                          type="number"
                          value={filterValue?.max !== undefined ? filterValue.max : ''}
                          onChange={(e) => {
                            const value = e.target.value
                            updateFilter(filterGroup.id, {
                              ...filterValue,
                              max: value ? (filterGroup.id === 'year_built' ? parseInt(value) : parseFloat(value)) : undefined
                            })
                          }}
                          placeholder={filterGroup.id === 'price_range' ? 'e.g. 500000' : filterGroup.id === 'year_built' ? 'e.g. 2024' : 'Max'}
                          min={filterGroup.id === 'ai_score' ? 0 : filterGroup.id === 'year_built' ? 1800 : undefined}
                          max={filterGroup.id === 'ai_score' ? 100 : filterGroup.id === 'year_built' ? new Date().getFullYear() : undefined}
                          className={cn(
                            "w-full px-2 py-1.5 rounded-md text-sm",
                            "border border-ld bg-white dark:bg-dark",
                            "text-ld",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                            "transition-all duration-200"
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {filterGroup.type === 'text' && (
                    <input
                      type="text"
                      value={filterValue || ''}
                      onChange={(e) => {
                        const value = e.target.value.trim()
                        updateFilter(filterGroup.id, value || undefined)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        }
                      }}
                      placeholder={`Enter ${filterGroup.title.toLowerCase()}...`}
                      className={cn(
                        "w-full px-2 py-1.5 rounded-md text-sm",
                        "border border-ld bg-white dark:bg-dark",
                        "text-ld",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                        "transition-all duration-200"
                      )}
                    />
                  )}

                  {filterValue && (
                    <button
                      onClick={() => clearFilter(filterGroup.id)}
                      className={cn(
                        "mt-2 px-2 py-1 text-xs underline",
                        "text-primary hover:text-primary/80",
                        "transition-colors duration-200"
                      )}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!showMoreFilters && visibleFilters.length >= 5 && (
          <button
            onClick={() => setShowMoreFilters(true)}
            className={cn(
              "w-full px-3 py-2 mt-2 rounded-md text-sm font-medium",
              "border border-ld bg-white dark:bg-dark",
              "text-ld",
              "hover:bg-lightprimary dark:hover:bg-lightprimary/20",
              "transition-colors duration-200"
            )}
          >
            More Filters ({FILTER_GROUPS.length - visibleFilters.length})
          </button>
        )}
      </div>
    </div>
  )
}
