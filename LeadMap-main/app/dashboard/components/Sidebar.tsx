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
      className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[#e5e5e5] bg-white dark:bg-dark shadow-sm transition-[width] duration-300 ${
        isOpen ? 'w-[270px]' : 'w-[75px]'
      }`}
    >
      {/* Brand / collapse */}
      <div className="flex min-h-[70px] items-center border-b border-[#e5e5e5] px-6 dark:border-[#333f55]">
        {isOpen ? (
          <div className="flex w-full items-center justify-between gap-2 brand-logo overflow-hidden">
            <button
              className="group flex flex-1 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 hover:bg-lightprimary-fallback hover:text-primary cursor-pointer transition-colors"
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
              <span className="truncate text-sm font-semibold text-link dark:text-darklink">
                NextDeal
              </span>
            </button>
            <button
              onClick={toggle}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e5e5] bg-white text-link hover:bg-lightprimary hover:text-primary dark:border-[#333f55] dark:bg-dark dark:text-darklink dark:hover:bg-lightprimary"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <button
              className="group flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-md hover:shadow-lg hover:scale-105 transition"
              onClick={() => router.push('/dashboard')}
            >
              <MapPin className="h-4 w-4" />
            </button>
            <button
              onClick={toggle}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e5e5] bg-white text-link hover:bg-lightprimary hover:text-primary dark:border-[#333f55] dark:bg-dark dark:text-darklink dark:hover:bg-lightprimary"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1 overflow-y-auto px-4 py-4">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-3">
            {section.title && isOpen && (
              <div className="caption px-0 mb-0" style={{ marginTop: '24px', padding: '3px 0px', lineHeight: '26px' }}>
                <h5 className="text-link dark:text-darklink font-bold text-xs uppercase leading-[26px]">
                  {section.title}
                </h5>
              </div>
            )}
            <div className={isOpen ? 'space-y-0.5' : 'flex flex-col items-center gap-2'}>
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
                      className={`group flex w-full items-center gap-3 rounded-md p-3 text-start truncate cursor-pointer leading-normal transition-all duration-200 ease-in-out hover:translate-x-1 ${
                        active
                          ? 'text-white bg-primary hover:bg-primary hover:text-white font-medium'
                          : 'text-link dark:text-darklink hover:text-primary dark:hover:text-primary bg-transparent hover:bg-lightprimary-fallback dark:hover:bg-lightprimary-fallback font-normal'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate text-sm hide-menu flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary hide-menu">
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
                      className={`flex h-9 w-9 items-center justify-center rounded-md border transition-all duration-200 ${
                        active
                          ? 'border-primary bg-primary text-white'
                            : 'border-transparent text-link hover:bg-lightprimary hover:text-primary dark:text-darklink dark:hover:bg-lightprimary'
                      }`}
                      aria-label={item.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                    <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-dark px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 dark:bg-gray-800">
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
        <div className="border-t border-[#e5e5e5] px-4 pb-3 pt-2 dark:border-[#333f55]">
          <div className="rounded-md bg-lightsecondary p-4 text-xs text-white overflow-hidden">
            <p className="mb-2 text-base font-semibold text-link dark:text-darklink">Upgrade to unlock full NextDeal</p>
            <button
              onClick={() => router.push('/pricing')}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary/90"
            >
              Upgrade plan
            </button>
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="border-t border-[#e5e5e5] px-4 py-4 dark:border-[#333f55]">
        {isOpen ? (
          <div className="flex items-center gap-4 rounded-md bg-lightsecondary px-4 py-4 overflow-hidden">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-link dark:text-darklink">
                {profile?.name || 'User'}
              </h3>
              <p className="truncate text-xs font-normal text-[#737373] dark:text-darklink">
                {profile?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
              <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-dark px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 dark:bg-gray-800">
                {profile?.name || 'User'}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
