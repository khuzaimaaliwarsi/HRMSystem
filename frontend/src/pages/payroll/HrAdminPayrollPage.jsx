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
import EmployeePayrollBreakdownTable from '../../components/payroll/EmployeePayrollBreakdownTable';
import RefreshDraftConfirmModal from '../../components/payroll/RefreshDraftConfirmModal';

export default function HrAdminPayrollPage() {
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

  const [payrollRuns, setPayrollRuns] = useState([]);
  const [structures, setStructures] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [selectedRun, setSelectedRun] = useState(null);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedRevisionEmployee, setSelectedRevisionEmployee] = useState(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Refresh Draft Modal state
  const [refreshRunTarget, setRefreshRunTarget] = useState(null);
  const [refreshPreviewData, setRefreshPreviewData] = useState(null);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [breakdownPeriod, setBreakdownPeriod] = useState('2026-11');

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
      setEmployees(employeeService.getAllEmployees() || []);
    } catch (e) {
      console.error('Error loading employees:', e);
      setEmployees([]);
    }
  };

  useEffect(() => {
    loadData();
    syncOrganization()
      .then(() => {
        setEmployees(employeeService.getAllEmployees() || employeeService.getEmployees() || []);
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
      setEmployees(employeeService.getAllEmployees() || employeeService.getEmployees() || []);
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
        text: `Draft run ${createdRun?.runNumber || newRunPeriod} created for ${newRunPeriod} (${headcount} eligible employee${headcount === 1 ? '' : 's'}).`
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to generate draft payroll run.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitReview = async (runId) => {
    setActionMessage(null);
    const run = payrollRuns.find((item) => String(item.id) === String(runId));
    if (run && (run.isReconciled === false || run.hasInactiveEmployees === true)) {
      const msg = `Submit blocked: ${(run.reconciliationIssues || ['Payroll summary totals or employee eligibility do not reconcile. Ask Super Admin to void and regenerate.']).join(' ')}`;
      setActionMessage({ type: 'error', text: msg });
      throw new Error(msg);
    }
    try {
      await apiClient.patch(`/payroll/runs/${runId}/submit`, {});
      await syncPayroll();
      loadData();
      setActionMessage({ type: 'success', text: 'Draft payroll run submitted for Super Admin review.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to submit payroll run.' });
      throw err;
    }
  };

  const handleOpenRefreshModal = async (run) => {
    setActionMessage(null);
    setRefreshRunTarget(run);
    try {
      const res = await apiClient.post(`/payroll/runs/${run.id}/refresh?preview=true`, { preview: true });
      const preview = res?.data || res?.previewDiff || res;
      setRefreshPreviewData(preview);
    } catch (err) {
      try {
        const preview = payrollService.getDraftRefreshPreview(run.id);
        setRefreshPreviewData(preview);
      } catch (e) {
        setRefreshPreviewData(null);
      }
    }
    setIsRefreshModalOpen(true);
  };

  const handleConfirmRefreshDraft = async (runId) => {
    setIsRefreshing(true);
    setActionMessage(null);
    try {
      const refreshedRun = await apiClient.post(`/payroll/runs/${runId}/refresh`, {
        reason: 'HR Admin recalculation of draft payroll against canonical records'
      });
      await syncPayroll();
      loadData();
      setIsRefreshModalOpen(false);
      setRefreshRunTarget(null);
      const headcount = refreshedRun?.totalEmployees ?? refreshedRun?.entries?.length ?? 0;
      setActionMessage({
        type: 'success',
        text: `Draft payroll run ${refreshedRun?.runNumber || runId} refreshed successfully (${headcount} employee${headcount === 1 ? '' : 's'}). Run ID and Run Number preserved.`
      });
    } catch (err) {
      try {
        payrollService.refreshDraftRun(runId, currentUser);
        loadData();
        setIsRefreshModalOpen(false);
        setRefreshRunTarget(null);
        setActionMessage({
          type: 'success',
          text: 'Draft payroll run refreshed successfully.'
        });
      } catch (localErr) {
        setActionMessage({
          type: 'error',
          text: err?.message || localErr?.message || 'Failed to refresh payroll draft.'
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApproveEmployeeEntry = async (runId, entryId, entry) => {
    setActionMessage(null);
    try {
      await apiClient.patch(`/payroll/runs/${runId}/entries/${entryId}/approve`, {
        remarks: 'Approved by HR Admin'
      });
      await syncPayroll();
      loadData();
      setActionMessage({
        type: 'success',
        text: `Payroll entry for ${entry?.employeeName || entry?.employeeCode || 'employee'} approved successfully.`
      });
    } catch (err) {
      try {
        payrollService.approveEmployeeEntry(runId, entryId, currentUser);
        loadData();
        setActionMessage({
          type: 'success',
          text: `Payroll entry for ${entry?.employeeName || 'employee'} approved successfully.`
        });
      } catch (localErr) {
        setActionMessage({
          type: 'error',
          text: err?.message || localErr?.message || 'Failed to approve employee payroll entry.'
        });
      }
    }
  };

  const tabs = [
    { id: 'runs', label: 'Payroll Operations & Runs', icon: 'fa-money-check-dollar' },
    { id: 'structures', label: 'Salary Structures', icon: 'fa-file-invoice' },
    { id: 'revisions', label: 'Revision Proposals', icon: 'fa-arrow-trend-up' },
    { id: 'allowances', label: 'Allowances & Packages', icon: 'fa-gift' },
    { id: 'commissions', label: 'Sales Commissions', icon: 'fa-chart-line' },
    { id: 'loans', label: 'Loans & Advances', icon: 'fa-hand-holding-dollar' },
    { id: 'tax', label: 'Tax Calculations (S.149)', icon: 'fa-scale-balanced' },
    { id: 'payments', label: 'Bank Register & Advice', icon: 'fa-building-columns' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'structures'
              ? 'Salary Structures'
              : activeTab === 'revisions'
              ? 'Salary Revisions'
              : activeTab === 'allowances'
              ? 'Allowances & Benefits'
              : activeTab === 'commissions'
              ? 'Sales Commissions'
              : activeTab === 'loans'
              ? 'Loans & Advances'
              : activeTab === 'tax'
              ? 'Section 149 Tax'
              : activeTab === 'payments'
              ? 'Bank Advice & Payments'
              : 'Payroll Preparation & Runs'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'structures'
              ? 'Review employee salary grading, base compensations, and allowance breakdowns.'
              : activeTab === 'revisions'
              ? 'Draft employee compensation revision proposals for Super Admin executive review.'
              : activeTab === 'allowances'
              ? 'Record staff monthly allowances, medical benefits, and recurring subsidies.'
              : activeTab === 'commissions'
              ? 'Calculate sales commission batches and performance incentive bonuses.'
              : activeTab === 'loans'
              ? 'Company advance requests intake and monthly salary deduction tracking.'
              : activeTab === 'tax'
              ? 'Statutory FBR income tax withholding computations and verification.'
              : activeTab === 'payments'
              ? 'Prepare bank disbursement advice lists and verify employee account numbers.'
              : 'Prepare monthly payroll drafts, verify attendance & overtime canonical inputs, and manage employee benefits.'}
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
              {isGenerating ? 'Generating...' : 'Prepare Monthly Draft'}
            </button>
          </div>
        )}
      </div>

      {actionMessage && (
        <div
          className={`p-3 text-xs rounded-lg border flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <i className={`fa-solid ${actionMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      {activeTab === 'runs' && <PayrollSummaryCards payrollRuns={payrollRuns} />}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl min-h-[400px]">
        {activeTab === 'runs' && (
          <div className="space-y-6">
            <PayrollRunTable
              runs={payrollRuns}
              payrollRuns={payrollRuns}
              onViewRun={(run) => setSelectedRun(run)}
              onRefreshDraft={handleOpenRefreshModal}
              // HR Admin cannot finalize or provide final Super Admin approval
            />

            <EmployeePayrollBreakdownTable
              payrollRuns={payrollRuns}
              selectedPeriod={breakdownPeriod}
              onPeriodChange={setBreakdownPeriod}
              onViewPayslip={(run, entry) => {
                setSelectedPayslip(payrollService.buildPayslipFromEntry(run, entry));
              }}
              onApproveEntry={handleApproveEmployeeEntry}
              currentUser={currentUser}
              canApprove={true}
            />
          </div>
        )}

        {activeTab === 'structures' && (
          <SalaryStructureTable
            structures={structures}
            onInitiateRevision={(emp) => {
              setSelectedRevisionEmployee(emp);
              setIsRevisionModalOpen(true);
            }}
            canPropose={true}
          />
        )}

        {activeTab === 'revisions' && (
          <SalaryRevisionTable
            revisions={revisions}
            onRevisionUpdated={loadData}
            canPropose={true}
            onOpenNewProposal={() => {
              setSelectedRevisionEmployee(null);
              setIsRevisionModalOpen(true);
            }}
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

      {/* Modals */}
      {selectedRun && (() => {
        const activeRun = payrollRuns.find((r) => r.id === selectedRun.id) || selectedRun;
        return (
          <PayrollRunDetailModal
            run={activeRun}
            isOpen={!!selectedRun}
            currentUser={currentUser}
            onClose={() => setSelectedRun(null)}
            onSubmitReview={handleSubmitReview}
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

      {isRefreshModalOpen && (
        <RefreshDraftConfirmModal
          isOpen={isRefreshModalOpen}
          onClose={() => {
            setIsRefreshModalOpen(false);
            setRefreshRunTarget(null);
          }}
          onConfirm={handleConfirmRefreshDraft}
          run={refreshRunTarget}
          previewData={refreshPreviewData}
          isLoading={isRefreshing}
        />
      )}
    </div>
  );
}
