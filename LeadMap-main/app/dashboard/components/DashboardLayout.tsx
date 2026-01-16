'use client'

import { ReactNode, useEffect, useState, Suspense } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { SidebarProvider, useSidebar } from './SidebarContext'

interface DashboardLayoutProps {
  children: ReactNode
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const { isOpen } = useSidebar()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      <Suspense fallback={<div className="w-[270px]" />}>
        <Sidebar />
      </Suspense>
      <main
        className={`flex-1 overflow-y-auto relative z-10 bg-white dark:bg-dark min-h-screen transition-all duration-300 ${
          isOpen ? 'ml-[270px]' : 'ml-[75px]'
        }`}
      >
        <Header />
        {/* Main Content */}
        <div className="container relative z-10 py-[30px]">
          {mounted && children}
        </div>
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  )
}
