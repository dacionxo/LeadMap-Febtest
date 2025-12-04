'use client'

import {
  Search,
  Filter,
  Download,
  Plus,
  Sparkles,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react'

interface ApolloActionBarProps {
  title: string
  viewType: 'table' | 'map'
  onViewChange: (view: 'table' | 'map') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  filtersVisible: boolean
  onToggleFilters: () => void
  activeFiltersCount: number
  selectedCount: number
  totalCount: number
  sortBy: string
  onSortChange: (sort: string) => void
  onImport: () => void
  onExport: () => void
  onSaveSearch: () => void
  onCreateWorkflow: () => void
  onRunAIPrompt: () => void
  isDark?: boolean
}

export default function ApolloActionBar({
  title,
  viewType,
  onViewChange,
  searchQuery,
  onSearchChange,
  filtersVisible,
  onToggleFilters,
  activeFiltersCount,
  selectedCount,
  totalCount,
  sortBy,
  onSortChange,
  onImport,
  onExport,
  onSaveSearch,
  onCreateWorkflow,
  onRunAIPrompt,
  isDark = false
}: ApolloActionBarProps) {
  return (
    <div style={{
      background: isDark
        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
      borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.1)',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      minHeight: '72px',
      boxShadow: isDark
        ? '0 4px 12px -2px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
        : '0 4px 12px -2px rgba(99, 102, 241, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
      backdropFilter: 'blur(10px)',
      position: 'relative',
      zIndex: 10
    }}>
      {/* Left Section: Title, View Selector, Filter Toggle */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        flex: '0 0 auto',
        minWidth: 0
      }}>
        <h1 style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
          whiteSpace: 'nowrap',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 3s ease infinite',
          letterSpacing: '-0.02em'
        }}>
          {title}
        </h1>

        {/* View Selector */}
        <div style={{ position: 'relative' }}>
          <select
            value={viewType}
            onChange={(e) => onViewChange(e.target.value as any)}
            style={{
              padding: '6px 28px 6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: '#ffffff',
              color: '#374151',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px',
              fontWeight: 400,
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <option value="table">Table</option>
            <option value="map">Map</option>
          </select>
          <ChevronDown style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#6b7280',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: filtersVisible ? '2px solid #6366f1' : '2px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '10px',
            background: filtersVisible 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
            color: filtersVisible ? '#ffffff' : '#374151',
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            whiteSpace: 'nowrap',
            boxShadow: filtersVisible 
              ? '0 8px 16px -4px rgba(99, 102, 241, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' 
              : '0 2px 4px rgba(99, 102, 241, 0.1)',
            transform: filtersVisible ? 'translateY(-1px)' : 'translateY(0)'
          }}
          onMouseEnter={(e) => {
            if (!filtersVisible) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(99, 102, 241, 0.25)'
            } else {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
            }
          }}
          onMouseLeave={(e) => {
            if (!filtersVisible) {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)'
              e.currentTarget.style.color = '#374151'
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)'
            } else {
              e.currentTarget.style.transform = 'translateY(-1px)'
            }
          }}
        >
          <SlidersHorizontal style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span>{filtersVisible ? 'Hide' : 'Show'} Filters</span>
          {activeFiltersCount > 0 && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: filtersVisible 
                ? 'rgba(255, 255, 255, 0.25)' 
                : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: filtersVisible ? '#ffffff' : '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              marginLeft: '4px',
              minWidth: '24px',
              textAlign: 'center',
              lineHeight: '1.2',
              boxShadow: '0 2px 8px rgba(245, 87, 108, 0.3)',
              animation: 'pulse 2s ease-in-out infinite',
              border: filtersVisible ? '1px solid rgba(255, 255, 255, 0.3)' : 'none'
            }}>
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Center Section - Search (Apollo-style prominent search) */}
      <div style={{ 
        position: 'relative', 
        flex: '1 1 0',
        minWidth: '300px',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <Search style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '18px',
          height: '18px',
          color: '#9ca3af',
          pointerEvents: 'none',
          zIndex: 1
        }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, address, city, state, zip code..."
          style={{
            width: '100%',
            paddingLeft: '40px',
            paddingRight: '16px',
            paddingTop: '8px',
            paddingBottom: '8px',
            border: isDark ? '2px solid rgba(99, 102, 241, 0.3)' : '2px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '12px',
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
            color: isDark ? '#e2e8f0' : '#111827',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            outline: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.1)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1'
            e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.15), 0 8px 16px rgba(99, 102, 241, 0.2)'
            e.currentTarget.style.transform = 'scale(1.02)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.1)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        />
      </div>

      {/* Right Section - Sort and Actions */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        flex: '0 0 auto'
      }}>
        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            style={{
              padding: '6px 28px 6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: '#ffffff',
              color: '#374151',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '14px',
              fontWeight: 400,
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <option value="relevance">Relevance</option>
            <option value="price_high">Price: High to Low</option>
            <option value="price_low">Price: Low to High</option>
            <option value="date_new">Date: Newest</option>
            <option value="date_old">Date: Oldest</option>
            <option value="score_high">AI Score: High to Low</option>
          </select>
          <ChevronDown style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#6b7280',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Action Buttons */}
        <button
          onClick={onRunAIPrompt}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            border: '2px solid rgba(249, 171, 0, 0.3)',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(249, 171, 0, 0.1) 0%, rgba(255, 193, 7, 0.1) 100%)',
            color: '#F9AB00',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '40px',
            height: '40px',
            boxShadow: '0 2px 8px rgba(249, 171, 0, 0.2)'
          }}
          title="Run AI Prompt"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #F9AB00 0%, #FFC107 100%)'
            e.currentTarget.style.color = '#ffffff'
            e.currentTarget.style.borderColor = '#F9AB00'
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.1) rotate(5deg)'
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(249, 171, 0, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 171, 0, 0.1) 0%, rgba(255, 193, 7, 0.1) 100%)'
            e.currentTarget.style.color = '#F9AB00'
            e.currentTarget.style.borderColor = 'rgba(249, 171, 0, 0.3)'
            e.currentTarget.style.transform = 'translateY(0) scale(1) rotate(0deg)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(249, 171, 0, 0.2)'
          }}
        >
          <Sparkles style={{ width: '20px', height: '20px' }} />
        </button>

        <button
          onClick={onImport}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            border: '2px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
            color: '#22c55e',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '40px',
            height: '40px',
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)'
          }}
          title="Import"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)'
            e.currentTarget.style.color = '#ffffff'
            e.currentTarget.style.borderColor = '#22c55e'
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.1)'
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(34, 197, 94, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)'
            e.currentTarget.style.color = '#22c55e'
            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)'
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.2)'
          }}
        >
          <Plus style={{ width: '20px', height: '20px' }} />
        </button>

        <button
          onClick={onExport}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
            color: '#3b82f6',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '40px',
            height: '40px',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
          }}
          title="Export"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
            e.currentTarget.style.color = '#ffffff'
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.1)'
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)'
            e.currentTarget.style.color = '#3b82f6'
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)'
          }}
        >
          <Download style={{ width: '20px', height: '20px' }} />
        </button>
      </div>
    </div>
  )
}

