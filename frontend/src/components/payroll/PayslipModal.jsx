import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '@/components/common/AppIcon';

// Simple helper to convert number to PKR currency words
function numberToWords(num) {
  if (!num || isNaN(num)) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = Math.round(num);
  if (n === 0) return 'Zero Rupees Only';

  function convertHundreds(val) {
    let str = '';
    if (val > 99) {
      str += a[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val > 19) {
      str += b[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += a[val] + ' ';
    }
    return str.trim();
  }

  let result = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  if (crore > 0) result += convertHundreds(crore) + ' Crore ';
  if (lakh > 0) result += convertHundreds(lakh) + ' Lakh ';
  if (thousand > 0) result += convertHundreds(thousand) + ' Thousand ';
  if (hundred > 0) result += convertHundreds(hundred);

  return (result.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

export default function PayslipModal({ payslip, isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !payslip) return null;

  const handlePrint = () => {
    window.print();
  };

  const amountInWords = numberToWords(payslip.netPay);

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150 print:max-w-none print:max-h-none print:shadow-none print:border-0"
      >
        {/* Action Header - always visible & hidden in print */}
        <div className="shrink-0 px-3.5 py-2 bg-navy-950 text-white flex justify-between items-center print:hidden border-b border-navy-900">
          <div className="flex items-center gap-2 min-w-0">
            <AppIcon name="tax" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs truncate">Official Salary Payslip — {payslip.period}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-[11px] font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <AppIcon name="print" className="w-3 h-3" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="px-2.5 py-1 bg-rose-600/90 hover:bg-rose-600 border border-rose-500 rounded-md text-[11px] font-bold text-white transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <span className="text-xs font-black leading-none">✕</span>
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-4.5 text-slate-800 space-y-3 print:overflow-visible print:p-0" id="printable-payslip">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-navy-900 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-navy-950">iSysware HRMS</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-navy-100 text-navy-900 rounded">
                  CONFIDENTIAL
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5">Software Systems & Enterprise HR Platform</p>
              <p className="text-[9.5px] text-slate-400">NTN / FBR Reg: 9821034-7 • Islamabad, Pakistan</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Salary Slip</span>
              <span className="text-xs font-bold text-navy-950">{payslip.period}</span>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">Ref: {payslip.id}</div>
            </div>
          </div>

          {/* Employee & Bank Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10.5px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div className="space-y-1">
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Employee Name:</span>
                <span className="font-bold text-navy-950 truncate">{payslip.employeeName}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Employee ID:</span>
                <span className="font-mono font-semibold text-slate-700">{payslip.employeeId}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Designation:</span>
                <span className="text-slate-800 truncate">{payslip.designation}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Department:</span>
                <span className="text-slate-800 truncate">{payslip.department}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Bank Name:</span>
                <span className="font-semibold text-slate-800 truncate">{payslip.bankName || '—'}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Account Title:</span>
                <span className="text-slate-800 truncate">{payslip.accountTitle || payslip.employeeName || '—'}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">IBAN / Account:</span>
                <span className="font-mono text-slate-700 break-all">{payslip.iban || payslip.accountNumber || '—'}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 text-slate-500 font-medium">Payment Status:</span>
                <span className={`font-bold ${payslip.paymentStatus === 'PAID' || payslip.paymentStatus === 'Disbursed' ? 'text-emerald-700' : payslip.paymentStatus === 'HOLD' ? 'text-amber-700' : 'text-slate-700'}`}>
                  {payslip.paymentStatus || 'UNPAID'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Snapshot */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10.5px] py-1.5 px-2 bg-blue-50/50 rounded-lg border border-blue-100">
            <div>
              <span className="block text-[8.5px] text-slate-500 uppercase font-semibold">Working Days</span>
              <span className="font-bold text-navy-950">{payslip.workingDays || payslip.calendarDays || 30}</span>
            </div>
            <div>
              <span className="block text-[8.5px] text-slate-500 uppercase font-semibold">Days Present</span>
              <span className="font-bold text-emerald-700">{payslip.daysPresent !== undefined && payslip.daysPresent !== null ? payslip.daysPresent : 0}</span>
            </div>
            <div>
              <span className="block text-[8.5px] text-slate-500 uppercase font-semibold">Unpaid Leaves</span>
              <span className="font-bold text-rose-700">{payslip.unpaidLeaves || 0}</span>
            </div>
            <div>
              <span className="block text-[8.5px] text-slate-500 uppercase font-semibold">Overtime</span>
              <span className="font-bold text-blue-700">{payslip.overtimeHours || 0} hrs</span>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="grid grid-cols-2 gap-3 text-[10.5px]">
            {/* Earnings Column */}
            <div>
              <div className="font-bold text-slate-700 border-b border-slate-300 pb-1 mb-1 uppercase tracking-wider text-[9.5px] flex justify-between">
                <span>Earnings Description</span>
                <span>Amount (PKR)</span>
              </div>
              <div className="space-y-0.5 font-mono">
                <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                  <span className="text-slate-600">Basic Salary</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {Number(payslip.basicSalary || 0).toLocaleString()}
                  </span>
                </div>
                {Number(payslip.houseRentAllowance || 0) > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">House Rent Allowance</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {Number(payslip.houseRentAllowance).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(payslip.medicalAllowance || 0) > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Medical Allowance</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {Number(payslip.medicalAllowance).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(payslip.conveyanceAllowance || 0) > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Conveyance Allowance</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {Number(payslip.conveyanceAllowance).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(payslip.specialAllowance || 0) > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Special Allowance</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {Number(payslip.specialAllowance).toLocaleString()}
                    </span>
                  </div>
                )}
                {payslip.allowancesBreakdown?.filter(al => {
                  const n = (al.name || al.type || '').toLowerCase();
                  return !n.includes('house') && !n.includes('medical') && !n.includes('conveyance') && !n.includes('special');
                }).map((al, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">{al.name || al.type}</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {Number(al.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                {payslip.commissions > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Sales Commission</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {payslip.commissions?.toLocaleString()}
                    </span>
                  </div>
                )}
                {payslip.bonuses > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Performance Bonus</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {payslip.bonuses?.toLocaleString()}
                    </span>
                  </div>
                )}
                {payslip.overtimePay > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Overtime Earnings</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {payslip.overtimePay?.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-1.5 border-t-2 border-slate-300 font-bold text-navy-950 mt-1.5">
                <span>Gross Earnings:</span>
                <span className="font-mono text-xs">PKR {Number(payslip.grossSalary || payslip.grossPay || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Deductions Column */}
            <div>
              <div className="font-bold text-slate-700 border-b border-slate-300 pb-1 mb-1 uppercase tracking-wider text-[9.5px] flex justify-between">
                <span>Deductions Description</span>
                <span>Amount (PKR)</span>
              </div>
              <div className="space-y-0.5 font-mono">
                <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                  <div>
                    <span className="text-slate-600 block">Salary Tax Withheld</span>
                    {payslip.statutoryVariance && payslip.statutoryVariance !== 0 ? (
                      <span className="text-[9px] text-amber-700 block font-normal">
                        Statutory FBR Obligation: PKR {(payslip.statutoryTaxObligation || 0).toLocaleString()} (Variance: PKR {(payslip.statutoryVariance || 0).toLocaleString()})
                      </span>
                    ) : null}
                  </div>
                  <span className="font-semibold text-rose-700 font-mono">
                    {Number(payslip.incomeTax || 0).toLocaleString()}
                  </span>
                </div>
                {payslip.unpaidLeaveDeduction > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Unpaid Leave / LWP</span>
                    <span className="font-semibold text-rose-700 font-mono">
                      {payslip.unpaidLeaveDeduction?.toLocaleString()}
                    </span>
                  </div>
                )}
                {payslip.loanDeduction > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Loan / Advance Installment</span>
                    <span className="font-semibold text-rose-700 font-mono">
                      {payslip.loanDeduction?.toLocaleString()}
                    </span>
                  </div>
                )}
                {payslip.otherDeductions > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-600">Other Deductions</span>
                    <span className="font-semibold text-rose-700 font-mono">
                      {payslip.otherDeductions?.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-1.5 border-t-2 border-slate-300 font-bold text-rose-700 mt-1.5">
                <span>Total Deductions:</span>
                <span className="font-mono text-xs">PKR {Number(payslip.totalDeductions || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Net Pay Banner */}
          <div className="px-3.5 py-2 bg-navy-950 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-1.5">
            <div>
              <span className="text-[10px] text-slate-300 uppercase font-semibold">Net Salary Payable</span>
              <div className="text-[10px] text-slate-400 italic">{amountInWords}</div>
            </div>
            <div className="text-lg font-black font-mono tracking-tight text-emerald-400">
              PKR {Number(payslip.netPay || payslip.netPayable || 0).toLocaleString()}
            </div>
          </div>

          {/* Signatures & Audit Footnote */}
          <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-4 text-[9.5px] text-slate-500">
            <div>
              <div className="border-b border-slate-300 pb-0.5 font-semibold text-slate-700">
                Prepared By: HR / Payroll Officer
              </div>
              <p className="mt-0.5">Verified with canonical attendance & leave records.</p>
            </div>
            <div>
              <div className="border-b border-slate-300 pb-0.5 font-semibold text-slate-700">
                Approved By: Super Admin Authority
              </div>
              <p className="mt-0.5">Finalized & electronically authorized under Section 149.</p>
            </div>
          </div>

          <div className="text-center text-[9px] text-slate-400 pt-1 border-t border-slate-100">
            This is a system-generated electronic payslip issued by iSysware HRMS. No manual physical signature required.
          </div>
        </div>

        {/* Modal Footer with explicit Cancel/Close button */}
        <div className="shrink-0 px-3.5 py-2 bg-slate-100 border-t border-slate-200 flex justify-end items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel / Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1 bg-navy-950 hover:bg-navy-900 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <AppIcon name="print" className="w-3 h-3" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
