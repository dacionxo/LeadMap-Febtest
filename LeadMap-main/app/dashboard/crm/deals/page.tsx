'use client'

import { useState, useEffect, useMemo } from 'react'
import { useApp } from '@/app/providers'
import DashboardLayout from '../../components/DashboardLayout'
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  Layers3, 
  Save, 
  Calendar, 
  Settings, 
  X, 
  Trophy, 
  DollarSign, 
  ChevronDown,
  Table2,
  Kanban,
  Building2,
  User,
  Gauge,
  FileText,
  MapPin,
  Users,
  Briefcase,
  Eye,
  Lightbulb,
  FileSpreadsheet,
  Zap,
  ChevronRight
} from 'lucide-react'
import DealsOnboardingModal from './components/DealsOnboardingModal'
import DealsKanban from './components/DealsKanban'
import DealsTable from './components/DealsTable'
import DealFormModal from './components/DealFormModal'
import DealDetailView from './components/DealDetailView'
import DealsFilterSidebar from './components/DealsFilterSidebar'
import ViewOptionsModal from './components/ViewOptionsModal'

interface Deal {
  id: string
  title: string
  description?: string
  value?: number | null
  stage: string
  probability?: number
  expected_close_date?: string | null
  contact_id?: string | null
  listing_id?: string | null
  pipeline_id?: string | null
  notes?: string
  tags?: string[]
  contact?: {
    id?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    company?: string
  }
  owner?: {
    id?: string
    email?: string
    name?: string
  }
  owner_id?: string | null
  assigned_to?: string | null
  pipeline?: {
    id?: string
    name?: string
  } | null
  property_address?: string | null
  created_at: string
}

interface Pipeline {
  id: string
  name: string
  stages: string[]
  is_default: boolean
}

interface Contact {
  id: string
  first_name?: string
  last_name: string
  email?: string
  phone?: string
}

