import React, { useState, useEffect, useMemo } from 'react';
import payrollPaymentService, { isValidPakistaniIban } from '../../services/payrollPaymentService';
import { useAuth } from '../../context/AuthContext';

export default function BankPaymentRegisterTable({ payrollRuns = [], onPaymentUpdated }) {
  const { currentUser } = useAuth();
  const canDisburse = ['SUPER_ADMIN', 'HR_ADMIN'].includes(currentUser?.role);

  // Prefer reconciled Approved / Disbursed runs first, then non-VOID runs
  const approvedOrDisbursedRuns = useMemo(() => {
    return payrollRuns.filter((r) =>
      ['APPROVED', 'DISBURSED', 'POSTED', 'FINALIZED', 'Approved', 'Posted', 'Finalized'].includes(r.status) &&
      r.isReconciled !== false &&
      r.hasInactiveEmployees !== true
    );
  }, [payrollRuns]);

  const nonVoidRuns = useMemo(() => {
    return payrollRuns.filter((r) => String(r.status || '').toUpperCase() !== 'VOID');
  }, [payrollRuns]);

  const [selectedRunId, setSelectedRunId] = useState(() => {
    return approvedOrDisbursedRuns[0]?.id || nonVoidRuns[0]?.id || payrollRuns[0]?.id || '';
  });

  // Keep selectedRunId synchronized when payrollRuns load or update
  useEffect(() => {
    const selectedExists = payrollRuns.some((r) => r.id === selectedRunId);
    const preferred = approvedOrDisbursedRuns[0] || nonVoidRuns[0] || payrollRuns[0];
    if ((!selectedRunId || !selectedExists) && preferred) {
      setSelectedRunId(preferred.id);
    }
  }, [payrollRuns, selectedRunId, approvedOrDisbursedRuns, nonVoidRuns]);

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Disbursement modal state
  const [disbursingItem, setDisbursingItem] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('IBFT');
  const [modalError, setModalError] = useState('');

  const currentRun = useMemo(() => {
    return payrollRuns.find((r) => r.id === selectedRunId) || null;
  }, [payrollRuns, selectedRunId]);

  const register = useMemo(() => {
    if (currentRun) {
      return payrollPaymentService.generatePaymentRegisterForRun(currentRun);
    }
    return payrollPaymentService.getPaymentRegister(selectedRunId);
  }, [currentRun, selectedRunId]);

  const filteredRegister = useMemo(() => {
    return register.filter((item) => {
      if (filterStatus === 'ALL') return true;
      return item.paymentStatus === filterStatus;
    });
  }, [register, filterStatus]);

  // Reconciliation Totals & Counts
  const totalPayable = useMemo(() => {
    return register.reduce((acc, r) => acc + (Number(r.netPayable) || 0), 0);
  }, [register]);

  const paidCount = useMemo(() => {
    return register.filter((r) => r.paymentStatus === 'PAID').length;
  }, [register]);

  const pendingCount = useMemo(() => {
    return register.filter((r) => r.paymentStatus === 'PENDING').length;
  }, [register]);

  const holdCount = useMemo(() => {
    return register.filter((r) => r.paymentStatus === 'HOLD').length;
  }, [register]);

  const verifiedCount = useMemo(() => {
    return register.filter((r) => r.isVerified).length;
  }, [register]);

  // Status check for export & disbursement authorization: Must be Approved/Disbursed AND reconciled
  const currentRunStatus = String(currentRun?.status || '').toUpperCase();
  const isRunReconciled = currentRun ? (currentRun.isReconciled !== false && currentRun.hasInactiveEmployees !== true) : false;
  const isExportAllowed = ['APPROVED', 'DISBURSED', 'POSTED', 'FINALIZED'].includes(currentRunStatus) && isRunReconciled;
  const canExportCsv = isExportAllowed && verifiedCount > 0 && register.length > 0;

  const handleExportAdvice = () => {
    setExportMessage(null);
    if (!isRunReconciled) {
      setExportMessage({
        type: 'error',
        text: `Export blocked: Payroll run fails reconciliation (${(currentRun?.reconciliationIssues || ['validation hold']).join(' ')}). Void and regenerate before disbursement.`,
      });
      return;
    }
    if (!isExportAllowed) {
      setExportMessage({
        type: 'error',
        text: `Export blocked: Run is in '${currentRun?.status || 'Unknown'}' status. Only Approved or Disbursed runs can be exported.`,
      });
      return;
    }

    if (verifiedCount === 0) {
      setExportMessage({
        type: 'error',
        text: 'Export blocked: No verified bank accounts found in this payroll batch.',
      });
      return;
    }

    setIsExporting(true);
    try {
      const advice = payrollPaymentService.generateBankTransferAdvice(currentRun || selectedRunId);
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [
          ['Batch ID', advice.batchId],
          ['Payroll Period', advice.period],
          ['Generated At', advice.generatedAt],
          ['Total Verified Amount', advice.totalAmount],
          ['Verified Record Count', advice.recordCount],
          [],
          ['Sr', 'Employee ID', 'Employee Name', 'Bank Name', 'Account Title', 'IBAN / Account', 'Amount (PKR)', 'Payment Ref'],
          ...advice.items.map((i, idx) => [
            idx + 1,
            i.employeeId,
            `"${i.employeeName}"`,
            `"${i.bankName || ''}"`,
            `"${i.accountTitle || ''}"`,
            `"${i.iban || ''}"`,
            i.amount,
            i.paymentReference,
          ]),
        ]
          .map((row) => row.join(','))
          .join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Bank_Advice_${selectedRunId || 'Batch'}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportMessage({
        type: 'success',
        text: `Bank advice CSV exported successfully (${advice.recordCount} verified accounts, PKR ${advice.totalAmount.toLocaleString()}).`,
      });
    } catch (err) {
      setExportMessage({
        type: 'error',
        text: err.message || 'Failed to export bank transfer advice.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenDisburse = (item) => {
    if (!isExportAllowed) {
      setExportMessage({
        type: 'error',
        text: `Disbursement blocked: Payroll run is in '${currentRun?.status || 'Unknown'}' status. Draft or unapproved runs cannot be disbursed.`
      });
      return;
    }
    setDisbursingItem(item);
    setReferenceNumber(`FT-${Date.now().toString().slice(-6)}`);
    setPaymentMethod('IBFT');
    setModalError('');
  };

  const handleConfirmDisbursement = (e) => {
    e.preventDefault();
    if (!referenceNumber.trim()) {
      setModalError('Bank transaction reference number is required.');
      return;
    }

    const res = payrollPaymentService.recordPaymentConfirmation({
      runId: selectedRunId,
      employeeId: disbursingItem.employeeId,
      reference: referenceNumber,
      paymentMethod,
      actor: currentUser,
    });

    if (!res.success) {
      setModalError(res.error || 'Payment confirmation failed');
      return;
    }

    setDisbursingItem(null);
    onPaymentUpdated?.();
  };

  return (
    <div className="space-y-4">
      {/* Notifications / Messages */}
      {exportMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            exportMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <i
              className={`fa-solid ${
                exportMessage.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'
              }`}
            ></i>
            <span>{exportMessage.text}</span>
          </div>
          <button
            onClick={() => setExportMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-4"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Governance & Hold Banners */}
      {currentRun && (!isExportAllowed || !isRunReconciled || (register.length > 0 && verifiedCount === 0)) && (
        <div className={`p-3 rounded-lg text-xs border flex items-start gap-2.5 ${
          !isRunReconciled
            ? 'bg-rose-50 text-rose-900 border-rose-200'
            : 'bg-amber-50 text-amber-900 border-amber-200'
        }`}>
          <i className={`fa-solid ${!isRunReconciled ? 'fa-shield-halved text-rose-600' : 'fa-circle-info text-amber-600'} mt-0.5`}></i>
          <div className="space-y-0.5">
            {!isRunReconciled && (
              <div className="font-bold">
                Validation Hold ({currentRun.runNumber || currentRun.id}): {(currentRun.reconciliationIssues || ['Payroll entry mismatch detected.']).join(' ')} Bank export and disbursement are blocked.
              </div>
            )}
            {isRunReconciled && !isExportAllowed && (
              <div className="font-semibold">
                Bank Transfer Advice &amp; Disbursement Locked: Batch is currently in <strong>{currentRun.status}</strong> status. Super Admin approval is required before generating bank transfer advice or releasing salary payments.
              </div>
            )}
            {register.length > 0 && verifiedCount === 0 && (
              <div className="text-[11px]">
                No employees in this batch have verified Pakistani IBAN / bank account details recorded in PostgreSQL. Add verified banking details to Employee Profiles before generating bank advice.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase">Payroll Run Batch</label>
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              {payrollRuns.length === 0 ? (
                <option value="">No payroll batches available</option>
              ) : (
                payrollRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.period || r.id} — {r.runNumber || r.id} ({r.status}{r.isReconciled === false ? ' • Validation Hold' : ''})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase">Payment Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            >
              <option value="ALL">All Statuses ({register.length})</option>
              <option value="PENDING">Pending Transfer ({pendingCount})</option>
              <option value="PAID">Disbursed / Paid ({paidCount})</option>
              <option value="HOLD">On Hold ({holdCount})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-500">Total Net Advice:</span>
            <div className="text-sm font-bold text-navy-950 font-mono">
              PKR {Math.round(totalPayable).toLocaleString()}
            </div>
          </div>
          <button
            onClick={handleExportAdvice}
            disabled={isExporting || !canExportCsv}
            title={
              !isRunReconciled
                ? 'Export blocked: Payroll run fails reconciliation checks.'
                : !isExportAllowed
                ? `Export blocked: Run status is '${currentRun?.status || 'Unknown'}'. Must be Approved or Disbursed.`
                : verifiedCount === 0
                ? 'Export blocked: No verified bank accounts found in this batch.'
                : 'Export payment-ready bank transfer advice CSV'
            }
            className="px-3 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-file-arrow-down"></i>
            {isExporting ? 'Exporting...' : 'Export Bank Advice (.CSV)'}
          </button>
        </div>
      </div>

      {/* Payment Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/70 text-xs text-slate-600 gap-2">
          <div>
            Showing <strong>{filteredRegister.length}</strong> of {register.length} records • Disbursed:{' '}
            <strong className="text-emerald-700">{paidCount}</strong> • Pending:{' '}
            <strong className="text-blue-700">{pendingCount}</strong>
            {holdCount > 0 && (
              <>
                {' '}• On Hold: <strong className="text-amber-700">{holdCount}</strong>
              </>
            )}
            {' '}• Verified Accounts: <strong className="text-indigo-700">{verifiedCount}/{register.length}</strong>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Canonical Payroll Entry reconciliation • Backend verified
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Bank Name</th>
                <th className="py-2.5 px-4">Account Title</th>
                <th className="py-2.5 px-4">Account / IBAN</th>
                <th className="py-2.5 px-4">Verification</th>
                <th className="py-2.5 px-4 text-right">Net Payable</th>
                <th className="py-2.5 px-4">Payment Status</th>
                <th className="py-2.5 px-4">Transfer Ref</th>
                {canDisburse && <th className="py-2.5 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRegister.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No payment records found for this period.
                  </td>
                </tr>
              ) : (
                filteredRegister.map((item) => (
                  <tr key={item.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-900">{item.employeeName}</div>
                      <div className="text-[11px] text-slate-500">{item.employeeCode || item.employeeId}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {item.bankName ? (
                        <div className="flex items-center gap-1.5">
                          <i className="fa-solid fa-building-columns text-slate-400 text-[10px]"></i>
                          <span>{item.bankName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {item.accountTitle || <span className="text-slate-400 italic text-[11px]">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.maskedIban || item.iban || item.maskedAccountNumber || item.accountNumber || (
                        <span className="text-slate-400 italic font-sans text-[11px]">Not Provided</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.isVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <i className="fa-solid fa-circle-check text-[10px]"></i>
                          Verified
                        </span>
                      ) : !item.bankName && !item.iban && !item.accountNumber ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <i className="fa-solid fa-circle-xmark text-[10px]"></i>
                          Missing Bank Info
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-navy-950">
                      PKR {Math.round(item.netPayable || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : item.paymentStatus === 'HOLD'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {item.paymentStatus === 'PAID'
                          ? 'Disbursed (Paid)'
                          : item.paymentStatus === 'HOLD'
                          ? 'On Hold'
                          : 'Pending Transfer'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {item.paymentReference || '—'}
                    </td>
                    {canDisburse && (
                      <td className="py-3 px-4 text-right">
                        {item.paymentStatus !== 'PAID' && (
                          isExportAllowed ? (
                            <button
                              onClick={() => handleOpenDisburse(item)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-navy-950 hover:bg-navy-900 text-white rounded transition-colors cursor-pointer"
                            >
                              Mark Disbursed
                            </button>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
                              Approval Required
                            </span>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Disbursed Confirmation Modal */}
      {disbursingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold">Record Salary Transfer Confirmation</h4>
                <p className="text-xs text-slate-300">Audited payment reconciliation</p>
              </div>
              <button
                onClick={() => setDisbursingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleConfirmDisbursement} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-200">
                  {modalError}
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="grid grid-cols-[150px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Employee:</span>
                  <span className="font-bold text-navy-950 text-left">{disbursingItem.employeeName}</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Bank / IBAN:</span>
                  <span className="font-mono text-slate-700 text-left">
                    {disbursingItem.bankName || 'No Bank Recorded'} ({disbursingItem.iban || disbursingItem.maskedIban || 'No IBAN'})
                  </span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-baseline gap-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold">Net Disbursed Amount:</span>
                  <span className="font-mono font-bold text-navy-950 text-sm text-left">
                    PKR {Math.round(disbursingItem.netPayable || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Instrument / Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                >
                  <option value="IBFT">Interbank Funds Transfer (IBFT / 1Link)</option>
                  <option value="RTGS">RTGS (High Value Settlement)</option>
                  <option value="INTERNAL_TRANSFER">Internal Bank Bulk Corporate Advice</option>
                  <option value="CROSSED_CHEQUE">Crossed Pay Order / Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank Transaction / Advice Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. FT-928374 or CHQ-00192"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisbursingItem(null)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-2"
                >
                  <i className="fa-solid fa-check"></i>
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
