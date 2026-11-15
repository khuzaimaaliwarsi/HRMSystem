import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import { LEAVE_TYPES } from '@/mocks/leaveData'
import { leavePolicyService } from '@/services/leavePolicyService'

export function LeavePolicyOverview({ currentUser: _currentUser = null }) {
  const [activePolicyTab, setActivePolicyTab] = useState('types') // 'types' | 'matrix' | 'rules'
  const leaveTypes = leavePolicyService.getAllLeaveTypes?.() || []

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActivePolicyTab('types')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activePolicyTab === 'types'
              ? 'border-navy-700 text-navy-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AppIcon name="fa-list-check" />
          Leave Types & Entitlements ({leaveTypes.length})
        </button>

        <button
          onClick={() => setActivePolicyTab('matrix')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activePolicyTab === 'matrix'
              ? 'border-navy-700 text-navy-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AppIcon name="fa-sitemap" />
          Approval Authority Matrix & Escalations
        </button>

        <button
          onClick={() => setActivePolicyTab('rules')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activePolicyTab === 'rules'
              ? 'border-navy-700 text-navy-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AppIcon name="fa-shield-halved" />
          Core Policy Rules & Invariants
        </button>
      </div>

      {/* TAB 1: Leave Types */}
      {activePolicyTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaveTypes.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
              No leave types configured yet.
            </div>
          ) : (
            leaveTypes.map((lt) => {
            const isPaid = (lt.paidTreatment || '').toLowerCase() === 'paid' || lt.isPaid === true
            return (
              <div
                key={lt.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 block">{lt.id}</span>
                      <h4 className="text-base font-bold text-navy-900">{lt.name}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 line-clamp-2">{lt.description}</p>

                  <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Allocation Type:</span>
                      <span className="font-semibold text-slate-800 capitalize">{lt.accrualFrequency || lt.allocationType || 'Annual'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Annual Allowance:</span>
                      <span className="font-bold text-navy-800">{lt.annualEntitlement ?? lt.annualQuota ?? 0} days / yr</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Monthly Accrual:</span>
                      <span className="font-medium text-slate-700">{lt.monthlyRate ?? lt.monthlyAccrual ?? 0} days / mo</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Carry Forward:</span>
                      <span className="font-medium text-slate-700">
                        {lt.carryForwardAllowed ? `Max ${lt.maxCarryForwardDays ?? 0} days` : 'Not Permitted'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Half-Day Eligible:</span>
                      <span className="font-medium text-slate-700">{(lt.halfDayEligible ?? lt.allowHalfDay) ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Notice Period:</span>
                      <span className="font-medium text-slate-700">
                        {(lt.minNoticeDays ?? lt.noticePeriodDays) > 0 ? `${lt.minNoticeDays ?? lt.noticePeriodDays} day(s) advance` : 'Immediate'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Eligible: {(lt.eligibleEmploymentTypes || lt.eligibleCategories || ['Permanent']).join(', ')}</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <AppIcon name="fa-check-circle" /> Active
                  </span>
                </div>
              </div>
            )
          }))}
        </div>
      )}

      {/* TAB 2: Approval Matrix */}
      {activePolicyTab === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60">
              <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <AppIcon name="fa-network-wired" className="text-navy-700" />
                Default Approval Authority Hierarchy &amp; Annual Request Thresholds
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-tier escalation rules enforced at the service layer. Routing is governed by approved qualifying request count per calendar year in Asia/Karachi timezone.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Applicant Role</th>
                    <th className="py-3 px-4">Primary Approver</th>
                    <th className="py-3 px-4">Direct Authority Cap</th>
                    <th className="py-3 px-4">Tier-1 Escalation</th>
                    <th className="py-3 px-4">Final Escalation Authority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">Normal Employee</td>
                    <td className="py-3 px-4 font-medium text-navy-700">Team Lead</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">
                        1st &amp; 2nd Request / Year
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      Department Manager (3rd+ request of year)
                    </td>
                    <td className="py-3 px-4 font-semibold text-rose-700">Super Admin</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">Team Lead</td>
                    <td className="py-3 px-4 font-medium text-navy-700">Department Manager</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">
                        1st &amp; 2nd Request / Year
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">HR / Admin (3rd+ request of year)</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">Super Admin</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">Department Manager</td>
                    <td className="py-3 px-4 font-medium text-navy-700">HR / Admin</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">
                        Direct Review
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">Super Admin Final Sign-Off</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">Super Admin</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">HR / Admin</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">Super Admin</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-900 rounded font-bold">
                        No Self-Approval Permitted
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">Super Admin Sole Reviewer</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">Independent Alternate</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">Super Admin</td>
                    <td className="py-3 px-4 font-semibold text-indigo-700">Authorized Independent Reviewer</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-900 rounded font-bold">
                        No Self-Approval Permitted
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">Governance Committee</td>
                    <td className="py-3 px-4 font-semibold text-indigo-700">Board Governance Process</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase">
                <AppIcon name="fa-calculator" className="text-blue-700" />
                Annual Request Count Tracking
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                Authority limits evaluate qualifying annual leave requests within the calendar year in Asia/Karachi timezone. 1st &amp; 2nd approved requests route to initial authority (Team Lead / Dept Manager); 3rd and subsequent requests automatically route to higher management (Dept Manager / HR Admin). One authorized approval makes the request Final Approved.
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase">
                <AppIcon name="fa-ban" className="text-amber-700" />
                Anti-Self-Approval Enforcement
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                No user in any role (Manager, HR Admin, or Super Admin) may approve their own leave request. The approval action is completely disabled in the UI and rejected with an exception at the service layer.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase">
                <AppIcon name="fa-arrows-rotate" className="text-emerald-700" />
                Attendance Sync & Idempotency
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Approved leaves immediately synchronize with F04 canonical attendance as "Approved Leave". Cancellations atomically reverse the ledger and restore the attendance day without duplicate reversals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Policy Rules & Invariants */}
      {activePolicyTab === 'rules' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-navy-900 mb-1 flex items-center gap-2">
              <AppIcon name="fa-scale-balanced" className="text-navy-700" />
              Statutory & Governance Architecture
            </h3>
            <p className="text-xs text-slate-500">
              Fundamental principles governing the iSysware HRMS leave management engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-lg space-y-2">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <AppIcon name="fa-diagram-project" className="text-navy-700" />
                Separation of Concerns
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Entitlement</strong> (what employee is entitled to),{' '}
                <strong className="text-slate-800">Approval Authority</strong> (who can authorize it), and{' '}
                <strong className="text-slate-800">Payroll Treatment</strong> (paid, unpaid, or half-paid) are maintained as three strictly independent dimensions. An approved request does not fabricate unearned paid days.
              </p>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg space-y-2">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <AppIcon name="fa-calendar-week" className="text-navy-700" />
                Shift-Aware Working Day Deduction
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Leave day calculations reflect the employee's assigned shift schedule. Calendar spans intersecting configured weekly-offs (e.g. Saturday/Sunday) or gazetted public holidays only deduct eligible scheduled working days.
              </p>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg space-y-2">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <AppIcon name="fa-coins" className="text-navy-700" />
                Ledger Accounting Invariant
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                <code className="bg-slate-100 text-navy-800 px-1 py-0.5 rounded text-[11px]">
                  Closing Balance = Opening + Allocated + Accrued + Adjustments − Utilized − Expired
                </code>
                <br />
                Submitting a request places a pending reservation on the available balance without reducing the official closing entitlement until final authorization.
              </p>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg space-y-2">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <AppIcon name="fa-sliders" className="text-navy-700" />
                Future Administration (F13 Policy Builder)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The current F05 module consumes the canonical policy engine contract. The interactive visual policy builder, statutory rule editor, and scheduled alert triggers will be fully exposed in F13 — Administration & Settings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeavePolicyOverview
