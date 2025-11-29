'use client'

import { useState, useEffect } from 'react'
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
  }
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
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview')
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showDealForm, setShowDealForm] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPipeline, setSelectedPipeline] = useState<string>('')
  const [selectedStage, setSelectedStage] = useState<string>('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(true)

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
      fetchContacts()
      fetchDeals()
    }
  }, [showOnboarding, searchQuery, selectedPipeline, selectedStage, sortBy, sortOrder])

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

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/crm/contacts', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setContacts(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
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
    return defaultPipeline?.stages || ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Under Contract', 'Closed Won', 'Closed Lost']
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

  const filterOptions = [
    { label: 'Company', icon: Building2 },
    { label: 'Owner', icon: User },
    { label: 'Stage', icon: Gauge },
    { label: 'Closed Date', icon: Calendar },
    { label: 'Created Date', icon: Calendar },
    { label: 'Stage Updated At', icon: Calendar },
    { label: 'Next Step Updated At', icon: Calendar },
    { label: 'Amount', icon: DollarSign },
    { label: 'Custom Fields', icon: FileText },
    { label: 'Account Lists', icon: FileText },
    { label: 'Location', icon: MapPin },
    { label: '# Employees', icon: Users },
    { label: 'Industry & Keywords', icon: Briefcase },
    { label: 'Funding', icon: Eye },
    { label: 'Technologies', icon: Lightbulb },
    { label: 'Deal CSV Import', icon: FileSpreadsheet },
    { label: 'Workflows', icon: Zap },
  ]

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
                  onClick={() => setShowDealForm(true)}
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
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
                  activeTab === 'analytics'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Analytics
                <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                  New
                </span>
              </button>
            </div>
          </div>

          {/* Main Content Area with Sidebar */}
          <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-900">
            {/* Left Sidebar - Filters */}
            {showFilters && (
              <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {/* Top Controls */}
                  <div className="relative">
                    <select
                      value={selectedPipeline}
                      onChange={(e) => setSelectedPipeline(e.target.value)}
                      className="w-full appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Pipelines</option>
                      {pipelines.map((pipeline) => (
                        <option key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </option>
                      ))}
                    </select>
                    <Layers3 className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <select
                      value={selectedStage}
                      onChange={(e) => setSelectedStage(e.target.value)}
                      className="w-full appearance-none pl-8 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All deals</option>
                      {getDefaultStages().map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                    <LayoutGrid className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Hide Filters
                  </button>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search deals"
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Filter Options List */}
                  <div className="space-y-1 pt-2">
                    {filterOptions.map((option) => {
                      const Icon = option.icon
                      return (
                        <button
                          key={option.label}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{option.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      )
                    })}
                  </div>

                  {/* Clear Filters */}
                  <button className="w-full mt-4 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    Clear filters
                  </button>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Right Side Actions Bar */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-end gap-3">
                {!showFilters && (
                  <button
                    onClick={() => setShowFilters(true)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Show Filters
                  </button>
                )}
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
                <button className="p-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Loading...</span>
                    </div>
                  </div>
                ) : showFullEmptyState ? (
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
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
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

      {/* Deal Form Modal */}
      {showDealForm && (
        <DealFormModal
          isOpen={showDealForm}
          onClose={() => {
            setShowDealForm(false)
            setEditingDeal(null)
          }}
          onSave={editingDeal ? (data) => handleUpdateDeal(editingDeal.id, data) : handleCreateDeal}
          deal={editingDeal}
          contacts={contacts}
          pipelines={pipelines}
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
    </DashboardLayout>
  )
}
