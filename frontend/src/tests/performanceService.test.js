import { test } from 'node:test';
import assert from 'node:assert/strict';
import taskService from '../services/taskService.js';
import kpiService from '../services/kpiService.js';
import performanceService from '../services/performanceService.js';
import compensationService from '../services/compensationService.js';

// Actors for tests
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' };
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' };
const managerActor = { name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003' };
const employeeActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004' };

test('1. Task Service: Creates new task with assignment, priority, and dates', () => {
  const newTask = taskService.createTask(
    {
      title: 'Develop Vitest Automated Test Harness',
      description: 'Create end-to-end integration tests for task lifecycle.',
      departmentId: 'DEP-01',
      department: 'Engineering & Technology',
      assignedToId: 'EMP-004',
      assignedToName: 'Zeeshan Ali',
      priority: 'High',
      estimatedHours: 20,
      dueDate: '2026-11-10'
    },
    managerActor
  );

  assert.ok(newTask.id);
  assert.equal(newTask.title, 'Develop Vitest Automated Test Harness');
  assert.equal(newTask.status, 'To Do');
  assert.equal(newTask.progress, 0);
  assert.equal(newTask.assignedToId, 'EMP-004');
  assert.equal(newTask.assignedById, 'EMP-003');
});

test('2. Task Service: Enforces role isolation (Employee sees only assigned tasks, Manager sees team)', () => {
  const empTasks = taskService.getTasks({}, employeeActor);
  // All tasks returned must belong to EMP-004
  for (const t of empTasks) {
    assert.equal(t.assignedToId, 'EMP-004');
  }

  const mgrTasks = taskService.getTasks({}, managerActor);
  // Manager Bilal (EMP-003) oversees his reports (EMP-004, EMP-005, EMP-006)
  assert.ok(mgrTasks.length >= empTasks.length);
});

test('3. Task Service: Updates progress percentage and transitions status to In Progress and Completed', () => {
  const tasks = taskService.getTasks({}, employeeActor);
  const task = tasks[0];

  // Update progress to 50%
  const updated50 = taskService.updateTaskProgress(task.id, 50, null, employeeActor);
  assert.equal(updated50.progress, 50);
  assert.equal(updated50.status, 'In Progress');

  // Update progress to 100%
  const updated100 = taskService.updateTaskProgress(task.id, 100, null, employeeActor);
  assert.equal(updated100.progress, 100);
  assert.equal(updated100.status, 'Completed');
  assert.ok(updated100.completionDate);
});

test('4. Task Service: Adds comments and tracks activity history', () => {
  const tasks = taskService.getTasks({}, employeeActor);
  const task = tasks[0];

  const comment = taskService.addTaskComment(task.id, 'Pushed code to feature branch for code review.', employeeActor);
  assert.ok(comment.id);
  assert.equal(comment.author, employeeActor.name);

  const reloaded = taskService.getTaskById(task.id);
  const lastCmt = reloaded.comments[reloaded.comments.length - 1];
  assert.equal(lastCmt.text, 'Pushed code to feature branch for code review.');
});

test('5. KPI Service: Retrieves role-specific KPIs and calculates achievement score', () => {
  const devKpis = kpiService.getKpis({ departmentId: 'DEP-01' });
  assert.ok(devKpis.length > 0);
  const deliveryKpi = devKpis.find((k) => k.code === 'ENG-DELIVERY');
  assert.ok(deliveryKpi);
  assert.equal(deliveryKpi.targetValue, 90);

  // Score calculation: Target 90%, Actual 95% -> 106% achievement
  const score = kpiService.calculateAchievementScore(90, 95, 'Percentage');
  assert.equal(score.achievementPercent, 106);
  assert.equal(score.isExceeded, true);
});

test('6. KPI Service: Validates weight percentage constraints', () => {
  assert.throws(() => {
    kpiService.createKpi({
      name: 'Invalid Weight KPI',
      code: 'INV-01',
      weightPercent: 120 // exceeds 100
    });
  }, /Weight must be between 1% and 100%/i);
});

test('7. Performance Service: Submits employee self-assessment with score and comments', () => {
  const reviews = performanceService.getReviews({}, employeeActor);
  const myReview = reviews.find((r) => r.employeeId === 'EMP-004');
  assert.ok(myReview);

  const updated = performanceService.submitSelfAssessment(
    myReview.id,
    4.5,
    'Delivered responsive dashboard UI and payroll components on schedule.',
    employeeActor
  );

  assert.equal(updated.selfRating, 4.5);
  assert.equal(updated.status, 'Self Assessment Submitted');
});

test('8. Performance Service: Strictly enforces anti-self-evaluation for managers', () => {
  const reviews = performanceService.getReviews();
  const managerReview = reviews.find((r) => r.employeeId === 'EMP-003'); // Bilal Siddiqui
  if (managerReview) {
    assert.throws(() => {
      // Bilal Siddiqui evaluating himself
      performanceService.submitManagerEvaluation(managerReview.id, { managerRating: 5.0 }, managerActor);
    }, /Anti-Self-Approval violation/i);
  }
});

test('9. Performance Service: Manager conducts appraisal evaluation with salary increment recommendation', () => {
  const reviews = performanceService.getReviews();
  const empReview = reviews.find((r) => r.employeeId === 'EMP-004');
  assert.ok(empReview);

  const evaluated = performanceService.submitManagerEvaluation(
    empReview.id,
    {
      managerRating: 4.8,
      managerComments: 'Exceptional system architectural delivery and consistent sprint velocity.',
      recommendationType: 'SALARY_INCREMENT',
      recommendedPercent: 15,
      justification: 'Outstanding leadership on core HRMS frontend batches.'
    },
    managerActor
  );

  assert.equal(evaluated.managerRating, 4.8);
  assert.equal(evaluated.status, 'Manager Evaluated');
  assert.equal(evaluated.managerRecommendation.type, 'SALARY_INCREMENT');
  assert.equal(evaluated.managerRecommendation.recommendedIncreasePercent, 15);
  assert.equal(evaluated.managerRecommendation.handoffStatus, 'NOT_STARTED');

  // Verify that salary in compensationService has NOT changed directly!
  const currentStructure = compensationService.getStructureByEmployeeId('EMP-004');
  assert.notEqual(currentStructure.basicSalary, evaluated.managerRecommendation.recommendedNewSalary);
});

test('10. Performance Service: HR moderates appraisal review', () => {
  const reviews = performanceService.getReviews();
  const empReview = reviews.find((r) => r.employeeId === 'EMP-004');

  const moderated = performanceService.moderateReview(
    empReview.id,
    4.8,
    'Attendance and discipline records verified. Excellent compliance.',
    hrAdminActor
  );

  assert.equal(moderated.status, 'HR Moderated');
  assert.equal(moderated.hrRating, 4.8);
});

test('11. Performance Service: CRITICAL BRIDGE — Handoff salary recommendation into F06 revision proposal', () => {
  const reviews = performanceService.getReviews();
  const empReview = reviews.find((r) => r.employeeId === 'EMP-004');

  // HR Admin triggers formal handoff into F06
  const { review, proposal } = performanceService.handoffSalaryRecommendationToPayroll(empReview.id, hrAdminActor);

  assert.ok(proposal.id);
  assert.equal(proposal.employeeId, 'EMP-004');
  assert.equal(proposal.status, 'Pending Super Admin Review');
  assert.equal(proposal.performanceRef, empReview.id);
  assert.equal(review.managerRecommendation.handoffStatus, 'PROPOSAL_CREATED');

  // Duplicate handoff prevention
  assert.throws(() => {
    performanceService.handoffSalaryRecommendationToPayroll(empReview.id, hrAdminActor);
  }, /already been created/i);
});

test('12. Performance Service: Super Admin finalizes appraisal and employee acknowledges review', () => {
  const reviews = performanceService.getReviews();
  const empReview = reviews.find((r) => r.employeeId === 'EMP-004');

  // Super Admin finalizes
  const finalized = performanceService.finalizeReview(empReview.id, superAdminActor);
  assert.equal(finalized.status, 'Finalized');
  assert.ok(finalized.finalizedDate);

  // Employee acknowledges
  const acknowledged = performanceService.acknowledgeReview(empReview.id, employeeActor);
  assert.equal(acknowledged.isAcknowledged, true);
  assert.ok(acknowledged.acknowledgedAt);
});

test('13. Development Plans: Toggles development checkpoints and tracks progress', () => {
  const plans = performanceService.getDevelopmentPlans({}, employeeActor);
  assert.ok(plans.length > 0);
  const plan = plans[0];
  const initialCompleted = plan.checkpoints[0].completed;

  const toggled = performanceService.togglePlanCheckpoint(plan.id, 0);
  assert.equal(toggled.checkpoints[0].completed, !initialCompleted);
});
