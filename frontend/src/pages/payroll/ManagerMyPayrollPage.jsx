import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import payrollService from '../../services/payrollService';
import compensationService from '../../services/compensationService';
import loanService from '../../services/loanService';
import { syncPayroll } from '../../services/backendSync';

import PayslipModal from '../../components/payroll/PayslipModal';
import LoanRequestModal from '../../components/payroll/LoanRequestModal';

export default function ManagerMyPayrollPage() {
  const { currentUser } = useAuth();
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
  const [myAllowances, setMyAllowances] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  const loadData = () => {
    if (!currentUser) return;
    const myId = currentUser.employeeId || currentUser.id;
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
  };

  useEffect(() => {
    loadData();
    syncPayroll().then(() => loadData()).catch((err) => console.warn('[ManagerPayroll] Sync warning:', err));
  }, [currentUser]);

  const latestPayslip = myPayslips[0] || null;

  return (
    <div className="space-y-6">
      {/* Confidentiality Warning & Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'benefits'
              ? 'Personal Compensation & Benefits'
              : activeTab === 'loans'
              ? 'My Loans & Advances'
              : 'My Payslips & Monthly Earnings'}
          </h2>
          <p className="text-xs text-hrms-muted mt-0.5">
            {activeTab === 'benefits'
              ? 'Your registered salary packages, medical and travel allowances, and personal benefit entitlements.'
              : activeTab === 'loans'
              ? 'Track company advance requests, approved loan installments, and remaining balances.'
              : 'View verified monthly salary slips, tax deductions under FBR Section 149, and disbursement receipts.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLoanModalOpen(true)}
            className="px-3 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-2"
          >
            <i className="fa-solid fa-hand-holding-dollar"></i>
            Request Loan / Advance
          </button>
        </div>
      </div>

      {/* Quick Personal Compensation Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Basic Monthly Salary</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-money-bill-wave"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-navy-950 mt-2 font-mono">
            PKR {myStructure?.baseSalary?.toLocaleString() || '—'}
          </div>
          <span className="text-[11px] text-slate-400">Effective from {myStructure?.effectiveFrom || '2026-01-01'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Latest Net Disbursed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-wallet"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-2 font-mono">
            PKR {latestPayslip?.netPay?.toLocaleString() || '0'}
          </div>
          <span className="text-[11px] text-slate-400">{latestPayslip?.period || 'No runs yet'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Allowances</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-gift"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-navy-950 mt-2">
            {(myAllowances || []).length} Packages
          </div>
          <span className="text-[11px] text-slate-400">
            Total: PKR {(myAllowances || []).reduce((s, a) => s + (a?.amount || 0), 0).toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Outstanding Loans</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-2 font-mono">
            PKR {myLoans.filter(l => (l.status || '').toUpperCase() === 'ACTIVE').reduce((s, l) => s + (l.outstandingBalance || 0), 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">
            {myLoans.filter(l => (l.status || '').toUpperCase() === 'ACTIVE').length} Active facility
          </span>
        </div>
      </div>

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-slate-50/50 rounded-xl">
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
                    <th className="py-2.5 px-4">Tax Withholding</th>
                    <th className="py-2.5 px-4">Deductions</th>
                    <th className="py-2.5 px-4 text-right">Net Salary</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(myPayslips || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400">
                        No published payslips available yet.
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

        {activeTab === 'benefits' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-bold text-navy-950">Active Entitlements & Allowances</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myAllowances.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-navy-950 uppercase">{item.type} Allowance</span>
                    <p className="text-[11px] text-slate-500">Effective since {item.effectiveFrom}</p>
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold mt-1">
                      {item.frequency || 'MONTHLY'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Amount</span>
                    <div className="text-base font-bold text-navy-900 font-mono">
                      PKR {item.amount?.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
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
                    <th className="py-2.5 px-4">Monthly Deduction</th>
                    <th className="py-2.5 px-4">Outstanding Balance</th>
                    <th className="py-2.5 px-4">Purpose</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(myLoans || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        No loans or advances recorded.
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
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{l.reason || l.purpose || 'Personal Need'}</td>
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
