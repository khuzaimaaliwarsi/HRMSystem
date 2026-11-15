import React, { useState, useEffect } from 'react';
import kpiService from '../../services/kpiService';
import { employeeService } from '../../services/employeeService';
import { apiClient } from '../../services/apiClient';

export default function KpiModal({ isOpen, onClose, onKpiCreated }) {
  const [departments, setDepartments] = useState(() => {
    return (employeeService.getDepartments() || []).filter(
      (dept) =>
        String(dept.status || '').toUpperCase() === 'ACTIVE' ||
        dept.isActive === true
    );
  });

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    departmentId: '',
    department: '',
    metricType: 'Percentage',
    targetValue: 90,
    weightPercent: 25,
    reviewCycle: 'Quarterly',
    description: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadActiveDepartments = async () => {
      try {
        let activeDepts = (employeeService.getDepartments() || []).filter(
          (dept) =>
            String(dept.status || '').toUpperCase() === 'ACTIVE' ||
            dept.isActive === true
        );

        if (activeDepts.length === 0) {
          const res = await apiClient.get('/organization/departments');
          const list = Array.isArray(res) ? res : (res?.data || []);
          if (Array.isArray(list)) {
            activeDepts = list.filter(
              (dept) =>
                String(dept.status || '').toUpperCase() === 'ACTIVE' ||
                dept.isActive === true
            );
          }
        }

        if (mounted && activeDepts.length > 0) {
          setDepartments(activeDepts);
          setFormData((prev) => {
            if (!prev.departmentId) {
              return {
                ...prev,
                departmentId: activeDepts[0].id,
                department: activeDepts[0].name
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Failed to load active departments:', err);
      }
    };

    if (isOpen) {
      loadActiveDepartments();
    }

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isSubmitting) return;

    const selectedDepartment =
      departments.find(
        (dept) =>
          String(dept.id) === String(formData.departmentId) ||
          String(dept.code) === String(formData.departmentId)
      ) || (formData.departmentId ? null : departments[0]);

    if (!selectedDepartment) {
      setError('Please select an active department.');
      return;
    }

    if (
      String(selectedDepartment.status || '').toUpperCase() !== 'ACTIVE' &&
      selectedDepartment.isActive !== true
    ) {
      setError('Cannot create KPI for an inactive department.');
      return;
    }

    if (!formData.code.trim()) {
      setError('KPI Code is required.');
      return;
    }

    if (!formData.name.trim()) {
      setError('KPI Metric Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await kpiService.createKpiAsync({
        ...formData,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        departmentId: selectedDepartment.id,
        department: selectedDepartment.name
      });

      setSuccess('KPI configured successfully.');
      setTimeout(() => {
        onKpiCreated?.();
        onClose();
      }, 500);
    } catch (err) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err.message ||
        'Failed to save KPI to database.';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeptChange = (deptId) => {
    const selectedDept = departments.find((d) => String(d.id) === String(deptId) || String(d.code) === String(deptId));
    setFormData({
      ...formData,
      departmentId: deptId,
      department: selectedDept ? selectedDept.name : ''
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold">Configure Departmental KPI</h3>
            <p className="text-xs text-slate-300">Target metrics and performance indicators</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
              {success}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">KPI Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g. ENG-VELOCITY"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={formData.departmentId}
                onChange={(e) => handleDeptChange(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                {departments.length === 0 ? (
                  <option value="">No departments configured</option>
                ) : (
                  departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">KPI Metric Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Sprint Delivery Velocity"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Measurement Type</label>
              <select
                value={formData.metricType}
                onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="Percentage">Percentage (%)</option>
                <option value="Rating (1-5)">Rating (1-5)</option>
                <option value="Numeric (PKR)">Revenue (PKR)</option>
                <option value="Count">Deliverables Count</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Value</label>
              <input
                type="number"
                step="any"
                required
                value={formData.targetValue}
                onChange={(e) => setFormData({ ...formData, targetValue: Number(e.target.value) })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Weight (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={formData.weightPercent}
                onChange={(e) => setFormData({ ...formData, weightPercent: Number(e.target.value) })}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Review Cycle</label>
            <select
              value={formData.reviewCycle}
              onChange={(e) => setFormData({ ...formData, reviewCycle: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description & Guidelines</label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed guidelines on how this metric will be verified..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-1.5 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {isSubmitting ? 'Saving Metric...' : 'Save Metric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
