/**
 * iSysware HRMS — Backend Master Synchronization Service
 * Coordinates bidirectional real-time synchronization between Express/PostgreSQL APIs
 * and the frontend reactive in-memory state.
 *
 * Enforces:
 * 1. Authoritative PostgreSQL persistence.
 * 2. Zero business data persistence in browser LocalStorage.
 * 3. Graceful role-based scoping (handling 403s on non-accessible endpoints).
 * 4. Reactive notification to all subscribers via each service's _notify().
 */

import { apiClient } from './apiClient.js'
import { notify } from '../lib/notify.js'
import { employeeService } from './employeeService.js'
import { attendanceService } from './attendanceService.js'
import { shiftService } from './shiftService.js'
import { leaveService } from './leaveService.js'
import { leavePolicyService } from './leavePolicyService.js'
import { leaveBalanceService } from './leaveBalanceService.js'
import { payrollService } from './payrollService.js'
import { compensationService } from './compensationService.js'
import { loanService } from './loanService.js'
import { salaryRevisionService } from './salaryRevisionService.js'
import { expenseService } from './expenseService.js'
import { recruitmentService } from './recruitmentService.js'
import { taskService } from './taskService.js'
import { kpiService } from './kpiService.js'
import { performanceService } from './performanceService.js'
import { trainingService } from './trainingService.js'
import { policyService } from './policyService.js'
import { companySettingsService } from './companySettingsService.js'
import { hrLettersService } from './hrLettersService.js'
import { helpDeskService } from './helpDeskService.js'
import { travelService } from './travelService.js'
import { dataPurgeService } from './dataPurgeService.js'

// Track sync status
let isSyncing = false
let lastSyncTimestamp = null
let latestTaskSyncRequest = 0
/**
 * 1. Synchronize Organization Master & Directory
 */
export async function syncOrganization() {
  try {
    const [deptRes, teamRes, desigRes, subDeptRes, empRes] = await Promise.allSettled([
      apiClient.get('/organization/departments'),
      apiClient.get('/organization/teams'),
      apiClient.get('/organization/designations'),
      apiClient.get('/organization/sub-departments'),
      apiClient.get('/employees?limit=200&status=ALL')
    ])

    if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) {
      const depts = deptRes.value.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        description: d.description || '',
        status: d.status || (d.isActive ? 'Active' : 'Inactive'),
        headId: d.headId || d.headEmployeeId || null,
        headName: d.head ? `${d.head.firstName} ${d.head.lastName}` : (d.headEmployee ? `${d.headEmployee.firstName} ${d.headEmployee.lastName}` : (d.headName || 'Unassigned'))
      }))
      employeeService.memoryStorage['isysware_hrms_f02_departments_v1'] = depts
    }

    if (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)) {
      const teams = teamRes.value.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        departmentId: t.departmentId,
        departmentName: t.department?.name || t.departmentName || '',
        subDepartmentId: t.subDepartmentId || null,
        status: t.status || 'Active',
        leadId: t.teamLeadId || t.leadEmployeeId || null,
        leadName: t.teamLead ? `${t.teamLead.firstName} ${t.teamLead.lastName}` : (t.leadEmployee ? `${t.leadEmployee.firstName} ${t.leadEmployee.lastName}` : (t.leadName || 'Unassigned'))
      }))
      employeeService.memoryStorage['isysware_hrms_f02_teams_v1'] = teams
    }

    if (desigRes.status === 'fulfilled' && Array.isArray(desigRes.value)) {
      const desigs = desigRes.value.map((dg) => ({
        id: dg.id,
        code: dg.code,
        title: dg.title,
        name: dg.title,
        departmentId: dg.departmentId || null,
        departmentName: dg.department?.name || 'Cross-Department',
        status: dg.status || 'Active',
        level: dg.level,
        minSalary: dg.minSalary ? Number(dg.minSalary) : 0,
        maxSalary: dg.maxSalary ? Number(dg.maxSalary) : 0
      }))
      employeeService.memoryStorage['isysware_hrms_f02_designations_v1'] = desigs
    }

    if (subDeptRes.status === 'fulfilled' && Array.isArray(subDeptRes.value)) {
      const depts = employeeService.getDepartments()
      const subDepts = subDeptRes.value.map((sd) => {
        const parentDept = depts.find((d) => d.id === sd.departmentId || d.code === sd.departmentId)
        return {
          id: sd.id,
          code: sd.code,
          name: sd.name,
          departmentId: sd.departmentId || sd.department?.id || '',
          departmentName: sd.department?.name || parentDept?.name || '',
          description: sd.description || '',
          status: sd.status || 'Active',
          managerId: sd.managerId || null,
          managerName: sd.manager ? `${sd.manager.firstName} ${sd.manager.lastName}` : (sd.managerName || 'Unassigned')
        }
      })
      employeeService.memoryStorage['isysware_hrms_f02_sub_departments_v1'] = subDepts
      employeeService._notify()
    }

    if (empRes.status === 'fulfilled' && Array.isArray(empRes.value)) {
      const emps = empRes.value.map((e) => {
        const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.employeeCode
        return {
          id: e.employeeCode || e.id,
          cuid: e.id,
          employeeCode: e.employeeCode,
          name: fullName,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          phone: e.phone || '',
          cnic: e.cnic || '',
          dob: e.dateOfBirth ? new Date(e.dateOfBirth).toISOString().slice(0, 10) : '',
          gender: e.gender || 'Male',
          departmentId: e.departmentId || e.department?.id || '',
          department: e.department?.name || '',
          subDepartmentId: e.subDepartmentId || '',
          teamId: e.teamId || e.team?.id || '',
          team: e.team?.name || '',
          teamName: e.team?.name || '',
          designationId: e.designationId || e.designation?.id || '',
          designation: e.designation?.title || '',
          status: (e.employmentStatus || 'ACTIVE').toLowerCase() === 'active' ? 'Active' : (e.employmentStatus === 'SUSPENDED' ? 'Inactive' : (['RESIGNED', 'TERMINATED', 'RETIRED'].includes(e.employmentStatus) ? 'Separated' : e.employmentStatus)),
          employmentType: e.employmentType || 'Permanent',
          workArrangement: e.workArrangement || 'Office',
          joiningDate: e.joiningDate || e.hireDate ? new Date(e.joiningDate || e.hireDate).toISOString().slice(0, 10) : '',
          joinDate: e.joiningDate || e.hireDate ? new Date(e.joiningDate || e.hireDate).toISOString().slice(0, 10) : '',
          reportingManagerId: e.reportingManager?.employeeCode || e.reportingManagerId || '',
          managerId: e.reportingManager?.employeeCode || e.reportingManagerId || '',
          reportingManager: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : '',
          managerName: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : 'Unassigned',
          bankName: e.bankName || null,
          accountTitle: e.bankAccountTitle || null,
          accountNumber: e.bankAccountNumber || null,
          iban: e.bankIban || null,
          portalRole: e.userAccount?.role || 'EMPLOYEE'
        }
      })
      employeeService.memoryStorage['isysware_hrms_f02_employees_v1'] = emps
    }

    employeeService._notify()
  } catch (err) {
    console.warn('[BackendSync] Organization sync non-fatal error:', err)
  }
}

function normalizeShiftTypeFromBackend(type, isNightShift = false) {
  if (!type) return isNightShift ? 'Overnight' : 'Fixed'
  const t = String(type).trim().toUpperCase().replace('-', '_')
  if (t === 'FLEXIBLE') return 'Flexible'
  if (t === 'ROTATING') return 'Rotating'
  if (t === 'OVERNIGHT' || isNightShift) return 'Overnight'
  if (t === 'PART_TIME') return 'Part-Time'
  if (t === 'HOURLY') return 'Hourly'
  return 'Fixed'
}

/**
 * 2. Synchronize Shifts & Attendance Register
 */
