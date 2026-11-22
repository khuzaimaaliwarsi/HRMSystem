import React, { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { PORTAL_CONFIG } from '@/config/navigation'
import AppIcon from '@/components/common/AppIcon'
import BrandLogo from '@/components/common/BrandLogo'
import { cn } from '@/lib/utils'

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  isMobile = false,
  onCloseMobile
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const currentRole = user?.role || 'super_admin'
  const config = PORTAL_CONFIG[currentRole] || PORTAL_CONFIG.super_admin

  // Track expanded state for nested accordion modules
  const [expandedModules, setExpandedModules] = useState({})

  // Automatically expand parent module if current route or search matches any of its children
  useEffect(() => {
    if (!config?.menuGroups) return

    setExpandedModules((prev) => {
      const next = { ...prev }
      for (const group of config.menuGroups) {
        for (const item of group.items) {
          if (location.pathname.startsWith(item.path)) {
            next[item.key] = true
          }
        }
      }
      return next
    })
  }, [location.pathname, config])

  const toggleModule = (moduleKey) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleKey]: !prev[moduleKey]
    }))
  }

  const handleLogout = () => {
    logout?.()
    navigate('/login')
  }

  // Helper to determine if a submodule is currently active
  const isSubActive = (sub, parentItem) => {
    const currentFullUrl = location.pathname + location.search

    // Exact match with query params (e.g. ?tab=corrections or ?family=fam_att)
    if (currentFullUrl === sub.path) {
      return true
    }

    // Default tab match: when on module base route with no search params
    if (!location.search && location.pathname === parentItem.path) {
      if (parentItem.submodules && parentItem.submodules[0]?.key === sub.key) {
        return true
      }
    }

    return false
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-[#0B132B] border-r border-slate-800/80 transition-all duration-300 z-30 select-none text-white",
        isMobile ? "w-72 h-full" : collapsed ? "w-16" : "w-[250px]",
        !isMobile && "hidden lg:flex shrink-0 h-screen sticky top-0"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "h-16 border-b border-slate-800/80 flex items-center bg-[#0B132B] shrink-0 transition-all",
          collapsed && !isMobile
            ? "justify-center px-1"
            : "px-3.5 justify-between"
        )}
      >
        {!collapsed || isMobile ? (
          <>
            <div className="flex items-center gap-2.5 overflow-hidden">
              {/* Logo Mark: Circular Blue Brand Badge */}
              <BrandLogo
                size="md"
                ariaLabel="iSysware HRMS Logo"
              />

              <div className="flex flex-col text-left">
                <span className="font-extrabold text-sm tracking-tight text-white leading-tight">
                  iSysware HRMS
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider">
                  Enterprise Suite
                </span>
              </div>
            </div>

            {/* Desktop Collapse Toggle Button at Top Header (Top-Right of Header) */}
            {!isMobile && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <AppIcon name="chevronLeft" className="w-3.5 h-3.5 text-slate-300" />
              </button>
            )}
          </>
        ) : (
          /* Collapsed State Header: ONLY Circular Blue Brand Logo (click to expand) */
          <BrandLogo
            size="md"
            onClick={onToggleCollapse}
            title="Click logo to expand sidebar"
            ariaLabel="Expand sidebar with logo"
          />
        )}

        {/* Mobile Close Button */}
        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 focus:outline-none cursor-pointer"
            aria-label="Close navigation"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4 text-left scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-transparent">
        {config.menuGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {(!collapsed || isMobile) && group.groupLabel ? (
              <h4 className="px-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left mb-1.5">
                {group.groupLabel}
              </h4>
            ) : null}

            {group.items.map((item) => {
              const hasSubmodules = Boolean(item.submodules && item.submodules.length > 0)
              const isExpanded = Boolean(expandedModules[item.key])
              const isParentActive = location.pathname.startsWith(item.path)

              return (
                <div key={item.key} className="space-y-0.5">
                  {/* Main Module Row */}
                  <div
                    className={cn(
                      "flex items-center rounded-xl transition-all duration-150 group relative select-none",
                      isParentActive && !hasSubmodules
                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                        : isParentActive && hasSubmodules
                        ? "bg-white/[0.08] text-white font-semibold"
                        : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <NavLink
                      to={item.path}
                      onClick={() => {
                        if (hasSubmodules && !isExpanded) {
                          toggleModule(item.key)
                        }
                        if (isMobile && !hasSubmodules) {
                          onCloseMobile?.()
                        }
                      }}
                      title={collapsed && !isMobile ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-xs flex-1 min-w-0",
                        collapsed && !isMobile && "justify-center px-0 py-2.5"
                      )}
                    >
                      <AppIcon
                        name={item.icon}
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          isParentActive ? "text-white" : "text-slate-400 group-hover:text-white"
                        )}
                      />

                      {(!collapsed || isMobile) && (
                        <span className="truncate text-left text-xs font-semibold">
                          {item.label}
                        </span>
                      )}
                    </NavLink>

                    {/* Chevron Arrow Toggle for Modules with Submodules */}
                    {hasSubmodules && (!collapsed || isMobile) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleModule(item.key)
                        }}
                        aria-expanded={isExpanded}
                        aria-label={`Toggle ${item.label} submodules`}
                        className="p-2 mr-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      >
                        <AppIcon
                          name={isExpanded ? "chevronDown" : "chevronRight"}
                          className="w-3 h-3 text-slate-400 group-hover:text-white transition-transform"
                        />
                      </button>
                    )}

                    {/* Indicator Dot for active single module */}
                    {!hasSubmodules && isParentActive && (!collapsed || isMobile) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 mr-3 shadow-xs" />
                    )}
                  </div>

                  {/* Submodule Nested List with Professional Collapsible Accordion */}
                  {hasSubmodules && isExpanded && (!collapsed || isMobile) && (
                    <div className="ml-4 pl-3 border-l border-slate-700/70 py-1 space-y-0.5 animate-in fade-in duration-150">
                      {item.submodules.map((sub) => {
                        const active = isSubActive(sub, item)
                        return (
                          <NavLink
                            key={sub.key}
                            to={sub.path}
                            onClick={() => isMobile && onCloseMobile?.()}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all duration-150 text-left font-medium",
                              active
                                ? "bg-blue-600 text-white font-bold shadow-xs"
                                : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                            )}
                          >
                            <span className="truncate">{sub.label}</span>
                            {active && (
                              <span className="w-1 h-1 rounded-full bg-white shrink-0 ml-1.5" />
                            )}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer User Profile Area */}
      {!isMobile && (
        <div className="p-3 border-t border-slate-800/80 bg-[#0B132B] flex items-center justify-between gap-2 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden text-left min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#16223F] border border-blue-500/40 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                {user?.initials?.[0] || 'A'}
              </div>
              <div className="flex flex-col min-w-0 truncate">
                <span className="text-xs font-bold text-white truncate">
                  {user?.name || 'Alexander Wright'}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {user?.designation || 'Chief Human Resources Off...'}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center py-1">
              <div className="w-8 h-8 rounded-full bg-[#16223F] border border-blue-500/40 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                {user?.initials?.[0] || 'A'}
              </div>
            </div>
          )}

          {/* Action Buttons: Sign Out */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <AppIcon name="logout" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

export default AppSidebar
