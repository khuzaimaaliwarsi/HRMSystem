import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { attendanceService } from '@/services/attendanceService'
import { shiftService } from '@/services/shiftService'
import { employeeService } from '@/services/employeeService'
import { useAuth } from '@/context/useAuth'
import { getKarachiToday } from '@/lib/dateUtils'
import { syncAttendanceAndShifts } from '@/services/backendSync'
import AttendanceOverviewCards from '@/components/attendance/AttendanceOverviewCards'
import DailyAttendanceRegisterTab from '@/components/attendance/DailyAttendanceRegisterTab'
import ShiftManagementTab from '@/components/attendance/ShiftManagementTab'
import ShiftAssignmentTab from '@/components/attendance/ShiftAssignmentTab'
import WfhFieldDutyTab from '@/components/attendance/WfhFieldDutyTab'
import AttendanceCorrectionsTab from '@/components/attendance/AttendanceCorrectionsTab'
import TimesheetsTab from '@/components/attendance/TimesheetsTab'
import AttendanceCorrectionModal from '@/components/attendance/AttendanceCorrectionModal'
import WfhRequestModal from '@/components/attendance/WfhRequestModal'
import FieldDutyRequestModal from '@/components/attendance/FieldDutyRequestModal'
import OvertimeRequestModal from '@/components/attendance/OvertimeRequestModal'
import ShiftFormModal from '@/components/attendance/ShiftFormModal'
import ShiftAssignModal from '@/components/attendance/ShiftAssignModal'

