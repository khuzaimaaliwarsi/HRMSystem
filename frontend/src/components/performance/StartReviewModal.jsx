import React, { useState, useEffect } from 'react';
import { employeeService } from '../../services/employeeService';
import performanceService from '../../services/performanceService';

export default function StartReviewModal({
  isOpen,
  onClose,
  cycles = [],
  employees = [],
  initialMode = 'review',
  canCreateCycle = true,
  onCompleted
}) {
  const [mode, setMode] = useState(cycles.length === 0 && canCreateCycle ? 'cycle' : initialMode);

  // Directory fallback
  const [directoryEmployees, setDirectoryEmployees] = useState(
    () => employeeService.getEmployees() || []
  );

  useEffect(() => {
    const refresh = () => setDirectoryEmployees(employeeService.getEmployees() || []);
    refresh();
    return employeeService.subscribe(refresh);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMode(cycles.length === 0 && canCreateCycle ? 'cycle' : initialMode);
      setError('');
      setSuccess('');
    }
  }, [isOpen, initialMode, cycles.length, canCreateCycle]);

  const activeEmployees = (directoryEmployees.length ? directoryEmployees : employees).filter(
    (emp) => String(emp?.status || emp?.employmentStatus || '').toUpperCase() === 'ACTIVE'
  );

  // Cycle Form State
  const [cycleTitle, setCycleTitle] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cycleEndDate, setCycleEndDate] = useState(() =>
    new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10)
  );
  const [cycleStatus, setCycleStatus] = useState('ACTIVE');

  // Review Form State
  const activeCycles = cycles.filter(
    (c) => !['CLOSED', 'ARCHIVED'].includes(String(c?.status || '').toUpperCase())
  );
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedReviewerId, setSelectedReviewerId] = useState('');

  useEffect(() => {
    if (!selectedCycleId && activeCycles.length > 0) {
      setSelectedCycleId(activeCycles[0].id);
    }
  }, [activeCycles, selectedCycleId]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreateCycle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!cycleTitle.trim() || !cycleStartDate || !cycleEndDate) {
      setError('Cycle title, start date, and end date are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await performanceService.createCycleAsync({
        title: cycleTitle.trim(),
        startDate: cycleStartDate,
        endDate: cycleEndDate,
        status: cycleStatus
      });
      setSuccess(`Appraisal cycle "${created.title}" created.`);
      setCycleTitle('');
      if (created?.id) setSelectedCycleId(created.id);
      onCompleted?.(created);
      setTimeout(() => setMode('review'), 350);
    } catch (err) {
      setError(err?.message || 'Failed to create appraisal cycle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateReview = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedCycleId) {
      setError('Please select an active appraisal cycle.');
      return;
    }
    if (!selectedEmployeeId) {
      setError('Please select an active employee to evaluate.');
      return;
    }
    if (selectedReviewerId && selectedReviewerId === selectedEmployeeId) {
      setError('Employee cannot be assigned as their own reviewer.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await performanceService.initiateReviewAsync({
        cycleId: selectedCycleId,
        employeeId: selectedEmployeeId,
        reviewerId: selectedReviewerId || undefined
      });
      setSuccess('Performance appraisal review initiated in PostgreSQL.');
      onCompleted?.(created);
      setTimeout(() => onClose?.(), 400);
    } catch (err) {
      setError(err?.message || 'Failed to initiate performance review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold">
              {mode === 'cycle' ? 'Create Appraisal Cycle' : 'Start Employee Performance Review'}
            </h3>
            <p className="text-xs text-slate-300">PostgreSQL-backed appraisal governance & cycle initiation</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Mode Switcher */}
        {canCreateCycle && (
          <div className="px-6 pt-3 border-b border-slate-200 flex gap-4 text-xs bg-slate-50">
            <button
              type="button"
              onClick={() => { setMode('review'); setError(''); setSuccess(''); }}
              className={`pb-2.5 font-bold border-b-2 transition-colors ${
                mode === 'review'
                  ? 'border-navy-950 text-navy-950'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Start Review
            </button>
            <button
              type="button"
              onClick={() => { setMode('cycle'); setError(''); setSuccess(''); }}
              className={`pb-2.5 font-bold border-b-2 transition-colors ${
                mode === 'cycle'
                  ? 'border-navy-950 text-navy-950'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              + New Appraisal Cycle
            </button>
          </div>
        )}

        <div className="p-6 text-xs space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          {mode === 'cycle' ? (
            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Appraisal Cycle Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Q4 2026 Annual Performance Review"
                  value={cycleTitle}
                  onChange={(e) => setCycleTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={cycleStartDate}
                    onChange={(e) => setCycleStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={cycleEndDate}
                    onChange={(e) => setCycleEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Cycle Status</label>
                <select
                  value={cycleStatus}
                  onChange={(e) => setCycleStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none font-semibold"
                >
                  <option value="ACTIVE">ACTIVE (Open for Reviews)</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
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
                  className="px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Creating...' : 'Create Cycle'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleInitiateReview} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Appraisal Cycle *</label>
                <select
                  required
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none font-semibold"
                >
                  <option value="">-- Select Active Cycle --</option>
                  {activeCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.name} ({c.status})
                    </option>
                  ))}
                </select>
                {activeCycles.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    No active cycles found. Switch to "+ New Appraisal Cycle" to create one first.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Evaluatee (Active Employee) *</label>
                <select
                  required
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none font-semibold"
                >
                  <option value="">-- Select Employee --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.cuid || emp.id} value={emp.cuid || emp.id}>
                      {emp.id} — {emp.name} ({emp.designation} • {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designated Reviewer (Optional)</label>
                <select
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                >
                  <option value="">Auto / Reporting Manager</option>
                  {activeEmployees
                    .filter((emp) => (emp.cuid || emp.id) !== selectedEmployeeId)
                    .map((emp) => (
                      <option key={emp.cuid || emp.id} value={emp.cuid || emp.id}>
                        {emp.id} — {emp.name} ({emp.designation})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || activeCycles.length === 0}
                  className="px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Initiating...' : 'Start Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

