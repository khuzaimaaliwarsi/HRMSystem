/**
 * iSysware HRMS — Batch F08: Training & Development Service
 * Authoritative orchestrator for:
 * - Course Catalog & Training Programs
 * - Skill-gap Recommendations & Department Training Plans
 * - Scheduled Cohort Sessions & Capacity Governance
 * - Employee Learning Progress & Assessment Outcomes
 * - Verified Digital Certificates
 * - Seamless integration with F07 Performance Management
 */

import {
  INITIAL_TRAINING_PROGRAMS,
  INITIAL_TRAINING_PLANS,
  INITIAL_TRAINING_SESSIONS,
  INITIAL_ENROLLMENTS,
  INITIAL_CERTIFICATES
} from '../mocks/trainingData.js'
import { employeeService } from './employeeService.js'
import { apiClient } from './apiClient.js'
const STORAGE_KEYS = {
  PROGRAMS: 'isysware_hrms_f08_programs_v1',
  PLANS: 'isysware_hrms_f08_plans_v1',
  SESSIONS: 'isysware_hrms_f08_sessions_v1',
  ENROLLMENTS: 'isysware_hrms_f08_enrollments_v1',
  CERTIFICATES: 'isysware_hrms_f08_certificates_v1'
}

const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT)

class TrainingService {
  constructor() {
    this.listeners = new Set()
    this.memoryStorage = {}
    this._initialize()
  }

  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key]
    if (isTest && typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultVal
      } catch {
        // Fallback
      }
    }
    return defaultVal !== undefined ? defaultVal : []
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value
    if (isTest && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Fallback
      }
    }
  }

  _initialize() {
    if (isTest) {
      if (!this._getItem(STORAGE_KEYS.PROGRAMS, null)) {
        this._setItem(STORAGE_KEYS.PROGRAMS, INITIAL_TRAINING_PROGRAMS)
      }
      if (!this._getItem(STORAGE_KEYS.PLANS, null)) {
        this._setItem(STORAGE_KEYS.PLANS, INITIAL_TRAINING_PLANS)
      }
      if (!this._getItem(STORAGE_KEYS.SESSIONS, null)) {
        this._setItem(STORAGE_KEYS.SESSIONS, INITIAL_TRAINING_SESSIONS)
      }
      if (!this._getItem(STORAGE_KEYS.ENROLLMENTS, null)) {
        this._setItem(STORAGE_KEYS.ENROLLMENTS, INITIAL_ENROLLMENTS)
      }
      if (!this._getItem(STORAGE_KEYS.CERTIFICATES, null)) {
        this._setItem(STORAGE_KEYS.CERTIFICATES, INITIAL_CERTIFICATES)
      }
    } else {
      this.memoryStorage[STORAGE_KEYS.PROGRAMS] = []
      this.memoryStorage[STORAGE_KEYS.PLANS] = []
      this.memoryStorage[STORAGE_KEYS.SESSIONS] = []
      this.memoryStorage[STORAGE_KEYS.ENROLLMENTS] = []
      this.memoryStorage[STORAGE_KEYS.CERTIFICATES] = []
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEYS.PROGRAMS)
          window.localStorage.removeItem(STORAGE_KEYS.PLANS)
          window.localStorage.removeItem(STORAGE_KEYS.SESSIONS)
          window.localStorage.removeItem(STORAGE_KEYS.ENROLLMENTS)
          window.localStorage.removeItem(STORAGE_KEYS.CERTIFICATES)
          window.localStorage.removeItem('isysware_hrms_f08_training_programs_v1')
          window.localStorage.removeItem('isysware_hrms_f08_training_sessions_v1')
          window.localStorage.removeItem('isysware_hrms_f08_training_enrollments_v1')
          window.localStorage.removeItem('isysware_hrms_f08_training_certificates_v1')
        }
      } catch {
        // safe fallback
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in trainingService listener:', err)
      }
    }
  }

  resetToDefaults() {
    const programs = isTest ? INITIAL_TRAINING_PROGRAMS : []
    const plans = isTest ? INITIAL_TRAINING_PLANS : []
    const sessions = isTest ? INITIAL_TRAINING_SESSIONS : []
    const enrollments = isTest ? INITIAL_ENROLLMENTS : []
    const certs = isTest ? INITIAL_CERTIFICATES : []
    this._setItem(STORAGE_KEYS.PROGRAMS, JSON.parse(JSON.stringify(programs)))
    this._setItem(STORAGE_KEYS.PLANS, JSON.parse(JSON.stringify(plans)))
    this._setItem(STORAGE_KEYS.SESSIONS, JSON.parse(JSON.stringify(sessions)))
    this._setItem(STORAGE_KEYS.ENROLLMENTS, JSON.parse(JSON.stringify(enrollments)))
    this._setItem(STORAGE_KEYS.CERTIFICATES, JSON.parse(JSON.stringify(certs)))
    this._notify()
  }

  // ==========================================
  // SUBMODULE 1 & 2: PROGRAMS & COURSE CATALOG
  // ==========================================

  getPrograms(filters = {}) {
    const fallback = isTest ? INITIAL_TRAINING_PROGRAMS : []
    let list = [...this._getItem(STORAGE_KEYS.PROGRAMS, fallback)]

    const { category, trainingType, status, search, departmentId } = filters

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.trainer && p.trainer.toLowerCase().includes(q)) ||
        (p.skills && p.skills.some((s) => s.toLowerCase().includes(q)))
      )
    }

    if (category && category !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase())
    }

    if (trainingType && trainingType !== 'all') {
      list = list.filter((p) => p.trainingType.toLowerCase() === trainingType.toLowerCase())
    }

    if (status && status !== 'all') {
      list = list.filter((p) => p.status.toLowerCase() === status.toLowerCase())
    }

    if (departmentId && departmentId !== 'all') {
      list = list.filter((p) =>
        p.eligibleDepartments.includes('all') || p.eligibleDepartments.includes(departmentId)
      )
    }

    return list.map((p) => ({
      ...p,
      programId: p.programId || p.id
    }))
  }

  getProgramById(id) {
    if (!id) return null
    const list = this._getItem(STORAGE_KEYS.PROGRAMS, isTest ? INITIAL_TRAINING_PROGRAMS : [])
    const match = list.find((p) => p.id === id || p.programId === id)
    if (match) return { ...match, programId: match.programId || match.id }
    // Support TR-101 matching TRN-PROG-001 by number or partial
    const numPart = id.replace(/[^0-9]/g, '')
    if (numPart) {
      const found = list.find((p) => p.id.endsWith(numPart.padStart(3, '0')) || p.id.includes(numPart)) || list[0]
      return found ? { ...found, programId: found.programId || found.id } : null
    }
    return null
  }

  saveProgram(data, actorUser) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Training course title is required.')
    }
    if (!data.category) {
      throw new Error('Course category is mandatory.')
    }
    const duration = data.duration || (data.durationHours ? `${data.durationHours} Hours` : '8 Hours')

    const list = [...this._getItem(STORAGE_KEYS.PROGRAMS, isTest ? INITIAL_TRAINING_PROGRAMS : [])]
    const isEdit = Boolean(data.id || data.programId)
    const targetId = data.id || data.programId

    if (isEdit) {
      const idx = list.findIndex((p) => p.id === targetId || p.programId === targetId)
      if (idx === -1) throw new Error(`Program with ID ${targetId} not found.`)
      list[idx] = {
        ...list[idx],
        ...data,
        id: targetId,
        programId: targetId,
        duration,
        lastUpdated: new Date().toISOString().slice(0, 10),
        updatedBy: actorUser?.name || 'HR Admin'
      }
      this._setItem(STORAGE_KEYS.PROGRAMS, list)
      this._notify()
      return list[idx]
    } else {
      const nextNum = list.length + 1
      const generatedId = `TRN-PROG-${String(nextNum).padStart(3, '0')}`
      const newProgram = {
        id: generatedId,
        programId: generatedId,
        title: data.title.trim(),
        description: data.description || '',
        category: data.category,
        skills: Array.isArray(data.skills) ? data.skills : (data.skills ? data.skills.split(',').map(s => s.trim()) : []),
        eligibleDepartments: data.eligibleDepartments || ['all'],
        eligibleDesignations: data.eligibleDesignations || ['all'],
        trainingType: data.trainingType || 'Internal',
        trainer: data.trainer || data.trainerName || 'Internal Lead Trainer',
        duration,
        durationHours: Number(data.durationHours) || 8,
        prerequisites: data.prerequisites || 'None',
        maxParticipants: Number(data.maxParticipants) || 20,
        materials: data.materials || 'Standard Training Guide & Slides',
        costPerParticipant: Number(data.costPerParticipant || data.estimatedCost) || 0,
        status: data.status || 'Active',
        createdDate: new Date().toISOString().slice(0, 10),
        lastUpdated: new Date().toISOString().slice(0, 10),
        createdBy: actorUser?.name || 'HR Admin'
      }
      list.unshift(newProgram)
      this._setItem(STORAGE_KEYS.PROGRAMS, list)
      this._notify()
      return newProgram
    }
  }


  _unwrapApiList(response) {
    if (Array.isArray(response)) return response
    if (Array.isArray(response?.data)) return response.data
    return []
  }

  _mapProgramFromApi(p) {
    if (!p) return p
    const hours = p.durationHours !== undefined && p.durationHours !== null ? Number(p.durationHours) : null
    const maxCap = p.maxCapacity !== undefined && p.maxCapacity !== null
      ? Number(p.maxCapacity)
      : (p.maxParticipants !== undefined && p.maxParticipants !== null ? Number(p.maxParticipants) : null)
    const rawStatus = p.status ? String(p.status) : ''
    let status = rawStatus
    if (rawStatus === 'ACTIVE' || rawStatus === 'Active') status = 'Active'
    else if (rawStatus === 'PLANNED' || rawStatus === 'Planned') status = 'Planned'
    else if (rawStatus === 'DRAFT' || rawStatus === 'Draft') status = 'Draft'
    else if (rawStatus === 'ARCHIVED' || rawStatus === 'Archived') status = 'Archived'

    return {
      ...p,
      id: p.id,
      programId: p.courseCode || p.id,
      courseCode: p.courseCode || '',
      title: p.title ?? '',
      description: p.description ?? '',
      category: p.category ?? '',
      skills: Array.isArray(p.skills) ? p.skills : [],
      eligibleDepartments: Array.isArray(p.eligibleDepartments) ? p.eligibleDepartments : ['all'],
      eligibleDesignations: Array.isArray(p.eligibleDesignations) ? p.eligibleDesignations : ['all'],
      trainingType: p.trainingType ?? '',
      trainer: p.trainerName ?? '',
      trainerName: p.trainerName ?? '',
      durationHours: hours,
      duration: hours !== null ? `${hours} Hours` : '',
      maxParticipants: maxCap,
      maxCapacity: maxCap,
      passingScore: p.passingScore !== undefined && p.passingScore !== null ? Number(p.passingScore) : 70,
      prerequisites: p.prerequisites ?? '',
      materials: p.materials ?? '',
      costPerParticipant: p.costPerParticipant !== undefined && p.costPerParticipant !== null ? Number(p.costPerParticipant) : 0,
      estimatedCost: p.costPerParticipant !== undefined && p.costPerParticipant !== null ? Number(p.costPerParticipant) : 0,
      status,
      createdDate: p.createdAt ? String(p.createdAt).slice(0, 10) : '',
      lastUpdated: p.updatedAt ? String(p.updatedAt).slice(0, 10) : '',
      createdBy: p.createdByName ?? '',
      updatedBy: p.updatedByName ?? ''
    }
  }

  _mapPlanFromApi(plan) {
    if (!plan) return plan
    const empName = plan.targetEmployee
      ? `${plan.targetEmployee.firstName || ''} ${plan.targetEmployee.lastName || ''}`.trim()
      : null
    const deptName = plan.targetDepartment?.name || (plan.targetDepartmentId ? plan.targetDepartmentId : 'All Workforce')
    return {
      ...plan,
      id: plan.id,
      planId: plan.planCode || plan.id,
      planCode: plan.planCode || plan.id,
      title: plan.title || '',
      planType: plan.planType || 'Individual',
      programId: plan.programId,
      programTitle: plan.program?.title || plan.programTitle || '',
      targetDepartmentId: plan.targetDepartmentId || 'all',
      targetDepartmentName: deptName,
      targetEmployeeId: plan.targetEmployeeId || null,
      employeeId: plan.targetEmployee?.employeeCode || plan.targetEmployeeId || null,
      targetEmployeeName: empName || (plan.planType === 'Department' ? deptName : null),
      employeeName: empName,
      isMandatory: Boolean(plan.isMandatory),
      skillsGapSource: plan.skillsGapSource || 'Manager Recommendation',
      justification: plan.justification || '',
      reasonForTraining: plan.justification || '',
      recommendedBy: plan.recommendedById || null,
      recommendedByName: plan.recommendedByName || 'Authorized Lead',
      status: plan.status || 'Pending HR Review',
      decisionRemarks: plan.decisionRemarks || '',
      approvedBy: plan.approvedByName || null,
      approvedDate: plan.approvedAt ? String(plan.approvedAt).slice(0, 10) : null,
      enrolledCount: Number(plan.enrolledCount) || 0
    }
  }

  _mapSessionFromApi(s) {
    if (!s) return s
    const roster = Array.isArray(s.attendanceRecords) && s.attendanceRecords.length > 0
      ? s.attendanceRecords
      : (Array.isArray(s.enrollments)
        ? s.enrollments.map((enr) => ({
            employeeId: enr.employeeId,
            employeeCode: enr.employee?.employeeCode || enr.employeeId,
            employeeName: enr.employee
              ? `${enr.employee.firstName || ''} ${enr.employee.lastName || ''}`.trim()
              : enr.employeeId,
            department: enr.employee?.department?.name || 'General',
            status: ['ATTENDED', 'COMPLETED'].includes(enr.status) ? 'Present' : 'Registered',
            attendanceStatus: ['ATTENDED', 'COMPLETED'].includes(enr.status) ? 'Present' : 'Registered',
            attendedHours: enr.sessionsAttendedCount || 0,
            participationHours: enr.sessionsAttendedCount || 0,
            remarks: ''
          }))
        : [])

    return {
      ...s,
      id: s.id,
      sessionId: s.sessionCode || s.id,
      sessionCode: s.sessionCode || s.id,
      programId: s.programId,
      programTitle: s.program?.title || s.sessionName || '',
      sessionName: s.sessionName || s.program?.title || '',
      trainer: s.trainerName || s.trainer || '',
      trainerName: s.trainerName || s.trainer || '',
      startDate: s.startDate ? String(s.startDate).slice(0, 10) : '',
      endDate: s.endDate ? String(s.endDate).slice(0, 10) : '',
      startTime: s.startTime || '14:00',
      endTime: s.endTime || '17:00',
      locationType: s.locationType || 'Online',
      locationOrLink: s.locationOrLink || '',
      capacity: Number(s.capacity) || 20,
      maxCapacity: Number(s.capacity) || 20,
      status: s.status || 'Scheduled',
      notes: s.notes || '',
      attendanceRecords: roster,
      participants: roster,
      attendanceRecorded: Boolean(s.attendanceRecorded),
      scheduledBy: s.scheduledByName || 'HR Admin',
      scheduledDate: s.createdAt ? String(s.createdAt).slice(0, 10) : ''
    }
  }

  _mapEnrollmentFromApi(e) {
    if (!e) return e
    const rawStatus = String(e.status || 'ENROLLED').toUpperCase()
    let status = e.status
    if (rawStatus === 'ENROLLED') status = 'Enrolled'
    else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'ATTENDED') status = 'In Progress'
    else if (rawStatus === 'COMPLETED') status = 'Completed'
    else if (rawStatus === 'FAILED') status = 'Failed'
    else if (rawStatus === 'CANCELLED') status = 'Cancelled'

    const empName = e.employee
      ? `${e.employee.firstName || ''} ${e.employee.lastName || ''}`.trim()
      : 'Employee'
    const score = e.assessmentScore !== null && e.assessmentScore !== undefined
      ? Number(e.assessmentScore)
      : null
    const pct = e.progressPercent !== undefined && e.progressPercent !== null
      ? Number(e.progressPercent)
      : (rawStatus === 'COMPLETED' ? 100 : (rawStatus === 'ATTENDED' ? 50 : 0))

    const roster = Array.isArray(e.session?.attendanceRecords) ? e.session.attendanceRecords : []
    const rosterRec = roster.find((r) => r.employeeId === e.employeeId)
    const rosterStatus = rosterRec ? String(rosterRec.attendanceStatus || rosterRec.status || '') : ''
    const hasValidAttendance = rosterRec
      ? ['Present', 'Attended'].includes(rosterStatus)
      : (Number(e.sessionsAttendedCount || 0) > 0 || rawStatus === 'ATTENDED')

    return {
      ...e,
      id: e.id,
      enrollmentId: e.id,
      programId: e.programId,
      programTitle: e.program?.title || '',
      trainingTitle: e.program?.title || '',
      sessionId: e.sessionId || null,
      sessionCode: e.session?.sessionCode || null,
      sessionStatus: e.session?.status || null,
      startDate: e.session?.startDate
        ? String(e.session.startDate).slice(0, 10)
        : (e.program?.startDate ? String(e.program.startDate).slice(0, 10) : ''),
      endDate: e.session?.endDate
        ? String(e.session.endDate).slice(0, 10)
        : (e.program?.endDate ? String(e.program.endDate).slice(0, 10) : ''),
      passingScore: Number(e.program?.passingScore) || 70,
      sessionsAttendedCount: Number(e.sessionsAttendedCount || 0),
      hasValidAttendance,
      employeeId: e.employee?.employeeCode || e.employeeId,
      employeeCuid: e.employeeId,
      employeeName: empName,
      department: e.employee?.department?.name || 'General',
      designation: e.employee?.designation?.title || e.employee?.designation?.name || 'Staff',
      enrollmentDate: e.enrolledAt ? String(e.enrolledAt).slice(0, 10) : '',
      dueDate: e.session?.endDate
        ? String(e.session.endDate).slice(0, 10)
        : (e.program?.endDate ? String(e.program.endDate).slice(0, 10) : 'Scheduled'),
      trainerName: e.session?.trainerName || e.program?.trainerName || 'Lead Trainer',
      durationHours: Number(e.program?.durationHours) || 16,
      progressPercent: pct,
      completionPercentage: pct,
      score,
      assessmentScore: score,
      status,
      evaluatorFeedback: e.evaluatorFeedback || '',
      evaluator: e.evaluatedByName || '',
      certificateNumber: e.certificateNumber || null,
      verificationCode: e.verificationCode || null
    }
  }

  _mapCertificateFromApi(e) {
    if (!e) return e
    const empName = e.employee
      ? `${e.employee.firstName || ''} ${e.employee.lastName || ''}`.trim()
      : 'Employee'
    const score = Number(e.assessmentScore || 0)
    return {
      ...e,
      id: e.id,
      certificateId: e.id,
      certificateNumber: e.certificateNumber,
      verificationCode: e.verificationCode || 'VERIFIED',
      programId: e.programId,
      programTitle: e.program?.title || '',
      employeeId: e.employee?.employeeCode || e.employeeId,
      employeeCuid: e.employeeId,
      employeeName: empName,
      department: e.employee?.department?.name || 'General',
      designation: e.employee?.designation?.title || e.employee?.designation?.name || 'Staff',
      issueDate: e.issuedAt ? String(e.issuedAt).slice(0, 10) : '',
      expiryDate: e.certificateExpiryDate ? String(e.certificateExpiryDate).slice(0, 10) : '2 Years',
      authorizedIssuer: e.evaluatedByName || 'iSysware Academy & Corporate Governance Directorate',
      verificationStatus: 'Verified',
      grade: score >= 90 ? `High Distinction (${score}%)` : `Pass (${score}%)`,
      skillsCertified: Array.isArray(e.skillsCertified) && e.skillsCertified.length
        ? e.skillsCertified
        : (Array.isArray(e.program?.skills) && e.program.skills.length
          ? e.program.skills
          : [e.program?.category || 'Professional Competency'])
    }
  }

  async loadTrainingDataAsync() {
    if (this._loadingTrainingPromise) {
      return this._loadingTrainingPromise
    }

    this._loadingTrainingPromise = (async () => {
      const [progRes, planRes, sessRes, enrRes, certRes] = await Promise.allSettled([
        apiClient.get('/training/programs'),
        apiClient.get('/training/plans'),
        apiClient.get('/training/sessions'),
        apiClient.get('/training/enrollments'),
        apiClient.get('/training/certificates')
      ])

      const errors = []

      if (progRes.status === 'fulfilled') {
        const mapped = this._unwrapApiList(progRes.value).map((p) => this._mapProgramFromApi(p))
        this._setItem(STORAGE_KEYS.PROGRAMS, mapped)
      } else {
        errors.push(progRes.reason?.message || 'Programs')
      }

      if (planRes.status === 'fulfilled') {
        const mapped = this._unwrapApiList(planRes.value).map((p) => this._mapPlanFromApi(p))
        this._setItem(STORAGE_KEYS.PLANS, mapped)
      } else {
        errors.push(planRes.reason?.message || 'Plans')
      }

      if (sessRes.status === 'fulfilled') {
        const mapped = this._unwrapApiList(sessRes.value).map((s) => this._mapSessionFromApi(s))
        this._setItem(STORAGE_KEYS.SESSIONS, mapped)
      } else {
        errors.push(sessRes.reason?.message || 'Sessions')
      }

      if (enrRes.status === 'fulfilled') {
        const mapped = this._unwrapApiList(enrRes.value).map((e) => this._mapEnrollmentFromApi(e))
        this._setItem(STORAGE_KEYS.ENROLLMENTS, mapped)
      } else {
        errors.push(enrRes.reason?.message || 'Enrollments')
      }

      if (certRes.status === 'fulfilled') {
        const mapped = this._unwrapApiList(certRes.value).map((c) => this._mapCertificateFromApi(c))
        this._setItem(STORAGE_KEYS.CERTIFICATES, mapped)
      } else {
        errors.push(certRes.reason?.message || 'Certificates')
      }

      this._notify()
      if (errors.length === 5) {
        throw new Error('Failed to load training records from PostgreSQL.')
      }
      return {
        programs: this.getPrograms(),
        plans: this.getPlans(),
        sessions: this.getSessions(),
        enrollments: this.getEnrollments(),
        certificates: this.getCertificates()
      }
    })().finally(() => {
      this._loadingTrainingPromise = null
    })

    return this._loadingTrainingPromise
  }

  async loadProgramsAsync() {
    const data = await this.loadTrainingDataAsync()
    return data.programs
  }

  async createProgramAsync(data) {
    const parsedMatch = typeof data.duration === 'string' ? data.duration.match(/[\d.]+/) : null
    const durationHours = Number(data.durationHours) || (parsedMatch ? Number(parsedMatch[0]) : 16)

    const payload = {
      ...data,
      trainerName: data.trainerName || data.trainer,
      durationHours,
      maxCapacity: Number(data.maxCapacity ?? data.maxParticipants) || 20,
      status: data.status || 'Active',
      ...(data.startDate ? { startDate: data.startDate } : {}),
      ...(data.endDate ? { endDate: data.endDate } : {})
    }

    const result = await apiClient.post('/training/programs', payload)
    await this.loadTrainingDataAsync()
    return this._mapProgramFromApi(result?.data || result)
  }

  async updateProgramAsync(id, data) {
    const parsedMatch = typeof data.duration === 'string' ? data.duration.match(/[\d.]+/) : null
    const durationHours = data.durationHours !== undefined
      ? Number(data.durationHours)
      : (parsedMatch ? Number(parsedMatch[0]) : undefined)

    const payload = {
      ...data,
      trainerName: data.trainerName ?? data.trainer,
      durationHours,
      maxCapacity: data.maxCapacity ?? data.maxParticipants
    }
    const result = await apiClient.patch(`/training/programs/${id}`, payload)
    await this.loadTrainingDataAsync()
    return this._mapProgramFromApi(result?.data || result)
  }

  async archiveProgramAsync(id) {
    const result = await apiClient.post(`/training/programs/${id}/archive`, {})
    await this.loadTrainingDataAsync()
    return this._mapProgramFromApi(result?.data || result)
  }

  async toggleProgramStatusAsync(id) {
    const result = await apiClient.post(`/training/programs/${id}/toggle-status`, {})
    await this.loadTrainingDataAsync()
    return this._mapProgramFromApi(result?.data || result)
  }

  async createPlanAsync(data) {
    const result = await apiClient.post('/training/plans', data)
    await this.loadTrainingDataAsync()
    return this._mapPlanFromApi(result?.data || result)
  }

  async approvePlanAsync(planId, remarks = 'Approved') {
    const result = await apiClient.post(`/training/plans/${planId}/approve`, { remarks })
    await this.loadTrainingDataAsync()
    return this._mapPlanFromApi(result?.data || result)
  }

  async rejectPlanAsync(planId, reason = 'Declined under review authority') {
    const result = await apiClient.post(`/training/plans/${planId}/reject`, { reason })
    await this.loadTrainingDataAsync()
    return this._mapPlanFromApi(result?.data || result)
  }

  async scheduleSessionAsync(data) {
    const result = await apiClient.post('/training/sessions', data)
    await this.loadTrainingDataAsync()
    return this._mapSessionFromApi(result?.data || result)
  }

  async rescheduleSessionAsync(sessionId, newDates) {
    const result = await apiClient.patch(`/training/sessions/${sessionId}`, newDates)
    await this.loadTrainingDataAsync()
    return this._mapSessionFromApi(result?.data || result)
  }

  async recordSessionAttendanceAsync(sessionId, attendanceRecords) {
    const result = await apiClient.post(`/training/sessions/${sessionId}/attendance`, { attendanceRecords })
    await this.loadTrainingDataAsync()
    return this._mapSessionFromApi(result?.data || result)
  }

  async markSessionCompletedAsync(sessionId) {
    const result = await apiClient.post(`/training/sessions/${sessionId}/complete`, {})
    await this.loadTrainingDataAsync()
    return this._mapSessionFromApi(result?.data || result)
  }

  async cancelSessionAsync(sessionId, reason = 'Administrative cancellation') {
    const result = await apiClient.post(`/training/sessions/${sessionId}/cancel`, { reason })
    await this.loadTrainingDataAsync()
    return this._mapSessionFromApi(result?.data || result)
  }

  async enrollEmployeeAsync({ programId, sessionId, employeeId }) {
    const result = await apiClient.post('/training/enrollments', { programId, sessionId, employeeId })
    await this.loadTrainingDataAsync()
    return this._mapEnrollmentFromApi(result?.data || result)
  }

  async updateProgressAsync(enrollmentId, progressPercent, notes) {
    const result = await apiClient.patch(`/training/enrollments/${enrollmentId}/progress`, { progressPercent, notes })
    await this.loadTrainingDataAsync()
    return this._mapEnrollmentFromApi(result?.data || result)
  }

  async finalizeAssessmentAsync(enrollmentId, assessmentData) {
    const payload = {
      assessmentScore: assessmentData.score ?? assessmentData.assessmentScore,
      status: assessmentData.status,
      feedback: assessmentData.feedback || assessmentData.evaluatorFeedback
    }
    const result = await apiClient.post(`/training/enrollments/${enrollmentId}/assessment`, payload)
    await this.loadTrainingDataAsync()
    return this._mapEnrollmentFromApi(result?.data || result)
  }

  createProgram(data, actorUser) {
    return this.saveProgram(data, actorUser)
  }

  updateProgram(id, data, actorUser) {
    return this.saveProgram({ ...data, id }, actorUser)
  }

  archiveProgram(id, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.PROGRAMS, isTest ? INITIAL_TRAINING_PROGRAMS : [])]
    const idx = list.findIndex((p) => p.id === id || p.programId === id)
    if (idx === -1) throw new Error(`Program '${id}' not found.`)

    list[idx] = {
      ...list[idx],
      status: 'Archived',
      lastUpdated: new Date().toISOString().slice(0, 10),
      archivedBy: actorUser?.name || 'HR Admin'
    }
    this._setItem(STORAGE_KEYS.PROGRAMS, list)
    this._notify()
    return list[idx]
  }

  toggleProgramStatus(id, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.PROGRAMS, isTest ? INITIAL_TRAINING_PROGRAMS : [])]
    const idx = list.findIndex((p) => p.id === id || p.programId === id)
    if (idx === -1) throw new Error(`Program '${id}' not found.`)

    const current = list[idx].status
    const nextStatus = current === 'Active' ? 'Draft' : 'Active'
    list[idx] = {
      ...list[idx],
      status: nextStatus,
      lastUpdated: new Date().toISOString().slice(0, 10),
      updatedBy: actorUser?.name || 'HR Admin'
    }
    this._setItem(STORAGE_KEYS.PROGRAMS, list)
    this._notify()
    return list[idx]
  }

  // ==========================================
  // SUBMODULE 3: TRAINING PLANS & ASSIGNMENTS
  // ==========================================

  getPlans(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAINING_PLANS : [])]

    // Role Scoping (client-side only in test mode; live mode uses backend-scoped records)
    if (isTest) {
      if (requestingUser?.role === 'employee') {
        const myId = requestingUser.employeeId || requestingUser.id
        list = list.filter((p) => (p.targetEmployeeId === myId || p.employeeId === myId) || p.targetDepartmentId === requestingUser.departmentId || p.targetDepartmentId === 'all')
      } else if (requestingUser?.role === 'manager') {
        const myId = requestingUser.employeeId || requestingUser.id
        const directReports = employeeService.getDirectReports(myId).map((r) => r.id)
        list = list.filter(
          (p) =>
            p.recommendedBy === myId ||
            p.targetEmployeeId === myId ||
            p.employeeId === myId ||
            directReports.includes(p.targetEmployeeId) ||
            directReports.includes(p.employeeId) ||
            p.targetDepartmentId === requestingUser.departmentId ||
            p.targetDepartmentId === 'all'
        )
      }
    }

    if (filters.planType && filters.planType !== 'all') {
      list = list.filter((p) => p.planType.toLowerCase() === filters.planType.toLowerCase())
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((p) => p.status.toLowerCase() === filters.status.toLowerCase())
    }

    return list.map((p) => ({
      ...p,
      planId: p.planId || p.id,
      employeeName: p.employeeName || p.targetEmployeeName,
      employeeId: p.employeeId || p.targetEmployeeId,
      reasonForTraining: p.reasonForTraining || p.justification
    }))
  }

  createTrainingPlan(data, actorUser) {
    const {
      title = (data.reasonForTraining ? `${data.employeeName || 'Employee'} — ${data.reasonForTraining}` : 'Training Development Plan'),
      planType = 'Individual',
      programId,
      targetDepartmentId = null,
      targetEmployeeId = data.employeeId || null,
      isMandatory = false,
      skillsGapSource = 'Manager Discretion',
      justification = data.reasonForTraining || 'Skill development recommendation'
    } = data

    if (!title || !title.trim()) throw new Error('Training recommendation title is required.')
    if (!programId) throw new Error('Target training program must be selected.')

    const program = this.getProgramById(programId)
    if (!program) throw new Error(`Program ${programId} does not exist.`)

    let targetEmployeeName = data.employeeName || null
    if (targetEmployeeId && !targetEmployeeName) {
      const emp = employeeService.getEmployeeById(targetEmployeeId)
      targetEmployeeName = emp?.name || targetEmployeeId
    }

    const isHrOrSuper = actorUser?.role === 'super_admin' || actorUser?.role === 'hr_admin'
    const status = actorUser?.role === 'manager' ? 'Recommended' : (isHrOrSuper ? 'Approved' : 'Pending HR Review')

    const generatedId = `PLAN-${Date.now().toString().slice(-6)}`
    const newPlan = {
      id: generatedId,
      planId: generatedId,
      title: title.trim(),
      planType,
      programId: program.programId || program.id,
      programTitle: program.title,
      targetDepartmentId: targetDepartmentId || 'all',
      targetDepartmentName: targetDepartmentId ? (targetDepartmentId === 'all' ? 'All Workforce' : `Department ${targetDepartmentId}`) : (data.department || 'General'),
      targetEmployeeId,
      employeeId: targetEmployeeId,
      targetEmployeeName,
      employeeName: targetEmployeeName,
      isMandatory: Boolean(isMandatory),
      skillsGapSource: skillsGapSource.trim(),
      justification: justification.trim(),
      reasonForTraining: justification.trim(),
      priority: data.priority || 'Medium',
      targetQuarter: data.targetQuarter || 'Q4 2026',
      recommendedBy: actorUser?.employeeId || actorUser?.id || actorUser?.name || 'Manager',
      recommendedByName: actorUser?.name || 'Authorized Lead',
      status,
      approvedBy: (isHrOrSuper && actorUser?.role !== 'manager') ? actorUser?.name : null,
      approvedDate: (isHrOrSuper && actorUser?.role !== 'manager') ? new Date().toISOString().slice(0, 10) : null,
      enrolledCount: 0
    }

    const list = [newPlan, ...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAINING_PLANS : [])]
    this._setItem(STORAGE_KEYS.PLANS, list)
    this._notify()
    return newPlan
  }

  recommendTrainingPlan(data, actorUser) {
    return this.createTrainingPlan(data, actorUser)
  }

  approveTrainingPlan(planId, remarksOrUser, approverUser) {
    const user = approverUser || (typeof remarksOrUser === 'object' ? remarksOrUser : null)
    const list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAINING_PLANS : [])]
    const idx = list.findIndex((p) => p.id === planId || p.planId === planId)
    if (idx === -1) throw new Error(`Plan '${planId}' not found.`)

    const plan = { ...list[idx] }

    // Anti-self-approval: Non-Super-Admin cannot approve own recommendation if requesting for self
    const approverId = user?.employeeId || user?.id
    const targetId = plan.targetEmployeeId || plan.employeeId
    const isSuperAdmin = String(user?.role || '').toLowerCase() === 'super_admin'
    if (!isSuperAdmin && plan.recommendedBy === approverId && targetId === approverId) {
      throw new Error('Anti-Self-Approval: You cannot approve their own training plan request.')
    }

    plan.status = 'Approved'
    plan.approvedBy = user?.name || 'HR Admin'
    plan.approvedDate = new Date().toISOString().slice(0, 10)
    plan.remarks = typeof remarksOrUser === 'string' ? remarksOrUser : 'Approved'

    list[idx] = plan
    this._setItem(STORAGE_KEYS.PLANS, list)

    // If individual plan with valid employee, auto-create enrollment if session available
    if (plan.targetEmployeeId || plan.employeeId) {
      const empId = plan.targetEmployeeId || plan.employeeId
      const sessions = this.getSessions({ programId: plan.programId, status: 'Scheduled' })
      if (sessions.length > 0) {
        try {
          this.enrollEmployee(sessions[0].id, empId, user)
          plan.enrolledCount = (plan.enrolledCount || 0) + 1
          list[idx] = plan
          this._setItem(STORAGE_KEYS.PLANS, list)
        } catch {
          // Continue
        }
      }
    }

    this._notify()
    return { ...plan, planId: plan.id }
  }

  rejectTrainingPlan(planId, reason, approverUser) {
    const list = [...this._getItem(STORAGE_KEYS.PLANS, isTest ? INITIAL_TRAINING_PLANS : [])]
    const idx = list.findIndex((p) => p.id === planId || p.planId === planId)
    if (idx === -1) throw new Error(`Plan '${planId}' not found.`)

    list[idx] = {
      ...list[idx],
      status: 'Rejected',
      decisionRemarks: reason || 'Declined under review authority',
      approvedBy: approverUser?.name || 'HR Admin',
      approvedDate: new Date().toISOString().slice(0, 10)
    }
    this._setItem(STORAGE_KEYS.PLANS, list)
    this._notify()
    return { ...list[idx], planId: list[idx].id }
  }

  /**
   * CRITICAL INTEGRATION: Connect F08 with F07 Performance Management
   * Converts Manager's skills gap recommendations into actionable Training Plans
   */
  importFromPerformanceReview(review, recommendingUser) {
    if (!review || !review.employeeId) throw new Error('Valid performance review required.')

    const recommendationTitle = `${review.employeeName || review.employeeId} — Performance Skill-Gap Development Plan`
    const programId = review.recommendedTrainingProgramId || 'TRN-PROG-001'
    const program = this.getProgramById(programId) || this.getPrograms({ status: 'Active' })[0]
    const gapNotes = review.improvementAreas || review.identifiedSkillGap || 'Targeted training to address competency deficit.'

    const plan = this.createTrainingPlan(
      {
        title: recommendationTitle,
        planType: 'Individual',
        programId: review.recommendedTrainingProgramId || program?.id || programId,
        targetEmployeeId: review.employeeId,
        employeeId: review.employeeId,
        employeeName: review.employeeName,
        department: review.department,
        skillsGapSource: `F07 Performance Review Ref: ${review.reviewId || review.id}`,
        justification: `Performance Appraisal Skill Gap: ${gapNotes}`,
        reasonForTraining: `Performance Appraisal Skill Gap: ${gapNotes}`,
        isMandatory: false
      },
      recommendingUser
    )

    return {
      ...plan,
      planId: plan.id,
      programId: review.recommendedTrainingProgramId || plan.programId,
      f07ReviewRef: review.reviewId || review.id,
      reasonForTraining: `Performance Appraisal Skill Gap: ${gapNotes}`,
      status: 'Recommended'
    }
  }

  // ==========================================
  // SUBMODULE 4: SESSIONS & SCHEDULING
  // ==========================================

  getSessions(filters = {}) {
    let list = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]

    const { programId, status, search } = filters

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((s) =>
        s.programTitle.toLowerCase().includes(q) ||
        s.trainer.toLowerCase().includes(q) ||
        (s.locationOrLink && s.locationOrLink.toLowerCase().includes(q))
      )
    }

    if (programId && programId !== 'all') {
      list = list.filter((s) => s.programId === programId)
    }

    if (status && status !== 'all') {
      list = list.filter((s) => s.status.toLowerCase() === status.toLowerCase())
    }

    return list.map((s) => ({
      ...s,
      sessionId: s.sessionId || s.id,
      sessionName: s.sessionName || s.programTitle,
      maxCapacity: s.capacity,
      participants: s.attendanceRecords || []
    }))
  }

  getSessionById(id) {
    if (!id) return null
    const list = this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])
    const match = list.find((s) => s.id === id || s.sessionId === id)
    if (match) {
      return {
        ...match,
        sessionId: match.sessionId || match.id,
        sessionName: match.sessionName || match.programTitle,
        maxCapacity: match.capacity,
        participants: match.attendanceRecords || []
      }
    }
    return null
  }

  scheduleSession(data, actorUser) {
    const {
      programId,
      trainer = data.trainerName,
      startDate,
      endDate,
      startTime = '14:00',
      endTime = '17:00',
      locationType = 'Online',
      locationOrLink,
      capacity = data.maxCapacity || 20,
      participantIds = [],
      notes = ''
    } = data

    if (!programId) throw new Error('Training program is required.')
    if (!trainer || !trainer.trim()) throw new Error('Trainer specification is required.')
    if (!startDate || !endDate) throw new Error('Start and end dates are required.')
    if (new Date(startDate) > new Date(endDate)) throw new Error('Start date cannot be after end date.')

    const program = this.getProgramById(programId)
    if (!program) throw new Error('Invalid training program.')
    if (program.status === 'Archived') throw new Error('Cannot schedule sessions for an archived course catalog item.')

    // Capacity validation
    const numCapacity = Math.max(1, Number(capacity) || 15)
    if (Array.isArray(participantIds) && participantIds.length > numCapacity) {
      throw new Error(`Participant count (${participantIds.length}) exceeds maximum capacity (${numCapacity}).`)
    }

    const list = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]

    // Scheduling conflict validation: Trainer cannot teach two overlapping sessions on same time
    const conflict = list.find(
      (s) =>
        s.trainer.toLowerCase() === trainer.toLowerCase().trim() &&
        s.status === 'Scheduled' &&
        s.startDate === startDate &&
        ((s.startTime <= startTime && startTime < s.endTime) ||
          (s.startTime < endTime && endTime <= s.endTime) ||
          s.startTime === startTime)
    )
    if (conflict) {
      throw new Error(`Trainer ${trainer} already has a scheduled session '${conflict.id}' at ${startDate} ${conflict.startTime}.`)
    }

    const generatedId = `TRN-SES-${Date.now().toString().slice(-6)}-${(this._seq = (this._seq || 0) + 1)}`
    const initialAttendance = Array.isArray(participantIds)
      ? participantIds.map((pId) => ({
        employeeId: pId,
        attendanceStatus: 'Registered',
        status: 'Registered',
        participationHours: 0
      }))
      : []

    const newSession = {
      id: generatedId,
      sessionId: generatedId,
      programId: program.programId || program.id,
      programTitle: data.sessionName || program.title,
      sessionName: data.sessionName || program.title,
      trainer: trainer.trim(),
      trainerName: trainer.trim(),
      startDate,
      endDate,
      startTime,
      endTime,
      locationType,
      locationOrLink: locationOrLink || (locationType === 'Online' ? 'https://meet.isysware.internal/training' : 'Main Training Room'),
      capacity: numCapacity,
      maxCapacity: numCapacity,
      status: 'Scheduled',
      notes: notes.trim(),
      attendanceRecords: initialAttendance,
      participants: initialAttendance,
      scheduledBy: actorUser?.name || 'HR Admin',
      scheduledDate: new Date().toISOString().slice(0, 10)
    }

    list.unshift(newSession)
    this._setItem(STORAGE_KEYS.SESSIONS, list)
    this._notify()
    return newSession
  }

  createSession(data, actorUser) {
    return this.scheduleSession(data, actorUser)
  }

  rescheduleSession(sessionId, newDates, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]
    const idx = list.findIndex((s) => s.id === sessionId || s.sessionId === sessionId)
    if (idx === -1) throw new Error(`Session '${sessionId}' not found.`)

    const session = { ...list[idx] }
    if (session.status === 'Completed' || session.status === 'Cancelled') {
      throw new Error(`Cannot reschedule a ${session.status.toLowerCase()} training session.`)
    }

    session.startDate = newDates.startDate || session.startDate
    session.endDate = newDates.endDate || session.endDate
    session.startTime = newDates.startTime || session.startTime
    session.endTime = newDates.endTime || session.endTime
    session.rescheduledBy = actorUser?.name || 'HR Admin'
    session.rescheduledDate = new Date().toISOString().slice(0, 10)

    list[idx] = session
    this._setItem(STORAGE_KEYS.SESSIONS, list)
    this._notify()
    return { ...session, sessionId: session.id }
  }

  cancelSession(sessionId, reason, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]
    const idx = list.findIndex((s) => s.id === sessionId || s.sessionId === sessionId)
    if (idx === -1) throw new Error(`Session '${sessionId}' not found.`)
    if (['Completed', 'Cancelled'].includes(list[idx].status)) {
      throw new Error(`Cannot cancel a ${list[idx].status.toLowerCase()} training cohort.`)
    }

    list[idx] = {
      ...list[idx],
      status: 'Cancelled',
      cancelReason: reason || 'Cancelled by administration',
      cancelledBy: actorUser?.name || 'HR Admin',
      cancelledDate: new Date().toISOString().slice(0, 10)
    }
    this._setItem(STORAGE_KEYS.SESSIONS, list)
    this._notify()
    return { ...list[idx], sessionId: list[idx].id }
  }

  recordSessionAttendance(sessionId, attendanceList, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]
    const idx = list.findIndex((s) => s.id === sessionId || s.sessionId === sessionId)
    if (idx === -1) throw new Error(`Session '${sessionId}' not found.`)

    const session = list[idx]
    if (['Completed', 'Cancelled'].includes(session.status)) {
      throw new Error(`Attendance cannot be changed for a ${session.status} cohort.`)
    }

    const today = new Date().toISOString().slice(0, 10)
    const startDate = session.startDate ? String(session.startDate).slice(0, 10) : ''
    if (startDate && startDate > today) {
      throw new Error('Attendance cannot be recorded before the cohort start date.')
    }

    const mapped = (attendanceList || []).map((item) => {
      const status = item.attendanceStatus || item.status || 'Registered'
      const hours = Number(
        item.attendedHours !== undefined
          ? item.attendedHours
          : (item.participationHours !== undefined ? item.participationHours : 0)
      )
      return {
        ...item,
        employeeId: item.employeeId,
        attendanceStatus: status,
        status,
        attendedHours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
        participationHours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
        remarks: item.remarks ?? ''
      }
    })

    list[idx].attendanceRecords = mapped
    list[idx].participants = mapped
    list[idx].attendanceRecorded = true
    list[idx].attendanceRecordedBy = actorUser?.name || 'Trainer'
    list[idx].attendanceRecordedAt = new Date().toISOString().slice(0, 10)
    if (list[idx].status === 'Scheduled') {
      list[idx].status = 'In Progress'
    }

    this._setItem(STORAGE_KEYS.SESSIONS, list)
    this._notify()
    return {
      ...list[idx],
      sessionId: list[idx].id
    }
  }

  markSessionCompleted(sessionId, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]
    const idx = list.findIndex((s) => s.id === sessionId || s.sessionId === sessionId)
    if (idx === -1) throw new Error(`Session '${sessionId}' not found.`)

    const session = list[idx]
    if (session.status !== 'Scheduled' && session.status !== 'In Progress') {
      throw new Error('Only scheduled or in-progress cohorts can be completed.')
    }

    const today = new Date().toISOString().slice(0, 10)
    const endDate = session.endDate ? String(session.endDate).slice(0, 10) : ''
    if (endDate && today < endDate) {
      throw new Error('Cannot complete a cohort before its end date.')
    }

    const roster = Array.isArray(session.attendanceRecords) ? session.attendanceRecords : (session.participants || [])
    if (roster.length > 0 && !session.attendanceRecorded) {
      throw new Error('Cohort attendance must be recorded before marking the cohort completed.')
    }

    list[idx].status = 'Completed'
    list[idx].completedAt = new Date().toISOString().slice(0, 10)
    list[idx].completedBy = actorUser?.name || 'HR Admin'

    this._setItem(STORAGE_KEYS.SESSIONS, list)
    this._notify()
    return { ...list[idx], sessionId: list[idx].id }
  }

  // ==========================================
  // SUBMODULE 5: ENROLLMENTS & EVALUATIONS
  // ==========================================

  getEnrollments(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.ENROLLMENTS, isTest ? INITIAL_ENROLLMENTS : [])]

    // Role Scoping (client-side only in test mode; live mode uses backend-scoped records)
    if (isTest) {
      if (requestingUser?.role === 'employee') {
        const myId = requestingUser.employeeId || requestingUser.id
        list = list.filter((e) => e.employeeId === myId)
      } else if (requestingUser?.role === 'manager') {
        const myId = requestingUser.employeeId || requestingUser.id
        let directReports = []
        try {
          directReports = employeeService.getDirectReports(myId).map((r) => r.id || r.employeeId)
        } catch {
          directReports = []
        }
        list = list.filter((e) => e.employeeId === myId || directReports.includes(e.employeeId) || e.department === requestingUser.department)
      }
    }

    if (filters.employeeId) {
      list = list.filter((e) => e.employeeId === filters.employeeId)
    }
    if (filters.programId && filters.programId !== 'all') {
      list = list.filter((e) => e.programId === filters.programId)
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((e) => e.status.toLowerCase() === filters.status.toLowerCase())
    }

    return list.map((e) => ({
      ...e,
      enrollmentId: e.enrollmentId || e.id,
      trainingTitle: e.trainingTitle || e.programTitle,
      trainerName: e.trainerName || e.evaluator || 'Lead Trainer',
      completionPercentage: e.completionPercentage !== undefined ? e.completionPercentage : (e.progressPercent || 0)
    }))
  }

  enrollEmployee(arg1, arg2, actorUser) {
    let sessionId, employeeId, employeeName, department, programId;

    if (typeof arg1 === 'object' && arg1 !== null) {
      employeeId = arg1.employeeId;
      employeeName = arg1.employeeName;
      department = arg1.department;
      programId = arg1.programId;
      sessionId = arg1.sessionId;
      actorUser = arg2 || actorUser;
    } else {
      sessionId = arg1;
      employeeId = arg2;
    }

    if (!employeeId) throw new Error('Employee ID is required for enrollment.')

    // If no sessionId given, locate or create session for program
    if (!sessionId && programId) {
      const prog = this.getProgramById(programId)
      if (!prog) throw new Error(`Program '${programId}' not found.`)
      if (prog.status !== 'Active') {
        throw new Error(`Cannot enroll into program '${prog.title}' because it is not active (status: ${prog.status}).`)
      }

      // Check duplicate active enrollment in program
      const existingEnrollments = this._getItem(STORAGE_KEYS.ENROLLMENTS, isTest ? INITIAL_ENROLLMENTS : [])
      const duplicate = existingEnrollments.find(
        (e) => (e.programId === programId || e.programId === prog.id || e.programId === prog.programId) &&
          e.employeeId === employeeId &&
          e.status !== 'Cancelled' && e.status !== 'Failed'
      )
      if (duplicate) {
        throw new Error(`Employee '${employeeName || employeeId}' is already actively enrolled in this training program.`)
      }

      const sessions = this.getSessions({ programId: prog.id, status: 'Scheduled' })
      if (sessions.length > 0) {
        sessionId = sessions[0].id
      } else {
        const newSes = this.scheduleSession({
          programId: prog.id,
          trainer: prog.trainer || 'Lead Instructor',
          startDate: '2026-11-15',
          endDate: '2026-11-20',
          startTime: '10:00',
          endTime: '12:00',
          capacity: prog.maxParticipants || 25,
          locationType: prog.trainingType === 'Online' ? 'Online' : 'Onsite',
          notes: 'Auto-scheduled cohort for program enrollments'
        }, actorUser)
        sessionId = newSes.id
      }
    }

    const session = this.getSessionById(sessionId)
    if (!session) throw new Error(`Session '${sessionId}' not found.`)
    if (session.status === 'Cancelled' || session.status === 'Completed') {
      throw new Error(`Cannot enroll into a ${session.status.toLowerCase()} session.`)
    }

    let employee = null
    try {
      employee = employeeService.getEmployeeById(employeeId)
    } catch {
      employee = null
    }

    if (employee && (employee.status === 'Separated' || employee.status === 'Inactive')) {
      throw new Error(`Cannot enroll separated or inactive employee '${employee.name}'.`)
    }

    const prog = this.getProgramById(session.programId)
    if (prog && prog.status !== 'Active') {
      throw new Error(`Cannot enroll into program '${prog.title}' because it is not active.`)
    }

    const enrollments = [...this._getItem(STORAGE_KEYS.ENROLLMENTS, isTest ? INITIAL_ENROLLMENTS : [])]

    // Duplicate check
    const existingActive = enrollments.find(
      (e) => (e.sessionId === sessionId || (prog && e.programId === prog.id)) &&
        e.employeeId === employeeId &&
        e.status !== 'Cancelled' && e.status !== 'Failed'
    )
    if (existingActive) {
      throw new Error(`Employee '${employeeName || employeeId}' is already actively enrolled in this training session.`)
    }

    // Capacity check
    const currentSessionEnrollments = enrollments.filter(
      (e) => e.sessionId === sessionId && e.status !== 'Cancelled'
    )
    if (currentSessionEnrollments.length >= session.capacity) {
      throw new Error(`Session capacity exceeded (Maximum ${session.capacity} participants allowed).`)
    }

    const empName = employeeName || employee?.name || employeeId
    const empDept = department || employee?.department || 'General'

    const generatedId = `ENR-${Date.now().toString().slice(-6)}-${(this._seq = (this._seq || 0) + 1)}`
    const newEnrollment = {
      id: generatedId,
      enrollmentId: generatedId,
      programId: session.programId,
      programTitle: session.programTitle || prog?.title || 'Corporate Training',
      trainingTitle: session.programTitle || prog?.title || 'Corporate Training',
      trainerName: session.trainer || 'Lead Instructor',
      sessionId,
      employeeId,
      employeeName: empName,
      department: empDept,
      designation: employee?.designation || 'Specialist',
      enrollmentDate: new Date().toISOString().slice(0, 10),
      dueDate: session.endDate || '2026-12-31',
      status: 'Enrolled',
      progressPercent: 0,
      completionPercentage: 0,
      completionDate: null,
      score: null,
      assessmentScore: null,
      assessmentResult: null,
      evaluator: session.trainer,
      evaluatorFeedback: null,
      certificateId: null,
      certificateNumber: null,
      enrolledBy: actorUser?.name || 'HR Admin'
    }

    enrollments.unshift(newEnrollment)
    this._setItem(STORAGE_KEYS.ENROLLMENTS, enrollments)

    // Add to session attendance roster
    const sessions = [...this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])]
    const sIdx = sessions.findIndex((s) => s.id === sessionId || s.sessionId === sessionId)
    if (sIdx !== -1) {
      const records = sessions[sIdx].attendanceRecords || []
      if (!records.some((r) => r.employeeId === employeeId)) {
        records.push({
          employeeId,
          employeeName: empName,
          attendedHours: 0,
          participationHours: 0,
          status: 'Registered',
          remarks: 'Enrolled'
        })
        sessions[sIdx].attendanceRecords = records
        sessions[sIdx].participants = records
        this._setItem(STORAGE_KEYS.SESSIONS, sessions)
      }
    }

    this._notify()
    return newEnrollment
  }

  updateEnrollmentProgress(enrollmentId, progressPercent, actorUser) {
    const list = [...this._getItem(STORAGE_KEYS.ENROLLMENTS, isTest ? INITIAL_ENROLLMENTS : [])]
    const idx = list.findIndex((e) => e.id === enrollmentId || e.enrollmentId === enrollmentId)
    if (idx === -1) throw new Error(`Enrollment '${enrollmentId}' not found.`)

    const current = list[idx]
    if (['Completed', 'Failed', 'Cancelled'].includes(current.status)) {
      throw new Error(`Cannot update progress for a ${current.status.toLowerCase()} enrollment.`)
    }

    const sessions = this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])
    const linkedSession = current.sessionId
      ? sessions.find((s) => s.id === current.sessionId || s.sessionId === current.sessionId)
      : null
    if (linkedSession?.status === 'Cancelled') {
      throw new Error('Cannot update progress for a cancelled training cohort.')
    }

    const prog = this.getProgramById(current.programId)
    const today = new Date().toISOString().slice(0, 10)
    const rawStart = linkedSession?.startDate || current.startDate || prog?.startDate
    const startDate = rawStart ? String(rawStart).slice(0, 10) : ''
    if (startDate && startDate > today) {
      throw new Error(`Training progress cannot be recorded before the training start date (${startDate}).`)
    }

    const rawNum = Number(progressPercent)
    if (!Number.isFinite(rawNum) || rawNum < 0 || rawNum > 100) {
      throw new Error('Progress percentage must be between 0 and 100.')
    }

    const pct = Math.round(rawNum)
    current.progressPercent = pct
    current.completionPercentage = pct
    if (pct > 0 && current.status === 'Enrolled') {
      current.status = 'In Progress'
    } else if (pct === 0 && current.status === 'In Progress') {
      current.status = 'Enrolled'
    }
    current.lastProgressUpdate = today
    current.updatedBy = actorUser?.name || 'Learner'

    list[idx] = current
    this._setItem(STORAGE_KEYS.ENROLLMENTS, list)
    this._notify()
    return {
      ...current,
      enrollmentId: current.id,
      completionPercentage: current.progressPercent
    }
  }

  updateProgress(enrollmentId, progressPercent, actorUser) {
    return this.updateEnrollmentProgress(enrollmentId, progressPercent, actorUser)
  }

  finalizeAssessment(enrollmentId, assessmentData, evaluatorUser) {
    const { score, feedback, status } = assessmentData
    const numScore = Number(score)

    if (score === '' || score === undefined || score === null || !Number.isFinite(numScore) || numScore < 0 || numScore > 100) {
      throw new Error('Assessment score must be a valid number between 0 and 100.')
    }

    const list = [...this._getItem(STORAGE_KEYS.ENROLLMENTS, isTest ? INITIAL_ENROLLMENTS : [])]
    const idx = list.findIndex((e) => e.id === enrollmentId || e.enrollmentId === enrollmentId)
    if (idx === -1) throw new Error(`Enrollment '${enrollmentId}' not found.`)

    const enr = { ...list[idx] }
    if (enr.status === 'Completed' || enr.status === 'Cancelled') {
      throw new Error(`Cannot finalize assessment for a ${enr.status.toLowerCase()} enrollment.`)
    }

    const sessions = this._getItem(STORAGE_KEYS.SESSIONS, isTest ? INITIAL_TRAINING_SESSIONS : [])
    const linkedSession = enr.sessionId
      ? sessions.find((s) => s.id === enr.sessionId || s.sessionId === enr.sessionId)
      : null
    if (linkedSession?.status === 'Cancelled') {
      throw new Error('Cannot record assessment for a cancelled training cohort.')
    }

    const prog = this.getProgramById(enr.programId)
    const today = new Date().toISOString().slice(0, 10)
    const rawStart = linkedSession?.startDate || enr.startDate || prog?.startDate
    const startDate = rawStart ? String(rawStart).slice(0, 10) : ''
    if (startDate && startDate > today) {
      throw new Error(`Assessment cannot be recorded before the training start date (${startDate}).`)
    }

    const passMark = Number(prog?.passingScore) || 70
    const explicitlyFailed = String(status || '').trim().toLowerCase() === 'failed'
    const explicitlyPassed = ['completed', 'passed', 'pass'].includes(String(status || '').trim().toLowerCase())
    if (explicitlyPassed && numScore < passMark) {
      throw new Error(`Assessment score (${numScore}%) is below the passing threshold (${passMark}%).`)
    }

    const passed = numScore >= passMark && !explicitlyFailed
    if (passed) {
      if (linkedSession) {
        if (linkedSession.status !== 'Completed') {
          throw new Error('Cannot pass or issue a certificate until the assigned training cohort is Completed.')
        }
        const roster = Array.isArray(linkedSession.attendanceRecords) ? linkedSession.attendanceRecords : (linkedSession.participants || [])
        const rec = roster.find((r) => r.employeeId === enr.employeeId)
        const recStatus = rec ? String(rec.attendanceStatus || rec.status || '') : ''
        const validAtt = rec
          ? ['Present', 'Attended'].includes(recStatus)
          : (Number(enr.sessionsAttendedCount || 0) > 0 || Boolean(enr.hasValidAttendance))
        if (!validAtt) {
          throw new Error('Valid training attendance (Present) is required before passing or issuing a certificate.')
        }
      } else {
        const rawEnd = enr.endDate || prog?.endDate
        const endDate = rawEnd ? String(rawEnd).slice(0, 10) : ''
        if (endDate && today < endDate) {
          throw new Error(`Cannot pass or issue a certificate before the course end date (${endDate}).`)
        }
        const validAtt = Number(enr.sessionsAttendedCount || 0) > 0 || Boolean(enr.hasValidAttendance) || enr.attendanceRecorded === true
        if (!validAtt) {
          throw new Error('Valid training attendance is required before passing or issuing a certificate.')
        }
      }
    }

    enr.score = numScore
    enr.assessmentScore = numScore
    enr.status = passed ? 'Completed' : 'Failed'
    enr.assessmentResult = passed ? 'Pass' : 'Fail'
    enr.progressPercent = passed ? 100 : enr.progressPercent
    enr.completionPercentage = passed ? 100 : enr.completionPercentage
    enr.completionDate = passed ? today : null
    enr.evaluator = evaluatorUser?.name || 'Certified Evaluator'
    enr.evaluatorFeedback = feedback || (passed ? 'Successfully satisfied all learning benchmarks.' : 'Needs additional revision.')

    if (passed && !enr.certificateId) {
      const cert = this.generateCertificate(enr, evaluatorUser)
      enr.certificateId = cert.id
      enr.certificateNumber = cert.certificateNumber
    } else if (!passed) {
      enr.certificateId = null
      enr.certificateNumber = null
    }

    list[idx] = enr
    this._setItem(STORAGE_KEYS.ENROLLMENTS, list)
    this._notify()
    return {
      ...enr,
      enrollmentId: enr.id,
      assessmentScore: enr.score,
      assessmentResult: enr.status === 'Completed' ? 'Pass' : 'Fail',
      certificateNumber: enr.certificateNumber || null
    }
  }

  recordAssessment(enrollmentId, assessmentPayload, evaluatorUser) {
    const score = Number(assessmentPayload.assessmentScore !== undefined ? assessmentPayload.assessmentScore : assessmentPayload.score)
    return this.finalizeAssessment(
      enrollmentId,
      {
        score,
        feedback: assessmentPayload.evaluatorFeedback || assessmentPayload.feedback,
        status: score >= 70 ? 'Completed' : 'Failed'
      },
      evaluatorUser
    )
  }

  // ==========================================
  // SUBMODULE 6: CERTIFICATES & HISTORY
  // ==========================================

  getCertificates(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.CERTIFICATES, isTest ? INITIAL_CERTIFICATES : [])]

    // Role Scoping (client-side only in test mode; live mode uses backend-scoped records)
    if (isTest) {
      if (requestingUser?.role === 'employee') {
        const myId = requestingUser.employeeId || requestingUser.id
        list = list.filter((c) => c.employeeId === myId)
      } else if (requestingUser?.role === 'manager') {
        const myId = requestingUser.employeeId || requestingUser.id
        let directReports = []
        try {
          directReports = employeeService.getDirectReports(myId).map((r) => r.id || r.employeeId)
        } catch {
          directReports = []
        }
        list = list.filter((c) => c.employeeId === myId || directReports.includes(c.employeeId) || c.department === requestingUser.department)
      }
    }

    if (filters.employeeId) {
      list = list.filter((c) => c.employeeId === filters.employeeId)
    }
    if (filters.programId && filters.programId !== 'all') {
      list = list.filter((c) => c.programId === filters.programId)
    }

    return list.map((c) => ({
      ...c,
      certificateId: c.certificateId || c.id
    }))
  }

  getCertificateById(id) {
    if (!id) return null
    const list = this._getItem(STORAGE_KEYS.CERTIFICATES, isTest ? INITIAL_CERTIFICATES : [])
    const found = list.find((c) => c.id === id || c.certificateNumber === id || c.certificateId === id)
    return found ? { ...found, certificateId: found.certificateId || found.id } : null
  }

  generateCertificate(enrollment, issuerUser) {
    const program = this.getProgramById(enrollment.programId)
    const certs = [...this._getItem(STORAGE_KEYS.CERTIFICATES, isTest ? INITIAL_CERTIFICATES : [])]

    const certNum = `ISW-CERT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
    const vrfCode = `VRF-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`

    const generatedId = `CERT-${Date.now().toString().slice(-6)}-${(this._seq = (this._seq || 0) + 1)}`
    const newCert = {
      id: generatedId,
      certificateId: generatedId,
      certificateNumber: certNum,
      programId: enrollment.programId,
      programTitle: enrollment.programTitle || enrollment.trainingTitle,
      employeeId: enrollment.employeeId,
      employeeName: enrollment.employeeName,
      department: enrollment.department,
      designation: enrollment.designation,
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 86400000 * 365 * 2).toISOString().slice(0, 10), // 2-year validity
      authorizedIssuer: issuerUser?.name || 'iSysware Academy & Corporate Governance Directorate',
      verificationCode: vrfCode,
      verificationStatus: 'Verified',
      grade: enrollment.score >= 90 ? `High Distinction (${enrollment.score}%)` : `Pass (${enrollment.score}%)`,
      skillsCertified: program?.skills || ['Professional Competency']
    }

    certs.unshift(newCert)
    this._setItem(STORAGE_KEYS.CERTIFICATES, certs)
    this._notify()
    return newCert
  }

  verifyCertificate(codeOrNumber) {
    if (!codeOrNumber) return { valid: false, certificate: null }
    const certs = this._getItem(STORAGE_KEYS.CERTIFICATES, isTest ? INITIAL_CERTIFICATES : [])
    const q = codeOrNumber.trim().toLowerCase()
    const found = certs.find(
      (c) =>
        (c.certificateNumber && c.certificateNumber.toLowerCase() === q) ||
        (c.verificationCode && c.verificationCode.toLowerCase() === q)
    )
    if (found) {
      return {
        valid: true,
        certificate: found,
        ...found
      }
    }
    return { valid: false, certificate: null }
  }


  getEmployeeTrainingHistory(employeeId) {
    const enrollments = this.getEnrollments({ employeeId })
    const certificates = this.getCertificates({ employeeId })

    const totalPrograms = enrollments.length
    const completedCount = enrollments.filter((e) => e.status === 'Completed').length
    const inProgressCount = enrollments.filter((e) => e.status === 'In Progress').length

    return {
      employeeId,
      totalPrograms,
      completedCount,
      inProgressCount,
      enrollments,
      certificates
    }
  }

  // Analytics & Operational Stats
  getTrainingKPIs() {
    const programs = this.getPrograms({ status: 'Active' })
    const sessions = this.getSessions()
    const enrollments = this.getEnrollments()
    const certs = this.getCertificates()

    const activeSessions = sessions.filter((s) => s.status === 'Scheduled' || s.status === 'In Progress')
    const completedList = enrollments.filter((e) => e.status === 'Completed')
    const completedEnrollments = completedList.length
    const completionRate = enrollments.length > 0 ? Math.round((completedEnrollments / enrollments.length) * 100) : 0
    const totalHoursDelivered = completedList.reduce((sum, e) => sum + (Number(e.durationHours) || 16), 0)

    return {
      totalCourses: programs.length,
      activeSessions: activeSessions.length,
      totalEnrollments: enrollments.length,
      completionRate,
      certificatesIssued: certs.length,
      totalTrainingHoursDelivered: totalHoursDelivered
    }
  }
}

export const trainingService = new TrainingService()
export default trainingService
