/**
 * Symphony Messenger Admin Dashboard
 * Queue monitoring, message management, and statistics
 */

'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import SymphonyDashboard from './components/SymphonyDashboard'

export default function SymphonyAdminPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Symphony Messenger
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Monitor and manage your message queue system
          </p>
        </div>
        <SymphonyDashboard />
      </div>
    </DashboardLayout>
  )
}


