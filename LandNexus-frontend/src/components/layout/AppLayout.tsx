import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { cn } from '../../utils/cn'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />

      <div
        className={cn(
          'transition-[padding] duration-200',
          sidebarCollapsed ? 'lg:pl-0' : 'lg:pl-72',
        )}
      >
        <Header
          onOpenMenu={() => setSidebarOpen(true)}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main id="main-content" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 pb-6 pt-2 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>LandNexus · Unified Digital Land Acquisition Platform</span>
          <span>Access is logged in the audit trail.</span>
        </footer>
      </div>
    </div>
  )
}