export function HrAdminAttendancePage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const currentUser = useMemo(() => ({
    name: user?.name || 'Ayesha Khan',
    role: 'hr_admin',
    employeeId: user?.employeeId || user?.employee?.id || user?.id || 'EMP-002',
    email: user?.email
  }), [user?.name, user?.employeeId, user?.employee, user?.id, user?.email])

  const [activeMainTab, setActiveMainTab] = useState(() => tabFromUrl || 'register')

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
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [shiftToEdit, setShiftToEdit] = useState(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  // Reactive state
  const [records, setRecords] = useState(() => attendanceService.getAttendanceRecords({}, currentUser))
  const [shifts, setShifts] = useState(() => shiftService.getShifts())
  const [assignments, setAssignments] = useState(() => shiftService.getShiftAssignments())
  const [corrections, setCorrections] = useState(() => attendanceService.getAttendanceCorrections({}, currentUser))
  const [wfhRequests, setWfhRequests] = useState(() => attendanceService.getWfhRequests({}, currentUser))
  const [fieldDutyRequests, setFieldDutyRequests] = useState(() => attendanceService.getFieldDutyRequests({}, currentUser))
  const [overtimeRequests, setOvertimeRequests] = useState(() => attendanceService.getOvertimeRequests({}, currentUser))
  const [registerDate, setRegisterDate] = useState(() => getKarachiToday())
  const [stats, setStats] = useState(() => attendanceService.getAttendanceOverviewStats({ date: getKarachiToday() }, currentUser))

  const handleRegisterDateChange = useCallback(async (newDate) => {
    setRegisterDate(newDate)
    setStats(attendanceService.getAttendanceOverviewStats({ date: newDate }, currentUser))
    setRecords(attendanceService.getAttendanceRecords({}, currentUser))
    try {
      await attendanceService.syncDailyRegister?.(newDate)
      setRecords(attendanceService.getAttendanceRecords({}, currentUser))
      setStats(attendanceService.getAttendanceOverviewStats({ date: newDate }, currentUser))
    } catch (_) {}
  }, [currentUser])

  const [departments, setDepartments] = useState(() => employeeService.getDepartments())
  const [teams, setTeams] = useState(() => employeeService.getTeams())
  const [employees, setEmployees] = useState(() => employeeService.getEmployees())

  const loadData = useCallback(() => {
    setRecords(attendanceService.getAttendanceRecords({}, currentUser))
    setShifts(shiftService.getShifts())
    setAssignments(shiftService.getShiftAssignments())
    setCorrections(attendanceService.getAttendanceCorrections({}, currentUser))
    setWfhRequests(attendanceService.getWfhRequests({}, currentUser))
    setFieldDutyRequests(attendanceService.getFieldDutyRequests({}, currentUser))
    setOvertimeRequests(attendanceService.getOvertimeRequests({}, currentUser))
    setStats(attendanceService.getAttendanceOverviewStats({ date: registerDate }, currentUser))

    setDepartments(employeeService.getDepartments())
    setTeams(employeeService.getTeams())
    setEmployees(employeeService.getEmployees())
  }, [currentUser, registerDate])

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

  return (
    <div className="space-y-6 text-left">
      {/* Header (One Submodule = One Functional Screen) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-hrms-primary tracking-tight">
            {activeMainTab === 'shifts'
              ? 'Shift Master & Rosters'
              : activeMainTab === 'assignments'
              ? 'Shift Roster & Scheduling'
              : activeMainTab === 'corrections'
              ? 'Regularization Queue'
              : activeMainTab === 'wfh'
              ? 'WFH & Client Duty'
              : activeMainTab === 'timesheets'
              ? 'Timesheets & Working Hours'
              : 'Daily Attendance Register'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeMainTab === 'shifts'
              ? 'Operational shift master, timings, half-day tolerances, and grace period settings.'
              : activeMainTab === 'assignments'
              ? 'Assign employees and teams to working shifts, schedule monthly rosters.'
              : activeMainTab === 'corrections'
              ? 'Process attendance regularization requests, miss-punches, and approval queue.'
              : activeMainTab === 'wfh'
              ? 'Manage and approve remote work authorizations and on-site client duty.'
              : activeMainTab === 'timesheets'
              ? 'Review consolidated employee timesheets, overtime hours, and project logs.'
              : 'Daily muster roll, staff attendance logs, real-time check-in status, and device punches.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs">
            Batch F04 Active
          </span>
        </div>
      </div>

      {/* KPI Overview */}
      {activeMainTab === 'register' && (
        <AttendanceOverviewCards
          stats={stats}
        />
      )}

      {/* Tab Panels */}
      {activeMainTab === 'register' && (
        <DailyAttendanceRegisterTab
          records={records}
          departments={departments}
          shifts={shifts}
          userRole="hr_admin"
          onDateChange={handleRegisterDateChange}
          onOpenRegularizeModal={(rec) => {
            setSelectedRecordForCorrection(rec)
            setIsCorrectionModalOpen(true)
          }}
        />
      )}

      {activeMainTab === 'shifts' && (
        <ShiftManagementTab
          shifts={shifts}
          canManageShifts={true}
          onOpenCreateShiftModal={() => {
            setShiftToEdit(null)
            setIsShiftModalOpen(true)
          }}
          onOpenEditShiftModal={(s) => {
            setShiftToEdit(s)
            setIsShiftModalOpen(true)
          }}
          onToggleShiftStatus={async (id) => {
            await shiftService.toggleShiftStatusAsync(id, currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
          onDeleteShift={async (id) => {
            await shiftService.deleteShiftAsync(id, currentUser.name)
            await syncAttendanceAndShifts()
            loadData()
          }}
        />
      )}

      {activeMainTab === 'assignments' && (
        <ShiftAssignmentTab
          assignments={assignments}
          shifts={shifts}
          employees={employees}
          teams={teams}
          canAssign={true}
          currentUser={currentUser}
          onOpenAssignModal={() => setIsAssignModalOpen(true)}
        />
      )}

      {activeMainTab === 'wfh' && (
        <WfhFieldDutyTab
          wfhRequests={wfhRequests}
          fieldDutyRequests={fieldDutyRequests}
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
          records={records}
          currentUser={currentUser}
          overtimeRequests={overtimeRequests}
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

      <ShiftFormModal
        isOpen={isShiftModalOpen}
        onClose={() => {
          setIsShiftModalOpen(false)
          setShiftToEdit(null)
        }}
        initialShift={shiftToEdit}
        onSubmit={async (data) => {
          if (data.id) {
            await shiftService.updateShiftAsync(data.id, data, currentUser.name)
          } else {
            await shiftService.createShiftAsync(data, currentUser.name)
          }
          await syncAttendanceAndShifts()
          loadData()
        }}
      />

      <ShiftAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        employees={employees}
        teams={teams}
        shifts={shifts}
        onSubmitIndividual={async (data) => {
          await shiftService.assignShiftAsync(data, currentUser.name)
          await syncAttendanceAndShifts()
          loadData()
        }}
        onSubmitTeam={async (teamData) => {
          await shiftService.assignShiftToTeamAsync(teamData, currentUser.name)
          await syncAttendanceAndShifts()
          loadData()
        }}
      />
    </div>
  )
}

export default HrAdminAttendancePage
