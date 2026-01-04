'use client'

/**
 * Loading Skeleton Component
 * Reusable loading skeleton for dashboard components following .cursorrules patterns
 */
export default function LoadingSkeleton({
  type = 'card',
  count = 1,
}: {
  type?: 'card' | 'table' | 'chart' | 'metric'
  count?: number
}) {
  const SkeletonCard = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
      </div>
    </div>
  )

  const SkeletonTable = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      </div>
      <div className="p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
          </div>
        ))}
      </div>
    </div>
  )

  const SkeletonChart = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  )

  const SkeletonMetric = () => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>
  )

  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return <SkeletonCard />
      case 'table':
        return <SkeletonTable />
      case 'chart':
        return <SkeletonChart />
      case 'metric':
        return <SkeletonMetric />
      default:
        return <SkeletonCard />
    }
  }

  return (
    <div className={count > 1 ? 'space-y-4' : ''}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </div>
  )
}


