'use client'

import DashboardLayout from '../../components/DashboardLayout'
import { useSidebar } from '../../components/SidebarContext'
import { Plus, Search } from 'lucide-react'

/** Must be inside DashboardLayout (useSidebar). */
function DealsPageContent() {
  const { isOpen: isSidebarOpen } = useSidebar()

  return (
    <div className="-mt-[10px]">
      {/* Option C: -mt-[10px] offsets layout top padding so this block sits under the Navbar. Only /dashboard/crm/deals. */}
        {/* Fixed: flush under navbar (top-[50px]), attached left and right (left after sidebar, right: 0). Matches prospect-enrich pattern. */}
        <div
          className="fixed top-[50px] bottom-0 flex flex-col bg-slate-50 dark:bg-dark transition-all duration-300"
          style={{ left: isSidebarOpen ? '274px' : '79px', right: 0 }}
        >
          {/* Header — 1:1: Deals (left) | Add New Deal + Search (right) */}
          <header className="shrink-0 bg-slate-50 dark:bg-dark px-6 py-5">
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
