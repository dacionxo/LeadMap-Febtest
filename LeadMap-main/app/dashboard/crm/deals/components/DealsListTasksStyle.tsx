'use client'

/**
 * DealsListTasksStyle — 1:1 match to the Tasks dashboard design.
 * TailwindAdmin styling: border-ld, text-ld, text-bodytext, card, bg-white/dark.
 * Columns: status (teal check / red ! / empty), Due Date, Deal, Edit.
 * Load More at bottom. React + TailwindCSS.
 */

import { useState } from 'react'
import { CheckSquare, AlertCircle, Square, Pencil } from 'lucide-react'

interface Deal {
  id: string
  title: string
  stage: string
  expected_close_date?: string | null
}

interface DealsListTasksStyleProps {
  deals: Deal[]
  onDealClick: (deal: Deal) => void
  onEditClick?: (deal: Deal) => void
  initialVisible?: number
  loadMoreStep?: number
}

const PAGE_SIZE = 10

function getStatus(deal: Deal): 'completed' | 'overdue' | 'pending' {
  const closed = /closed_won|closed_lost/i.test(deal.stage)
  if (closed) return 'completed'
  const d = deal.expected_close_date ? new Date(deal.expected_close_date) : null
  if (d && !isNaN(d.getTime()) && d < new Date()) return 'overdue'
  return 'pending'
}

function formatDueDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DealsListTasksStyle({
  deals,
  onDealClick,
  onEditClick,
  initialVisible = PAGE_SIZE,
  loadMoreStep = PAGE_SIZE,
}: DealsListTasksStyleProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisible)
  const slice = deals.slice(0, visibleCount)
  const hasMore = visibleCount < deals.length

  return (
    <div className="bg-white dark:bg-dark rounded-lg shadow-md dark:shadow-dark-md border border-ld overflow-hidden">
      {/* Table — minimal borders, padding, subtle row lines */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {/* Header row */}
        <div className="grid grid-cols-[auto_1fr_2fr_auto] gap-4 items-center px-6 py-3.5 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="w-8" aria-label="Status" />
          <div className="text-xs font-semibold text-bodytext dark:text-white/80 uppercase tracking-wider">
            Due Date
          </div>
          <div className="text-xs font-semibold text-bodytext dark:text-white/80 uppercase tracking-wider">
            Deal
          </div>
          <div className="text-xs font-semibold text-ld dark:text-white/50 uppercase tracking-wider text-right">
            Edit
          </div>
        </div>

        {slice.length === 0 ? (
          <div className="px-6 py-12 text-center text-ld dark:text-white/50 text-sm">
            No deals yet. Create one to get started.
          </div>
        ) : (
          slice.map((deal) => {
            const status = getStatus(deal)
            const isOverdue = status === 'overdue'
            return (
              <div
                key={deal.id}
                className="grid grid-cols-[auto_1fr_2fr_auto] gap-4 items-center px-6 py-3.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
              >
                {/* Status */}
                <div className="w-8 flex items-center justify-center flex-shrink-0">
                  {status === 'completed' && (
                    <CheckSquare className="h-5 w-5 text-teal-500 dark:text-teal-400" aria-hidden />
                  )}
                  {status === 'overdue' && (
                    <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" aria-hidden />
                  )}
                  {status === 'pending' && (
                    <Square className="h-5 w-5 text-gray-300 dark:text-gray-500" aria-hidden />
                  )}
                </div>

                {/* Due Date */}
                <div
                  className={`text-sm ${isOverdue ? 'text-red-500 dark:text-red-400 font-medium' : 'text-bodytext dark:text-white/80'}`}
                >
                  {formatDueDate(deal.expected_close_date)}
                </div>

                {/* Deal (title) — clickable */}
                <button
                  type="button"
                  onClick={() => onDealClick(deal)}
                  className="text-left text-sm text-bodytext dark:text-white/90 hover:text-primary dark:hover:text-primary truncate"
                >
                  {deal.title || 'Untitled deal'}
                  {isOverdue && (
                    <span className="text-bodytext/70 dark:text-white/50 font-normal ml-1">
                      (overdue)
                    </span>
                  )}
                </button>

                {/* Edit */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onEditClick) onEditClick(deal)
                      else onDealClick(deal)
                    }}
                    className="p-1.5 rounded text-ld dark:text-white/50 hover:text-primary dark:hover:text-primary hover:bg-lightprimary dark:hover:bg-lightprimary transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Load More — centered, light border, white bg */}
      {hasMore && (
        <div className="px-6 py-4 flex justify-center border-t border-ld">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => Math.min(c + loadMoreStep, deals.length))}
            className="px-6 py-2.5 text-sm font-medium text-bodytext dark:text-white/80 bg-white dark:bg-dark border border-ld rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}
