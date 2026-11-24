/**
 * iSysware HRMS — Batch F07: Performance Appraisals & Development Plans Service
 * Controls:
 * - Appraisal Review Cycles & Employee Appraisals
 * - 5-Stage Appraisal Flow: Self Assessment -> Manager Review -> HR Moderation -> Finalized -> Acknowledged
 * - Role-Scoped Appraisal Views (Manager evaluates team, Employee completes self-appraisal)
 * - Safe Bridge to F06: Converts manager performance salary recommendation into formal F06 revision proposal
 * - Individual Development Plans (IDP) & Performance Improvement Plans (PIP)
 */

import {
  INITIAL_APPRAISAL_CYCLES,
  INITIAL_EMPLOYEE_REVIEWS,
  INITIAL_DEVELOPMENT_PLANS
} from '../mocks/performanceData.js';
import { employeeService } from './employeeService.js';
import { apiClient } from './apiClient.js';
import salaryRevisionService from './salaryRevisionService.js';
import compensationService from './compensationService.js';

const STORAGE_KEYS = {
  CYCLES: 'isysware_hrms_f07_cycles_v1',
  REVIEWS: 'isysware_hrms_f07_reviews_v1',
  PLANS: 'isysware_hrms_f07_idp_v1',
  FEEDBACKS: 'isysware_hrms_f07_feedback_v1'
};

const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT);

const BACKEND_TO_UI_REVIEW_STATUS = {
  SELF_REVIEW: 'Pending Self Assessment',
  MANAGER_REVIEW: 'Self Assessment Submitted',
  HR_MODERATION: 'Manager Evaluated',
  FINAL_APPROVAL: 'HR Moderated',
  COMPLETED: 'Finalized'
};