export async function syncAttendanceAndShifts() {
  try {
    const [shiftRes, assignRes, attRes, corrRes, wfhRes, fldRes, otRes] = await Promise.allSettled([
      apiClient.get('/shifts'),
      apiClient.get('/shifts/assignments'),
      apiClient.get('/attendance/register'),
      apiClient.get('/attendance/regularizations'),
      apiClient.get('/attendance/wfh'),
      apiClient.get('/attendance/field-duty'),
      apiClient.get('/attendance/overtime')
    ])

    if (shiftRes.status === 'fulfilled' && Array.isArray(shiftRes.value)) {
      shiftService.memoryStorage['isysware_hrms_f04_shifts_v1'] = shiftRes.value.map((s) => ({
        id: s.shiftCode || s.code || s.id,
        cuid: s.id,
        code: s.shiftCode || s.code,
        name: s.name,
        type: normalizeShiftTypeFromBackend(s.type, s.isNightShift),
        startTime: s.startTime || '09:00',
        endTime: s.endTime || '18:00',
        breakMinutes: Number(s.breakDurationMinutes ?? s.breakMinutes ?? 60),
        paidBreak: Boolean(s.isBreakPaid),
        expectedWorkingHours: s.fullDayTargetMinutes ? s.fullDayTargetMinutes / 60 : (s.expectedWorkingHours || 8.0),
        gracePeriodMinutes: Number(s.graceMinutesIn ?? s.gracePeriodMinutes ?? 15),
        weeklyWorkingDays: Array.isArray(s.workDaysJson) ? s.workDaysJson : (Array.isArray(s.workDays) ? s.workDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
        applicableWorkArrangements: ['Office', 'Hybrid', 'WFH'],
        status: s.isActive ? 'Active' : 'Inactive',
        isDefault: Boolean(s.isDefault),
        description: s.description || ''
      }))
      shiftService._notify()
    }

    if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
      shiftService.memoryStorage['isysware_hrms_f04_shift_assignments_v1'] = assignRes.value.map((a) => {
        const fromDate = a.effectiveFrom ? new Date(a.effectiveFrom).toISOString().slice(0, 10) : ''
        const untilDate = a.effectiveUntil ? new Date(a.effectiveUntil).toISOString().slice(0, 10) : null
        const empCode = a.employee?.employeeCode || a.employeeCode || a.employeeId
        const empName = a.employeeName || (a.employee ? `${a.employee.firstName || ''} ${a.employee.lastName || ''}`.trim() : empCode)
        const shiftId = a.shift?.shiftCode || a.shift?.id || a.shiftId
        const shiftName = a.shift?.name || a.shiftName || 'Standard Day Shift'
        const rawStatus = (a.status || 'ACTIVE').toUpperCase()
        const assignedBy = a.assignedByName || (typeof a.assignedBy === 'string' && a.assignedBy.startsWith('cmw') ? 'HR Admin' : a.assignedBy) || 'HR Admin'

        return {
          id: a.id,
          cuid: a.id,
          employeeId: empCode,
          employeeCuid: a.employee?.id || a.employeeId,
          employeeCode: empCode,
          employeeName: empName,
          shiftId: shiftId,
          shiftCuid: a.shift?.id || a.shiftId,
          shiftTitle: shiftName,
          shiftName: shiftName,
          shiftType: a.shift?.type ? (a.shift.type.charAt(0).toUpperCase() + a.shift.type.slice(1).toLowerCase()) : 'Fixed',
          effectiveFrom: fromDate,
          effectiveTo: untilDate,
          effectiveUntil: untilDate,
          isPrimary: a.isPrimary !== false,
          status: rawStatus,
          backendStatus: rawStatus,
          assignedById: a.assignedById || null,
          assignedBy: assignedBy,
          assignedByName: assignedBy,
          notes: a.notes || null,
          createdAt: a.createdAt || null
        }
      })
      shiftService._notify()
    }

    const regData = attRes.status === 'fulfilled' ? (Array.isArray(attRes.value) ? attRes.value : (attRes.value?.register || [])) : []
    if (regData.length > 0) {
      attendanceService.memoryStorage['isysware_hrms_f04_attendance_records_v1'] = regData
    }

    if (corrRes.status === 'fulfilled' && Array.isArray(corrRes.value)) {
      const statusMap = { 'PENDING': 'Pending Review', 'APPROVED': 'Approved', 'REJECTED': 'Rejected' }
      attendanceService.memoryStorage['isysware_hrms_f04_corrections_v1'] = corrRes.value.map((c) => ({
        id: c.requestCode || c.id,
        cuid: c.id,
        requestCode: c.requestCode,
        employeeId: c.employee?.employeeCode || c.employeeId,
        employeeName: c.employee ? `${c.employee.firstName || ''} ${c.employee.lastName || ''}`.trim() : 'Employee',
        attendanceDate: c.attendanceDate ? new Date(c.attendanceDate).toISOString().slice(0, 10) : '',
        correctionType: c.adjustmentType || c.correctionType || 'Missing Check-Out',
        requestedCheckIn: c.requestedCheckIn ? new Date(c.requestedCheckIn).toISOString().slice(11, 16) : '09:00',
        requestedCheckOut: c.requestedCheckOut ? new Date(c.requestedCheckOut).toISOString().slice(11, 16) : '18:00',
        reason: c.reason || '',
        status: statusMap[c.status] || (c.status === 'APPROVED' ? 'Approved' : (c.status === 'REJECTED' ? 'Rejected' : 'Pending Review')),
        submittedAt: c.createdAt ? new Date(c.createdAt).toISOString().replace('T', ' ').slice(0, 19) : ''
      }))
      attendanceService._notify()
    }

    if (wfhRes.status === 'fulfilled' && Array.isArray(wfhRes.value)) {
      const statusMap = { 'PENDING': 'Pending Review', 'APPROVED': 'Approved', 'REJECTED': 'Rejected' }
      attendanceService.memoryStorage['isysware_hrms_f04_wfh_requests_v1'] = wfhRes.value.map((w) => {
        const reqDate = w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : ''
        const endDate = w.endDate ? new Date(w.endDate).toISOString().slice(0, 10) : reqDate
        const submitted = w.appliedAt || w.createdAt
          ? new Date(w.appliedAt || w.createdAt).toISOString().replace('T', ' ').slice(0, 19)
          : ''
        const deliverables = w.deliverables || w.deliverablesPlanned || ''
        const deptName = w.employee?.department?.name || 'Software Development'
        const empCode = w.employee?.employeeCode || w.employeeId
        const empFullName = w.employee
          ? `${w.employee.firstName || ''} ${w.employee.lastName || ''}`.trim() || empCode
          : 'Employee'

        return {
          id: w.requestCode || w.id,
          cuid: w.id,
          requestCode: w.requestCode || w.id,
          employeeId: empCode,
          employeeName: empFullName,
          name: empFullName,
          departmentName: deptName,
          department: deptName,
          requestedDate: reqDate,
          startDate: reqDate,
          endDate: endDate,
          targetDate: reqDate,
          date: reqDate,
          durationDays: w.durationDays ? String(w.durationDays) : '1',
          totalDays: w.durationDays ? Number(w.durationDays) : 1,
          reason: w.reason || '',
          deliverables: deliverables,
          deliverablesPlanned: deliverables,
          contactInfo: w.contactInfo || null,
          submittedAt: submitted,
          appliedAt: w.appliedAt || w.createdAt || '',
          status: statusMap[w.status] || w.status || 'Pending Review',
          requestCategory: 'Work From Home (WFH)',
          currentApproverName: 'Department Manager',
          currentApproverRole: 'manager',
          decidedBy: w.reviewedByRole || w.reviewedById || null,
          decidedAt: w.reviewedAt ? new Date(w.reviewedAt).toISOString().replace('T', ' ').slice(0, 19) : null,
          decisionRemarks: w.decisionRemarks || null,
          decisionNotes: w.decisionRemarks || null
        }
      })
    }

    if (fldRes.status === 'fulfilled' && Array.isArray(fldRes.value)) {
      const statusMap = { 'PENDING': 'Pending Review', 'APPROVED': 'Approved', 'REJECTED': 'Rejected' }
      attendanceService.memoryStorage['isysware_hrms_f04_field_duty_requests_v1'] = fldRes.value.map((f) => {
        const visitDate = f.dutyDate ? new Date(f.dutyDate).toISOString().slice(0, 10) : ''
        const startTime = f.startTime || f.expectedStartTime || '09:30'
        const endTime = f.endTime || f.expectedEndTime || '18:30'
        const durHours = f.durationHours ? parseFloat(f.durationHours) : 0
        const durFormatted = durHours ? `${durHours} hrs` : ''
        const location = f.siteLocation || f.clientLocation || f.location || ''
        const submitted = f.appliedAt || f.createdAt
          ? new Date(f.appliedAt || f.createdAt).toISOString().replace('T', ' ').slice(0, 19)
          : ''
        const deptName = f.employee?.department?.name || 'Software Development'
        const empCode = f.employee?.employeeCode || f.employeeId
        const empFullName = f.employee
          ? `${f.employee.firstName || ''} ${f.employee.lastName || ''}`.trim() || empCode
          : 'Employee'

        return {
          id: f.requestCode || f.id,
          cuid: f.id,
          requestCode: f.requestCode || f.id,
          employeeId: empCode,
          employeeName: empFullName,
          name: empFullName,
          departmentName: deptName,
          department: deptName,
          dutyDate: visitDate,
          visitDate: visitDate,
          targetDate: visitDate,
          date: visitDate,
          startTime: startTime,
          endTime: endTime,
          expectedStartTime: startTime,
          expectedEndTime: endTime,
          actualStartTime: startTime,
          actualEndTime: endTime,
          durationHours: durHours,
          durationFormatted: durFormatted,
          clientName: f.clientName || '',
          siteLocation: location,
          clientLocation: location,
          location: location,
          purpose: f.purpose || f.reason || '',
          reason: f.purpose || f.reason || '',
          transportRequired: Boolean(f.transportRequired),
          submittedAt: submitted,
          appliedAt: f.appliedAt || f.createdAt || '',
          status: statusMap[f.status] || f.status || 'Pending Review',
          requestCategory: 'Client Field Duty',
          currentApproverName: 'Department Manager',
          currentApproverRole: 'manager',
          decidedBy: f.approvedByRole || f.approvedById || null,
          decidedAt: f.approvedAt ? new Date(f.approvedAt).toISOString().replace('T', ' ').slice(0, 19) : null,
          decisionRemarks: f.decisionRemarks || null,
          decisionNotes: f.decisionRemarks || null
        }
      })
    }

    if (otRes.status === 'fulfilled' && Array.isArray(otRes.value)) {
      const statusMap = { 'PENDING': 'Pending Review', 'APPROVED': 'Approved', 'REJECTED': 'Rejected' }
      attendanceService.memoryStorage['isysware_hrms_f04_overtime_requests_v1'] = otRes.value.map((o) => {
        const rawMins = o.durationMinutes ?? o.requestedMinutes
        const mins = Number.isFinite(Number(rawMins)) && Number(rawMins) > 0 ? Number(rawMins) : 60
        const hours = Number.isFinite(Number(o.requestedHours)) && Number(o.requestedHours) > 0
          ? Number(o.requestedHours)
          : Math.round((mins / 60) * 10) / 10
        const timeIn = o.startTime || o.actualCheckIn || '18:00'
        const timeOut = o.endTime || o.actualCheckOut || '20:00'
        const deptName = o.employee?.department?.name || o.departmentName || 'Software Development'
        const empCode = o.employee?.employeeCode || o.employeeId
        const empFullName = o.employee
          ? `${o.employee.firstName || ''} ${o.employee.lastName || ''}`.trim() || empCode
          : (o.employeeName || 'Employee')

        const isDecided = o.status === 'APPROVED' || o.status === 'REJECTED'
        const approverName = isDecided
          ? (o.reviewedByName || 'HR Administrator')
          : (o.approverName || o.currentApproverName || 'Department Manager')
        const approverRole = isDecided
          ? (o.reviewedByRole || 'HR Admin')
          : (o.approverRole || o.currentApproverRole || 'Manager')

        return {
          id: o.requestCode || o.id,
          cuid: o.id,
          requestCode: o.requestCode || o.id,
          employeeId: empCode,
          employeeName: empFullName,
          departmentName: deptName,
          overtimeDate: o.overtimeDate ? new Date(o.overtimeDate).toISOString().slice(0, 10) : '',
          actualCheckIn: timeIn,
          actualCheckOut: timeOut,
          startTime: timeIn,
          endTime: timeOut,
          durationMinutes: mins,
          requestedMinutes: mins,
          requestedHours: hours,
          reason: o.reason || '',
          taskDeliverableRef: o.taskDeliverableRef || null,
          status: statusMap[o.status] || o.status || 'Pending Review',
          approverName,
          approverRole,
          currentApproverName: approverName,
          currentApproverRole: approverRole,
          decidedBy: o.reviewedByName || o.reviewedById || null,
          decidedAt: o.reviewedAt ? new Date(o.reviewedAt).toISOString().replace('T', ' ').slice(0, 19) : null,
          decisionRemarks: o.decisionRemarks || null,
          decisionNotes: o.decisionRemarks || null,
          submittedAt: o.appliedAt ? new Date(o.appliedAt).toISOString().replace('T', ' ').slice(0, 19) : ''
        }
      })
    }

    attendanceService._notify()
  } catch (err) {
    console.warn('[BackendSync] Attendance sync non-fatal error:', err)
  }
}

