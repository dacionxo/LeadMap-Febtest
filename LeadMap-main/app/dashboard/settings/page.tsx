'use client'

import DashboardLayout from '../components/DashboardLayout'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/providers'
import { useEffect, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { Moon, Sun, Monitor } from 'lucide-react'
import CalendarSettings from './components/CalendarSettings'

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
      </div>
    </DashboardLayout>
  )
}

