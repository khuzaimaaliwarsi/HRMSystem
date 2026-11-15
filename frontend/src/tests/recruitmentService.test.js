import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recruitmentService, normalizeDateString } from '../services/recruitmentService.js'
import { employeeService } from '../services/employeeService.js'
import { dashboardService } from '../services/dashboardService.js'

// Reset state helper before testing suite runs
recruitmentService.resetToDefaults()

test('1. Requisition creation and required fields validation', () => {
  // Missing job title
  assert.throws(() => {
    recruitmentService.createRequisition({
      jobTitle: '',
      departmentId: 'DEP-002',
      openPositions: 2
    })
  }, /Job title is required/)

  // Missing department
  assert.throws(() => {
    recruitmentService.createRequisition({
      jobTitle: 'Senior QA Engineer',
      departmentId: '',
      openPositions: 2
    })
  }, /Department assignment is required/)

  // Zero or negative open positions
  assert.throws(() => {
    recruitmentService.createRequisition({
      jobTitle: 'Senior QA Engineer',
      departmentId: 'DEP-002',
      openPositions: 0
    })
  }, /Number of open positions must be at least 1/)

  // Successful creation
  const newReq = recruitmentService.createRequisition({
    jobTitle: 'DevOps Specialist',
    departmentId: 'DEP-002',
    departmentName: 'Engineering',
    teamId: 'TEAM-002',
    teamName: 'Web & Mobile Development',
    designationId: 'DES-004',
    designation: 'Software Engineer',
    hiringManagerId: 'EMP-003',
    hiringManagerName: 'Bilal Siddiqui',
    openPositions: 1,
    priority: 'High',
    proposedBudgetMax: 200000,
    expectedJoiningDate: '2026-12-01',
    description: 'DevOps specialist for CI/CD automation.'
  }, 'Bilal Siddiqui')

  assert.ok(newReq.id.startsWith('REQ-'))
  assert.equal(newReq.jobTitle, 'DevOps Specialist')
  assert.equal(newReq.status, 'Pending Approval')
})

test('2. Manager hiring request scope enforcement', () => {
  const managerUser = { role: 'manager', employeeId: 'EMP-003', name: 'Bilal Siddiqui' }
  const managerReqs = recruitmentService.getRequisitions({}, managerUser)

  // Every requisition in the list must belong to EMP-003
  assert.ok(managerReqs.length > 0)
  for (const req of managerReqs) {
    assert.ok(
      req.hiringManagerId === 'EMP-003' || req.createdBy === 'Bilal Siddiqui',
      `Requisition ${req.id} leaked outside manager scope`
    )
  }
})

test('3. Required vacancy approval before opening', () => {
  // Requisition must be approved by authorized authority to open a vacancy
  const draftReq = recruitmentService.createRequisition({
    jobTitle: 'UI/UX Visual Designer',
    departmentId: 'DEP-003',
    departmentName: 'Product & Design',
    openPositions: 1,
    priority: 'Medium',
    hiringManagerId: 'EMP-007',
    hiringManagerName: 'Fahad Mustafa'
  }, 'Fahad Mustafa')

  assert.equal(draftReq.status, 'Pending Approval')

  // Super Admin approves requisition -> Vacancy automatically opens
  const result = recruitmentService.approveRequisition(draftReq.id, 'Tariq Mehmood (Super Admin)')
  assert.equal(result.requisition.status, 'Approved')
  assert.ok(result.vacancy)
  assert.equal(result.vacancy.status, 'Open')
  assert.equal(result.vacancy.requisitionId, draftReq.id)
})

