import React, { useState, useEffect } from 'react'
import { permissionService } from '@/services/permissionService'
import { useAuth } from '@/context/useAuth'

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard & Analytics' },
  { key: 'employees', label: 'Employee Management' },
  { key: 'recruitment', label: 'Recruitment & Onboarding' },
  { key: 'attendance', label: 'Attendance & Shifts' },
  { key: 'leaves', label: 'Leave Management' },
  { key: 'payroll', label: 'Payroll, Compensation & Benefits' },
  { key: 'tasks', label: 'Tasks & Delegations' },
  { key: 'performance', label: 'Performance Appraisals & Goals' },
  { key: 'training', label: 'Training & Development' },
  { key: 'helpdesk', label: 'Help Desk Management' },
  { key: 'travel', label: 'Travel & Transport' },
  { key: 'letters', label: 'Corporate HR Letters' },
  { key: 'expenses', label: 'Expense Management' },
  { key: 'settings', label: 'Administration & Settings' },
  { key: 'alerts', label: 'Scheduled Alerts & Notifications' },
  { key: 'reports', label: 'Reports & Statements' }
]

const ROLE_DISPLAY_ORDER = ['super_admin', 'hr_admin', 'manager', 'team_lead', 'employee']

const formatScopeBadge = (scope) => {
  switch (scope) {
    case 'company_wide':
      return 'Global Enterprise / Company-Wide'
    case 'department_teams':
      return 'Authorized Department Teams'
    case 'assigned_team':
      return 'Assigned Team Scope'
    case 'own':
      return 'Personal Self-Service'
    default:
      return (scope || '').toUpperCase()
  }
}

const ALL_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'submit', label: 'Submit' },
  { key: 'approve', label: 'Approve' },
  { key: 'reject', label: 'Reject' },
  { key: 'verify', label: 'Verify' },
  { key: 'export', label: 'Export' },
  { key: 'manage_config', label: 'Configure' },
  { key: 'view_audit', label: 'Audit' }
]

export function RolesPermissionsTab() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [roles, setRoles] = useState(() => permissionService.getAllRolePermissions())
  const [selectedRoleKey, setSelectedRoleKey] = useState('manager')
  const [editMatrix, setEditMatrix] = useState(() => {
    const r = permissionService.getAllRolePermissions()
    return JSON.parse(JSON.stringify(r))
  })
  const [feedback, setFeedback] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    return permissionService.subscribe(() => {
      const r = permissionService.getAllRolePermissions()
      setRoles(r)
      setEditMatrix(JSON.parse(JSON.stringify(r)))
      setHasChanges(false)
    })
  }, [])

  const selectedRole = roles[selectedRoleKey] || roles.super_admin
  const currentRoleMatrix = editMatrix[selectedRoleKey]?.modules || {}

  const handleToggleAction = (moduleKey, actionKey) => {
    if (!isSuperAdmin) return
    const updated = { ...editMatrix }
    const currentActions = updated[selectedRoleKey].modules[moduleKey] || []

    let nextActions = []
    if (currentActions.includes(actionKey)) {
      nextActions = currentActions.filter((a) => a !== actionKey)
    } else {
      nextActions = [...currentActions, actionKey]
    }

    updated[selectedRoleKey].modules[moduleKey] = nextActions
    setEditMatrix(updated)
    setHasChanges(true)
  }

  const handleSave = () => {
    try {
      // Iterate through modules and save changes for selectedRoleKey
      const targetModules = editMatrix[selectedRoleKey].modules
      for (const [modKey, actions] of Object.entries(targetModules)) {
        permissionService.updateRolePermissions(
          selectedRoleKey,
          modKey,
          actions,
          { name: user?.name || 'Tariq Mehmood', role: user?.role || 'super_admin', id: user?.id || 'EMP-001' },
          `Role ${selectedRoleKey} permissions updated by Super Admin`
        )
      }
      setFeedback({ type: 'success', text: `Permissions for ${selectedRole.roleName} saved and audited successfully.` })
      setHasChanges(false)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleReset = () => {
    setEditMatrix(JSON.parse(JSON.stringify(roles)))
    setHasChanges(false)
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header & Aligned Actions — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Roles &amp; Permissions Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamic role-based access control (RBAC), module authorities, and granular permission matrices.
          </p>
        </div>

        {isSuperAdmin && hasChanges && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
            >
              Save Permissions &amp; Audit
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              feedback.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-rose-600'
            }`}
          ></i>
          {feedback.text}
        </div>
      )}

      {/* Role Selection Pills (All 5 Portals/Roles in Standard Hierarchy) */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(roles)
          .sort(([a], [b]) => {
            const idxA = ROLE_DISPLAY_ORDER.indexOf(a)
            const idxB = ROLE_DISPLAY_ORDER.indexOf(b)
            return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99)
          })
          .map(([key, r]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedRoleKey(key)
                setHasChanges(false)
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition border flex items-center gap-2 ${
                selectedRoleKey === key
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <span>{r.roleName}</span>
              {r.isProtected && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-400/40">
                  Protected
                </span>
              )}
            </button>
          ))}
      </div>

      {/* Role Meta Banner */}
      <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="font-bold text-slate-800">{selectedRole.roleName} Scope: </span>
          <span className="text-slate-600">{selectedRole.description}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">Default Scope:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-800 text-[10px] font-bold font-mono">
            {formatScopeBadge(selectedRole.defaultScope)}
          </span>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 min-w-[200px]">System Module</th>
                {ALL_ACTIONS.map((act) => (
                  <th key={act.key} className="py-3 px-2 text-center text-[11px]">
                    {act.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ALL_MODULES.map((mod) => {
                const activeActions = currentRoleMatrix[mod.key] || []
                return (
                  <tr key={mod.key} className="hover:bg-slate-50/40 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {mod.label}
                    </td>
                    {ALL_ACTIONS.map((act) => {
                      const isChecked = activeActions.includes(act.key)
                      const isSuperAdminLocked = selectedRoleKey === 'super_admin'

                      return (
                        <td key={act.key} className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isSuperAdmin || isSuperAdminLocked}
                            onChange={() => handleToggleAction(mod.key, act.key)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>
            <i className="fa-solid fa-shield-halved text-slate-400 mr-1.5"></i>
            {selectedRoleKey === 'super_admin'
              ? 'Super Admin permissions are immutable root parameters required for platform operations.'
              : 'Privilege modifications are audited and logged with actor attribution.'}
          </span>
          {isSuperAdmin && hasChanges && (
            <span className="text-amber-700 font-semibold">● Unsaved permission changes pending</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default RolesPermissionsTab
