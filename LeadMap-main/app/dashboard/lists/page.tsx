'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../components/DashboardLayout'
import { Plus, Search, Users, Building2, Filter, Settings, Download, MoreVertical, Info, Trash2, Edit, X, Upload, ChevronDown, Loader2, LayoutGrid, Map } from 'lucide-react'
import ImportListModal from './components/ImportListModal'
import CreateListModal from './components/CreateListModal'
import ListsTable from './components/ListsTable'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/lib/utils'

interface List {
  id: string
  name: string
  type: 'people' | 'properties'
  description?: string
  created_at?: string
  updated_at?: string
  item_count?: number
}

type ViewType = 'total' | 'net_new' | 'saved'
type DisplayView = 'default' | 'compact' | 'detailed' | 'map'

export default function ListsPage() {
  const router = useRouter()
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'lastModified' | 'name' | 'created'>('lastModified')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newListType, setNewListType] = useState<'people' | 'properties'>('properties')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'created_at' | 'updated_at'>('type')
  const [viewType, setViewType] = useState<ViewType>('total')
  const [displayView, setDisplayView] = useState<DisplayView>('default')

  useEffect(() => {
    fetchLists()
  }, [])

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/lists?includeCount=true', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json()

      if (response.ok) {
        setLists(data.lists || [])
      } else {
        console.error('Error fetching lists:', data.error)
        setLists([])
      }
    } catch (error) {
      console.error('Error:', error)
      setLists([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCreateList = useCallback((type: 'people' | 'properties') => {
    setNewListType(type)
    setShowCreateModal(true)
  }, [])

  const handleListCreated = useCallback(() => {
    setShowCreateModal(false)
    fetchLists()
  }, [fetchLists])

  const handleImportComplete = useCallback((count: number) => {
    setShowImportModal(false)
    fetchLists()
  }, [fetchLists])

  // Calculate counts for filter buttons
  const totalCount = useMemo(() => lists.length, [lists])
  
  const netNewCount = useMemo(() => {
    // Net new = lists created in last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    return lists.filter(list => {
      if (!list.created_at) return false
      return new Date(list.created_at).getTime() >= thirtyDaysAgo
    }).length
  }, [lists])
  
  const savedCount = useMemo(() => {
    // Saved = lists that have items (item_count > 0)
    return lists.filter(list => (list.item_count || 0) > 0).length
  }, [lists])

  // Filter lists based on viewType
  const filteredByViewType = useMemo(() => {
    switch (viewType) {
      case 'net_new': {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
        return lists.filter(list => {
          if (!list.created_at) return false
          return new Date(list.created_at).getTime() >= thirtyDaysAgo
        })
      }
      case 'saved': {
        return lists.filter(list => (list.item_count || 0) > 0)
      }
      case 'total':
      default:
        return lists
    }
  }, [lists, viewType])

  // Separate lists by type
  const peopleLists = useMemo(() => {
    return filteredByViewType.filter(list => list.type === 'people')
  }, [filteredByViewType])

  const propertiesLists = useMemo(() => {
    return filteredByViewType.filter(list => list.type === 'properties')
  }, [filteredByViewType])

  // Filter and sort
  const filteredPeopleLists = useMemo(() => {
    let filtered = peopleLists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(list => 
        list.name.toLowerCase().includes(query)
      )
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'created') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      } else { // lastModified
        return new Date(b.updated_at || b.created_at || 0).getTime() - 
               new Date(a.updated_at || a.created_at || 0).getTime()
      }
    })
    
    return filtered
  }, [peopleLists, searchQuery, sortBy])

  const filteredPropertiesLists = useMemo(() => {
    let filtered = propertiesLists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(list => 
        list.name.toLowerCase().includes(query)
      )
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'created') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      } else { // lastModified
        return new Date(b.updated_at || b.created_at || 0).getTime() - 
               new Date(a.updated_at || a.created_at || 0).getTime()
      }
    })
    
    return filtered
  }, [propertiesLists, searchQuery, sortBy])

  // Group lists based on groupBy setting
  const groupedLists = useMemo(() => {
    if (groupBy === 'none') {
      return {
        people: filteredPeopleLists,
        properties: filteredPropertiesLists,
      }
    }

    if (groupBy === 'type') {
      return {
        people: filteredPeopleLists,
        properties: filteredPropertiesLists,
      }
    }

    // Group by date (created_at or updated_at)
    const groupByDate = (listArray: List[]) => {
      const groups: Record<string, List[]> = {}
      listArray.forEach(list => {
        const dateKey = list[groupBy] || list.created_at || ''
        if (dateKey) {
          const date = new Date(dateKey)
          const key = date.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })
          if (!groups[key]) groups[key] = []
          groups[key].push(list)
        }
      })
      return groups
    }

    return {
      people: groupByDate(filteredPeopleLists),
      properties: groupByDate(filteredPropertiesLists),
    }
  }, [filteredPeopleLists, filteredPropertiesLists, groupBy])

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [])

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white dark:bg-dark">
        {/* Header */}
        <div className="border-b border-stroke dark:border-strokedark bg-white dark:bg-boxdark">
          <div className="px-4 py-6 md:px-6 xl:px-7.5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h1 className="text-2xl font-bold text-black dark:text-white">
                My Lists
              </h1>

              <div className="flex gap-3 items-center">
                <Button
                  variant="outline"
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import CSV
                </Button>
                <Button
                  onClick={() => handleCreateList('properties')}
                  className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create a list
                </Button>
              </div>
            </div>

            {/* Filter Buttons: Total, Net New, Saved */}
            {lists.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setViewType('total')}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center px-4 py-3 rounded-lg border transition-all duration-200",
                    viewType === 'total'
                      ? "bg-primary border-primary text-white shadow-md"
                      : "bg-white dark:bg-boxdark border-stroke dark:border-strokedark text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
                  <div className="text-xs mt-1 opacity-90">Total</div>
                </button>
                <button
                  onClick={() => setViewType('net_new')}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center px-4 py-3 rounded-lg border transition-all duration-200",
                    viewType === 'net_new'
                      ? "bg-primary border-primary text-white shadow-md"
                      : "bg-white dark:bg-boxdark border-stroke dark:border-strokedark text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <div className="text-2xl font-bold">{netNewCount.toLocaleString()}</div>
                  <div className="text-xs mt-1 opacity-90">Net New</div>
                </button>
                <button
                  onClick={() => setViewType('saved')}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center px-4 py-3 rounded-lg border transition-all duration-200",
                    viewType === 'saved'
                      ? "bg-primary border-primary text-white shadow-md"
                      : "bg-white dark:bg-boxdark border-stroke dark:border-strokedark text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  <div className="text-2xl font-bold">{savedCount.toLocaleString()}</div>
                  <div className="text-xs mt-1 opacity-90">Saved</div>
                </button>
              </div>
            )}

            {/* Search and Filters */}
            {lists.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-bodydark2 pointer-events-none" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search lists"
                    className="pl-10"
                  />
                </div>

                {/* View Selector Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 min-w-[160px] justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        {displayView === 'default' && 'Default View'}
                        {displayView === 'compact' && 'Compact View'}
                        {displayView === 'detailed' && 'Detailed View'}
                        {displayView === 'map' && 'Map View'}
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setDisplayView('default')}>
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Default View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDisplayView('compact')}>
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Compact View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDisplayView('detailed')}>
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Detailed View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDisplayView('map')}>
                      <Map className="h-4 w-4 mr-2" />
                      Map View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastModified">Last Modified</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Button
                    variant={showViewOptions ? "default" : "outline"}
                    size="icon"
                    onClick={() => setShowViewOptions(!showViewOptions)}
                    title="View options"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  {showViewOptions && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowViewOptions(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg shadow-lg z-50 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-stroke dark:border-strokedark">
                          <h3 className="text-base font-semibold text-black dark:text-white">
                            View options
                          </h3>
                          <button
                            onClick={() => setShowViewOptions(false)}
                            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-bodydark2 hover:text-black dark:hover:text-white transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="p-5">
                          <div>
                            <label className="block text-sm font-medium text-bodydark dark:text-bodydark2 mb-2">
                              Group by
                            </label>
                            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as any)}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="type">Type</SelectItem>
                                <SelectItem value="created_at">Created Date</SelectItem>
                                <SelectItem value="updated_at">Last Modified</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 xl:p-7.5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-bodydark dark:text-bodydark2">Loading lists...</span>
            </div>
          ) : lists.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-32 h-32 mb-6 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-5xl">
                📋
              </div>
              <h2 className="text-2xl font-semibold text-black dark:text-white mb-3">
                Welcome to your lists
              </h2>
              <p className="text-bodydark dark:text-bodydark2 mb-8 max-w-md">
                Lists help you organize your prospects and start targeted campaigns. Pick a template below to get started.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => handleCreateList('people')}
                  className="flex items-center gap-2"
                >
                  <Users className="h-5 w-5" />
                  Create a prospects list
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCreateList('properties')}
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-5 w-5" />
                  Create a property list
                </Button>
              </div>
              <div className="mt-6">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm"
                >
                  <Info className="h-4 w-4" />
                  Learn more about lists
                </a>
              </div>
            </div>
          ) : displayView === 'map' ? (
            /* Map View */
            <div className="py-20 text-center">
              <div className="w-32 h-32 mb-6 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-5xl mx-auto">
                <Map className="h-16 w-16 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-black dark:text-white mb-3">
                Map View
              </h2>
              <p className="text-bodydark dark:text-bodydark2 mb-8 max-w-md mx-auto">
                Map view is coming soon. This will display your lists on an interactive map.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* People Section */}
              {filteredPeopleLists.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-black dark:text-white">
                      Prospects ({peopleLists.length})
                    </h2>
                  </div>
                  <ListsTable
                    lists={filteredPeopleLists}
                    onRefresh={fetchLists}
                    type="people"
                    displayView={displayView}
                  />
                </div>
              )}

              {/* Properties Section */}
              {filteredPropertiesLists.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-black dark:text-white">
                      Properties ({propertiesLists.length})
                    </h2>
                  </div>
                  <ListsTable
                    lists={filteredPropertiesLists}
                    onRefresh={fetchLists}
                    type="properties"
                    displayView={displayView}
                  />
                </div>
              )}

              {/* No Results */}
              {filteredPeopleLists.length === 0 && filteredPropertiesLists.length === 0 && (
                <div className="py-20 text-center">
                  <div className="text-5xl mb-4">🔍</div>
                  <div className="text-lg font-medium text-black dark:text-white mb-2">
                    No lists match your criteria
                  </div>
                  <div className="text-sm text-bodydark dark:text-bodydark2">
                    Try adjusting your search, filters or groups to find what you're looking for.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create List Modal */}
        {showCreateModal && (
          <CreateListModal
            type={newListType}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleListCreated}
            supabase={null as any}
          />
        )}

        {/* Import List Modal */}
        <ImportListModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      </div>
    </DashboardLayout>
  )
}
