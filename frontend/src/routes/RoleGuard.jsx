import React from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { PORTAL_CONFIG } from '@/config/navigation'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'

export function RoleGuard({ allowedRoles = [], children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const roleLower = String(user.role || '').toLowerCase()
  const backendRoleLower = String(user.backendRole || '').toLowerCase()
  const normalizedRole = roleLower === 'dept_manager' ? 'manager' : roleLower

  // Guard Employee Self-Service routes: Accounts without an active linked employee record cannot access
  const isEmployeeRoute = location.pathname.startsWith('/employee')
  const hasLinkedEmployee = Boolean(user.employeeId && user.employeeId !== 'null' && user.employeeId !== '')
  if (isEmployeeRoute && !hasLinkedEmployee) {
    const authorizedHome =
      PORTAL_CONFIG[roleLower]?.defaultRoute ||
      PORTAL_CONFIG[normalizedRole]?.defaultRoute ||
      PORTAL_CONFIG[user.role]?.defaultRoute ||
      '/login'
    return <Navigate to={authorizedHome} replace />
  }

  const isAllowed = allowedRoles.some((r) => {
    const rLower = String(r || '').toLowerCase()
    return (
      rLower === roleLower ||
      rLower === backendRoleLower ||
      rLower === normalizedRole ||
      (rLower === 'manager' && (roleLower === 'dept_manager' || backendRoleLower === 'dept_manager'))
    )
  })

  const handleSwitchAccount = async () => {
    try {
      if (typeof logout === 'function') {
        await logout()
      }
    } catch {
      // ignore
    }
    navigate('/login', { replace: true })
  }

  if (!isAllowed) {
    const authorizedHome =
      PORTAL_CONFIG[roleLower]?.defaultRoute ||
      PORTAL_CONFIG[normalizedRole]?.defaultRoute ||
      PORTAL_CONFIG[user.role]?.defaultRoute ||
      '/employee/dashboard'

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-hrms-danger border border-red-200 flex items-center justify-center mb-4">
          <AppIcon name="lock" className="w-8 h-8 text-hrms-danger" />
        </div>
        <h2 className="text-xl font-bold text-hrms-primary mb-2">
          Access Denied — Role Boundary Enforced
        </h2>
        <p className="text-sm text-hrms-muted max-w-md mb-6 leading-relaxed">
          Your current session is authorized as <strong>{user.roleLabel}</strong>.
          You do not have administrative capability to view this portal area under the iSysware HRMS security policies.
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => navigate(authorizedHome)}
            icon="dashboard"
          >
            Go to My {user.roleLabel} Portal
          </Button>
          <Button
            variant="outline"
            onClick={handleSwitchAccount}
            icon="logout"
          >
            Switch Account
          </Button>
        </div>
      </div>
    )
  }

  return children
}

export default RoleGuard