test('4. Vacancy authorized headcount limit enforcement', () => {
  // VAC-004 (Junior Frontend Developer) has openPositions: 1, filledPositions: 1
  const vac = recruitmentService.getVacancyById('VAC-004')
  assert.equal(vac.openPositions, 1)
  assert.equal(vac.filledPositions, 1)

  // Candidate with offer for an already filled vacancy
  const overCand = recruitmentService.createCandidate({
    fullName: 'Excess Candidate',
    email: 'excess.headcount@example.com',
    vacancyId: 'VAC-004'
  }, 'HR Admin')

  const offer = recruitmentService.createOffer({
    candidateId: overCand.id,
    vacancyId: 'VAC-004',
    offeredSalary: 110000
  }, 'HR Admin')
  recruitmentService.approveOffer(offer.id, 'Super Admin')
  recruitmentService.recordOfferResponse(offer.id, 'Accepted')

  // Attempting to convert candidate to an already filled vacancy must throw headcount error
  assert.throws(() => {
    recruitmentService.convertCandidateToEmployee(overCand.id, {
      actualJoiningDate: '2026-11-01',
      departmentId: vac.departmentId,
      designationId: vac.designationId,
      teamId: vac.teamId,
      managerId: vac.hiringManagerId
    }, 'HR Admin')
  }, /Headcount limit reached/)
})

test('5. Candidate creation and duplicate application prevention', () => {
  // Valid candidate creation
  const cand = recruitmentService.createCandidate({
    fullName: 'Sara Ahmed',
    email: 'sara.ahmed.test@example.com',
    phone: '+92 333 1112233',
    city: 'Rawalpindi',
    vacancyId: 'VAC-001',
    experienceYears: 4,
    skills: ['React', 'JavaScript', 'CSS'],
    expectedSalary: 190000,
    noticePeriodDays: 30
  }, 'Noman Bashir')

  assert.ok(cand.id.startsWith('CAN-'))
  assert.equal(cand.fullName, 'Sara Ahmed')
  assert.equal(cand.stage, 'Application Received')

  // Prevent duplicate application for same candidate & same vacancy while active
  assert.throws(() => {
    recruitmentService.createCandidate({
      fullName: 'Sara Ahmed',
      email: 'sara.ahmed.test@example.com',
      vacancyId: 'VAC-001'
    }, 'Noman Bashir')
  }, /already has an active application/)
})

test('6. Candidate stage transitions and audit trail', () => {
  const cand = recruitmentService.createCandidate({
    fullName: 'Hamza Malik',
    email: 'hamza.malik.audit@example.com',
    vacancyId: 'VAC-001'
  }, 'Recruiter')

  // Advance stage to Initial Screening
  const s1 = recruitmentService.updateCandidateStage(cand.id, 'Initial Screening', null, 'Ayesha Khan')
  assert.equal(s1.stage, 'Initial Screening')

  // Advance stage to Shortlisted
  const s2 = recruitmentService.updateCandidateStage(cand.id, 'Shortlisted', null, 'Bilal Siddiqui')
  assert.equal(s2.stage, 'Shortlisted')

  // Audit trail verification
  assert.ok(s2.stageHistory.length >= 2)
  const lastHistory = s2.stageHistory[s2.stageHistory.length - 1]
  assert.equal(lastHistory.stage, 'Shortlisted')
  assert.equal(lastHistory.actor, 'Bilal Siddiqui')
})

test('7. Interview scheduling validation', () => {
  // Missing required fields
  assert.throws(() => {
    recruitmentService.scheduleInterview({
      candidateId: '',
      vacancyId: 'VAC-001',
      scheduledDate: '2026-11-05',
      startTime: '10:00',
      endTime: '11:00',
      interviewerIds: ['EMP-003']
    })
  }, /Candidate selection is required/)

  assert.throws(() => {
    recruitmentService.scheduleInterview({
      candidateId: 'CAN-001',
      vacancyId: 'VAC-001',
      scheduledDate: '',
      startTime: '10:00',
      endTime: '11:00',
      interviewerIds: ['EMP-003']
    })
  }, /date.*required/i)
})

