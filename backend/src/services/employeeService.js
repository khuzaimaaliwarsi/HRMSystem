/**
 * iSysware HRMS — Employee Management Service
 * Full CRUD, career movements, role-based sensitive data masking,
 * anti-circular reporting, and audit history tracking.
 */

import { prisma } from '../config/database.js'
import organizationService from './organizationService.js'
import { hashPassword } from '../utils/crypto.js'

/**
 * Strips confidential financial and identification data for unauthorized viewers.
 */
function sanitizeEmployeeSensitiveData(emp, requesterUser) {
  if (!emp) return null

  // Super Admin and HR Admin have full visibility
  if (['SUPER_ADMIN', 'HR_ADMIN'].includes(requesterUser?.role)) {
    return emp
  }

  // Employee viewing own record has access to own bank/tax info
  if (requesterUser?.employeeId && requesterUser.employeeId === emp.id) {
    return emp
  }

  // Otherwise (Department Manager, Team Lead, Coworkers), mask sensitive fields
  const copy = { ...emp }
  copy.bankName = copy.bankName ? '***' : null
  copy.bankAccountTitle = copy.bankAccountTitle ? '***' : null
  copy.bankAccountNumber = copy.bankAccountNumber ? '•••• •••• ••••' : null
  copy.bankIban = copy.bankIban ? '•••• •••• ••••' : null
  copy.taxNtnNumber = copy.taxNtnNumber ? '•••••••-•' : null
  copy.cnic = copy.cnic ? '•••••-•••••••-•' : null

  return copy
}

