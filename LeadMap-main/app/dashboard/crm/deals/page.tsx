'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSidebar } from '../../components/SidebarContext'
import { Plus, Search, ChevronDown, Filter, Layers, LayoutGrid, List, Save, Briefcase, MoreVertical } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Badge } from '@/app/components/ui/badge'
import EditDealModal from './components/EditDealModal'
import DealsSelectionActionBar from './components/DealsSelectionActionBar'
import DealsKanban from './components/DealsKanban'

type DealRow = {
  id: string
  title: string
  value?: number | null
  stage: string
  expected_close_date?: string | null
  property_address?: string | null
  pipeline?: {
    id?: string
    name?: string
  } | null
  pipeline_id?: string | null
  owner?: {
    id?: string
    email?: string
    name?: string
  } | null
  owner_id?: string | null
  forecast_value?: number | null
  last_interaction?: string | null
  close_probability?: number | null
}

/** Must be inside DashboardLayout (useSidebar). */
function DealsPageContent() {
  const { isOpen: isSidebarOpen } = useSidebar()
  const [totalDeals, setTotalDeals] = useState<number | null>(null)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set())
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; stages: string[]; is_default?: boolean }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const btnClass = 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-dark border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm'

  const toggleSelection = (id: string) => {
    setSelectedDeals((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const toggleAllSelection = (checked: boolean) => {
    if (checked) setSelectedDeals(new Set(deals.map((d) => d.id)))
    else setSelectedDeals(new Set())
  }
  const allSelected = deals.length > 0 && selectedDeals.size === deals.length

  // Fetch deals, pipelines, and users
  useEffect(() => {
    let cancelled = false
    async function fetchDeals() {
      try {
        const res = await fetch('/api/crm/deals?page=1&pageSize=50&sortBy=created_at&sortOrder=desc', { credentials: 'include' })
        if (cancelled) return
        const json = await res.json()
        if (res.ok) {
          setTotalDeals(json.pagination?.total ?? 0)
          setDeals(Array.isArray(json.data) ? json.data : [])
        } else {
          setTotalDeals(0)
          setDeals([])
        }
      } catch {
        if (!cancelled) {
          setTotalDeals(0)
          setDeals([])
        }
      }
    }
    fetchDeals()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [pipeRes, usersRes] = await Promise.all([
          fetch('/api/crm/deals/pipelines', { credentials: 'include' }),
          fetch('/api/crm/deals/users', { credentials: 'include' }),
        ])
        if (cancelled) return
        const pipeJson = await pipeRes.json()
        const usersJson = await usersRes.json()
        if (pipeRes.ok && pipeJson.data) setPipelines(Array.isArray(pipeJson.data) ? pipeJson.data : [])
        if (usersRes.ok && usersJson.data) setUsers(Array.isArray(usersJson.data) ? usersJson.data : [])
      } catch (e) {
        if (!cancelled) console.error('Error fetching pipelines/users:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const displayTotal = totalDeals !== null ? totalDeals : '—'

  const formatCurrency = (v: number | null | undefined) => {
    if (v == null) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  }
  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—'
    const x = new Date(d)
    return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStageDisplayName = (stage: string): string => {
    const stageMap: Record<string, string> = {
      'new': 'Lead',
      'contacted': 'Contacted',
      'qualified': 'Qualified',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost',
    }
    return stageMap[stage.toLowerCase()] || stage
  }

  // TailwindAdmin badge colors - 1:1 match with exact color system
  const getStageBadgeClassName = (stage: string): string => {
    const normalized = stage.toLowerCase()
    // Each stage gets a unique TailwindAdmin color matching the reference
    const badgeStyles: Record<string, string> = {
      'new': 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-0', // Blue for new leads
      'contacted': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 border-0', // Cyan for contacted
      'qualified': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-0', // Yellow for qualified
      'proposal': 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-0', // Orange for proposal
      'negotiation': 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-0', // Purple for negotiation
      'closed_won': 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-0', // Green for closed won
      'closed_lost': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0', // Gray for closed lost
    }
    return badgeStyles[normalized] || badgeStyles['new'] // Default to blue
  }

  const getOwnerDisplayName = (deal: DealRow): string => {
    if (deal.owner?.name) return deal.owner.name
    if (deal.owner?.email) {
      const parts = deal.owner.email.split('@')[0].split('.')
      if (parts.length >= 2) {
        return `${parts[0][0].toUpperCase()}${parts[1][0].toUpperCase()} ${parts[0]} ${parts[1]}`
      }
      return deal.owner.email
    }
    return '—'
  }

  return (
    <div className="-mt-[10px]">
      {/* Option C: -mt-[10px] offsets layout top padding so this block sits under the Navbar. Only /dashboard/crm/deals. */}
        {/* Fixed: flush under navbar (top-[50px]), attached left and right (left after sidebar, right: 0). Matches prospect-enrich pattern. */}
        <div
          className="fixed top-[50px] bottom-0 flex flex-col bg-slate-50 dark:bg-dark transition-all duration-300 mt-5"
          style={{ left: isSidebarOpen ? '274px' : '79px', right: 0 }}
        >
          {/* Horizontal divider under the navbar */}
          <div className="h-px w-full shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden="true" role="separator" />
          {/* Header — white bg, top border; Deals +50px right, Add New Deal + Search +50px right */}
          <header className="shrink-0 bg-white dark:bg-dark border-t border-slate-200 dark:border-slate-700 pl-[74px] pr-[74px] py-[18px]">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Deals</h1>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDeal(null)
                    setIsEditModalOpen(true)
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-medium bg-indigo-500 hover:bg-indigo-600 transition-colors"
                >
                  Add New Deal
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Search"
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-dark border border-slate-200 dark:border-ld text-slate-500 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>
          <div className="h-px w-full shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden="true" role="separator" />

          {/* Bar: Total (left only) | All Pipelines, All deals, Search, view toggles, Save, Sort, Filter (right, close together) */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-slate-50 dark:bg-slate-900/50 pl-[74px] pr-[74px] py-3.5">
            <p className="text-base text-slate-800 dark:text-slate-200">
              Total: <span className="font-bold">{displayTotal}</span> deals
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className={btnClass} aria-haspopup="listbox" aria-expanded="false">
                <Layers className="h-4 w-4" />
                All Pipelines
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" className={btnClass} aria-haspopup="listbox" aria-expanded="false">
                <LayoutGrid className="h-4 w-4" />
                All deals
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="flex items-center rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'bg-white dark:bg-dark text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`p-2 ${viewMode === 'kanban' ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'bg-white dark:bg-dark text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  aria-label="Kanban view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className={btnClass}>
                <Save className="h-4 w-4" />
                Save as new view
              </button>
              <button type="button" className={btnClass}>
                Sort by: Date Created
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" className={btnClass}>
                Filter
                <span className="relative inline-flex">
                  <Filter className="h-4 w-4" />
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-800 dark:bg-slate-200 text-[10px] text-white dark:text-slate-800 font-medium leading-none">+</span>
                </span>
              </button>
            </div>
          </div>

          {/* Table or Kanban */}
          {viewMode === 'list' ? (
          <div className="min-h-0 flex-1 p-4 overflow-auto">
            <div className="border-0 bg-white dark:bg-dark card no-inset no-ring dark:shadow-dark-md shadow-md p-0">
              <div className="pt-4 p-6">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(c) => toggleAllSelection(c === true)}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Deal</TableHead>
                      <TableHead className="whitespace-nowrap">Property</TableHead>
                      <TableHead className="whitespace-nowrap">Value</TableHead>
                      <TableHead className="whitespace-nowrap">Stage</TableHead>
                      <TableHead className="whitespace-nowrap">Pipeline</TableHead>
                      <TableHead className="whitespace-nowrap">Owner</TableHead>
                      <TableHead className="whitespace-nowrap">Close date</TableHead>
                      <TableHead className="whitespace-nowrap">Forecast Value</TableHead>
                      <TableHead className="whitespace-nowrap">Last Interaction</TableHead>
                      <TableHead className="whitespace-nowrap">Close Probability</TableHead>
                      <TableHead className="w-12 whitespace-nowrap"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0">
                          <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 dark:bg-slate-900/50">
                            <Briefcase className="h-12 w-12 text-slate-400 dark:text-slate-500 mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 text-base">No deals found.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      deals.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="w-10">
                            <Checkbox
                              checked={selectedDeals.has(d.id)}
                              onCheckedChange={() => toggleSelection(d.id)}
                              aria-label={`Select "${d.title || 'Untitled deal'}"`}
                            />
                          </TableCell>
                          <TableCell className="text-gray-900 dark:text-white whitespace-nowrap">{d.title || 'Untitled deal'}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{d.property_address || '—'}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrency(d.value)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {d.stage ? (
                              <Badge 
                                variant="default"
                                className={`text-xs rounded-full ${getStageBadgeClassName(d.stage)}`}
                              >
                                {getStageDisplayName(d.stage)}
                              </Badge>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {d.pipeline?.name ? (
                              <Badge variant="lightWarning" className="text-xs">
                                {d.pipeline.name}
                              </Badge>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{getOwnerDisplayName(d)}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(d.expected_close_date)}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrency(d.forecast_value)}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(d.last_interaction)}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {d.close_probability != null ? `${d.close_probability}%` : '—'}
                          </TableCell>
                          <TableCell className="w-12 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDeal(d)
                                setIsEditModalOpen(true)
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                              aria-label="Edit deal"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          </div>
          ) : (
          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
            <DealsKanban
              deals={deals as any}
              stages={['Lead', 'Sales Qualified', 'Meeting Booked', 'Negotiation', 'Contract Sent', 'Closed Won']}
              onDealClick={(d) => {
                setEditingDeal(d)
                setIsEditModalOpen(true)
              }}
              onDealUpdate={async (dealId, updates) => {
                const prev = deals
                if (updates.stage != null) {
                  setDeals((d) => d.map((x) => (x.id === dealId ? { ...x, stage: updates.stage! } : x)))
                }
                try {
                  const res = await fetch(`/api/crm/deals/${dealId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updates),
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.error || 'Failed to update deal')
                  }
                  const listRes = await fetch('/api/crm/deals?page=1&pageSize=50&sortBy=created_at&sortOrder=desc', { credentials: 'include' })
                  const listJson = await listRes.json()
                  if (listRes.ok) {
                    setTotalDeals(listJson.pagination?.total ?? 0)
                    setDeals(Array.isArray(listJson.data) ? listJson.data : [])
                  }
                } catch (e) {
                  console.error('Error updating deal:', e)
                  setDeals(prev)
                  throw e
                }
              }}
              onDealDelete={async (dealId) => {
                const prev = deals
                setDeals((d) => d.filter((x) => x.id !== dealId))
                setTotalDeals((t) => (t != null ? Math.max(0, t - 1) : 0))
                try {
                  const res = await fetch(`/api/crm/deals/${dealId}`, { method: 'DELETE', credentials: 'include' })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.error || 'Failed to delete deal')
                  }
                  const listRes = await fetch('/api/crm/deals?page=1&pageSize=50&sortBy=created_at&sortOrder=desc', { credentials: 'include' })
                  const listJson = await listRes.json()
                  if (listRes.ok) {
                    setTotalDeals(listJson.pagination?.total ?? 0)
                    setDeals(Array.isArray(listJson.data) ? listJson.data : [])
                  }
                } catch (e) {
                  console.error('Error deleting deal:', e)
                  setDeals(prev)
                  const listRes = await fetch('/api/crm/deals?page=1&pageSize=50&sortBy=created_at&sortOrder=desc', { credentials: 'include' })
                  const listJson = await listRes.json()
                  if (listRes.ok) {
                    setTotalDeals(listJson.pagination?.total ?? 0)
                    setDeals(Array.isArray(listJson.data) ? listJson.data : [])
                  }
                  throw e
                }
              }}
              pipelines={pipelines}
              onAddDeal={() => {
                setEditingDeal(null)
                setIsEditModalOpen(true)
              }}
            />
          </div>
          )}
        </div>

      {/* Create / Edit Deal Modal */}
      <EditDealModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingDeal(null)
        }}
        onSave={async (payload) => {
          try {
            const isCreate = !editingDeal
            const url = isCreate ? '/api/crm/deals' : `/api/crm/deals/${editingDeal!.id}`
            const method = isCreate ? 'POST' : 'PUT'
            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: payload.title,
                value: payload.value ?? null,
                stage: payload.stage ?? 'new',
                probability: payload.probability ?? 0,
                expected_close_date: payload.expected_close_date ?? null,
                pipeline_id: payload.pipeline_id ?? null,
                owner_id: payload.owner_id ?? null,
                notes: payload.notes ?? null,
              }),
            })
            if (res.ok) {
              const dealsRes = await fetch('/api/crm/deals?page=1&pageSize=50&sortBy=created_at&sortOrder=desc', { credentials: 'include' })
              const dealsJson = await dealsRes.json()
              if (dealsRes.ok) {
                setTotalDeals(dealsJson.pagination?.total ?? 0)
                setDeals(Array.isArray(dealsJson.data) ? dealsJson.data : [])
              }
              setIsEditModalOpen(false)
              setEditingDeal(null)
            } else {
              const err = await res.json().catch(() => ({}))
              alert(err.error || (isCreate ? 'Failed to create deal' : 'Failed to update deal'))
            }
          } catch (e) {
            console.error('Error saving deal:', e)
            alert('Failed to save deal')
          }
        }}
        deal={editingDeal}
        pipelines={pipelines}
        users={users}
      />

      {/* Selection Action Bar */}
      <DealsSelectionActionBar
        selectedCount={selectedDeals.size}
        onClose={() => setSelectedDeals(new Set())}
        onAddToSequence={() => {
          console.log('Add to sequence:', Array.from(selectedDeals))
          // TODO: Implement add to sequence
        }}
        onDuplicate={() => {
          console.log('Duplicate:', Array.from(selectedDeals))
          // TODO: Implement duplicate
        }}
        onExport={() => {
          console.log('Export:', Array.from(selectedDeals))
          // TODO: Implement export
        }}
        onArchive={() => {
          console.log('Archive:', Array.from(selectedDeals))
          // TODO: Implement archive
        }}
        onDelete={() => {
          console.log('Delete:', Array.from(selectedDeals))
          // TODO: Implement delete
        }}
        onConvert={() => {
          console.log('Convert:', Array.from(selectedDeals))
          // TODO: Implement convert
        }}
        onMoveTo={() => {
          console.log('Move to:', Array.from(selectedDeals))
          // TODO: Implement move to
        }}
        onSidekick={() => {
          console.log('Sidekick:', Array.from(selectedDeals))
          // TODO: Implement sidekick
        }}
        onApps={() => {
          console.log('Apps:', Array.from(selectedDeals))
          // TODO: Implement apps
        }}
      />
    </div>
  )
}

export default function DealsPage() {
  return (
    <DashboardLayout>
      <DealsPageContent />
    </DashboardLayout>
  )
}
