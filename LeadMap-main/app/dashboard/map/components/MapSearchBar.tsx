'use client'

import { Icon } from '@iconify/react'

interface MapSearchBarProps {
  /** Controlled search value */
  searchValue?: string
  /** Called when search input changes */
  onSearchChange?: (value: string) => void
  /** Called when user submits search (Enter or search button) – use to geocode and fly map */
  onSearchSubmit?: (query: string) => void
  /** Placeholder for the search input */
  placeholder?: string
  /** Called when Price filter is clicked */
  onPriceClick?: () => void
  /** Called when Type filter is clicked */
  onTypeClick?: () => void
  /** Called when Beds & Baths filter is clicked */
  onBedsBathsClick?: () => void
  /** Called when the tune/advanced filter button is clicked */
  onTuneClick?: () => void
}

/**
 * Real estate search bar for the map page.
 * 1:1 implementation: pill-shaped bar with search input, Price/Type/Beds & Baths dropdown triggers, and primary tune button.
 * Uses Tailwind-Admin–compatible classes and supports dark mode.
 */
export default function MapSearchBar({
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
  placeholder = 'Search by City, Zip, or Address',
  onPriceClick,
  onTypeClick,
  onBedsBathsClick,
  onTuneClick,
}: MapSearchBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const query = (searchValue ?? '').trim()
    if (query) onSearchSubmit?.(query)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-4xl rounded-full shadow-lg flex items-center py-1.5 px-2 pr-2 border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"
      role="search"
      aria-label="Real estate search"
    >
      {/* Search input section */}
      <div className="flex items-center flex-grow pl-4 pr-2 min-w-0">
        <Icon
          icon="material-symbols:search"
          className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2.5 shrink-0"
          aria-hidden
        />
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder={placeholder}
          className="bg-transparent border-none focus:ring-0 text-slate-800 dark:text-slate-200 w-full placeholder-slate-400 dark:placeholder-slate-500 text-[15px] font-medium p-0 focus:outline-none leading-tight"
          aria-label="Search by city, zip code, or address"
        />
      </div>

      {/* Divider */}
      <div className="h-7 w-px bg-slate-200 dark:bg-slate-600 mx-1.5 shrink-0" aria-hidden />

      {/* Filter buttons */}
      <div className="flex items-center space-x-1 shrink-0">
        <button
          type="button"
          onClick={onPriceClick}
          className="px-3.5 py-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold flex items-center transition-colors whitespace-nowrap group"
          aria-label="Filter by price"
          aria-haspopup="listbox"
        >
          Price
          <Icon
            icon="material-symbols:expand-more"
            className="w-4 h-4 ml-0.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors"
            aria-hidden
          />
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-600 mx-1" aria-hidden />

        <button
          type="button"
          onClick={onTypeClick}
          className="px-3.5 py-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold flex items-center transition-colors whitespace-nowrap group"
          aria-label="Filter by property type"
          aria-haspopup="listbox"
        >
          Type
          <Icon
            icon="material-symbols:expand-more"
            className="w-4 h-4 ml-0.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors"
            aria-hidden
          />
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-600 mx-1" aria-hidden />

        <button
          type="button"
          onClick={onBedsBathsClick}
          className="px-3.5 py-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold flex items-center transition-colors whitespace-nowrap group"
          aria-label="Filter by beds and baths"
          aria-haspopup="listbox"
        >
          Beds & Baths
          <Icon
            icon="material-symbols:expand-more"
            className="w-4 h-4 ml-0.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors"
            aria-hidden
          />
        </button>

        {/* Primary tune / advanced filter button - design 1:1 (#0F62FE) */}
        <button
          type="button"
          onClick={onTuneClick}
          className="ml-2.5 bg-[#0F62FE] hover:bg-[#0353E9] text-white rounded-full shadow-md flex items-center justify-center w-9 h-9 transition-colors flex-shrink-0"
          aria-label="Open advanced filters"
        >
          <Icon icon="material-symbols:tune" className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </form>
  )
}
