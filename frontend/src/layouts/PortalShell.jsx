import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import TopNavbar from './TopNavbar'

export function PortalShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  return (
    <div className="min-h-[111.12vh] bg-hrms-canvas flex w-full">
      {/* Desktop Collapsible Sidebar */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Mobile Drawer (Responsive Navigation Drawer) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative z-10 w-72 h-full bg-[#0B132B] shadow-hrms-modal flex flex-col">
            <AppSidebar
              isMobile
              onCloseMobile={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Navigation Bar */}
        <TopNavbar onOpenMobile={() => setMobileDrawerOpen(true)} />

        {/* Page Container: Full screen width, edge-to-edge */}
        <main className="flex-1 px-4 sm:px-6 py-4 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PortalShell
