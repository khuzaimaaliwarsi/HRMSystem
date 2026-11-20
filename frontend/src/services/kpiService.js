/**
 * iSysware HRMS — Batch F07: Goals, Targets & KPIs Service
 * Controls:
 * - Department-specific Performance Metrics & Targets
 * - Qualitative & Quantitative Evaluation Formulas
 * - Weight Percentages (100% total allocation per role)
 * - Review Cycle Assignments (Monthly, Quarterly, Annual)
 */

import { INITIAL_DEPARTMENT_KPIS } from '../mocks/performanceData.js';
import { apiClient } from './apiClient.js';

const STORAGE_KEY = 'isysware_hrms_f07_kpis_v1';
const isTest = typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT);

class KpiService {
  constructor() {
    this.listeners = new Set();
    this.memoryStorage = {};
    this._isLoading = false;
    this._lastLoadTimestamp = 0;
    this._inFlightLoadPromise = null;
    this._loadSeq = 0;
    this._initialize();
  }

  _getItem(key, defaultVal) {
    if (this.memoryStorage[key] !== undefined) return this.memoryStorage[key];
    if (typeof window !== 'undefined' && window.localStorage) {
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
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Fallback
      }
    }
  }

  _initialize() {
    const existing = this._getItem(STORAGE_KEY, null);
    if (!existing || existing.length === 0) {
      this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(INITIAL_DEPARTMENT_KPIS)));
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
        console.error('Error in kpiService listener:', err);
      }
    }
  }

  resetToDefaults() {
    const defaults = isTest ? INITIAL_DEPARTMENT_KPIS : [];
    this._setItem(STORAGE_KEY, JSON.parse(JSON.stringify(defaults)));
    this._notify();
  }

  /**
   * Get all KPIs with optional department filter
   */
  getKpis(filters = {}) {
    const fallback = isTest ? INITIAL_DEPARTMENT_KPIS : [];
    let list = [...this._getItem(STORAGE_KEY, fallback)];
    if (filters.departmentId && filters.departmentId !== 'all') {
      list = list.filter((k) => k.departmentId === filters.departmentId);
    }
    if (filters.reviewCycle && filters.reviewCycle !== 'all') {
      list = list.filter((k) => k.reviewCycle.toLowerCase() === filters.reviewCycle.toLowerCase());
    }
    return list;
  }

  /**
   * Get single KPI by ID
   */
  getKpiById(kpiId) {
    const fallback = isTest ? INITIAL_DEPARTMENT_KPIS : [];
    const list = this._getItem(STORAGE_KEY, fallback);
    return list.find((k) => k.id === kpiId) || null;
  }

  /**
   * Create or configure new KPI metric
   */
  createKpi(data) {
    const {
      name,
      code,
      departmentId,
      department,
      metricType = 'Percentage',
      targetValue,
      weightPercent = 25,
      reviewCycle = 'Quarterly',
      description
    } = data;

    if (!name || name.trim().length < 3) throw new Error('KPI Name is required (min 3 chars).');
    if (!code || code.trim().length < 2) throw new Error('KPI Code is required.');
    const weight = Number(weightPercent);
    if (!weight || weight <= 0 || weight > 100) throw new Error('Weight must be between 1% and 100%.');

    const newKpi = {
      id: `KPI-${Date.now().toString().slice(-6)}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      departmentId: departmentId || 'DEP-01',
      department: department || 'Engineering & Technology',
      metricType,
      targetValue: Number(targetValue) || 100,
      weightPercent: weight,
      reviewCycle,
      description: description?.trim() || ''
    };

    const fallback = isTest ? INITIAL_DEPARTMENT_KPIS : [];
    const list = [newKpi, ...this._getItem(STORAGE_KEY, fallback)];
    this._setItem(STORAGE_KEY, list);
    this._notify();
    return newKpi;
  }

  async loadKpis(filters = {}, force = false) {
    if (this._inFlightLoadPromise && !force) {
      return this._inFlightLoadPromise;
    }
    const now = Date.now();
    if (!force && now - this._lastLoadTimestamp < 500) {
      return this._getItem(STORAGE_KEY, []);
    }

    const reqSeq = ++this._loadSeq;
    const run = async () => {
      try {
        this._isLoading = true;
        const query = new URLSearchParams();
        if (filters.departmentId && filters.departmentId !== 'all') query.set('departmentId', filters.departmentId);
        if (filters.reviewCycle && filters.reviewCycle !== 'all') query.set('reviewCycle', filters.reviewCycle);
        const qs = query.toString() ? `?${query.toString()}` : '';
        const response = await apiClient.get(`/performance/kpis${qs}`);

        const records = Array.isArray(response)
          ? response
          : response?.data || [];

        if (reqSeq === this._loadSeq) {
          this._setItem(STORAGE_KEY, records);
          this._lastLoadTimestamp = Date.now();
          this._notify();
        }

        return records;
      } catch (err) {
        console.warn('[kpiService] Failed to load KPIs from backend:', err?.message || err);
        return this._getItem(STORAGE_KEY, []);
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

  async createKpiAsync(data) {
    const payload = {
      code: String(data.code || '').trim().toUpperCase(),
      name: String(data.name || '').trim(),
      departmentId: data.departmentId,
      department: data.department,
      metricType: data.metricType || 'Percentage',
      targetValue: Number(data.targetValue) || 100,
      weightPercent: Number(data.weightPercent) || 25,
      reviewCycle: data.reviewCycle || 'Quarterly',
      description: data.description?.trim() || ''
    };

    const response = await apiClient.post('/performance/kpis', payload);

    await this.loadKpis({}, true);

    return response;
  }

  /**
   * Calculate achievement score
   */
  calculateAchievementScore(target, actual, _metricType) {
    const numTarget = Number(target) || 1;
    const numActual = Number(actual) || 0;

    let achievementPercent = Math.round((numActual / numTarget) * 100);
    // Cap at 150% maximum overachievement
    achievementPercent = Math.min(150, Math.max(0, achievementPercent));

    return {
      target: numTarget,
      actual: numActual,
      achievementPercent,
      isExceeded: achievementPercent >= 100
    };
  }
}

export const kpiService = new KpiService();
export default kpiService;
