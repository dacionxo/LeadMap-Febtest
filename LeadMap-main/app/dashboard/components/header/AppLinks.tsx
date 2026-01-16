'use client'

import { Icon } from '@iconify/react'
import Link from 'next/link'

interface appsLinkType {
  href: string
  title: string
  subtext: string
  avatar: string
}

const appsLink: appsLinkType[] = [
  {
    href: '/dashboard/conversations',
    title: 'Chat Application',
    subtext: 'New messages arrived',
    avatar: '/images/svgs/icon-dd-chat.svg',
  },
  {
    href: '/dashboard',
    title: 'Dashboard',
    subtext: 'Main dashboard',
    avatar: '/images/svgs/icon-dd-cart.svg',
  },
  {
    href: '/dashboard/map',
    title: 'Map View',
    subtext: 'Location tracking',
    avatar: '/images/svgs/icon-dd-invoice.svg',
  },
  {
    href: '/dashboard/calendar',
    title: 'Calendar App',
    subtext: 'Get dates',
    avatar: '/images/svgs/icon-dd-date.svg',
  },
  {
    href: '/dashboard/prospect-enrich',
    title: 'Prospect Enrichment',
    subtext: 'Enrich leads',
    avatar: '/images/svgs/icon-dd-mobile.svg',
  },
  {
    href: '/dashboard/email',
    title: 'Email App',
    subtext: 'Get new emails',
    avatar: '/images/svgs/icon-dd-message-box.svg',
  },
]

interface LinkType {
  href: string
  title: string
}

const pageLinks: LinkType[] = [
  {
    href: '/pricing',
    title: 'Pricing Page',
  },
  {
    href: '/dashboard',
    title: 'Dashboard',
  },
  {
    href: '/dashboard/settings',
    title: 'Settings',
  },
]

const Quicklinks = () => {
  return (
    <div className="lg:p-5 p-5 xl:border-s border-s-0 border-border dark:border-darkborder">
      <h5 className="text-xl font-semibold mb-4 text-ld">Quick Links</h5>
      <ul>
        {pageLinks.map((links, index) => (
          <li className="mb-4" key={index}>
            <Link
              href={links.href}
              className="text-sm font-semibold text-link dark:text-darklink hover:text-primary dark:hover:text-primary"
            >
              {links.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

const AppLinks = () => {
  return (
    <div className="dropdown-wrapper group">
      {/* Desktop trigger - matching exact structure of Chat/Calendar/Email */}
      <button
        type="button"
        className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center xl:flex hidden"
      >
        <span>Apps</span>
        <Icon icon="tabler:chevron-down" height={15} className="shrink-0 ml-1" />
      </button>

      {/* Mobile Trigger */}
      <span className="xl:hidden text-link dark:text-darklink flex rounded-full px-[15px] pb-0.5 justify-center items-center cursor-pointer group-hover:text-primary">
        <Icon icon="tabler:apps" className="shrink-0" height={20} />
      </span>

      {/* Desktop Dropdown - matching Tailwindadmin structure */}
      <div className="sm:w-[900px] z-[101] w-screen dropdown top-[28px] xl:invisible xl:group-hover:visible visible absolute shadow-md bg-white dark:bg-dark rounded-sm dark:shadow-dark-md">
        <div className="xl:relative xl:translate-none xl:h-auto xl:bg-transparent xl:z-[0] xl:w-[900px] hidden xl:block">
          <div className="md:h-auto h-[calc(100vh_-_50px)] bg-white dark:bg-dark shadow-md dark:shadow-dark-md rounded-sm overflow-hidden">
            <div className="grid grid-cols-12 w-full max-h-[600px] overflow-y-auto">
              <div className="xl:col-span-8 col-span-12 flex items-stretch xl:pr-0 px-5 py-5">
                <div className="grid grid-cols-12 gap-3 w-full">
                  {appsLink.map((links, index) => (
                    <div
                      className="col-span-12 xl:col-span-6 flex items-stretch"
                      key={index}
                    >
                      <ul>
                        <li>
                          <Link
                            href={links.href}
                            className="flex gap-3 items-center hover:text-primary group relative"
                          >
                            <span className="bg-lightprimary h-10 w-10 flex justify-center items-center rounded-md">
                              <Icon
                                icon={
                                  links.href.includes('chat') || links.href.includes('conversation') ? 'solar:dialog-linear' :
                                  links.href.includes('calendar') ? 'solar:calendar-linear' :
                                  links.href.includes('email') ? 'solar:letter-linear' :
                                  links.href.includes('map') ? 'solar:map-point-linear' :
                                  links.href.includes('prospect') || links.href.includes('enrich') ? 'solar:users-group-rounded-linear' :
                                  'solar:widget-2-linear'
                                }
                                className="h-5 w-5 text-primary"
                              />
                            </span>
                            <div>
                              <h6 className="font-semibold text-sm text-ld hover:text-primary mb-1">
                                {links.title}
                              </h6>
                              <p className="text-xs text-link dark:text-darklink opacity-90 font-medium">
                                {links.subtext}
                              </p>
                            </div>
                          </Link>
                        </li>
                      </ul>
                    </div>
                  ))}
                  <div className="col-span-12 md:col-span-12 border-t border-border dark:border-darkborder hidden xl:flex items-stretch pt-4 pr-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center text-dark dark:text-darklink">
                        <Icon icon="tabler:help" className="text-lg" />
                        <Link
                          href="/dashboard/help"
                          className="text-sm font-semibold hover:text-primary ml-2 flex gap-2 items-center"
                        >
                          <Icon icon="tabler:help" width={20} />
                          Frequently Asked Questions
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="xl:col-span-4 col-span-12 flex items-stretch">
                <Quicklinks />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppLinks
