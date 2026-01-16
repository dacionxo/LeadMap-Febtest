'use client'

import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const Search = () => {
  const [openModal, setOpenModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setOpenModal(false)
      }
    }

    if (openModal) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openModal])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/dashboard/prospect-enrich?search=${encodeURIComponent(searchQuery)}`)
      setOpenModal(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpenModal(true)}
        className="text-sm text-link dark:text-darklink dark:hover:text-primary px-4 h-10 hover:text-primary flex items-center justify-center cursor-pointer"
      >
        <Icon icon="solar:magnifer-line-duotone" height={20} />
      </button>

      {/* Modal */}
      {openModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setOpenModal(false)}
          />
          
          {/* Modal Content */}
          <div
            ref={modalRef}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-dark rounded-sm shadow-lg z-[70] p-0"
          >
            <div className="p-6 border-b border-ld">
              <form onSubmit={handleSearch} className="relative">
                <Icon
                  icon="solar:magnifer-line-duotone"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-link dark:text-darklink"
                  height={20}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search NextDeal..."
                  className="w-full pl-12 pr-4 py-2 bg-transparent dark:bg-transparent border border-border dark:border-darkborder rounded-md text-link dark:text-darklink placeholder:text-link dark:placeholder:text-darklink focus:outline-none focus:ring-0 focus:border-primary dark:focus:border-primary transition-all duration-200 text-sm"
                  autoFocus
                />
              </form>
            </div>

            <div className="flex-1 overflow-auto p-6 pt-0 max-h-72">
              <h5 className="text-lg pt-5 mb-4 text-link dark:text-darklink">Quick Actions</h5>
              <div className="space-y-2">
                <Link
                  href="/dashboard/prospect-enrich"
                  onClick={() => setOpenModal(false)}
                  className="block py-1 px-3 group hover:text-primary rounded-md transition-colors"
                >
                  <h6 className="group-hover:text-primary mb-1 font-medium text-sm text-link dark:text-darklink">
                    Prospect Enrichment
                  </h6>
                  <p className="text-xs text-link dark:text-darklink opacity-90 font-medium">
                    /dashboard/prospect-enrich
                  </p>
                </Link>
                <Link
                  href="/dashboard/map"
                  onClick={() => setOpenModal(false)}
                  className="block py-1 px-3 group hover:text-primary rounded-md transition-colors"
                >
                  <h6 className="group-hover:text-primary mb-1 font-medium text-sm text-link dark:text-darklink">
                    Map View
                  </h6>
                  <p className="text-xs text-link dark:text-darklink opacity-90 font-medium">
                    /dashboard/map
                  </p>
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setOpenModal(false)}
                  className="block py-1 px-3 group hover:text-primary rounded-md transition-colors"
                >
                  <h6 className="group-hover:text-primary mb-1 font-medium text-sm text-link dark:text-darklink">
                    Dashboard
                  </h6>
                  <p className="text-xs text-link dark:text-darklink opacity-90 font-medium">
                    /dashboard
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default Search
