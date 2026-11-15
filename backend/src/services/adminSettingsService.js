/**
 * iSysware HRMS — Administration, Settings & Security Audit Backend Service
 * PostgreSQL-backed service implementing:
 * - Organization profile & policy master configuration
 * - Portal user account administration (Activation/Deactivation)
 * - Protected Super Admin safeguards & Last Active Admin protection
 * - Administrative password reset with full session invalidation
 * - Tamper-evident, sanitized security audit logs
 */

import prisma from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import argon2 from 'argon2'

export class AdminSettingsService {
  // ============================================================================
  // 1. ORGANIZATION SETTINGS
  // ============================================================================

  async getSettings() {
    let settings = await prisma.organizationSetting.findFirst()
    if (!settings) {
      settings = await prisma.organizationSetting.create({
        data: {
          companyName: 'iSysware Software Solutions',
          defaultCurrency: 'PKR',
          timezone: 'Asia/Karachi',
          fiscalYearStartMonth: 7,
          settingsJson: {}
        }
      })
    }
    return settings
  }

  async updateSettings(data, actorUserId) {
    let settings = await prisma.organizationSetting.findFirst()
    if (!settings) {
      settings = await prisma.organizationSetting.create({
        data: {
          companyName: data.companyName || 'iSysware Software Solutions',
          legalEntityName: data.legalEntityName || null,
          ntnNumber: data.ntnNumber || null,
          address: data.address || null,
          supportEmail: data.supportEmail || null,
          supportPhone: data.supportPhone || null,
          timezone: data.timezone || 'Asia/Karachi',
          defaultCurrency: data.defaultCurrency || 'PKR',
          fiscalYearStartMonth: data.fiscalYearStartMonth || 7,
          settingsJson: data.settingsJson || {}
        }
      })
    } else {
      settings = await prisma.organizationSetting.update({
        where: { id: settings.id },
        data: {
          companyName: data.companyName !== undefined ? data.companyName : settings.companyName,
          legalEntityName: data.legalEntityName !== undefined ? data.legalEntityName : settings.legalEntityName,
          ntnNumber: data.ntnNumber !== undefined ? data.ntnNumber : settings.ntnNumber,
          address: data.address !== undefined ? data.address : settings.address,
          supportEmail: data.supportEmail !== undefined ? data.supportEmail : settings.supportEmail,
          supportPhone: data.supportPhone !== undefined ? data.supportPhone : settings.supportPhone,
          timezone: data.timezone !== undefined ? data.timezone : settings.timezone,
          defaultCurrency: data.defaultCurrency !== undefined ? data.defaultCurrency : settings.defaultCurrency,
          fiscalYearStartMonth: data.fiscalYearStartMonth !== undefined ? data.fiscalYearStartMonth : settings.fiscalYearStartMonth,
          settingsJson: data.settingsJson !== undefined ? data.settingsJson : settings.settingsJson
        }
      })
    }

    return settings
  }

  // ============================================================================
  // 1B. CONFIGURABLE POLICIES & FINANCIAL INVARIANTS (BATCH 7A)
  // ============================================================================

  getDefaultPolicies() {
    return {
      monthlyAllowedLeaves: 2,
      extraLeaveDeductionAmount: 500,
      salaryDivisor: 31, // Strict Company Invariant
      overtimeThresholdMinutes: 60,
      overtimeRateMultiplier: 1.5,
      performanceScoringWeights: {
        kpiWeight: 70,
        competenciesWeight: 30
      },
      trainingPassingScore: 70,
      expenseApprovalThresholds: {
        managerLimit: 100000,
        hrAdminLimit: 250000,
        superAdminRequiredAbove: 250000
      },
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      version: 1,
      auditHistory: []
    }
  }

  async getPolicies() {
    const settings = await this.getSettings()
    const stored = settings.settingsJson?.policies
    if (!stored) {
      return this.getDefaultPolicies()
    }
    return {
      ...this.getDefaultPolicies(),
      ...stored,
      salaryDivisor: 31 // Enforce invariant on read
    }
  }

