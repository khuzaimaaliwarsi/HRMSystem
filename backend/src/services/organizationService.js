/**
 * iSysware HRMS — Organization Management Service
 * Manages Departments, Sub-Departments, Teams, Designations, Team Assignments,
 * and Organizational Hierarchy validation (including anti-circular reporting guards).
 */

import { prisma } from '../config/database.js'

export function normalizeDesignationLevel(lvl) {
  if (!lvl) return 'MID'
  const str = String(lvl).toUpperCase().trim()
  if (['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'LEAD', 'SENIOR', 'MID', 'JUNIOR', 'INTERN'].includes(str)) {
    return str
  }
  if (str.includes('EXEC')) return 'EXECUTIVE'
  if (str.includes('DIRECT') || str.includes('L5')) return 'DIRECTOR'
  if (str.includes('MANAGE') || str.includes('MGR')) return 'MANAGER'
  if (str.includes('LEAD') || str.includes('L4')) return 'LEAD'
  if (str.includes('SENIOR') || str.includes('SR') || str.includes('L3')) return 'SENIOR'
  if (str.includes('MID') || str.includes('L2')) return 'MID'
  if (str.includes('JUNIOR') || str.includes('JR') || str.includes('L1')) return 'JUNIOR'
  if (str.includes('INTERN')) return 'INTERN'
  return 'MID'
}

export const organizationService = {
  // ============================================================================
  // DEPARTMENTS
  // ============================================================================
  async getDepartments(filters = {}) {
    const { search, status, page = 1, limit = 50 } = filters
    const where = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ]
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)
    const take = parseInt(limit, 10)

    const [total, departments] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: {
          head: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true }
          },
          _count: {
            select: { employees: true, teams: true, subDepartments: true }
          }
        }
      })
    ])

    return {
      departments,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take)
      }
    }
  },

  async getDepartmentById(id) {
    const department = await prisma.department.findFirst({
      where: {
        OR: [
          { id },
          { code: id }
        ]
      },
      include: {
        head: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true }
        },
        subDepartments: {
          include: {
            manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
          }
        },
        teams: {
          include: {
            teamLead: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
          }
        },
        _count: {
          select: { employees: true }
        }
      }
    })

    if (!department) {
      const error = new Error(`Department with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    return department
  },

  async createDepartment(data, actorUserId = null) {
    const { code, name, description, headId, status = 'Active' } = data

    if (!code || !name) {
      const error = new Error('Department code and name are required')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    // Check duplicate code
    const existing = await prisma.department.findUnique({
      where: { code: code.trim().toUpperCase() }
    })
    if (existing) {
      const error = new Error(`Department with code '${code}' already exists`)
      error.code = 'DUPLICATE_CODE'
      error.status = 409
      throw error
    }

    // Verify headId if provided
    if (headId) {
      const head = await prisma.employee.findUnique({ where: { id: headId } })
      if (!head) {
        const error = new Error(`Employee with ID '${headId}' not found for department head`)
        error.code = 'INVALID_FOREIGN_KEY'
        error.status = 400
        throw error
      }
    }

    const department = await prisma.department.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || null,
        headId: headId || null,
        status
      },
      include: {
        head: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          actorUserId,
          actorRole: 'HR_ADMIN',
          sourceModule: 'ORGANIZATION',
          actionType: 'CREATE',
          entityName: 'Department',
          entityId: department.id,
          recordSnapshotAfter: { code: department.code, name: department.name }
        }
      }).catch(() => {})
    }

    return department
  },

  async updateDepartment(id, data, actorUserId = null) {
    const existing = await this.getDepartmentById(id)
    const realId = existing.id

    const updateData = {}
    if (data.code !== undefined && data.code.trim()) {
      const newCode = data.code.trim().toUpperCase()
      if (newCode !== existing.code) {
        const dup = await prisma.department.findUnique({ where: { code: newCode } })
        if (dup && dup.id !== realId) {
          const error = new Error(`Department with code '${newCode}' already exists`)
          error.code = 'DUPLICATE_CODE'
          error.status = 409
          throw error
        }
        updateData.code = newCode
      }
    }
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.status !== undefined) updateData.status = data.status
    if (data.headId !== undefined) {
      if (data.headId) {
        const head = await prisma.employee.findFirst({ where: { OR: [{ id: data.headId }, { employeeCode: data.headId }] } })
        if (!head) {
          const error = new Error(`Employee with ID '${data.headId}' not found`)
          error.code = 'INVALID_FOREIGN_KEY'
          error.status = 400
          throw error
        }
        updateData.headId = head.id
      } else {
        updateData.headId = null
      }
    }

    const updated = await prisma.department.update({
      where: { id: realId },
      data: updateData,
      include: {
        head: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true }
        }
      }
    })

    return updated
  },

  async deleteDepartment(id, actorUserId = null) {
    const dept = await this.getDepartmentById(id)
    const realId = dept.id

    // Check if department has active employees
    const activeStaffCount = await prisma.employee.count({
      where: { departmentId: realId, employmentStatus: { in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } }
    })

    if (activeStaffCount > 0) {
      const error = new Error(
        `Cannot delete department '${dept.name}'. It contains ${activeStaffCount} active staff member(s). Transfer or reassign staff before deleting.`
      )
      error.code = 'DEPARTMENT_HAS_ACTIVE_STAFF'
      error.status = 400
      throw error
    }

    // Check for child subdepartments and teams
    const [subDeptCount, teamCount] = await Promise.all([
      prisma.subDepartment.count({ where: { departmentId: realId } }),
      prisma.team.count({ where: { departmentId: realId } })
    ])
    if (subDeptCount > 0 || teamCount > 0) {
      const error = new Error(
        `Cannot delete department '${dept.name}'. Please remove its sub-departments (${subDeptCount}) and teams (${teamCount}) first.`
      )
      error.code = 'DEPARTMENT_HAS_CHILDREN'
      error.status = 400
      throw error
    }

    // Hard delete department from database
    try {
      await prisma.department.delete({ where: { id: realId } })
      return { success: true, message: `Department '${dept.name}' deleted successfully.`, id: realId }
    } catch {
      // Fallback only if database foreign keys block hard delete
      const deactivated = await prisma.department.update({
        where: { id: realId },
        data: { status: 'Inactive' }
      })
      return { success: true, message: `Department '${dept.name}' deactivated.`, department: deactivated }
    }
  },

  // ============================================================================
  // SUB-DEPARTMENTS
  // ============================================================================
  async getSubDepartments(filters = {}) {
    const { departmentId, search } = filters
    const where = {}

    if (departmentId) where.departmentId = departmentId
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ]
    }

    return prisma.subDepartment.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        department: { select: { id: true, code: true, name: true } },
        manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        _count: { select: { teams: true, employees: true } }
      }
    })
  },

  async createSubDepartment(data) {
    const { code, name, departmentId, managerId, description, status = 'Active' } = data

    if (!code || !name || !departmentId) {
      const error = new Error('Sub-department code, name, and parent department ID are required')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const existing = await prisma.subDepartment.findUnique({
      where: { code: code.trim().toUpperCase() }
    })
    if (existing) {
      const error = new Error(`Sub-department with code '${code}' already exists`)
      error.code = 'DUPLICATE_CODE'
      error.status = 409
      throw error
    }

    return prisma.subDepartment.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        departmentId,
        managerId: managerId || null,
        description: description?.trim() || null,
        status
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })
  },

  async updateSubDepartment(id, data) {
    const existing = await prisma.subDepartment.findFirst({
      where: { OR: [{ id }, { code: id }] }
    })
    if (!existing) {
      const err = new Error(`Sub-department with ID '${id}' not found`)
      err.status = 404
      throw err
    }
    const updateData = {}
    if (data.code !== undefined && data.code.trim()) {
      const newCode = data.code.trim().toUpperCase()
      if (newCode !== existing.code) {
        const dup = await prisma.subDepartment.findUnique({ where: { code: newCode } })
        if (dup && dup.id !== existing.id) {
          const error = new Error(`Sub-department with code '${newCode}' already exists`)
          error.code = 'DUPLICATE_CODE'
          error.status = 409
          throw error
        }
        updateData.code = newCode
      }
    }
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.status !== undefined) updateData.status = data.status
    if (data.managerId !== undefined) updateData.managerId = data.managerId || null
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId

    return prisma.subDepartment.update({
      where: { id: existing.id },
      data: updateData
    })
  },

  async deleteSubDepartment(id, actorUserId = null) {
    const subDept = await prisma.subDepartment.findFirst({ where: { OR: [{ id }, { code: id }] } })
    if (!subDept) {
      const err = new Error(`Sub-department with ID '${id}' not found`)
      err.status = 404
      throw err
    }
    const realId = subDept.id
    const staffCount = await prisma.employee.count({
      where: { subDepartmentId: realId, employmentStatus: { in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } }
    })
    if (staffCount > 0) {
      const err = new Error(`Cannot delete sub-department '${subDept.name}'. It contains ${staffCount} active employee(s).`)
      err.status = 400
      throw err
    }
    try {
      await prisma.subDepartment.delete({ where: { id: realId } })
    } catch {
      await prisma.subDepartment.update({ where: { id: realId }, data: { status: 'Inactive' } })
    }
    return { success: true, message: `Sub-department '${subDept.name}' deleted.` }
  },

  // ============================================================================
  // TEAMS
  // ============================================================================
  async getTeams(filters = {}) {
    const { departmentId, subDepartmentId, search } = filters
    const where = {}

    if (departmentId) where.departmentId = departmentId
    if (subDepartmentId) where.subDepartmentId = subDepartmentId
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } }
      ]
    }

    return prisma.team.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        department: { select: { id: true, code: true, name: true } },
        subDepartment: { select: { id: true, code: true, name: true } },
        teamLead: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true } },
        _count: { select: { employees: true } }
      }
    })
  },

  async getTeamById(id) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true, name: true } },
        subDepartment: { select: { id: true, code: true, name: true } },
        teamLead: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true } },
        employees: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, employmentStatus: true }
        }
      }
    })

    if (!team) {
      const error = new Error(`Team with ID '${id}' not found`)
      error.code = 'NOT_FOUND'
      error.status = 404
      throw error
    }

    return team
  },

  async createTeam(data, actorUserId = null) {
    const { code, name, departmentId, subDepartmentId, teamLeadId, status = 'Active' } = data

    if (!code || !name || !departmentId) {
      const error = new Error('Team code, name, and departmentId are required')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const existing = await prisma.team.findUnique({
      where: { code: code.trim().toUpperCase() }
    })
    if (existing) {
      const error = new Error(`Team with code '${code}' already exists`)
      error.code = 'DUPLICATE_CODE'
      error.status = 409
      throw error
    }

    // Verify department
    const dept = await prisma.department.findUnique({ where: { id: departmentId } })
    if (!dept) {
      const error = new Error(`Department with ID '${departmentId}' not found`)
      error.code = 'INVALID_FOREIGN_KEY'
      error.status = 400
      throw error
    }

    // If subDepartmentId provided, verify it belongs to departmentId
    if (subDepartmentId) {
      const subDept = await prisma.subDepartment.findUnique({ where: { id: subDepartmentId } })
      if (!subDept || subDept.departmentId !== departmentId) {
        const error = new Error(`Sub-department does not belong to specified department`)
        error.code = 'INVALID_RELATION'
        error.status = 400
        throw error
      }
    }

    const team = await prisma.team.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        departmentId,
        subDepartmentId: subDepartmentId || null,
        teamLeadId: teamLeadId || null,
        status
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        teamLead: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })

    // If teamLeadId assigned, record team_assignments
    if (teamLeadId) {
      await prisma.teamAssignment.upsert({
        where: {
          employeeId_teamId_role: {
            employeeId: teamLeadId,
            teamId: team.id,
            role: 'TEAM_LEAD'
          }
        },
        create: {
          employeeId: teamLeadId,
          teamId: team.id,
          role: 'TEAM_LEAD',
          isPrimary: true
        },
        update: {}
      }).catch(() => {})
    }

    return team
  },

  async updateTeam(id, data) {
    const existing = await this.getTeamById(id)
    const realId = existing.id

    const updateData = {}
    if (data.code !== undefined && data.code.trim()) {
      const newCode = data.code.trim().toUpperCase()
      if (newCode !== existing.code) {
        const dup = await prisma.team.findUnique({ where: { code: newCode } })
        if (dup && dup.id !== realId) {
          const error = new Error(`Team with code '${newCode}' already exists`)
          error.code = 'DUPLICATE_CODE'
          error.status = 409
          throw error
        }
        updateData.code = newCode
      }
    }
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.status !== undefined) updateData.status = data.status
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId
    if (data.subDepartmentId !== undefined) updateData.subDepartmentId = data.subDepartmentId || null
    if (data.teamLeadId !== undefined) {
      updateData.teamLeadId = data.teamLeadId || null

      if (data.teamLeadId) {
        await prisma.teamAssignment.upsert({
          where: {
            employeeId_teamId_role: {
              employeeId: data.teamLeadId,
              teamId: realId,
              role: 'TEAM_LEAD'
            }
          },
          create: {
            employeeId: data.teamLeadId,
            teamId: realId,
            role: 'TEAM_LEAD',
            isPrimary: true
          },
          update: {}
        }).catch(() => {})
      }
    }

    return prisma.team.update({
      where: { id: realId },
      data: updateData,
      include: {
        department: { select: { id: true, code: true, name: true } },
        teamLead: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }
      }
    })
  },

  async deleteTeam(id, actorUserId = null) {
    const team = await this.getTeamById(id)
    const staffCount = await prisma.employee.count({
      where: { teamId: id, employmentStatus: { in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } }
    })
    if (staffCount > 0) {
      const err = new Error(`Cannot delete team '${team.name}'. It contains ${staffCount} active employee(s).`)
      err.status = 400
      throw err
    }
    try {
      await prisma.team.delete({ where: { id } })
    } catch {
      await prisma.team.update({ where: { id }, data: { status: 'Inactive' } })
    }
    return { success: true, message: `Team '${team.name}' deleted.` }
  },

  // ============================================================================
  // DESIGNATIONS
  // ============================================================================
  async getDesignations(filters = {}) {
    const { departmentId, level, search } = filters
    const where = {}

    if (departmentId) where.departmentId = departmentId
    if (level) where.level = level
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } }
      ]
    }

    return prisma.designation.findMany({
      where,
      orderBy: { title: 'asc' },
      include: {
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { employees: true } }
      }
    })
  },

  async createDesignation(data) {
    const { code, title, departmentId, level = 'MID', minSalary, maxSalary, status = 'Active' } = data

    if (!code || !title) {
      const error = new Error('Designation code and title are required')
      error.code = 'VALIDATION_ERROR'
      error.status = 400
      throw error
    }

    const existing = await prisma.designation.findUnique({
      where: { code: code.trim().toUpperCase() }
    })
    if (existing) {
      const error = new Error(`Designation with code '${code}' already exists`)
      error.code = 'DUPLICATE_CODE'
      error.status = 409
      throw error
    }

    return prisma.designation.create({
      data: {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        departmentId: departmentId || null,
        level: normalizeDesignationLevel(level),
        status: status || 'Active',
        minSalary: minSalary !== undefined ? minSalary : null,
        maxSalary: maxSalary !== undefined ? maxSalary : null
      },
      include: {
        department: { select: { id: true, code: true, name: true } }
      }
    })
  },

  async updateDesignation(id, data) {
    const existing = await prisma.designation.findFirst({
      where: { OR: [{ id }, { code: id }] }
    })
    if (!existing) {
      const err = new Error(`Designation with ID '${id}' not found`)
      err.status = 404
      throw err
    }
    const updateData = {}
    if (data.code !== undefined && data.code.trim()) {
      const newCode = data.code.trim().toUpperCase()
      if (newCode !== existing.code) {
        const dup = await prisma.designation.findUnique({ where: { code: newCode } })
        if (dup && dup.id !== existing.id) {
          const error = new Error(`Designation with code '${newCode}' already exists`)
          error.code = 'DUPLICATE_CODE'
          error.status = 409
          throw error
        }
        updateData.code = newCode
      }
    }
    if (data.title !== undefined) updateData.title = data.title.trim()
    if (data.name !== undefined && !updateData.title) updateData.title = data.name.trim()
    if (data.level !== undefined) updateData.level = normalizeDesignationLevel(data.level)
    if (data.minSalary !== undefined) updateData.minSalary = data.minSalary
    if (data.maxSalary !== undefined) updateData.maxSalary = data.maxSalary
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null
    if (data.status !== undefined) updateData.status = data.status

    return prisma.designation.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        department: { select: { id: true, code: true, name: true } }
      }
    })
  },

  async deleteDesignation(id, actorUserId = null) {
    const desig = await prisma.designation.findFirst({ where: { OR: [{ id }, { code: id }] } })
    if (!desig) {
      const err = new Error(`Designation with ID '${id}' not found`)
      err.status = 404
      throw err
    }
    const realId = desig.id
    const staffCount = await prisma.employee.count({
      where: { designationId: realId, employmentStatus: { in: ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'] } }
    })
    if (staffCount > 0) {
      const err = new Error(`Cannot delete designation '${desig.title}'. It is held by ${staffCount} employee(s).`)
      err.status = 400
      throw err
    }
    await prisma.designation.delete({ where: { id: realId } })
    return { success: true, message: `Designation '${desig.title}' deleted.` }
  },

  // ============================================================================
  // ANTI-CIRCULAR REPORTING VALIDATION
  // ============================================================================
  /**
   * Traverses reporting tree upward to ensure newManagerId is not the employee themselves
   * and does not create an infinite circular reporting loop (A -> B -> C -> A).
   */
  async validateReportingHierarchy(employeeId, newManagerId) {
    if (!newManagerId) return true

    if (employeeId === newManagerId) {
      const error = new Error('Anti-Circular Reporting: An employee cannot report to themselves.')
      error.code = 'CIRCULAR_REPORTING_DETECTED'
      error.status = 400
      throw error
    }

    let currentManagerId = newManagerId
    const visited = new Set([employeeId])

    while (currentManagerId) {
      if (visited.has(currentManagerId)) {
        const error = new Error('Anti-Circular Reporting: Circular reporting hierarchy detected. This manager reports directly or indirectly to the employee.')
        error.code = 'CIRCULAR_REPORTING_DETECTED'
        error.status = 400
        throw error
      }

      visited.add(currentManagerId)

      const manager = await prisma.employee.findUnique({
        where: { id: currentManagerId },
        select: { reportingManagerId: true }
      })

      currentManagerId = manager?.reportingManagerId || null
    }

    return true
  },

  // ============================================================================
  // HIERARCHY TREE
  // ============================================================================
  async getHierarchyTree() {
    const departments = await prisma.department.findMany({
      where: { status: 'Active' },
      include: {
        head: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        teams: {
          where: { status: 'Active' },
          include: {
            teamLead: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
            _count: { select: { employees: true } }
          }
        },
        _count: { select: { employees: true } }
      },
      orderBy: { code: 'asc' }
    })

    return departments
  }
}

export default organizationService

