import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { attendanceService } from '@/services/attendanceService'
import { shiftService } from '@/services/shiftService'
import { employeeService } from '@/services/employeeService'
import { useAuth } from '@/context/useAuth'
import { getKarachiToday } from '@/lib/dateUtils'
import { syncAttendanceAndShifts } from '@/services/backendSync'
import CheckInOutWidget from '@/components/attendance/CheckInOutWidget'
import DailyAttendanceRegisterTab from '@/components/attendance/DailyAttendanceRegisterTab'
import ShiftAssignmentTab from '@/components/attendance/ShiftAssignmentTab'
import WfhFieldDutyTab from '@/components/attendance/WfhFieldDutyTab'
import AttendanceCorrectionsTab from '@/components/attendance/AttendanceCorrectionsTab'
import TimesheetsTab from '@/components/attendance/TimesheetsTab'
import AttendanceCorrectionModal from '@/components/attendance/AttendanceCorrectionModal'
import WfhRequestModal from '@/components/attendance/WfhRequestModal'
import FieldDutyRequestModal from '@/components/attendance/FieldDutyRequestModal'
import OvertimeRequestModal from '@/components/attendance/OvertimeRequestModal'
import ManagerMyAttendancePage from './ManagerMyAttendancePage'

export function ManagerAttendancePage({ defaultTab = 'teamRegister', isTeamLead = false }) {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const effectiveRole = user?.role === 'team_lead' || isTeamLead ? 'team_lead' : 'manager'
  const effectiveId = user?.employeeId || user?.id || (effectiveRole === 'team_lead' ? 'EMP-004' : 'EMP-003')

  const currentUser = useMemo(() => ({
    name: user?.name || (effectiveRole === 'team_lead' ? 'Ali Raza' : 'Bilal Siddiqui'),
    role: effectiveRole,
    employeeId: effectiveId
  }), [user?.name, effectiveRole, effectiveId])

  const [activeMainTab, setActiveMainTab] = useState(() => tabFromUrl || defaultTab)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveMainTab(tab)
    }
  }, [searchParams])

  // Modals state
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState(null)
  const [isWfhModalOpen, setIsWfhModalOpen] = useState(false)
  const [isFieldDutyModalOpen, setIsFieldDutyModalOpen] = useState(false)
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false)

  // Reactive state
  const [teamRecords, setTeamRecords] = useState(() => attendanceService.getAttendanceRecords({}, currentUser))
  const [myTodayRecord, setMyTodayRecord] = useState(() => attendanceService.getEmployeeTodayRecord(currentUser.employeeId))
  const [myAssignedShift, setMyAssignedShift] = useState(() => shiftService.resolveEmployeeShiftForDate(currentUser.employeeId, getKarachiToday()))
  const [shifts, setShifts] = useState(() => shiftService.getShifts())
  const [assignments, setAssignments] = useState(() => shiftService.getShiftAssignments())
  const [corrections, setCorrections] = useState(() => attendanceService.getAttendanceCorrections({}, currentUser))
  const [wfhRequests, setWfhRequests] = useState(() => attendanceService.getWfhRequests({}, currentUser))
  const [fieldDutyRequests, setFieldDutyRequests] = useState(() => attendanceService.getFieldDutyRequests({}, currentUser))
  const [overtimeRequests, setOvertimeRequests] = useState(() => attendanceService.getOvertimeRequests({}, currentUser))
  const [teamMembers, setTeamMembers] = useState(() => employeeService.getAuthorizedTeamEmployees(currentUser.employeeId, currentUser.role))

  const loadData = useCallback(() => {
    const todayRec = attendanceService.getEmployeeTodayRecord(currentUser.employeeId)
    const activeDate = todayRec?.date || getKarachiToday()
    setTeamRecords(attendanceService.getAttendanceRecords({}, currentUser))
    setMyTodayRecord(todayRec)
    setMyAssignedShift(shiftService.resolveEmployeeShiftForDate(currentUser.employeeId, activeDate))
    setShifts(shiftService.getShifts())
    setAssignments(shiftService.getShiftAssignments())
    setCorrections(attendanceService.getAttendanceCorrections({}, currentUser))
    setWfhRequests(attendanceService.getWfhRequests({}, currentUser))
    setFieldDutyRequests(attendanceService.getFieldDutyRequests({}, currentUser))
    setOvertimeRequests(attendanceService.getOvertimeRequests({}, currentUser))
    setTeamMembers(employeeService.getAuthorizedTeamEmployees(currentUser.employeeId, currentUser.role))
  }, [currentUser])

  useEffect(() => {
    const unsubAtt = attendanceService.subscribe(loadData)
    const unsubShift = shiftService.subscribe(loadData)
    const unsubEmp = employeeService.subscribe(loadData)
    syncAttendanceAndShifts().then(() => loadData()).catch(() => {})
    return () => {
      unsubAtt()
      unsubShift()
      unsubEmp()
    }
  }, [loadData])

  // Defensive arrays
  const safeTeamMembers = Array.isArray(teamMembers) ? teamMembers : []
  const safeTeamRecords = Array.isArray(teamRecords) ? teamRecords : []
  const safeCorrections = Array.isArray(corrections) ? corrections : []
  const safeWfhRequests = Array.isArray(wfhRequests) ? wfhRequests : []
  const safeFieldDutyRequests = Array.isArray(fieldDutyRequests) ? fieldDutyRequests : []
  const safeOvertimeRequests = Array.isArray(overtimeRequests) ? overtimeRequests : []
  const safeShifts = Array.isArray(shifts) ? shifts : []
  const safeAssignments = Array.isArray(assignments) ? assignments : []

  // Team summary metrics (Working Today scoped to today and distinct authorized direct reports)
  const today = getKarachiToday()
  const authorizedMemberIds = new Set(safeTeamMembers.map((m) => m.id))

  const workingTodayEmployees = new Set(
    safeTeamRecords
      .filter((r) => r.date === today && authorizedMemberIds.has(r.employeeId) && ['Present', 'Late', 'WFH', 'Field Duty'].includes(r.primaryClassification))
      .map((r) => r.employeeId)
  )
  const activeWorkingCount = workingTodayEmployees.size

  const lateCount = safeTeamRecords.filter(
    (r) => r.date === today && authorizedMemberIds.has(r.employeeId) && r.isLate
  ).length

  const pendingApprovalsCount = safeCorrections.filter((c) => c?.status?.toLowerCase().includes('pending') && c.employeeId !== currentUser.employeeId).length +
    safeWfhRequests.filter((w) => w?.status?.toLowerCase().includes('pending') && w.employeeId !== currentUser.employeeId).length +
    safeOvertimeRequests.filter((o) => o?.status?.toLowerCase().includes('pending') && o.employeeId !== currentUser.employeeId).length

  return (
    <div className="space-y-6 text-left">
      {/* Header (One Submodule = One Functional Screen) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-hrms-primary tracking-tight">
            {activeMainTab === 'myAttendance'
              ? 'My Personal Attendance'
              : activeMainTab === 'teamSchedules'
              ? 'Team Shift Rosters'
              : activeMainTab === 'teamWfh'
              ? 'Team WFH Approvals'
              : activeMainTab === 'corrections'
              ? 'Team Corrections Queue'
              : activeMainTab === 'timesheets'
              ? 'Team Timesheets & Overtime'
              : 'Team Daily Attendance'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeMainTab === 'myAttendance'
              ? 'Your individual check-in/out console, monthly logs, and punctuality stats.'
              : activeMainTab === 'teamSchedules'
              ? 'View working shifts and assigned schedules for your direct reports.'
              : activeMainTab === 'teamWfh'
              ? 'Review and authorize telecommuting and client site visit requests for direct reports.'
              : activeMainTab === 'corrections'
              ? 'Approve miss-punch justifications and punch corrections for team members.'
              : activeMainTab === 'timesheets'
              ? 'Review total hours worked and overtime records for your engineering team.'
              : 'Live supervisory attendance status for your direct reports.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-hrms-accent bg-blue-50 px-3 py-1 rounded border border-blue-200">
            {effectiveRole === 'team_lead' ? 'Team Lead' : 'Manager'}: {currentUser.name} (Direct Reports: {safeTeamMembers.length})
          </span>
        </div>
      </div>

      {/* Mini Team Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned Team Staff</span>
          <div className="text-xl font-black text-hrms-primary font-mono mt-0.5">{safeTeamMembers.length} Members</div>
          <span className="text-[10px] text-slate-400">Canonical direct reports</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Working Today</span>
          <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">{activeWorkingCount} / {safeTeamMembers.length}</div>
          <span className="text-[10px] text-slate-400">Office, WFH & Client visits</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Team Late Arrivals</span>
          <div className="text-xl font-black text-amber-700 font-mono mt-0.5">{lateCount} Flags</div>
          <span className="text-[10px] text-slate-400">Past grace threshold</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Team Review Queue</span>
          <div className="text-xl font-black text-blue-700 font-mono mt-0.5">{pendingApprovalsCount} Pending</div>
          <span className="text-[10px] text-slate-400">Corrections, WFH & Overtime</span>
        </div>
      </div>

      {/* Panels (One Submodule = One Functional Screen) */}
      {activeMainTab === 'teamRegister' && (
        <DailyAttendanceRegisterTab
          records={safeTeamRecords}
          departments={[{ id: 'DEP-01', name: 'Development' }]}
          shifts={safeShifts}
          userRole="manager"
          onOpenRegularizeModal={(rec) => {
            setSelectedRecordForCorrection(rec)
            setIsCorrectionModalOpen(true)
          }}
        />
      )}

      {activeMainTab === 'myAttendance' && (
        <ManagerMyAttendancePage isEmbedded={true} />
      )}

      {activeMainTab === 'teamSchedules' && (
        <ShiftAssignmentTab
          assignments={safeAssignments.filter((a) => safeTeamMembers.some((tm) => tm.id === a.employeeId) || a.employeeId === currentUser.employeeId)}
          shifts={safeShifts}
          employees={safeTeamMembers.concat([employeeService.getEmployeeById(currentUser.employeeId)]).filter(Boolean)}
          teams={[{ id: 'TEAM-01', name: 'Frontend Engineering' }]}
          canAssign={false}
        />
      )}

      {activeMainTab === 'teamWfh' && (
        <WfhFieldDutyTab
          wfhRequests={safeWfhRequests}
          fieldDutyRequests={safeFieldDutyRequests}
          currentUser={currentUser}
          onOpenWfhModal={() => setIsWfhModalOpen(true)}
          onOpenFieldDutyModal={() => setIsFieldDutyModalOpen(true)}
          onApproveWfh={async (id, notes, actor, actorId, role) => {
            await attendanceService.approveWfhRequestAsync(id, notes, actor || currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onRejectWfh={async (id, notes, actor, actorId, role) => {
            await attendanceService.rejectWfhRequestAsync(id, notes, actor || currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onApproveFieldDuty={async (id, notes, actor, actorId, role) => {
            await attendanceService.approveFieldDutyRequestAsync(id, notes, actor || currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onRejectFieldDuty={async (id, notes, actor, actorId, role) => {
            await attendanceService.rejectFieldDutyRequestAsync(id, notes, actor || currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
        />
      )}

      {activeMainTab === 'corrections' && (
        <AttendanceCorrectionsTab
          corrections={corrections}
          currentUser={currentUser}
          onOpenNewCorrectionModal={() => {
            setSelectedRecordForCorrection(null)
            setIsCorrectionModalOpen(true)
          }}
          onApproveCorrection={async (id, notes, actor, role, actorId) => {
            await attendanceService.approveAttendanceCorrectionAsync(id, notes, actor || currentUser.name, role || currentUser.role, actorId)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onRejectCorrection={async (id, notes, actor, role, actorId) => {
            await attendanceService.rejectAttendanceCorrectionAsync(id, notes, actor || currentUser.name, role || currentUser.role, actorId)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onEscalateCorrection={(id, reason, actor, role) => attendanceService.escalateCorrection(id, reason, actor, role)}
        />
      )}

      {activeMainTab === 'timesheets' && (
        <TimesheetsTab
          records={teamRecords}
          currentUser={currentUser}
          overtimeRequests={safeOvertimeRequests}
          onOpenOvertimeModal={() => setIsOvertimeModalOpen(true)}
          onApproveOvertime={async (id, mins, notes, actor, aId, role) => {
            await attendanceService.approveOvertimeRequestAsync(id, notes, actor || currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onRejectOvertime={async (id, notes, actor, aId, role) => {
            await attendanceService.rejectOvertimeRequestAsync(id, notes, actor || currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
        />
      )}

      {/* Modals */}
      <AttendanceCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => {
          setIsCorrectionModalOpen(false)
          setSelectedRecordForCorrection(null)
        }}
        employeeRecord={selectedRecordForCorrection}
        currentUser={currentUser}
        onSubmit={async (data) => {
          await attendanceService.submitAttendanceCorrectionAsync(data, currentUser.name)
          await syncAttendanceAndShifts()
          loadData()
        }}
      />

      <WfhRequestModal
        isOpen={isWfhModalOpen}
        onClose={() => setIsWfhModalOpen(false)}
        currentUser={currentUser}
        onSubmit={async (data) => {
          await attendanceService.requestWfhAsync(data, currentUser.name)
          await syncAttendanceAndShifts()
          loadData()
        }}
      />

      <FieldDutyRequestModal
        isOpen={isFieldDutyModalOpen}
        onClose={() => setIsFieldDutyModalOpen(false)}
        currentUser={currentUser}
        onSubmit={async (data) => {
          await attendanceService.requestFieldDutyAsync(data, currentUser.name)
          await syncAttendanceAndShifts()
          loadData()
        }}
      />

      <OvertimeRequestModal
        isOpen={isOvertimeModalOpen}
        onClose={() => setIsOvertimeModalOpen(false)}
        currentUser={currentUser}
        onSubmit={async (data) => {
          await attendanceService.submitOvertimeRequestAsync(data, currentUser.name)
          await syncAttendanceAndShifts()
          loadData()
        }}
      />
    </div>
  )
}

export default ManagerAttendancePage