test('8. Interviewer overlapping time slot conflict detection', () => {
  // Schedule first interview
  const interviewDate = '2026-11-12'
  recruitmentService.scheduleInterview({
    candidateId: 'CAN-002',
    vacancyId: 'VAC-001',
    round: 'Technical Round 1',
    interviewType: 'Online',
    scheduledDate: interviewDate,
    startTime: '14:00',
    endTime: '15:00',
    interviewerIds: ['EMP-003'],
    interviewerNames: ['Bilal Siddiqui']
  }, 'HR Admin')

  // Attempt to schedule conflicting overlapping interview for EMP-003 at 14:30 - 15:30 on same date
  assert.throws(() => {
    recruitmentService.scheduleInterview({
      candidateId: 'CAN-003',
      vacancyId: 'VAC-001',
      round: 'Technical Round 2',
      interviewType: 'Online',
      scheduledDate: interviewDate,
      startTime: '14:30',
      endTime: '15:30',
      interviewerIds: ['EMP-003'],
      interviewerNames: ['Bilal Siddiqui']
    }, 'HR Admin')
  }, /conflict.*Bilal Siddiqui/i)
})

test('9. Interview evaluation scorecard and actor attribution', () => {
  // INT-001 is Scheduled for candidate CAN-002
  const interview = recruitmentService.getInterviewById('INT-001')
  assert.equal(interview.status, 'Scheduled')

  const evaluated = recruitmentService.submitInterviewEvaluation('INT-001', {
    technicalScore: 4,
    communicationScore: 5,
    experienceScore: 4,
    problemSolvingScore: 5,
    jobSkillsScore: 4,
    recommendation: 'Recommend Hire',
    comments: 'Strong React and architectural expertise, clear communicator.'
  }, 'Bilal Siddiqui')

  assert.equal(evaluated.status, 'Completed')
  assert.ok(evaluated.evaluation)
  assert.equal(evaluated.evaluation.overallRating, 4.4)
  assert.equal(evaluated.evaluation.evaluatedBy, 'Bilal Siddiqui')
  assert.equal(evaluated.evaluation.recommendation, 'Recommend Hire')
})

test('10. HR-only confidential notes visibility shielding', () => {
  const cand = recruitmentService.createCandidate({
    fullName: 'Private Note Candidate',
    email: 'private.note@example.com',
    vacancyId: 'VAC-001'
  }, 'Recruiter')

  // Add public note
  recruitmentService.addCandidateNote(cand.id, 'Candidate completed initial code test.', 'Recruiter', false)
  // Add confidential note
  recruitmentService.addCandidateNote(cand.id, 'Confidential salary negotiation ceiling is 180k.', 'HR Admin', true)

  // HR/Super Admin sees both notes
  const hrView = recruitmentService.getCandidateById(cand.id, { role: 'hr_admin' })
  assert.equal(hrView.notes.length, 2)

  // Manager sees ONLY non-confidential note
  const managerView = recruitmentService.getCandidateById(cand.id, { role: 'manager', employeeId: 'EMP-003' })
  assert.equal(managerView.notes.length, 1)
  assert.equal(managerView.notes[0].isConfidentialHrOnly, false)
})

test('11. Offer approval requirements', () => {
  // Draft offer
  const offer = recruitmentService.createOffer({
    candidateId: 'CAN-002',
    vacancyId: 'VAC-001',
    offeredDesignation: 'Senior Full Stack Engineer',
    departmentId: 'DEP-002',
    departmentName: 'Engineering',
    teamId: 'TEAM-002',
    teamName: 'Web & Mobile Development',
    reportingManagerId: 'EMP-003',
    reportingManagerName: 'Bilal Siddiqui',
    proposedCompensation: 220000,
    proposedJoiningDate: '2026-11-20',
    probationDurationMonths: 3
  }, 'Ayesha Khan')

  assert.equal(offer.status, 'Draft')

  // Submit for approval
  const submitted = recruitmentService.submitOfferForApproval(offer.id, 'Ayesha Khan')
  assert.equal(submitted.status, 'Pending Approval')

  // Super Admin approves
  const approved = recruitmentService.approveOffer(offer.id, 'Tariq Mehmood (Super Admin)')
  assert.equal(approved.status, 'Approved')
  assert.equal(approved.approvedBy, 'Tariq Mehmood (Super Admin)')
})

