import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import payrollService from '../../services/payrollService';
import compensationService from '../../services/compensationService';
import salaryRevisionService from '../../services/salaryRevisionService';
import loanService from '../../services/loanService';
import employeeService from '../../services/employeeService';
import apiClient from '../../services/apiClient';
import { syncOrganization, syncPayroll } from '../../services/backendSync';

import PayrollSummaryCards from '../../components/payroll/PayrollSummaryCards';
import PayrollRunTable from '../../components/payroll/PayrollRunTable';
import PayrollRunDetailModal from '../../components/payroll/PayrollRunDetailModal';
import SalaryStructureTable from '../../components/payroll/SalaryStructureTable';
import SalaryRevisionTable from '../../components/payroll/SalaryRevisionTable';
import SalaryRevisionModal from '../../components/payroll/SalaryRevisionModal';
import AllowanceManagementTable from '../../components/payroll/AllowanceManagementTable';
import CommissionManagementTable from '../../components/payroll/CommissionManagementTable';
import LoanManagementTable from '../../components/payroll/LoanManagementTable';
import LoanRequestModal from '../../components/payroll/LoanRequestModal';
import TaxSlabTable from '../../components/payroll/TaxSlabTable';
import BankPaymentRegisterTable from '../../components/payroll/BankPaymentRegisterTable';
import PayslipModal from '../../components/payroll/PayslipModal';

