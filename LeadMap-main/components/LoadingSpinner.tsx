/**
 * Loading Spinner Component
 * 
 * Reusable loading spinner component with customizable size and styling.
 * Follows TailwindCSS and accessibility best practices.
 * 
 * Matches the pattern used in other Postiz components for consistency.
 */

'use client'

import clsx from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  ariaLabel?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  className,
  ariaLabel = 'Loading...'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}
