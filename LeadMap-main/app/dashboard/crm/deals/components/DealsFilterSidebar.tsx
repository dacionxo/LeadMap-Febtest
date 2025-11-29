'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Filter
} from 'lucide-react'

interface FilterGroup {
  id: string
  title: string
  type: 'multi-select' | 'checkbox' | 'range' | 'text'
  options?: Array<{ label: string; value: string; count?: number }>
  category: 'deal' | 'contact' | 'property'
  pinned?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

interface DealsFilterSidebarProps {
  filters: Record<string, any>
  onFiltersChange: (filters: Record<string, any>) => void
  totalCount: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  deals?: any[]
  pipelines?: Array<{ id: string; name: string; stages: string[] }>
  isDark?: boolean
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'pipeline',
    title: 'Pipeline',
    type: 'multi-select',
    category: 'deal',
    pinned: true
  },
  {
    id: 'stage',
    title: 'Stage',
    type: 'multi-select',
    category: 'deal',
    pinned: true
  },
  {
    id: 'owner',
    title: 'Owner',
    type: 'multi-select',
    category: 'deal',
    pinned: true
  },
  {
    id: 'value',
    title: 'Deal Value',
    type: 'range',
    category: 'deal',
    pinned: true
  },
  {
    id: 'closed_date',
    title: 'Closed Date',
    type: 'range',
    category: 'deal'
  },
  {
    id: 'created_date',
    title: 'Created Date',
    type: 'range',
    category: 'deal'
  },
  {
    id: 'stage_updated_at',
    title: 'Stage Updated At',
    type: 'range',
    category: 'deal'
  },
  {
    id: 'next_step_updated_at',
    title: 'Next Step Updated At',
    type: 'range',
    category: 'deal'
  },
  {
    id: 'amount',
    title: 'Amount',
    type: 'range',
    category: 'deal'
  },
  {
    id: 'custom_fields',
    title: 'Custom Fields',
    type: 'text',
    category: 'deal'
  },
  {
    id: 'account_lists',
    title: 'Account Lists',
    type: 'multi-select',
    category: 'deal'
  },
  {
    id: 'location',
    title: 'Location',
    type: 'text',
    category: 'property'
  },
  {
    id: 'contact_company',
    title: 'Contact Company',
    type: 'text',
    category: 'contact'
  },
  {
    id: 'source',
    title: 'Source',
    type: 'multi-select',
    category: 'deal'
  },
  {
    id: 'tags',
    title: 'Tags',
    type: 'text',
    category: 'deal'
  },
  {
    id: 'probability',
    title: 'Probability',
    type: 'range',
    category: 'deal'
  },
  {
    id: 'csv_import',
    title: 'Deal CSV Import',
    type: 'checkbox',
    category: 'deal'
  },
  {
    id: 'workflows',
    title: 'Workflows',
    type: 'multi-select',
    category: 'deal'
  }
]

