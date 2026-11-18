import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { attendanceService } from '@/services/attendanceService'
import { shiftService } from '@/services/shiftService'
import { attendancePolicyService } from '@/services/attendancePolicyService'
import { useAuth } from '@/context/useAuth'
import CheckInOutWidget from '@/components/attendance/CheckInOutWidget'
import TimesheetsTab from '@/components/attendance/TimesheetsTab'
import AttendanceCorrectionModal from '@/components/attendance/AttendanceCorrectionModal'
import WfhRequestModal from '@/components/attendance/WfhRequestModal'
import FieldDutyRequestModal from '@/components/attendance/FieldDutyRequestModal'
import OvertimeRequestModal from '@/components/attendance/OvertimeRequestModal'
import WfhFieldDutyDetailModal from '@/components/attendance/WfhFieldDutyDetailModal'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import AppIcon from '@/components/common/AppIcon'
import { getKarachiToday, formatTimeTo12Hour } from '@/lib/dateUtils'

/**
 * Manager Personal Attendance Page
 * Provides full personal self-service biometric punch, attendance history,
 * personal timesheets, and attendance requests for Department Managers.
 */
export function ManagerMyAttendancePage({ isEmbedded = false }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const currentUser = useMemo(() => ({
    name: user?.name || 'Bilal Siddiqui',
    role: user?.role || 'manager',
    employeeId: user?.employeeId || user?.id || 'EMP-003'
  }), [user?.name, user?.role, user?.employeeId, user?.id])

  const [activeTab, setActiveTab] = useState(() => {
    if (tabFromUrl && tabFromUrl !== 'myAttendance') return tabFromUrl
    return 'punch'
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tab !== 'myAttendance') {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Modals state
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState(null)
  const [isWfhModalOpen, setIsWfhModalOpen] = useState(false)
  const [isFieldDutyModalOpen, setIsFieldDutyModalOpen] = useState(false)
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false)
  const [selectedDetailRequest, setSelectedDetailRequest] = useState(null)
  const [isWfhFdDetailModalOpen, setIsWfhFdDetailModalOpen] = useState(false)

  // Reactive state strictly scoped to manager's personal records
  const [myRecords, setMyRecords] = useState(() =>
    attendanceService.getAttendanceRecords({ employeeId: currentUser.employeeId }, currentUser)
  )
  const [todayRecord, setTodayRecord] = useState(() =>
    attendanceService.getEmployeeTodayRecord(currentUser.employeeId)
  )
  const [assignedShift, setAssignedShift] = useState(() =>
    shiftService.resolveEmployeeShiftForDate(currentUser.employeeId, getKarachiToday())
  )
  const [lateStats, setLateStats] = useState(() =>
    attendanceService.getMonthlyLateCount(currentUser.employeeId, getKarachiToday().slice(0, 7))
  )
  const [policy, setPolicy] = useState(() =>
    attendancePolicyService.getActivePolicy()
  )
  const [myCorrections, setMyCorrections] = useState(() =>
    attendanceService.getAttendanceCorrections({ employeeId: currentUser.employeeId }, currentUser)
  )
  const [myWfhRequests, setMyWfhRequests] = useState(() =>
    attendanceService.getWfhRequests({ employeeId: currentUser.employeeId }, currentUser)
  )
  const [myFieldDutyRequests, setMyFieldDutyRequests] = useState(() =>
    attendanceService.getFieldDutyRequests({ employeeId: currentUser.employeeId }, currentUser)
  )
  const [myOvertimeRequests, setMyOvertimeRequests] = useState(() =>
    attendanceService.getOvertimeRequests({ employeeId: currentUser.employeeId }, currentUser)
  )

  const loadData = useCallback(() => {
    setMyRecords(attendanceService.getAttendanceRecords({ employeeId: currentUser.employeeId }, currentUser))
    const todayRec = attendanceService.getEmployeeTodayRecord(currentUser.employeeId)
    const activeDate = todayRec?.date || getKarachiToday()
    setTodayRecord(todayRec)
    setAssignedShift(shiftService.resolveEmployeeShiftForDate(currentUser.employeeId, activeDate))
    setLateStats(attendanceService.getMonthlyLateCount(currentUser.employeeId, getKarachiToday().slice(0, 7)))
    setPolicy(attendancePolicyService.getActivePolicy())
    setMyCorrections(attendanceService.getAttendanceCorrections({ employeeId: currentUser.employeeId }, currentUser))
    setMyWfhRequests(attendanceService.getWfhRequests({ employeeId: currentUser.employeeId }, currentUser))
    setMyFieldDutyRequests(attendanceService.getFieldDutyRequests({ employeeId: currentUser.employeeId }, currentUser))
    setMyOvertimeRequests(attendanceService.getOvertimeRequests({ employeeId: currentUser.employeeId }, currentUser))
  }, [currentUser])

  useEffect(() => {
    const unsubAtt = attendanceService.subscribe(loadData)
    const unsubShift = shiftService.subscribe(loadData)
    const unsubPolicy = attendancePolicyService.subscribe(loadData)
    return () => {
      unsubAtt()
      unsubShift()
      unsubPolicy()
    }
  }, [loadData])

  const subTabs = [
    { key: 'punch', label: 'Punch In / Out', icon: 'clock' },
    { key: 'history', label: 'My Attendance Log', icon: 'calendar' },
    { key: 'timesheets', label: 'My Timesheets', icon: 'tasks' },
    { key: 'requests', label: 'My Requests Tracker', icon: 'workflow' }
  ]

  const handleTabChange = (key) => {
    setActiveTab(key)
    if (!isEmbedded) {
      setSearchParams({ tab: key })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header (rendered if not embedded) */}
      {!isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-hrms-primary tracking-tight">
              Manager Personal Attendance & Timesheets
            </h2>
            <p className="text-xs text-hrms-muted mt-0.5">
              Personal biometric punch in/out, monthly attendance logs, personal timesheets, and time requests for {currentUser.name}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon="home"
              onClick={() => setIsWfhModalOpen(true)}
              className="text-xs"
            >
              WFH Request
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="briefcase"
              onClick={() => setIsFieldDutyModalOpen(true)}
              className="text-xs"
            >
              Field Duty
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="edit"
              onClick={() => {
                setSelectedRecordForCorrection(todayRecord)
                setIsCorrectionModalOpen(true)
              }}
              className="text-xs font-semibold bg-hrms-primary hover:bg-hrms-primary-hover text-white shadow-xs"
            >
              Regularize Punch
            </Button>
          </div>
        </div>
      )}

      {/* Internal Subtabs for Personal Attendance */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AppIcon name={tab.icon} className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Personal Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned Shift</span>
            <div className="text-sm font-black text-slate-800 mt-0.5">
              {assignedShift?.name || 'General Morning Shift'}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {formatTimeTo12Hour(assignedShift?.startTime || '09:00')} — {formatTimeTo12Hour(assignedShift?.endTime || '18:00')} ({assignedShift?.breakMinutes ?? 60}m break)
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <AppIcon name="clock" className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Grace Period</span>
            <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
              {assignedShift?.gracePeriodMinutes ?? policy?.gracePeriodMinutes ?? 15} Minutes
            </div>
            <span className="text-[10px] text-slate-400">Permitted arrival grace window</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <AppIcon name="check" className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">WFH Allowance</span>
            <div className="text-lg font-black text-blue-700 font-mono mt-0.5">
              {myWfhRequests.filter((w) => w.status === 'Approved').length} of {policy?.wfhMonthlyAllowanceDays || 4} Days
            </div>
            <span className="text-[10px] text-slate-400">Approved remote sessions this month</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <AppIcon name="dashboard" className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* TAB 1: PUNCH DESK */}
      {activeTab === 'punch' && (
        <div className="space-y-4">
          <CheckInOutWidget
            currentRecord={todayRecord}
            assignedShift={assignedShift}
            currentUser={currentUser}
            onCheckIn={(options) => attendanceService.checkIn(currentUser.employeeId, options)}
            onCheckOut={() => attendanceService.checkOut(currentUser.employeeId)}
          />
        </div>
      )}

      {/* TAB 2: MY ATTENDANCE LOG */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3">Attendance Date</th>
                  <th className="p-3">Assigned Shift</th>
                  <th className="p-3">Check-In</th>
                  <th className="p-3">Check-Out</th>
                  <th className="p-3 text-right">Worked Hours</th>
                  <th className="p-3">Lateness / Early Departure</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {myRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-400 italic">
                      No personal attendance history recorded yet.
                    </td>
                  </tr>
                ) : (
                  myRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-800">{r.date}</td>
                      <td className="p-3 text-slate-600 font-medium">
                        <div>{r.shiftName}</div>
                        <span className="text-[10px] text-slate-500 font-mono font-semibold">{r.workArrangement === 'REMOTE_WFH' ? 'WFH' : (r.workArrangement === 'FIELD_DUTY' ? 'Field Duty' : (r.workArrangement || 'Office'))}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700">{r.checkInTime ? formatTimeTo12Hour(r.checkInTime) : '— : —'}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{r.checkOutTime ? formatTimeTo12Hour(r.checkOutTime) : '— : —'}</td>
                      <td className="p-3 text-right font-mono font-bold text-hrms-primary">
                        {r.workedHours > 0 ? `${r.workedHours}h` : '0.0h'}
                      </td>
                      <td className="p-3">
                        {r.isLate ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            +{r.lateMinutes}m Late
                          </span>
                        ) : r.isEarlyExit ? (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            -{r.earlyExitMinutes}m Early
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">On-Time</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge status={r.primaryClassification || r.status} />
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecordForCorrection(r)
                            setIsCorrectionModalOpen(true)
                          }}
                          className="px-2 py-1 text-[11px] font-bold text-hrms-accent bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        >
                          Correction
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TIMESHEETS */}
      {activeTab === 'timesheets' && (
        <TimesheetsTab
          records={myRecords}
          currentUser={currentUser}
          onOpenOvertimeModal={() => setIsOvertimeModalOpen(true)}
        />
      )}

      {/* TAB 4: MY REQUESTS TRACKER */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card p-4">
            <h4 className="text-xs font-bold text-hrms-primary mb-3">Submitted Attendance & Time Requests</h4>
            <div className="space-y-2.5">
              {[
                ...myCorrections.map((c) => ({ ...c, requestCategory: 'Attendance Correction', targetDate: c.attendanceDate })),
                ...myWfhRequests.map((w) => ({ ...w, requestCategory: 'Work From Home', targetDate: w.requestedDate })),
                ...myFieldDutyRequests.map((f) => ({ ...f, requestCategory: 'Client Field Duty', targetDate: f.visitDate })),
                ...myOvertimeRequests.map((o) => ({ ...o, requestCategory: 'Overtime Claim', targetDate: o.overtimeDate }))
              ]
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                .map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{item.requestCategory}</span>
                        <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                          {item.id}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        For Date: <strong>{item.targetDate}</strong> • Reason: {item.reason || item.purpose || 'Official submission'}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Submitted: {item.submittedAt} • Approver: {item.approverName || item.currentApproverName || 'HR / Admin'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.decisionNotes && (
                        <div className="text-[11px] bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                          <strong>Approver Note: </strong> {item.decisionNotes}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetailRequest(item)
                          setIsWfhFdDetailModalOpen(true)
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 transition-colors shadow-2xs"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
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
        onSubmit={(data) => attendanceService.submitAttendanceCorrection(data, currentUser.name)}
      />

      <WfhRequestModal
        isOpen={isWfhModalOpen}
        onClose={() => setIsWfhModalOpen(false)}
        currentUser={currentUser}
        onSubmit={(data) => attendanceService.submitWfhRequest(data, currentUser.name)}
      />

      <FieldDutyRequestModal
        isOpen={isFieldDutyModalOpen}
        onClose={() => setIsFieldDutyModalOpen(false)}
        currentUser={currentUser}
        onSubmit={(data) => attendanceService.submitFieldDutyRequest(data, currentUser.name)}
      />

      <OvertimeRequestModal
        isOpen={isOvertimeModalOpen}
        onClose={() => setIsOvertimeModalOpen(false)}
        currentUser={currentUser}
        onSubmit={(data) => attendanceService.submitOvertimeRequest(data, currentUser.name)}
      />

      {isWfhFdDetailModalOpen && (
        <WfhFieldDutyDetailModal
          isOpen={isWfhFdDetailModalOpen}
          onClose={() => {
            setIsWfhFdDetailModalOpen(false)
            setSelectedDetailRequest(null)
          }}
          request={selectedDetailRequest}
        />
      )}
    </div>
  )
}

export default ManagerMyAttendancePage