export default function SuperAdminPayrollPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'runs');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Master states
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [structures, setStructures] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Modals
  const [selectedRun, setSelectedRun] = useState(null);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedRevisionEmployee, setSelectedRevisionEmployee] = useState(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Period generator
  const [newRunPeriod, setNewRunPeriod] = useState('2026-11');
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const loadData = () => {
    try {
      setPayrollRuns(payrollService.getPayrollRuns() || []);
    } catch (e) {
      console.error('Error loading payroll runs:', e);
      setPayrollRuns([]);
    }
    try {
      setStructures(compensationService.getAllSalaryStructures() || []);
    } catch (e) {
      console.error('Error loading structures:', e);
      setStructures([]);
    }
    try {
      setRevisions(salaryRevisionService.getRevisions() || []);
    } catch (e) {
      console.error('Error loading revisions:', e);
      setRevisions([]);
    }
    try {
      setLoans(loanService.getLoans() || []);
    } catch (e) {
      console.error('Error loading loans:', e);
      setLoans([]);
    }
    try {
      setEmployees(employeeService.getEmployees() || []);
    } catch (e) {
      console.error('Error loading employees:', e);
      setEmployees([]);
    }
  };

  useEffect(() => {
    loadData();
    syncOrganization()
      .then(() => {
        setEmployees(employeeService.getEmployees() || []);
      })
      .catch((err) => console.warn('[Payroll] Sync organization warning:', err));

    syncPayroll()
      .then(() => {
        setPayrollRuns(payrollService.getPayrollRuns() || []);
        setLoans(loanService.getLoans() || []);
        setStructures(compensationService.getAllSalaryStructures() || []);
        setRevisions(salaryRevisionService.getRevisions() || []);
      })
      .catch((err) => console.warn('[Payroll] Sync payroll warning:', err));

    const unsubEmp = employeeService.subscribe(() => {
      setEmployees(employeeService.getEmployees() || []);
    });
    const unsubLoan = loanService.subscribe(() => {
      setLoans(loanService.getLoans() || []);
    });
    const unsubPayroll = payrollService.subscribe(() => {
      setPayrollRuns(payrollService.getPayrollRuns() || []);
    });
    const unsubRevision = salaryRevisionService.subscribe(() => {
      setRevisions(salaryRevisionService.getRevisions() || []);
    });
    return () => {
      if (typeof unsubEmp === 'function') unsubEmp();
      if (typeof unsubLoan === 'function') unsubLoan();
      if (typeof unsubPayroll === 'function') unsubPayroll();
      if (typeof unsubRevision === 'function') unsubRevision();
    };
  }, []);

  const handleGenerateRun = async () => {
    setIsGenerating(true);
    setActionMessage(null);
    try {
      const createdRun = await apiClient.post('/payroll/runs/generate', { periodCode: newRunPeriod });
      await syncPayroll();
      loadData();
      const headcount = createdRun?.totalEmployees ?? createdRun?.entries?.length ?? 0;
      setActionMessage({
        type: 'success',
        text: `Draft payroll run ${createdRun?.runNumber || newRunPeriod} generated for ${newRunPeriod} (${headcount} eligible employee${headcount === 1 ? '' : 's'}).`
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to generate draft payroll run.' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Validate database payroll line items & active employee eligibility before workflow transitions.
  const validatePayrollRunBreakdown = (runId) => {
    const run = payrollRuns.find((item) => String(item.id) === String(runId));
    const breakdown = run?.employeeBreakdown;

    if (!run || !Array.isArray(breakdown) || breakdown.length === 0) {
      return 'Employee-wise payroll calculations are missing.';
    }

    if (run.isReconciled === false && Array.isArray(run.reconciliationIssues) && run.reconciliationIssues.length > 0) {
      return run.reconciliationIssues.join(' ');
    }

    if (Number(run.totalEmployees) !== breakdown.length) {
      return `Payroll employee headcount (${run.totalEmployees}) does not match its breakdown (${breakdown.length}).`;
    }

    const inactiveEntry = breakdown.find(
      (item) => item.employmentStatus && item.employmentStatus !== 'ACTIVE' && item.employmentStatus !== 'UNKNOWN'
    );
    if (inactiveEntry) {
      return `Payroll includes non-ACTIVE employee ${inactiveEntry.employeeName} (${inactiveEntry.employmentStatus}). Void the invalid draft and regenerate.`;
    }

    const gross = breakdown.reduce((sum, item) => sum + Number(item.grossSalary || 0), 0);
    const net = breakdown.reduce((sum, item) => sum + Number(item.netPayable || 0), 0);
    if (!Number.isFinite(gross) || !Number.isFinite(net) ||
      Math.abs(gross - Number(run.grossPayroll)) > 0.01 ||
      Math.abs(net - Number(run.netPayable)) > 0.01) {
      return 'Payroll summary totals do not reconcile with employee calculations.';
    }

    return null;
  };

  const handleSubmitReview = async (runId) => {
    setActionMessage(null);
    const validationError = validatePayrollRunBreakdown(runId);
    if (validationError) {
      setActionMessage({ type: 'error', text: `Submit blocked: ${validationError}` });
      return;
    }
    try {
      await apiClient.patch(`/payroll/runs/${runId}/submit`, {});
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: 'Payroll run submitted for Super Admin approval.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to submit payroll run.' });
      throw err;
    }
  };

  const handleApproveRun = async (runId) => {
    setActionMessage(null);
    const validationError = validatePayrollRunBreakdown(runId);
    if (validationError) {
      const msg = `Approval blocked: ${validationError}`;
      setActionMessage({ type: 'error', text: msg });
      throw new Error(msg);
    }
    try {
      const run = payrollRuns.find((item) => String(item.id) === String(runId));
      const statusUpper = String(run?.status || '').toUpperCase();
      if (statusUpper === 'DRAFT') {
        await apiClient.patch(`/payroll/runs/${runId}/submit`, {});
      }
      await apiClient.patch(`/payroll/runs/${runId}/approve`, {});
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: `Payroll run ${run?.runNumber || runId} approved successfully.` });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to approve payroll run.' });
      throw err;
    }
  };

  const handleFinalizeRun = async (runId, paymentDetails = null) => {
    setActionMessage(null);
    const validationError = validatePayrollRunBreakdown(runId);
    if (validationError) {
      setActionMessage({ type: 'error', text: `Finalize blocked: ${validationError}` });
      return;
    }
    const run = payrollRuns.find((item) => String(item.id) === String(runId));
    if (String(run?.status || '').toUpperCase() !== 'APPROVED') {
      setActionMessage({ type: 'error', text: 'Only APPROVED payroll runs can be disbursed.' });
      return;
    }
    if (!paymentDetails?.transactionReference?.trim()) {
      setSelectedRun(run);
      setActionMessage({ type: 'error', text: 'Enter the bank transaction reference inside the Master Sheet modal to complete disbursement.' });
      return;
    }
    try {
      await apiClient.patch(`/payroll/runs/${runId}/disburse`, {
        paymentMethod: paymentDetails.paymentMethod || 'BANK_TRANSFER',
        transactionReference: paymentDetails.transactionReference.trim()
      });
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: `Payroll run ${run?.runNumber || runId} disbursed and marked PAID.` });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to disburse payroll run.' });
      throw err;
    }
  };

  const handleVoidRun = async (runId, reason) => {
    setActionMessage(null);
    try {
      await apiClient.post(`/payroll/runs/${runId}/void`, { reason });
      await syncPayroll();
      loadData();
      setSelectedRun(null);
      setActionMessage({ type: 'success', text: 'Payroll run voided successfully.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to void payroll run.' });
      throw err;
    }
  };

  const handleReconcileRun = async (runId) => {
    setActionMessage(null);
    try {
      const result = await apiClient.post(`/payroll/runs/${runId}/reconcile`, {
        reason: 'Payroll reconciliation against canonical active employees and effective salary structures'
      });
      await syncPayroll();
      loadData();
      const nextRun = result?.reconciledRun;
      if (nextRun?.id) {
        const refreshed = (payrollService.getPayrollRuns() || []).find((r) => r.id === nextRun.id);
        setSelectedRun(refreshed || null);
      } else {
        setSelectedRun(null);
      }
      setActionMessage({
        type: 'success',
        text: `Invalid draft voided (audit preserved) and canonical draft ${nextRun?.runNumber || ''} generated for ${nextRun?.totalEmployees ?? 0} eligible employee(s).`
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to reconcile payroll run.' });
      throw err;
    }
  };

  const handleApproveLoan = async (loanId) => {
    setActionMessage(null);
    try {
      const loan = loans.find((l) => l.id === loanId || l.loanNumber === loanId || l.cuid === loanId);
      const targetId = loan?.cuid || loan?.id || loanId;
      await apiClient.patch(`/payroll/loans/${targetId}/review`, { decision: 'APPROVED' });
      await apiClient.post(`/payroll/loans/${targetId}/disburse`, {});
      setActionMessage({ type: 'success', text: `Loan ${loan?.loanNumber || loanId} approved and marked disbursed.` });
      await syncPayroll();
      loadData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to approve loan.' });
    }
  };

  const handleRejectLoan = async (loanId) => {
    setActionMessage(null);
    try {
      const loan = loans.find((l) => l.id === loanId || l.loanNumber === loanId || l.cuid === loanId);
      const targetId = loan?.cuid || loan?.id || loanId;
      await apiClient.patch(`/payroll/loans/${targetId}/review`, { decision: 'REJECTED', remarks: 'Declined by Administrator' });
      setActionMessage({ type: 'success', text: `Loan ${loan?.loanNumber || loanId} declined.` });
      await syncPayroll();
      loadData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to reject loan.' });
    }
  };

  const handleViewRun = (run) => {
    setSelectedRun(run);
  };

  const handleInitiateRevision = (employee) => {
    setSelectedRevisionEmployee(employee);
    setIsRevisionModalOpen(true);
  };

  const handleApproveRevision = async (revisionId) => {
    setActionMessage(null);
    try {
      await salaryRevisionService.approveProposal(revisionId, currentUser, 'Approved under Super Admin authority');
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: 'Salary revision approved and salary structure updated.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to approve salary revision.' });
    }
  };

  const handleRejectRevision = async (revisionId, reason) => {
    setActionMessage(null);
    try {
      await salaryRevisionService.rejectProposal(revisionId, reason || 'Declined by Super Admin', currentUser);
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: 'Salary revision proposal rejected.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to reject salary revision.' });
    }
  };

  const handleReturnRevision = async (revisionId, notes) => {
    setActionMessage(null);
    try {
      await salaryRevisionService.returnProposal(revisionId, notes || 'Additional clarification requested', currentUser);
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: 'Salary revision proposal returned for clarification.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to return salary revision.' });
    }
  };

  const tabs = [
    { id: 'runs', label: 'Payroll Overview & Runs', icon: 'fa-money-check-dollar' },
    { id: 'structures', label: 'Salary Structures', icon: 'fa-file-invoice' },
    { id: 'revisions', label: 'Salary Revisions', icon: 'fa-arrow-trend-up', badge: revisions.filter(r => r.status === 'PENDING_APPROVAL').length },
    { id: 'allowances', label: 'Allowances & Benefits', icon: 'fa-gift' },
    { id: 'commissions', label: 'Sales Commissions', icon: 'fa-chart-line' },
    { id: 'loans', label: 'Loans & Advances', icon: 'fa-hand-holding-dollar', badge: loans.filter(l => l.status === 'Pending Super Admin Review' || l.status === 'PENDING' || l.status === 'APPLIED').length },
    { id: 'tax', label: 'Section 149 Tax', icon: 'fa-scale-balanced' },
    { id: 'payments', label: 'Bank Advice & Payments', icon: 'fa-building-columns' },
  ];

  const latestActiveRun = payrollRuns.find((r) => String(r.status || '').toUpperCase() !== 'VOID') || null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'structures'
              ? 'Salary Structures & Grading'
              : activeTab === 'revisions'
                ? 'Salary Revisions & Increments'
                : activeTab === 'allowances'
                  ? 'Allowances & Deductions'
                  : activeTab === 'commissions'
                    ? 'Incentive & Commissions'
                    : activeTab === 'loans'
                      ? 'Company Loans & Advances'
                      : activeTab === 'tax'
                        ? 'FBR Section 149 Tax'
                        : activeTab === 'payments'
                          ? 'Bank Disbursement Advice'
                          : 'Payroll Processing & Runs'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'structures'
              ? 'Standard salary grading models, base pay compositions, and allowance rules.'
              : activeTab === 'revisions'
                ? 'Executive approvals for employee pay adjustments, effective-dated revisions, and historical audit.'
                : activeTab === 'allowances'
                  ? 'Recurring and one-off staff allowances, medical allowances, and statutory benefits.'
                  : activeTab === 'commissions'
                    ? 'Performance incentive tiers, sales target commissions, and bonus payments.'
                    : activeTab === 'loans'
                      ? 'Company loan facilities, interest-free advances, and automated monthly payroll deductions.'
                      : activeTab === 'tax'
                        ? 'Pakistani FBR Section 149 monthly progressive tax slabs and withholding schedules.'
                        : activeTab === 'payments'
                          ? 'Finalized bank disbursement advice statements, IBAN verification, and direct deposits.'
                          : 'Execute monthly payroll calculations, review attendance integrations, finalize pay runs, and generate payslips.'}
          </p>
        </div>

        {activeTab === 'runs' && (
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={newRunPeriod}
              onChange={(e) => setNewRunPeriod(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600"
            />
            <button
              onClick={handleGenerateRun}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <i className="fa-solid fa-calculator"></i>
              {isGenerating ? 'Generating...' : 'Generate Period Draft'}
            </button>
          </div>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-3 text-xs rounded-lg border flex items-center justify-between ${actionMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
            }`}
        >
          <div className="flex items-center gap-2">
            <i className={`fa-solid ${actionMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700 ml-4">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {activeTab === 'runs' && <PayrollSummaryCards
        payrollRuns={payrollRuns}
        grossPayroll={latestActiveRun?.grossPayroll}
        netPayable={latestActiveRun?.netPayable}
        taxWithheld={latestActiveRun?.totalTaxWithheld}
        loanDeductions={latestActiveRun?.totalLoanDeductions}
        periodName={latestActiveRun?.periodName}
      />}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'runs' && (
          <PayrollRunTable
            runs={payrollRuns}
            payrollRuns={payrollRuns}
            onViewRun={handleViewRun}
            onApproveRun={handleApproveRun}
            onFinalizeRun={handleFinalizeRun}
            onReconcileRun={handleReconcileRun}
          />
        )}

        {activeTab === 'structures' && (
          <SalaryStructureTable
            structures={structures}
            onInitiateRevision={handleInitiateRevision}
            canPropose={true}
          />
        )}

        {activeTab === 'revisions' && (
          <SalaryRevisionTable
            revisions={revisions}
            onApprove={handleApproveRevision}
            onReject={handleRejectRevision}
            onReturn={handleReturnRevision}
            onRevisionUpdated={loadData}
            canPropose={true}
            onOpenNewProposal={() => handleInitiateRevision(null)}
            canApprove={true}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'allowances' && (
          <AllowanceManagementTable employees={employees} canManage={true} />
        )}

        {activeTab === 'commissions' && (
          <CommissionManagementTable employees={employees} />
        )}

        {activeTab === 'loans' && (
          <LoanManagementTable
            loans={loans}
            onApproveLoan={handleApproveLoan}
            onRejectLoan={handleRejectLoan}
            onLoanUpdated={loadData}
            onOpenApplyModal={() => setIsLoanModalOpen(true)}
            canApply={true}
            canApprove={true}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'tax' && (
          <TaxSlabTable />
        )}

        {activeTab === 'payments' && (
          <BankPaymentRegisterTable
            payrollRuns={payrollRuns}
            onPaymentUpdated={loadData}
          />
        )}
      </div>

      {/* Detail / Payslip / Revision Modals */}
      {selectedRun && (() => {
        const activeRun = payrollRuns.find((r) => r.id === selectedRun.id) || selectedRun;
        return (
          <PayrollRunDetailModal
            run={activeRun}
            isOpen={!!selectedRun}
            currentUser={currentUser}
            onClose={() => setSelectedRun(null)}
            onSubmitReview={handleSubmitReview}
            onApprove={handleApproveRun}
            onFinalizePost={handleFinalizeRun}
            onVoidRun={handleVoidRun}
            onReconcileRun={handleReconcileRun}
            onViewPayslip={(employeeIdOrSlip) => {
              if (employeeIdOrSlip && typeof employeeIdOrSlip === 'object') {
                setSelectedPayslip(employeeIdOrSlip);
                return;
              }
              const entry = (activeRun.employeeBreakdown || []).find(
                (e) => e.employeeId === employeeIdOrSlip || e.employeeCuid === employeeIdOrSlip
              );
              if (entry) {
                setSelectedPayslip(payrollService.buildPayslipFromEntry(activeRun, entry));
              }
            }}
          />
        );
      })()}

      {isRevisionModalOpen && (
        <SalaryRevisionModal
          isOpen={isRevisionModalOpen}
          onClose={() => {
            setIsRevisionModalOpen(false);
            setSelectedRevisionEmployee(null);
          }}
          employee={selectedRevisionEmployee}
          employees={employees}
          onRevisionCreated={() => {
            syncPayroll().then(loadData).catch(() => loadData());
          }}
        />
      )}

      {isLoanModalOpen && (
        <LoanRequestModal
          isOpen={isLoanModalOpen}
          onClose={() => setIsLoanModalOpen(false)}
          employees={employees}
          onLoanCreated={() => {
            syncPayroll().then(loadData).catch(() => loadData());
          }}
        />
      )}

      {selectedPayslip && (
        <PayslipModal
          payslip={selectedPayslip}
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </div>
  );
}
