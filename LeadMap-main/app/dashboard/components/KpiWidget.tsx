'use client'

import { Icon } from '@iconify/react'
import { MoreVertical, Filter } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { useState } from 'react'

interface KpiWidgetProps {
  title: string
  value: string | number
  change?: string
  changeLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
  onFilterClick?: () => void
  onMenuClick?: () => void
  icon?: React.ComponentType<{ className?: string }>
}

export function KpiWidget({
  title,
  value,
  change = '+0%',
  changeLabel = 'from last month',
  trend = 'neutral',
  className,
  onFilterClick,
  onMenuClick,
  icon: IconComponent
}: KpiWidgetProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Format the value
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value

  // Determine trend indicator color
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400'
    if (trend === 'down') return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getTrendIcon = () => {
    if (trend === 'up') return 'tabler:trending-up'
    if (trend === 'down') return 'tabler:trending-down'
    return null
  }

  return (
    <div
      className={cn(
        'relative bg-white dark:bg-gray-900 rounded-lg border border-teal-200 dark:border-teal-800',
        'shadow-sm hover:shadow-md transition-all duration-200',
        'p-6 min-h-[160px] flex flex-col',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        {/* Title with Filter Icon */}
        <div className="flex items-center gap-2">
          {IconComponent && (
            <IconComponent className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {onFilterClick && (
            <button
              onClick={onFilterClick}
              className={cn(
                'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors duration-200',
                'text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400'
              )}
              aria-label="Filter options"
              title="Filter"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Options Menu */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className={cn(
              'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors duration-200',
              'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
            aria-label="More options"
            title="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
        {!onMenuClick && (
          <div className="opacity-0 pointer-events-none">
            <MoreVertical className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Value Section */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-2">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formattedValue}
          </p>
        </div>

        {/* Change Indicator */}
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-medium', getTrendColor())}>
            {getTrendIcon() && (
              <Icon 
                icon={getTrendIcon()!} 
                className="w-3.5 h-3.5 inline-block mr-1" 
              />
            )}
            {change}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {changeLabel}
          </span>
        </div>
      </div>

      {/* Decorative Teal Dot */}
      <div className="absolute bottom-3 right-3 w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full opacity-60" />
    </div>
  )
}