test('12. Accepted versus declined/rejected offer behavior', () => {
  // Test decline
  const offer1 = recruitmentService.createOffer({
    candidateId: 'CAN-003',
    vacancyId: 'VAC-001',
    offeredDesignation: 'UI/UX Designer',
    departmentId: 'DEP-003',
    departmentName: 'Product & Design',
    reportingManagerId: 'EMP-007',
    reportingManagerName: 'Fahad Mustafa',
    proposedCompensation: 160000
  }, 'HR Admin')
  recruitmentService.approveOffer(offer1.id, 'Super Admin')
  recruitmentService.issueOffer(offer1.id, 'HR Admin')

  const declined = recruitmentService.recordOfferResponse(offer1.id, 'Declined', 'Accepted counter-offer elsewhere', 'HR Admin')
  assert.equal(declined.status, 'Declined')

  // Cannot join a declined offer
  assert.throws(() => {
    recruitmentService.convertCandidateToEmployee('CAN-003', {
      actualJoiningDate: '2026-11-15',
      departmentId: 'DEP-003',
      designationId: 'DES-007',
      teamId: 'TEAM-004',
      managerId: 'EMP-007'
    }, 'HR Admin')
  }, /No approved or accepted offer found/)
})

test('13. Joining validation and required information', () => {
  // Missing actual joining date
  assert.throws(() => {
    recruitmentService.convertCandidateToEmployee('CAN-001', {
      actualJoiningDate: '',
      departmentId: 'DEP-002',
      designationId: 'DES-004'
    }, 'HR Admin')
  }, /Actual confirmed joining date is required/)

  // Missing department
  assert.throws(() => {
    recruitmentService.convertCandidateToEmployee('CAN-001', {
      actualJoiningDate: '2026-11-01',
      departmentId: '',
      designationId: 'DES-004'
    }, 'HR Admin')
  }, /Department and Designation assignments are required/)
})

test('14. Duplicate employee prevention against existing workforce', () => {
  // Candidate with email that already belongs to an active employee (zeeshan.ali@isysware.com)
  const cand = recruitmentService.createCandidate({
    fullName: 'Zeeshan Duplicate',
    email: 'zeeshan.dev@isysware.com',
    vacancyId: 'VAC-002'
  }, 'HR Admin')

  // Create an approved and accepted offer for candidate
  const offer = recruitmentService.createOffer({
    candidateId: cand.id,
    vacancyId: 'VAC-002',
    offeredDesignation: 'Senior Full Stack Engineer',
    departmentId: 'DEP-01',
    reportingManagerId: 'EMP-003',
    proposedCompensation: 220000
  }, 'HR Admin')
  recruitmentService.approveOffer(offer.id, 'Super Admin')
  recruitmentService.issueOffer(offer.id, 'HR Admin')
  recruitmentService.recordOfferResponse(offer.id, 'Accepted', null, 'HR Admin')

  // Attempting to convert candidate to employee must detect existing employee email and throw!
  assert.throws(() => {
    recruitmentService.convertCandidateToEmployee(cand.id, {
      actualJoiningDate: '2026-11-01',
      departmentId: 'DEP-01',
      designationId: 'DESIG-02',
      teamId: 'TEAM-01',
      managerId: 'EMP-003'
    }, 'HR Admin')
  }, /An existing employee with email.*already exists/)
})

test('15. Idempotent candidate-to-employee conversion', () => {
  // CAN-001 has accepted offer OFR-001
  const cand = recruitmentService.getCandidateById('CAN-001')
  assert.equal(cand.stage, 'Offer Stage')

  // First conversion
  const first = recruitmentService.convertCandidateToEmployee('CAN-001', {
    actualJoiningDate: '2026-11-01',
    departmentId: 'DEP-002',
    designationId: 'DES-004',
    teamId: 'TEAM-002',
    managerId: 'EMP-003',
    employmentCategory: 'Probationary',
    compensationBasis: 'Monthly Salary'
  }, 'Ayesha Khan')

  assert.ok(first.employee.id.startsWith('EMP-'))
  const assignedEmpId = first.employee.id

  // Second conversion call with same candidate must return identical employee record idempotently
  const second = recruitmentService.convertCandidateToEmployee('CAN-001', {
    actualJoiningDate: '2026-11-01',
    departmentId: 'DEP-002',
    designationId: 'DES-004'
  }, 'Ayesha Khan')

  assert.equal(second.employee.id, assignedEmpId)
  assert.equal(second.isAlreadyConverted, true)
})

