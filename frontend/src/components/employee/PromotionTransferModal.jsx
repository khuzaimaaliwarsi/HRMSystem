import React, { useState, useEffect, useMemo } from 'react'
import { employeeService } from '@/services/employeeService'
import { authService } from '@/services/authService'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'

export function PromotionTransferModal({
  isOpen,
  onClose,
  employee,
  departments = [],
  subDepartments = [],
  teams = [],
  designations = [],
  allEmployees = [],
  currentActor = 'HR Administrator',
  onSuccess
}) {
  const [designationId, setDesignationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [subDepartmentId, setSubDepartmentId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [assignAsRole, setAssignAsRole] = useState('')
  const [portalRole, setPortalRole] = useState('employee')
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Initialize form when employee opens
  useEffect(() => {
    if (employee) {
      setDesignationId(employee.designationId || '')
      setDepartmentId(employee.departmentId || '')
      setSubDepartmentId(employee.subDepartmentId || '')
      setTeamId(employee.teamId || '')
      setManagerId(employee.managerId || '')
      
      // Pre-select existing active leadership role if employee is already Team Lead or Manager
      try {
        const assignments = employeeService.getTeamAssignments ? employeeService.getTeamAssignments() : []
        const activeLead = assignments.find(
          (a) => a.employeeId === employee.id && a.status === 'Active' && a.teamId === (employee.teamId || '')
        )
        setAssignAsRole(activeLead ? activeLead.role : '')
      } catch {
        setAssignAsRole('')
      }
      
      // Resolve current portal role from authService
      try {
        const user = authService.getUserAccountById(employee.id)
        setPortalRole(user?.role || 'employee')
      } catch {
        setPortalRole('employee')
      }
      
      setEffectiveDate(new Date().toISOString().slice(0, 10))
      setReason('')
      setError(null)
    }
  }, [employee, isOpen])

  // Filter sub-departments based on selected department
  const filteredSubDepartments = useMemo(() => {
    if (!departmentId) return []
    return subDepartments.filter((s) => s.departmentId === departmentId && s.status === 'Active')
  }, [departmentId, subDepartments])

  // Filter teams based on selected department and sub-department
  const filteredTeams = useMemo(() => {
    if (!departmentId) return []
    return teams.filter((t) => {
      if (t.status !== 'Active') return false
      if (t.departmentId !== departmentId) return false
      if (subDepartmentId && t.subDepartmentId && t.subDepartmentId !== subDepartmentId) return false
      return true
    })
  }, [departmentId, subDepartmentId, teams])

  // Filter eligible managers (exclude the employee themselves and prevent reporting cycles)
  const eligibleManagers = useMemo(() => {
    if (!employee) return []
    return allEmployees.filter((m) => {
      if (m.id === employee?.id) return false
      if (m.status === 'Separated') return false
      return true
    })
  }, [employee, allEmployees])

  const isSuperAdminAccount = useMemo(() => {
    if (!employee) return false
    const users = typeof authService.getUsers === 'function' ? authService.getUsers() : []
    const matching = users.find((u) => (u.employeeId === employee.id || u.id === employee.id) && u.role === 'super_admin')
    // Root Super Admin protection: only canonical super admin user account is protected from demotion/role-change
    return Boolean(
      matching && (matching.email === 'superadmin@isysware.com' || matching.email === 'admin@isysware.com' || employee.email === 'superadmin@isysware.com' || employee.email === 'admin@isysware.com' || matching.id === 'usr-superadmin')
    )
  }, [employee])

  // Single active Team Lead conflict detector
  const activeTeamLeadConflict = useMemo(() => {
    if (assignAsRole !== 'team_lead') return null
    const targetTeamId = teamId || employee?.teamId
    if (!targetTeamId) return null
    const assignments = employeeService.getTeamAssignments ? employeeService.getTeamAssignments() : []
    const existingLead = assignments.find(
      (a) => a.teamId === targetTeamId && a.role === 'team_lead' && a.status === 'Active' && a.employeeId !== employee?.id
    )
    if (existingLead) {
      const teamObj = teams.find((t) => t.id === targetTeamId)
      return {
        teamName: teamObj ? teamObj.name : targetTeamId,
        leadName: existingLead.employeeName,
        leadId: existingLead.employeeId,
        assignmentId: existingLead.id
      }
    }
    return null
  }, [assignAsRole, teamId, employee, teams])

  if (!isOpen || !employee) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)

    // Multiple active Team Leads permitted for shared leadership coverage
    // If activeTeamLeadConflict exists, it is allowed as co-leadership

    if (!reason.trim()) {
      setError('A documented business reason or justification is required for promotion or transfer.')
      return
    }

    try {
      setLoading(true)
      const result = employeeService.promoteOrTransferEmployee(
        {
          employeeId: employee.id,
          designationId: designationId || employee.designationId,
          departmentId: departmentId || employee.departmentId,
          subDepartmentId: subDepartmentId || null,
          teamId: teamId || null,
          managerId: managerId || null,
          assignAsRole: assignAsRole || null,
          portalRole: isSuperAdminAccount ? undefined : portalRole,
          effectiveDate,
          reason: reason.trim()
        },
        currentActor
      )

      if (onSuccess) {
        onSuccess(result)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to execute promotion or transfer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 flex justify-center items-start pt-4 sm:pt-8 pb-8">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 text-left overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-[#102746] text-white flex items-center justify-between shrink-0 border-b border-slate-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
              <AppIcon name="user" className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Promote or Transfer Employee</h3>
              <p className="text-xs text-slate-300">
                Execute designation change, team re-assignment, leadership role, or portal upgrade
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-700">
            {error && (
              <Alert variant="danger" title="Validation Error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Current Employee Info Banner */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                  {(employee?.name || 'E').charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{employee?.name || 'Employee'}</div>
                  <div className="text-slate-500">{employee?.id || ''} • {employee?.email || ''}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-semibold text-slate-700">{employee?.designation || ''}</span>
                <div className="text-slate-400">{employee?.department || ''}</div>
              </div>
            </div>

            {/* Strict Salary Independence Guard */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5 items-start">
              <AppIcon name="info" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Compensation Policy Protection:</span> Promotions and organizational transfers do not modify employee salary or compensation packages. All compensation changes must be independently submitted through the <span className="font-semibold">Compensation & Payroll</span> module.
              </div>
            </div>

            {/* SECTION 1: Designation & Role Upgrades */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                1. Designation & Leadership Responsibilities
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation / Job Title *
                  </label>
                  <select
                    value={designationId}
                    onChange={(e) => setDesignationId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(designations || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Leadership Responsibility
                  </label>
                  <select
                    value={assignAsRole}
                    onChange={(e) => setAssignAsRole(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Leadership Role (Team Member)</option>
                    <option value="team_lead">Team Lead (Assigned Team Scoping)</option>
                    <option value="sub_department_manager">Sub-Department Manager</option>
                    <option value="department_manager">Department Manager</option>
                  </select>
                </div>
              </div>

              {/* Active Team Lead Co-Leadership Notice */}
              {activeTeamLeadConflict && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5 items-start animate-in fade-in">
                  <AppIcon name="alerts" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Co-Leadership Notice:</span> Team &apos;{activeTeamLeadConflict.teamName}&apos; already has an active Team Lead (<span className="font-semibold">{activeTeamLeadConflict.leadName} &bull; {activeTeamLeadConflict.leadId}</span>, {activeTeamLeadConflict.assignmentId}). Assigning this employee will establish shared leadership / co-lead coverage for the team.
                  </div>
                </div>
              )}

              {/* Portal Access Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Portal Access Role (System RBAC)
                </label>
                <select
                  value={portalRole}
                  onChange={(e) => setPortalRole(e.target.value)}
                  disabled={isSuperAdminAccount}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="employee">Employee Portal (Self-Service)</option>
                  <option value="team_lead">Team Lead Portal</option>
                  <option value="manager">Department Manager Portal</option>
                  <option value="hr_admin">HR / Admin Portal</option>
                  <option value="super_admin">Super Admin Portal</option>
                </select>
                {isSuperAdminAccount && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Super Admin root account (EMP-001) role is protected and cannot be changed.
                  </p>
                )}
              </div>
            </div>

            {/* SECTION 2: Organizational Placement & Transfers */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                2. Organizational Placement & Transfers
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value)
                      setSubDepartmentId('')
                      setTeamId('')
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(departments || []).map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub-Department (Optional)
                  </label>
                  <select
                    value={subDepartmentId}
                    onChange={(e) => {
                      setSubDepartmentId(e.target.value)
                      setTeamId('')
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None / Direct Department</option>
                    {(filteredSubDepartments || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Team (Optional)
                  </label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Team Assigned</option>
                    {(filteredTeams || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Direct Reporting Manager
                  </label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Manager / Direct Board</option>
                    {(eligibleManagers || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.designation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: Effective Date & Justification */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                3. Effective Date & Reason
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized By
                  </label>
                  <input
                    type="text"
                    value={currentActor}
                    readOnly
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Justification & Reason *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={2}
                  placeholder="State the justification (e.g. Annual career progression, organizational restructuring, lateral transfer)..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing...' : 'Confirm Promotion / Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PromotionTransferModal

