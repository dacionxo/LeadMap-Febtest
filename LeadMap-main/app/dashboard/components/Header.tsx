'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { useApp } from '@/app/providers'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import { useSidebar } from './SidebarContext'
import Search from './header/Search'
import AppLinks from './header/AppLinks'
import Messages from './header/Messages'
import Profile from './header/Profile'
import MobileHeaderItems from './header/MobileHeaderItems'

export default function Header() {
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
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsSticky(true)
      } else {
        setIsSticky(false)
      }
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
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

  const getTrialStatus = () => {
    if (!profile) return null

    if (profile.is_subscribed) {
      return (
        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          Active
        </span>
      )
    }

    const trialEnd = new Date(profile.trial_end)
    const now = new Date()
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysLeft > 0) {
      return (
        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg">
          {daysLeft} days left
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg">
        Trial Expired
      </span>
    )
  }

  return (
    <>
      <header
        className={`sticky top-0 z-[2] ${
          isSticky
            ? 'bg-white dark:bg-dark shadow-md fixed w-full'
            : 'bg-transparent'
        }`}
      >
        <nav className="px-2 dark:border-gray-700 rounded-none bg-transparent dark:bg-transparent py-4 sm:px-6">
          <div className="mx-auto flex flex-wrap items-center justify-between">
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
                  className="px-[15px] relative after:absolute after:w-10 after:h-10 after:rounded-full hover:after:bg-lightprimary after:bg-transparent text-link hover:text-primary dark:text-darklink dark:hover:text-primary rounded-full justify-center items-center cursor-pointer xl:flex hidden"
                >
                  <Icon icon="tabler:menu-2" height={20} />
                </span>

                {/* Search Component */}
                <Search />

                {/* App Links Component */}
                <AppLinks />

                {/* Quick Links */}
                <Link
                  href="/dashboard/map"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Maps
                </Link>

                <Link
                  href="/dashboard/prospect-enrich"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Enrich
                </Link>

                <Link
                  href="/dashboard"
                  className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center"
                >
                  Dashboard
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
                {/* Trial Status */}
                {getTrialStatus() && (
                  <div className="px-4">
                    {getTrialStatus()}
                  </div>
                )}

                {/* Theme Toggle */}
                {theme === 'light' ? (
                  <div
                    className="hover:text-primary px-4 dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-link dark:text-darklink group relative"
                    onClick={toggleMode}
                  >
                    <span className="flex items-center justify-center relative after:absolute after:w-10 after:h-10 after:rounded-full after:-top-1/2 group-hover:after:bg-lightprimary">
                      <Icon icon="tabler:moon" width="20" />
                    </span>
                  </div>
                ) : (
                  <div
                    className="hover:text-primary px-4 dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-link dark:text-darklink group relative"
                    onClick={toggleMode}
                  >
                    <span className="flex items-center justify-center relative after:absolute after:w-10 after:h-10 after:rounded-full after:-top-1/2 group-hover:after:bg-lightprimary">
                      <Icon icon="solar:sun-bold-duotone" width="20" />
                    </span>
                  </div>
                )}

                {/* Messages Dropdown */}
                <div className="relative group/menu px-4" ref={notificationsRef}>
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications)
                      setShowProfileMenu(false)
                    }}
                    className="relative"
                  >
                    <span className="relative after:absolute after:w-10 after:h-10 after:rounded-full hover:text-primary after:-top-1/2 hover:after:bg-lightprimary text-link dark:text-darklink rounded-full flex justify-center items-center cursor-pointer group-hover/menu:after:bg-lightprimary group-hover/menu:!text-primary">
                      <Icon icon="tabler:bell-ringing" height={20} />
                    </span>
                    <span className="rounded-full absolute -end-[6px] -top-[5px] text-[10px] h-2 w-2 bg-primary flex justify-center items-center"></span>
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-screen sm:w-[360px] bg-white dark:bg-dark shadow-md dark:shadow-dark-md rounded-sm py-6 z-50">
                      <div className="flex items-center px-6 justify-between">
                        <h3 className="mb-0 text-lg font-semibold text-ld">Notification</h3>
                      </div>
                      <div className="px-6 py-4 max-h-80 overflow-y-auto">
                        <p className="text-sm text-link dark:text-darklink">No new notifications</p>
                      </div>
                      <div className="pt-5 px-6">
                        <Link
                          href="/dashboard"
                          className="w-full border border-primary text-primary hover:bg-primary hover:text-white rounded-md py-2 px-4 block text-center"
                        >
                          See All Notifications
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Dropdown */}
                <div className="relative group/menu ps-4" ref={menuRef}>
                  <button
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu)
                      setShowNotifications(false)
                    }}
                    className="hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary"
                  >
                    <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
                      {profile?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </button>

                  {/* Profile Dropdown Menu */}
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-screen sm:w-[360px] bg-white dark:bg-dark shadow-md dark:shadow-dark-md rounded-sm py-6 z-50">
                      {/* Header */}
                      <div className="px-6">
                        <h3 className="text-lg font-semibold text-ld">User Profile</h3>
                        <div className="flex items-center gap-6 pb-5 border-b border-border dark:border-darkborder mt-5 mb-3">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-base font-bold text-white shadow-sm">
                            {profile?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <h5 className="card-title text-sm mb-0.5 font-medium">
                              {profile?.name || 'User'}
                            </h5>
                            <p className="card-subtitle font-normal text-muted mb-0 mt-1 flex items-center">
                              <Icon icon="tabler:mail" className="text-base me-1 relative top-0.5" />
                              {profile?.email || 'user@example.com'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dropdown items */}
                      <div className="px-6 py-2">
                        <button
                          onClick={() => {
                            router.push('/dashboard/settings')
                            setShowProfileMenu(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-link dark:text-darklink hover:text-primary bg-hover rounded-md transition-colors group/link"
                        >
                          <div className="h-11 w-11 flex-shrink-0 rounded-md flex justify-center items-center bg-lightprimary">
                            <Icon icon="solar:user-circle-linear" className="h-6 w-6 text-primary" />
                          </div>
                          <div className="ps-4 flex justify-between w-full">
                            <div className="w-3/4">
                              <h5 className="mb-1 text-sm group-hover/link:text-primary">
                                Profile Settings
                              </h5>
                              <div className="text-xs text-darklink">
                                Manage your profile
                              </div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            router.push('/pricing')
                            setShowProfileMenu(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-link dark:text-darklink hover:text-primary bg-hover rounded-md transition-colors group/link"
                        >
                          <div className="h-11 w-11 flex-shrink-0 rounded-md flex justify-center items-center bg-lightprimary">
                            <Icon icon="solar:card-linear" className="h-6 w-6 text-primary" />
                          </div>
                          <div className="ps-4 flex justify-between w-full">
                            <div className="w-3/4">
                              <h5 className="mb-1 text-sm group-hover/link:text-primary">
                                Billing & Plans
                              </h5>
                              <div className="text-xs text-darklink">
                                Manage subscription
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