test('16. Correct linking to F02 canonical employeeService', () => {
  // Verify newly created employee exists in canonical employeeService
  const cand = recruitmentService.getCandidateById('CAN-001')
  const linkedId = cand.linkedEmployeeId
  assert.ok(linkedId)

  const canonicalEmp = employeeService.getEmployeeById(linkedId)
  assert.ok(canonicalEmp)
  assert.equal(canonicalEmp.name, cand.fullName)
  assert.equal(canonicalEmp.departmentId, 'DEP-002')
  assert.equal(canonicalEmp.managerId, 'EMP-003')
})

test('17. Future joining date handling', () => {
  // Future joining date does not count as Active working employee yet (joinDate preserved)
  const cand = recruitmentService.getCandidateById('CAN-001')
  const emp = employeeService.getEmployeeById(cand.linkedEmployeeId)
  assert.equal(emp.joinDate, '2026-11-01')
})

test('18. Probation deadline calculations', () => {
  // Probation record auto-created for CAN-001
  const probRecords = recruitmentService.getProbationRecords({ employeeId: 'EMP-006' })
  assert.ok(probRecords.length > 0)
  const pr = probRecords[0]

  // Review due date is calculated 15 days prior to expected end date
  const expectedEnd = new Date(pr.expectedProbationEndDate)
  const reviewDue = new Date(pr.reviewDueDate)
  const diffDays = Math.round((expectedEnd - reviewDue) / (1000 * 60 * 60 * 24))
  assert.equal(diffDays, 15)
})

test('19. Probation manager recommendation submission', () => {
  // PRB-001 for EMP-006 (Usman Tariq), manager EMP-003 Bilal Siddiqui
  const updated = recruitmentService.submitManagerProbationReview('PRB-001', {
    performanceRating: 4.5,
    recommendation: 'Confirm Employment',
    strengths: 'Excellent technical progress in React and fast learner.',
    weaknesses: 'Needs more client-facing exposure.'
  }, 'Bilal Siddiqui')

  assert.equal(updated.currentStatus, 'Under Review')
  assert.ok(updated.managerReview)
  assert.equal(updated.managerReview.recommendation, 'Confirm Employment')
  assert.equal(updated.managerReview.evaluatedBy, 'Bilal Siddiqui')
})

test('20. HR and Super Admin approval routing for probation', () => {
  // HR reviews manager recommendation
  const hrReviewed = recruitmentService.submitHrProbationReview('PRB-001', {
    hrRecommendation: 'Confirm Employment',
    notes: 'HR records show 100% on-time attendance and no disciplinary cases.'
  }, 'Ayesha Khan')

  assert.ok(hrReviewed.hrReview)
  assert.equal(hrReviewed.hrReview.hrRecommendation, 'Confirm Employment')
  assert.equal(hrReviewed.hrReview.reviewedBy, 'Ayesha Khan')
})

test('21. Probation extension history and policy limit', () => {
  // PRB-002 (Noman Bashir) - extend probation
  const extended = recruitmentService.submitFinalProbationDecision('PRB-002', {
    decision: 'Extend Probation',
    extensionMonths: 2,
    reason: 'Additional time required to meet operational KPIs.'
  }, 'Tariq Mehmood (Super Admin)')

  assert.equal(extended.currentStatus, 'Extended')
  assert.equal(extended.extensionCount, 1)
  assert.equal(extended.extensionHistory.length, 1)
  assert.equal(extended.extensionHistory[0].extensionMonths, 2)
})

test('22. Confirmation updates employee career history and status', () => {
  // PRB-001 confirm employment
  const confirmed = recruitmentService.submitFinalProbationDecision('PRB-001', {
    decision: 'Confirm Employment',
    effectiveDate: '2026-10-26',
    remarks: 'Approved for full permanent employment.'
  }, 'Tariq Mehmood (Super Admin)')

  assert.equal(confirmed.currentStatus, 'Confirmed')

  // Check canonical employee record updated in employeeService
  const emp = employeeService.getEmployeeById('EMP-006')
  assert.equal(emp.status, 'Active')
  assert.equal(emp.employmentCategory, 'Permanent')

  // Check career history appended in canonical employeeService
  const history = employeeService.getCareerHistory('EMP-006')
  assert.ok(history.length >= 1)
  assert.ok(history.some((h) => (h.reason && h.reason.includes('Probation')) || (h.changeType && h.changeType.includes('STATUS'))))
})

test('23. Role-based recruitment data restrictions (confidential salary hidden from manager)', () => {
  const managerUser = { role: 'manager', employeeId: 'EMP-003', name: 'Bilal Siddiqui' }
  const candList = recruitmentService.getCandidates({}, managerUser)

  // Verify salary is shielded from manager
  for (const c of candList) {
    assert.equal(c.expectedSalary, undefined)
    assert.equal(c.maskedExpectedSalary, 'Confidential (HR/Admin Only)')
  }
})

test('24. F01 dashboard integration (open vacancies and pipeline count)', () => {
  const hrAdminData = dashboardService.getHrAdminData()
  // Ensure dashboard reflects active recruitment vacancies from recruitmentService
  assert.ok(hrAdminData.kpis.openVacancies >= 1)
  assert.equal(hrAdminData.kpis.openVacancies, recruitmentService.getVacancies({ status: 'Open' }).length)
  assert.ok(hrAdminData.recruitmentPipeline.length >= 5)
})

test('25. Existing F02 employee management regression verification', () => {
  // Total employees, reporting lines, departments and designations preserved
  const employees = employeeService.getEmployees()
  assert.ok(employees.length >= 14)

  // Verify Bilal Siddiqui (EMP-003) direct reports
  const bilalReports = employeeService.getDirectReports('EMP-003')
  assert.ok(bilalReports.length >= 3)
  const reportIds = bilalReports.map((e) => e.id)
  assert.ok(reportIds.includes('EMP-004'))
  assert.ok(reportIds.includes('EMP-005'))
  assert.ok(reportIds.includes('EMP-006'))
})

test('26. Draft Offer Creation vs Direct Submit for Approval', () => {
  // 1. Explicit Save as Draft
  const draftOffer = recruitmentService.createOffer({
    candidateId: 'CAN-002',
    vacancyId: 'VAC-001',
    offeredDesignation: 'Senior Frontend Engineer',
    offeredSalary: 230000,
    proposedJoiningDate: '2026-11-20',
    status: 'Draft'
  }, 'Ayesha Khan (HR Admin)')

  assert.equal(draftOffer.status, 'Draft')
  assert.equal(draftOffer.approvalStatus, 'Draft')
  assert.equal(draftOffer.approvalHistory[0].status, 'Drafted')

  // 2. Direct Submit for Approval
  const directOffer = recruitmentService.createOffer({
    candidateId: 'CAN-005',
    vacancyId: 'VAC-002',
    offeredDesignation: 'Account Executive',
    offeredSalary: 160000,
    proposedJoiningDate: '2026-12-01',
    status: 'Pending Approval',
    submitForApproval: true
  }, 'Ayesha Khan (HR Admin)')

  assert.equal(directOffer.status, 'Pending Approval')
  assert.equal(directOffer.approvalStatus, 'Pending Approval')
  assert.ok(directOffer.approvalHistory.some(h => h.status === 'Submitted for Approval'))
})

test('27. Draft Offer Editing (updateOffer) and Submission (submitOfferForApproval)', () => {
  const draft = recruitmentService.createOffer({
    candidateId: 'CAN-006',
    vacancyId: 'VAC-003',
    offeredDesignation: 'DevOps Engineer',
    offeredSalary: 280000,
    proposedJoiningDate: '2026-11-15',
    status: 'Draft'
  }, 'Ayesha Khan')

  assert.equal(draft.status, 'Draft')

  // Edit draft offer details
  const updated = recruitmentService.updateOffer(draft.id, {
    offeredSalary: 295000,
    proposedJoiningDate: '2026-11-25',
    termsRemarks: 'Includes specialized cloud certification allowance.'
  }, 'Ayesha Khan')

  assert.equal(updated.offeredSalary, 295000)
  assert.equal(updated.proposedJoiningDate, '2026-11-25')
  assert.equal(updated.termsRemarks, 'Includes specialized cloud certification allowance.')
  assert.equal(updated.status, 'Draft')

  // Submit draft offer for approval
  const submitted = recruitmentService.submitOfferForApproval(draft.id, 'Ayesha Khan')
  assert.equal(submitted.status, 'Pending Approval')
  assert.equal(submitted.approvalStatus, 'Pending Approval')
})

test('28. Complete Offer Workflow: Draft -> Pending Approval -> Approved -> Issued -> Accepted -> Joined', () => {
  // Step 1: Draft
  const offer = recruitmentService.createOffer({
    candidateId: 'CAN-008',
    vacancyId: 'VAC-001',
    offeredDesignation: 'Senior Frontend Developer',
    offeredSalary: 235000,
    proposedJoiningDate: '2026-11-02',
    status: 'Draft'
  }, 'HR Admin')
  assert.equal(offer.status, 'Draft')

  // Step 2: Submit for Approval -> Pending Approval
  recruitmentService.submitOfferForApproval(offer.id, 'HR Admin')
  assert.equal(offer.status, 'Pending Approval')

  // Step 3: Approve -> Approved
  recruitmentService.approveOffer(offer.id, 'Tariq Mehmood (Super Admin)')
  assert.equal(offer.status, 'Approved')
  assert.equal(offer.approvalStatus, 'Approved')

  // Step 4: Issue Offer -> Issued
  recruitmentService.issueOffer(offer.id, 'HR Admin')
  assert.equal(offer.status, 'Issued')

  // Step 5: Candidate Acceptance -> Accepted
  recruitmentService.recordCandidateOfferResponse(offer.id, 'Accepted', '', 'HR Admin')
  assert.equal(offer.status, 'Accepted')

  // Candidate stage remains 'Offer Stage' until joined
  const cand = recruitmentService.getCandidateById('CAN-008')
  assert.equal(cand.stage, 'Offer Stage')

  // Step 6: Confirm Joining -> Joined & Employee Created
  const joinRes = recruitmentService.convertCandidateToEmployee({
    candidateId: 'CAN-008',
    offerId: offer.id,
    actualJoiningDate: '2026-11-02',
    departmentId: 'DEP-01',
    designationId: 'DESIG-02',
    teamId: 'TEAM-01',
    managerId: 'EMP-003'
  }, 'HR Admin')

  assert.ok(joinRes.employee)
  assert.equal(offer.status, 'Joined')
  assert.equal(offer.linkedEmployeeId, joinRes.employee.id)
  assert.ok(offer.approvalHistory.some(h => h.status === 'Joined'))

  // Candidate stage is now Hired
  const hiredCand = recruitmentService.getCandidateById('CAN-008')
  assert.equal(hiredCand.stage, 'Hired')
  assert.equal(hiredCand.status, 'Hired')
})

test('29. Offer Disapproval / Rejection with Reason (rejectOffer)', () => {
  const offer = recruitmentService.createOffer({
    candidateId: 'CAN-009',
    vacancyId: 'VAC-001',
    offeredDesignation: 'Senior Frontend Developer',
    offeredSalary: 350000, // Excessive salary
    proposedJoiningDate: '2026-12-01',
    status: 'Pending Approval'
  }, 'HR Admin')

  const rejected = recruitmentService.rejectOffer(offer.id, 'Budget cap exceeded for Q4 hiring cycle.', 'Tariq Mehmood (Super Admin)')
  assert.equal(rejected.status, 'Rejected')
  assert.equal(rejected.approvalStatus, 'Rejected')
  assert.equal(rejected.rejectionReason, 'Budget cap exceeded for Q4 hiring cycle.')
  assert.ok(rejected.approvalHistory.some(h => h.status === 'Rejected' && h.note.includes('Budget cap exceeded')))
})

