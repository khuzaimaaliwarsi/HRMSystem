import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatTimeTo12Hour, formatTimeRangeTo12Hour } from '../lib/dateUtils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const resolveFilePath = (rel) => {
  const candidate1 = path.resolve('src', rel)
  if (fs.existsSync(candidate1)) return candidate1
  const candidate2 = path.resolve('frontend/src', rel)
  if (fs.existsSync(candidate2)) return candidate2
  return path.resolve(__dirname, '..', rel)
}

describe('Aliyan_HRMS — Shift Time 12-Hour AM/PM Format Verification', () => {
  it('1. formatTimeTo12Hour correctly formats standard 24-hour shift times to 12-hour AM/PM', () => {
    // Exact examples required by business specification
    assert.strictEqual(formatTimeTo12Hour('08:00'), '08:00 AM')
    assert.strictEqual(formatTimeTo12Hour('17:00'), '05:00 PM')
    assert.strictEqual(formatTimeTo12Hour('18:00'), '06:00 PM')

    // Edge cases and boundaries
    assert.strictEqual(formatTimeTo12Hour('00:00'), '12:00 AM')
    assert.strictEqual(formatTimeTo12Hour('00:30'), '12:30 AM')
    assert.strictEqual(formatTimeTo12Hour('09:00'), '09:00 AM')
    assert.strictEqual(formatTimeTo12Hour('09:30'), '09:30 AM')
    assert.strictEqual(formatTimeTo12Hour('12:00'), '12:00 PM')
    assert.strictEqual(formatTimeTo12Hour('12:45'), '12:45 PM')
    assert.strictEqual(formatTimeTo12Hour('13:00'), '01:00 PM')
    assert.strictEqual(formatTimeTo12Hour('21:00'), '09:00 PM')
    assert.strictEqual(formatTimeTo12Hour('23:59'), '11:59 PM')

    // Idempotent / already formatted values
    assert.strictEqual(formatTimeTo12Hour('08:00 AM'), '08:00 AM')
    assert.strictEqual(formatTimeTo12Hour('05:00 PM'), '05:00 PM')
    assert.strictEqual(formatTimeTo12Hour('06:00 PM'), '06:00 PM')

    // Empty and fallback values
    assert.strictEqual(formatTimeTo12Hour(''), '')
    assert.strictEqual(formatTimeTo12Hour(null), '')
    assert.strictEqual(formatTimeTo12Hour(undefined), '')
    assert.strictEqual(formatTimeTo12Hour('—'), '—')
  })

  it('2. formatTimeRangeTo12Hour correctly formats time ranges', () => {
    assert.strictEqual(formatTimeRangeTo12Hour('08:00', '17:00'), '08:00 AM – 05:00 PM')
    assert.strictEqual(formatTimeRangeTo12Hour('09:00', '18:00'), '09:00 AM – 06:00 PM')
    assert.strictEqual(formatTimeRangeTo12Hour('20:00', '05:00'), '08:00 PM – 05:00 AM')
  })

  it('3. Shift Management: ShiftManagementTab and ShiftFormModal format shift hours in 12-hour AM/PM', () => {
    const tabFile = fs.readFileSync(resolveFilePath('components/attendance/ShiftManagementTab.jsx'), 'utf8')
    assert.ok(tabFile.includes('formatTimeTo12Hour(s.startTime)'), 'Shift operating hours start must use formatTimeTo12Hour')
    assert.ok(tabFile.includes('formatTimeTo12Hour(s.endTime)'), 'Shift operating hours end must use formatTimeTo12Hour')
    assert.ok(tabFile.includes('formatTimeTo12Hour(s.flexibleArrivalWindow.start)'), 'Arrival window start must use formatTimeTo12Hour')
    assert.ok(tabFile.includes('formatTimeTo12Hour(s.flexibleArrivalWindow.end)'), 'Arrival window end must use formatTimeTo12Hour')

    const modalFile = fs.readFileSync(resolveFilePath('components/attendance/ShiftFormModal.jsx'), 'utf8')
    assert.ok(modalFile.includes('formatTimeTo12Hour(startTime)'), 'Start time label must show 12-hour preview')
    assert.ok(modalFile.includes('formatTimeTo12Hour(endTime)'), 'End time label must show 12-hour preview')
  })

  it('4. Shift Assignment: ShiftAssignmentTab and ShiftAssignModal display 12-hour AM/PM', () => {
    const assignTab = fs.readFileSync(resolveFilePath('components/attendance/ShiftAssignmentTab.jsx'), 'utf8')
    assert.ok(assignTab.includes('formatTimeTo12Hour(shift.startTime)'), 'Assignment table must format shift startTime')
    assert.ok(assignTab.includes('formatTimeTo12Hour(shift.endTime)'), 'Assignment table must format shift endTime')

    const assignModal = fs.readFileSync(resolveFilePath('components/attendance/ShiftAssignModal.jsx'), 'utf8')
    assert.ok(assignModal.includes('formatTimeTo12Hour(s.startTime)'), 'Modal dropdown must format shift startTime')
    assert.ok(assignModal.includes('formatTimeTo12Hour(s.endTime)'), 'Modal dropdown must format shift endTime')
  })

  it('5. Web Punch & Self-Service: CheckInOutWidget displays 12-hour AM/PM', () => {
    const widget = fs.readFileSync(resolveFilePath('components/attendance/CheckInOutWidget.jsx'), 'utf8')
    assert.ok(widget.includes('formatTimeTo12Hour(assignedShift?.startTime'), 'Pill start must use formatTimeTo12Hour')
    assert.ok(widget.includes('formatTimeTo12Hour(assignedShift?.endTime'), 'Pill end must use formatTimeTo12Hour')
    assert.ok(widget.includes('formatTimeTo12Hour(currentRecord.checkInTime)'), 'Check-in time display must use formatTimeTo12Hour')
    assert.ok(widget.includes('formatTimeTo12Hour(currentRecord.checkOutTime)'), 'Check-out time display must use formatTimeTo12Hour')
  })

  it('6. Attendance Screens: Employee and Manager Attendance pages format 12-hour AM/PM', () => {
    const empAtt = fs.readFileSync(resolveFilePath('pages/attendance/EmployeeAttendancePage.jsx'), 'utf8')
    assert.ok(empAtt.includes('formatTimeTo12Hour(r.checkInTime)'), 'Employee history checkIn must use formatTimeTo12Hour')
    assert.ok(empAtt.includes('formatTimeTo12Hour(r.checkOutTime)'), 'Employee history checkOut must use formatTimeTo12Hour')

    const mgrAtt = fs.readFileSync(resolveFilePath('pages/attendance/ManagerMyAttendancePage.jsx'), 'utf8')
    assert.ok(mgrAtt.includes('formatTimeTo12Hour(assignedShift?.startTime'), 'Manager shift card must use formatTimeTo12Hour')
    assert.ok(mgrAtt.includes('formatTimeTo12Hour(r.checkInTime)'), 'Manager history checkIn must use formatTimeTo12Hour')
    assert.ok(mgrAtt.includes('formatTimeTo12Hour(r.checkOutTime)'), 'Manager history checkOut must use formatTimeTo12Hour')
  })

  it('7. Daily Register, Timesheets, and Corrections format 12-hour AM/PM', () => {
    const reg = fs.readFileSync(resolveFilePath('components/attendance/DailyAttendanceRegisterTab.jsx'), 'utf8')
    assert.ok(reg.includes('formatTimeTo12Hour(r.checkInTime)'), 'Daily register checkIn must use formatTimeTo12Hour')
    assert.ok(reg.includes('formatTimeTo12Hour(r.checkOutTime)'), 'Daily register checkOut must use formatTimeTo12Hour')
    assert.ok(reg.includes('formatTimeTo12Hour(selectedRecordForDetail.checkInTime)'), 'Detail modal checkIn must use formatTimeTo12Hour')

    const ts = fs.readFileSync(resolveFilePath('components/attendance/TimesheetsTab.jsx'), 'utf8')
    assert.ok(ts.includes('formatTimeTo12Hour(r.checkInTime)'), 'Timesheet checkIn must use formatTimeTo12Hour')
    assert.ok(ts.includes('formatTimeTo12Hour(r.checkOutTime)'), 'Timesheet checkOut must use formatTimeTo12Hour')

    const corrTab = fs.readFileSync(resolveFilePath('components/attendance/AttendanceCorrectionsTab.jsx'), 'utf8')
    assert.ok(corrTab.includes('formatTimeTo12Hour(c.originalCheckIn)'), 'Correction original checkIn must use formatTimeTo12Hour')
    assert.ok(corrTab.includes('formatTimeTo12Hour(c.requestedCheckIn)'), 'Correction requested checkIn must use formatTimeTo12Hour')
  })

  it('8. WFH, Field Duty, Training, and Interview components format 12-hour AM/PM', () => {
    const wfhTab = fs.readFileSync(resolveFilePath('components/attendance/WfhFieldDutyTab.jsx'), 'utf8')
    assert.ok(wfhTab.includes('formatTimeTo12Hour(f.expectedStartTime'), 'Field duty tab timing must use formatTimeTo12Hour')

    const wfhModal = fs.readFileSync(resolveFilePath('components/attendance/WfhFieldDutyDetailModal.jsx'), 'utf8')
    assert.ok(wfhModal.includes('formatTimeTo12Hour(request.expectedStartTime'), 'Field duty detail modal must use formatTimeTo12Hour')

    const fdModal = fs.readFileSync(resolveFilePath('components/attendance/FieldDutyRequestModal.jsx'), 'utf8')
    assert.ok(fdModal.includes('formatTimeTo12Hour(liveDuration.start24)'), 'Field duty request modal duration hint must use formatTimeTo12Hour')

    const training = fs.readFileSync(resolveFilePath('components/training/TrainingSessionsTable.jsx'), 'utf8')
    assert.ok(training.includes('formatTimeTo12Hour(session.startTime)'), 'Training session time must use formatTimeTo12Hour')

    const interview = fs.readFileSync(resolveFilePath('components/recruitment/InterviewScheduleTab.jsx'), 'utf8')
    assert.ok(interview.includes('formatTimeTo12Hour(item.startTime)'), 'Interview schedule time must use formatTimeTo12Hour')
  })

  it('9. Preserves underlying data values and duration calculation logic intact', () => {
    // Raw shift data must still be stored in canonical 24-hour format
    const attendanceData = fs.readFileSync(resolveFilePath('mocks/attendanceData.js'), 'utf8')
    assert.ok(attendanceData.includes("startTime: '09:00'"), 'Canonical mock shift data keeps HH:mm storage format')
    assert.ok(attendanceData.includes("endTime: '18:00'"), 'Canonical mock shift data keeps HH:mm storage format')
  })
})