export const employeeService = {
  /**
   * Lists employees with filtering, searching, pagination and organizational scoping.
   */
  async getEmployees(filters = {}, requesterUser = null) {
    const {
      search,
      departmentId,
      teamId,
      status = 'ACTIVE',
      employmentType,
      workArrangement,
      page = 1,
      limit = 50
    } = filters

    const where = {}

    // Status filter
    if (status && status !== 'ALL') {
      where.employmentStatus = status
    }

    if (employmentType) where.employmentType = employmentType
    if (workArrangement) where.workArrangement = workArrangement

    // Role-based scoping
    if (requesterUser?.role === 'DEPT_MANAGER') {
      // Scoped to manager's department
      if (requesterUser.employee?.departmentId) {
        where.departmentId = requesterUser.employee.departmentId
      }
    } else if (requesterUser?.role === 'TEAM_LEAD') {
      // Scoped to lead's assigned teams
      const assignments = await prisma.teamAssignment.findMany({
        where: { employeeId: requesterUser.employeeId }
      })
      const teamIds = assignments.map((a) => a.teamId)
      if (requesterUser.employee?.teamId) {
        teamIds.push(requesterUser.employee.teamId)
      }
      where.teamId = { in: teamIds }
    } else {
      // Explicit filters for HR/Admin and Super Admin
      if (departmentId) where.departmentId = departmentId
      if (teamId) where.teamId = teamId
    }

    // Search query
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)
    const take = parseInt(limit, 10)

    const [total, rawEmployees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take,
        orderBy: { employeeCode: 'asc' },
        include: {
          department: { select: { id: true, code: true, name: true } },
          subDepartment: { select: { id: true, code: true, name: true } },
          team: { select: { id: true, code: true, name: true } },
          designation: { select: { id: true, code: true, title: true, level: true } },
          reportingManager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          userAccount: { select: { id: true, username: true, role: true, isActive: true } }
        }
      })
    ])

    const employees = rawEmployees.map((e) => sanitizeEmployeeSensitiveData(e, requesterUser))

    return {
      employees,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take)
      }
    }
  },

  /**
   * Retrieves single employee profile with full relations and sensitive data masking.
   */
  async getEmployeeById(id, requesterUser = null) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        subDepartment: { select: { id: true, code: true, name: true } },
        team: { select: { id: true, code: true, name: true } },
        designation: { select: { id: true, code: true, title: true, level: true } },
        reportingManager: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true } },
        subordinates: { select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true } },
        teamAssignments: {
          include: {
            team: { select: { id: true, code: true, name: true } }
          }
        },
        userAccount: { select: { id: true, username: true, role: true, isActive: true, lastLoginAt: true } },
        documents: {
          select: { id: true, documentType: true, fileName: true, fileUrl: true, isVerified: true, createdAt: true }
        }
      }
    })

    if (!employee) {
      const error = new Error(`Employee with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    return sanitizeEmployeeSensitiveData(employee, requesterUser)
  },

  /**
   * Creates a new canonical employee record.
   */
  async createEmployee(data, actorUserId = null) {
    const {
      employeeCode,
      firstName,
      lastName,
      email,
      phone,
      cnic,
      dateOfBirth,
      gender,
      maritalStatus,
      bloodGroup,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      employmentType = 'PERMANENT',
      employmentStatus = 'ACTIVE',
      workArrangement = 'OFFICE',
      payBasis = 'MONTHLY',
      joiningDate,
      departmentId,
      subDepartmentId,
      teamId,
      designationId,
      reportingManagerId,
      bankName,
      bankAccountTitle,
      bankAccountNumber,
      bankIban,
      taxNtnNumber,
      // Optional portal account creation
      createPortalAccount = false,
      portalUsername,
      portalPassword,
      portalRole = 'EMPLOYEE'
    } = data

    let fName = firstName ? firstName.trim() : ''
    let lName = lastName ? lastName.trim() : ''
    if (!fName && data.name) {
      const parts = data.name.trim().split(/\s+/)
      fName = parts[0]
      lName = parts.slice(1).join(' ') || '.'
    }

    let code = employeeCode ? employeeCode.trim().toUpperCase() : null
    if (!code) {
      const allEmps = await prisma.employee.findMany({ select: { employeeCode: true } })
      let maxNum = 0
      for (const e of allEmps) {
        const m = e.employeeCode?.match(/^EMP-(\d+)$/i)
        if (m) {
          const num = parseInt(m[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
      code = `EMP-${String(maxNum + 1).padStart(3, '0')}`
    }

    const jDate = joiningDate || data.joinDate || new Date().toISOString().slice(0, 10)

    // Required fields validation
    if (!code || !fName || !lName || !email || !departmentId || !designationId || !jDate) {
      const error = new Error('Employee code, first name, last name, email, department, designation, and joining date are required.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    // Check duplicate employeeCode
    const existingCode = await prisma.employee.findUnique({
      where: { employeeCode: code }
    })
    if (existingCode) {
      const error = new Error(`Employee with code '${code}' already exists.`)
      error.code = 'DUPLICATE_EMPLOYEE_CODE'
      error.status = 409
      throw error
    }

    // Check duplicate email
    const existingEmail = await prisma.employee.findUnique({
      where: { email: email.trim().toLowerCase() }
    })
    if (existingEmail) {
      const error = new Error(`Employee with email '${email}' already exists.`)
      error.code = 'DUPLICATE_EMAIL'
      error.status = 409
      throw error
    }

    // Check CNIC duplicate if provided
    if (cnic) {
      const existingCnic = await prisma.employee.findUnique({
        where: { cnic: cnic.trim() }
      })
      if (existingCnic) {
        const error = new Error(`Employee with CNIC '${cnic}' already exists.`)
        error.code = 'DUPLICATE_CNIC'
        error.status = 409
        throw error
      }
    }

    // Validate and resolve Foreign Keys (supporting CUID or Code)
    const [dept, desig] = await Promise.all([
      prisma.department.findFirst({
        where: { OR: [{ id: departmentId }, { code: departmentId }] }
      }),
      prisma.designation.findFirst({
        where: { OR: [{ id: designationId }, { code: designationId }] }
      })
    ])

    if (!dept) {
      const error = new Error(`Department with ID '${departmentId}' not found.`)
      error.code = 'INVALID_DEPARTMENT'
      error.status = 400
      throw error
    }
    if (!desig) {
      const error = new Error(`Designation with ID '${designationId}' not found.`)
      error.code = 'INVALID_DESIGNATION'
      error.status = 400
      throw error
    }

    let resolvedSubDeptId = null
    if (subDepartmentId) {
      const subDept = await prisma.subDepartment.findFirst({
        where: { OR: [{ id: subDepartmentId }, { code: subDepartmentId }] }
      })
      if (subDept) resolvedSubDeptId = subDept.id
    }

    let resolvedTeamId = null
    if (teamId) {
      const t = await prisma.team.findFirst({
        where: { OR: [{ id: teamId }, { code: teamId }] }
      })
      if (t) resolvedTeamId = t.id
    }

    let resolvedManagerId = null
    if (reportingManagerId) {
      const mgr = await prisma.employee.findFirst({
        where: { OR: [{ id: reportingManagerId }, { employeeCode: reportingManagerId }] }
      })
      if (mgr) resolvedManagerId = mgr.id
    }

    // Anti-circular reporting check
    if (resolvedManagerId) {
      await organizationService.validateReportingHierarchy(null, resolvedManagerId)
    }

    const normEmploymentType = (t) => {
      const s = String(t || '').toUpperCase()
      if (s.includes('CONTRACT')) return 'CONTRACT'
      if (s.includes('PROBATION')) return 'PROBATION'
      if (s.includes('INTERN')) return 'INTERN'
      if (s.includes('FREE')) return 'FREELANCER'
      return 'PERMANENT'
    }

    const normEmploymentStatus = (s) => {
      const str = String(s || '').toUpperCase()
      if (str.includes('INACTIVE') || str.includes('TERM')) return 'TERMINATED'
      if (str.includes('RESIGN')) return 'RESIGNED'
      if (str.includes('SUSPEND')) return 'SUSPENDED'
      if (str.includes('NOTICE')) return 'NOTICE_PERIOD'
      if (str.includes('PROBATION')) return 'PROBATION'
      if (str.includes('RETIRE')) return 'RETIRED'
      return 'ACTIVE'
    }

    const normWorkArrangement = (w) => {
      const s = String(w || '').toUpperCase()
      if (s.includes('REMOTE') || s.includes('WFH')) return 'REMOTE_WFH'
      if (s.includes('HYBRID')) return 'HYBRID'
      if (s.includes('FIELD')) return 'FIELD_DUTY'
      return 'OFFICE'
    }

    const normPayBasis = (p) => {
      const s = String(p || '').toUpperCase()
      if (s.includes('HOUR')) return 'HOURLY'
      if (s.includes('PROJECT') || s.includes('MILE')) return 'PROJECT_MILESTONE'
      return 'MONTHLY'
    }

    // Create Employee record
    const employee = await prisma.employee.create({
      data: {
        employeeCode: code,
        firstName: fName,
        lastName: lName,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        cnic: cnic?.trim() || null,
        dateOfBirth: (dateOfBirth || data.dob) ? new Date(dateOfBirth || data.dob) : null,
        gender: gender || null,
        maritalStatus: maritalStatus || null,
        bloodGroup: bloodGroup || null,
        emergencyContactName: emergencyContactName?.trim() || null,
        emergencyContactPhone: emergencyContactPhone?.trim() || null,
        emergencyContactRelation: emergencyContactRelation?.trim() || null,
        employmentType: normEmploymentType(employmentType),
        employmentStatus: normEmploymentStatus(employmentStatus),
        workArrangement: normWorkArrangement(workArrangement),
        payBasis: normPayBasis(payBasis),
        joiningDate: new Date(jDate),
        departmentId: dept.id,
        subDepartmentId: resolvedSubDeptId,
        teamId: resolvedTeamId,
        designationId: desig.id,
        reportingManagerId: resolvedManagerId,
        bankName: bankName?.trim() || null,
        bankAccountTitle: (bankAccountTitle || data.accountTitle)?.trim() || null,
        bankAccountNumber: (bankAccountNumber || data.accountNumber)?.trim() || null,
        bankIban: (bankIban || data.iban)?.trim() || null,
        taxNtnNumber: taxNtnNumber?.trim() || null
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        designation: { select: { id: true, code: true, title: true } }
      }
    })

    // Optionally create portal user account
    if (createPortalAccount) {
      const username = (portalUsername || employee.employeeCode).toLowerCase()
      const password = portalPassword || 'Welcome123!'
      const passwordHash = await hashPassword(password)

      await prisma.user.create({
        data: {
          employeeId: employee.id,
          username,
          email: employee.email,
          passwordHash,
          role: portalRole || 'EMPLOYEE',
          isActive: true
        }
      }).catch((err) => {
        console.warn('Could not auto-create portal user account:', err.message)
      })
    }

    // Audit log
    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          actorUserId,
          actorRole: 'HR_ADMIN',
          sourceModule: 'EMPLOYEES',
          actionType: 'CREATE',
          entityName: 'Employee',
          entityId: employee.id,
          recordSnapshotAfter: {
            employeeCode: employee.employeeCode,
            name: `${employee.firstName} ${employee.lastName}`,
            departmentId: employee.departmentId
          }
        }
      }).catch(() => {})
    }

    return employee
  },

  /**
   * Updates an existing employee profile.
   */
  async updateEmployee(id, data, actorUserId = null) {
    const existing = await prisma.employee.findFirst({
      where: { OR: [{ id }, { employeeCode: id }] }
    })
    if (!existing) {
      const error = new Error(`Employee with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const realId = existing.id
    const updateData = {}

    // Personal & contact fields
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim()
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim()
    if (data.email !== undefined && data.email.trim()) updateData.email = data.email.trim().toLowerCase()
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null
    if (data.cnic !== undefined) updateData.cnic = data.cnic?.trim() || null
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
    }

    // Emergency Contact
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = data.emergencyContactName?.trim() || null
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone?.trim() || null
    if (data.emergencyContactRelation !== undefined) updateData.emergencyContactRelation = data.emergencyContactRelation?.trim() || null

    // Work arrangement & classification
    if (data.workArrangement !== undefined) {
      const wa = String(data.workArrangement).toUpperCase()
      if (['OFFICE', 'REMOTE_WFH', 'HYBRID', 'FIELD_DUTY'].includes(wa)) {
        updateData.workArrangement = wa
      } else if (wa.includes('REMOTE') || wa.includes('WFH')) {
        updateData.workArrangement = 'REMOTE_WFH'
      } else if (wa.includes('FIELD')) {
        updateData.workArrangement = 'FIELD_DUTY'
      } else if (wa.includes('HYBRID')) {
        updateData.workArrangement = 'HYBRID'
      } else {
        updateData.workArrangement = 'OFFICE'
      }
    }

    if (data.employmentType !== undefined) {
      const et = String(data.employmentType).toUpperCase()
      if (['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'FREELANCER'].includes(et)) {
        updateData.employmentType = et
      } else if (et.includes('CONTRACT')) {
        updateData.employmentType = 'CONTRACT'
      } else if (et.includes('PROBATION')) {
        updateData.employmentType = 'PROBATION'
      } else if (et.includes('INTERN')) {
        updateData.employmentType = 'INTERN'
      } else {
        updateData.employmentType = 'PERMANENT'
      }
    }

    if (data.employmentStatus !== undefined || data.status !== undefined) {
      const rawStatus = data.employmentStatus || data.status
      const st = String(rawStatus).toUpperCase().trim()
      if (st === 'ACTIVE') updateData.employmentStatus = 'ACTIVE'
      else if (st === 'INACTIVE' || st === 'SUSPENDED' || st === 'DEACTIVATED') updateData.employmentStatus = 'SUSPENDED'
      else if (st === 'PROBATION') updateData.employmentStatus = 'PROBATION'
      else if (st === 'NOTICE_PERIOD') updateData.employmentStatus = 'NOTICE_PERIOD'
      else if (st === 'RESIGNED' || st === 'SEPARATED') updateData.employmentStatus = 'RESIGNED'
      else if (st === 'TERMINATED') updateData.employmentStatus = 'TERMINATED'
      else if (st === 'RETIRED') updateData.employmentStatus = 'RETIRED'
      else updateData.employmentStatus = 'ACTIVE'
    }

    // Organizational placement (resolve codes or CUIDs)
    if (data.departmentId !== undefined && data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { OR: [{ id: data.departmentId }, { code: data.departmentId }] }
      })
      if (dept) updateData.departmentId = dept.id
    }

    if (data.designationId !== undefined && data.designationId) {
      const desig = await prisma.designation.findFirst({
        where: { OR: [{ id: data.designationId }, { code: data.designationId }] }
      })
      if (desig) updateData.designationId = desig.id
    }

    if (data.subDepartmentId !== undefined) {
      if (data.subDepartmentId) {
        const sub = await prisma.subDepartment.findFirst({
          where: { OR: [{ id: data.subDepartmentId }, { code: data.subDepartmentId }] }
        })
        updateData.subDepartmentId = sub ? sub.id : null
      } else {
        updateData.subDepartmentId = null
      }
    }

    if (data.teamId !== undefined) {
      if (data.teamId) {
        const team = await prisma.team.findFirst({
          where: { OR: [{ id: data.teamId }, { code: data.teamId }] }
        })
        updateData.teamId = team ? team.id : null
      } else {
        updateData.teamId = null
      }
    }

    // Banking details
    if (data.bankName !== undefined) updateData.bankName = data.bankName?.trim() || null
    if (data.bankAccountTitle !== undefined) updateData.bankAccountTitle = data.bankAccountTitle?.trim() || null
    if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber?.trim() || null
    if (data.bankIban !== undefined) updateData.bankIban = data.bankIban?.trim() || null
    if (data.taxNtnNumber !== undefined) updateData.taxNtnNumber = data.taxNtnNumber?.trim() || null

    // Reporting manager check
    if (data.reportingManagerId !== undefined) {
      if (data.reportingManagerId) {
        const mgr = await prisma.employee.findFirst({
          where: { OR: [{ id: data.reportingManagerId }, { employeeCode: data.reportingManagerId }] }
        })
        const mgrId = mgr ? mgr.id : data.reportingManagerId
        await organizationService.validateReportingHierarchy(realId, mgrId)
        updateData.reportingManagerId = mgrId
      } else {
        updateData.reportingManagerId = null
      }
    }

    const updated = await prisma.employee.update({
      where: { id: realId },
      data: updateData,
      include: {
        department: { select: { id: true, code: true, name: true } },
        team: { select: { id: true, code: true, name: true } },
        designation: { select: { id: true, code: true, title: true } }
      }
    })

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          actorUserId,
          actorRole: 'HR_ADMIN',
          sourceModule: 'EMPLOYEES',
          actionType: 'UPDATE',
          entityName: 'Employee',
          entityId: realId,
          recordSnapshotBefore: { firstName: existing.firstName, lastName: existing.lastName },
          recordSnapshotAfter: { firstName: updated.firstName, lastName: updated.lastName }
        }
      }).catch(() => {})
    }

    return updated
  },

  /**
   * Lateral Transfer: Transfers an employee across department, sub-department, or team.
   * STRICT INVARIANT: Transfer NEVER mutates employee compensation or salary.
   */
  async transferEmployee(id, transferData, actorUserId = null) {
    const { departmentId, subDepartmentId, teamId, reportingManagerId, effectiveDate, remarks } = transferData

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        team: true,
        reportingManager: true
      }
    })

    if (!employee) {
      const error = new Error(`Employee with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    if (!departmentId) {
      const error = new Error('Target department ID is required for employee transfer.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    // Anti-circular reporting check
    if (reportingManagerId) {
      await organizationService.validateReportingHierarchy(id, reportingManagerId)
    }

    const previousValues = {
      departmentId: employee.departmentId,
      departmentName: employee.department?.name,
      teamId: employee.teamId,
      teamName: employee.team?.name,
      reportingManagerId: employee.reportingManagerId
    }

    const newValues = {
      departmentId,
      subDepartmentId: subDepartmentId || null,
      teamId: teamId || null,
      reportingManagerId: reportingManagerId || null
    }

    // Atomic transaction: Update employee + Record career history
    const [updatedEmployee] = await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: newValues,
        include: {
          department: { select: { id: true, code: true, name: true } },
          team: { select: { id: true, code: true, name: true } },
          designation: { select: { id: true, code: true, title: true } }
        }
      }),
      prisma.employeeCareerHistory.create({
        data: {
          employeeId: id,
          changeType: 'DEPARTMENT_TRANSFER',
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
          previousValues,
          newValues,
          approvedById: actorUserId,
          remarks: remarks?.trim() || 'Department/Team lateral transfer executed.'
        }
      })
    ])

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          actorUserId,
          actorRole: 'HR_ADMIN',
          sourceModule: 'EMPLOYEES',
          actionType: 'TRANSFER',
          entityName: 'Employee',
          entityId: id,
          recordSnapshotBefore: previousValues,
          recordSnapshotAfter: newValues,
          reasonOrNotes: remarks
        }
      }).catch(() => {})
    }

    return updatedEmployee
  },

  /**
   * Promotion: Upgrades employee designation.
   * STRICT INVARIANT: Promotion NEVER silently mutates salary.
   */
  async promoteEmployee(id, promotionData, actorUserId = null) {
    const { newDesignationId, effectiveDate, remarks } = promotionData

    if (!newDesignationId) {
      const error = new Error('New designation ID is required for promotion.')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { designation: true }
    })

    if (!employee) {
      const error = new Error(`Employee with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    const newDesig = await prisma.designation.findUnique({ where: { id: newDesignationId } })
    if (!newDesig) {
      const error = new Error(`Designation with ID '${newDesignationId}' not found`)
      error.code = 'INVALID_DESIGNATION'
      error.status = 400
      throw error
    }

    const previousValues = {
      designationId: employee.designationId,
      designationTitle: employee.designation?.title,
      designationLevel: employee.designation?.level
    }

    const newValues = {
      designationId: newDesignationId,
      designationTitle: newDesig.title,
      designationLevel: newDesig.level
    }

    const [promoted] = await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: { designationId: newDesignationId },
        include: {
          department: { select: { id: true, code: true, name: true } },
          designation: { select: { id: true, code: true, title: true, level: true } }
        }
      }),
      prisma.employeeCareerHistory.create({
        data: {
          employeeId: id,
          changeType: 'PROMOTION',
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
          previousValues,
          newValues,
          approvedById: actorUserId,
          remarks: remarks?.trim() || `Promoted to ${newDesig.title}`
        }
      })
    ])

    return promoted
  },

  /**
   * Changes employee employment status (e.g. ACTIVE, NOTICE_PERIOD, RESIGNED, TERMINATED).
   */
  async updateStatus(id, newStatus, reason = null, actorUserId = null) {
    const employee = await prisma.employee.findFirst({
      where: { OR: [{ id }, { employeeCode: id }] }
    })
    if (!employee) {
      const error = new Error(`Employee with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    let normalizedStatus = String(newStatus || 'ACTIVE').toUpperCase().trim()
    if (normalizedStatus === 'INACTIVE' || normalizedStatus === 'DEACTIVATED') {
      normalizedStatus = 'SUSPENDED'
    } else if (normalizedStatus === 'SEPARATED') {
      normalizedStatus = 'RESIGNED'
    }
    const validStatuses = ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED']
    if (!validStatuses.includes(normalizedStatus)) {
      normalizedStatus = 'ACTIVE'
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        employmentStatus: normalizedStatus,
        terminationDate: ['RESIGNED', 'TERMINATED', 'RETIRED'].includes(normalizedStatus) ? new Date() : null
      }
    })

    // If terminated/resigned/suspended, also deactivate user portal login; otherwise activate
    if (['RESIGNED', 'TERMINATED', 'SUSPENDED'].includes(normalizedStatus)) {
      await prisma.user.updateMany({
        where: { employeeId: employee.id },
        data: { isActive: false }
      }).catch(() => {})
    } else if (normalizedStatus === 'ACTIVE') {
      await prisma.user.updateMany({
        where: { employeeId: employee.id },
        data: { isActive: true }
      }).catch(() => {})
    }

    return updated
  },

  /**
   * Fetches full career movement audit history for an employee.
   */
  async getCareerHistory(employeeId) {
    return prisma.employeeCareerHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' }
    })
  },

  // ============================================================================
  // EMPLOYEE DOCUMENTS
  // ============================================================================
  async getDocuments(employeeId) {
    return prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' }
    })
  },

  async addDocument(employeeId, docData, actorUserId = null) {
    const { documentType, fileName, fileUrl, fileSize, mimeType } = docData

    if (!documentType || !fileName || !fileUrl) {
      const error = new Error('Document type, file name, and file URL are required')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    return prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType,
        fileName: fileName.trim(),
        fileUrl: fileUrl.trim(),
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        uploadedById: actorUserId
      }
    })
  },

  async verifyDocument(documentId, actorUserId) {
    return prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        isVerified: true,
        verifiedById: actorUserId,
        verifiedAt: new Date()
      }
    })
  }
}

export default employeeService

