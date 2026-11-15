import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { PORTAL_CONFIG } from '@/config/navigation'
import AppIcon from '@/components/common/AppIcon'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { cn } from '@/lib/utils'
import notify from '@/lib/notify'

export function TopNavbar({ onOpenMobile }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const currentRole = user?.role || 'super_admin'
  const config = PORTAL_CONFIG[currentRole] || PORTAL_CONFIG.super_admin

  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifMenuOpen, setNotifMenuOpen] = useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)

  const roleMenuRef = useRef(null)
  const profileMenuRef = useRef(null)
  const notifMenuRef = useRef(null)

  // Dynamic header resolution based on current path and search params
  const headerInfo = useMemo(() => {
    const pathname = location.pathname
    const search = location.search
    const fullUrl = pathname + search

    if (pathname.includes('/dashboard')) {
      const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
      }
      return {
        title: `${getGreeting()}, ${user?.displayName || user?.name || user?.username || 'User'}!`,
        subtitle: ''
      }
    }

    if (config?.menuGroups) {
      for (const group of config.menuGroups) {
        for (const item of group.items) {
          if (item.submodules) {
            // First look for exact submodule match with query string
            const activeSub = item.submodules.find((sub) => sub.path === fullUrl)
            if (activeSub) {
              return {
                title: activeSub.label,
                subtitle: `${item.label}${item.batchId ? ` (${item.batchId})` : ''} • ${config.portalName}`
              }
            }
            // If on the parent path without search params, match the default (first) submodule
            if (!search && pathname === item.path && (item.submodules?.length || 0) > 0) {
              return {
                title: item.submodules[0].label,
                subtitle: `${item.label}${item.batchId ? ` (${item.batchId})` : ''} • ${config.portalName}`
              }
            }
          }
          if (item.path === pathname) {
            return {
              title: item.label,
              subtitle: `${item.batchId ? `${item.batchId} • ` : ''}${config.portalName}`
            }
          }
        }
      }
    }

    return {
      title: 'iSysware HRMS',
      subtitle: config?.portalName || 'Enterprise Suite'
    }
  }, [location.pathname, location.search, config, user?.name])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target)) {
        setRoleMenuOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setNotifMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleConfirmLogout = async () => {
    setConfirmLogoutOpen(false)
    await logout()
    notify.info('You have been signed out.')
    navigate('/login')
  }

  // Simulated notifications for demo purposes
  const demoNotifications = [
    { id: 1, title: 'Shift Policy Effective Notice', desc: 'New winter shift hours active from 1st Nov.', time: '10m ago', unread: true },
    { id: 2, title: 'Scheduled Reminders Engine', desc: 'Probation review scheduled for EMP-004 in 14 days.', time: '1h ago', unread: true },
    { id: 3, title: 'Security Audit Notice', desc: 'Zero graph reporting policy enforced across all exports.', time: '1d ago', unread: false }
  ]

  // Permitted portals for current authenticated user
  const myPortals = useMemo(() => {
    if (!user) return []
    const list = []
    const hasLinkedEmployee = Boolean(user.employeeId && user.employeeId !== 'null' && user.employeeId !== '')

    if (user.role === 'team_lead') {
      list.push({
        id: 'team_lead_portal',
        name: 'Team Lead Portal',
        path: '/team-lead/dashboard',
        isActive: location.pathname.startsWith('/team-lead'),
        desc: 'Assigned Team Supervisory Scope'
      })
      if (hasLinkedEmployee) {
        list.push({
          id: 'employee_portal',
          name: 'Employee Self-Service',
          path: '/employee/dashboard',
          isActive: location.pathname.startsWith('/employee'),
          desc: 'Personal Attendance, Leaves & Profile'
        })
      }
    } else if (user.role === 'manager') {
      list.push({
        id: 'manager_portal',
        name: 'Department Manager Portal',
        path: '/manager/dashboard',
        isActive: location.pathname.startsWith('/manager'),
        desc: 'Department & Team Management'
      })
      if (hasLinkedEmployee) {
        list.push({
          id: 'employee_portal',
          name: 'Employee Self-Service',
          path: '/employee/dashboard',
          isActive: location.pathname.startsWith('/employee'),
          desc: 'Personal Attendance, Leaves & Profile'
        })
      }
    } else if (user.role === 'super_admin') {
      list.push({
        id: 'super_admin_portal',
        name: 'Super Admin Portal',
        path: '/super-admin/dashboard',
        isActive: location.pathname.startsWith('/super-admin'),
        desc: 'Enterprise Governance & Master Data'
      })
      if (hasLinkedEmployee) {
        list.push({
          id: 'employee_portal',
          name: 'Employee Self-Service',
          path: '/employee/dashboard',
          isActive: location.pathname.startsWith('/employee'),
          desc: 'Personal Records'
        })
      }
    } else if (user.role === 'hr_admin') {
      list.push({
        id: 'hr_admin_portal',
        name: 'HR / Admin Portal',
        path: '/hr-admin/dashboard',
        isActive: location.pathname.startsWith('/hr-admin'),
        desc: 'Human Resources Operations'
      })
      if (hasLinkedEmployee) {
        list.push({
          id: 'employee_portal',
          name: 'Employee Self-Service',
          path: '/employee/dashboard',
          isActive: location.pathname.startsWith('/employee'),
          desc: 'Personal Records'
        })
      }
    } else if (user.role === 'employee' && hasLinkedEmployee) {
      list.push({
        id: 'employee_portal',
        name: 'Employee Self-Service',
        path: '/employee/dashboard',
        isActive: location.pathname.startsWith('/employee'),
        desc: 'Personal Records'
      })
    }
    return list
  }, [user, location.pathname])

  return (
    <>
      <header className="h-14 bg-white border-b border-hrms-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        {/* Left Section: Mobile Menu Button & Brand on mobile + Page Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="lg:hidden p-2 text-hrms-text hover:bg-hrms-canvas rounded-md focus:outline-none focus:ring-2 focus:ring-hrms-accent"
            aria-label="Open mobile navigation"
          >
            <AppIcon name="menu" className="w-5 h-5 text-hrms-primary" />
          </button>

          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              iS
            </div>
            <span className="font-bold text-sm text-slate-900 truncate max-w-[150px] sm:max-w-xs">{headerInfo.title}</span>
          </div>

          {/* Dynamic Module / Submodule Title (Always visible across viewports) */}
          <div className="hidden sm:flex items-center text-left shrink-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none whitespace-nowrap">
              {headerInfo.title}
            </h1>
          </div>
        </div>

        {/* Search Keyword Input matching Reference Screenshot */}
        <div className="hidden md:flex items-center relative w-56 lg:w-72 mx-4">
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search keyword"
            className="w-full pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 shadow-2xs"
          />
        </div>

        {/* Right Section: Notification Bell, Role Switcher, User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification Bell matching Screenshot 1 position */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              onClick={() => setNotifMenuOpen(!notifMenuOpen)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors relative focus:outline-none"
              aria-label="Notifications"
            >
              <AppIcon name="alerts" className="w-4 h-4 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </button>

            {notifMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-hrms-dropdown border border-hrms-border overflow-hidden z-50 text-left">
                <div className="px-4 py-3 bg-hrms-canvas border-b border-hrms-border flex items-center justify-between">
                  <h4 className="text-xs font-bold text-hrms-primary uppercase tracking-wider">
                    Scheduled Alerts & Updates
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                    2 New
                  </span>
                </div>
                <div className="divide-y divide-hrms-border/60 max-h-72 overflow-y-auto">
                  {demoNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn("p-3 hover:bg-slate-50 transition-colors", notif.unread && "bg-blue-50/30")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-hrms-primary">{notif.title}</span>
                        <span className="text-[10px] text-hrms-subtle">{notif.time}</span>
                      </div>
                      <p className="text-xs text-hrms-muted leading-relaxed">{notif.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="p-2 bg-white border-t border-hrms-border text-center">
                  <span className="text-[11px] text-hrms-muted font-medium">
                    Scheduled Reminders Engine (Batch F13)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Authorized Portal Switcher (Only if user has multiple authorized portals, e.g. Admin + Self-Service) */}
          <div className="relative" ref={roleMenuRef}>
            {myPortals.length > 1 ? (
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors focus:outline-none shadow-xs"
                title="Switch authorized portal view"
              >
                <AppIcon name="security" className="w-3.5 h-3.5 text-blue-600" />
                <span>{user?.roleLabel || 'Super Admin'}</span>
                <AppIcon name="chevronDown" className="w-3 h-3 text-blue-500" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50/80 text-blue-700 text-xs font-bold shadow-xs">
                <AppIcon name="security" className="w-3.5 h-3.5 text-blue-600" />
                <span>{user?.roleLabel || 'Employee'}</span>
              </div>
            )}

            {roleMenuOpen && myPortals.length > 1 && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-hrms-dropdown border border-hrms-border p-2 z-50 text-left">
                <div className="mb-1 pb-1">
                  <p className="px-2.5 py-1 text-[11px] font-bold text-hrms-primary uppercase tracking-wider">
                    My Authorized Portals
                  </p>
                  <div className="space-y-1 mt-1">
                    {myPortals.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setRoleMenuOpen(false)
                          navigate(p.path)
                        }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between",
                          p.isActive
                            ? "bg-blue-600 text-white font-medium"
                            : "hover:bg-slate-100 text-slate-700"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold">{p.name}</span>
                          <span className={cn("text-[10px]", p.isActive ? "text-blue-100" : "text-slate-500")}>
                            {p.desc}
                          </span>
                        </div>
                        {p.isActive && <AppIcon name="check" className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 shadow-xs">
                {user?.initials || (user?.username ? user.username.slice(0, 2).toUpperCase() : 'US')}
              </div>
              <div className="hidden md:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                  {user?.displayName || user?.name || user?.username || 'User'}
                </span>
                <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                  {user?.designation || user?.roleLabel || 'HRMS User'}
                </span>
              </div>
              <AppIcon name="chevronDown" className="w-3 h-3 text-slate-400 hidden sm:block" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-hrms-dropdown border border-hrms-border p-2 z-50 text-left">
                {/* Header Profile Info */}
                <div className="px-3 py-2.5 border-b border-hrms-border/70 mb-1">
                  <p className="text-xs font-bold text-hrms-primary truncate">
                    {user?.displayName || user?.name || user?.username || 'User'}
                  </p>
                  <p className="text-[11px] text-hrms-muted truncate font-mono">
                    {user?.email}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-hrms-accent-light text-hrms-primary font-semibold">
                      {user?.roleLabel}
                    </span>
                    <span className="text-[10px] text-hrms-subtle font-mono">
                      ID: {user?.id}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      const rLower = String(user?.role || '').toLowerCase()
                      const normRole = rLower === 'dept_manager' ? 'manager' : rLower
                      const basePath =
                        PORTAL_CONFIG[rLower]?.basePath ||
                        PORTAL_CONFIG[normRole]?.basePath ||
                        PORTAL_CONFIG[user?.role]?.basePath ||
                        '/employee'
                      navigate(`${basePath}/profile`)
                    }}
                    className="w-full text-left px-3 py-2 rounded text-xs text-hrms-text hover:bg-hrms-canvas transition-colors flex items-center gap-2.5"
                  >
                    <AppIcon name="user" className="w-3.5 h-3.5 text-hrms-muted" />
                    <span>My Profile & Preferences</span>
                  </button>

                  <div className="border-t border-hrms-border/70 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      setConfirmLogoutOpen(true)
                    }}
                    className="w-full text-left px-3 py-2 rounded text-xs text-hrms-danger hover:bg-red-50 transition-colors flex items-center gap-2.5"
                  >
                    <AppIcon name="logout" className="w-3.5 h-3.5 text-hrms-danger" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out of iSysware HRMS"
        message="Are you sure you want to end your current session? You will be redirected to the centralized login screen."
        confirmText="Sign Out"
        variant="danger"
      />
    </>
  )
}

export default TopNavbar
