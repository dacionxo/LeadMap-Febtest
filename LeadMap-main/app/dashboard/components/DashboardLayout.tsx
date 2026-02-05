'use client'

import { ReactNode, useEffect, useState, Suspense, useRef } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { SidebarProvider, useSidebar } from './SidebarContext'

interface DashboardLayoutProps {
  children: ReactNode
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const { isOpen } = useSidebar()
  const mainRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
    // #region agent log
    if (mainRef.current) {
      const mainEl = mainRef.current;
      const computedStyle = window.getComputedStyle(mainEl);
      const overflow = computedStyle.overflow;
      const overflowY = computedStyle.overflowY;
      const parentEl = mainEl.parentElement;
      const parentComputed = parentEl ? window.getComputedStyle(parentEl) : null;
      const parentOverflow = parentComputed?.overflow || 'N/A';
      fetch('http://127.0.0.1:7242/ingest/27ffd39f-e797-4d31-a671-175bf76a4f27', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'DashboardLayout.tsx:18', message: 'Main container overflow check', data: { mainOverflow: overflow, mainOverflowY: overflowY, parentOverflow }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,B' }) }).catch(() => { });
    }
    // #endregion
  }, [])

  return (
    <div className="flex h-screen relative overflow-x-hidden">
      <Suspense fallback={<div className="w-[270px]" />}>
        <Sidebar />
      </Suspense>
      <main
        ref={mainRef as any}
        className={`flex-1 overflow-y-auto custom-scrollbar relative z-10 bg-background-light dark:bg-dark h-full transition-all duration-300 ${isOpen ? 'ml-[270px]' : 'ml-[75px]'
          }`}
      >
        <Header scrollContainerRef={mainRef} />
        {/* Main Content - AdminOS style: max-w-7xl, consistent padding */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10 space-y-8">
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