export default function DealsPage() {
  const { user } = useApp()
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview')
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table')
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDealForm, setShowDealForm] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [initialStage, setInitialStage] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPipeline, setSelectedPipeline] = useState<string>('')
  const [selectedStage, setSelectedStage] = useState<string>('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(true)
  const [apolloFilters, setApolloFilters] = useState<Record<string, any>>({})
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [visibleTableFields, setVisibleTableFields] = useState<string[]>(['title', 'value', 'stage', 'probability', 'expected_close_date', 'contact', 'owner', 'pipeline'])

  // Calculate applied filters count
  const appliedFiltersCount = useMemo(() => {
    let count = 0
    if (apolloFilters.pipeline && Array.isArray(apolloFilters.pipeline) && apolloFilters.pipeline.length > 0) count++
    if (apolloFilters.stage && Array.isArray(apolloFilters.stage) && apolloFilters.stage.length > 0) count++
    if (apolloFilters.value && (apolloFilters.value.min || apolloFilters.value.max)) count++
    if (apolloFilters.source && Array.isArray(apolloFilters.source) && apolloFilters.source.length > 0) count++
    if (apolloFilters.tags) count++
    if (apolloFilters.probability && (apolloFilters.probability.min || apolloFilters.probability.max)) count++
    if (apolloFilters.contact_company) count++
    return count
  }, [apolloFilters])

  useEffect(() => {
    // Check if user has completed deals onboarding
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch('/api/crm/deals/onboarding-status', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setShowOnboarding(!data.completed)
        } else {
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        setShowOnboarding(true)
      }
    }
    checkOnboardingStatus()
  }, [])

  useEffect(() => {
    if (showOnboarding === false) {
      fetchPipelines()
      fetchProperties()
      fetchUsers()
      fetchDeals()
    }
  }, [showOnboarding, searchQuery, selectedPipeline, selectedStage, sortBy, sortOrder, apolloFilters])

  const fetchDeals = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        sortBy,
        sortOrder,
      })
      if (searchQuery) params.append('search', searchQuery)
      if (selectedPipeline) params.append('pipeline', selectedPipeline)
      if (selectedStage) params.append('stage', selectedStage)
      
      // Add Apollo filters
      if (apolloFilters.pipeline && Array.isArray(apolloFilters.pipeline)) {
        apolloFilters.pipeline.forEach((pid: string) => params.append('pipeline', pid))
      }
      if (apolloFilters.stage && Array.isArray(apolloFilters.stage)) {
        apolloFilters.stage.forEach((stage: string) => params.append('stage', stage))
      }
      if (apolloFilters.value) {
        if (apolloFilters.value.min) params.append('minValue', apolloFilters.value.min.toString())
        if (apolloFilters.value.max) params.append('maxValue', apolloFilters.value.max.toString())
      }
      
      // Add new filters
      if (apolloFilters.source && Array.isArray(apolloFilters.source)) {
        apolloFilters.source.forEach((source: string) => params.append('source', source))
      }
      if (apolloFilters.tags) {
        params.append('tags', apolloFilters.tags)
      }
      if (apolloFilters.probability) {
        if (apolloFilters.probability.min) params.append('minProbability', apolloFilters.probability.min.toString())
        if (apolloFilters.probability.max) params.append('maxProbability', apolloFilters.probability.max.toString())
      }
      if (apolloFilters.contact_company) {
        params.append('contactCompany', apolloFilters.contact_company)
      }

      const response = await fetch(`/api/crm/deals?${params}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setDeals(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/crm/deals/pipelines', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPipelines(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/crm/deals/properties', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setProperties(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching properties:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      // Fetch users from users table - for now just get current user
      // In a multi-user system, this would fetch all team members
      const response = await fetch('/api/crm/deals/users', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleCreateDeal = async (dealData: Partial<Deal>) => {
    try {
      const response = await fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dealData),
      })
      if (response.ok) {
        setViewMode('table') // Switch to table view after creating a deal
        await fetchDeals()
        setShowDealForm(false)
      } else {
        throw new Error('Failed to create deal')
      }
    } catch (error) {
      console.error('Error creating deal:', error)
      throw error
    }
  }

  const handleUpdateDeal = async (dealId: string, updates: Partial<Deal>) => {
    try {
      const response = await fetch(`/api/crm/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (response.ok) {
        await fetchDeals()
        if (selectedDeal?.id === dealId) {
          const dealResponse = await fetch(`/api/crm/deals/${dealId}`, { credentials: 'include' })
          if (dealResponse.ok) {
            const dealData = await dealResponse.json()
            setSelectedDeal(dealData.data)
          }
        }
        setEditingDeal(null)
      } else {
        throw new Error('Failed to update deal')
      }
    } catch (error) {
      console.error('Error updating deal:', error)
      throw error
    }
  }

  const handleDeleteDeal = async (dealId: string) => {
    try {
      const response = await fetch(`/api/crm/deals/${dealId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        await fetchDeals()
        if (selectedDeal?.id === dealId) {
          setSelectedDeal(null)
        }
      } else {
        throw new Error('Failed to delete deal')
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
      throw error
    }
  }

  const handleAddActivity = async (dealId: string, activity: { activity_type: string; title: string; description?: string }) => {
    try {
      const response = await fetch(`/api/crm/deals/${dealId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(activity),
      })
      if (response.ok) {
        const dealResponse = await fetch(`/api/crm/deals/${dealId}`, { credentials: 'include' })
        if (dealResponse.ok) {
          const dealData = await dealResponse.json()
          setSelectedDeal(dealData.data)
        }
        await fetchDeals()
      }
    } catch (error) {
      console.error('Error adding activity:', error)
    }
  }

  const handleAddTask = async (dealId: string, task: { title: string; due_date?: string; priority: string }) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...task,
          related_type: 'deal',
          related_id: dealId,
          status: 'pending',
        }),
      })
      if (response.ok) {
        const dealResponse = await fetch(`/api/crm/deals/${dealId}`, { credentials: 'include' })
        if (dealResponse.ok) {
          const dealData = await dealResponse.json()
          setSelectedDeal(dealData.data)
        }
        await fetchDeals()
      }
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getDefaultStages = () => {
    const defaultPipeline = pipelines.find((p) => p.is_default)
    // Return stages matching the Kanban design: Lead, Sales Qualified, Meeting Booked, Negotiation, Contract Sent, Closed Won
    return defaultPipeline?.stages || ['Lead', 'Sales Qualified', 'Meeting Booked', 'Negotiation', 'Contract Sent', 'Closed Won']
  }

  const handleBeginSetup = async () => {
    try {
      const response = await fetch('/api/crm/deals/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (response.ok) {
        setShowOnboarding(false)
      }
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  const handleMaybeLater = () => {
    setShowOnboarding(false)
  }


  return (
    <DashboardLayout>
      {showOnboarding === null ? (
        // Loading state while checking onboarding
        <div className="flex items-center justify-center h-[calc(100vh-2rem)]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        </div>
      ) : showOnboarding === true ? (
        // Onboarding modal will be shown
        null
      ) : (
        <div className="flex flex-col h-[calc(100vh-2rem)]">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              {/* Left: Title */}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deals</h1>

              {/* Right: Action Buttons */}
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  Import CSV
                </button>
                <button
                  onClick={() => {
                    setInitialStage(undefined)
                    setEditingDeal(null)
                    setShowDealForm(true)
                  }}
                  className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create deal
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                  activeTab === 'overview'
                    ? 'bg-gray-800 dark:bg-gray-700 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 text-sm font-medium transition-colors relative rounded-t-lg ${
                  activeTab === 'analytics'
                    ? 'bg-gray-800 dark:bg-gray-700 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Analytics
                <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold bg-green-500 text-white rounded">
                  New
                </span>
              </button>
            </div>
          </div>

          {/* Main Content Area with Sidebar */}
          <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-900">
            {/* Left Sidebar - Apollo Filter Sidebar */}
            {showFilters && (
              <DealsFilterSidebar
                filters={apolloFilters}
                onFiltersChange={setApolloFilters}
                totalCount={deals.length}
                isCollapsed={false}
                onToggleCollapse={() => setShowFilters(false)}
                deals={deals}
                pipelines={pipelines}
                isDark={false}
              />
            )}

            {/* Main Content */}
            <div className={`flex flex-col overflow-hidden ${showDealForm ? 'flex-[2]' : 'flex-1'}`}>
              {/* Control Bar */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
                {/* Left: Pipeline Selector, Deal View Selector, Show Filters, Search */}
                <div className="flex items-center gap-3">
                  {/* Pipeline Selector */}
                  <div className="relative">
                    <select
                      value={selectedPipeline || ''}
                      onChange={(e) => setSelectedPipeline(e.target.value || '')}
                      className="appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Pipelines</option>
                      {pipelines.map((pipeline) => (
                        <option key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </option>
                      ))}
                    </select>
                    <Building2 className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Deal View Selector */}
                  <div className="relative">
                    <select
                      className="appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option>All deals</option>
                    </select>
                    <LayoutGrid className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Show Filters Button */}
                  {!showFilters && (
                    <button
                      onClick={() => setShowFilters(true)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                    >
                      <Filter className="w-4 h-4" />
                      Show Filters
                      {Object.keys(apolloFilters).length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          {Object.keys(apolloFilters).length}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search deals"
                      className="pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                    />
                  </div>
                </div>
                
                {/* Right: View Controls */}
                <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                    title="Kanban View"
                  >
                    <Kanban className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded ${viewMode === 'table' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                    title="Table View"
                  >
                    <Table2 className="w-4 h-4" />
                  </button>
                </div>
                <button className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save as new view
                </button>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="created_at">Created date</option>
                    <option value="title">Name</option>
                    <option value="value">Value</option>
                    <option value="stage">Stage</option>
                    <option value="expected_close_date">Close date</option>
                  </select>
                  <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button 
                  onClick={() => setShowViewOptions(true)}
                  className="p-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  title="View options"
                >
                  <Settings className="w-4 h-4" />
                </button>
                </div>
              </div>

              {/* Content Area */}
              <div className={`flex-1 overflow-auto ${viewMode === 'kanban' ? 'p-4' : 'p-6'}`}>
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Loading...</span>
                    </div>
                  </div>
                ) : deals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="relative mb-10">
                      <div className="relative inline-block">
                        <Trophy className="w-36 h-36" style={{ color: '#FCD34D', fill: '#FCD34D' }} strokeWidth={1.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <DollarSign className="w-14 h-14 text-black" strokeWidth={3} fill="black" />
                        </div>
                      </div>
                    </div>
                    <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                      Let's start winning more deals
                    </h1>
                    <p className="text-base text-gray-600 dark:text-gray-400 mb-10 text-center max-w-lg">
                      Create your first deal to start tracking activities, contacts, and conversations in one spot.
                    </p>
                    <button
                      onClick={() => setShowDealForm(true)}
                      className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors"
                    >
                      Create deal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {viewMode === 'kanban' ? (
                      <DealsKanban
                        deals={deals}
                        stages={getDefaultStages()}
                        onDealClick={(deal) => {
                          fetch(`/api/crm/deals/${deal.id}`, { credentials: 'include' })
                            .then((res) => res.json())
                            .then((data) => setSelectedDeal(data.data))
                            .catch(console.error)
                        }}
                        onDealUpdate={handleUpdateDeal}
                        onDealDelete={handleDeleteDeal}
                        pipelines={pipelines}
                        onAddDeal={(stage) => {
                          setInitialStage(stage)
                          setEditingDeal(null)
                          setShowDealForm(true)
                        }}
                      />
                    ) : (
                      <DealsTable
                        deals={deals}
                        onDealClick={(deal) => {
                          fetch(`/api/crm/deals/${deal.id}`, { credentials: 'include' })
                            .then((res) => res.json())
                            .then((data) => setSelectedDeal(data.data))
                            .catch(console.error)
                        }}
                        onDealUpdate={handleUpdateDeal}
                        onDealDelete={handleDeleteDeal}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        pipelines={pipelines}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar - Deal Form */}
            {showDealForm && (
              <div className="flex-[1] border-l border-gray-200 dark:border-gray-700">
                <DealFormModal
                  isOpen={showDealForm}
                  onClose={() => {
                    setShowDealForm(false)
                    setEditingDeal(null)
                    setInitialStage(undefined)
                  }}
                  onSave={editingDeal ? (data) => handleUpdateDeal(editingDeal.id, data) : handleCreateDeal}
                  deal={editingDeal}
                  properties={properties}
                  pipelines={pipelines}
                  users={users}
                  initialStage={initialStage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <DealsOnboardingModal
          isOpen={showOnboarding}
          onClose={handleMaybeLater}
          onBeginSetup={handleBeginSetup}
          onMaybeLater={handleMaybeLater}
        />
      )}

      {/* Deal Detail View */}
      {selectedDeal && (
        <DealDetailView
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={handleUpdateDeal}
          onAddActivity={handleAddActivity}
          onAddTask={handleAddTask}
        />
      )}

      {/* View Options Modal */}
      <ViewOptionsModal
        isOpen={showViewOptions}
        onClose={() => setShowViewOptions(false)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        visibleFields={visibleTableFields}
        onFieldsChange={setVisibleTableFields}
        appliedFiltersCount={appliedFiltersCount}
        onFiltersClick={() => {
          setShowFilters(true)
          setShowViewOptions(false)
        }}
      />
    </DashboardLayout>
  )
}