  async updatePolicies(data, actorUser) {
    if (!actorUser) {
      throw new AppError('Authentication required to modify company policies', 401, 'UNAUTHORIZED')
    }

    // STRICT INVARIANT GUARD: The 31-day divisor can NEVER be changed from 31
    if (data.salaryDivisor !== undefined && Number(data.salaryDivisor) !== 31) {
      throw new AppError(
        'The 31-day salary divisor is a fixed company invariant and cannot be modified under any circumstances.',
        403,
        'FINANCIAL_RULE_PROTECTED'
      )
    }

    // Role check: Only Super Admin can modify financial deduction rules
    const isSuperAdmin = actorUser.role === 'SUPER_ADMIN'
    const isModifyingFinancialRules =
      data.extraLeaveDeductionAmount !== undefined ||
      data.monthlyAllowedLeaves !== undefined

    if (isModifyingFinancialRules && !isSuperAdmin) {
      throw new AppError(
        'Modifying core financial & salary deduction policies requires Super Admin authorization.',
        403,
        'SUPER_ADMIN_REQUIRED'
      )
    }

    const currentPolicies = await this.getPolicies()
    const changes = {}

    const allowedKeys = [
      'monthlyAllowedLeaves',
      'extraLeaveDeductionAmount',
      'overtimeThresholdMinutes',
      'overtimeRateMultiplier',
      'performanceScoringWeights',
      'trainingPassingScore',
      'expenseApprovalThresholds'
    ]

    for (const key of allowedKeys) {
      if (data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(currentPolicies[key])) {
        changes[key] = {
          from: currentPolicies[key],
          to: data[key]
        }
      }
    }

    const effectiveFrom = data.effectiveFrom || new Date().toISOString()
    const historyEntry = {
      version: (currentPolicies.version || 1) + 1,
      actorUserId: actorUser.id,
      actorRole: actorUser.role || 'SUPER_ADMIN',
      effectiveFrom,
      changes,
      timestamp: new Date().toISOString()
    }

    const updatedPolicies = {
      ...currentPolicies,
      ...data,
      salaryDivisor: 31, // Preserve immutable invariant
      version: historyEntry.version,
      effectiveFrom,
      auditHistory: [historyEntry, ...(currentPolicies.auditHistory || [])]
    }

    const settings = await this.getSettings()
    const currentJson = settings.settingsJson || {}

    await prisma.$transaction(async (tx) => {
      await tx.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...currentJson,
            policies: updatedPolicies
          }
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: actorUser.id,
          actorRole: actorUser.role || 'SUPER_ADMIN',
          actionType: 'UPDATE_POLICIES',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'OrganizationPolicy',
          entityId: settings.id,
          recordSnapshotAfter: {
            version: updatedPolicies.version,
            effectiveFrom,
            changes
          }
        }
      })
    })

    return updatedPolicies
  }

  // ============================================================================
  // 1C. COMPANY POLICIES & RULE BUILDER (CENTRAL POLICIES REGISTRY)
  // ============================================================================

  getDefaultCompanyPolicies() {
    return [
      {
        id: 'POL-ATT-001',
        name: 'General Corporate Attendance & Punctuality Policy',
        category: 'attendance',
        description: 'Defines grace period, permitted monthly late arrivals, half-day thresholds, and biometric punch rules.',
        appliesTo: 'Company-Wide',
        scopeValue: 'all',
        ruleType: 'threshold',
        allowedLimit: 4,
        calculationMethod: 'fixed',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        version: '2.1',
        status: 'Active',
        precedence: 4,
        isProtected: true,
        rules: { graceMinutes: 15, allowedLatesPerMonth: 4, overtimeMinimumMinutes: 60, wfhMonthlyAllowanceDays: 2 }
      },
      {
        id: 'POL-LEV-001',
        name: 'Standard Paid Time-Off & Leave Governance Policy',
        category: 'leaves',
        description: 'Defines annual leave entitlements, carry forward ceilings, manager approval caps, and split-request prevention.',
        appliesTo: 'Company-Wide',
        scopeValue: 'all',
        ruleType: 'allowance',
        allowedLimit: 2,
        calculationMethod: 'cumulative_monthly',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        version: '3.0',
        status: 'Active',
        precedence: 4,
        isProtected: true,
        rules: { annualLeaveEntitlement: 14, casualLeaveEntitlement: 10, sickLeaveEntitlement: 8, maxCarryForwardDays: 5 }
      },
      {
        id: 'POL-PAY-001',
        name: 'Corporate Compensation, Allowances & Financial Advances Policy',
        category: 'payroll',
        description: 'Enforces strict Super Admin exclusive authority for salary revisions, loan caps, and allowance criteria.',
        appliesTo: 'Company-Wide',
        scopeValue: 'all',
        ruleType: 'limit',
        allowedLimit: 30,
        calculationMethod: 'formula',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        version: '1.5',
        status: 'Active',
        precedence: 4,
        isProtected: true,
        rules: {
          salaryRevisionApprovalAuthority: 'SUPER_ADMIN',
          maxAnnualIncrementPercentage: 25.0,
          requireBoardApprovalAboveCap: true,
          loanMaxAmountMultiplier: 3.0,
          loanMaxDeductionPercent: 30.0,
          salaryDivisor: 31
        }
      },
      {
        id: 'POL-EXP-001',
        name: 'Official Business Expense & Reimbursement Matrix Policy',
        category: 'expenses',
        description: 'Configurable financial authority thresholds, receipt attachment limits, and category ceilings.',
        appliesTo: 'Company-Wide',
        scopeValue: 'all',
        ruleType: 'limit',
        allowedLimit: 25000,
        calculationMethod: 'tiered',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        version: '2.0',
        status: 'Active',
        precedence: 4,
        isProtected: true,
        rules: {
          requiredReceiptThreshold: 1000,
          dailyFuelLimit: 6000,
          dailyMealLimit: 4000,
          restrictDuplicateFuelAllowance: true,
          applicableExceptionPolicy: 'Emergency client dispatch with departmental pre-authorization',
          managerMaxLimit: 25000,
          hrAdminMaxLimit: 75000,
          superAdminThreshold: 75000
        }
      },
      {
        id: 'POL-TRV-001',
        name: 'Business Travel, Advance & Transport Facilities Policy',
        category: 'travel',
        description: 'Travel advance limits, per-diem caps, pick-and-drop eligibility, and attendance bridging.',
        appliesTo: 'Company-Wide',
        scopeValue: 'all',
        ruleType: 'limit',
        allowedLimit: 80,
        calculationMethod: 'formula',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        version: '1.2',
        status: 'Active',
        precedence: 4,
        isProtected: true,
        rules: {
          maxAdvancePercentage: 80,
          perDiemDailyCap: 5000,
          pickAndDropMonthlyChargeRate: 3500,
          advanceSettlementDeadlineDays: 7
        }
      }
    ]
  }

  async getCompanyPolicies() {
    const settings = await this.getSettings()
    let list = settings.settingsJson?.companyPolicies
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = this.getDefaultCompanyPolicies()
      await prisma.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...(settings.settingsJson || {}),
            companyPolicies: list
          }
        }
      })
    }
    return list
  }

  async createCompanyPolicy(data, actorUser) {
    if (!actorUser || actorUser.role !== 'SUPER_ADMIN') {
      throw new AppError('Only Super Admin has authority to create company policies', 403, 'SUPER_ADMIN_REQUIRED')
    }
    if (!data.name || !data.category) {
      throw new AppError('Policy name and category are required', 400, 'VALIDATION_ERROR')
    }

    const policies = await this.getCompanyPolicies()
    const prefix = data.category.slice(0, 3).toUpperCase()
    const nextSeq = policies.length + 1
    const newId = data.id || `POL-${prefix}-${String(nextSeq).padStart(3, '0')}`

    if (policies.some(p => p.id === newId)) {
      throw new AppError(`A policy with code ${newId} already exists`, 409, 'POLICY_EXISTS')
    }

    let precedence = 4
    if (data.appliesTo === 'Employee-Specific') precedence = 1
    else if (data.appliesTo === 'Department') precedence = 2
    else if (data.appliesTo === 'Role') precedence = 3

    const newPolicy = {
      id: newId,
      name: data.name.trim(),
      category: data.category.toLowerCase(),
      description: data.description || '',
      appliesTo: data.appliesTo || 'Company-Wide',
      scopeValue: data.scopeValue || 'all',
      ruleType: data.ruleType || 'threshold',
      allowedLimit: Number(data.allowedLimit) || 0,
      calculationMethod: data.calculationMethod || 'fixed',
      effectiveFrom: data.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: data.effectiveTo || '2026-12-31',
      version: '1.0',
      status: data.status || 'Active',
      precedence,
      isProtected: false,
      rules: data.rules || {},
      createdBy: `${actorUser.username || 'superadmin'} (Super Admin)`,
      updatedAt: new Date().toISOString(),
      changeReason: data.changeReason || 'Initial policy creation'
    }

    const updatedList = [newPolicy, ...policies]
    const settings = await this.getSettings()

    await prisma.$transaction(async (tx) => {
      await tx.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...(settings.settingsJson || {}),
            companyPolicies: updatedList
          }
        }
      })

      const actorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: actorExists ? actorUser.id : null,
          actorRole: 'SUPER_ADMIN',
          actionType: 'POLICY_CREATED',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'CompanyPolicy',
          entityId: newPolicy.id,
          recordSnapshotAfter: newPolicy
        }
      })
    })

    return newPolicy
  }

  async updateCompanyPolicy(id, data, actorUser) {
    if (!actorUser || actorUser.role !== 'SUPER_ADMIN') {
      throw new AppError('Only Super Admin has authority to modify company policies', 403, 'SUPER_ADMIN_REQUIRED')
    }

    const policies = await this.getCompanyPolicies()
    const idx = policies.findIndex(p => p.id === id)
    if (idx === -1) {
      throw new AppError(`Policy with code ${id} not found`, 404, 'NOT_FOUND')
    }

    const current = policies[idx]
    const currentVersionNum = parseFloat(current.version || '1.0')
    const newVersion = (currentVersionNum + 0.1).toFixed(1)

    // Financial invariant guard: payroll 31-day divisor cannot be changed
    if (current.category === 'payroll' || id === 'POL-PAY-001') {
      if (data.rules?.salaryDivisor !== undefined && Number(data.rules.salaryDivisor) !== 31) {
        throw new AppError('The 31-day salary divisor is an immutable financial invariant and cannot be modified.', 403, 'FINANCIAL_RULE_PROTECTED')
      }
    }

    const updated = {
      ...current,
      ...data,
      id: current.id,
      version: newVersion,
      updatedBy: `${actorUser.username || 'superadmin'} (Super Admin)`,
      updatedAt: new Date().toISOString(),
      changeReason: data.changeReason || `Revision to ${current.name}`
    }

    policies[idx] = updated
    const settings = await this.getSettings()

    await prisma.$transaction(async (tx) => {
      await tx.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...(settings.settingsJson || {}),
            companyPolicies: policies
          }
        }
      })

      const actorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: actorExists ? actorUser.id : null,
          actorRole: 'SUPER_ADMIN',
          actionType: 'POLICY_VERSIONED',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'CompanyPolicy',
          entityId: id,
          recordSnapshotAfter: updated
        }
      })
    })

    return updated
  }

  async getCompanyPolicyHistory(id) {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityName: 'CompanyPolicy',
        entityId: id
      },
      include: {
        actorUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return logs
  }

  async toggleCompanyPolicyStatus(id, newStatus, actorUser) {
    if (!actorUser || actorUser.role !== 'SUPER_ADMIN') {
      throw new AppError('Only Super Admin has authority to toggle policy status', 403, 'SUPER_ADMIN_REQUIRED')
    }

    const policies = await this.getCompanyPolicies()
    const idx = policies.findIndex(p => p.id === id)
    if (idx === -1) {
      throw new AppError(`Policy with code ${id} not found`, 404, 'NOT_FOUND')
    }

    const current = policies[idx]
    const updated = {
      ...current,
      status: newStatus,
      updatedBy: `${actorUser.username || 'superadmin'} (Super Admin)`,
      updatedAt: new Date().toISOString(),
      changeReason: `Status transitioned to ${newStatus}`
    }

    policies[idx] = updated
    const settings = await this.getSettings()

    await prisma.$transaction(async (tx) => {
      await tx.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...(settings.settingsJson || {}),
            companyPolicies: policies
          }
        }
      })

      const actorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: actorExists ? actorUser.id : null,
          actorRole: 'SUPER_ADMIN',
          actionType: 'POLICY_STATUS_TOGGLED',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'CompanyPolicy',
          entityId: id,
          recordSnapshotAfter: { status: newStatus }
        }
      })
    })

    return updated
  }

  async deleteCompanyPolicy(id, actorUser) {
    if (!actorUser || actorUser.role !== 'SUPER_ADMIN') {
      throw new AppError('Only Super Admin has authority to delete policies', 403, 'SUPER_ADMIN_REQUIRED')
    }

    const CANONICAL_PROTECTED = ['POL-ATT-001', 'POL-LEV-001', 'POL-PAY-001', 'POL-EXP-001', 'POL-TRV-001']
    if (CANONICAL_PROTECTED.includes(id)) {
      throw new AppError('Core canonical company policies are protected and historically referenced. They cannot be hard-deleted. Please use Deactivate / Archive instead.', 403, 'POLICY_PROTECTED')
    }

    const policies = await this.getCompanyPolicies()
    const target = policies.find(p => p.id === id)
    if (!target) {
      throw new AppError(`Policy with code ${id} not found`, 404, 'NOT_FOUND')
    }

    if (target.isProtected) {
      throw new AppError('This policy is marked as protected and cannot be deleted. Deactivation is available instead.', 403, 'POLICY_PROTECTED')
    }

    const filtered = policies.filter(p => p.id !== id)
    const settings = await this.getSettings()

    await prisma.$transaction(async (tx) => {
      await tx.organizationSetting.update({
        where: { id: settings.id },
        data: {
          settingsJson: {
            ...(settings.settingsJson || {}),
            companyPolicies: filtered
          }
        }
      })

      const actorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: actorExists ? actorUser.id : null,
          actorRole: 'SUPER_ADMIN',
          actionType: 'POLICY_DELETED',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'CompanyPolicy',
          entityId: id,
          recordSnapshotAfter: { deletedPolicy: id, deletedAt: new Date().toISOString() }
        }
      })
    })

    return { message: `Policy ${id} (${target.name}) has been permanently deleted.` }
  }

  // ============================================================================
  // 2. PORTAL USERS ADMINISTRATION
  // ============================================================================

  async getUsers(filters = {}) {
    const where = {}
    if (filters.role) where.role = filters.role
    if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true' || filters.isActive === true

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        isProtected: true,
        employeeId: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return users
  }

  async updateUserStatus(userId, { isActive }, actorUser) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    // 1. Root Super Admin Protection: Protected admin cannot be deactivated
    if (targetUser.isProtected && isActive === false) {
      throw new AppError('Protected Super Admin account cannot be deactivated', 403, 'PROTECTED_ADMIN_IMMUTABLE')
    }

    // 2. Last Active Super Admin Safeguard
    if (targetUser.role === 'SUPER_ADMIN' && isActive === false) {
      const activeSuperAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true }
      })
      if (activeSuperAdmins <= 1) {
        throw new AppError('Cannot deactivate the last active Super Admin account', 400, 'LAST_SUPER_ADMIN_REQUIRED')
      }
    }

    // If deactivating, terminate all active sessions immediately
    if (isActive === false) {
      await prisma.session.deleteMany({ where: { userId } })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: Boolean(isActive) },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        isProtected: true,
        updatedAt: true
      }
    })

    const actorExists = actorUser?.id ? await prisma.user.count({ where: { id: actorUser.id } }) : 0
    await prisma.auditLog.create({
      data: {
        actorUserId: actorExists ? actorUser.id : null,
        actorRole: actorUser?.role || 'SUPER_ADMIN',
        actionType: isActive ? 'USER_ACTIVATION' : 'USER_DEACTIVATION',
        sourceModule: 'ADMIN_SETTINGS',
        entityName: 'User',
        entityId: userId,
        recordSnapshotAfter: { isActive: updated.isActive, username: updated.username }
      }
    })

    return updated
  }

  async adminResetPassword(userId, { newPassword }, actorUser) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    if (!newPassword || newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400, 'PASSWORD_TOO_WEAK')
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })

    // Execute in transaction: update password & purge sessions
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash }
      })

      // Invalidate all existing sessions
      await tx.session.deleteMany({ where: { userId } })

      // Audit Log
      const actorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: actorExists ? actorUser.id : null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'ADMIN_PASSWORD_RESET',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'User',
          entityId: userId,
          recordSnapshotAfter: { username: targetUser.username, action: 'Password reset by admin' }
        }
      })
    })

    return { message: `Password reset successfully for user ${targetUser.username}. All existing sessions revoked.` }
  }

  async createUser({ displayName = null, username, email, password, role = 'EMPLOYEE', employeeId = null, isActive = true }, actorUser) {
    if (!username || !email || !password) {
      throw new AppError('Username, email, and password are required', 400, 'VALIDATION_ERROR')
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400, 'PASSWORD_TOO_WEAK')
    }

    const cleanRole = String(role || 'EMPLOYEE').toUpperCase()
    const VALID_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE']
    if (!VALID_ROLES.includes(cleanRole)) {
      throw new AppError(`Invalid portal role '${role}'. Allowed roles: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE')
    }

    // Critical separation rule: EMPLOYEE accounts must link to an active employee record for self-service.
    // Administrative accounts (SUPER_ADMIN, HR_ADMIN, DEPT_MANAGER, TEAM_LEAD) are independent by default and link optionally.
    if (cleanRole === 'EMPLOYEE' && !employeeId) {
      throw new AppError('An active linked employee record is required for EMPLOYEE portal accounts.', 400, 'EMPLOYEE_LINK_REQUIRED')
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanUsername = username.trim()
    const cleanDisplayName = displayName && displayName.trim() ? displayName.trim() : null

    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email: cleanEmail }
        ]
      }
    })

    if (existing) {
      throw new AppError('A user with this username or email already exists', 409, 'USER_EXISTS')
    }

    // New portal link: only an ACTIVE employee may receive new credentials.
    // Stand-alone accounts remain supported; existing links are never modified here.
    if (employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, employmentStatus: true }
      })
      if (!emp) throw new AppError('Linked employee not found', 404, 'EMPLOYEE_NOT_FOUND')
      if (emp.employmentStatus !== 'ACTIVE') {
        throw new AppError('Only ACTIVE employees may be linked to a new portal account.', 400, 'EMPLOYEE_NOT_ACTIVE')
      }
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })

    const newUser = await prisma.user.create({
      data: {
        displayName: cleanDisplayName,
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        role: cleanRole,
        employeeId: employeeId || null,
        isActive: isActive !== false,
        isProtected: false
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        isProtected: true,
        employeeId: true,
        createdAt: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true }
        }
      }
    })

    const actorExists = actorUser?.id ? await prisma.user.count({ where: { id: actorUser.id } }) : 0
    await prisma.auditLog.create({
      data: {
        actorUserId: actorExists ? actorUser.id : null,
        actorRole: actorUser?.role || 'SUPER_ADMIN',
        actionType: 'PORTAL_ACCOUNT_CREATED',
        sourceModule: 'ADMIN_SETTINGS',
        entityName: 'User',
        entityId: newUser.id,
        recordSnapshotAfter: {
          displayName: newUser.displayName,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
          employeeId: newUser.employeeId
        }
      }
    })

    return newUser
  }

  async updateUser(userId, { displayName, role, email, username, employeeId, isActive }, actorUser) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    const cleanRole = role ? String(role).toUpperCase() : targetUser.role
    const VALID_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER', 'TEAM_LEAD', 'EMPLOYEE']
    if (role && !VALID_ROLES.includes(cleanRole)) {
      throw new AppError(`Invalid portal role '${role}'. Allowed roles: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE')
    }

    if (targetUser.isProtected && role && cleanRole !== 'SUPER_ADMIN') {
      throw new AppError('Cannot demote or change role of a protected Super Admin', 403, 'PROTECTED_ADMIN_IMMUTABLE')
    }

    if (targetUser.isProtected && isActive === false) {
      throw new AppError('Protected Super Admin account cannot be deactivated', 403, 'PROTECTED_ADMIN_IMMUTABLE')
    }

    // A link is a sensitive identity association. Validate only when changing it;
    // editing other account fields must not unexpectedly unlink an existing employee.
    if (employeeId !== undefined) {
      const requestedEmployeeId = employeeId || null
      const existingEmployeeId = targetUser.employeeId || null
      if (requestedEmployeeId !== existingEmployeeId) {
        if (requestedEmployeeId) {
          const employee = await prisma.employee.findUnique({
            where: { id: requestedEmployeeId },
            select: { id: true, employmentStatus: true }
          })
          if (!employee) throw new AppError('Linked employee not found', 404, 'EMPLOYEE_NOT_FOUND')
          if (employee.employmentStatus !== 'ACTIVE') {
            throw new AppError('Only ACTIVE employees may be newly linked to portal accounts.', 400, 'EMPLOYEE_NOT_ACTIVE')
          }
        } else if (cleanRole === 'EMPLOYEE') {
          throw new AppError('An active linked employee record is required for EMPLOYEE portal accounts.', 400, 'EMPLOYEE_LINK_REQUIRED')
        }
      }
    }

    const updateData = {}
    if (displayName !== undefined) {
      updateData.displayName = displayName && displayName.trim() ? displayName.trim() : null
    }
    if (role) updateData.role = cleanRole
    if (email) updateData.email = email.trim().toLowerCase()
    if (username) updateData.username = username.trim()
    if (employeeId !== undefined && (employeeId || null) !== (targetUser.employeeId || null)) {
      updateData.employeeId = employeeId || null
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    // If deactivating, terminate active sessions
    if (updateData.isActive === false) {
      await prisma.session.deleteMany({ where: { userId } })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        isProtected: true,
        employeeId: true,
        updatedAt: true,
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true }
        }
      }
    })

    const updateActorExists = actorUser?.id ? await prisma.user.count({ where: { id: actorUser.id } }) : 0
    await prisma.auditLog.create({
      data: {
        actorUserId: updateActorExists ? actorUser.id : null,
        actorRole: actorUser?.role || 'SUPER_ADMIN',
        actionType: 'PORTAL_ACCOUNT_UPDATED',
        sourceModule: 'ADMIN_SETTINGS',
        entityName: 'User',
        entityId: userId,
        recordSnapshotAfter: updateData
      }
    })

    return updated
  }

  async deleteUser(userId, actorUser) {
    if (!actorUser) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED')
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) throw new AppError('User not found', 404, 'NOT_FOUND')

    // 1. Root Super Admin Protection: Protected admin cannot be deleted
    if (targetUser.isProtected) {
      throw new AppError('Protected Super Admin account cannot be deleted', 403, 'PROTECTED_ADMIN_IMMUTABLE')
    }

    // 2. Prevent self-deletion
    if (actorUser.id === userId) {
      throw new AppError('Cannot delete your own active Super Admin account', 400, 'CANNOT_DELETE_SELF')
    }

    // 3. Last Active Super Admin Safeguard
    if (targetUser.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true }
      })
      if (activeSuperAdmins <= 1) {
        throw new AppError('Cannot delete the last Super Admin account', 400, 'LAST_SUPER_ADMIN_REQUIRED')
      }
    }

    await prisma.$transaction(async (tx) => {
      // Invalidate sessions and tokens
      await tx.session.deleteMany({ where: { userId } })
      await tx.passwordResetToken.deleteMany({ where: { userId } })
      await tx.notification.deleteMany({ where: { userId } })

      // Delete user account
      await tx.user.delete({ where: { id: userId } })

      // Audit Log
      const delActorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: delActorExists ? actorUser.id : null,
          actorRole: actorUser?.role || 'SUPER_ADMIN',
          actionType: 'PORTAL_ACCOUNT_DELETED',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'User',
          entityId: userId,
          recordSnapshotAfter: {
            username: targetUser.username,
            email: targetUser.email,
            role: targetUser.role,
            deletedAt: new Date().toISOString()
          }
        }
      })
    })

    return { message: `Portal account ${targetUser.username} (${targetUser.role}) has been permanently deleted.` }
  }

  // ============================================================================
  // 3. DATA MANAGEMENT — DELETE ALL OPERATIONAL DATA
  // ============================================================================

  async deleteAllOperationalData(actorUser) {
    if (!actorUser || actorUser.role !== 'SUPER_ADMIN') {
      throw new AppError('Only Super Admin can execute Delete All Data', 403, 'SUPER_ADMIN_REQUIRED')
    }

    const deletionSummary = await prisma.$transaction(async (tx) => {
      // 1. Employee Allowances & Allowances Master
      await tx.employeeAllowance.deleteMany().catch(() => {})
      await tx.allowance.deleteMany().catch(() => {})

      // 2. Sales Commissions & Bonuses
      await tx.commissionTransaction.deleteMany().catch(() => {})
      await tx.bonusTransaction.deleteMany().catch(() => {})
      await tx.commissionPlanAssignment.deleteMany().catch(() => {})
      await tx.commissionPlan.deleteMany().catch(() => {})

      // 3. Department KPIs
      await tx.departmentKpi.deleteMany().catch(() => {})

      // 4. Expenses, Receipts & Expense Categories Reset
      const expenseItems = await tx.expenseItem.deleteMany().catch(() => ({ count: 0 }))
      const expenseClaims = await tx.expenseClaim.deleteMany().catch(() => ({ count: 0 }))
      const orgSet = await tx.organizationSetting.findFirst().catch(() => null)
      if (orgSet) {
        const curPolicies = orgSet.settingsJson?.policies || {}
        await tx.organizationSetting.update({
          where: { id: orgSet.id },
          data: {
            settingsJson: {
              ...(orgSet.settingsJson || {}),
              expenseCategories: [],
              policies: {
                ...curPolicies,
                expenseApprovalThresholds: {
                  hrAdminLimit: 0,
                  managerLimit: 0,
                  superAdminRequiredAbove: 0
                }
              }
            }
          }
        }).catch(() => {})
      }

      // 5. Travel & Transport
      const transportPasses = await tx.transportPass.deleteMany().catch(() => ({ count: 0 }))
      await tx.transportAssignment.deleteMany().catch(() => {})
      await tx.travelPlan.deleteMany().catch(() => {})
      const travelRequests = await tx.travelRequest.deleteMany().catch(() => ({ count: 0 }))
      await tx.transportRoute.deleteMany().catch(() => {})
      await tx.transportDriver.deleteMany().catch(() => {})
      await tx.transportVehicle.deleteMany().catch(() => {})

      // 6. Help Desk Tickets & Comments
      await tx.helpDeskComment.deleteMany().catch(() => {})
      const helpDeskTickets = await tx.helpDeskTicket.deleteMany().catch(() => ({ count: 0 }))

      // 7. Issued HR Letters & Corporate Letter Templates
      const issuedHrLetters = await tx.issuedHrLetter.deleteMany().catch(() => ({ count: 0 }))
      await tx.hrLetterTemplate.deleteMany().catch(() => {})

      // 8. Training Programs, Sessions, Plans & Enrollments
      const trainingEnrollments = await tx.trainingEnrollment.deleteMany().catch(() => ({ count: 0 }))
      await tx.trainingSession.deleteMany().catch(() => {})
      await tx.trainingPlan.deleteMany().catch(() => {})
      const trainingPrograms = await tx.trainingProgram.deleteMany().catch(() => ({ count: 0 }))

      // 9. Performance Reviews, Goals, Cycles, Feedback & Development Plans
      await tx.employeeFeedback.deleteMany().catch(() => {})
      await tx.developmentPlan.deleteMany().catch(() => {})
      const performanceReviews = await tx.performanceReview.deleteMany().catch(() => ({ count: 0 }))
      const performanceGoals = await tx.performanceGoal.deleteMany().catch(() => ({ count: 0 }))
      const performanceCycles = await tx.performanceCycle.deleteMany().catch(() => ({ count: 0 }))

      // 10. Tasks & Deliverables
      const taskAssignments = await tx.taskAssignment.deleteMany().catch(() => ({ count: 0 }))

      // 11. Payroll Runs, Periods, Entries, Loans & Liabilities
      const salaryLiabilities = await tx.salaryLiability.deleteMany().catch(() => ({ count: 0 }))
      const loanRepayments = await tx.loanRepayment.deleteMany().catch(() => ({ count: 0 }))
      const employeeLoans = await tx.employeeLoan.deleteMany().catch(() => ({ count: 0 }))
      const payrollEntries = await tx.payrollEntry.deleteMany().catch(() => ({ count: 0 }))
      const payrollRuns = await tx.payrollRun.deleteMany().catch(() => ({ count: 0 }))
      const payrollPeriods = await tx.payrollPeriod.deleteMany().catch(() => ({ count: 0 }))
      const salaryRevisions = await tx.salaryRevision.deleteMany().catch(() => ({ count: 0 }))
      const salaryStructures = await tx.salaryStructure.deleteMany().catch(() => ({ count: 0 }))

      // 12. Recruitment Requisitions, Openings, Candidates, Interviews, Offers & Onboarding
      await tx.candidateNote.deleteMany().catch(() => {})
      const onboardingTasks = await tx.onboardingTask.deleteMany().catch(() => ({ count: 0 }))
      const onboardingChecklists = await tx.onboardingChecklist.deleteMany().catch(() => ({ count: 0 }))
      const jobOffers = await tx.jobOffer.deleteMany().catch(() => ({ count: 0 }))
      const interviewEvaluations = await tx.interviewEvaluation.deleteMany().catch(() => ({ count: 0 }))
      const interviewSchedules = await tx.interviewSchedule.deleteMany().catch(() => ({ count: 0 }))
      const jobApplications = await tx.jobApplication.deleteMany().catch(() => ({ count: 0 }))
      const jobOpenings = await tx.jobOpening.deleteMany().catch(() => ({ count: 0 }))
      const jobRequisitions = await tx.jobRequisition.deleteMany().catch(() => ({ count: 0 }))
      const candidates = await tx.candidate.deleteMany().catch(() => ({ count: 0 }))

      // 13. Leaves, Entitlements & Journals
      const leaveBalanceJournals = await tx.leaveBalanceJournal.deleteMany().catch(() => ({ count: 0 }))
      const leaveRequests = await tx.leaveRequest.deleteMany().catch(() => ({ count: 0 }))
      const leaveEntitlements = await tx.leaveEntitlement.deleteMany().catch(() => ({ count: 0 }))

      // 14. Attendance Records, Punches, Corrections, Overtime, WFH & Shifts
      const attendancePunches = await tx.attendancePunch.deleteMany().catch(() => ({ count: 0 }))
      const attendanceCorrectionRequests = await tx.attendanceCorrectionRequest.deleteMany().catch(() => ({ count: 0 }))
      const attendanceRecords = await tx.attendanceRecord.deleteMany().catch(() => ({ count: 0 }))
      const overtimeRequests = await tx.overtimeRequest.deleteMany().catch(() => ({ count: 0 }))
      const wfhRequests = await tx.wfhRequest.deleteMany().catch(() => ({ count: 0 }))
      const fieldDutyRequests = await tx.fieldDutyRequest.deleteMany().catch(() => ({ count: 0 }))
      const shiftAssignments = await tx.shiftAssignment.deleteMany().catch(() => ({ count: 0 }))
      await tx.shift.deleteMany().catch(() => {})

      // 15. Employee Career, Documents, Succession & Notifications
      const employeeDocuments = await tx.employeeDocument.deleteMany().catch(() => ({ count: 0 }))
      const employeeCareerHistory = await tx.employeeCareerHistory.deleteMany().catch(() => ({ count: 0 }))
      const successionHistory = await tx.successionHistory.deleteMany().catch(() => ({ count: 0 }))
      const teamAssignments = await tx.teamAssignment.deleteMany().catch(() => ({ count: 0 }))
      const notifications = await tx.notification.deleteMany().catch(() => ({ count: 0 }))

      // 16. Nullify organizational leadership references and user employee links
      await tx.user.updateMany({ data: { employeeId: null } })
      await tx.department.updateMany({ data: { headId: null } })
      await tx.subDepartment.updateMany({ data: { managerId: null } })
      await tx.team.updateMany({ data: { teamLeadId: null } })
      await tx.employee.updateMany({ data: { reportingManagerId: null } })

      // 17. Purge non-Super Admin portal accounts (keep strictly Super Admin)
      await tx.session.deleteMany({ where: { user: { role: { not: 'SUPER_ADMIN' } } } }).catch(() => {})
      await tx.passwordResetToken.deleteMany().catch(() => {})
      await tx.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } }).catch(() => {})

      // 18. Delete all employees across all modules
      const deletedEmployees = await tx.employee.deleteMany()

      // 19. Delete all organizational master structures down to 0
      const deletedTeams = await tx.team.deleteMany().catch(() => ({ count: 0 }))
      const deletedSubDepts = await tx.subDepartment.deleteMany().catch(() => ({ count: 0 }))
      const deletedDesigs = await tx.designation.deleteMany().catch(() => ({ count: 0 }))
      const deletedDepts = await tx.department.deleteMany().catch(() => ({ count: 0 }))

      // 20. Clear all previous operational audit logs
      await tx.auditLog.deleteMany().catch(() => {})

      // Count preserved portal accounts
      const preservedUsersCount = await tx.user.count()
      const preservedEmployeesCount = await tx.employee.count()

      // Record System Audit Log
      const resetActorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: resetActorExists ? actorUser.id : null,
          actorRole: 'SUPER_ADMIN',
          actionType: 'DELETE_ALL_OPERATIONAL_DATA',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'OperationalDatabase',
          entityId: 'ALL_MODULES',
          recordSnapshotAfter: {
            deletedAt: new Date().toISOString(),
            preservedUsersCount,
            preservedEmployeesCount,
            status: 'OPERATIONAL_DATA_PURGED'
          }
        }
      })

      return {
        expenseClaims: expenseClaims.count,
        expenseItems: expenseItems.count,
        travelRequests: travelRequests.count,
        helpDeskTickets: helpDeskTickets.count,
        trainingEnrollments: trainingEnrollments.count,
        performanceReviews: performanceReviews.count,
        taskAssignments: taskAssignments.count,
        payrollRuns: payrollRuns.count,
        payrollEntries: payrollEntries.count,
        employeeLoans: employeeLoans.count,
        recruitmentApplications: jobApplications.count,
        leaveRequests: leaveRequests.count,
        attendanceRecords: attendanceRecords.count,
        shiftAssignments: shiftAssignments.count,
        notifications: notifications.count,
        deletedEmployees: deletedEmployees.count,
        deletedDepartments: deletedDepts.count,
        deletedDesignations: deletedDesigs.count,
        deletedTeams: deletedTeams.count,
        deletedTeamAssignments: teamAssignments.count,
        preservedUsersCount,
        preservedEmployeesCount
      }
    })

    return {
      message: 'All HRMS operational data across all five portals has been permanently deleted.',
      preservedUsersCount: deletionSummary.preservedUsersCount,
      preservedEmployeesCount: deletionSummary.preservedEmployeesCount,
      details: deletionSummary
    }
  }

  async deleteSelectiveOperationalData({ modules, confirmationToken }, actorUser) {
    if (!actorUser || actorUser.role !== 'SUPER_ADMIN') {
      throw new AppError('Only Super Admin can execute Data Management deletions', 403, 'SUPER_ADMIN_REQUIRED')
    }

    if (!Array.isArray(modules) || modules.length === 0) {
      throw new AppError('At least one module must be selected for deletion', 400, 'NO_MODULES_SELECTED')
    }

    if (confirmationToken !== 'DELETE SELECTED DATA' && confirmationToken !== 'DELETE ALL DATA') {
      throw new AppError('Confirmation token must match "DELETE SELECTED DATA" or "DELETE ALL DATA"', 400, 'INVALID_CONFIRMATION_TOKEN')
    }

    const modSet = new Set(modules)
    const deletionSummary = await prisma.$transaction(async (tx) => {
      const counts = {}

      if (modSet.has('expenses')) {
        const expenseItems = await tx.expenseItem.deleteMany()
        const expenseClaims = await tx.expenseClaim.deleteMany()
        counts.expenseItems = expenseItems.count
        counts.expenseClaims = expenseClaims.count
      }

      if (modSet.has('travel_transport')) {
        const transportPasses = await tx.transportPass.deleteMany()
        const travelRequests = await tx.travelRequest.deleteMany()
        counts.transportPasses = transportPasses.count
        counts.travelRequests = travelRequests.count
      }

      if (modSet.has('helpdesk')) {
        const tickets = await tx.helpDeskTicket.deleteMany()
        counts.helpDeskTickets = tickets.count
      }

      if (modSet.has('letters')) {
        const letters = await tx.issuedHrLetter.deleteMany()
        counts.issuedHrLetters = letters.count
      }

      if (modSet.has('training')) {
        const enrollments = await tx.trainingEnrollment.deleteMany()
        const programs = await tx.trainingProgram.deleteMany()
        counts.trainingEnrollments = enrollments.count
        counts.trainingPrograms = programs.count
      }

      if (modSet.has('tasks_performance')) {
        const reviews = await tx.performanceReview.deleteMany()
        const goals = await tx.performanceGoal.deleteMany()
        const cycles = await tx.performanceCycle.deleteMany()
        const tasks = await tx.taskAssignment.deleteMany()
        counts.performanceReviews = reviews.count
        counts.performanceGoals = goals.count
        counts.performanceCycles = cycles.count
        counts.tasks = tasks.count
      }

      if (modSet.has('payroll')) {
        await tx.employeeAllowance.deleteMany().catch(() => {})
        await tx.allowance.deleteMany().catch(() => {})
        await tx.commissionTransaction.deleteMany().catch(() => {})
        await tx.bonusTransaction.deleteMany().catch(() => {})
        await tx.commissionPlanAssignment.deleteMany().catch(() => {})
        await tx.commissionPlan.deleteMany().catch(() => {})
        const liabilities = await tx.salaryLiability.deleteMany()
        const repayments = await tx.loanRepayment.deleteMany()
        const loans = await tx.employeeLoan.deleteMany()
        const entries = await tx.payrollEntry.deleteMany()
        const runs = await tx.payrollRun.deleteMany()
        const periods = await tx.payrollPeriod.deleteMany()
        const revisions = await tx.salaryRevision.deleteMany()
        const structures = await tx.salaryStructure.deleteMany()
        counts.payrollRuns = runs.count
        counts.payrollEntries = entries.count
        counts.employeeLoans = loans.count
        counts.salaryStructures = structures.count
      }

      if (modSet.has('recruitment')) {
        await tx.candidateNote.deleteMany().catch(() => {})
        const onboardingTasks = await tx.onboardingTask.deleteMany()
        const onboardingChecklists = await tx.onboardingChecklist.deleteMany()
        const offers = await tx.jobOffer.deleteMany()
        const evaluations = await tx.interviewEvaluation.deleteMany()
        const schedules = await tx.interviewSchedule.deleteMany()
        const apps = await tx.jobApplication.deleteMany()
        const openings = await tx.jobOpening.deleteMany()
        const requisitions = await tx.jobRequisition.deleteMany()
        const candidates = await tx.candidate.deleteMany()
        counts.candidates = candidates.count
        counts.jobOffers = offers.count
        counts.jobApplications = apps.count
      }

      if (modSet.has('leaves')) {
        const journals = await tx.leaveBalanceJournal.deleteMany()
        const requests = await tx.leaveRequest.deleteMany()
        const entitlements = await tx.leaveEntitlement.deleteMany()
        counts.leaveRequests = requests.count
        counts.leaveEntitlements = entitlements.count
      }

      if (modSet.has('attendance')) {
        const punches = await tx.attendancePunch.deleteMany()
        const corrections = await tx.attendanceCorrectionRequest.deleteMany()
        const records = await tx.attendanceRecord.deleteMany()
        const overtime = await tx.overtimeRequest.deleteMany()
        const wfh = await tx.wfhRequest.deleteMany()
        const fieldDuty = await tx.fieldDutyRequest.deleteMany()
        const shifts = await tx.shiftAssignment.deleteMany()
        counts.attendanceRecords = records.count
        counts.shiftAssignments = shifts.count
      }

      if (modSet.has('employees')) {
        await tx.employeeAllowance.deleteMany().catch(() => {})
        await tx.allowance.deleteMany().catch(() => {})
        await tx.commissionTransaction.deleteMany().catch(() => {})
        await tx.bonusTransaction.deleteMany().catch(() => {})
        await tx.commissionPlanAssignment.deleteMany().catch(() => {})
        await tx.commissionPlan.deleteMany().catch(() => {})
        await tx.departmentKpi.deleteMany().catch(() => {})
        await tx.transportAssignment.deleteMany().catch(() => {})
        await tx.travelPlan.deleteMany().catch(() => {})
        await tx.candidateNote.deleteMany().catch(() => {})
        const documents = await tx.employeeDocument.deleteMany()
        const career = await tx.employeeCareerHistory.deleteMany()
        const succession = await tx.successionHistory.deleteMany()
        const teamAsgns = await tx.teamAssignment.deleteMany()
        await tx.user.updateMany({ data: { employeeId: null } })
        await tx.department.updateMany({ data: { headId: null } })
        await tx.subDepartment.updateMany({ data: { managerId: null } })
        await tx.team.updateMany({ data: { teamLeadId: null } })
        await tx.employee.updateMany({ data: { reportingManagerId: null } })
        const emps = await tx.employee.deleteMany()
        const teams = await tx.team.deleteMany()
        const subDepts = await tx.subDepartment.deleteMany()
        const desigs = await tx.designation.deleteMany()
        const depts = await tx.department.deleteMany()
        counts.employees = emps.count
        counts.departments = depts.count
        counts.designations = desigs.count
        counts.teams = teams.count
      }

      // Record Audit Log
      const resetActorExists = actorUser?.id ? await tx.user.count({ where: { id: actorUser.id } }) : 0
      await tx.auditLog.create({
        data: {
          actorUserId: resetActorExists ? actorUser.id : null,
          actorRole: 'SUPER_ADMIN',
          actionType: 'DELETE_SELECTIVE_OPERATIONAL_DATA',
          sourceModule: 'ADMIN_SETTINGS',
          entityName: 'OperationalDatabase',
          entityId: modules.join(','),
          recordSnapshotAfter: {
            deletedAt: new Date().toISOString(),
            selectedModules: modules,
            counts
          }
        }
      })

      return counts
    })

    return {
      message: `Operational data for ${modules.length} selected module(s) has been permanently deleted.`,
      selectedModules: modules,
      details: deletionSummary
    }
  }

  // ============================================================================
  // 4. SECURITY AUDIT LOGS
  // ============================================================================

  async getAuditLogs(filters = {}) {
    const where = {}
    if (filters.sourceModule) where.sourceModule = filters.sourceModule
    if (filters.actionType) where.actionType = filters.actionType
    if (filters.actorRole) where.actorRole = filters.actorRole

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      }
    }

    const page = Math.max(1, Number(filters.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25))
    const skip = (page - 1) * limit

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ])

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }
}

export default new AdminSettingsService()
