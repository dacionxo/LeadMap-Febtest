'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSidebar } from '../../components/SidebarContext'
import { Plus, Search, ChevronDown, Filter } from 'lucide-react'

/** Must be inside DashboardLayout (useSidebar). */
function DealsPageContent() {
  const { isOpen: isSidebarOpen } = useSidebar()
  const [totalDeals, setTotalDeals] = useState<number | null>(null)

  // Dynamically track user's saved deals via /api/crm/deals
  useEffect(() => {
    let cancelled = false
    async function fetchTotal() {
      try {
        const res = await fetch('/api/crm/deals?page=1&pageSize=1', { credentials: 'include' })
        if (cancelled) return
        const json = await res.json()
        if (res.ok && json.pagination) setTotalDeals(json.pagination.total ?? 0)
        else setTotalDeals(0)
      } catch {
        if (!cancelled) setTotalDeals(0)
      }
    }
    fetchTotal()
    return () => { cancelled = true }
  }, [])

  const displayTotal = totalDeals !== null ? totalDeals : '—'

  return (
    <div className="-mt-[10px]">
      {/* Option C: -mt-[10px] offsets layout top padding so this block sits under the Navbar. Only /dashboard/crm/deals. */}
        {/* Fixed: flush under navbar (top-[50px]), attached left and right (left after sidebar, right: 0). Matches prospect-enrich pattern. */}
        <div
          className="fixed top-[50px] bottom-0 flex flex-col bg-slate-50 dark:bg-dark transition-all duration-300 mt-5"
          style={{ left: isSidebarOpen ? '274px' : '79px', right: 0 }}
        >
          {/* Header — white bg; Deals +50px right, Add New Deal + Search +50px right */}
          <header className="shrink-0 bg-white dark:bg-dark pl-[74px] pr-[74px] py-5">
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

          {/* Bar: Total deals (left) | Sort by: Date Created, Filter (right) — 1:1 from design */}
          <div className="shrink-0 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 pl-[74px] pr-[74px] py-3.5">
            <p className="text-base text-slate-800 dark:text-slate-200">
              Total: <span className="font-bold">{displayTotal}</span> deals
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-dark border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm"
              >
                Sort by: Date Created
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-dark border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm"
              >
                Filter
                <span className="relative inline-flex">
                  <Filter className="h-4 w-4" />
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-800 dark:bg-slate-200 text-[10px] text-white dark:text-slate-800 font-medium leading-none">+</span>
                </span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 p-6" />
        </div>
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
