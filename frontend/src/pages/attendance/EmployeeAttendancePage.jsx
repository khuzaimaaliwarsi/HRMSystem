import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { attendanceService } from '@/services/attendanceService'
import { shiftService } from '@/services/shiftService'
import { attendancePolicyService } from '@/services/attendancePolicyService'
import { useAuth } from '@/context/useAuth'
import { syncAttendanceAndShifts } from '@/services/backendSync'
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
import { getKarachiToday, formatTimeTo12Hour, formatLateDuration } from '@/lib/dateUtils'

export function EmployeeAttendancePage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const currentUser = useMemo(() => ({
    name: user?.name || 'Zeeshan Ali',
    role: user?.role || 'employee',
    employeeId: user?.employeeId || user?.id || 'EMP-004'
  }), [user?.name, user?.role, user?.employeeId, user?.id])

  const [activeMainTab, setActiveMainTab] = useState(() => tabFromUrl || 'punch') // 'punch' | 'history' | 'timesheets' | 'requests'

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveMainTab(tab)
    }
  }, [searchParams])

  // Modals
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState(null)
  const [isWfhModalOpen, setIsWfhModalOpen] = useState(false)
  const [isFieldDutyModalOpen, setIsFieldDutyModalOpen] = useState(false)
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false)
  const [selectedDetailRequest, setSelectedDetailRequest] = useState(null)
  const [isWfhFdDetailModalOpen, setIsWfhFdDetailModalOpen] = useState(false)

  // Reactive state
  const [myRecords, setMyRecords] = useState(() => attendanceService.getAttendanceRecords({}, currentUser))
  const [todayRecord, setTodayRecord] = useState(() => attendanceService.getEmployeeTodayRecord(currentUser.employeeId))
  const [assignedShift, setAssignedShift] = useState(() => {
    const todayRec = attendanceService.getEmployeeTodayRecord(currentUser.employeeId)
    const activeDate = todayRec?.date || getKarachiToday()
    return shiftService.resolveEmployeeShiftForDate(currentUser.employeeId, activeDate)
  })
  const [lateStats, setLateStats] = useState(() => attendanceService.getMonthlyLateCount(currentUser.employeeId, getKarachiToday().slice(0, 7)))
  const [policy, setPolicy] = useState(() => attendancePolicyService.getActivePolicy())
  const [myCorrections, setMyCorrections] = useState(() => attendanceService.getAttendanceCorrections({}, currentUser))
  const [myWfhRequests, setMyWfhRequests] = useState(() => attendanceService.getWfhRequests({}, currentUser))
  const [myFieldDutyRequests, setMyFieldDutyRequests] = useState(() => attendanceService.getFieldDutyRequests({}, currentUser))
  const [myOvertimeRequests, setMyOvertimeRequests] = useState(() => attendanceService.getOvertimeRequests({}, currentUser))

  const loadData = useCallback(() => {
    const todayRec = attendanceService.getEmployeeTodayRecord(currentUser.employeeId)
    const activeDate = todayRec?.date || getKarachiToday()
    setMyRecords(attendanceService.getAttendanceRecords({}, currentUser))
    setTodayRecord(todayRec)
    setAssignedShift(shiftService.resolveEmployeeShiftForDate(currentUser.employeeId, activeDate))
    setLateStats(attendanceService.getMonthlyLateCount(currentUser.employeeId, getKarachiToday().slice(0, 7)))
    setPolicy(attendancePolicyService.getActivePolicy())
    setMyCorrections(attendanceService.getAttendanceCorrections({}, currentUser))
    setMyWfhRequests(attendanceService.getWfhRequests({}, currentUser))
    setMyFieldDutyRequests(attendanceService.getFieldDutyRequests({}, currentUser))
    setMyOvertimeRequests(attendanceService.getOvertimeRequests({}, currentUser))
  }, [currentUser])

  useEffect(() => {
    const unsubAtt = attendanceService.subscribe(loadData)
    const unsubShift = shiftService.subscribe(loadData)
    const unsubPolicy = attendancePolicyService.subscribe(loadData)
    syncAttendanceAndShifts().then(() => loadData()).catch(() => {})
    return () => {
      unsubAtt()
      unsubShift()
      unsubPolicy()
    }
  }, [loadData])

  return (
    <div className="space-y-6 text-left">
      {/* Header (One Submodule = One Functional Screen) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-hrms-primary tracking-tight">
            {activeMainTab === 'history'
              ? 'My Attendance Log & History'
              : activeMainTab === 'timesheets'
              ? 'My Timesheets & Working Hours'
              : activeMainTab === 'requests'
              ? 'My Attendance Requests'
              : 'Punch In / Out Desk'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeMainTab === 'history'
              ? 'Personal monthly attendance log, daily clock times, and shift compliance.'
              : activeMainTab === 'timesheets'
              ? 'Review your recorded daily and weekly working hours and overtime breakdown.'
              : activeMainTab === 'requests'
              ? 'Track status of your punch regularizations, WFH, and client field visit requests.'
              : 'Self-service check-in/out, biometric punch timestamping, and active shift indicator.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCorrectionModalOpen(true)}
            className="text-xs font-bold"
          >
            <AppIcon name="warning" className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Request Correction
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWfhModalOpen(true)}
            className="text-xs font-bold"
          >
            <AppIcon name="dashboard" className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Apply WFH
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFieldDutyModalOpen(true)}
            className="text-xs font-bold"
          >
            <AppIcon name="travel" className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            Client Field Visit
          </Button>
        </div>
      </div>

      {/* TAB 1: PUNCH DESK (One Submodule = One Functional Screen) */}
      {activeMainTab === 'punch' && (
        <div className="space-y-4">
          {/* Punctuality Policy Allowance Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-hrms-card flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Monthly Allowed Lates</span>
                <div className="text-lg font-black text-hrms-primary font-mono mt-0.5">
                  {lateStats.totalLateCount} of {lateStats.allowedLimit} Used
                </div>
                <span className="text-[10px] text-slate-400">
                  {lateStats.remainingAllowedLates} permitted lates remaining this month
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-50 text-hrms-accent flex items-center justify-center font-bold">
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
                  {(myWfhRequests || []).filter(w => w?.status === 'Approved')?.length || 0} of {policy?.wfhMonthlyAllowanceDays || 4} Days
                </div>
                <span className="text-[10px] text-slate-400">Approved remote sessions this month</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <AppIcon name="dashboard" className="w-4 h-4" />
              </div>
            </div>
          </div>
          <CheckInOutWidget
            currentRecord={todayRecord}
            assignedShift={assignedShift}
            currentUser={currentUser}
            onCheckIn={async (options) => {
              await attendanceService.checkInAsync(currentUser.employeeId, options)
              await syncAttendanceAndShifts()
              loadData()
            }}
            onCheckOut={async () => {
              await attendanceService.checkOutAsync(currentUser.employeeId)
              await syncAttendanceAndShifts()
              loadData()
            }}
          />
        </div>
      )}

      {/* TAB 2: MY ATTENDANCE LOG */}
      {activeMainTab === 'history' && (
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
                {(myRecords || []).length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-400 italic">
                      No attendance history recorded yet.
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
                      <td className="p-3 font-mono font-bold text-slate-700">{r.checkInTime ? formatTimeTo12Hour(r.checkInTime) : ((r.checkIn && r.checkIn !== '--:--') ? formatTimeTo12Hour(r.checkIn) : '— : —')}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{r.checkOutTime ? formatTimeTo12Hour(r.checkOutTime) : ((r.checkOut && r.checkOut !== '--:--') ? formatTimeTo12Hour(r.checkOut) : '— : —')}</td>
                      <td className="p-3 text-right font-mono font-bold text-hrms-primary">
                        {r.workedHours > 0 ? `${r.workedHours}h` : '0.0h'}
                      </td>
                      <td className="p-3">
                        {r.isLate ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {formatLateDuration(r.lateMinutes, 'Late')}
                          </span>
                        ) : r.isEarlyExit ? (
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            {formatLateDuration(r.earlyExitMinutes, 'Early')}
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
      {activeMainTab === 'timesheets' && (
        <TimesheetsTab
          records={myRecords}
          currentUser={currentUser}
          overtimeRequests={myOvertimeRequests}
          onOpenOvertimeModal={() => setIsOvertimeModalOpen(true)}
        />
      )}

      {/* TAB 4: MY REQUESTS TRACKER */}
      {activeMainTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card p-4">
            <h4 className="text-xs font-bold text-hrms-primary mb-3">Submitted Attendance & Time Requests</h4>
            <div className="space-y-2.5">
              {[
                ...(myCorrections || []).map(c => ({ ...c, requestCategory: 'Attendance Correction', targetDate: c?.attendanceDate })),
                ...(myWfhRequests || []).map(w => ({ ...w, requestCategory: 'Work From Home', targetDate: w?.requestedDate })),
                ...(myFieldDutyRequests || []).map(f => ({ ...f, requestCategory: 'Client Field Duty', targetDate: f?.visitDate })),
                ...(myOvertimeRequests || []).map(o => ({ ...o, requestCategory: 'Overtime Claim', targetDate: o?.overtimeDate }))
              ].sort((a, b) => new Date(b?.submittedAt || 0) - new Date(a?.submittedAt || 0)).map((item) => (
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
                      Submitted: {item.submittedAt} • Approver: {item.approverName || item.currentApproverName || 'Assigned Manager'}
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

export default EmployeeAttendancePage
