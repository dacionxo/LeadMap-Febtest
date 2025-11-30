'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { 
  Home, 
  LayoutDashboard,
  Users,
  Zap,
  Sparkles,
  Clock,
  FileText,
  MapPin,
  Mail,
  Building2,
  Briefcase,
  Globe,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Calendar,
  BarChart3,
  CheckCircle2,
  Megaphone,
  MessageCircle
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
      { label: 'Expired Listings', icon: Clock, href: '/dashboard/prospect-enrich?filter=expired' },
      { label: 'Probate', icon: FileText, href: '/dashboard/prospect-enrich?filter=probate' },
      { label: 'For Sale', icon: Building2, href: '/dashboard/prospect-enrich?filter=fsbo' },
      { label: 'For Rent', icon: Building2, href: '/dashboard/prospect-enrich?filter=frbo' },
      { label: 'Foreclosures', icon: Building2, href: '/dashboard/prospect-enrich?filter=foreclosure' },
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
    title: 'EMAIL',
    items: [
      { label: 'Campaigns', icon: Mail, href: '/dashboard/marketing?tab=campaigns' },
      { label: 'Unibox', icon: MessageCircle, href: '/dashboard/marketing?tab=unibox' },
      { label: 'Templates', icon: FileText, href: '/dashboard/marketing?tab=templates' },
      { label: 'Analytics', icon: BarChart3, href: '/dashboard/marketing?tab=analytics' },
      { label: 'Compose', icon: Mail, href: '/dashboard/email/compose' }
    ]
  },
  {
    title: 'MARKETING',
    items: [
      { label: 'Social Planner', icon: Megaphone, href: '/dashboard/marketing' },
      { label: 'Conversations', icon: MessageCircle, href: '/dashboard/conversations' }
    ]
  },
  {
    title: 'TOOLS & AUTOMATION',
    items: [
      { label: 'Workflows', icon: Zap, href: '/dashboard/tools' },
      { label: 'Tasks', icon: CheckCircle2, href: '/dashboard/tasks' },
      { label: 'Analytics', icon: BarChart3, href: '/dashboard/crm/analytics' }
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
    <aside className={`fixed left-0 top-0 h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col z-40 shadow-sm transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-16'
    }`}>
      {/* Logo with Animation */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {isOpen ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 group cursor-pointer flex-1" onClick={() => router.push('/dashboard')}>
              <img 
                src="/nextdeal-logo.png" 
                alt="NextDeal" 
                className="h-8 w-auto"
                onError={(e) => {
                  // Fallback if image doesn't exist - show icon and text
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="flex items-center space-x-2" style={{ display: 'none' }}>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-black dark:text-white">NextDeal</span>
              </div>
            </div>
            <button
              onClick={toggle}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <ChevronLeft className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <img 
              src="/nextdeal-logo.png" 
              alt="NextDeal" 
              className="h-8 w-auto cursor-pointer hover:scale-105 transition-transform duration-200"
              onClick={() => router.push('/dashboard')}
              onError={(e) => {
                // Fallback if image doesn't exist - show icon
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div 
              className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md hover:scale-105 transition-transform duration-200 cursor-pointer"
              style={{ display: 'none' }}
              onClick={() => router.push('/dashboard')}
            >
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={toggle}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <ChevronRight className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar">
        {isOpen ? (
          <div className="px-3 py-4 space-y-3">
            {navSections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="animate-fade-in-up" style={{ animationDelay: `${sectionIdx * 0.1}s` }}>
                {section.title && (
                  <h3 className="px-2 text-[10px] font-semibold text-black dark:text-white uppercase tracking-wider mb-1.5 mt-3 first:mt-0">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item, itemIdx) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    
                    return (
                      <button
                        key={item.href}
                        onClick={() => {
                          // For "All Prospects", ensure we clear any filter params
                          if (item.href === '/dashboard/prospect-enrich') {
                            router.push('/dashboard/prospect-enrich')
                          } else {
                            router.push(item.href)
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 group relative ${
                          active
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-2 border-blue-600 dark:border-blue-400'
                            : 'text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        style={{
                          animationDelay: `${(sectionIdx * 0.1) + (itemIdx * 0.05)}s`
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{item.label}</span>
                        </div>
                        
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 space-y-1">
            {navSections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  
                  return (
                    <div key={item.href} className="relative group">
                      <button
                        onClick={() => {
                          // For "All Prospects", ensure we clear any filter params
                          if (item.href === '/dashboard/prospect-enrich') {
                            router.push('/dashboard/prospect-enrich')
                          } else {
                            router.push(item.href)
                          }
                        }}
                        className={`w-full flex items-center justify-center p-2 rounded-md transition-all duration-200 ${
                          active
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        title={item.label}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                      {/* Tooltip */}
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    </div>
                  )
                })}
                {sectionIdx < navSections.length - 1 && section.items.length > 0 && (
                  <div className="h-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Upgrade CTA */}
      {profile && !profile.is_subscribed && isOpen && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.push('/pricing')}
            className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* User Section */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 mt-auto">
        {isOpen ? (
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-black dark:text-white block truncate">
                {profile?.name || 'User'}
              </span>
              <span className="text-[10px] text-black/70 dark:text-gray-400 truncate block">
                {profile?.email || 'user@example.com'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-200 relative group">
              <span className="text-xs font-bold text-white">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                {profile?.name || 'User'}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
