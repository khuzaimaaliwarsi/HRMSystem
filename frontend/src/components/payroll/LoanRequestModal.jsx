import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/apiClient';
import { syncPayroll } from '../../services/backendSync';
import { loanService } from '../../services/loanService';

export default function LoanRequestModal({ isOpen, onClose, onLoanCreated, employees = [] }) {
  const { currentUser } = useAuth();
  const roleNorm = String(currentUser?.role || currentUser?.backendRole || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const isSuperAdminOrHr = ['SUPERADMIN', 'HRADMIN', 'ADMIN'].includes(roleNorm);

  // Financial selectors must use freshly verified ACTIVE records, never cached props.
  const [employeeList, setEmployeeList] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeFetchError, setEmployeeFetchError] = useState('');

  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'PERSONAL_LOAN',
    principalAmount: '',
    tenureMonths: '',
    purpose: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real authoritative employees from PostgreSQL API whenever modal opens
  const fetchEmployeesFromApi = async () => {
    if (!isSuperAdminOrHr) return;
    setLoadingEmployees(true);
    setEmployeeFetchError('');
    setEmployeeList([]);
    setFormData((previous) => ({ ...previous, employeeId: '' }));
    try {
      const res = await apiClient.get('/employees?limit=200&status=ACTIVE');
      const list = Array.isArray(res) ? res : (res?.employees || res?.data?.employees || res?.data || []);
      if (!Array.isArray(list)) throw new Error('Unexpected employee API response');
      const normalized = list.filter((e) =>
        String(e.employmentStatus || e.status || '').trim().toUpperCase() === 'ACTIVE'
      ).map((e) => {
        const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.employeeCode || 'Employee';
        const desig = e.designation?.title || e.designation || 'Staff';
        return {
          id: e.id, // Real PostgreSQL primary key CUID
          employeeCode: e.employeeCode || e.id,
          name: fullName,
          designation: desig,
          department: e.department?.name || e.department || '',
          employmentStatus: 'ACTIVE'
        };
      });
      setEmployeeList(normalized);

    } catch (err) {
      console.error('Failed to fetch employees for loan modal:', err);
      // Fail closed: stale employee props must never enable a financial request.
      setEmployeeList([]);
      setEmployeeFetchError('Unable to verify active employees from server. Please retry.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (isOpen && isSuperAdminOrHr) {
      fetchEmployeesFromApi();
    }
  }, [isOpen, isSuperAdminOrHr]);

  const installmentPreview =
    Number(formData.principalAmount) > 0 &&
      Number(formData.tenureMonths) > 0
      ? Math.round(
        Number(formData.principalAmount) /
        Number(formData.tenureMonths)
      )
      : 0;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setSuccess('');

    if (!formData.purpose.trim()) {
      setError('Please provide a legitimate purpose for the request.');
      return;
    }

    const amount = Number(formData.principalAmount);
    const months = Number(formData.tenureMonths);
    const maxMonths = formData.type === 'SALARY_ADVANCE' ? 3 : 24;

    if (!formData.principalAmount || !Number.isFinite(amount) || amount < 5000) {
      setError('Principal amount must be at least PKR 5,000.');
      return;
    }

    if (
      !formData.tenureMonths ||
      !Number.isInteger(months) ||
      months < 1 ||
      months > maxMonths
    ) {
      setError(`Repayment tenure must be between 1 and ${maxMonths} months.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const employeeId = isSuperAdminOrHr
        ? formData.employeeId
        : (currentUser?.cuid || currentUser?.employeeId || currentUser?.id);

      if (isSuperAdminOrHr && (!employeeId || loadingEmployees || employeeFetchError ||
        !employeeList.some((emp) => emp.id === employeeId && emp.employmentStatus === 'ACTIVE'))) {
        setError('Please select a verified ACTIVE employee. Refresh the employee list if needed.');
        return;
      }

      const loan = await apiClient.post('/payroll/loans', {
        ...(isSuperAdminOrHr ? { employeeId } : {}),
        loanType: formData.type,
        principalAmount: Number(formData.principalAmount),
        repaymentMonths: Number(formData.tenureMonths),
        remarks: formData.purpose.trim(),
      });

      // Eagerly sync state with backend
      await syncPayroll().catch(() => {});
      if (typeof loanService.fetchLoans === 'function') {
        await loanService.fetchLoans().catch(() => {});
      }

      setSuccess('Loan / advance request submitted successfully.');
      setTimeout(() => {
        onLoanCreated?.(loan);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Error creating request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Apply for Loan / Salary Advance</h3>
            <p className="text-xs text-slate-300">Audited financial assistance workflow</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl cursor-pointer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-center gap-2">
              <i className="fa-solid fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          {isSuperAdminOrHr ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Employee <span className="text-rose-500">*</span>
                </label>
                {loadingEmployees && (
                  <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium">
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Loading from database...
                  </span>
                )}
              </div>

              {employeeFetchError ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                  <span>{employeeFetchError}</span>
                  <button
                    type="button"
                    onClick={fetchEmployeesFromApi}
                    className="text-xs font-bold text-navy-800 underline ml-2 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  disabled={loadingEmployees || !!employeeFetchError || employeeList.length === 0}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 disabled:opacity-60 cursor-pointer"
                >
                  <option value="" disabled>
                    {loadingEmployees
                      ? 'Loading employees from database...'
                      : employeeList.length === 0
                        ? 'No active employees found in database'
                        : 'Select Employee'}
                  </option>
                  {employeeList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeCode}) — {emp.designation}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser?.name || 'Current Employee'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {currentUser?.employeeId || currentUser?.id} • {currentUser?.designation || 'Staff'}
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Self-Service Request
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Facility Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({
                  ...formData,
                  type: e.target.value,
                  tenureMonths: ''
                })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              >
                <option value="PERSONAL_LOAN">Company Loan</option>
                <option value="SALARY_ADVANCE">Salary Advance (1 Month)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Tenure (Months)</label>
              <input
                type="number"
                min="1"
                max={formData.type === 'SALARY_ADVANCE' ? '3' : '24'}
                value={formData.tenureMonths}
                onChange={(e) => setFormData({
                  ...formData,
                  tenureMonths: e.target.value
                })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Principal Amount (PKR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">PKR</span>
              <input
                type="number"
                step="1000"
                min="5000"
                value={formData.principalAmount}
                onChange={(e) => setFormData({
                  ...formData,
                  principalAmount: e.target.value
                })}
                className="w-full text-sm border border-slate-300 rounded-lg pl-12 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
              />
            </div>
          </div>

          {/* Repayment Estimation Card */}
          <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-900 font-medium">Estimated Monthly Payroll Deduction:</span>
              <p className="text-xs text-slate-500">Auto-deducted starting next approved payroll period</p>
            </div>
            <span className="text-base font-bold text-navy-900">
              {Number(formData.principalAmount) > 0 &&
                Number(formData.tenureMonths) > 0
                ? `PKR ${installmentPreview.toLocaleString()}/mo`
                : '—'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Purpose</label>
            <textarea
              rows="3"
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="e.g. Medical emergency, family expenses, academic tuition..."
              className="w-full text-sm border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            ></textarea>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loadingEmployees || !!employeeFetchError || (isSuperAdminOrHr && !employeeList.some((emp) => emp.id === formData.employeeId && emp.employmentStatus === 'ACTIVE'))}
              className="px-5 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <i className="fa-solid fa-paper-plane"></i>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
