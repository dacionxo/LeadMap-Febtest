'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface TailwindAdminPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  isDark?: boolean
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export default function TailwindAdminPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TailwindAdminPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1)
  const safeCurrentPage = Math.min(Math.max(1, currentPage || 1), safeTotalPages)

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
  const endItem = totalItems === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalItems)

  const getPageNumbers = () => {
    const pages: (number | '...')[] = []
    const maxVisible = 7

    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i)
      return pages
    }

    if (safeCurrentPage <= 3) {
      pages.push(1, 2, 3, 4, 5, '...', safeTotalPages)
      return pages
    }

    if (safeCurrentPage >= safeTotalPages - 2) {
      pages.push(1, '...', safeTotalPages - 4, safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages)
      return pages
    }

    pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', safeTotalPages)
    return pages
  }

  const handlePageSizeClick = (size: number) => {
    if (size === pageSize) return
    onPageSizeChange(size)
    if (safeCurrentPage !== 1) onPageChange(1)
  }

  return (
    <div className="sm:flex gap-2 p-3 items-center justify-between">
      {/* Left: page summary */}
      <div className="text-sm text-bodytext dark:text-white/70 whitespace-nowrap">
        Showing {startItem.toLocaleString()} - {endItem.toLocaleString()} of {totalItems.toLocaleString()}
      </div>

      {/* Center: page numbers */}
      <div className="flex items-center justify-center gap-2 my-2 sm:my-0">
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className={cn(
            'h-9 w-9 inline-flex items-center justify-center rounded-md border border-ld bg-white dark:bg-dark text-ld',
            'hover:bg-lightprimary disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="h-9 min-w-9 px-2 inline-flex items-center justify-center text-sm text-bodytext dark:text-white/50"
                >
                  ...
                </span>
              )
            }

            const isActive = page === safeCurrentPage
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={cn(
                  'h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md border text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white dark:bg-dark border-ld text-ld hover:bg-lightprimary'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {page}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === safeTotalPages}
          className={cn(
            'h-9 w-9 inline-flex items-center justify-center rounded-md border border-ld bg-white dark:bg-dark text-ld',
            'hover:bg-lightprimary disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Right: page size tabs */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-sm text-bodytext dark:text-white/70 whitespace-nowrap">Rows per page</span>
        <div className="inline-flex rounded-md border border-ld overflow-hidden bg-white dark:bg-dark">
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isActive = size === pageSize
            return (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeClick(size)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium border-r last:border-r-0 border-ld transition-colors',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-ld hover:bg-lightprimary dark:hover:bg-lightprimary'
                )}
                aria-label={`Rows per page: ${size}`}
                data-active={isActive ? 'true' : 'false'}
              >
                {size}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

