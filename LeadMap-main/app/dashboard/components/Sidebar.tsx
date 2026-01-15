'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Zap,
  Clock,
  FileText,
  MapPin,
  Mail,
  Building2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Calendar,
  BarChart3,
  CheckCircle2,
  Megaphone,
  MessageCircle,
  Share2
} from 'lucide-react'
import { useApp } from '@/app/providers'
import { useSidebar } from './SidebarContext'

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: string
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { label: 'Maps', icon: MapPin, href: '/dashboard/map' }
    ]
  },
  {
    title: 'PROSPECT & ENRICH',
    items: [
      { label: 'All Prospects', icon: Users, href: '/dashboard/prospect-enrich' },
      { label: 'For Sale', icon: Building2, href: '/dashboard/prospect-enrich?filter=fsbo' },
      { label: 'For Rent', icon: Building2, href: '/dashboard/prospect-enrich?filter=frbo' },
      { label: 'Foreclosures', icon: Building2, href: '/dashboard/prospect-enrich?filter=foreclosure' },
      { label: 'Probate', icon: FileText, href: '/dashboard/prospect-enrich?filter=probate' },
      { label: 'Expired Listings', icon: Clock, href: '/dashboard/prospect-enrich?filter=expired' },
      { label: 'Imports', icon: FileText, href: '/dashboard/prospect-enrich?filter=imports' },
      { label: 'Trash', icon: FileText, href: '/dashboard/prospect-enrich?filter=trash' }
    ]
  },
  {
    title: 'CUSTOMER RELATIONSHIP MANAGEMENT',
    items: [
      { label: 'Lists', icon: UserCircle, href: '/dashboard/lists' },
      { label: 'Deals', icon: Briefcase, href: '/dashboard/crm/deals' },
      { label: 'Calendar', icon: Calendar, href: '/dashboard/crm/calendar' }
    ]
  },
  {
    title: 'MARKETING',
    items: [
      { label: 'Social Planner', icon: Megaphone, href: '/dashboard/marketing' },
      { label: 'Postiz', icon: Share2, href: '/dashboard/postiz' },
      { label: 'Email Campaigns', icon: Mail, href: '/dashboard/email/campaigns' },
      { label: 'Email Analytics', icon: BarChart3, href: '/dashboard/marketing/analytics' },
      { label: 'Conversations', icon: MessageCircle, href: '/dashboard/conversations' }
    ]
  },
  {
    title: 'TOOLS & AUTOMATION',
    items: [
      { label: 'Workflows', icon: Zap, href: '/dashboard/tools' },
      { label: 'Tasks', icon: CheckCircle2, href: '/dashboard/tasks' },
      { label: 'Analytics', icon: BarChart3, href: '/dashboard/crm/analytics' },
      { label: 'Symphony', icon: BarChart3, href: '/dashboard/symphony' }
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, signOut } = useApp()
  const { isOpen, toggle } = useSidebar()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/'
    }
    
    const hrefPath = href.split('?')[0]
    const hrefParams = new URLSearchParams(href.includes('?') ? href.split('?')[1] : '')
    
    // Check if pathname matches
    if (!pathname.startsWith(hrefPath)) {
      return false
    }
    
    // For prospect-enrich page, check filter parameter
    if (hrefPath === '/dashboard/prospect-enrich') {
      const currentFilter = searchParams.get('filter')
      const hrefFilter = hrefParams.get('filter')
      
      // If href has no filter param, it's "All Prospects" - only active when no filter is set
      if (!hrefFilter) {
        return !currentFilter
      }
      
      // Otherwise, check if filters match exactly
      return currentFilter === hrefFilter
    }
    
    // For other pages, just check pathname
    return true
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-gray-200/80 bg-white/90 dark:bg-gray-950/95 shadow-sm backdrop-blur-xl transition-[width] duration-300 ${
        isOpen ? 'w-64' : 'w-18 md:w-16'
      }`}
    >
      {/* Brand / collapse */}
      <div className="flex h-14 items-center border-b border-gray-200/80 px-3 dark:border-gray-800/80">
        {isOpen ? (
          <div className="flex w-full items-center justify-between gap-2">
            <button
              className="group flex flex-1 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer"
              onClick={() => router.push('/dashboard')}
            >
              <img
                src="/nextdeal-logo.png"
                alt="NextDeal"
                className="h-6 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
              <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                NextDeal
              </span>
            </button>
            <button
              onClick={toggle}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <button
              className="group flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-md hover:shadow-lg hover:scale-105 transition"
              onClick={() => router.push('/dashboard')}
            >
              <MapPin className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto px-2 py-4">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-3">
            {section.title && isOpen && (
              <div className="flex items-center gap-2 px-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  {section.title}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-gray-200/80 to-transparent dark:from-gray-700/70" />
              </div>
            )}
            <div className={isOpen ? 'space-y-1' : 'flex flex-col items-center gap-2'}>
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                const handleClick = () => {
                  if (item.href === '/dashboard/prospect-enrich') {
                    router.push('/dashboard/prospect-enrich')
                  } else {
                    router.push(item.href)
                  }
                }

                if (isOpen) {
                  return (
                    <button
                      key={item.href}
                      onClick={handleClick}
                      className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150 ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-900/70'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-md text-[13px] ${
                            active
                              ? 'bg-white/15'
                              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                }

                return (
                  <div key={item.href} className="group relative">
                    <button
                      onClick={handleClick}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border text-gray-600 transition-all duration-150 ${
                        active
                          ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-600/40'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                      aria-label={item.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                    <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 dark:bg-gray-800">
                      {item.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade CTA */}
      {profile && !profile.is_subscribed && isOpen && (
        <div className="border-t border-gray-200/80 px-3 pb-3 pt-2 dark:border-gray-800/80">
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-3 text-xs text-white shadow-md shadow-blue-600/30">
            <p className="mb-2 font-semibold">Upgrade to unlock full NextDeal</p>
            <button
              onClick={() => router.push('/pricing')}
              className="inline-flex w-full items-center justify-center rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/20"
            >
              Upgrade plan
            </button>
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="border-t border-gray-200/80 px-3 py-3 dark:border-gray-800/80">
        {isOpen ? (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-900">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-bold text-white shadow-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-50">
                {profile?.name || 'User'}
              </p>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {profile?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-bold text-white shadow-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
              <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 dark:bg-gray-800">
                {profile?.name || 'User'}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