class PerformanceService {
  constructor() {
    this.listeners = new Set();
    this.memoryStorage = {};
    this._isLoading = false;
    this._inFlightLoadPromise = null;
    this._lastLoadTimestamp = 0;
    this._loadSeq = 0;
    this._initialize();
  }

  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key];
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultVal;
      } catch {
        // Fallback
      }
    }
    return defaultVal !== undefined ? defaultVal : [];
  }

  _setItem(key, value) {
    this.memoryStorage[key] = value;
    if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Fallback
      }
    }
  }

  _initialize() {
    const existingCycles = this._getItem(STORAGE_KEYS.CYCLES, null);
    if (!existingCycles || existingCycles.length === 0) {
      this._setItem(STORAGE_KEYS.CYCLES, JSON.parse(JSON.stringify(INITIAL_APPRAISAL_CYCLES)));
    }
    const existingReviews = this._getItem(STORAGE_KEYS.REVIEWS, null);
    if (!existingReviews || existingReviews.length === 0) {
      this._setItem(STORAGE_KEYS.REVIEWS, JSON.parse(JSON.stringify(INITIAL_EMPLOYEE_REVIEWS)));
    }
    const existingPlans = this._getItem(STORAGE_KEYS.PLANS, null);
    if (!existingPlans || existingPlans.length === 0) {
      this._setItem(STORAGE_KEYS.PLANS, JSON.parse(JSON.stringify(INITIAL_DEVELOPMENT_PLANS)));
    }
    if (!this._getItem(STORAGE_KEYS.FEEDBACKS, null)) {
      this._setItem(STORAGE_KEYS.FEEDBACKS, []);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in performanceService listener:', err);
      }
    }
  }

  resetToDefaults() {
    const cycles = isTest ? INITIAL_APPRAISAL_CYCLES : [];
    const reviews = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const plans = isTest ? INITIAL_DEVELOPMENT_PLANS : [];
    this._setItem(STORAGE_KEYS.CYCLES, JSON.parse(JSON.stringify(cycles)));
    this._setItem(STORAGE_KEYS.REVIEWS, JSON.parse(JSON.stringify(reviews)));
    this._setItem(STORAGE_KEYS.PLANS, JSON.parse(JSON.stringify(plans)));
    this._notify();
  }

  _parseMeta(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    const str = String(raw).trim();
    if (str.startsWith('{')) {
      try {
        return JSON.parse(str);
      } catch {
        return { type: str };
      }
    }
    return { type: str };
  }

  _mapBackendCycle(c) {
    if (!c) return null;
    return {
      id: c.id,
      cuid: c.id,
      cycleCode: c.cycleCode,
      title: c.title || c.name || c.cycleCode,
      name: c.title || c.name || c.cycleCode,
      startDate: c.startDate ? String(c.startDate).slice(0, 10) : '',
      endDate: c.endDate ? String(c.endDate).slice(0, 10) : '',
      status: c.status || 'DRAFT',
      _count: c._count || { goals: 0, reviews: 0 }
    };
  }

  _mapBackendReview(r) {
    if (!r) return null;
    const meta = r.reviewMeta || this._parseMeta(r.managerRecommendation);
    const empCode = r.employee?.employeeCode || r.employeeId;
    const localEmp =
      employeeService.getEmployeeById?.(r.employeeId) ||
      employeeService.getEmployeeById?.(empCode);
    const empName = r.employee
      ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim()
      : (localEmp?.name || empCode || 'Employee');

    const reviewerCode = r.reviewer?.employeeCode || r.reviewerId;
    const localReviewer =
      employeeService.getEmployeeById?.(r.reviewerId) ||
      employeeService.getEmployeeById?.(reviewerCode);
    const reviewerName = r.reviewer
      ? `${r.reviewer.firstName || ''} ${r.reviewer.lastName || ''}`.trim()
      : (localReviewer?.name || reviewerCode || 'Pending Assignment');

    const comp = compensationService.getStructureByEmployeeId?.(empCode) ||
      compensationService.getStructureByEmployeeId?.(r.employeeId);
    const currSalary = comp?.basicSalary || 0;
    const pct = Number(meta.recommendedPercent) || 0;
    const recSalary = meta.recommendedNewSalary || (currSalary ? Math.round(currSalary * (1 + pct / 100)) : 0);

    const uiStatus = BACKEND_TO_UI_REVIEW_STATUS[r.status] || r.status || 'Pending Self Assessment';

    return {
      id: r.id,
      cuid: r.id,
      cycleId: r.cycleId,
      cycleCode: r.cycle?.cycleCode || '',
      cycleName: r.cycle?.title || r.cycle?.name || 'Appraisal Cycle',
      employeeId: empCode,
      employeeCuid: r.employeeId,
      employeeName: empName,
      departmentId: r.employee?.departmentId || localEmp?.departmentId || null,
      department: r.employee?.department?.name || localEmp?.department || 'General',
      designation: r.employee?.designation?.title || localEmp?.designation || 'Staff',
      reviewerId: reviewerCode || null,
      reviewerCuid: r.reviewerId || null,
      reviewerName,
      status: uiStatus,
      backendStatus: r.status,
      selfRating: r.selfScore !== null && r.selfScore !== undefined ? Number(r.selfScore) : null,
      selfComments: meta.selfComments || '',
      strengths: r.strengths || '',
      growthAreas: r.growthAreas || '',
      managerRating: r.reviewerScore !== null && r.reviewerScore !== undefined ? Number(r.reviewerScore) : null,
      managerComments: meta.managerComments || r.strengths || '',
      hrRating: meta.hrRating !== undefined ? Number(meta.hrRating) : (r.finalNormalizedScore ? Number(r.finalNormalizedScore) : null),
      hrComments: meta.hrComments || '',
      finalWeightedRating: r.finalNormalizedScore !== null && r.finalNormalizedScore !== undefined
        ? Number(r.finalNormalizedScore)
        : (r.reviewerScore !== null && r.reviewerScore !== undefined ? Number(r.reviewerScore) : null),
      ratingCategory: r.ratingCategory || null,
      managerRecommendation: {
        type: meta.type || 'NO_CHANGE',
        recommendedIncreasePercent: pct,
        recommendedNewSalary: recSalary,
        justification: meta.justification || '',
        handoffStatus: meta.handoffStatus || 'NOT_STARTED',
        proposalId: meta.proposalId || null
      },
      submittedAt: r.submittedAt ? String(r.submittedAt).slice(0, 10) : null,
      reviewedAt: r.reviewedAt ? String(r.reviewedAt).slice(0, 10) : null,
      finalizedDate: r.finalizedAt ? String(r.finalizedAt).slice(0, 10) : null,
      isAcknowledged: Boolean(meta.acknowledgedByEmployee),
      acknowledgedAt: meta.acknowledgedAt ? String(meta.acknowledgedAt).replace('T', ' ').slice(0, 19) : null,
      approvedBy: meta.isLocked ? 'Super Admin' : null
    };
  }

  _mapBackendFeedback(f) {
    if (!f) return null;
    const empName = f.employee
      ? `${f.employee.firstName || ''} ${f.employee.lastName || ''}`.trim()
      : 'Employee';
    const authorName = f.authorEmployee
      ? `${f.authorEmployee.firstName || ''} ${f.authorEmployee.lastName || ''}`.trim()
      : (f.authorName || 'Manager');
    return {
      id: f.id,
      cuid: f.id,
      feedbackCode: f.feedbackCode,
      employeeId: f.employee?.employeeCode || f.employeeId,
      employeeCuid: f.employeeId,
      employeeName: empName,
      departmentId: f.employee?.departmentId || null,
      department: f.employee?.department?.name || 'General',
      designation: f.employee?.designation?.title || 'Staff',
      authorEmployeeId: f.authorEmployee?.employeeCode || f.authorEmployeeId || null,
      authorEmployeeCuid: f.authorEmployeeId || null,
      authorName,
      authorRole: f.authorRole || '',
      feedbackType: f.feedbackType || 'CONSTRUCTIVE',
      title: f.title || '',
      strengths: f.strengths || '',
      improvementAreas: f.improvementAreas || '',
      managerComments: f.managerComments || '',
      employeeResponse: f.employeeResponse || '',
      status: f.status || 'SHARED',
      acknowledgedAt: f.acknowledgedAt ? String(f.acknowledgedAt).slice(0, 19).replace('T', ' ') : null,
      createdAt: f.createdAt ? String(f.createdAt).slice(0, 19).replace('T', ' ') : null,
      updatedAt: f.updatedAt ? String(f.updatedAt).slice(0, 19).replace('T', ' ') : null,
      auditHistory: Array.isArray(f.auditHistory) ? f.auditHistory : undefined
    };
  }

  _mapBackendPlan(p) {
    if (!p) return null;
    const empName = p.employee
      ? `${p.employee.firstName || ''} ${p.employee.lastName || ''}`.trim()
      : (p.employeeName || 'Employee');
    const mentorName = p.mentor
      ? `${p.mentor.firstName || ''} ${p.mentor.lastName || ''}`.trim()
      : (p.mentorName || 'Unassigned');
    const cat = String(p.planCategory || 'IDP').toUpperCase();
    return {
      id: p.id,
      cuid: p.id,
      planCode: p.planCode,
      planCategory: cat,
      type: cat === 'PIP' ? 'PIP (Performance Improvement Plan)' : 'IDP (Development Plan)',
      employeeId: p.employee?.employeeCode || p.employeeId,
      employeeCuid: p.employeeId,
      employeeName: empName,
      departmentId: p.employee?.departmentId || null,
      department: p.employee?.department?.name || 'General',
      designation: p.employee?.designation?.title || 'Staff',
      mentorId: p.mentor?.employeeCode || p.mentorId || null,
      mentorCuid: p.mentorId || null,
      mentorName,
      createdByName: p.createdByName || '',
      createdByRole: p.createdByRole || '',
      title: p.title || '',
      description: p.description || '',
      goalsSummary: p.goalsSummary || '',
      recommendedTraining: p.recommendedTraining || '',
      startDate: p.startDate ? String(p.startDate).slice(0, 10) : '',
      targetEndDate: p.targetEndDate ? String(p.targetEndDate).slice(0, 10) : '',
      status: p.status || 'ACTIVE',
      progressPercent: Number(p.progressPercent) || 0,
      checkpoints: Array.isArray(p.checkpoints) ? p.checkpoints : [],
      documentedConcerns: p.documentedConcerns || '',
      improvementTargets: Array.isArray(p.improvementTargets) ? p.improvementTargets : [],
      reviewFrequency: p.reviewFrequency || 'BIWEEKLY',
      reviewSchedule: Array.isArray(p.reviewSchedule) ? p.reviewSchedule : [],
      managerEvaluations: Array.isArray(p.managerEvaluations) ? p.managerEvaluations : [],
      employeeAcknowledged: Boolean(p.employeeAcknowledged),
      acknowledgedAt: p.acknowledgedAt ? String(p.acknowledgedAt).slice(0, 19).replace('T', ' ') : null,
      employeeStatement: p.employeeStatement || '',
      closureOutcome: p.closureOutcome || null,
      closureNotes: p.closureNotes || '',
      closedAt: p.closedAt ? String(p.closedAt).slice(0, 19).replace('T', ' ') : null,
      closedByName: p.closedByName || '',
      createdAt: p.createdAt ? String(p.createdAt).slice(0, 19).replace('T', ' ') : null,
      auditHistory: Array.isArray(p.auditHistory) ? p.auditHistory : undefined
    };
  }

  async loadPerformanceDataAsync(force = false) {
    if (isTest || typeof window === 'undefined' || !apiClient?.get) {
      return {
        cycles: this.getCycles(),
        reviews: this.getReviews(),
        feedbacks: this.getFeedbacks(),
        plans: this.getDevelopmentPlans()
      };
    }
    if (this._inFlightLoadPromise && !force) {
      return this._inFlightLoadPromise;
    }
    const now = Date.now();
    if (!force && now - this._lastLoadTimestamp < 500) {
      return {
        cycles: this.getCycles(),
        reviews: this.getReviews(),
        feedbacks: this.getFeedbacks(),
        plans: this.getDevelopmentPlans()
      };
    }

    const reqSeq = ++this._loadSeq;
    const run = async () => {
      try {
        this._isLoading = true;
        const [cyclesRes, reviewsRes, feedbackRes, plansRes] = await Promise.all([
          apiClient.get('/performance/cycles'),
          apiClient.get('/performance/reviews'),
          apiClient.get('/performance/feedback').catch(() => []),
          apiClient.get('/performance/development-plans').catch(() => [])
        ]);

        const rawCycles = Array.isArray(cyclesRes) ? cyclesRes : (cyclesRes?.data || []);
        const rawReviews = Array.isArray(reviewsRes) ? reviewsRes : (reviewsRes?.data || []);
        const rawFeedbacks = Array.isArray(feedbackRes) ? feedbackRes : (feedbackRes?.data || []);
        const rawPlans = Array.isArray(plansRes) ? plansRes : (plansRes?.data || []);

        const cycles = rawCycles.map((c) => this._mapBackendCycle(c)).filter(Boolean);
        const reviews = rawReviews.map((r) => this._mapBackendReview(r)).filter(Boolean);
        const feedbacks = rawFeedbacks.map((f) => this._mapBackendFeedback(f)).filter(Boolean);
        const plans = rawPlans.map((p) => this._mapBackendPlan(p)).filter(Boolean);

        if (reqSeq === this._loadSeq) {
          this._setItem(STORAGE_KEYS.CYCLES, cycles);
          this._setItem(STORAGE_KEYS.REVIEWS, reviews);
          this._setItem(STORAGE_KEYS.FEEDBACKS, feedbacks);
          this._setItem(STORAGE_KEYS.PLANS, plans);
          this._lastLoadTimestamp = Date.now();
          this._notify();
        }
        return { cycles, reviews, feedbacks, plans };
      } catch (err) {
        console.warn('[performanceService] Failed to load performance data from backend:', err?.message || err);
        return {
          cycles: this.getCycles(),
          reviews: this.getReviews(),
          feedbacks: this.getFeedbacks(),
          plans: this.getDevelopmentPlans()
        };
      } finally {
        if (reqSeq === this._loadSeq) {
          this._isLoading = false;
          this._inFlightLoadPromise = null;
        }
      }
    };

    this._inFlightLoadPromise = run();
    return this._inFlightLoadPromise;
  }

  getCycles() {
    const fallback = isTest ? INITIAL_APPRAISAL_CYCLES : [];
    return this._getItem(STORAGE_KEYS.CYCLES, fallback);
  }

  async createCycleAsync(data) {
    const payload = {
      title: String(data.title || '').trim(),
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status || 'ACTIVE',
      cycleCode: data.cycleCode || undefined
    };
    const res = await apiClient.post('/performance/cycles', payload);
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendCycle(res?.data || res);
  }

  async updateCycleStatusAsync(cycleId, status) {
    const res = await apiClient.patch(`/performance/cycles/${cycleId}/status`, { status });
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendCycle(res?.data || res);
  }

  async initiateReviewAsync(data) {
    const payload = {
      cycleId: data.cycleId,
      employeeId: data.employeeId,
      reviewerId: data.reviewerId || undefined
    };
    const res = await apiClient.post('/performance/reviews/initiate', payload);
    const created = res?.data || res;
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendReview(created);
  }

  /**
   * Get employee appraisals filtered by role
   */
  getReviews(filters = {}, requestingUser = null) {
    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    let list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];

    if (requestingUser) {
      const userRole = requestingUser.role?.toLowerCase();
      const myId = requestingUser.employeeId || requestingUser.id;
      const myEmp = employeeService.getEmployeeById?.(myId);
      const myIds = new Set([myId, requestingUser.id, myEmp?.id, myEmp?.cuid].filter(Boolean));

      if (userRole === 'employee') {
        list = list.filter((r) => myIds.has(r.employeeId) || myIds.has(r.employeeCuid));
      } else if (userRole === 'manager' || userRole === 'dept_manager') {
        const teamMembers = employeeService.getDirectReports(myId) || [];
        const allowedIds = new Set([
          ...myIds,
          ...teamMembers.flatMap((m) => [m.id, m.cuid].filter(Boolean))
        ]);
        const myDept = requestingUser.departmentId || myEmp?.departmentId;
        list = list.filter(
          (r) =>
            allowedIds.has(r.employeeId) ||
            allowedIds.has(r.employeeCuid) ||
            myIds.has(r.reviewerId) ||
            myIds.has(r.reviewerCuid) ||
            (myDept && r.departmentId === myDept)
        );
      }
      // Super Admin and HR Admin see company reviews
    }

    if (filters.cycleId && filters.cycleId !== 'all') {
      list = list.filter((r) => r.cycleId === filters.cycleId);
    }
    if (filters.department && filters.department !== 'all') {
      list = list.filter((r) => r.department === filters.department || r.departmentId === filters.department);
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((r) => String(r.status || '').toLowerCase() === filters.status.toLowerCase());
    }

    return list;
  }

  getReviewById(reviewId) {
    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = this._getItem(STORAGE_KEYS.REVIEWS, fallback);
    return list.find((r) => r.id === reviewId) || null;
  }

  /**
   * Submit employee self-assessment
   */
  submitSelfAssessment(reviewId, selfRating, selfComments, requestingUser) {
    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error(`Appraisal review '${reviewId}' not found.`);

    const review = { ...list[idx] };
    const empId = requestingUser?.employeeId || requestingUser?.id;

    if (empId && review.employeeId !== empId && requestingUser?.role !== 'super_admin') {
      throw new Error('Only the assigned employee may submit their own self-assessment.');
    }

    review.selfRating = Math.min(5, Math.max(1, Number(selfRating) || 3));
    review.selfComments = (selfComments || '').trim();
    review.status = 'Self Assessment Submitted';

    list[idx] = review;
    this._setItem(STORAGE_KEYS.REVIEWS, list);
    this._notify();
    return review;
  }

  /**
   * Manager submits evaluation with rating and optional salary increment/decrement recommendation
   */
  submitManagerEvaluation(reviewId, data, managerUser) {
    const {
      managerRating,
      managerComments,
      recommendationType = 'NONE', // 'NONE' | 'SALARY_INCREMENT' | 'SALARY_DECREMENT' | 'ONE_TIME_BONUS'
      recommendedPercent = 0,
      justification = ''
    } = data;

    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error(`Appraisal review '${reviewId}' not found.`);

    const review = { ...list[idx] };

    // Anti-self-approval: Non-Super-Admin cannot evaluate themselves
    const reviewerId = managerUser?.employeeId || managerUser?.id;
    const isSuperAdmin = String(managerUser?.role || '').toLowerCase() === 'super_admin';
    if (!isSuperAdmin && reviewerId && review.employeeId === reviewerId) {
      throw new Error('Anti-Self-Approval violation: You cannot conduct your own manager appraisal.');
    }

    const rating = Math.min(5, Math.max(1, Number(managerRating) || 3));
    review.managerRating = rating;
    review.managerComments = (managerComments || '').trim();
    review.reviewerName = managerUser?.name || review.reviewerName;

    // Current compensation lookup for recommended salary calculation
    const comp = compensationService.getStructureByEmployeeId(review.employeeId);
    const currSalary = comp?.basicSalary || 100000;
    const pct = Number(recommendedPercent) || 0;
    const recommendedSalary = Math.round(currSalary * (1 + (pct / 100)));

    review.managerRecommendation = {
      type: recommendationType,
      recommendedIncreasePercent: pct,
      recommendedNewSalary: recommendedSalary,
      justification: justification.trim() || 'Performance appraisal recommendation',
      handoffStatus: 'NOT_STARTED'
    };

    review.finalWeightedRating = review.selfRating
      ? Math.round(((review.selfRating * 0.3) + (rating * 0.7)) * 10) / 10
      : rating;

    review.status = 'Manager Evaluated';

    list[idx] = review;
    this._setItem(STORAGE_KEYS.REVIEWS, list);
    this._notify();
    return review;
  }

  /**
   * HR Admin moderates appraisal review
   */
  moderateReview(reviewId, hrRating, hrComments, hrUser) {
    if (hrUser?.role !== 'hr_admin' && hrUser?.role !== 'super_admin') {
      throw new Error('Unauthorized: Only HR Admin or Super Admin may moderate performance appraisals.');
    }

    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error(`Appraisal review '${reviewId}' not found.`);

    const review = { ...list[idx] };
    review.hrRating = Number(hrRating) || review.managerRating || 3;
    review.hrComments = (hrComments || '').trim();
    review.status = 'HR Moderated';

    list[idx] = review;
    this._setItem(STORAGE_KEYS.REVIEWS, list);
    this._notify();
    return review;
  }

  /**
   * Super Admin finalizes appraisal review
   */
  finalizeReview(reviewId, approverUser) {
    if (approverUser?.role !== 'super_admin') {
      throw new Error('Unauthorized: Final appraisal approval is strictly reserved for Super Admin.');
    }

    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error(`Appraisal review '${reviewId}' not found.`);

    const review = { ...list[idx] };
    review.status = 'Finalized';
    review.finalizedDate = new Date().toISOString().slice(0, 10);
    review.approvedBy = approverUser.name || 'Super Admin';

    list[idx] = review;
    this._setItem(STORAGE_KEYS.REVIEWS, list);
    this._notify();
    return review;
  }

  /**
   * Employee acknowledges finalized appraisal
   */
  acknowledgeReview(reviewId, requestingUser) {
    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error(`Appraisal review '${reviewId}' not found.`);

    const review = { ...list[idx] };
    const empId = requestingUser?.employeeId || requestingUser?.id;

    if (empId && review.employeeId !== empId) {
      throw new Error('Only the evaluated employee may acknowledge their performance review.');
    }

    review.isAcknowledged = true;
    review.acknowledgedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

    list[idx] = review;
    this._setItem(STORAGE_KEYS.REVIEWS, list);
    this._notify();
    return review;
  }

  async submitSelfAssessmentAsync(reviewId, selfRating, selfComments, requestingUser) {
    if (isTest || typeof window === 'undefined' || !apiClient?.post) {
      return this.submitSelfAssessment(reviewId, selfRating, selfComments, requestingUser);
    }
    const res = await apiClient.post(`/performance/reviews/${reviewId}/self`, {
      selfScore: Number(selfRating),
      selfComments: (selfComments || '').trim(),
      strengths: (selfComments || '').trim() || undefined
    });
    const updated = res?.data || res;
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendReview(updated);
  }

  async submitManagerEvaluationAsync(reviewId, data, managerUser) {
    if (isTest || typeof window === 'undefined' || !apiClient?.post) {
      return this.submitManagerEvaluation(reviewId, data, managerUser);
    }
    const res = await apiClient.post(`/performance/reviews/${reviewId}/manager-review`, {
      reviewerScore: Number(data.managerRating),
      managerComments: (data.managerComments || '').trim(),
      strengths: (data.managerComments || '').trim() || undefined,
      recommendationType: data.recommendationType || 'NO_CHANGE',
      managerRecommendation: data.recommendationType || 'NO_CHANGE',
      recommendedPercent: Number(data.recommendedPercent) || 0,
      justification: (data.justification || '').trim(),
      finalizeImmediately: data.finalizeImmediately ?? false
    });
    const updated = res?.data || res;
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendReview(updated);
  }

  async moderateReviewAsync(reviewId, hrRating, hrComments, hrUser) {
    if (isTest || typeof window === 'undefined' || !apiClient?.post) {
      return this.moderateReview(reviewId, hrRating, hrComments, hrUser);
    }
    const res = await apiClient.post(`/performance/reviews/${reviewId}/hr-moderate`, {
      hrRating: Number(hrRating),
      hrComments: (hrComments || '').trim()
    });
    const updated = res?.data || res;
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendReview(updated);
  }

  async finalizeReviewAsync(reviewId, approverUser) {
    if (isTest || typeof window === 'undefined' || !apiClient?.post) {
      return this.finalizeReview(reviewId, approverUser);
    }
    const res = await apiClient.post(`/performance/reviews/${reviewId}/finalize`, {});
    const updated = res?.data || res;
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendReview(updated);
  }

  async acknowledgeReviewAsync(reviewId, requestingUser) {
    if (isTest || typeof window === 'undefined' || !apiClient?.post) {
      return this.acknowledgeReview(reviewId, requestingUser);
    }
    const res = await apiClient.post(`/performance/reviews/${reviewId}/acknowledge`, {});
    const updated = res?.data || res;
    await this.loadPerformanceDataAsync(true);
    return this._mapBackendReview(updated);
  }
  /**
   * CRITICAL BRIDGE: Handoff performance salary recommendation to F06 Salary Revision Proposal
   * F07 does NOT change salary directly. It submits a formal proposal into F06 for Super Admin approval.
   */
  handoffSalaryRecommendationToPayroll(reviewId, hrUser) {
    const fallback = isTest ? INITIAL_EMPLOYEE_REVIEWS : [];
    const list = [...this._getItem(STORAGE_KEYS.REVIEWS, fallback)];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error(`Appraisal review '${reviewId}' not found.`);

    const review = { ...list[idx] };
    const rec = review.managerRecommendation;

    if (!rec || (rec.type !== 'SALARY_INCREMENT' && rec.type !== 'SALARY_DECREMENT')) {
      throw new Error('No salary revision recommendation present on this appraisal review.');
    }
    if (rec.handoffStatus === 'PROPOSAL_CREATED') {
      throw new Error('A salary revision proposal has already been created for this performance review.');
    }

    const currentStructure = compensationService.getStructureByEmployeeId(review.employeeId);
    const currSalary = currentStructure?.basicSalary || 100000;

    // Create formal F06 revision proposal via canonical salaryRevisionService
    const proposal = salaryRevisionService.createProposal(
      {
        employeeId: review.employeeId,
        employeeName: review.employeeName,
        department: review.department,
        designation: review.designation,
        currentSalary: currSalary,
        proposedSalary: rec.recommendedNewSalary,
        effectiveDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10), // Effective next week
        justification: `[Performance Appraisal ${review.cycleName}] Rating: ${review.finalWeightedRating}/5.0. ${rec.justification}`,
        performanceRef: review.id,
        performanceRating: review.finalWeightedRating
      },
      hrUser
    );

    // Update handoff status
    rec.handoffStatus = 'PROPOSAL_CREATED';
    rec.proposalId = proposal.id;
    review.managerRecommendation = rec;

    list[idx] = review;
    this._setItem(STORAGE_KEYS.REVIEWS, list);
    this._notify();

    return { review, proposal };
  }

  /**
   * Employee Feedback (PostgreSQL-backed)
   */
  getFeedbacks(filters = {}, requestingUser = null) {
    let list = [...this._getItem(STORAGE_KEYS.FEEDBACKS, [])];

    if (requestingUser) {
      const userRole = String(requestingUser.role || '').toLowerCase();
      const myId = requestingUser.employeeId || requestingUser.id;
      const myEmp = employeeService.getEmployeeById?.(myId);
      const myIds = new Set([myId, requestingUser.id, myEmp?.id, myEmp?.cuid].filter(Boolean));
      if (userRole === 'employee') {
        list = list.filter((f) => myIds.has(f.employeeId) || myIds.has(f.employeeCuid));
      } else if (userRole === 'manager' || userRole === 'dept_manager' || userRole === 'team_lead') {
        const myDept = requestingUser.departmentId || myEmp?.departmentId;
        if (myDept) {
          list = list.filter((f) => f.departmentId === myDept || myIds.has(f.employeeId) || myIds.has(f.employeeCuid));
        }
      }
    }

    if (filters.employeeId) {
      list = list.filter((f) => f.employeeId === filters.employeeId || f.employeeCuid === filters.employeeId);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((f) => String(f.status).toUpperCase() === String(filters.status).toUpperCase());
    }
    if (filters.feedbackType && filters.feedbackType !== 'ALL') {
      list = list.filter((f) => String(f.feedbackType).toUpperCase() === String(filters.feedbackType).toUpperCase());
    }
    return list;
  }

  async getFeedbackByIdAsync(id) {
    const res = await apiClient.get(`/performance/feedback/${id}`);
    return this._mapBackendFeedback(res?.data || res);
  }

  async createFeedbackAsync(data) {
    const res = await apiClient.post('/performance/feedback', data);
    const mapped = this._mapBackendFeedback(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async updateFeedbackAsync(id, data) {
    const res = await apiClient.patch(`/performance/feedback/${id}`, data);
    const mapped = this._mapBackendFeedback(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async acknowledgeFeedbackAsync(id, employeeResponse = '') {
    const res = await apiClient.post(`/performance/feedback/${id}/acknowledge`, { employeeResponse });
    const mapped = this._mapBackendFeedback(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  /**
   * Individual Development Plans (IDP) & PIPs
   */
  getDevelopmentPlans(filters = {}, requestingUser = null) {
    const fallback = isTest ? INITIAL_DEVELOPMENT_PLANS : [];
    let list = [...this._getItem(STORAGE_KEYS.PLANS, fallback)];

    if (requestingUser) {
      const userRole = requestingUser.role?.toLowerCase();
      const myId = requestingUser.employeeId || requestingUser.id;
      const myEmp = employeeService.getEmployeeById?.(myId);
      const myIds = new Set([myId, requestingUser.id, myEmp?.id, myEmp?.cuid].filter(Boolean));

      if (userRole === 'employee') {
        list = list.filter((p) => myIds.has(p.employeeId) || myIds.has(p.employeeCuid));
      } else if (userRole === 'manager' || userRole === 'dept_manager' || userRole === 'team_lead') {
        const teamMembers = employeeService.getDirectReports?.(myId) || [];
        const allowedIds = new Set([...myIds, ...teamMembers.flatMap((m) => [m.id, m.cuid].filter(Boolean))]);
        const myDept = requestingUser.departmentId || myEmp?.departmentId;
        list = list.filter(
          (p) =>
            allowedIds.has(p.employeeId) ||
            allowedIds.has(p.employeeCuid) ||
            (myDept && p.departmentId === myDept)
        );
      }
    }

    if (filters.planCategory && filters.planCategory !== 'ALL') {
      const targetCat = String(filters.planCategory).toUpperCase();
      list = list.filter((p) => {
        const cat = p.planCategory || (String(p.type || '').toUpperCase().includes('PIP') ? 'PIP' : 'IDP');
        return cat === targetCat;
      });
    }
    if (filters.employeeId) {
      list = list.filter((p) => p.employeeId === filters.employeeId || p.employeeCuid === filters.employeeId);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((p) => String(p.status).toUpperCase() === String(filters.status).toUpperCase());
    }
    return list;
  }

  togglePlanCheckpoint(planId, checkpointIndex) {
    const fallback = isTest ? INITIAL_DEVELOPMENT_PLANS : [];
    const list = [...this._getItem(STORAGE_KEYS.PLANS, fallback)];
    const idx = list.findIndex((p) => p.id === planId);
    if (idx === -1) throw new Error(`Plan '${planId}' not found.`);

    const plan = { ...list[idx], checkpoints: [...(list[idx].checkpoints || [])] };
    if (plan.checkpoints[checkpointIndex] !== undefined) {
      plan.checkpoints[checkpointIndex] = {
        ...plan.checkpoints[checkpointIndex],
        completed: !plan.checkpoints[checkpointIndex].completed
      };
    }

    list[idx] = plan;
    this._setItem(STORAGE_KEYS.PLANS, list);
    this._notify();
    return plan;
  }

  async getDevelopmentPlanByIdAsync(id) {
    const res = await apiClient.get(`/performance/development-plans/${id}`);
    return this._mapBackendPlan(res?.data || res);
  }

  async createDevelopmentPlanAsync(data) {
    const res = await apiClient.post('/performance/development-plans', data);
    const mapped = this._mapBackendPlan(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async updateDevelopmentPlanAsync(id, data) {
    const res = await apiClient.patch(`/performance/development-plans/${id}`, data);
    const mapped = this._mapBackendPlan(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async togglePlanCheckpointAsync(planId, idx) {
    if (isTest || typeof window === 'undefined' || !apiClient?.patch) {
      return this.togglePlanCheckpoint(planId, idx);
    }
    const res = await apiClient.patch(`/performance/development-plans/${planId}/checkpoints/${idx}/toggle`, {});
    const mapped = this._mapBackendPlan(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async addPlanEvaluationAsync(planId, data) {
    const res = await apiClient.post(`/performance/development-plans/${planId}/evaluate`, data);
    const mapped = this._mapBackendPlan(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async acknowledgePlanAsync(planId, employeeStatement = '') {
    const res = await apiClient.post(`/performance/development-plans/${planId}/acknowledge`, { employeeStatement });
    const mapped = this._mapBackendPlan(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }

  async closePlanAsync(planId, data) {
    const res = await apiClient.post(`/performance/development-plans/${planId}/close`, data);
    const mapped = this._mapBackendPlan(res?.data || res);
    await this.loadPerformanceDataAsync(true);
    return mapped;
  }
}

export const performanceService = new PerformanceService();
export default performanceService;
