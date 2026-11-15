import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import payrollService from '../../services/payrollService';
import compensationService from '../../services/compensationService';
import loanService from '../../services/loanService';
import commissionService from '../../services/commissionService';
import taxService from '../../services/taxService';
import { syncPayroll } from '../../services/backendSync';

import PayslipModal from '../../components/payroll/PayslipModal';
import LoanRequestModal from '../../components/payroll/LoanRequestModal';

export default function EmployeePayrollPage() {
  const { currentUser, user } = useAuth();
  const currentEmp = currentUser || user || { id: 'EMP-004', employeeId: 'EMP-004', name: 'Zeeshan Ali' };
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'payslips');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [myPayslips, setMyPayslips] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [myStructure, setMyStructure] = useState(null);
  const [_myAllowances, setMyAllowances] = useState([]);
  const [myCommissions, setMyCommissions] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  const loadData = () => {
    const myId = currentEmp.employeeId || currentEmp.id || 'EMP-004';
    try {
      setMyPayslips(payrollService.getEmployeePayslips(myId) || []);
    } catch (e) {
      console.error('Error loading my payslips:', e);
      setMyPayslips([]);
    }
    try {
      setMyLoans(loanService.getEmployeeLoans(myId) || []);
    } catch (e) {
      console.error('Error loading my loans:', e);
      setMyLoans([]);
    }
    try {
      setMyStructure(compensationService.getEmployeeSalaryStructure(myId) || null);
    } catch (e) {
      console.error('Error loading my structure:', e);
      setMyStructure(null);
    }
    try {
      setMyAllowances(compensationService.getEmployeeAllowances(myId) || []);
    } catch (e) {
      console.error('Error loading my allowances:', e);
      setMyAllowances([]);
    }
    try {
      setMyCommissions(commissionService.getEmployeeCommissions(myId) || []);
    } catch (e) {
      console.error('Error loading my commissions:', e);
      setMyCommissions([]);
    }
  };

  useEffect(() => {
    loadData();
    syncPayroll().then(() => loadData()).catch((err) => console.warn('[EmployeePayroll] Sync warning:', err));
  }, [currentUser, user]);

  const latestPayslip = myPayslips[0] || null;

  // Personal tax estimation
  const monthlySalary = myStructure?.baseSalary || 0;
  const personalTax = taxService.calculateMonthlyTax({
    projectedMonthlyTaxable: monthlySalary,
    monthIndexInYear: 1,
  }) || { monthlyTaxWithheld: 0, effectiveTaxRate: 0, annualTaxLiability: 0 };

  return (
    <div className="space-y-6">
      {/* Employee Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'salary-card'
              ? 'My Salary Structure & Card'
              : activeTab === 'tax'
              ? 'FBR Tax Computation'
              : activeTab === 'loans'
              ? 'My Loans & Advances'
              : 'My Payslips'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'salary-card'
              ? 'Detailed breakdown of base salary, allowances, and statutory benefit deductions.'
              : activeTab === 'tax'
              ? 'Monthly tax withheld under FBR Section 149, tax slab brackets, and annual liability.'
              : activeTab === 'loans'
              ? 'Status of company loans and emergency salary advances, ledger, and remaining terms.'
              : 'Official monthly payslips, downloadable pay statements, and net salary disbursements.'}
          </p>
        </div>

        <button
          onClick={() => setIsLoanModalOpen(true)}
          className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-2"
        >
          <i className="fa-solid fa-hand-holding-dollar"></i>
          Request Loan / Advance
        </button>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Monthly Base Salary</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-money-bill-wave"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-navy-950 mt-2 font-mono">
            PKR {myStructure?.baseSalary?.toLocaleString() || '—'}
          </div>
          <span className="text-[11px] text-slate-400">Fixed contracted compensation</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Latest Net Salary</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-wallet"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-2 font-mono">
            PKR {latestPayslip?.netPay?.toLocaleString() || '0'}
          </div>
          <span className="text-[11px] text-slate-400">{latestPayslip?.period || 'No posted payslips'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tax Withholding</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-2 font-mono">
            PKR {personalTax.monthlyTaxWithheld?.toLocaleString()}/mo
          </div>
          <span className="text-[11px] text-slate-400">Slab {personalTax.slabNumber} ({personalTax.slabRate}%)</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Loan Balance</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-2 font-mono">
            PKR {(myLoans || []).filter(l => (l?.status || '').toUpperCase() === 'ACTIVE').reduce((s, l) => s + (l?.outstandingBalance || 0), 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">{(myLoans || []).length} total applications</span>
        </div>
      </div>

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl">
        {(activeTab === 'salary-card' || activeTab === 'structure') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-money-bill-wave text-navy-950 text-base"></i>
              <h4 className="text-sm font-bold text-navy-950">Official Compensation & Salary Structure</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-slate-500">Contracted Base Salary:</span>
                <div className="text-base font-bold text-navy-950 font-mono">
                  PKR {myStructure?.baseSalary?.toLocaleString() || '—'}
                </div>
                <p className="text-[11px] text-slate-400">Effective from: {myStructure?.effectiveFrom || '2026-01-01'}</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-slate-500">Gross Monthly Package:</span>
                <div className="text-base font-bold text-emerald-700 font-mono">
                  PKR {(myStructure?.grossSalary || myStructure?.baseSalary || 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400">Including active standard allowances</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-slate-500">Disbursement Currency:</span>
                <div className="text-base font-bold text-slate-800">
                  {myStructure?.currency || 'PKR (Pakistani Rupee)'}
                </div>
                <p className="text-[11px] text-slate-400">Bank Transfer / Raast verified</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payslips' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-4">Period</th>
                    <th className="py-2.5 px-4">Basic Pay</th>
                    <th className="py-2.5 px-4">Allowances</th>
                    <th className="py-2.5 px-4">Gross Earnings</th>
                    <th className="py-2.5 px-4">Tax Deducted</th>
                    <th className="py-2.5 px-4">Total Deductions</th>
                    <th className="py-2.5 px-4 text-right">Net Payable</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(myPayslips || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400">
                        No payslips available yet.
                      </td>
                    </tr>
                  ) : (
                    myPayslips.map((ps) => (
                      <tr key={ps.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-navy-950">{ps.period}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          PKR {ps.basicSalary?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          PKR {ps.allowances?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          PKR {ps.grossSalary?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-rose-700">
                          PKR {ps.incomeTax?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-rose-700">
                          PKR {ps.totalDeductions?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold text-right text-emerald-600">
                          PKR {ps.netPay?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {ps.paymentStatus || 'POSTED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedPayslip(ps)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-navy-950 hover:bg-navy-900 text-white rounded transition-colors flex items-center gap-1.5 ml-auto"
                          >
                            <i className="fa-solid fa-eye"></i>
                            View Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-file-invoice text-navy-950 text-base"></i>
              <h4 className="text-sm font-bold text-navy-950">Section 149 Tax Deduction Certificate Projection</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-slate-500">Projected Annual Salary:</span>
                <div className="text-base font-bold text-navy-950 font-mono">
                  PKR {personalTax.annualTaxableIncome?.toLocaleString() || 0}
                </div>
                <p className="text-[11px] text-slate-400">12-Month annualized projection</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-slate-500">Applicable FBR Bracket:</span>
                <div className="text-base font-bold text-navy-950">
                  Slab {personalTax.slabNumber} ({personalTax.slabRate}%)
                </div>
                <p className="text-[11px] text-slate-400">Base: PKR {personalTax.baseTax?.toLocaleString() || 0}</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-slate-500">Monthly Withholding Tax:</span>
                <div className="text-base font-bold text-rose-700 font-mono">
                  PKR {personalTax.monthlyTaxWithheld?.toLocaleString() || 0}
                </div>
                <p className="text-[11px] text-slate-400">Effective Rate: {personalTax.effectiveTaxRate || 0}%</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'loans' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-4">Facility Type</th>
                    <th className="py-2.5 px-4">Principal Amount</th>
                    <th className="py-2.5 px-4">Tenure</th>
                    <th className="py-2.5 px-4">Monthly Installment</th>
                    <th className="py-2.5 px-4">Outstanding Balance</th>
                    <th className="py-2.5 px-4">Purpose</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(myLoans || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        No loan or advance applications found.
                      </td>
                    </tr>
                  ) : (
                    myLoans.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-navy-900">
                          {((l.loanType || l.type || 'Company Loan') + '').replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">PKR {(l.principalAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-slate-600">{l.totalInstallments || l.tenureMonths || 12} Months</td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-700">
                          PKR {(l.installmentAmount || l.monthlyInstallment || 0).toLocaleString()}/mo
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-navy-950">
                          PKR {(l.outstandingBalance !== undefined ? l.outstandingBalance : ((l.principalAmount || 0) - (l.repaidAmount || 0))).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{l.reason || l.purpose || 'Personal Requirement'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            (l.status || '').toUpperCase() === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : (l.status || '').toUpperCase() === 'APPLIED' || (l.status || '').toUpperCase() === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'commissions' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-4">Source Deal Reference</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Deal Volume</th>
                    <th className="py-2.5 px-4">Commission Earned</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myCommissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy-950">{c.sourceReference}</td>
                      <td className="py-3 px-4 text-slate-600">{c.sourceDate}</td>
                      <td className="py-3 px-4 font-mono">PKR {c.sourceAmount?.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                        PKR {c.calculatedCommission?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payslip & Loan Request Modals */}
      {selectedPayslip && (
        <PayslipModal
          payslip={selectedPayslip}
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
        />
      )}

      {isLoanModalOpen && (
        <LoanRequestModal
          isOpen={isLoanModalOpen}
          onClose={() => setIsLoanModalOpen(false)}
          onLoanCreated={loadData}
        />
      )}
    </div>
  );
}