export default function DealsFilterSidebar({
  filters,
  onFiltersChange,
  totalCount,
  isCollapsed,
  onToggleCollapse,
  deals = [],
  pipelines = [],
  isDark = false
}: DealsFilterSidebarProps) {
  const [pinnedFilters, setPinnedFilters] = useState<Set<string>>(new Set(['pipeline', 'stage', 'owner', 'value']))
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [filterSearch, setFilterSearch] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [filterTypeDropdown, setFilterTypeDropdown] = useState(false)

  // Calculate net new and saved counts (for deals, we'll use different logic)
  const netNewCount = useMemo(() => {
    // Net new = deals created in last 30 days that aren't in lists
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return deals.filter(d => {
      const created = new Date(d.created_at)
      return created >= thirtyDaysAgo
    }).length
  }, [deals])

  const savedCount = useMemo(() => {
    // Saved = deals that are in lists (we'll need to check this differently)
    // For now, return a placeholder
    return deals.filter(d => d.tags && d.tags.length > 0).length
  }, [deals])

  // Get stage options from pipelines
  const stageOptions = useMemo(() => {
    const stages = new Set<string>()
    pipelines.forEach(pipeline => {
      pipeline.stages.forEach(stage => stages.add(stage))
    })
    return Array.from(stages).map(stage => ({
      label: stage,
      value: stage,
      count: deals.filter(d => d.stage === stage).length
    }))
  }, [pipelines, deals])

  // Get pipeline options
  const pipelineOptions = useMemo(() => {
    return pipelines.map(pipeline => ({
      label: pipeline.name,
      value: pipeline.id,
      count: deals.filter(d => d.pipeline_id === pipeline.id).length
    }))
  }, [pipelines, deals])

  // Get source options from deals
  const sourceOptions = useMemo(() => {
    const sources = new Set<string>()
    deals.forEach(deal => {
      if (deal.source) {
        sources.add(deal.source)
      }
    })
    return Array.from(sources).map(source => ({
      label: source,
      value: source,
      count: deals.filter(d => d.source === source).length
    })).sort((a, b) => b.count - a.count) // Sort by count descending
  }, [deals])

  const visibleFilters = useMemo(() => {
    let filtered = FILTER_GROUPS.filter(fg => {
      if (filterSearch && !fg.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
      return true
    })

    const pinned = filtered.filter(f => pinnedFilters.has(f.id))
    const unpinned = filtered.filter(f => !pinnedFilters.has(f.id))
    const visibleUnpinned = showMoreFilters ? unpinned : unpinned.slice(0, 5)

    return [...pinned, ...visibleUnpinned]
  }, [filterSearch, pinnedFilters, showMoreFilters])

  const remainingFiltersCount = FILTER_GROUPS.length - visibleFilters.length

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
    delete newFilters[filterId]
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    onFiltersChange({})
  }

  const activeFiltersCount = Object.keys(filters).length

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center p-2 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Show Filters"
        >
          <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        {activeFiltersCount > 0 && (
          <div className="min-w-[20px] h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold px-1.5">
            {activeFiltersCount}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Search Filters
        </h3>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Hide Filters"
        >
          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-4">
        <div className="flex-1 text-center">
          <div className="text-base font-semibold text-gray-900 dark:text-white">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Total
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-base font-semibold text-gray-900 dark:text-white">
            {netNewCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Net New
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-base font-semibold text-gray-900 dark:text-white">
            {savedCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Saved
          </div>
        </div>
      </div>

      {/* Filter Search */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 relative">
        <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Search filters..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* All Filters Dropdown */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setFilterTypeDropdown(!filterTypeDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <span>All Filters</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${filterTypeDropdown ? 'transform rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filters List */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {visibleFilters.map((filterGroup) => {
            const isExpanded = expandedGroups.has(filterGroup.id)
            const isPinned = pinnedFilters.has(filterGroup.id)
            const filterValue = filters[filterGroup.id]

            return (
              <div
                key={filterGroup.id}
                className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleExpand(filterGroup.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-white">
                      {filterGroup.title}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(filterGroup.id)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title={isPinned ? 'Unpin filter' : 'Pin filter'}
                  >
                    {isPinned ? (
                      <Pin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <PinOff className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-2 pl-6 space-y-2">
                    {filterGroup.type === 'multi-select' && (
                      <div className="space-y-1">
                        {filterGroup.id === 'stage' && stageOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(filters.stage || []).includes(option.value)}
                              onChange={(e) => {
                                const current = filters.stage || []
                                const newValue = e.target.checked
                                  ? [...current, option.value]
                                  : current.filter((v: string) => v !== option.value)
                                updateFilter('stage', newValue.length > 0 ? newValue : undefined)
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                              {option.label}
                            </span>
                            {option.count !== undefined && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {option.count}
                              </span>
                            )}
                          </label>
                        ))}
                        {filterGroup.id === 'pipeline' && pipelineOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(filters.pipeline || []).includes(option.value)}
                              onChange={(e) => {
                                const current = filters.pipeline || []
                                const newValue = e.target.checked
                                  ? [...current, option.value]
                                  : current.filter((v: string) => v !== option.value)
                                updateFilter('pipeline', newValue.length > 0 ? newValue : undefined)
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                              {option.label}
                            </span>
                            {option.count !== undefined && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {option.count}
                              </span>
                            )}
                          </label>
                        ))}
                        {filterGroup.id === 'source' && sourceOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={(filters.source || []).includes(option.value)}
                              onChange={(e) => {
                                const current = filters.source || []
                                const newValue = e.target.checked
                                  ? [...current, option.value]
                                  : current.filter((v: string) => v !== option.value)
                                updateFilter('source', newValue.length > 0 ? newValue : undefined)
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                              {option.label}
                            </span>
                            {option.count !== undefined && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {option.count}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                    {filterGroup.type === 'range' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={filterValue?.min || ''}
                            onChange={(e) => updateFilter(filterGroup.id, {
                              min: e.target.value ? parseFloat(e.target.value) : undefined,
                              max: filterValue?.max
                            })}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={filterValue?.max || ''}
                            onChange={(e) => updateFilter(filterGroup.id, {
                              min: filterValue?.min,
                              max: e.target.value ? parseFloat(e.target.value) : undefined
                            })}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                    {filterGroup.type === 'text' && (
                      <input
                        type="text"
                        value={filterValue || ''}
                        onChange={(e) => updateFilter(filterGroup.id, e.target.value || undefined)}
                        placeholder={`Search ${filterGroup.title.toLowerCase()}...`}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    )}
                    {filterGroup.type === 'checkbox' && (
                      <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!filterValue}
                          onChange={(e) => updateFilter(filterGroup.id, e.target.checked || undefined)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Enable {filterGroup.title}
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer - More Filters Button */}
      {remainingFiltersCount > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowMoreFilters(true)}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          >
            More Filters ({remainingFiltersCount})
          </button>
        </div>
      )}
    </div>
  )
}
