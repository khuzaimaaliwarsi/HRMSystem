import React, { useState, useEffect, useMemo } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/common/Button'
import Alert from '@/components/common/Alert'
import { getKarachiToday, getKarachiTimeString, formatTimeTo12Hour } from '@/lib/dateUtils'
import { shiftService } from '@/services/shiftService'

export function CheckInOutWidget({
  currentRecord = null,
  assignedShift = null,
  currentUser = null,
  onCheckIn,
  onCheckOut
}) {
  const [currentTime, setCurrentTime] = useState(() => getKarachiTimeString())
  const [workArrangement, setWorkArrangement] = useState(() => {
    if (currentRecord?.workArrangement) {
      return (currentRecord.workArrangement === 'REMOTE_WFH' || currentRecord.workArrangement === 'WFH') ? 'WFH' : (currentRecord.workArrangement === 'FIELD_DUTY' ? 'Field Duty' : currentRecord.workArrangement)
    }
    return 'Office'
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const activeBusinessDate = currentRecord?.date || getKarachiToday()

  // Auto-detect approved WFH or Field Duty for today to default dropdown
  useEffect(() => {
    if (!currentRecord?.checkInTime) {
      try {
        const empCode = currentUser?.employeeId || currentUser?.id
        const todayStr = getKarachiToday()
        const rawWfh = localStorage.getItem('isysware_wfh_requests')
        if (rawWfh) {
          const list = JSON.parse(rawWfh)
          const isWfh = list.some(w => (w.employeeId === empCode) && (w.status === 'Approved' || w.status === 'APPROVED') && (w.requestedDate === todayStr || (w.startDate && w.startDate.slice(0, 10) <= todayStr && w.endDate && w.endDate.slice(0, 10) >= todayStr)))
          if (isWfh) {
            setWorkArrangement('WFH')
            return
          }
        }
        const rawFd = localStorage.getItem('isysware_field_duty_requests')
        if (rawFd) {
          const list = JSON.parse(rawFd)
          const isFd = list.some(f => (f.employeeId === empCode) && (f.status === 'Approved' || f.status === 'APPROVED') && (f.visitDate === todayStr || (f.dutyDate && f.dutyDate.slice(0, 10) === todayStr)))
          if (isFd) {
            setWorkArrangement('Field Duty')
            return
          }
        }
      } catch (_) {}
    }
  }, [currentRecord?.checkInTime, currentUser])

  const displayShift = useMemo(() => {
    // 1. If current record has an explicitly saved shiftId, use that shift
    if (currentRecord?.shiftId) {
      const s = shiftService.getShiftById(currentRecord.shiftId)
      if (s) return s
    }
    // 2. Resolve canonical effective shift for this employee on the record's date (or active date)
    const empId = currentUser?.employeeId || currentUser?.id || currentRecord?.employeeId
    if (empId) {
      const resolved = shiftService.resolveEmployeeShiftForDate(empId, activeBusinessDate)
      if (resolved) return resolved
    }
    // 3. Fallback to passed assignedShift or canonical Day Shift
    return assignedShift || shiftService.getShiftById('SHIFT-01')
  }, [currentRecord?.shiftId, currentRecord?.date, currentUser?.employeeId, currentUser?.id, currentRecord?.employeeId, activeBusinessDate, assignedShift])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getKarachiTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const hasCheckedIn = Boolean(currentRecord?.checkInTime)
  const hasCheckedOut = Boolean(currentRecord?.checkOutTime)

  const handleCheckInClick = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      await onCheckIn?.({ workArrangement })
      setMessage(`Check-in recorded successfully for ${currentUser?.name || 'you'}.`)
      setTimeout(() => setMessage(null), 5000)
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOutClick = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      await onCheckOut?.()
      setMessage(`Check-out recorded successfully. Working hours updated.`)
      setTimeout(() => setMessage(null), 5000)
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card p-5 text-left">
      {message && (
        <Alert variant="success" className="mb-4" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="danger" className="mb-4" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Left Column: Live Clock & Shift Details */}
        <div className="space-y-2 border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
          <div className="flex items-center gap-2 text-hrms-muted text-xs">
            <AppIcon name="clock" className="w-3.5 h-3.5 text-hrms-accent" />
            <span>Company Timezone: <strong>Asia/Karachi (PKT)</strong></span>
          </div>
          <div className="text-3xl font-black text-hrms-primary font-mono tracking-tight">
            {currentTime}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Active Business Date: <strong className="text-slate-800">{currentRecord?.date || getKarachiToday()}</strong>
          </div>

          <div className="pt-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Assigned Shift
            </div>
            <div className="text-xs font-bold text-hrms-primary flex items-center gap-2">
              <span>{assignedShift?.name || displayShift?.name || currentRecord?.shiftName || 'General Corporate Day Shift'}</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                {formatTimeTo12Hour(assignedShift?.startTime || '09:00')} – {formatTimeTo12Hour(assignedShift?.endTime || '18:00')}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Break: {displayShift?.breakMinutes ?? 60}m {displayShift?.paidBreak ? '(Paid)' : '(Unpaid)'} • Grace: {displayShift?.gracePeriodMinutes ?? 15}m
            </div>
          </div>
        </div>

        {/* Center Column: Today Status & Hours */}
        <div className="space-y-3 border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Today's Session State</span>
            <StatusBadge status={currentRecord?.status || 'Not Checked In'} />
          </div>

          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">First Check-In</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {currentRecord?.checkInTime ? formatTimeTo12Hour(currentRecord.checkInTime) : '— : —'}
              </span>
              {currentRecord?.isLate && (
                <span className="block text-[10px] text-amber-700 font-bold">
                  +{currentRecord.lateMinutes}m Late
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Check-Out</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {currentRecord?.checkOutTime ? formatTimeTo12Hour(currentRecord.checkOutTime) : '— : —'}
              </span>
              {currentRecord?.isEarlyExit && (
                <span className="block text-[10px] text-rose-700 font-bold">
                  -{currentRecord.earlyExitMinutes}m Early
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <span>Hours Logged Today:</span>
            <span className="font-bold text-hrms-primary font-mono text-sm">
              {currentRecord?.workedHours ?? 0.0} hrs
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Punch Actions */}
        <div className="space-y-3">
          {!hasCheckedIn ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Reporting Arrangement Today:
                </label>
                <select
                  value={workArrangement}
                  onChange={(e) => setWorkArrangement(e.target.value)}
                  className="w-full text-xs font-medium p-2 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-hrms-accent"
                >
                  <option value="Office">Office Duty (On-Premises)</option>
                  <option value="WFH">Work From Home (Approved)</option>
                  <option value="Field Duty">Official Client Field Duty</option>
                </select>
              </div>

              <Button
                variant="primary"
                onClick={handleCheckInClick}
                loading={loading}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-sm"
              >
                <AppIcon name="clock" className="w-4 h-4 mr-2" />
                Check In Now
              </Button>
            </div>
          ) : !hasCheckedOut ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2.5 rounded-md text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <AppIcon name="success" className="w-3.5 h-3.5 text-emerald-600" />
                  Active session since {formatTimeTo12Hour(currentRecord.checkInTime)}
                </span>
                <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-semibold">
                  {currentRecord.workArrangement === 'REMOTE_WFH' ? 'WFH' : (currentRecord.workArrangement === 'FIELD_DUTY' ? 'Field Duty' : (currentRecord.workArrangement || 'Office'))}
                </span>
              </div>

              <Button
                variant="danger"
                onClick={handleCheckOutClick}
                loading={loading}
                className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-sm shadow-sm"
              >
                <AppIcon name="logout" className="w-4 h-4 mr-2" />
                Complete Day (Check Out)
              </Button>
            </div>
          ) : (
            <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-lg text-center space-y-1.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 mx-auto flex items-center justify-center font-bold">
                <AppIcon name="check" className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-hrms-primary">Daily Attendance Completed</div>
              <p className="text-[11px] text-slate-500">
                You checked out at {formatTimeTo12Hour(currentRecord.checkOutTime)}. Session finalized with {currentRecord.workedHours} working hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckInOutWidget
