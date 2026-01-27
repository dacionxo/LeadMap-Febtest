'use client'

import DashboardLayout from '../../components/DashboardLayout'
import { Plus, Search } from 'lucide-react'

export default function DealsPage() {
  return (
    <DashboardLayout>
      {/* Header — 1:1: Deals (left) | Add New Deal + Search (right). bg ~#F8FAFC, title ~#1E293B, pill #6366F1, circular search. */}
      <header className="bg-slate-50 dark:bg-dark px-6 py-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Deals
          </h1>
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
      <div className="h-px w-full bg-slate-200 dark:bg-slate-700" aria-hidden="true" role="separator" />
      <div className="p-6" />
    </DashboardLayout>
  )
}
