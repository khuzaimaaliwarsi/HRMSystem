import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { employeeService } from '@/services/employeeService'
import EmployeeProfileView from '@/components/employee/EmployeeProfileView'
import StatusBadge from '@/components/common/StatusBadge'
import AppIcon from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

export function ManagerTeamPage({ isTeamLead = false }) {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'team'
  const effectiveRole = user?.role === 'team_lead' || isTeamLead ? 'team_lead' : 'manager'
  const effectiveManagerId = user?.employeeId || (effectiveRole === 'team_lead' ? 'EMP-005' : 'EMP-003')

  const [teamMembers, setTeamMembers] = useState(() => {
    if (!effectiveManagerId) return []
    return employeeService.getAuthorizedTeamEmployees(effectiveManagerId, effectiveRole)
  })
  const [managerProfile, setManagerProfile] = useState(() => {
    if (!effectiveManagerId) return null
    return employeeService.getEmployeeById(effectiveManagerId)
  })
  const [viewingEmployee, setViewingEmployee] = useState(null)
  const [selectedProfileEmployeeId, setSelectedProfileEmployeeId] = useState(() => {
    if (!effectiveManagerId) return ''
    const directReports = employeeService.getAuthorizedTeamEmployees(effectiveManagerId, effectiveRole) || []
    return directReports[0]?.id || ''
  })
  const [searchQuery, setSearchQuery] = useState('')

  const loadTeam = useCallback(() => {
    if (!effectiveManagerId) {
      setTeamMembers([])
      setManagerProfile(null)
      return
    }
    const scopedMembers = employeeService.getAuthorizedTeamEmployees(effectiveManagerId, effectiveRole)
    setTeamMembers(scopedMembers)
    setManagerProfile(employeeService.getEmployeeById(effectiveManagerId))
  }, [effectiveManagerId, effectiveRole])

  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : []

  useEffect(() => {
    const unsubscribe = employeeService.subscribe(() => {
      loadTeam()
    })
    return () => unsubscribe()
  }, [loadTeam])

  const filteredTeam = safeTeamMembers.filter((m) => {
    if (!m) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.id && m.id.toLowerCase().includes(q)) ||
      (m.designation && m.designation.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q))
    )
  })

  const currentProfileEmp = safeTeamMembers.find((e) => e.id === selectedProfileEmployeeId) || safeTeamMembers[0]

  const directReports = effectiveRole === 'team_lead'
    ? safeTeamMembers
    : (safeTeamMembers || []).filter((m) => m?.managerId === effectiveManagerId)
  const directReportsCount = (directReports || []).length
  const totalDepartmentStaffCount = (safeTeamMembers || []).length

  return (
    <div className="space-y-5 text-left">
      {/* Top Banner */}
      <div className="rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
              {activeTab === 'profiles' ? 'Team Profiles & Career History' : (effectiveRole === 'team_lead' ? 'Assigned Team Roster' : 'Assigned Engineering Team Roster')}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-hrms-primary border border-blue-200">
              {effectiveRole === 'team_lead' ? 'Team Lead Scoped' : 'Manager Scoped'}
            </span>
          </div>
          <p className="text-xs text-hrms-muted mt-1">
            {activeTab === 'profiles'
              ? 'View professional dossiers, qualifications, and career trajectories of direct reports.'
              : effectiveRole === 'team_lead'
                ? `Direct reporting personnel under ${managerProfile?.name || 'Assigned Lead'} (${managerProfile?.designation || 'Team Lead'}).`
                : `Direct reports and department personnel under ${managerProfile?.name || 'Authorized Manager'} (${managerProfile?.designation || 'Department Manager'}).`}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-mono">
          <span>Direct Reports: <strong>{directReportsCount}</strong></span>
          {effectiveRole === 'manager' && (
            <>
              <span className="text-slate-300">|</span>
              <span>Total Department Staff: <strong>{totalDepartmentStaffCount}</strong></span>
            </>
          )}
        </div>
      </div>

      {activeTab === 'profiles' ? (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-lg border border-hrms-border flex items-center justify-between gap-4">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <AppIcon name="employees" className="w-4 h-4 text-hrms-accent" />
              <span>Select Direct Report:</span>
            </label>
            <select
              value={selectedProfileEmployeeId}
              onChange={(e) => setSelectedProfileEmployeeId(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-md px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 max-w-xs"
            >
              {safeTeamMembers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id}) — {emp.designation}
                </option>
              ))}
            </select>
          </div>
          {currentProfileEmp && (
            <EmployeeProfileView
              employee={currentProfileEmp}
              bankDetails={null}
              careerHistory={employeeService.getCareerHistory(currentProfileEmp.id)}
              reportingChain={employeeService.getReportingChain(currentProfileEmp.id)}
              canEdit={false}
              userRole="manager"
              currentUserId={effectiveManagerId}
            />
          )}
        </div>
      ) : (
        <>
          {/* KPI Highlights */}
          <div className={cn("grid gap-3.5", effectiveRole === 'team_lead' ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5")}>
            <div className="bg-white p-3.5 rounded-lg border border-hrms-border shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Direct Reports</span>
              <span className="text-xl font-extrabold text-hrms-primary mt-1 block">{directReportsCount}</span>
              <span className="text-[11px] text-slate-500 block">
                {effectiveRole === 'team_lead' ? 'Assigned reports' : 'Direct subordinates'}
              </span>
            </div>

            {effectiveRole !== 'team_lead' && (
              <div className="bg-white p-3.5 rounded-lg border border-hrms-border shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Dept Staff</span>
                <span className="text-xl font-extrabold text-blue-900 mt-1 block">{totalDepartmentStaffCount}</span>
                <span className="text-[11px] text-slate-500 block">Department personnel</span>
              </div>
            )}

            <div className="bg-white p-3.5 rounded-lg border border-hrms-border shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Present Today</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-1 block">
                {safeTeamMembers.filter((m) => ['Present', 'Late', 'WFH', 'Field Duty'].includes(m.attendanceToday)).length}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium block">Working on shift</span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-hrms-border shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Hybrid / Remote</span>
              <span className="text-xl font-extrabold text-sky-700 mt-1 block">
                {safeTeamMembers.filter((m) => m.workArrangement === 'Hybrid' || m.workArrangement === 'WFH').length}
              </span>
              <span className="text-[11px] text-slate-500 block">Flex arrangement</span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-hrms-border shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">On Probation</span>
              <span className="text-xl font-extrabold text-amber-700 mt-1 block">
                {safeTeamMembers.filter((m) => m && m.status === 'Probation').length}
              </span>
              <span className="text-[11px] text-slate-500 block">Milestone tracking</span>
            </div>
          </div>

          {/* Main Content Area */}
          {viewingEmployee ? (
            <EmployeeProfileView
              employee={viewingEmployee}
              bankDetails={null}
              careerHistory={employeeService.getCareerHistory(viewingEmployee.id)}
              reportingChain={employeeService.getReportingChain(viewingEmployee.id)}
              onClose={() => setViewingEmployee(null)}
              canEdit={false}
              userRole="manager"
              currentUserId={effectiveManagerId}
            />
          ) : (
            <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
              {/* Table Header with Search */}
              <div className="p-4 sm:p-5 border-b border-hrms-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-hrms-primary tracking-tight">Direct Team Members</h3>
                  <p className="text-xs text-hrms-muted mt-0.5">
                    Personnel reporting to you under canonical organizational hierarchy.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-hrms-border bg-white text-hrms-text placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                  />
                  <div className="absolute left-2.5 top-2 text-slate-400">
                    <AppIcon name="search" className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-hrms-canvas/80 border-b border-hrms-border text-[10px] uppercase font-bold text-hrms-muted tracking-wider">
                      <th className="px-4 py-3 whitespace-nowrap">Team Member</th>
                      <th className="px-4 py-3 whitespace-nowrap">ID</th>
                      <th className="px-4 py-3 whitespace-nowrap">Designation</th>
                      <th className="px-4 py-3 whitespace-nowrap">Assigned Team</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Work Mode</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Attendance</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hrms-border/60">
                {(filteredTeam || []).length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-xs text-hrms-muted">
                      No team members match search query.
                    </td>
                  </tr>
                ) : (
                  filteredTeam.map((emp, idx) => (
                    <tr key={emp.id} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs", emp.avatarBg || "bg-hrms-primary")}>
                            {emp.initials}
                          </div>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => setViewingEmployee(emp)}
                              className="font-bold text-hrms-primary text-xs hover:text-hrms-accent text-left"
                            >
                              {emp.name}
                            </button>
                            <span className="text-[11px] text-hrms-muted font-mono truncate max-w-[190px]">
                              {emp.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-hrms-primary text-xs whitespace-nowrap">
                        {emp.id}
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {emp.designation}
                      </td>

                      <td className="px-4 py-3 text-hrms-muted whitespace-nowrap">
                        {emp.teamName || 'Development'}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 bg-white text-slate-700 shadow-xs">
                          {emp.workArrangement}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={emp.attendanceToday} size="sm" className="whitespace-nowrap" />
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingEmployee(emp)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                        >
                          <AppIcon name="user" className="w-3 h-3 text-slate-500" />
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-hrms-canvas border-t border-hrms-border flex items-center justify-between text-[11px] text-hrms-muted">
            <span>Showing {(filteredTeam || []).length} direct reports</span>
            <span className="text-slate-400">Manager-Scoped View (Salary & Bank details masked)</span>
          </div>
        </div>
      )}
    </>
  )}
</div>
  )
}

export default ManagerTeamPage