/**
 * 3. Synchronize Leave Requests & Entitlements
 */
export async function syncLeaves() {
  try {
    const [typesRes, requestsRes, entitlementsRes] = await Promise.allSettled([
      apiClient.get('/leaves/types'),
      apiClient.get('/leaves/requests'),
      apiClient.get('/leaves/entitlements')
    ])

    if (typesRes.status === 'fulfilled') {
      const typesData = Array.isArray(typesRes.value) ? typesRes.value : (typesRes.value?.data || [])
      if (Array.isArray(typesData) && typesData.length > 0) {
        leaveService.memoryStorage['isysware_hrms_f05_leave_types_v1'] = typesData
        leavePolicyService.setLeaveTypes(typesData)
      }
    }

    if (requestsRes.status === 'fulfilled') {
      const reqList = Array.isArray(requestsRes.value) ? requestsRes.value : (requestsRes.value?.data || [])
      if (Array.isArray(reqList)) {
        const tierMap = {
          'TEAM_LEAD': 'Team Lead',
          'DEPT_MANAGER': 'Department Manager',
          'MANAGER': 'Manager',
          'HR_ADMIN': 'HR Admin',
          'SUPER_ADMIN': 'Super Admin'
        }

        const formatted = reqList.map((r) => {
          const empFullName = r.employee
            ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim()
            : (r.employeeName || 'Staff Member')
          const empCode = r.employee?.employeeCode || r.employeeId || 'EMP'
          const deptName = r.employee?.department?.name || r.department || ''
          const desigTitle = r.employee?.designation?.title || r.designation || ''

          const typeName = r.leaveType?.name || r.leaveType || 'Ops Leave'
          const typeCode = r.leaveType?.code || r.leaveTypeCode || (typeName ? typeName.slice(0, 3).toUpperCase() : 'LV')
          const isPaid = r.leaveType?.isPaid !== undefined ? Boolean(r.leaveType.isPaid) : true
          const paidTreatment = isPaid ? 'Paid' : 'Unpaid'

          const duration = Number(r.durationDays || r.totalDays || 1)
          const approverTier = tierMap[r.routingTier] || r.routingTier || 'Team Lead'

          const appliedIso = r.appliedAt
            ? new Date(r.appliedAt).toISOString().replace('T', ' ').slice(0, 19)
            : (r.createdAt ? new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19) : '')

          const startDateStr = r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : ''
          const endDateStr = r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : ''

          let history = []
          if (Array.isArray(r.approvalHistory) && r.approvalHistory.length > 0) {
            history = r.approvalHistory
          } else {
            history = [
              {
                status: 'Submitted',
                actor: `${empFullName} (${empCode})`,
                timestamp: appliedIso || 'Recorded at submission',
                note: `Applied for ${duration} ${duration === 1 ? 'day' : 'days'} of ${typeName}${r.reason ? `: "${r.reason}"` : ''}`
              }
            ]

            if (r.status === 'PENDING') {
              history.push({
                status: `Pending ${approverTier} Review`,
                actor: `${approverTier} Authority`,
                timestamp: 'In Progress',
                note: `Awaiting review as per delegation matrix.`
              })
            } else if (r.status === 'APPROVED') {
              history.push({
                status: 'Approved',
                actor: r.approvedByRole || r.reviewedByName || 'Authorized Approver',
                timestamp: r.approvedAt ? new Date(r.approvedAt).toISOString().replace('T', ' ').slice(0, 19) : 'Completed',
                note: r.decisionRemarks || 'Leave application approved.'
              })
            } else if (r.status === 'REJECTED') {
              history.push({
                status: 'Rejected',
                actor: r.approvedByRole || r.reviewedByName || 'Authorized Approver',
                timestamp: r.approvedAt ? new Date(r.approvedAt).toISOString().replace('T', ' ').slice(0, 19) : 'Completed',
                note: r.decisionRemarks || 'Leave application rejected.'
              })
            }
          }

          const statusDisplay = r.status === 'PENDING'
            ? `Pending ${approverTier} Review`
            : r.status === 'APPROVED'
              ? 'Approved'
              : r.status === 'REJECTED'
                ? 'Rejected'
                : r.status

          return {
            id: r.requestCode || r.id,
            cuid: r.id,
            requestCode: r.requestCode || r.id,
            employeeId: empCode,
            employeeCode: empCode,
            employeeName: empFullName,
            department: deptName,
            departmentName: deptName,
            designation: desigTitle,
            leaveType: typeName,
            leaveTypeName: typeName,
            category: typeName,
            leaveCategory: typeName,
            leaveTypeId: r.leaveTypeId,
            leaveTypeCode: typeCode,
            isPaid,
            paidTreatment,
            startDate: startDateStr,
            endDate: endDateStr,
            totalDays: duration,
            calculatedDays: duration,
            eligibleWorkingDays: duration,
            durationDays: duration,
            isHalfDay: Boolean(r.isHalfDay),
            halfDayType: r.halfDayType === 'FIRST_HALF' ? 'first_half' : (r.halfDayType === 'SECOND_HALF' ? 'second_half' : (r.halfDayType || 'full_day')),
            reason: r.reason || '',
            status: statusDisplay,
            backendStatus: r.status,
            routingTier: r.routingTier || 'TEAM_LEAD',
            currentApproverRole: approverTier,
            currentApproverTier: approverTier,
            currentApproverName: r.assignedApproverName || r.approverName || null,
            appliedDate: r.appliedAt ? new Date(r.appliedAt).toISOString().slice(0, 10) : (startDateStr || ''),
            submittedDate: r.appliedAt ? new Date(r.appliedAt).toISOString().slice(0, 10) : '',
            appliedAt: appliedIso,
            submittedAt: appliedIso,
            approvalHistory: history
          }
        })
        leaveService.memoryStorage['isysware_hrms_f05_leave_requests_v1'] = formatted
      }
    }

    if (entitlementsRes.status === 'fulfilled') {
      const rawEntitlements = Array.isArray(entitlementsRes.value) ? entitlementsRes.value : (entitlementsRes.value?.data || [])
      if (Array.isArray(rawEntitlements) && rawEntitlements.length > 0) {
        leaveBalanceService.setEntitlementsFromBackend(rawEntitlements)
      }
    }

    leaveService._notify()
    leaveBalanceService._notify()
  } catch (err) {
    console.warn('[BackendSync] Leaves sync non-fatal error:', err)
  }
}

