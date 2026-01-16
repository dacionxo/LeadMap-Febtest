'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@iconify/react'
import { useApp } from '@/app/providers'
import { useSidebar } from './SidebarContext'
import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'

interface NavItem {
  label: string
  icon: string
  href: string
  badge?: string
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Home',
    items: [
      { label: 'Dashboard', icon: 'solar:widget-2-linear', href: '/dashboard' },
      { label: 'Maps', icon: 'solar:map-point-linear', href: '/dashboard/map' }
    ]
  },
  {
    title: 'PROSPECT & ENRICH',
    items: [
      { label: 'All Prospects', icon: 'solar:users-group-rounded-linear', href: '/dashboard/prospect-enrich' },
      { label: 'For Sale', icon: 'solar:home-2-linear', href: '/dashboard/prospect-enrich?filter=fsbo' },
      { label: 'For Rent', icon: 'solar:home-2-linear', href: '/dashboard/prospect-enrich?filter=frbo' },
      { label: 'Foreclosures', icon: 'solar:home-2-linear', href: '/dashboard/prospect-enrich?filter=foreclosure' },
      { label: 'Probate', icon: 'solar:bill-list-linear', href: '/dashboard/prospect-enrich?filter=probate' },
      { label: 'Expired Listings', icon: 'solar:clock-circle-linear', href: '/dashboard/prospect-enrich?filter=expired' },
      { label: 'Imports', icon: 'solar:server-minimalistic-linear', href: '/dashboard/prospect-enrich?filter=imports' },
      { label: 'Trash', icon: 'solar:trash-bin-minimalistic-linear', href: '/dashboard/prospect-enrich?filter=trash' }
    ]
  },
  {
    title: 'CUSTOMER RELATIONSHIP MANAGEMENT',
    items: [
      { label: 'Lists', icon: 'solar:user-circle-linear', href: '/dashboard/lists' },
      { label: 'Deals', icon: 'solar:case-linear', href: '/dashboard/crm/deals' },
      { label: 'Calendar', icon: 'solar:calendar-linear', href: '/dashboard/crm/calendar' }
    ]
  },
  {
    title: 'MARKETING',
    items: [
      { label: 'Social Planner', icon: 'solar:megaphone-linear', href: '/dashboard/marketing' },
      { label: 'Postiz', icon: 'solar:share-linear', href: '/dashboard/postiz' },
      { label: 'Email Campaigns', icon: 'solar:letter-linear', href: '/dashboard/email/campaigns' },
      { label: 'Email Analytics', icon: 'solar:chart-2-linear', href: '/dashboard/marketing/analytics' },
      { label: 'Conversations', icon: 'solar:dialog-linear', href: '/dashboard/conversations' }
    ]
  },
  {
    title: 'TOOLS & AUTOMATION',
    items: [
      { label: 'Workflows', icon: 'solar:lightning-linear', href: '/dashboard/tools' },
      { label: 'Tasks', icon: 'solar:check-circle-linear', href: '/dashboard/tasks' },
      { label: 'Analytics', icon: 'solar:chart-2-linear', href: '/dashboard/crm/analytics' },
      { label: 'Symphony', icon: 'solar:chart-2-linear', href: '/dashboard/symphony' }
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
      <div className="flex min-h-[70px] items-center px-6 brand-logo overflow-hidden">
        {isOpen ? (
          <div className="flex w-full items-center justify-center">
            <button
              className="group flex items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 hover:bg-lightprimary hover:text-primary cursor-pointer transition-colors"
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
          </div>
        ) : (
          <div className="flex w-full items-center justify-center">
            <button
              className="group flex items-center justify-center rounded-md px-2 py-1.5 hover:bg-lightprimary hover:text-primary cursor-pointer transition-colors"
              onClick={() => router.push('/dashboard')}
            >
              <img
                src="/nextdeal-logo.png"
                alt="NextDeal"
                className="h-8 w-auto max-w-[40px] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <SimpleBar className="h-[calc(100vh_-_180px)]">
        <nav className="sidebar-nav flex-1 px-4 py-4">
          {navSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="mb-3">
              {section.title && (
                <div className="caption px-0 mb-0" style={{ marginTop: '24px', padding: '3px 0px', lineHeight: '26px' }}>
                  <h5 className="text-link dark:text-darklink font-bold text-xs uppercase leading-[26px]">
                    {isOpen ? (
                      <span className="hide-menu leading-21">{section.title}</span>
                    ) : (
                      <div className="flex justify-center">
                        <Icon
                          icon="tabler:dots"
                          className="text-ld leading-6 dark:text-opacity-60"
                          height={18}
                        />
                      </div>
                    )}
                  </h5>
                </div>
              )}
            <div className={isOpen ? 'space-y-0.5' : 'flex flex-col items-center gap-2'}>
              {section.items.map((item) => {
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
                          : 'text-link dark:text-darklink hover:text-primary dark:hover:text-primary bg-transparent hover:bg-lightprimary dark:hover:bg-lightprimary font-normal'
                      }`}
                    >
                      <Icon icon={item.icon} className="h-5 w-5 flex-shrink-0" />
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
                      <Icon icon={item.icon} className="h-4 w-4" />
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
      </SimpleBar>

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
      <div className={`border-t border-[#e5e5e5] py-4 dark:border-[#333f55] ${isOpen ? 'px-4' : 'px-0.5'}`}>
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
