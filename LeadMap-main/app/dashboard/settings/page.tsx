'use client'

import DashboardLayout from '../components/DashboardLayout'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/providers'
import { useEffect, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { Moon, Sun, Monitor, Globe, Zap, ArrowRight, Mail } from 'lucide-react'
import CalendarSettings from './components/CalendarSettings'
import EmailAccountsSettings from './components/EmailAccountsSettings'
import Mailboxes from './components/Mailboxes'

export default function SettingsPage() {
  const { profile } = useApp()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !profile) {
      router.push('/')
    }
  }, [mounted, profile, router])

  if (!mounted) {
    return null
  }

  if (!profile) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Account settings and preferences.</p>
        </div>

        {/* Theme Settings */}
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose your preferred theme. The system theme will automatically match your device settings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="font-medium">Dark</span>
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  theme === 'system'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span className="font-medium">System</span>
              </button>
            </div>
            {theme === 'system' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Currently using: {resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode (from system settings)
              </p>
            )}
          </div>
        </div>

        {/* Calendar Settings */}
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <CalendarSettings />
        </div>

        {/* Email Accounts Settings */}
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <EmailAccountsSettings />
        </div>

        {/* Mailboxes */}
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <Mailboxes />
        </div>

        {/* Integrations Section */}
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-gray-900 dark:text-white" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Integrations</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Connect with external services and tools
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/tools/integrations')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Manage Integrations
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Connect your CRM, email providers, and other tools to streamline your workflow.
            </p>
          </div>
        </div>

        {/* Webhooks Section */}
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-gray-900 dark:text-white" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Webhooks</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Set up webhooks to receive leads from external systems
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/tools/webhooks')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Manage Webhooks
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure webhook endpoints to receive real-time updates and data from external services.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

