'use client'

import { useState } from 'react'
import {
  Search,
  Grid3x3,
  ChevronDown,
  SlidersHorizontal,
  X,
  Sparkles,
  Download,
  Zap,
  Save,
  ArrowUpDown,
  Settings,
  LayoutGrid,
  Map
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/lib/utils'

type DisplayView = 'default' | 'compact' | 'detailed' | 'map'

interface ProspectSearchHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filtersVisible: boolean
  onToggleFilters: () => void
  onImport: () => void
  onResearchWithAI?: () => void
  onCreateWorkflow?: () => void
  onSaveSearch?: () => void
  onAutoScore?: () => void
  onSearchSettings?: () => void
  isDark?: boolean
  displayView?: DisplayView
  onDisplayViewChange?: (view: DisplayView) => void
}

export default function ProspectSearchHeader({
  searchQuery,
  onSearchChange,
  filtersVisible,
  onToggleFilters,
  onImport,
  onResearchWithAI,
  onCreateWorkflow,
  onSaveSearch,
  onAutoScore,
  onSearchSettings,
  isDark = false,
  displayView = 'default',
  onDisplayViewChange
}: ProspectSearchHeaderProps) {
  const getViewLabel = (view: DisplayView) => {
    switch (view) {
      case 'default': return 'Default View'
      case 'compact': return 'Compact View'
      case 'detailed': return 'Detailed View'
      case 'map': return 'Map View'
      default: return 'Default View'
    }
  }
  
  const handleViewChange = (view: DisplayView) => {
    onDisplayViewChange?.(view)
  }

  const handleClearSearch = () => {
    onSearchChange('')
  }

  return (
    <div className={cn(
      "bg-white dark:bg-dark border-b border-ld",
      "flex flex-col gap-3.5 px-6 py-3.5",
      "m-0"
    )}>
      {/* Top Row: Title and Primary Actions */}
      <div className="flex items-center justify-between">
        {/* Title */}
        <h2 className={cn(
          "text-2xl font-bold",
          "text-dark dark:text-white"
        )}>
          Find people
        </h2>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Research with AI Button */}
          <button
            onClick={onResearchWithAI}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md",
              "border border-primary text-primary",
              "hover:bg-lightprimary hover:text-primary",
              "transition-colors duration-200",
              "font-medium text-sm"
            )}
          >
            <Sparkles className="h-4 w-4" />
            Research with AI
          </button>

          {/* Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md",
                  "border border-ld bg-white dark:bg-dark",
                  "hover:bg-lightprimary dark:hover:bg-lightprimary",
                  "transition-colors duration-200",
                  "font-medium text-sm text-ld"
                )}
              >
                Import
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onImport}>
                <Download className="h-4 w-4 mr-2" />
                Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Import from Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bottom Row: Controls and Secondary Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Left Side: View Selector and Filter Toggle */}
        <div className="flex items-center gap-3">
          {/* View Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md",
                  "border border-ld bg-white dark:bg-dark",
                  "hover:bg-lightprimary dark:hover:bg-lightprimary",
                  "transition-colors duration-200",
                  "text-sm text-ld"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                {getViewLabel(displayView)}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => handleViewChange('default')}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                Default View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange('compact')}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                Compact View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange('detailed')}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                Detailed View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange('map')}>
                <Map className="h-4 w-4 mr-2" />
                Map View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Toggle */}
          <button
            onClick={onToggleFilters}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md",
              "border border-ld bg-white dark:bg-dark",
              "hover:bg-lightprimary dark:hover:bg-lightprimary",
              "transition-colors duration-200",
              "text-sm text-ld"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filtersVisible ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {/* Center: Search Input */}
        <div className="flex-1 min-w-[300px] max-w-[600px] relative">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4",
            "text-bodytext dark:text-white/50",
            "pointer-events-none"
          )} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search places"
            className={cn(
              "w-full pl-10 pr-10 py-2 rounded-lg",
              "border border-ld bg-white dark:bg-dark",
              "text-sm text-ld",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
              "transition-all duration-200"
            )}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              aria-label="Clear search"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2",
                "h-5 w-5 rounded-full",
                "bg-gray-200 dark:bg-gray-700",
                "hover:bg-gray-300 dark:hover:bg-gray-600",
                "flex items-center justify-center",
                "transition-colors duration-200"
              )}
            >
              <X className="h-3 w-3 text-bodytext dark:text-white/70" />
            </button>
          )}
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Create Workflow */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md",
                  "border border-ld bg-white dark:bg-dark",
                  "hover:bg-lightprimary dark:hover:bg-lightprimary",
                  "transition-colors duration-200",
                  "text-sm text-ld"
                )}
              >
                <Zap className="h-4 w-4" />
                Create workflow
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onCreateWorkflow}>
                New workflow
              </DropdownMenuItem>
              <DropdownMenuItem>
                From template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save as new search */}
          <button
            onClick={onSaveSearch}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md",
              "border border-ld bg-white dark:bg-dark",
              "hover:bg-lightprimary dark:hover:bg-lightprimary",
              "transition-colors duration-200",
              "text-sm text-ld"
            )}
          >
            <Save className="h-4 w-4" />
            Save as new search
          </button>

          {/* People Auto-Score */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md",
                  "border border-ld bg-white dark:bg-dark",
                  "hover:bg-lightprimary dark:hover:bg-lightprimary",
                  "transition-colors duration-200",
                  "text-sm text-ld"
                )}
              >
                <ArrowUpDown className="h-4 w-4" />
                People Auto-Score
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onAutoScore}>
                Score all
              </DropdownMenuItem>
              <DropdownMenuItem>
                Score selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search settings */}
          <button
            onClick={onSearchSettings}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md",
              "border border-ld bg-white dark:bg-dark",
              "hover:bg-lightprimary dark:hover:bg-lightprimary",
              "transition-colors duration-200",
              "text-sm text-ld"
            )}
          >
            <Settings className="h-4 w-4" />
            Search settings
          </button>
        </div>
      </div>
    </div>
  )
}
