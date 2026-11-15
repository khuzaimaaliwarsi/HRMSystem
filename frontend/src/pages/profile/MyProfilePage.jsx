import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/useAuth'
import { authService } from '@/services/authService'
import { employeeService } from '@/services/employeeService'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import notify from '@/lib/notify'

const ROLE_BADGES = {
  super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  hr_admin: 'bg-blue-100 text-blue-800 border-blue-200',
  HR_ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
  manager: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  dept_manager: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DEPT_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  team_lead: 'bg-amber-100 text-amber-800 border-amber-200',
  TEAM_LEAD: 'bg-amber-100 text-amber-800 border-amber-200',
  employee: 'bg-slate-100 text-slate-800 border-slate-200',
  EMPLOYEE: 'bg-slate-100 text-slate-800 border-slate-200'
}

export function MyProfilePage() {
  const { user, changePassword } = useAuth()

  // Live profile & employee state
  const [liveUser, setLiveUser] = useState(user)
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState(null)

  // Password Change state
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSuccess, setPasswordSuccess] = useState(null)

  // Self-Service Contact Details State (for linked employees)
  const [isEditContactOpen, setIsEditContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    phone: '',
    alternatePhone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  })

  // Load live user from backend /auth/me and check linked employee
  const fetchLiveProfile = useCallback(async () => {
    try {
      setLoading(true)
      const freshUser = await authService.getMe()
      if (freshUser) {
        setLiveUser(freshUser)

        // Check if employee record is linked
        const empCodeOrId = freshUser.employeeCode || freshUser.employeeId || freshUser.employee?.employeeCode || freshUser.employee?.id
        if (empCodeOrId) {
          const emp = employeeService.getEmployeeById(empCodeOrId) || freshUser.employee
          setEmployee(emp)
          if (emp) {
            setContactForm({
              phone: emp.phone || '',
              alternatePhone: emp.alternatePhone || '',
              address: emp.address || '',
              emergencyContactName: emp.emergencyContactName || '',
              emergencyContactPhone: emp.emergencyContactPhone || ''
            })
          }
        } else {
          setEmployee(null)
        }
      }
    } catch {
      // Fallback to active context user
      if (user) {
        setLiveUser(user)
        const empCodeOrId = user.employeeCode || user.employeeId
        if (empCodeOrId) {
          const emp = employeeService.getEmployeeById(empCodeOrId) || user.employee
          setEmployee(emp)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchLiveProfile()
  }, [fetchLiveProfile])

  // Password change handler
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

    try {
      setPasswordLoading(true)
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordSuccess('Password updated successfully. Other active sessions were terminated for security.')
      notify.success('Your password has been changed successfully.')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setIsChangingPassword(false)
    } catch (err) {
      const msg = err.message || 'Failed to update password'
      setPasswordError(msg)
      notify.error(msg)
    } finally {
      setPasswordLoading(false)
    }
  }

  // Self-service contact update for linked employee
  const handleUpdateContactSubmit = (e) => {
    e.preventDefault()
    if (!employee) return
    try {
      employeeService.updateEmployee(
        employee.id || employee.employeeCode,
        contactForm,
        `${employee.name || liveUser.name} (Self-Service)`,
        'Personal contact information updated'
      )
      notify.success('Your personal contact information was updated successfully.')
      setIsEditContactOpen(false)
      fetchLiveProfile()
    } catch (err) {
      notify.error(err.message || 'Failed to update contact info')
    }
  }

  const currentUser = liveUser || user
  const roleBadge = ROLE_BADGES[currentUser?.role] || ROLE_BADGES[currentUser?.backendRole] || 'bg-slate-100 text-slate-800 border-slate-200'

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white font-bold text-lg flex items-center justify-center shadow-sm">
            {currentUser?.initials || (currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : 'IS')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {currentUser?.name || currentUser?.username}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge}`}>
                {currentUser?.roleLabel || currentUser?.role}
              </span>
              {currentUser?.isProtected && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Protected Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser?.email} • Authenticated via PostgreSQL Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChangingPassword(!isChangingPassword)}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5"
          >
            <AppIcon name="lock" className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isChangingPassword ? 'Cancel Password Change' : 'Change Password'}</span>
          </button>
        </div>
      </div>

      {passwordSuccess && (
        <Alert variant="success" onClose={() => setPasswordSuccess(null)}>
          {passwordSuccess}
        </Alert>
      )}

      {/* Password Change Form Modal/Accordion */}
      {isChangingPassword && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AppIcon name="lock" className="w-4 h-4 text-indigo-600" />
              <span>Change Account Password</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Passwords are securely hashed using Argon2id. Updating will invalidate any other active sessions.
            </p>
          </div>

          {passwordError && (
            <Alert variant="danger" onClose={() => setPasswordError(null)}>
              {passwordError}
            </Alert>
          )}

          <form onSubmit={handleChangePasswordSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter existing password"
                  className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  <AppIcon name={showCurrentPassword ? 'eyeSlash' : 'eye'} className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  <AppIcon name={showNewPassword ? 'eyeSlash' : 'eye'} className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <AppIcon name={showConfirmPassword ? 'eyeSlash' : 'eye'} className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={passwordLoading}
                icon="check"
              >
                Update Password
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsChangingPassword(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Grid: Portal Account Details & Security Governance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Portal Account Credentials */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AppIcon name="user" className="w-4 h-4 text-slate-600" />
              <span>Portal Account Profile</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-400">ID: {currentUser?.id || '—'}</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Display Name</span>
              <span className="font-semibold text-slate-900">{currentUser?.displayName || currentUser?.name || '—'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Username</span>
              <span className="font-semibold text-slate-900 font-mono">{currentUser?.username || '—'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Official Email</span>
              <span className="font-semibold text-slate-900">{currentUser?.email || '—'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Portal Access Role</span>
              <span className="font-semibold text-slate-900">{currentUser?.roleLabel || currentUser?.role}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Account Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active (Login Permitted)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Account Governance</span>
              <span className="font-semibold text-slate-700">
                {currentUser?.isProtected ? 'Protected Root Admin' : 'Standard Managed Account'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Last Login Timestamp</span>
              <span className="font-mono text-slate-600">
                {currentUser?.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleString() : 'Active Session'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Security & Session Posture */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AppIcon name="security" className="w-4 h-4 text-emerald-600" />
              <span>Security &amp; Privilege Guard</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Enforced
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <p className="leading-relaxed">
              Your session is cryptographically bound to an encrypted HTTP-only cookie using Argon2id credential hashing.
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <AppIcon name="lock" className="w-3.5 h-3.5 text-slate-500" />
                <span>Privilege Boundary Enforced</span>
              </div>
              <p className="text-slate-500">
                Account role assignments, administrative capabilities, and account activation statuses are strictly governed by the Super Admin in Portal User Management and cannot be self-modified.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 text-[11px]">Token Rotation:</span>
              <span className="font-mono font-semibold text-slate-800 text-[11px]">Active (15m Access / 7d Refresh)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workforce Directory Link Status */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AppIcon name="employees" className="w-4 h-4 text-blue-600" />
              <span>Workforce Directory Profile</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Official employee master assignment and employment record
            </p>
          </div>

          {employee && (
            <button
              type="button"
              onClick={() => setIsEditContactOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <AppIcon name="edit" className="w-3 h-3" />
              <span>Update Contact Details</span>
            </button>
          )}
        </div>

        {employee ? (
          /* Linked Employee Details */
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AppIcon name="check" className="w-4 h-4 text-blue-700" />
                <span className="font-semibold text-blue-900">
                  Linked to Employee Record: {employee.name || `${employee.firstName} ${employee.lastName}`} ({employee.id || employee.employeeCode})
                </span>
              </div>
              <span className="font-mono text-[11px] text-blue-700 font-bold px-2 py-0.5 bg-white rounded border border-blue-200">
                {employee.employmentStatus || 'Active Staff'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Department</span>
                <p className="font-semibold text-slate-900">{employee.department?.name || employee.department || 'Corporate HQ'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Designation</span>
                <p className="font-semibold text-slate-900">{employee.designation?.title || employee.designation || 'Specialist'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Reporting Manager</span>
                <p className="font-semibold text-slate-900">
                  {employee.reportingManager
                    ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName} (${employee.reportingManager.employeeCode})`
                    : (employee.reportingManagerName || 'Board of Directors / Root')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Contact Phone</span>
                <p className="font-semibold text-slate-900 font-mono">{employee.phone || 'Not configured'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Residential Address</span>
                <p className="font-semibold text-slate-900 truncate">{employee.address || 'Karachi, Pakistan'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Emergency Contact</span>
                <p className="font-semibold text-slate-900">
                  {employee.emergencyContactName ? `${employee.emergencyContactName} (${employee.emergencyContactPhone})` : 'Not configured'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Unlinked Standalone Account State */
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AppIcon name="info" className="w-6 h-6 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Employee Profile Not Linked</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                This portal account is currently configured as a <strong>standalone administrative account</strong> and is not linked to an employee record in the workforce directory.
              </p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              All administrative operations and portal functions for <strong>{currentUser?.roleLabel || currentUser?.role}</strong> remain fully active. If this account represents a member of the workforce, a Super Admin can link it to an employee record in <em>Portal User Management</em>.
            </p>
          </div>
        )}
      </div>

      {/* Self-Service Contact Update Modal */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Personal Contact Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">Self-service updates to your contact information</p>
              </div>
              <button
                onClick={() => setIsEditContactOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleUpdateContactSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Alternate Phone</label>
                <input
                  type="text"
                  value={contactForm.alternatePhone}
                  onChange={(e) => setContactForm({ ...contactForm, alternatePhone: e.target.value })}
                  placeholder="+92 321 7654321"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Residential Address</label>
                <textarea
                  rows={2}
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  placeholder="Street, City, Pakistan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Emergency Name</label>
                  <input
                    type="text"
                    value={contactForm.emergencyContactName}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyContactName: e.target.value })}
                    placeholder="Contact Name"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={contactForm.emergencyContactPhone}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyContactPhone: e.target.value })}
                    placeholder="+92 300 0000000"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditContactOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon="check"
                >
                  Save Contact Info
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyProfilePage

