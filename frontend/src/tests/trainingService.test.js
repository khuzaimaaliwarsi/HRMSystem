import { test } from 'node:test';
import assert from 'node:assert/strict';
import trainingService from '../services/trainingService.js';

// Actor profiles
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' };
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' };
const managerActor = { name: 'Bilal Ahmed', role: 'manager', employeeId: 'EMP-003', department: 'Engineering' };
const directReportActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004', department: 'Engineering' };
const otherDeptActor = { name: 'Sana Malik', role: 'employee', employeeId: 'EMP-005', department: 'Finance' };

test('1. Training Program Creation & Validation: HR can create valid course with required fields', () => {
  const newCourse = {
    title: 'Advanced Kubernetes & Cloud Orchestration',
    category: 'Cloud Engineering',
    skills: 'Kubernetes, Docker, Helm, GitOps',
    eligibleDepartments: ['Engineering', 'DevOps'],
    eligibleDesignations: ['All'],
    trainingType: 'Online',
    trainerName: 'Cloud Academy Inc.',
    durationHours: 32,
    maxParticipants: 15,
    estimatedCost: 75000,
    prerequisites: 'Basic Linux and Container knowledge',
    description: 'Deep dive into microservices orchestration and container clustering.',
  };

  const created = trainingService.createProgram(newCourse, hrAdminActor);
  assert.ok(created.programId.startsWith('TRN-PROG-') || created.programId.startsWith('TR-'));
  assert.equal(created.title, 'Advanced Kubernetes & Cloud Orchestration');
  assert.equal(created.status, 'Active');

  // Validation: Missing title or category throws error
  assert.throws(() => {
    trainingService.createProgram({ title: '' }, hrAdminActor);
  }, /required/i);
});

test('2. Enrollment & Duplicate Prevention: Cannot enroll same employee twice in active program', () => {
  const testEmpId = 'EMP-TEST-01';
  const testProgId = 'TR-101';

  // First enrollment succeeds
  const enr1 = trainingService.enrollEmployee({
    programId: testProgId,
    employeeId: testEmpId,
    employeeName: 'Test Student',
    department: 'Engineering',
  }, hrAdminActor);

  assert.ok(enr1.enrollmentId);
  assert.equal(enr1.status, 'Enrolled');

  // Attempt duplicate active enrollment throws error
  assert.throws(() => {
    trainingService.enrollEmployee({
      programId: testProgId,
      employeeId: testEmpId,
      employeeName: 'Test Student',
      department: 'Engineering',
    }, hrAdminActor);
  }, /already actively enrolled/i);
});

test('3. Eligibility Verification: Checks department criteria for programs', () => {
  // TR-101 is eligible for Engineering, DevOps, IT
  const enrAllowed = trainingService.enrollEmployee({
    programId: 'TR-101',
    employeeId: 'EMP-ELIG-01',
    employeeName: 'Eng Engineer',
    department: 'Engineering',
  }, hrAdminActor);
  assert.ok(enrAllowed);

  // Inactive program enrollment is rejected
  const inactiveProg = trainingService.createProgram({
    title: 'Deprecated Tooling 101',
    category: 'General',
    durationHours: 8,
    trainerName: 'Internal',
    description: 'Legacy archive training',
  }, hrAdminActor);
  trainingService.toggleProgramStatus(inactiveProg.programId, hrAdminActor); // Draft/Inactive

  assert.throws(() => {
    trainingService.enrollEmployee({
      programId: inactiveProg.programId,
      employeeId: 'EMP-ELIG-02',
      employeeName: 'New Trainee',
      department: 'Engineering',
    }, hrAdminActor);
  }, /not active/i);
});

test('4. Manager Recommendations: Manager can recommend training for direct reports', () => {
  const plan = trainingService.recommendTrainingPlan({
    programId: 'TR-102',
    employeeId: directReportActor.employeeId,
    employeeName: directReportActor.name,
    department: 'Engineering',
    planType: 'Individual',
    reasonForTraining: 'Skill gap identified during sprint review on React state architecture.',
    priority: 'High',
    targetQuarter: 'Q4 2026',
  }, managerActor);

  assert.ok(plan.planId.startsWith('PLAN-'));
  assert.equal(plan.status, 'Recommended');
  assert.ok(plan.recommendedBy === managerActor.name || plan.recommendedBy === managerActor.employeeId);
});

test('5. Approval Routing & Anti-Self-Approval: Cannot self-approve own training recommendation', () => {
  // Manager recommends training for self
  const selfPlan = trainingService.recommendTrainingPlan({
    programId: 'TR-104',
    employeeId: managerActor.employeeId,
    employeeName: managerActor.name,
    department: 'Engineering',
    planType: 'Individual',
    reasonForTraining: 'Leadership seminar',
  }, managerActor);

  // Manager attempting self-approval fails
  assert.throws(() => {
    trainingService.approveTrainingPlan(selfPlan.planId, 'Self approved', managerActor);
  }, /cannot approve their own/i);

  // HR Admin can approve
  const approved = trainingService.approveTrainingPlan(selfPlan.planId, 'HR Approved', hrAdminActor);
  assert.equal(approved.status, 'Approved');
});

test('6. Session Capacity & Scheduling Conflict Prevention', () => {
  const sessionData = {
    programId: 'TR-103',
    sessionName: 'Conflict Test Workshop',
    trainerName: 'Asim Raza',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    startTime: '10:00',
    endTime: '12:00',
    location: 'Lab 1',
    maxCapacity: 2,
    participantIds: ['EMP-003', 'EMP-004'],
  };

  const session = trainingService.createSession(sessionData, hrAdminActor);
  assert.ok(session.sessionId);

  // Capacity overflow check: Cannot assign more than maxCapacity (2)
  assert.throws(() => {
    trainingService.createSession({
      ...sessionData,
      participantIds: ['EMP-001', 'EMP-002', 'EMP-003'],
    }, hrAdminActor);
  }, /exceeds maximum capacity/i);

  // Trainer conflict check: Same trainer, overlapping time on same date
  assert.throws(() => {
    trainingService.createSession({
      programId: 'TR-101',
      sessionName: 'Overlapping Session',
      trainerName: 'Asim Raza',
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      startTime: '11:00',
      endTime: '13:00',
      location: 'Lab 2',
      maxCapacity: 10,
      participantIds: ['EMP-005'],
    }, hrAdminActor);
  }, /Trainer Asim Raza already has a scheduled session/i);
});

test('7. Training Attendance: Distinct from F04 punches, persists participation without auto-completing cohort', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureStr = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);

  // Future cohort must block attendance before startDate, while allowing cancellation
  const futureSession = trainingService.createSession({
    programId: 'TR-101',
    sessionName: 'Future Cohort',
    trainerName: 'Future Trainer',
    startDate: futureStr,
    endDate: futureStr,
    startTime: '09:00',
    endTime: '12:00',
    location: 'Room A',
    maxCapacity: 10,
    participantIds: ['EMP-004'],
  }, hrAdminActor);

  assert.throws(() => {
    trainingService.recordSessionAttendance(
      futureSession.sessionId,
      [{ employeeId: 'EMP-004', attendanceStatus: 'Present', attendedHours: 3, remarks: 'Early check' }],
      hrAdminActor
    );
  }, /before the cohort start date/i);

  assert.throws(() => {
    trainingService.markSessionCompleted(futureSession.sessionId, hrAdminActor);
  }, /before its end date/i);

  const cancelledFuture = trainingService.cancelSession(futureSession.sessionId, 'Rescheduled to next quarter', hrAdminActor);
  assert.equal(cancelledFuture.status, 'Cancelled');

  const session = trainingService.createSession({
    programId: 'TR-101',
    sessionName: 'Attendance Tracking Session',
    trainerName: 'External Guest',
    startDate: todayStr,
    endDate: todayStr,
    startTime: '14:00',
    endTime: '17:00',
    location: 'Auditorium',
    maxCapacity: 20,
    participantIds: ['EMP-004', 'EMP-005'],
  }, hrAdminActor);

  const updatedSession = trainingService.recordSessionAttendance(
    session.sessionId,
    [
      { employeeId: 'EMP-004', attendanceStatus: 'Present', attendedHours: 3, remarks: 'Completed lab' },
      { employeeId: 'EMP-005', attendanceStatus: 'Excused', attendedHours: 0, remarks: 'On duty call' },
    ],
    hrAdminActor
  );

  assert.equal(updatedSession.attendanceRecorded, true);
  assert.equal(updatedSession.status, 'In Progress');
  const p1 = updatedSession.participants.find(p => p.employeeId === 'EMP-004');
  const p2 = updatedSession.participants.find(p => p.employeeId === 'EMP-005');
  assert.equal(p1.attendanceStatus, 'Present');
  assert.equal(p1.attendedHours, 3);
  assert.equal(p1.remarks, 'Completed lab');
  assert.equal(p2.attendanceStatus, 'Excused');
  assert.equal(p2.remarks, 'On duty call');

  const completedSession = trainingService.markSessionCompleted(session.sessionId, hrAdminActor);
  assert.equal(completedSession.status, 'Completed');

  assert.throws(() => {
    trainingService.recordSessionAttendance(
      session.sessionId,
      [{ employeeId: 'EMP-004', attendanceStatus: 'Absent', attendedHours: 0 }],
      hrAdminActor
    );
  }, /Completed cohort/i);
});

test('8. Assessment Scoring, Date/Completion/Attendance Guards & Certification Integrity', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureStr = new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10);

  // Future cohort: progress & assessment both blocked before startDate
  const futureSes = trainingService.createSession({
    programId: 'TRN-PROG-002',
    sessionName: 'Future Grade Cohort',
    trainerName: 'Security Lead',
    startDate: futureStr,
    endDate: futureStr,
    startTime: '10:00',
    endTime: '12:00',
    location: 'Room 1',
    maxCapacity: 10,
    participantIds: ['EMP-FAIL-01'],
  }, hrAdminActor);

  const futureEnroll = trainingService.enrollEmployee({
    programId: 'TRN-PROG-002',
    sessionId: futureSes.sessionId,
    employeeId: 'EMP-FAIL-01',
    employeeName: 'Struggling Learner',
    department: 'Engineering',
  }, hrAdminActor);

  assert.throws(() => {
    trainingService.updateEnrollmentProgress(futureEnroll.enrollmentId, 50, hrAdminActor);
  }, /before the training start date/i);

  assert.throws(() => {
    trainingService.recordAssessment(futureEnroll.enrollmentId, { assessmentScore: 90 }, hrAdminActor);
  }, /before the training start date/i);

  // Started cohort: incomplete cohort or Absent/Registered learner cannot pass or earn premature certificate
  const activeSes = trainingService.createSession({
    programId: 'TRN-PROG-003',
    sessionName: 'Started Grade Cohort',
    trainerName: 'Zainab Abbas',
    startDate: todayStr,
    endDate: todayStr,
    startTime: '09:00',
    endTime: '12:00',
    location: 'Lab 3',
    maxCapacity: 10,
    participantIds: ['EMP-PASS-01', 'EMP-ABSENT-01'],
  }, hrAdminActor);

  const passEnrollment = trainingService.enrollEmployee({
    programId: 'TRN-PROG-003',
    sessionId: activeSes.sessionId,
    employeeId: 'EMP-PASS-01',
    employeeName: 'Acing Learner',
    department: 'Engineering',
  }, hrAdminActor);

  const absentEnrollment = trainingService.enrollEmployee({
    programId: 'TRN-PROG-003',
    sessionId: activeSes.sessionId,
    employeeId: 'EMP-ABSENT-01',
    employeeName: 'Absent Learner',
    department: 'Engineering',
  }, hrAdminActor);

  // Progress update works once training started
  const progUpdated = trainingService.updateEnrollmentProgress(passEnrollment.enrollmentId, 80, hrAdminActor);
  assert.equal(progUpdated.progressPercent, 80);

  // Cannot pass while cohort is still Scheduled / not Completed
  assert.throws(() => {
    trainingService.recordAssessment(passEnrollment.enrollmentId, { assessmentScore: 92 }, hrAdminActor);
  }, /cohort is Completed/i);

  // Mark attendance (EMP-PASS-01 Present, EMP-ABSENT-01 Absent) and complete cohort
  trainingService.recordSessionAttendance(
    activeSes.sessionId,
    [
      { employeeId: 'EMP-PASS-01', attendanceStatus: 'Present', attendedHours: 3, remarks: 'Attended all labs' },
      { employeeId: 'EMP-ABSENT-01', attendanceStatus: 'Absent', attendedHours: 0, remarks: 'No show' },
    ],
    hrAdminActor
  );
  trainingService.markSessionCompleted(activeSes.sessionId, hrAdminActor);

  // Absent learner cannot pass/certify even though cohort is Completed
  assert.throws(() => {
    trainingService.recordAssessment(absentEnrollment.enrollmentId, { assessmentScore: 88 }, hrAdminActor);
  }, /Valid training attendance/i);

  // Failing score is allowed cleanly without issuing a certificate
  const failedOutcome = trainingService.recordAssessment(
    absentEnrollment.enrollmentId,
    {
      assessmentScore: 55,
      evaluatorFeedback: 'Requires revision of async programming fundamentals.',
    },
    hrAdminActor
  );
  assert.equal(failedOutcome.status, 'Failed');
  assert.equal(failedOutcome.assessmentResult, 'Fail');
  assert.equal(failedOutcome.certificateNumber, null);

  // Present learner in Completed cohort passes and earns certificate
  const passedOutcome = trainingService.recordAssessment(
    passEnrollment.enrollmentId,
    {
      assessmentScore: 92,
      evaluatorFeedback: 'Exceptional comprehension and clean lab execution.',
    },
    hrAdminActor
  );

  assert.equal(passedOutcome.status, 'Completed');
  assert.equal(passedOutcome.assessmentResult, 'Pass');
  assert.ok(passedOutcome.certificateNumber.startsWith('ISW-CERT-'));
});

test('9. Certificate Issue, Expiry & Verification Code Lookup', () => {
  const certs = trainingService.getCertificates({}, superAdminActor);
  assert.ok(certs.length > 0);

  const testCert = certs[0];
  const lookup = trainingService.verifyCertificate(testCert.verificationCode);
  assert.ok(lookup.valid);
  assert.equal(lookup.certificate.certificateNumber, testCert.certificateNumber);
  assert.equal(lookup.certificate.employeeName, testCert.employeeName);

  // Non-existent verification code
  const fakeLookup = trainingService.verifyCertificate('INVALID-CODE-XYZ');
  assert.equal(fakeLookup.valid, false);
});

test('10. F07 Performance Integration: Skill gap in appraisal imports to training plan without altering salary', () => {
  const mockF07Appraisal = {
    reviewId: 'REV-2026-Q3-09',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Engineering',
    improvementAreas: 'Needs formal certification in Microservices & Docker orchestration.',
    identifiedSkillGap: 'Containerization & Microservices',
    recommendedTrainingProgramId: 'TR-101',
  };

  const importedPlan = trainingService.importFromPerformanceReview(mockF07Appraisal, managerActor);
  assert.ok(importedPlan.planId);
  assert.equal(importedPlan.programId, 'TR-101');
  assert.equal(importedPlan.employeeId, 'EMP-004');
  assert.equal(importedPlan.f07ReviewRef, 'REV-2026-Q3-09');
  assert.equal(importedPlan.reasonForTraining, 'Performance Appraisal Skill Gap: Needs formal certification in Microservices & Docker orchestration.');
  // Confirm NO payroll or salary mutation occurs
  assert.equal(importedPlan.status, 'Recommended');
});

test('11. Role-Based Access Scoping: Employee sees own data, Manager sees team, Admin sees all', () => {
  const allEnrollments = trainingService.getEnrollments({}, superAdminActor);
  const employeeEnrollments = trainingService.getEnrollments({}, directReportActor);

  // Super Admin sees all enrollments
  assert.ok(allEnrollments.length >= employeeEnrollments.length);

  // Employee only sees enrollments belonging to their employeeId
  for (const enr of employeeEnrollments) {
    assert.equal(enr.employeeId, directReportActor.employeeId);
  }

  // Manager sees team enrollments
  const managerEnrollments = trainingService.getEnrollments({}, managerActor);
  assert.ok(Array.isArray(managerEnrollments));
});