/**
 * 4. Synchronize Payroll Runs & Salary Structures
 */
export async function syncPayroll() {
  try {
    const [runsRes, structsRes, loansRes, allowancesRes, empAllowancesRes, payslipsRes, revisionsRes] = await Promise.allSettled([
      apiClient.get('/payroll/runs'),
      apiClient.get('/payroll/structures'),
      apiClient.get('/payroll/loans'),
      apiClient.get('/payroll/allowances'),
      apiClient.get('/payroll/employee-allowances'),
      apiClient.get('/payroll/payslips'),
      apiClient.get('/payroll/revisions')
    ])

    const unwrapArray = (val) => (Array.isArray(val) ? val : (Array.isArray(val?.data) ? val.data : null))

    const rawRuns = runsRes.status === 'fulfilled' ? unwrapArray(runsRes.value) : null
    if (Array.isArray(rawRuns)) {
      const mappedRuns = rawRuns.map((r) => {
        const rawEntries = Array.isArray(r.entries)
          ? r.entries
          : Array.isArray(r.employeeBreakdown)
            ? r.employeeBreakdown
            : []

        const employeeBreakdown = rawEntries.map((entry) => {
          const emp = entry.employee || {}
          const localEmployee = employeeService
            .getEmployees()
            .find((e) =>
              e.cuid === entry.employeeId ||
              e.id === entry.employeeId ||
              e.employeeCode === emp.employeeCode
            )

          const basicSalary = Number(
            entry.basicSalary ??
            entry.baseSalary ??
            entry.basicPay ??
            0
          )

          const houseRentAllowance = Number(entry.houseRentAllowance || 0)
          const medicalAllowance = Number(entry.medicalAllowance || 0)
          const conveyanceAllowance = Number(entry.conveyanceAllowance || 0)
          const specialAllowance = Number(entry.specialAllowance || 0)
          const itemizedAllowances =
            houseRentAllowance +
            medicalAllowance +
            conveyanceAllowance +
            specialAllowance

          const allowancesList = []
          if (houseRentAllowance > 0) allowancesList.push({ name: 'House Rent Allowance', type: 'HRA', amount: houseRentAllowance })
          if (medicalAllowance > 0) allowancesList.push({ name: 'Medical Allowance', type: 'MEDICAL', amount: medicalAllowance })
          if (conveyanceAllowance > 0) allowancesList.push({ name: 'Conveyance Allowance', type: 'CONVEYANCE', amount: conveyanceAllowance })
          if (specialAllowance > 0) allowancesList.push({ name: 'Special Allowance', type: 'SPECIAL', amount: specialAllowance })

          const allowancesTotal = Number(
            entry.allowancesTotal ??
            entry.totalAllowances ??
            itemizedAllowances
          )

          const commission = Number(entry.commissionAmount ?? entry.commission ?? 0)
          const bonusAmount = Number(entry.bonusAmount ?? entry.bonus ?? 0)
          const overtimePay = Number(entry.overtimeAmount ?? entry.overtimePay ?? 0)
          const overtimeHours = Number(entry.overtimeHours ?? 0)

          const grossSalary = Number(
            entry.grossEarnings ??
            entry.grossSalary ??
            entry.grossPay ??
            (basicSalary + allowancesTotal + commission + bonusAmount + overtimePay)
          )

          const salaryTaxWithheld = Number(
            entry.taxDeduction ??
            entry.salaryTaxWithheld ??
            entry.taxAmount ??
            0
          )

          const unpaidAbsenceDeduction = Number(entry.unpaidAbsenceDeduction ?? 0)
          const otherDeductions =
            Number(entry.otherDeductions ?? 0) +
            Number(entry.eobiDeduction ?? 0) +
            Number(entry.providentFundDeduction ?? 0)
          const unpaidLeaveDeduction = Number(
            entry.unpaidLeaveDeduction ??
            (unpaidAbsenceDeduction + otherDeductions)
          )

          const loanDeduction = Number(entry.loanDeduction ?? 0)

          const totalDeductions = Number(
            entry.totalDeductions ??
            (salaryTaxWithheld + unpaidLeaveDeduction + loanDeduction)
          )

          const netPayable = Number(
            entry.netSalary ??
            entry.netPayable ??
            entry.netPay ??
            Math.max(0, grossSalary - totalDeductions)
          )

          const employmentStatus =
            emp.employmentStatus ||
            localEmployee?.employmentStatus ||
            'UNKNOWN'

          return {
            entryId: entry.id,
            employeeCuid: entry.employeeId || emp.id || localEmployee?.cuid || null,
            employeeId:
              emp.employeeCode ||
              localEmployee?.employeeCode ||
              entry.employeeCode ||
              entry.employeeId,
            employeeCode: emp.employeeCode || localEmployee?.employeeCode || null,
            employeeName:
              entry.employeeName ||
              [emp.firstName, emp.lastName].filter(Boolean).join(' ') ||
              localEmployee?.name ||
              'Unknown Employee',
            employmentStatus,
            department:
              emp.department?.name ||
              localEmployee?.department ||
              entry.department ||
              '',
            designation:
              emp.designation?.title ||
              localEmployee?.designation ||
              entry.designation ||
              '',
            calendarDays: entry.calendarDays ?? 31,
            payableDays: Number(entry.payableDays ?? entry.calendarDays ?? 31),
            unpaidLeaveDays: Number(entry.unpaidLeaveDays ?? 0),
            basicSalary,
            houseRentAllowance,
            medicalAllowance,
            conveyanceAllowance,
            specialAllowance,
            allowancesTotal,
            allowancesList,
            commission,
            bonusAmount,
            overtimeHours,
            overtimePay,
            grossSalary,
            salaryTaxWithheld,
            unpaidAbsenceDeduction,
            otherDeductions,
            unpaidLeaveDeduction,
            loanDeduction,
            totalDeductions,
            netPayable,
            bankName: (r.status === 'DISBURSED' || r.status === 'APPROVED')
              ? (entry.bankName || emp.bankName || localEmployee?.bankName || null)
              : (emp.bankName || entry.bankName || localEmployee?.bankName || null),
            bankAccountTitle: (r.status === 'DISBURSED' || r.status === 'APPROVED')
              ? (entry.bankAccountTitle || emp.bankAccountTitle || localEmployee?.accountTitle || null)
              : (emp.bankAccountTitle || entry.bankAccountTitle || localEmployee?.accountTitle || null),
            bankAccountNumber: (r.status === 'DISBURSED' || r.status === 'APPROVED')
              ? (entry.bankAccountNumber || emp.bankAccountNumber || localEmployee?.accountNumber || null)
              : (emp.bankAccountNumber || entry.bankAccountNumber || localEmployee?.accountNumber || null),
            bankIban: (r.status === 'DISBURSED' || r.status === 'APPROVED')
              ? (entry.bankIban || emp.bankIban || localEmployee?.iban || null)
              : (emp.bankIban || entry.bankIban || localEmployee?.iban || null),
            paymentStatus: entry.paymentStatus || 'UNPAID',
            transactionReference: entry.transactionReference || null
          }
        })

        const period =
          r.payrollPeriod?.periodCode ||
          r.period ||
          r.runNumber

        const grossPayroll = Number(r.totalGross ?? r.grossPayroll ?? 0)
        const netPayable = Number(r.totalNet ?? r.netPayable ?? 0)
        const recordedDeductions = Number(r.totalDeductions ?? 0)

        const entriesGross = employeeBreakdown.reduce((sum, e) => sum + e.grossSalary, 0)
        const entriesNet = employeeBreakdown.reduce((sum, e) => sum + e.netPayable, 0)
        const entriesTax = employeeBreakdown.reduce((sum, e) => sum + e.salaryTaxWithheld, 0)
        const entriesLoan = employeeBreakdown.reduce((sum, e) => sum + e.loanDeduction, 0)
        const entriesDeductions = employeeBreakdown.reduce((sum, e) => sum + e.totalDeductions, 0)

        const recordedTotalEmployees = r.totalEmployees != null ? Number(r.totalEmployees) : employeeBreakdown.length
        const entryCount = employeeBreakdown.length
        const inactiveEmployees = employeeBreakdown.filter(
          (e) => e.employmentStatus && e.employmentStatus !== 'ACTIVE' && e.employmentStatus !== 'UNKNOWN'
        )
        const headcountMatches = recordedTotalEmployees === entryCount
        const totalsMatch =
          Math.abs(entriesGross - grossPayroll) < 0.01 &&
          Math.abs(entriesNet - netPayable) < 0.01 &&
          (r.totalDeductions == null || Math.abs(entriesDeductions - recordedDeductions) < 0.01)

        const serverIssues = Array.isArray(r.reconciliationIssues) ? r.reconciliationIssues : []
        const reconciliationIssues = [...serverIssues]
        if (entryCount === 0 && !reconciliationIssues.some((i) => i.includes('entries'))) {
          reconciliationIssues.push('No employee payroll entries found.')
        }
        if (!headcountMatches && !reconciliationIssues.some((i) => i.includes('Headcount'))) {
          reconciliationIssues.push(`Headcount mismatch (recorded ${recordedTotalEmployees}, entries ${entryCount}).`)
        }
        if (!totalsMatch && !reconciliationIssues.some((i) => i.includes('totals') || i.includes('Totals'))) {
          reconciliationIssues.push('Summary totals do not match employee entries.')
        }
        if (inactiveEmployees.length > 0 && !reconciliationIssues.some((i) => i.includes('non-ACTIVE') || i.includes('ineligible'))) {
          reconciliationIssues.push(
            `Contains non-ACTIVE employee(s): ${inactiveEmployees.map((e) => `${e.employeeName} (${e.employmentStatus})`).join(', ')}.`
          )
        }

        const isReconciled =
          r.isReconciled !== false &&
          !r.hasMissingSalaryStructures &&
          entryCount > 0 &&
          headcountMatches &&
          totalsMatch &&
          inactiveEmployees.length === 0

        return {
          ...r,
          period,
          periodName: r.payrollPeriod
            ? new Date(
              `${r.payrollPeriod.year}-${String(r.payrollPeriod.month).padStart(2, '0')}-01T12:00:00Z`
            ).toLocaleString('en-US', { month: 'long', year: 'numeric' })
            : r.periodName || period,
          grossPayroll,
          netPayable,
          totalTaxWithheld: Number(r.totalTax ?? r.totalTaxWithheld ?? entriesTax),
          totalLoanDeductions: Number(r.totalLoanDeductions ?? entriesLoan),
          totalDeductions: Number(r.totalDeductions ?? entriesDeductions),
          totalEmployees: recordedTotalEmployees,
          entryCount,
          hasInactiveEmployees: inactiveEmployees.length > 0,
          reconciliationIssues,
          employeeBreakdown,
          isReconciled,
          postedAt: r.disbursedAt || r.postedAt || null
        }
      })

      payrollService.memoryStorage['isysware_hrms_f06_payroll_runs_v1'] = mappedRuns
    }

    const rawPayslips = payslipsRes.status === 'fulfilled' ? unwrapArray(payslipsRes.value) : null
    if (Array.isArray(rawPayslips)) {
      const payslipMap = {}
      for (const ps of rawPayslips) {
        const emp = ps.employee || {}
        const periodCode = ps.payrollRun?.payrollPeriod?.periodCode || ps.payrollRun?.runNumber || 'CURRENT'
        const basicSalary = Number(ps.basicSalary ?? 0)
        const houseRentAllowance = Number(ps.houseRentAllowance || 0)
        const medicalAllowance = Number(ps.medicalAllowance || 0)
        const conveyanceAllowance = Number(ps.conveyanceAllowance || 0)
        const specialAllowance = Number(ps.specialAllowance || 0)
        const allowancesTotal = houseRentAllowance + medicalAllowance + conveyanceAllowance + specialAllowance
        const allowancesBreakdown = []
        if (houseRentAllowance > 0) allowancesBreakdown.push({ name: 'House Rent Allowance', type: 'HRA', amount: houseRentAllowance })
        if (medicalAllowance > 0) allowancesBreakdown.push({ name: 'Medical Allowance', type: 'MEDICAL', amount: medicalAllowance })
        if (conveyanceAllowance > 0) allowancesBreakdown.push({ name: 'Conveyance Allowance', type: 'CONVEYANCE', amount: conveyanceAllowance })
        if (specialAllowance > 0) allowancesBreakdown.push({ name: 'Special Allowance', type: 'SPECIAL', amount: specialAllowance })

        const mappedSlip = {
          id: ps.id,
          payrollRunId: ps.payrollRunId,
          employeeCuid: ps.employeeId,
          employeeId: emp.employeeCode || ps.employeeId,
          employeeName: [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
          department: emp.department?.name || '—',
          designation: emp.designation?.title || '—',
          period: periodCode,
          periodName: ps.payrollRun?.payrollPeriod
            ? new Date(`${ps.payrollRun.payrollPeriod.year}-${String(ps.payrollRun.payrollPeriod.month).padStart(2, '0')}-01T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric' })
            : periodCode,
          workingDays: ps.calendarDays ?? 31,
          daysPresent: Number(ps.payableDays ?? ps.calendarDays ?? 31),
          unpaidLeaves: Number(ps.unpaidLeaveDays ?? 0),
          overtimeHours: Number(ps.overtimeHours ?? 0),
          basicSalary,
          allowances: allowancesTotal,
          allowancesTotal,
          allowancesBreakdown,
          commissions: Number(ps.commissionAmount ?? 0),
          bonuses: Number(ps.bonusAmount ?? 0),
          overtimePay: Number(ps.overtimeAmount ?? 0),
          grossSalary: Number(ps.grossEarnings ?? 0),
          incomeTax: Number(ps.taxDeduction ?? 0),
          unpaidLeaveDeduction: Number(ps.unpaidAbsenceDeduction ?? 0),
          loanDeduction: Number(ps.loanDeduction ?? 0),
          otherDeductions: Number(ps.otherDeductions ?? 0),
          totalDeductions: Number(ps.totalDeductions ?? 0),
          netPay: Number(ps.netSalary ?? 0),
          netPayable: Number(ps.netSalary ?? 0),
          paymentStatus: ps.paymentStatus || 'UNPAID',
          bankName: ps.bankName || null,
          accountTitle: ps.bankAccountTitle || null,
          iban: ps.bankIban || null,
          accountNumber: ps.bankAccountNumber || null,
          status: ps.payrollRun?.status || ps.paymentStatus
        }
        payslipMap[`${periodCode}-${ps.id}`] = mappedSlip
      }
      payrollService.memoryStorage['isysware_hrms_f06_payslips_v1'] = payslipMap
    }

    const rawStructs = structsRes.status === 'fulfilled' ? unwrapArray(structsRes.value) : null
    if (Array.isArray(rawStructs)) {
      const normalizedStructs = rawStructs.map(s => ({
        ...s,
        employeeCode: s.employee?.employeeCode || s.employeeCode || s.employeeId,
        employeeName: s.employee ? `${s.employee.firstName || ''} ${s.employee.lastName || ''}`.trim() : (s.employeeName || s.employeeId),
        basicSalary: Number(s.baseSalary ?? s.basicSalary ?? 0),
        grossSalary: Number(s.grossSalary ?? (
          Number(s.baseSalary ?? s.basicSalary ?? 0) +
          (Number(s.houseRentAllowance) || 0) +
          (Number(s.medicalAllowance) || 0) +
          (Number(s.conveyanceAllowance) || 0) +
          (Number(s.specialAllowance) || 0)
        ))
      }))
      payrollService.memoryStorage['isysware_hrms_f06_salary_structures_v1'] = normalizedStructs
      compensationService.memoryStorage['isysware_hrms_f06_salary_structures_v1'] = normalizedStructs
    }

    const rawAllowances = allowancesRes.status === 'fulfilled' ? unwrapArray(allowancesRes.value) : null
    if (Array.isArray(rawAllowances)) {
      compensationService.memoryStorage['isysware_hrms_f06_allowances_master_v1'] = rawAllowances
    }

    const rawEmpAllowances = empAllowancesRes.status === 'fulfilled' ? unwrapArray(empAllowancesRes.value) : null
    if (Array.isArray(rawEmpAllowances)) {
      compensationService.memoryStorage['isysware_hrms_f06_emp_allowances_v1'] = rawEmpAllowances
    }

    if (loansRes.status === 'fulfilled' && Array.isArray(loansRes.value)) {
      const mappedLoans = loansRes.value.map((l) => ({
        id: l.id,
        employeeId: l.employee?.id || l.employeeId,
        employeeCode: l.employee?.employeeCode,
        employeeName: l.employee ? `${l.employee.firstName} ${l.employee.lastName}`.trim() : (l.employeeName || l.employeeId),
        loanType: l.loanType,
        principalAmount: Number(l.principalAmount || 0),
        installmentAmount: Number(l.monthlyDeduction || l.installmentAmount || 0),
        totalInstallments: Number(l.repaymentMonths || l.totalInstallments || 1),
        installmentsPaid: Number(l.paidInstallments || l.installmentsPaid || 0),
        repaidAmount: Number(l.totalRepaid || l.repaidAmount || 0),
        outstandingBalance: Number(l.remainingBalance || l.outstandingBalance || l.principalAmount || 0),
        status: l.status === 'PENDING' ? 'Pending Super Admin Review'
          : l.status === 'APPROVED' ? 'Approved'
            : l.status === 'DISBURSED' ? 'Active'
              : l.status === 'REJECTED' ? 'Rejected'
                : l.status === 'REPAID' ? 'Closed'
                  : l.status === 'DEFAULTED' ? 'Defaulted'
                    : l.status === 'CANCELLED' ? 'Cancelled'
                      : l.status,
        reason: l.remarks || l.reason || '',
        appliedDate: l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : l.appliedDate,
        rawBackend: l
      }))
      payrollService.memoryStorage['isysware_hrms_f06_loans_v1'] = mappedLoans
      loanService.memoryStorage['isysware_hrms_f06_loans_v1'] = mappedLoans
      loanService._notify()
    }

    const rawRevisions = revisionsRes.status === 'fulfilled' ? unwrapArray(revisionsRes.value) : null
    if (Array.isArray(rawRevisions)) {
      const mappedRevisions = rawRevisions.map((rev) => {
        const emp = rev.employee || {}
        const prevBase = Number(rev.previousBaseSalary ?? 0)
        const propBase = Number(rev.proposedBaseSalary ?? 0)
        const prevGross = Number(rev.previousGrossSalary ?? prevBase)
        const propGross = Number(rev.proposedGrossSalary ?? propBase)
        const currSal = prevBase || prevGross
        const propSal = propBase || propGross
        const delta = Math.round(propSal - currSal)
        const pct = currSal > 0 ? Math.round((delta / currSal) * 10000) / 100 : 0
        const isIncrement = delta >= 0

        const statusMap = {
          PENDING: 'Pending Super Admin Review',
          APPROVED: 'Approved',
          REJECTED: 'Rejected',
          RETURNED: 'Returned for Clarification'
        }

        return {
          id: rev.id,
          revisionNumber: rev.revisionNumber,
          employeeId: emp.employeeCode || rev.employeeId,
          employeeCuid: rev.employeeId,
          employeeName: [emp.firstName, emp.lastName].filter(Boolean).join(' ') || rev.employeeId,
          department: emp.department?.name || '—',
          designation: emp.designation?.title || '—',
          currentSalary: currSal,
          proposedSalary: propSal,
          previousBaseSalary: prevBase,
          proposedBaseSalary: propBase,
          previousGrossSalary: prevGross,
          proposedGrossSalary: propGross,
          type: isIncrement ? 'Increment' : 'Decrement',
          deltaAmount: delta,
          percentageChange: pct,
          effectiveDate: rev.effectiveDate ? new Date(rev.effectiveDate).toISOString().slice(0, 10) : '',
          justification: rev.justification || '',
          status: statusMap[rev.status] || rev.status,
          rawStatus: rev.status,
          proposedBy: rev.proposedBy || 'HR Admin',
          proposedDate: rev.proposedAt ? new Date(rev.proposedAt).toISOString().slice(0, 10) : '',
          approvedBy: rev.approvedBy || (rev.approvedById ? 'Super Admin' : null),
          approvedDate: rev.approvedAt ? new Date(rev.approvedAt).toISOString().slice(0, 10) : null,
          rawBackend: rev
        }
      })
      salaryRevisionService.memoryStorage['isysware_hrms_f06_salary_revisions_v1'] = mappedRevisions
      salaryRevisionService._setItem('isysware_hrms_f06_salary_revisions_v1', mappedRevisions)
      salaryRevisionService._notify()
    }

    payrollService._notify()
    compensationService._notify()
    salaryRevisionService._notify()
  } catch (err) {
    console.warn('[BackendSync] Payroll sync non-fatal error:', err)
  }
}

/**
 * 5. Synchronize Expenses & Travel
 */
export async function syncExpenses() {
  try {
    await expenseService.loadExpensesDataAsync()
  } catch (err) {
    console.warn('[BackendSync] Expenses sync non-fatal error:', err)
  }
}

/**
 * 6. Synchronize Recruitment
 */
export async function syncRecruitment() {
  try {
    const [reqsRes, openingsRes, candsRes, offersRes, interviewsRes] = await Promise.allSettled([
      apiClient.get('/recruitment/requisitions'),
      apiClient.get('/recruitment/openings'),
      apiClient.get('/recruitment/candidates'),
      apiClient.get('/recruitment/offers'),
      apiClient.get('/recruitment/interviews')
    ])

    const depts = employeeService.getDepartments()
    const desigs = employeeService.getDesignations()

    if (reqsRes.status === 'fulfilled' && Array.isArray(reqsRes.value)) {
      const statusMap = {
        'DRAFT': 'Draft',
        'PENDING_APPROVAL': 'Pending Approval',
        'APPROVED': 'Approved',
        'REJECTED': 'Rejected',
        'FULFILLED': 'Fulfilled'
      }

      recruitmentService.memoryStorage['isysware_hrms_f03_requisitions_v1'] = reqsRes.value.map((r) => {
        const dept = depts.find((d) => d.id === r.departmentId || d.code === r.departmentId)
        const desig = desigs.find((d) => d.id === r.designationId || d.code === r.designationId)
        return {
          id: r.requisitionNumber || r.id,
          cuid: r.id,
          requisitionNumber: r.requisitionNumber,
          jobTitle: desig?.name || desig?.title || r.justification?.slice(0, 40) || 'Job Requisition',
          departmentId: r.departmentId,
          departmentName: dept?.name || 'Software Development',
          designationId: r.designationId,
          designationName: desig?.name || desig?.title || 'Engineer',
          openPositions: r.openingsCount || 1,
          filledPositions: 0,
          status: statusMap[r.status] || r.status || 'Pending Approval',
          hiringReason: r.justification,
          hiringManagerName: r.requestedBy ? `${r.requestedBy.firstName || ''} ${r.requestedBy.lastName || ''}`.trim() : 'Manager',
          compensationBasis: r.compensationBasis || 'Monthly',
          salaryRange: { min: 150000, max: 220000, currency: 'PKR', period: 'Monthly' },
          priority: r.priority || 'High',
          createdBy: r.requestedById || 'Admin',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19) : '',
          createdDate: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : ''
        }
      })
    }

    if (openingsRes.status === 'fulfilled' && Array.isArray(openingsRes.value)) {
      const statusMap = {
        'OPEN': 'Open',
        'ON_HOLD': 'On Hold',
        'CLOSED': 'Closed'
      }
      recruitmentService.memoryStorage['isysware_hrms_f03_vacancies_v1'] = openingsRes.value.map((v) => {
        const dept = depts.find((d) => d.id === v.departmentId || d.code === v.departmentId)
        const parentReq = (reqsRes.status === 'fulfilled' && Array.isArray(reqsRes.value))
          ? reqsRes.value.find((r) => r.id === v.requisitionId || r.requisitionNumber === v.requisitionId)
          : null

        const openPositions = Number(v.requisition?.openingsCount || parentReq?.openingsCount || v.openPositions || 1)
        const filledPositions = Array.isArray(v.applications)
          ? v.applications.filter((a) => a.status === 'HIRED').length
          : Number(v.filledPositions || 0)
        const applicantsCount = Array.isArray(v.applications) ? v.applications.length : Number(v.applicantsCount || 0)

        return {
          id: v.openingCode || v.id,
          cuid: v.id,
          openingCode: v.openingCode,
          requisitionId: v.requisitionId || '',
          title: v.title,
          departmentId: v.departmentId,
          departmentName: dept?.name || 'Software Development',
          status: statusMap[v.status] || v.status || 'Open',
          openPositions,
          filledPositions,
          applicantsCount,
          targetDate: v.closingDate ? new Date(v.closingDate).toISOString().slice(0, 10) : '2026-12-31',
          salaryRange: { min: Number(v.salaryMin) || 150000, max: Number(v.salaryMax) || 220000, currency: 'PKR', period: 'Monthly' },
          postedDate: v.postedAt ? new Date(v.postedAt).toISOString().slice(0, 10) : ''
        }
      })
    }


    if (candsRes.status === 'fulfilled' && Array.isArray(candsRes.value)) {
      recruitmentService.memoryStorage['isysware_hrms_f03_candidates_v1'] =
        candsRes.value.map((c) => {
          const application = c.applications?.[0] || null

          const firstName = String(c.firstName || '').trim()
          const lastName = String(c.lastName || '').trim()
          const fullName = [firstName, lastName]
            .filter((v) => v && v !== '.')
            .join(' ') || 'Unknown Candidate'

          const status = application?.status || 'UNASSIGNED'

          const stageMap = {
            APPLIED: 'Application Received',
            SCREENING: 'Initial Screening',
            SHORTLISTED: 'Shortlisted',
            INTERVIEWING: 'Interview Scheduled',
            OFFERED: 'Offer Stage',
            HIRED: 'Hired',
            REJECTED: 'Rejected',
            WITHDRAWN: 'Withdrawn'
          }

          return {
            id: c.candidateCode || c.id,
            cuid: c.id,
            candidateCode: c.candidateCode,
            firstName,
            lastName,
            fullName,
            name: fullName,
            email: c.email || '',
            phone: c.phone || '',
            city: c.city || '',
            currentCompany: c.currentCompany || '',
            currentDesignation: c.currentDesignation || '',
            currentRole: c.currentDesignation || '',
            experienceYears: Number(c.totalExperienceYears ?? 0),
            experience: `${Number(c.totalExperienceYears ?? 0)} Years`,
            vacancyId: application?.opening?.openingCode || application?.openingId || '',
            vacancyTitle: application?.opening?.title || 'Not Assigned',
            appliedForRole: application?.opening?.title || 'Not Assigned',
            applicationDate: c.createdAt
              ? new Date(c.createdAt).toISOString().slice(0, 10)
              : '',
            appliedDate: c.createdAt
              ? new Date(c.createdAt).toISOString().slice(0, 10)
              : '',
            stage: stageMap[status] || 'Application Received',
            status: ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(status)
              ? status.charAt(0) + status.slice(1).toLowerCase()
              : 'Active',
            applicationId: application?.id || null,
            expectedSalary: c.expectedSalary ?? null,
            noticePeriodDays: c.noticePeriodDays ?? null,
            skills: Array.isArray(c.skills) ? c.skills : [],
            cvResumeRef: c.resumeUrl || null,
            resumeUrl: c.resumeUrl || null,
            source: c.source || 'DIRECT',
            notes: (c.notes || []).map((n) => ({
              id: n.id,
              text: n.content,
              content: n.content,
              author: n.authorName || 'Recruiter',
              authorRole: n.authorRole || 'HR Admin',
              timestamp: n.createdAt ? new Date(n.createdAt).toISOString().replace('T', ' ').slice(0, 19) : '',
              isConfidentialHrOnly: Boolean(n.isConfidential),
              isConfidential: Boolean(n.isConfidential)
            })),
            stageHistory: []
          }
        })
    }


    if (offersRes.status === 'fulfilled' && Array.isArray(offersRes.value)) {
      recruitmentService.memoryStorage['isysware_hrms_f03_offers_v1'] = offersRes.value
    }
    if (interviewsRes.status === 'fulfilled' && Array.isArray(interviewsRes.value)) {
      recruitmentService.memoryStorage['isysware_hrms_f03_interviews_v1'] = interviewsRes.value
    }
    recruitmentService._notify?.()
  } catch (err) {
    console.warn('[BackendSync] Recruitment sync error:', err)
  }
}

/**
 * 7. Synchronize Policies & Company Settings
 */
export async function syncPoliciesAndSettings() {
  try {
    const [companyPoliciesRes, generalPoliciesRes, settingsRes] = await Promise.allSettled([
      apiClient.get('/admin/company-policies'),
      apiClient.get('/admin/policies'),
      apiClient.get('/admin/settings')
    ])

    if (companyPoliciesRes.status === 'fulfilled' && Array.isArray(companyPoliciesRes.value)) {
      policyService.memoryStorage['isysware_hrms_f13_central_policies_v1'] = companyPoliciesRes.value
      policyService._notify()
    }

    if (settingsRes.status === 'fulfilled' && settingsRes.value) {
      companySettingsService.memoryStorage['isysware_hrms_f13_company_profile_v1'] = settingsRes.value
      companySettingsService._notify()
    }
  } catch (err) {
    console.warn('[BackendSync] Policies sync non-fatal error:', err)
  }
}

/**
 * 8. Synchronize Task Management & Deliverables (PostgreSQL-backed)
 */
export async function syncTasks() {
  const requestId = ++latestTaskSyncRequest
  try {
    const res = await apiClient.get('/tasks')
    const rawList = Array.isArray(res) ? res : (res?.data || [])
    if (Array.isArray(rawList)) {
      const priorityMap = {
        LOW: 'Low',
        MEDIUM: 'Medium',
        HIGH: 'High',
        URGENT: 'Urgent'
      }
      const statusMap = {
        TODO: 'To Do',
        IN_PROGRESS: 'In Progress',
        UNDER_REVIEW: 'In Review',
        COMPLETED: 'Completed',
        BLOCKED: 'Blocked',
        CANCELLED: 'Cancelled'
      }

      const activeRawList = rawList.filter((t) => !(
        t?.isDeleted === true ||
        (t?.attachments && typeof t.attachments === 'object' && !Array.isArray(t.attachments) && (
          t.attachments.isDeleted === true || t.attachments.lifecycleState === 'DELETED'
        ))
      ))

      const mapped = activeRawList.map((t) => {
        const empCode = t.assignee?.employeeCode || t.assigneeId
        const localEmp =
          employeeService.getEmployeeById?.(t.assigneeId) ||
          employeeService.getEmployeeById?.(empCode)
        const assigneeName = t.assignee
          ? `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim()
          : (localEmp?.name || empCode || 'Unassigned')

        const delegatorCode = t.assignedBy?.employeeCode || t.assignedById
        const localDelegator =
          employeeService.getEmployeeById?.(t.assignedById) ||
          employeeService.getEmployeeById?.(delegatorCode)
        const delegatorName = t.assignedBy
          ? `${t.assignedBy.firstName || ''} ${t.assignedBy.lastName || ''}`.trim()
          : (localDelegator?.name || 'Tariq Mehmood')

        const attachmentsMeta =
          t.attachments && typeof t.attachments === 'object' && !Array.isArray(t.attachments)
            ? t.attachments
            : {}

        const progress = typeof t.progress === 'number'
          ? t.progress
          : attachmentsMeta.progress !== undefined
            ? Number(attachmentsMeta.progress)
            : (t.status === 'COMPLETED' ? 100 : (t.status === 'IN_PROGRESS' ? 50 : 0))

        return {
          id: t.taskCode || t.id,
          cuid: t.id,
          backendId: t.id,
          taskCode: t.taskCode || t.id,
          title: t.title,
          description: t.description || '',
          departmentId: t.assignee?.departmentId || t.teamId || localEmp?.departmentId || 'DEP-01',
          department: t.assignee?.department?.name || localEmp?.department || 'General',
          assignedToId: empCode,
          assignedToCuid: t.assigneeId,
          assignedToName: assigneeName,
          assignedById: delegatorCode || 'EMP-001',
          assignedByCuid: t.assignedById,
          assignedByName: delegatorName,
          priority: priorityMap[t.priority] || t.priority || 'Medium',
          status: statusMap[t.status] || t.status || 'To Do',
          progress,
          submittedForReviewAt: attachmentsMeta.submittedForReviewAt || null,
          verifiedByName: attachmentsMeta.verifiedByName || null,
          verifiedAt: attachmentsMeta.verifiedAt || null,
          verificationRemarks: attachmentsMeta.verificationRemarks || '',
          estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : 8,
          loggedHours: t.actualHours ? Number(t.actualHours) : 0,
          startDate: t.createdAt ? String(t.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
          dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : null,
          completionDate: t.completedAt ? String(t.completedAt).slice(0, 10) : null,
          projectRef: t.projectRef || 'GENERAL',
          isOverdue: Boolean(t.isOverdue),
          comments: Array.isArray(t.comments) ? t.comments.map((c) => ({
            id: c.id || `CMT-${Date.now()}`,
            author: c.authorName || c.author || 'User',
            date: c.date || (c.createdAt ? String(c.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
            text: c.text || c.commentText || ''
          })) : []
        }
      })
      // Prevent older API responses from overwriting newer task data
      if (requestId !== latestTaskSyncRequest) return
      taskService.memoryStorage['isysware_hrms_f07_tasks_v1'] = mapped
      taskService._notify?.()
    }
  } catch (err) {
    console.warn('[BackendSync] Tasks sync non-fatal error:', err?.message || err)
  }
}

/**
 * 9. Synchronize Goals, Targets & Department KPIs (PostgreSQL-backed)
 */
export async function syncKpis() {
  try {
    const res = await apiClient.get('/performance/kpis')
    const rawList = Array.isArray(res) ? res : (res?.data || [])
    if (Array.isArray(rawList)) {
      kpiService.memoryStorage['isysware_hrms_f07_kpis_v1'] = rawList
      kpiService._notify?.()
    }
  } catch (err) {
    console.warn('[BackendSync] KPIs sync non-fatal error:', err?.message || err)
  }
}

/**
 * 10. Synchronize Performance Appraisal Cycles & Reviews (PostgreSQL-backed)
 */
export async function syncPerformance() {
  try {
    await performanceService.loadPerformanceDataAsync?.(true)
  } catch (err) {
    console.warn('[BackendSync] Performance sync non-fatal error:', err?.message || err)
  }
}

/**
 * Master Sync All Modules
 * Call when an authenticated session is established in the browser.
 */

export async function syncTraining() {
  try {
    await trainingService.loadTrainingDataAsync()
  } catch (err) {
    console.error(
      '[BackendSync] Training synchronization failed:',
      err
    )
  }
}

export async function syncHelpDesk() {
  try {
    await helpDeskService.loadHelpDeskDataAsync()
  } catch (err) {
    console.warn(
      '[BackendSync] Help Desk synchronization warning:',
      err?.message || err
    )
  }
}

export async function syncHrLetters() {
  try {
    await hrLettersService.loadLettersDataAsync()
  } catch (err) {
    console.warn(
      '[BackendSync] HR Letters synchronization warning:',
      err?.message || err
    )
  }
}

export async function syncAllModules() {
  if (typeof window === 'undefined') return
  if (isSyncing) return

  try {
    isSyncing = true
    await Promise.allSettled([
      syncOrganization(),
      syncAttendanceAndShifts(),
      syncLeaves(),
      syncPayroll(),
      syncExpenses(),
      syncRecruitment(),
      syncPoliciesAndSettings(),
      syncTasks(),
      syncKpis(),
      syncPerformance(),
      syncTraining(),
      syncHelpDesk(),
      syncHrLetters()])
    const assignmentResponse = await apiClient.get('/shifts/assignments')

    const assignments = Array.isArray(assignmentResponse)
      ? assignmentResponse
      : assignmentResponse?.data || []

    if (Array.isArray(assignments)) {
      shiftService.memoryStorage['isysware_hrms_f04_shift_assignments_v1'] =
        assignments.map(a => ({
          id: a.id,
          cuid: a.id,
          employeeId: a.employee?.employeeCode || a.employeeId,
          employeeName: a.employeeName,
          shiftId: a.shift?.shiftCode || a.shiftId,
          shiftName: a.shiftName,
          effectiveFrom: a.effectiveFrom?.slice(0, 10),
          effectiveTo: a.effectiveUntil?.slice(0, 10) || null,
          status: a.status,
          assignedBy: a.assignedById
        }))

      shiftService._notify()
    }

    // Only clear operational state when an explicit operational purge flag is active AND database has 0 records.
    // NEVER wipe out recruitment, tasks, or employee data if PostgreSQL actually returned live records!
    if (dataPurgeService.isOperationalDataCleared()) {
      const hasLiveVacancies = (recruitmentService?.memoryStorage?.['isysware_hrms_f03_vacancies_v1']?.length || 0) > 0
      const hasLiveCandidates = (recruitmentService?.memoryStorage?.['isysware_hrms_f03_candidates_v1']?.length || 0) > 0

      if (hasLiveVacancies || hasLiveCandidates) {
        // Active database records exist in PostgreSQL; clear the stale purge flag
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('isysware_operational_data_cleared')
          }
        } catch { /* ignore */ }
      } else {
        if (recruitmentService?.memoryStorage) {
          recruitmentService.memoryStorage['isysware_hrms_f03_requisitions_v1'] = []
          recruitmentService.memoryStorage['isysware_hrms_f03_vacancies_v1'] = []
          recruitmentService.memoryStorage['isysware_hrms_f03_candidates_v1'] = []
          recruitmentService.memoryStorage['isysware_hrms_f03_interviews_v1'] = []
          recruitmentService.memoryStorage['isysware_hrms_f03_offers_v1'] = []
          recruitmentService.memoryStorage['isysware_hrms_f03_probation_v1'] = []
          recruitmentService._notify?.()
        }
      }
      if (taskService?.memoryStorage) {
        taskService.memoryStorage['isysware_hrms_f07_tasks_v1'] = []
        taskService._notify?.()
      }
      if (trainingService?.memoryStorage) {
        trainingService.memoryStorage['isysware_hrms_f08_training_programs_v1'] = []
        trainingService.memoryStorage['isysware_hrms_f08_training_sessions_v1'] = []
        trainingService.memoryStorage['isysware_hrms_f08_training_enrollments_v1'] = []
        trainingService.memoryStorage['isysware_hrms_f08_training_certificates_v1'] = []
        trainingService._notify?.()
      }
      if (helpDeskService?.memoryStorage) {
        helpDeskService.memoryStorage['isysware_hrms_f09_helpdesk_tickets_v1'] = []
        helpDeskService._notify?.()
      }
      if (travelService?.memoryStorage) {
        travelService.memoryStorage['isysware_hrms_f10_travel_requests_v1'] = []
        travelService.memoryStorage['isysware_hrms_f10_travel_expenses_v1'] = []
        travelService.memoryStorage['isysware_hrms_f10_transport_passes_v1'] = []
        travelService._notify?.()
      }
      if (hrLettersService?.memoryStorage) {
        hrLettersService.memoryStorage['isysware_hrms_f11_templates_v1'] = []
        hrLettersService.memoryStorage['isysware_hrms_f11_letters_v1'] = []
        hrLettersService.memoryStorage['isysware_hrms_f11_issued_letters_v1'] = []
        hrLettersService.memoryStorage['isysware_hrms_f11_audit_logs_v1'] = []
        hrLettersService._notify?.()
      }

      if (expenseService?.memoryStorage) {
        expenseService.memoryStorage['isysware_hrms_f12_expense_categories_v1'] = []
        expenseService.memoryStorage['isysware_hrms_f12_authority_limits_v1'] = { managerMaxLimit: 0, hrAdminMaxLimit: 0, superAdminThreshold: 0 }
        expenseService.memoryStorage['isysware_hrms_f12_expense_claims_v1'] = []
        expenseService.memoryStorage['isysware_hrms_f12_expense_audits_v1'] = []
        expenseService.memoryStorage['isysware_hrms_f12_travel_requests_v1'] = []
        expenseService.memoryStorage['isysware_hrms_f12_travel_reconciliations_v1'] = []
        expenseService._notify?.()
      }
    }

    lastSyncTimestamp = Date.now()
  } finally {
    isSyncing = false
  }
}

export default {
  syncAllModules,
  syncOrganization,
  syncAttendanceAndShifts,
  syncLeaves,
  syncPayroll,
  syncExpenses,
  syncRecruitment,
  syncPoliciesAndSettings,
  syncTasks,
  syncKpis,
  syncPerformance
}