test('30. Calendar Date Preservation (2026-11-02 without timezone swap or corruption)', () => {
  // Test normalizeDateString utility
  assert.equal(normalizeDateString('2026-11-02'), '2026-11-02')
  assert.equal(normalizeDateString('2026-11-02T00:00:00.000Z'), '2026-11-02')
  assert.equal(normalizeDateString('02/11/2026'), '2026-11-02')
  assert.equal(normalizeDateString('02-11-2026'), '2026-11-02')

  // Test offer creation strictly preserves 2026-11-02
  const offer = recruitmentService.createOffer({
    candidateId: 'CAN-010',
    vacancyId: 'VAC-002',
    offeredDesignation: 'Enterprise Account Executive',
    offeredSalary: 175000,
    proposedJoiningDate: '2026-11-02',
    status: 'Draft'
  }, 'HR Admin')

  assert.equal(offer.proposedJoiningDate, '2026-11-02')
  assert.notEqual(offer.proposedJoiningDate, '2026-02-09')
  assert.notEqual(offer.proposedJoiningDate, '2026-02-11')

  // Updating date to 2026-11-02 is preserved
  const updated = recruitmentService.updateOffer(offer.id, {
    proposedJoiningDate: '2026-11-02'
  }, 'HR Admin')
  assert.equal(updated.proposedJoiningDate, '2026-11-02')
})

test('31. Role Consistency & Role Deviation Justification Tracking', () => {
  // Candidate CAN-004 applied for vacancy VAC-003 ('Lead Cloud & DevOps Architect')
  // If offered role differs, it requires justification and persists offered role accurately
  const offer = recruitmentService.createOffer({
    candidateId: 'CAN-004',
    vacancyId: 'VAC-003',
    appliedRole: 'Lead Cloud & DevOps Architect',
    offeredDesignation: 'Principal Infrastructure Architect',
    designationId: 'DESIG-01',
    roleDeviationJustification: 'Candidate demonstrated higher architectural scope during final evaluation.',
    offeredSalary: 380000,
    proposedJoiningDate: '2026-11-15',
    status: 'Draft'
  }, 'HR Admin')

  assert.equal(offer.offeredDesignation, 'Principal Infrastructure Architect')
  assert.equal(offer.appliedRole, 'Lead Cloud & DevOps Architect')
  assert.equal(offer.roleDeviationJustification, 'Candidate demonstrated higher architectural scope during final evaluation.')

  // When updated, deviation justification is preserved
  const updated = recruitmentService.updateOffer(offer.id, {
    offeredDesignation: 'Cloud Systems Lead',
    roleDeviationJustification: 'Adjusted title per department master structure.'
  }, 'HR Admin')

  assert.equal(updated.offeredDesignation, 'Cloud Systems Lead')
  assert.equal(updated.roleDeviationJustification, 'Adjusted title per department master structure.')
})

test('32. Duplicate Joining & Employee Creation Prevention on Joined Offers', () => {
  // Offer OFR-001 is already accepted for CAN-001
  // Joining once succeeds
  const firstJoin = recruitmentService.convertCandidateToEmployee({
    candidateId: 'CAN-001',
    offerId: 'OFR-001',
    actualJoiningDate: '2026-11-01',
    departmentId: 'DEP-01',
    designationId: 'DESIG-02',
    teamId: 'TEAM-01',
    managerId: 'EMP-003'
  }, 'HR Admin')

  assert.ok(firstJoin.employee)
  const offer = recruitmentService.getOffers().find(o => o.id === 'OFR-001')
  assert.equal(offer.status, 'Joined')
  assert.equal(offer.linkedEmployeeId, firstJoin.employee.id)

  // Subsequent attempt to join the same candidate / offer is idempotent and does not create duplicate
  const secondJoin = recruitmentService.convertCandidateToEmployee({
    candidateId: 'CAN-001',
    offerId: 'OFR-001',
    actualJoiningDate: '2026-11-01',
    departmentId: 'DEP-01',
    designationId: 'DESIG-02',
    teamId: 'TEAM-01',
    managerId: 'EMP-003'
  }, 'HR Admin')

  assert.equal(secondJoin.alreadyJoined, true)
  assert.equal(secondJoin.employee.id, firstJoin.employee.id)
})
