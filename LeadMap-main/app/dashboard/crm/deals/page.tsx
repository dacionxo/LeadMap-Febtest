'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSidebar } from '../../components/SidebarContext'
import { Plus, Search, ChevronDown, Filter, Layers, LayoutGrid, List, Save } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { Checkbox } from '@/app/components/ui/checkbox'

type DealRow = {
  id: string
  title: string
  value?: number | null
  stage: string
  expected_close_date?: string | null
}

/** Must be inside DashboardLayout (useSidebar). */
function DealsPageContent() {
  const { isOpen: isSidebarOpen } = useSidebar()
  const [totalDeals, setTotalDeals] = useState<number | null>(null)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set())
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

  // Dynamically track user's saved deals via /api/crm/deals
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
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'bg-white dark:bg-dark text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  aria-label="Grid view"
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

          {/* Table — TailwindAdmin shadcn-tables/basic 1:1; no external border (border-0) */}
          <div className="min-h-0 flex-1 p-4 overflow-auto">
            <div className="border-0 bg-white dark:bg-dark card no-inset no-ring dark:shadow-dark-md shadow-md p-0">
              <div className="pt-4 px-4 pb-4">
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
                      <TableHead>Deal</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Close date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-ld dark:text-white/50 py-8">
                          No deals yet. Create one to get started.
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
                          <TableCell className="text-bodytext dark:text-white/90">{d.title || 'Untitled deal'}</TableCell>
                          <TableCell className="text-bodytext dark:text-white/80">{formatCurrency(d.value)}</TableCell>
                          <TableCell className="text-bodytext dark:text-white/80">{d.stage || '—'}</TableCell>
                          <TableCell className="text-bodytext dark:text-white/80">{formatDate(d.expected_close_date)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
3    </div>
  )
}

export default function DealsPage() {
  return (
    <DashboardLayout>
      <DealsPageContent />
    </DashboardLayout>
  )
}
