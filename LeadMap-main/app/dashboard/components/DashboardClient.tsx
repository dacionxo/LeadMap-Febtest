'use client'

import { Suspense } from 'react'
import CustomizableDashboard from './CustomizableDashboard'

export default function DashboardClient() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-32 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse" />
      </div>
    }>
      <CustomizableDashboard />
    </Suspense>
  )
}







