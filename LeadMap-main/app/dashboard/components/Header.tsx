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

const MessagesLink: MessageType[] = [
  {
    title: 'Welcome to LeadMap!',
    subtitle: 'Get started with your first lead',
  },
  {
    title: 'New feature available',
    subtitle: 'Check out our latest updates',
  },
  {
    title: 'Payment received',
    subtitle: 'Your subscription is active',
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

  useEffect(() => {
    const el = scrollContainerRef?.current

    const handleScroll = () => {
      const y = el ? el.scrollTop : window.scrollY
      setIsSticky(y > 50)
    }

    // Run once on mount so state is correct if already scrolled
    handleScroll()

    const target: any = el ?? window
    target.addEventListener('scroll', handleScroll, { passive: true })

    return () => target.removeEventListener('scroll', handleScroll)
  }, [scrollContainerRef])

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
                  href="/dashboard/conversations"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Chat
                </Link>

                <Link
                  href="/dashboard/calendar"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Calendar
                </Link>

                <Link
                  href="/dashboard/email"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Email
                </Link>
              </div>
            </div>

            {/* Mobile Logo */}
            <div className="block xl:hidden">
              <img
                src="/nextdeal-logo.png"
                alt="NextDeal"
                className="h-6 w-auto"
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
                    onClick={() => {
                      setShowNotifications(!showNotifications)
                      setShowProfileMenu(false)
                    }}
                    className="text-sm text-link dark:text-darklink dark:hover:text-primary h-10 hover:text-primary flex items-center justify-center cursor-pointer"
                  >
                    <div className="relative">
                      <span className="relative after:absolute after:w-10 after:h-10 after:rounded-full hover:text-primary after:-top-1/2 hover:after:bg-lightprimary text-link dark:text-darklink rounded-full flex justify-center items-center cursor-pointer group-hover/menu:after:bg-lightprimary group-hover/menu:!text-primary">
                        <Icon icon="tabler:bell-ringing" height={20} />
                      </span>
                      <span className="rounded-full absolute -end-[6px] -top-[5px] text-[10px] h-2 w-2 bg-primary flex justify-center items-center"></span>
                    </div>
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-screen sm:w-[360px] bg-white dark:bg-dark shadow-md dark:shadow-dark-md rounded-sm py-6 z-[101]">
                      <div className="flex items-center px-6 justify-between">
                        <h3 className="mb-0 text-lg font-semibold text-ld">Notification</h3>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-primary text-white">
                          5 new
                        </span>
                      </div>
                      <div className="max-h-80 mt-3 overflow-y-auto">
                        {MessagesLink.map((link, index) => (
                          <Link
                            key={index}
                            href="#"
                            className="px-6 py-3 flex justify-between items-center bg-hover group/link w-full hover:bg-lightprimary"
                          >
                            <div className="flex items-center">
                              <span className="flex-shrink-0 relative">
                                <div className="h-[45px] w-[45px] rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                                  {link.title.charAt(0)}
                                </div>
                              </span>
                              <div className="ps-4">
                                <h5 className="mb-1 text-sm group-hover/link:text-primary">
                                  {link.title}
                                </h5>
                                <span className="text-xs block truncate text-darklink">
                                  {link.subtitle}
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <div className="pt-5 px-6">
                        <Link
                          href="/dashboard/email"
                          className="w-full border border-primary text-primary hover:bg-primary hover:text-white rounded-md py-2 px-4 block text-center"
                        >
                          See All Notifications
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Dropdown */}
                <div className="relative group/menu" ref={menuRef}>
                  <button
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu)
                      setShowNotifications(false)
                    }}
                    className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer group-hover/menu:text-primary"
                  >
                    <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
                      {profile?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </button>

                  {/* Profile Dropdown Menu */}
                  {showProfileMenu && (
                    <div className="dropdown ui-dropdown ui-dropdown-animation absolute right-0 mt-2 z-50 w-screen sm:w-[360px] py-6 px-0 rounded-sm">
                      {/* Header */}
                      <div className="px-6">
                        <h3 className="text-lg font-semibold text-ld">User Profile</h3>
                        <div className="flex items-center gap-6 pb-5 border-b border-border dark:border-darkborder mt-5 mb-3">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white shadow-sm">
                            {profile?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <h5 className="card-title text-sm mb-0.5 font-medium">
                              {profile?.name || 'User'}
                            </h5>
                            <span className="card-subtitle text-muted font-normal">
                              {profile?.plan_tier ? profile.plan_tier.charAt(0).toUpperCase() + profile.plan_tier.slice(1) : 'Member'}
                            </span>
                            <p className="card-subtitle font-normal text-muted mb-0 mt-1 flex items-center">
                              <Icon
                                icon="tabler:mail"
                                className="text-base me-1 relative top-0.5"
                              />
                              {profile?.email || 'user@example.com'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dropdown items */}
                      <div className="max-h-64 overflow-y-auto">
                        <button
                          onClick={() => {
                            router.push('/dashboard/settings')
                            setShowProfileMenu(false)
                          }}
                          className="px-6 py-3 flex justify-between items-center bg-hover group/link w-full cursor-pointer hover:bg-lightprimary"
                        >
                          <div className="h-11 w-11 flex-shrink-0 rounded-md flex justify-center items-center bg-lightprimary">
                            <Icon icon="solar:user-circle-linear" className="h-6 w-6 text-primary" />
                          </div>
                          <div className="ps-4 flex justify-between w-full">
                            <div className="w-3/4">
                              <h5 className="mb-1 text-sm group-hover/link:text-primary">
                                My Profile
                              </h5>
                              <div className="text-xs text-darklink">
                                Account settings
                              </div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            router.push('/dashboard')
                            setShowProfileMenu(false)
                          }}
                          className="px-6 py-3 flex justify-between items-center bg-hover group/link w-full cursor-pointer hover:bg-lightprimary"
                        >
                          <div className="h-11 w-11 flex-shrink-0 rounded-md flex justify-center items-center bg-lightprimary">
                            <Icon icon="solar:notes-linear" className="h-6 w-6 text-primary" />
                          </div>
                          <div className="ps-4 flex justify-between w-full">
                            <div className="w-3/4">
                              <h5 className="mb-1 text-sm group-hover/link:text-primary">
                                My Notes
                              </h5>
                              <div className="text-xs text-darklink">
                                My Daily Notes
                              </div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            router.push('/dashboard')
                            setShowProfileMenu(false)
                          }}
                          className="px-6 py-3 flex justify-between items-center bg-hover group/link w-full cursor-pointer hover:bg-lightprimary"
                        >
                          <div className="h-11 w-11 flex-shrink-0 rounded-md flex justify-center items-center bg-lightprimary">
                            <Icon icon="solar:checklist-linear" className="h-6 w-6 text-primary" />
                          </div>
                          <div className="ps-4 flex justify-between w-full">
                            <div className="w-3/4">
                              <h5 className="mb-1 text-sm group-hover/link:text-primary">
                                My Tasks
                              </h5>
                              <div className="text-xs text-darklink">
                                To-do and Daily tasks
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Logout Button */}
                      <div className="pt-2 px-7">
                        <button
                          onClick={handleSignOut}
                          className="w-full border border-primary text-primary hover:bg-primary hover:text-white rounded-md py-2 px-4 text-sm font-medium transition-colors"
                        >
                          Logout
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
