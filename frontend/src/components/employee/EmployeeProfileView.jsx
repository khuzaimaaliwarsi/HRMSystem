import React, { useState } from 'react'
import StatusBadge from '@/components/common/StatusBadge'
import AppIcon from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

export function EmployeeProfileView({
  employee,
  bankDetails = null,
  careerHistory = [],
  reportingChain = [],
  onEdit,
  onClose,
  canEdit = true,
  userRole = 'employee',
  currentUserId = null,
  initialTab = 'overview'
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  if (!employee) return null

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'personal', label: 'Personal & Contact' },
    { key: 'hierarchy', label: 'Reporting Hierarchy' },
    { key: 'career', label: 'Career History' },
    { key: 'bank', label: 'Bank & Payment' },
    { key: 'audit', label: 'Audit Trail' }
  ]

  const isManagerViewingSubordinate = userRole === 'manager' && currentUserId !== employee.id

  const effectiveBank = bankDetails || (employee.bankName ? {
    bankName: employee.bankName,
    branchName: employee.branchName || 'Main Branch, Islamabad',
    accountTitle: employee.accountTitle || employee.name,
    accountNumber: employee.accountNumber ? `••••••••••${employee.accountNumber.slice(-4)}` : '••••••••••1001',
    fullAccountNumber: employee.accountNumber,
    iban: employee.iban ? `PK•• •••• •••• •••• ${employee.iban.slice(-4)}` : 'PK•• •••• •••• •••• 1001',
    fullIban: employee.iban,
    paymentMethod: employee.paymentMethod || 'Bank Transfer',
    verificationStatus: 'Verified'
  } : null)

  return (
    <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden text-left space-y-0">
      {/* Profile Header Banner */}
      <div className="p-5 sm:p-6 bg-slate-50 border-b border-hrms-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("w-14 h-14 rounded-full text-white font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0", employee.avatarBg || "bg-hrms-primary")}>
            {employee.initials || 'EM'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-hrms-primary tracking-tight">
                {employee.name}
              </h2>
              <StatusBadge status={employee.status} size="sm" />
            </div>
            <p className="text-xs text-hrms-muted mt-0.5">
              <strong className="text-hrms-text">{employee.designation}</strong> • {employee.department} (ID: <span className="font-mono font-semibold">{employee.id}</span>)
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
              <span>Shift: <strong className="text-slate-700">{employee.shift || 'General Day'}</strong></span>
              <span>•</span>
              <span>Manager: <strong className="text-slate-700">{employee.managerName || 'Board of Directors'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(employee)}
              className="px-3.5 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <AppIcon name="settings" className="w-3.5 h-3.5" />
              <span>Edit Record</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-hrms-border bg-white text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="px-5 border-b border-hrms-border bg-white flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-2.5 text-xs font-semibold rounded-t-md transition-all whitespace-nowrap border-b-2",
              activeTab === tab.key
                ? "border-hrms-primary text-hrms-primary bg-slate-50 font-bold"
                : "border-transparent text-hrms-muted hover:text-hrms-primary hover:bg-slate-50/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Panes */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-hrms-muted">
              Official Terms & Organizational Placement
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-3 rounded-lg border border-hrms-border bg-slate-50/50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Department</span>
                <span className="text-sm font-bold text-hrms-primary mt-0.5 block">{employee.department}</span>
                <span className="text-[11px] text-slate-500 block">Unit: {employee.departmentId}</span>
              </div>

              <div className="p-3 rounded-lg border border-hrms-border bg-slate-50/50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Team</span>
                <span className="text-sm font-bold text-hrms-primary mt-0.5 block">{employee.teamName || 'Direct Department Staff'}</span>
                <span className="text-[11px] text-slate-500 block">Team ID: {employee.teamId || '—'}</span>
              </div>

              <div className="p-3 rounded-lg border border-hrms-border bg-slate-50/50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Designation Title</span>
                <span className="text-sm font-bold text-hrms-primary mt-0.5 block">{employee.designation}</span>
                <span className="text-[11px] text-slate-500 block">Code: {employee.designationId}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
              <div className="p-2.5 rounded border border-hrms-border">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Employment Category</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{employee.employmentType}</span>
              </div>
              <div className="p-2.5 rounded border border-hrms-border">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Working Hours Basis</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{employee.workingHoursBasis || 'Full-Time'}</span>
              </div>
              <div className="p-2.5 rounded border border-hrms-border">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Work Arrangement</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{employee.workArrangement}</span>
              </div>
              <div className="p-2.5 rounded border border-hrms-border">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Compensation Basis</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{employee.compensationBasis || 'Monthly'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="p-3 rounded border border-hrms-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Joining Date</span>
                  <span className="text-xs font-bold text-hrms-primary">{employee.joinDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Service</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">{employee.tenureDays || 1} Days</span>
                </div>
              </div>

              <div className="p-3 rounded border border-hrms-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Daily Shift Schedule</span>
                  <span className="text-xs font-bold text-hrms-primary">{employee.shift}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Shift State</span>
                  <span className="text-xs font-semibold text-emerald-700">Compliant</span>
                </div>
              </div>
            </div>

            {/* Official Disbursement & Banking Profile Snapshot */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AppIcon name="payroll" className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Salary Disbursement & Bank Account</span>
                </span>
                {effectiveBank && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('bank')}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    View Full Bank Details →
                  </button>
                )}
              </div>

              {isManagerViewingSubordinate ? (
                <p className="text-[11px] text-amber-700 font-medium">
                  Confidential financial data masked for manager role.
                </p>
              ) : !effectiveBank ? (
                <div className="text-xs text-slate-500 py-1 flex items-center justify-between">
                  <span>No banking profile recorded yet.</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={onEdit}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      + Add Bank Details
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">BANK & BRANCH</span>
                    <span className="font-bold text-slate-800 block truncate">{effectiveBank.bankName}</span>
                    <span className="text-[10px] text-slate-500 truncate block">{effectiveBank.branchName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">ACCOUNT TITLE</span>
                    <span className="font-bold text-slate-800 block truncate">{effectiveBank.accountTitle}</span>
                    <span className="text-[10px] text-slate-500 block">Method: {effectiveBank.paymentMethod || 'Bank Transfer'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">ACCOUNT / IBAN</span>
                    <span className="font-mono font-bold text-slate-800 block truncate">
                      {userRole === 'super_admin' || userRole === 'hr_admin'
                        ? (effectiveBank.fullAccountNumber || effectiveBank.accountNumber)
                        : effectiveBank.accountNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 block">
                      {effectiveBank.verificationStatus || 'Verified'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL & CONTACT */}
        {activeTab === 'personal' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-hrms-muted">
              Personal Identifiers & Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="p-2.5 rounded border border-hrms-border">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Official Email</span>
                  <span className="text-xs font-mono font-semibold text-hrms-primary">{employee.email}</span>
                </div>
                <div className="p-2.5 rounded border border-hrms-border">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Primary Mobile Phone</span>
                  <span className="text-xs font-semibold text-slate-800">{employee.phone || '—'}</span>
                </div>
                <div className="p-2.5 rounded border border-hrms-border">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Alternate Contact</span>
                  <span className="text-xs font-semibold text-slate-800">{employee.alternatePhone || 'None Provided'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-2.5 rounded border border-hrms-border">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Gender & Date of Birth</span>
                  <span className="text-xs font-semibold text-slate-800">{employee.gender || 'Not specified'} • {employee.dob || '—'}</span>
                </div>
                <div className="p-2.5 rounded border border-hrms-border">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">National CNIC (Masked)</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">{employee.cnic || '37405-*******-X'}</span>
                </div>
                <div className="p-2.5 rounded border border-hrms-border">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Residential Address</span>
                  <span className="text-xs text-slate-700">{employee.address || 'Islamabad, Pakistan'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-hrms-border bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Emergency Contact Point</span>
                <span className="text-xs font-bold text-slate-800">{employee.emergencyContactName || 'Family Member'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Emergency Phone</span>
                <span className="text-xs font-mono font-semibold text-slate-700">{employee.emergencyContactPhone || '—'}</span>
              </div>
            </div>

            {effectiveBank && !isManagerViewingSubordinate && (
              <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-blue-700 font-bold block uppercase">Disbursement Bank & Account</span>
                  <span className="text-xs font-bold text-slate-800">
                    {effectiveBank.bankName} • <span className="font-mono text-slate-600 font-medium">{effectiveBank.fullAccountNumber || effectiveBank.accountNumber}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('bank')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                >
                  View Full Bank Details →
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REPORTING HIERARCHY */}
        {activeTab === 'hierarchy' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-hrms-muted">
              Reporting Chain & Governance Relationship
            </h4>

            <div className="p-4 rounded-lg border border-hrms-border bg-slate-50 space-y-3">
              <div className="flex items-center gap-2">
                <AppIcon name="security" className="w-4 h-4 text-hrms-accent" />
                <span className="text-xs font-bold text-hrms-primary">Direct Management Chain</span>
              </div>

              {reportingChain && reportingChain.length > 0 ? (
                <div className="space-y-2 relative pl-4 border-l-2 border-hrms-accent/40 my-2">
                  {reportingChain.map((mgr, index) => (
                    <div key={mgr.id} className="relative flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-hrms-accent -left-[21px] absolute" />
                        <span className="font-bold text-hrms-primary">{mgr.name}</span>
                        <span className="text-[11px] text-hrms-muted">({mgr.designation})</span>
                      </div>
                      <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        {index === 0 ? 'Current Staff' : `Tier ${index} Manager`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-hrms-muted py-2">
                  Reporting directly to Executive Board of Directors.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CAREER HISTORY */}
        {activeTab === 'career' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-hrms-muted">
                Effective-Dated Assignment & Status Timeline
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                {(careerHistory || []).length} Recorded Events
              </span>
            </div>

            {(careerHistory || []).length === 0 ? (
              <div className="p-6 text-center text-xs text-hrms-muted border border-dashed rounded-lg">
                No previous transfers or status modifications recorded.
              </div>
            ) : (
              <div className="divide-y divide-hrms-border/60 border border-hrms-border rounded-lg overflow-hidden">
                {careerHistory.map((hist) => (
                  <div key={hist.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition-colors space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono bg-blue-50 text-blue-700 border border-blue-200">
                          {hist.changeType}
                        </span>
                        <span className="text-xs font-bold text-hrms-primary">{hist.field || 'Assignment Update'}</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-700">
                        Effective: {hist.effectiveDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      Changed from <span className="font-semibold text-slate-500 line-through">{hist.previousValue}</span> to{' '}
                      <strong className="text-hrms-primary font-bold">{hist.newValue}</strong>
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Reason: <em>{hist.reason}</em></span>
                      <span>Actor: <strong className="text-slate-700">{hist.changedBy}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: BANK & PAYMENT DETAILS */}
        {activeTab === 'bank' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-hrms-muted">
                Disbursement Account & Banking Profile
              </h4>
              {effectiveBank && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  effectiveBank.verificationStatus === 'Verified'
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}>
                  {effectiveBank.verificationStatus}
                </span>
              )}
            </div>

            {isManagerViewingSubordinate ? (
              <div className="p-6 rounded-lg bg-amber-50 border border-amber-200 text-center space-y-2">
                <AppIcon name="security" className="w-6 h-6 text-amber-600 mx-auto" />
                <p className="text-xs font-bold text-amber-900">Confidential Financial Data Masked</p>
                <p className="text-[11px] text-amber-800 max-w-md mx-auto">
                  Managers are strictly prohibited by company governance rules from viewing subordinate banking details or confidential disbursement accounts.
                </p>
              </div>
            ) : !effectiveBank ? (
              <div className="p-6 text-center text-xs text-hrms-muted border border-dashed rounded-lg">
                No banking profile recorded. Enter banking details via the edit screen.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-hrms-border bg-slate-50 space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Bank Name</span>
                  <span className="text-sm font-bold text-hrms-primary block">{effectiveBank.bankName}</span>
                  <span className="text-xs text-slate-600 block">{effectiveBank.branchName}</span>
                </div>

                <div className="p-3.5 rounded-lg border border-hrms-border bg-slate-50 space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Account Title</span>
                  <span className="text-sm font-bold text-hrms-primary block">{effectiveBank.accountTitle}</span>
                  <span className="text-xs text-slate-600 block">Method: {effectiveBank.paymentMethod || 'Bank Transfer'}</span>
                </div>

                <div className="p-3.5 rounded-lg border border-hrms-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Account Number</span>
                    {(userRole === 'super_admin' || userRole === 'hr_admin') && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Authorized Unmasked (Admin)
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {(userRole === 'super_admin' || userRole === 'hr_admin')
                      ? (effectiveBank.fullAccountNumber || effectiveBank.accountNumber)
                      : effectiveBank.accountNumber}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {(userRole === 'super_admin' || userRole === 'hr_admin')
                      ? 'Full account number authorized for administrative verification'
                      : 'Masked for privacy'}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-hrms-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">IBAN</span>
                    {(userRole === 'super_admin' || userRole === 'hr_admin') && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Authorized Unmasked (Admin)
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {(userRole === 'super_admin' || userRole === 'hr_admin')
                      ? (effectiveBank.fullIban || effectiveBank.iban)
                      : effectiveBank.iban}
                  </span>
                  <span className="text-[10px] text-slate-400 block">International bank account number</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-hrms-muted">
              Master Record Audit Information
            </h4>
            <div className="p-4 rounded-lg border border-hrms-border bg-slate-50 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-hrms-border/60">
                <span className="text-slate-500">Record Identifier:</span>
                <span className="font-mono font-bold text-hrms-primary">{employee.id}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-hrms-border/60">
                <span className="text-slate-500">Official Onboarding Date:</span>
                <span className="font-semibold text-slate-800">{employee.joinDate}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-hrms-border/60">
                <span className="text-slate-500">Last Profile Update:</span>
                <span className="font-semibold text-slate-800">{employee.updatedDate || employee.joinDate}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Updated By:</span>
                <span className="font-semibold text-hrms-primary">{employee.updatedBy || 'System Seed'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeProfileView
