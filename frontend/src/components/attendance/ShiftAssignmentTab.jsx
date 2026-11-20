import React, { useState } from 'react'
import { useAuth } from '@/context/useAuth'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import { formatTimeTo12Hour, getKarachiToday } from '@/lib/dateUtils'
import EditShiftAssignModal from './EditShiftAssignModal'

export function ShiftAssignmentTab({
  assignments = [],
  shifts = [],
  employees = [],
  teams = [],
  _teams = [],
  onOpenAssignModal,
  canAssign = true,
  currentUser = null
}) {
  const { user } = useAuth()
  const activeUser = currentUser || user
  const roleStr = String(activeUser?.role || activeUser?.portalRole || '').toLowerCase().replace(/[^a-z]/g, '')
  const isSuperAdminByRole = roleStr.includes('superadmin') || roleStr === 'admin' || activeUser?.username === 'superadmin' || activeUser?.role === 'super_admin'
  const isSuperAdminByPath = typeof window !== 'undefined' && (window.location.pathname.startsWith('/super-admin') || window.location.pathname.startsWith('/admin'))
  const isSuperAdminPortal = isSuperAdminByRole || isSuperAdminByPath
  const portalDefaultAssigner = isSuperAdminPortal ? (activeUser?.name || 'Super Admin') : (activeUser?.name || 'HR Admin')

  const [shiftFilter, setShiftFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const handleOpenEdit = (assignment) => {
    setEditingAssignment(assignment)
    setIsEditModalOpen(true)
  }

  const enrichedAssignments = assignments.map((a) => {
    const emp = employees.find((e) => e.id === a.employeeId || e.cuid === a.employeeId || e.employeeCode === a.employeeId)
    const shift = shifts.find((s) => s.id === a.shiftId || s.cuid === a.shiftId || s.code === a.shiftId)

    const rawStatus = (a.status || a.backendStatus || 'ACTIVE').toUpperCase()
    let rosterStatus = 'Active'

    if (rawStatus === 'SUPERSEDED') {
      rosterStatus = 'Superseded'
    } else {
      const today = getKarachiToday()
      const isFuture = a.effectiveFrom && a.effectiveFrom > today
      const untilDate = a.effectiveTo || a.effectiveUntil
      const isPast = untilDate && untilDate < today

      if (isFuture) {
        rosterStatus = 'Scheduled'
      } else if (isPast) {
        rosterStatus = 'Inactive'
      } else {
        rosterStatus = 'Active'
      }
    }

    let assignedByDisplay = a.assignedByName || a.assignedBy
    if (isSuperAdminPortal) {
      if (!assignedByDisplay || assignedByDisplay === 'HR Admin' || assignedByDisplay === 'HR Administrator' || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
        assignedByDisplay = 'Super Admin'
      }
    } else {
      if (!assignedByDisplay || (typeof assignedByDisplay === 'string' && assignedByDisplay.startsWith('cmw'))) {
        assignedByDisplay = activeUser?.name || portalDefaultAssigner
      }
    }

    const effectiveUntilDisplay =
      (a.effectiveTo || a.effectiveUntil) ? (a.effectiveTo || a.effectiveUntil) : 'Indefinite'

    return {
      ...a,
      employeeName: a.employeeName || (emp ? emp.name : a.employeeId),
      department: emp ? emp.department : (a.department || '—'),
      teamName: emp ? emp.teamName : (a.teamName || '—'),
      shiftTitle: shift ? shift.name : a.shiftTitle || a.shiftName || a.shiftId,
      shiftType: shift ? shift.type : a.shiftType || 'Fixed',
      shiftTimes: shift
        ? `${formatTimeTo12Hour(shift.startTime)} – ${formatTimeTo12Hour(shift.endTime)}`
        : a.shiftTimes || '09:00 AM – 06:00 PM',
      rosterStatus,
      assignedByDisplay,
      effectiveUntilDisplay
    }
  })

  const filteredAssignments = enrichedAssignments.filter((a) => {
    if (shiftFilter !== 'all' && a.shiftId !== shiftFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (
        a.employeeName.toLowerCase().includes(q) ||
        a.employeeId.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4 text-left">
      <div className="bg-white p-4 rounded-lg border border-hrms-border shadow-hrms-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-hrms-primary">Staff Shift Assignments & Roster</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Effective-dated schedule mapping for individuals and whole functional teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="text-xs p-2 border border-slate-300 rounded bg-white"
          >
            <option value="all">All Shifts</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <div className="relative">
            <AppIcon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white w-48"
            />
          </div>

          {canAssign && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenAssignModal}
              className="bg-hrms-primary text-white"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1.5" />
              Assign Shift
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3">Staff Member</th>
                <th className="p-3">Department & Team</th>
                <th className="p-3">Assigned Shift</th>
                <th className="p-3">Schedule Type</th>
                <th className="p-3">Effective From</th>
                <th className="p-3">Effective Until</th>
                <th className="p-3">Assigned By</th>
                <th className="p-3 text-center">Roster Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-slate-400 italic">
                    No shift assignments found matching search.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => {
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{a.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{a.employeeId}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{a.department}</div>
                        <div className="text-[10px] text-slate-400">{a.teamName}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-hrms-primary">{a.shiftTitle}</div>
                        <div className="font-mono text-[10px] text-slate-500">{a.shiftTimes}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {a.shiftType}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-700">{a.effectiveFrom}</td>
                      <td className="p-3 font-mono text-slate-600">{a.effectiveUntilDisplay}</td>
                      <td className="p-3 text-slate-500 text-[11px]">{a.assignedByDisplay}</td>
                      <td className="p-3 text-center">
                        <StatusBadge status={a.rosterStatus} />
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {canAssign ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(a)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition cursor-pointer"
                            title="Edit Effective Dates or Schedule"
                          >
                            Edit
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && editingAssignment && (
        <EditShiftAssignModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingAssignment(null)
          }}
          assignment={editingAssignment}
          shifts={shifts}
        />
      )}
    </div>
  )
}

export default ShiftAssignmentTab
