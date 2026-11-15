import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/context/useAuth'
import apiClient from '@/services/apiClient'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Select from '@/components/common/Select'
import Modal from '@/components/common/Modal'
import Alert from '@/components/common/Alert'
import notify from '@/lib/notify'

const PORTAL_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'HR_ADMIN', label: 'HR / Admin' },
  { value: 'DEPT_MANAGER', label: 'Department Manager' },
  { value: 'TEAM_LEAD', label: 'Team Lead' },
  { value: 'EMPLOYEE', label: 'Employee' }
]

const isActiveEmployee = (employee) =>
  String(employee?.employmentStatus || '').toUpperCase() === 'ACTIVE'

const normalizeEmployee = (employee) => ({
  id: String(employee.id),
  employeeCode: employee.employeeCode || '',
  name: [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || employee.employeeCode || 'Employee',
  designation: typeof employee.designation === 'object' ? employee.designation?.title : (employee.designation || 'Staff'),
  employmentStatus: employee.employmentStatus
})

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  HR_ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
  DEPT_MANAGER: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  TEAM_LEAD: 'bg-amber-100 text-amber-800 border-amber-200',
  EMPLOYEE: 'bg-emerald-100 text-emerald-800 border-emerald-200'
}

export function PortalUserManagementTab() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [users, setUsers] = useState([])
  const [employees, setEmployees] = useState([])
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)
  const [userToView, setUserToView] = useState(null)

  // Add Form State
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    email: '',
    role: 'HR_ADMIN',
    password: '',
    confirmPassword: '',
    isActive: true,
    employeeId: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState(null)

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    displayName: '',
    username: '',
    email: '',
    role: 'HR_ADMIN',
    isActive: true,
    employeeId: ''
  })

  // Reset Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Fetch users from backend
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiClient.get('/admin/users')
      setUsers(Array.isArray(data) ? data : data?.users || [])
    } catch (err) {
      const msg = err.message || 'Failed to load portal accounts'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  // Never source portal-linkable employees from mock/local caches. Require canonical IDs.
  const fetchLinkableEmployees = useCallback(async () => {
    setEmployeeLoading(true)
    setEmployeeError('')
    try {
      const response = await apiClient.get('/employees?limit=200&status=ALL')
      const rows = Array.isArray(response) ? response :
        (Array.isArray(response?.employees) ? response.employees :
          (Array.isArray(response?.items) ? response.items : null))
      if (!rows) throw new Error('Employee API returned an unexpected response.')
      setEmployees(rows.filter(isActiveEmployee).map(normalizeEmployee))
    } catch (err) {
      setEmployees([])
      setEmployeeError(err?.message || 'Could not load active employees from PostgreSQL.')
    } finally {
      setEmployeeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers()
      fetchLinkableEmployees()
    }
  }, [isSuperAdmin, fetchUsers, fetchLinkableEmployees])

  const linkedEmployeeOptions = (linkedUser = null) => {
    const options = employees.map((emp) => ({
      value: emp.id,
      label: `${emp.name} (${emp.employeeCode || emp.id}) — ${emp.designation || 'Staff'}`
    }))
    const linkedId = linkedUser?.employeeId || linkedUser?.employee?.id
    // Existing link may now be suspended: show it as read-only; never silently unlink it.
    if (linkedId && !options.some((option) => option.value === String(linkedId))) {
      const linked = linkedUser.employee
      const name = linked ? [linked.firstName, linked.lastName].filter(Boolean).join(' ') : 'Previously linked employee'
      options.unshift({
        value: String(linkedId),
        label: `${name || 'Previously linked employee'} (${linked?.employeeCode || linkedId}) — Existing link (not eligible for new linking)`,
        disabled: true
      })
    }
    return [{ value: '', label: 'None (Stand-alone Account)' }, ...options]
  }

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchTerm.trim() ||
        (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.employee && `${u.employee.firstName} ${u.employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchTerm, roleFilter, statusFilter])

  // RBAC Access Guard (Super Admin ONLY)
  if (!isSuperAdmin) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mb-4">
          <AppIcon name="lock" className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied — Super Admin Only</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Portal User Management and account administrative operations are strictly restricted to the Super Admin under iSysware HRMS security policies.
        </p>
      </div>
    )
  }

  // Handle Add User Submit
  const handleAddUser = async (e) => {
    e.preventDefault()
    setModalError(null)

    if (!formData.username.trim()) {
      setModalError('Username is required.')
      return
    }
    if (!formData.email.trim()) {
      setModalError('Email is required.')
      return
    }
    if (!formData.password || formData.password.length < 8) {
      setModalError('Password must be at least 8 characters long.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setModalError('Passwords do not match.')
      return
    }

    if (formData.role === 'EMPLOYEE' && !formData.employeeId) {
      setModalError('Linked Employee is mandatory for EMPLOYEE self-service portal accounts.')
      return
    }

    if (employeeLoading || employeeError) {
      setModalError('Active employee records must be loaded from PostgreSQL before creating an account.')
      return
    }
    if (formData.employeeId && !employees.some((emp) => emp.id === formData.employeeId)) {
      setModalError('Selected employee is not ACTIVE or no longer available for linking.')
      return
    }

    try {
      setModalLoading(true)
      const payload = {
        displayName: formData.displayName.trim() || null,
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        isActive: formData.isActive,
        employeeId: formData.employeeId || null
      }

      await apiClient.post('/admin/users', payload)
      notify.success(`Portal account for ${formData.username} created successfully in PostgreSQL!`)
      setIsAddModalOpen(false)
      setFormData({
        displayName: '',
        username: '',
        email: '',
        role: 'HR_ADMIN',
        password: '',
        confirmPassword: '',
        isActive: true,
        employeeId: ''
      })
      await fetchUsers()
    } catch (err) {
      setModalError(err.message || 'Failed to create user account')
      notify.error(err.message || 'Creation failed')
    } finally {
      setModalLoading(false)
    }
  }

  // Handle View User Open
  const handleOpenView = (targetUser) => {
    setUserToView(targetUser)
    setIsViewModalOpen(true)
  }

  // Handle Edit User Open
  const handleOpenEdit = (targetUser) => {
    setSelectedUser(targetUser)
    setEditFormData({
      displayName: targetUser.displayName || '',
      username: targetUser.username,
      email: targetUser.email,
      role: targetUser.role,
      isActive: targetUser.isActive,
      employeeId: String(targetUser.employeeId || targetUser.employee?.id || '')
    })
    setModalError(null)
    setIsEditModalOpen(true)
  }

  // Handle Edit User Submit
  const handleEditUser = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    setModalError(null)

    if (editFormData.role === 'EMPLOYEE' && !editFormData.employeeId) {
      setModalError('Linked Employee is mandatory for EMPLOYEE self-service portal accounts.')
      return
    }

    if (employeeLoading || employeeError) {
      setModalError('Active employee records must be loaded from PostgreSQL before updating an account.')
      return
    }
    const originalId = String(selectedUser.employeeId || selectedUser.employee?.id || '')
    if (editFormData.employeeId && editFormData.employeeId !== originalId &&
      !employees.some((emp) => emp.id === editFormData.employeeId)) {
      setModalError('Selected employee is not ACTIVE or no longer available for linking.')
      return
    }

    try {
      setModalLoading(true)
      const payload = {
        displayName: editFormData.displayName.trim() || null,
        username: editFormData.username.trim(),
        email: editFormData.email.trim().toLowerCase(),
        role: editFormData.role,
        isActive: editFormData.isActive,
        employeeId: editFormData.employeeId || null
      }

      await apiClient.patch(`/admin/users/${selectedUser.id}`, payload)
      notify.success(`Portal account ${editFormData.username} updated successfully!`)
      setIsEditModalOpen(false)
      setSelectedUser(null)
      await fetchUsers()
    } catch (err) {
      setModalError(err.message || 'Failed to update user account')
      notify.error(err.message || 'Update failed')
    } finally {
      setModalLoading(false)
    }
  }

  // Handle Toggle User Status
  const handleToggleStatus = async (targetUser) => {
    if (targetUser.isProtected) {
      notify.error('Protected Super Admin account status cannot be modified.')
      return
    }

    const action = targetUser.isActive ? 'deactivate' : 'activate'
    if (!window.confirm(`Are you sure you want to ${action} account "${targetUser.username}"?`)) {
      return
    }

    try {
      await apiClient.patch(`/admin/users/${targetUser.id}/status`, { isActive: !targetUser.isActive })
      notify.success(`Account "${targetUser.username}" ${action}d successfully!`)
      await fetchUsers()
    } catch (err) {
      notify.error(err.message || `Failed to ${action} user account`)
    }
  }

  // Handle Open Reset Password
  const handleOpenResetPassword = (targetUser) => {
    setSelectedUser(targetUser)
    setNewPassword('')
    setConfirmNewPassword('')
    setModalError(null)
    setIsResetPasswordModalOpen(true)
  }

  // Handle Reset Password Submit
  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!selectedUser) return
    setModalError(null)

    if (!newPassword || newPassword.length < 8) {
      setModalError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setModalError('Passwords do not match.')
      return
    }

    try {
      setModalLoading(true)
      await apiClient.post(`/admin/users/${selectedUser.id}/reset-password`, { newPassword })
      notify.success(`Password reset successfully for "${selectedUser.username}". Previous sessions revoked.`)
      setIsResetPasswordModalOpen(false)
      setSelectedUser(null)
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setModalError(err.message || 'Failed to reset password')
      notify.error(err.message || 'Password reset failed')
    } finally {
      setModalLoading(false)
    }
  }

  // Handle Open Delete Modal
  const handleOpenDelete = (targetUser) => {
    if (targetUser.isProtected) {
      notify.error('Protected Super Admin account cannot be deleted.')
      return
    }
    setUserToDelete(targetUser)
    setModalError(null)
    setIsDeleteModalOpen(true)
  }

  // Handle Delete User Submit
  const handleDeleteUser = async () => {
    if (!userToDelete) return
    try {
      setModalLoading(true)
      await apiClient.delete(`/admin/users/${userToDelete.id}`)
      notify.success(`Portal account "${userToDelete.username}" has been deleted.`)
      setIsDeleteModalOpen(false)
      setUserToDelete(null)
      await fetchUsers()
    } catch (err) {
      notify.error(err.message || 'Failed to delete portal account')
      setModalError(err.message)
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Portal User Management</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Super Admin Exclusive
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, configure, and manage real PostgreSQL portal login accounts, role credentials, and access statuses across the 5 HRMS portals.
          </p>
        </div>

        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            setFormData({
              displayName: '',
              username: '',
              email: '',
              role: 'HR_ADMIN',
              password: '',
              confirmPassword: '',
              isActive: true,
              employeeId: ''
            })
            setModalError(null)
            setIsAddModalOpen(true)
          }}
        >
          Add New Account
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Input
            id="user-search"
            type="text"
            placeholder="Search by username, email, name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            iconLeft="search"
            className="w-full text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Portal Roles' },
              ...PORTAL_ROLES
            ]}
            className="text-xs"
          />

          <Select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active Only' },
              { value: 'INACTIVE', label: 'Inactive Only' }
            ]}
            className="text-xs"
          />

          <Button
            variant="outline"
            size="sm"
            icon="refresh"
            onClick={fetchUsers}
            loading={loading}
            title="Refresh Users from Database"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-slate-300 border-t-purple-600 rounded-full mb-2"></div>
            <p>Loading real PostgreSQL portal user accounts...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="danger" title="Database Error">
              {error}
            </Alert>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <AppIcon name="user" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No portal accounts found</p>
            <p className="text-slate-400 mt-1">Try clearing filters or click "Add New Account" to provision a user.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="py-3 px-4">Portal Account</th>
                  <th className="py-3 px-4">Portal Role</th>
                  <th className="py-3 px-4">Linked Employee</th>
                  <th className="py-3 px-4">Status & Login</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const roleStyle = ROLE_BADGE_STYLES[u.role] || 'bg-slate-100 text-slate-700'
                  const roleMeta = PORTAL_ROLES.find((r) => r.value === u.role)
                  const empName = u.employee
                    ? `${u.employee.firstName} ${u.employee.lastName} (${u.employee.employeeCode || u.employee.id})`
                    : null

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* User Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                            {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{u.displayName || u.username}</span>
                              {u.isProtected && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title="Protected System Account">
                                  PROTECTED
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <span className="font-mono text-slate-600">@{u.username}</span>
                              <span>•</span>
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Portal Role */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${roleStyle}`}>
                          {roleMeta?.label || u.role}
                        </span>
                      </td>

                      {/* Linked Employee */}
                      <td className="py-3 px-4 text-slate-600">
                        {empName ? (
                          <span className="font-medium text-slate-800">{empName}</span>
                        ) : (
                          <span className="text-slate-400 italic">None (Stand-alone Account)</span>
                        )}
                      </td>

                      {/* Status & Login Enabled */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {u.isActive ? 'Active (Login Enabled)' : 'Inactive (Login Disabled)'}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : <span className="text-slate-400 italic">Never</span>}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* View User Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenView(u)}
                            title="View Account Details"
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition border border-transparent hover:border-slate-200"
                          >
                            <AppIcon name="eye" className="w-3.5 h-3.5 text-slate-600" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            title="Edit Account Details"
                            className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center justify-center transition border border-transparent hover:border-blue-200"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleOpenResetPassword(u)}
                            title="Admin Reset Password"
                            className="w-7 h-7 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 flex items-center justify-center transition border border-transparent hover:border-indigo-200"
                          >
                            <AppIcon name="lock" className="w-3.5 h-3.5 text-indigo-600" />
                          </button>

                          {/* Toggle Active / Inactive (Disable / Enable) */}
                          {u.isProtected ? (
                            <span
                              title="Protected Super Admin cannot be deactivated"
                              className="w-7 h-7 rounded-lg text-slate-300 flex items-center justify-center cursor-not-allowed opacity-40"
                            >
                              <AppIcon name="pause" className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              title={u.isActive ? 'Disable Login / Deactivate Account' : 'Enable Login / Activate Account'}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition border border-transparent ${u.isActive
                                  ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200'
                                  : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200'
                                }`}
                            >
                              <AppIcon
                                name={u.isActive ? 'pause' : 'play'}
                                className={`w-3.5 h-3.5 ${u.isActive ? 'text-amber-600' : 'text-emerald-600'}`}
                              />
                            </button>
                          )}

                          {/* Delete Account */}
                          {u.isProtected || user?.id === u.id ? (
                            <span
                              title={u.isProtected ? 'Protected Super Admin cannot be deleted' : 'Cannot delete your own active session account'}
                              className="w-7 h-7 rounded-lg text-slate-300 flex items-center justify-center cursor-not-allowed opacity-40"
                            >
                              <AppIcon name="trash" className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(u)}
                              title="Delete Portal Account"
                              className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition border border-transparent hover:border-rose-200"
                            >
                              <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW PORTAL ACCOUNT                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !modalLoading && setIsAddModalOpen(false)}
        title="Add New Portal Account"
        description="Provision a real PostgreSQL authentication account with Argon2id password encryption."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          {modalError && (
            <Alert variant="danger" title="Validation Error">
              {modalError}
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display Name"
              id="new-display-name"
              placeholder="e.g. Super Admin or Jane Doe"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />

            <Input
              label="Username *"
              id="new-username"
              required
              placeholder="e.g. hr.manager"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              id="new-email"
              type="email"
              required
              placeholder="e.g. hr@isysware.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Select
              label="Portal Role *"
              id="new-role"
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={PORTAL_ROLES}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Account Status"
              id="new-status"
              value={formData.isActive ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
              options={[
                { value: 'true', label: 'Active (Can Log In)' },
                { value: 'false', label: 'Inactive (Login Blocked)' }
              ]}
            />

            <div>
              <Select
                label={formData.role === 'EMPLOYEE' ? "Linked Employee *" : "Linked Employee (Optional)"}
                id="new-employee"
                disabled={employeeLoading || Boolean(employeeError)}
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                options={[
                  ...linkedEmployeeOptions()
                ]}
              />
              {formData.role === 'EMPLOYEE' && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Required: Employee self-service accounts must link to an active workforce member.
                </p>
              )}
            </div>
          </div>

          {employeeError && <p className="text-xs text-rose-600">{employeeError} <button type="button" className="underline" onClick={fetchLinkableEmployees}>Retry</button></p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                label="Initial Password *"
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="relative">
              <Input
                label="Confirm Password *"
                id="new-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Repeat password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Show password text</span>
            </label>
            <span className="text-slate-400 text-[11px]">Encrypted with Argon2id</span>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={modalLoading}
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={modalLoading} disabled={employeeLoading || Boolean(employeeError)} icon="plus">
              Create Portal Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 1B: VIEW PORTAL ACCOUNT                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Portal Account Details — ${userToView?.username || ''}`}
        description="Complete account profile, role assignment, and security audit metadata."
        maxWidth="max-w-lg"
      >
        {userToView && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Display Name:</span>
                <span className="font-bold text-slate-900">{userToView.displayName || userToView.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Username:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{userToView.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Display Email:</span>
                <span className="font-semibold text-slate-800">{userToView.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Portal Role:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {userToView.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Account Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${userToView.isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                  {userToView.isActive ? 'Active (Login Enabled)' : 'Inactive (Login Disabled)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Protected System Status:</span>
                <span className="font-semibold text-slate-700">
                  {userToView.isProtected ? 'Protected Super Admin (Permanent)' : 'Standard Account'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Linked Employee:</span>
                <span className="font-semibold text-slate-800">
                  {userToView.employee ? `${userToView.employee.firstName} ${userToView.employee.lastName} (${userToView.employee.id})` : 'Stand-alone (No employee profile)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Last Login:</span>
                <span className="font-mono text-slate-700">
                  {userToView.lastLoginAt ? new Date(userToView.lastLoginAt).toLocaleString() : 'Never logged in'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Created On:</span>
                <span className="font-mono text-slate-700">
                  {userToView.createdAt ? new Date(userToView.createdAt).toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Last Updated:</span>
                <span className="font-mono text-slate-700">
                  {userToView.updatedAt ? new Date(userToView.updatedAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT PORTAL ACCOUNT                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !modalLoading && setIsEditModalOpen(false)}
        title={`Edit Portal Account — ${selectedUser?.username}`}
        description="Update role assignment, email, or linked employee record."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          {modalError && (
            <Alert variant="danger" title="Error">
              {modalError}
            </Alert>
          )}

          {selectedUser?.isProtected && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AppIcon name="lock" className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Protected Super Admin: Role and active status are locked for system stability. Display name, email, credentials, and employee link can be updated freely.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display Name"
              id="edit-display-name"
              placeholder="e.g. Super Admin or Jane Doe"
              value={editFormData.displayName}
              onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
            />

            <Input
              label="Username *"
              id="edit-username"
              required
              value={editFormData.username}
              onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              id="edit-email"
              type="email"
              required
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
            />

            <Select
              label="Portal Role *"
              id="edit-role"
              required
              disabled={selectedUser?.isProtected}
              value={editFormData.role}
              onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
              options={PORTAL_ROLES}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Account Status"
              id="edit-status"
              disabled={selectedUser?.isProtected}
              value={editFormData.isActive ? 'true' : 'false'}
              onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'true' })}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' }
              ]}
            />

            <div>
              <Select
                label={editFormData.role === 'EMPLOYEE' ? "Linked Employee *" : "Linked Employee (Optional)"}
                id="edit-employee"
                disabled={employeeLoading || Boolean(employeeError)}
                value={editFormData.employeeId}
                onChange={(e) => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                options={[
                  ...linkedEmployeeOptions(selectedUser)
                ]}
              />
              {editFormData.role === 'EMPLOYEE' && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Required: Employee accounts must link to an active workforce member.
                </p>
              )}
            </div>
          </div>

          {employeeError && <p className="text-xs text-rose-600">{employeeError} <button type="button" className="underline" onClick={fetchLinkableEmployees}>Retry</button></p>}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={modalLoading}
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={modalLoading} disabled={employeeLoading || Boolean(employeeError)} icon="check">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: ADMIN RESET PASSWORD                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => !modalLoading && setIsResetPasswordModalOpen(false)}
        title={`Reset Password — ${selectedUser?.username}`}
        description="Set a new password. All currently active sessions for this account will be revoked immediately."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {modalError && (
            <Alert variant="danger" title="Error">
              {modalError}
            </Alert>
          )}

          <Input
            label="New Password *"
            id="admin-reset-password"
            type={showNewPassword ? 'text' : 'password'}
            required
            placeholder="Min 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            label="Confirm New Password *"
            id="admin-reset-confirm"
            type={showNewPassword ? 'text' : 'password'}
            required
            placeholder="Repeat new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
              <input
                type="checkbox"
                checked={showNewPassword}
                onChange={(e) => setShowNewPassword(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Show password text</span>
            </label>
            <span className="text-slate-400 text-[11px]">Argon2id Hash</span>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={modalLoading}
              onClick={() => setIsResetPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={modalLoading} icon="lock">
              Set New Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Delete Account Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !modalLoading && setIsDeleteModalOpen(false)}
        title="Delete Portal Account"
      >
        <div className="space-y-4 text-left">
          {modalError && (
            <Alert variant="danger" title="Error Deleting Account">
              {modalError}
            </Alert>
          )}

          <Alert variant="danger" title="Permanent Action Warning">
            Are you sure you want to permanently delete portal account <strong>{userToDelete?.username}</strong> ({userToDelete?.email})?
            <br />
            This will immediately revoke all active sessions and permanently delete portal access. This action cannot be undone.
          </Alert>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
            <p><span className="font-semibold text-slate-500">Portal Role:</span> {userToDelete?.role}</p>
            <p><span className="font-semibold text-slate-500">Username:</span> {userToDelete?.username}</p>
            <p><span className="font-semibold text-slate-500">Email:</span> {userToDelete?.email}</p>
            <p><span className="font-semibold text-slate-500">Linked Employee:</span> {userToDelete?.employee ? `${userToDelete.employee.firstName} ${userToDelete.employee.lastName} (${userToDelete.employee.employeeCode})` : 'None (Independent Account)'}</p>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={modalLoading}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              icon="trash"
              onClick={handleDeleteUser}
            >
              Confirm Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PortalUserManagementTab

