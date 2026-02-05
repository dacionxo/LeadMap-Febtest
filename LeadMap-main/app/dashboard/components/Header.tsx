'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { useApp } from '@/app/providers'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import { useSidebar } from './SidebarContext'
import Search from './header/Search'
import AppLinks from './header/AppLinks'
import MobileHeaderItems from './header/MobileHeaderItems'

interface MessageType {
  title: string
  subtitle: string
}

type NotificationType = 'comment' | 'system' | 'file' | 'warning'

interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: React.ReactNode
  time: string
  unread?: boolean
  /** For type 'file': attachment label */
  attachment?: string
  /** For type 'comment': project/link name */
  projectName?: string
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'comment',
    title: 'Sarah Williams',
    message: <>commented on your <span className="text-primary font-medium hover:underline">Dashboard Design</span> project.</>,
    time: '2 min ago',
    unread: true,
    projectName: 'Dashboard Design',
  },
  {
    id: '2',
    type: 'system',
    title: 'System Update',
    message: 'Your application has been successfully updated to version 2.4.0.',
    time: '1 hour ago',
  },
  {
    id: '3',
    type: 'file',
    title: 'Michael Foster',
    message: <>attached a file to <span className="font-medium text-gray-700 dark:text-gray-300">Weekly Report</span>.</>,
    time: '3 hours ago',
    attachment: 'report_q3_final.pdf',
  },
  {
    id: '4',
    type: 'warning',
    title: 'Subscription Expiring',
    message: 'Your Pro plan subscription will expire in 3 days. Renew now to keep features.',
    time: 'Yesterday',
  },
]

type HeaderProps = {
  scrollContainerRef?: React.RefObject<HTMLElement | null>
}

export default function Header({ scrollContainerRef }: HeaderProps) {
  const { profile, signOut } = useApp()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { toggle: toggleSidebar, isOpen } = useSidebar()
  const [isSticky, setIsSticky] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mobileMenu, setMobileMenu] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = scrollContainerRef?.current

    const handleScroll = () => {
      const y = el ? el.scrollTop : window.scrollY
      setIsSticky(y > 50)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Header.tsx:54',message:'Scroll event',data:{scrollY:y,isSticky:y>50,scrollContainer:el?true:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    }

    // Run once on mount so state is correct if already scrolled
    handleScroll()

    const target: any = el ?? window
    target.addEventListener('scroll', handleScroll, { passive: true })

    return () => target.removeEventListener('scroll', handleScroll)
  }, [scrollContainerRef])

  useEffect(() => {
    // #region agent log
    if (headerRef.current) {
      const headerEl = headerRef.current;
      const computedStyle = window.getComputedStyle(headerEl);
      const position = computedStyle.position;
      const top = computedStyle.top;
      const parentEl = headerEl.parentElement;
      const parentComputed = parentEl ? window.getComputedStyle(parentEl) : null;
      const parentOverflow = parentComputed?.overflow || 'N/A';
      const parentOverflowY = parentComputed?.overflowY || 'N/A';
      const grandparentEl = parentEl?.parentElement;
      const grandparentComputed = grandparentEl ? window.getComputedStyle(grandparentEl) : null;
      const grandparentOverflow = grandparentComputed?.overflow || 'N/A';
      fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Header.tsx:66',message:'Header computed styles check',data:{position,top,parentOverflow,parentOverflowY,grandparentOverflow,hasStickyClass:headerEl.className.includes('sticky')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,D'})}).catch(()=>{});
    }
    // #endregion
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    if (showProfileMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu, showNotifications])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleMobileMenu = () => {
    if (mobileMenu === 'active') {
      setMobileMenu('')
    } else {
      setMobileMenu('active')
    }
  }

  const toggleMode = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <>
      <header
        ref={headerRef}
        className={`sticky top-0 z-[100] transition-all ${
          isSticky
            ? 'bg-white dark:bg-dark shadow-md dark:shadow-dark-md'
            : 'bg-white dark:bg-dark'
        }`}
      >
        <nav className="px-2 dark:border-gray-700 rounded-none bg-white dark:bg-dark py-4 sm:px-6">
          <div className="mx-auto flex flex-nowrap items-center justify-between">
            {/* Mobile Menu Toggle */}
            <span
              onClick={toggleSidebar}
              className="px-[15px] hover:text-primary dark:hover:text-primary text-link dark:text-darklink relative after:absolute after:w-10 after:h-10 after:rounded-full hover:after:bg-lightprimary after:bg-transparent rounded-full xl:hidden flex justify-center items-center cursor-pointer"
            >
              <Icon icon="tabler:menu-2" height={20} />
            </span>

            {/* Desktop Toggle Icon */}
            <div className="xl:!block !hidden">
              <div className="flex gap-0 items-center relative">
                <span
                  onClick={toggleSidebar}
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer xl:flex hidden relative"
                >
                  <Icon icon="tabler:menu-2" height={20} />
                </span>

                {/* Search Component */}
                <Search />

                {/* App Links Component */}
                <AppLinks />

                {/* Quick Links - Matching Tailwindadmin */}
                <Link
                  href="/dashboard/crm/calendar"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Calendar
                </Link>

                <Link
                  href="/dashboard/email/campaigns"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Campaigns
                </Link>

                <Link
                  href="/dashboard/unibox"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Unibox
                </Link>
              </div>
            </div>

            {/* Mobile Logo */}
            <div className="block xl:hidden">
              <img
                src="/images/logos/nextdeal-logo.png"
                alt="NextDeal"
                className="h-8 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>

            {/* Right Side Actions */}
            <div className="xl:!block !hidden md:!hidden">
              <div className="flex gap-0 items-center">
                {/* Theme Toggle */}
                {theme === 'light' ? (
                  <div
                    className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer group relative"
                    onClick={toggleMode}
                  >
                    <Icon icon="tabler:moon" width="20" />
                  </div>
                ) : (
                  <div
                    className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer group relative"
                    onClick={toggleMode}
                  >
                    <Icon icon="solar:sun-bold-duotone" width="20" />
                  </div>
                )}

                {/* Messages Dropdown */}
                <div className="relative group/menu px-4" ref={notificationsRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(!showNotifications)
                      setShowProfileMenu(false)
                    }}
                    aria-label="Notifications"
                    className="text-sm text-link dark:text-darklink dark:hover:text-primary h-10 hover:text-primary flex items-center justify-center cursor-pointer"
                  >
                    <div className="relative">
                      <span className="relative after:absolute after:w-10 after:h-10 after:rounded-full hover:text-primary after:-top-1/2 hover:after:bg-lightprimary text-link dark:text-darklink rounded-full flex justify-center items-center cursor-pointer group-hover/menu:after:bg-lightprimary group-hover/menu:!text-primary">
                        <Icon icon="tabler:bell-ringing" height={20} />
                      </span>
                      <span className="rounded-full absolute -end-[6px] -top-[5px] text-[10px] h-2 w-2 bg-primary flex justify-center items-center"></span>
                    </div>
                  </button>

                  {/* Notifications Dropdown - minimal card design */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-full max-w-sm sm:w-[384px] bg-white dark:bg-slate-900 rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.05),0_10px_10px_-5px_rgba(0,0,0,0.01)] dark:shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[101]">
                      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-slate-900">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                          Notifications
                        </h2>
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white shadow-sm">
                          {NOTIFICATIONS.filter(n => n.unread).length || NOTIFICATIONS.length}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[480px] overflow-y-auto">
                        {NOTIFICATIONS.map((item) => (
                          <Link
                            key={item.id}
                            href="#"
                            className="block px-6 py-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 group relative"
                            onClick={() => setShowNotifications(false)}
                          >
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0">
                                {item.type === 'comment' || item.type === 'file' ? (
                                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-semibold shadow-sm border border-gray-100 dark:border-gray-600">
                                    {item.title.charAt(0)}
                                  </div>
                                ) : item.type === 'system' ? (
                                  <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800">
                                    <Icon icon="solar:shield-check-linear" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center border border-amber-100 dark:border-amber-800/50">
                                    <Icon icon="solar:danger-triangle-linear" className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item.title}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                  {item.message}
                                </p>
                                {item.attachment && (
                                  <div className="mt-2 flex items-center p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 max-w-xs">
                                    <Icon icon="solar:document-linear" className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 shrink-0" />
                                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate">
                                      {item.attachment}
                                    </span>
                                  </div>
                                )}
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center">
                                  {item.unread && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2 shrink-0" />
                                  )}
                                  {item.time}
                                </p>
                              </div>
                            </div>
                            {item.unread && (
                              <span className="absolute right-6 top-6 w-2 h-2 bg-primary rounded-full shadow-sm" aria-hidden />
                            )}
                          </Link>
                        ))}
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700 p-4 text-center">
                        <Link
                          href="/dashboard/email"
                          onClick={() => setShowNotifications(false)}
                          className="inline-flex items-center text-sm font-medium text-primary hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors group"
                        >
                          See All Notifications
                          <Icon icon="solar:arrow-right-linear" className="h-5 w-5 ml-1 transform group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Dropdown - Advanced design (TailwindAdmin + reference) */}
                <div className="relative group/menu" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu)
                      setShowNotifications(false)
                    }}
                    aria-expanded={showProfileMenu ? 'true' : 'false'}
                    aria-haspopup="true"
                    aria-label="Open profile menu"
                    className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer group-hover/menu:text-primary mt-[10px]"
                  >
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm ring-2 ring-gray-100 dark:ring-slate-700">
                      {profile?.name?.charAt(0).toUpperCase() || 'U'}
                      <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white dark:ring-slate-800" aria-hidden />
                    </div>
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-3 w-96 origin-top-right rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-black/5 border border-gray-200 dark:border-slate-700 overflow-hidden z-50">
                      {/* Header with gradient */}
                      <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-800/50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white shadow-md ring-4 ring-white dark:ring-slate-700">
                              {profile?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-50 leading-tight">
                                {profile?.name || 'User'}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                                {profile?.email || 'user@example.com'}
                              </p>
                              <span className="inline-flex items-center rounded-full bg-primary/10 dark:bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                                {profile?.plan_tier ? profile.plan_tier.charAt(0).toUpperCase() + profile.plan_tier.slice(1).toLowerCase() + ' Plan' : 'Member'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* My Profile & My Notes cards */}
                      <div className="grid grid-cols-2 gap-3 p-4 bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            router.push('/dashboard/settings')
                            setShowProfileMenu(false)
                          }}
                          className="group relative flex flex-col justify-between rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 p-4 hover:border-primary/50 hover:shadow-md transition-all duration-200 text-left"
                        >
                          <div className="flex justify-between items-start w-full mb-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                              <Icon icon="solar:user-circle-linear" className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                              85%
                            </span>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                              My Profile
                            </h4>
                            <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-1.5 mt-2">
                              <div className="bg-blue-500 h-1.5 rounded-full w-[85%]" />
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">
                              Complete setup
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            router.push('/dashboard')
                            setShowProfileMenu(false)
                          }}
                          className="group relative flex flex-col justify-between rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 p-4 hover:border-primary/50 hover:shadow-md transition-all duration-200 text-left"
                        >
                          <div className="flex justify-between items-start w-full mb-2">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                              <Icon icon="solar:notes-linear" className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                              2m ago
                            </span>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                              My Notes
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              Review Q3 marketing goals...
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Action links */}
                      <div className="px-2 pb-2">
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                          <Icon icon="solar:settings-linear" className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                          Account Settings
                        </Link>
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                          <Icon icon="solar:card-linear" className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                          Billing & Plans
                        </Link>
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                          <Icon icon="solar:users-group-rounded-linear" className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                          Invite Team
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                            New
                          </span>
                        </Link>
                      </div>

                      {/* Sign out */}
                      <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 p-2">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full group"
                        >
                          <Icon icon="solar:logout-2-linear" className="h-5 w-5 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Toggle Icon */}
            <span
              className="h-10 w-10 flex xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer"
              onClick={handleMobileMenu}
            >
              <Icon icon="tabler:dots" height={21} />
            </span>
          </div>
        </nav>

        {/* Mobile Header Menu */}
        <div className={`w-full xl:hidden block mobile-header-menu ${mobileMenu}`}>
          <MobileHeaderItems />
        </div>
      </header>
    </>
  )
}
