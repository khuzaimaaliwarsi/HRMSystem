import React, { useState, useEffect } from 'react'
import { approvalRuleService } from '@/services/approvalRuleService'
import { employeeService } from '@/services/employeeService'

export function ApprovalAuthorityMatrixTab() {
  const [rules, setRules] = useState(() => approvalRuleService.getRules())

  // Interactive Live Simulator State
  const [simModule, setSimModule] = useState('leaves')
  const [simApplicantId, setSimApplicantId] = useState('EMP-004') // Zeeshan Ali
  const [simQuantity, setSimQuantity] = useState(1)
  const [simCumulative, setSimCumulative] = useState(0)
  const [simResult, setSimResult] = useState(null)

  const allEmployees = employeeService.getAllEmployees()

  useEffect(() => {
    return approvalRuleService.subscribe(() => {
      setRules(approvalRuleService.getRules())
    })
  }, [])

  const handleSimulate = (e) => {
    e.preventDefault()
    try {
      const res = approvalRuleService.evaluateApprovalRouting({
        module: simModule,
        applicantId: simApplicantId,
        amountOrDays: Number(simQuantity),
        cumulativeAmountOrDays: Number(simCumulative),
        annualRequestCount: simModule === 'leaves' ? Number(simCumulative) : undefined
      })
      const emp = employeeService.getEmployeeById(simApplicantId)
      setSimResult({ ...res, applicantName: emp?.name, applicantRole: emp?.role || 'employee' })
    } catch (err) {
      setSimResult({ error: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Approval Authority &amp; Escalation Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative multi-tier delegation engine governing Leave, Attendance, Expense, Payroll, and Travel workflows.
          </p>
        </div>
      </div>

      {/* Interactive Simulator Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm">
              <i className="fa-solid fa-calculator"></i>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Live Approval Routing Simulator</h3>
              <p className="text-[11px] text-slate-400">Test multi-tier escalation, annual request count routing, and anti-self-approval rules</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            Real-Time Engine
          </span>
        </div>

        <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Workflow Module</label>
            <select
              value={simModule}
              onChange={(e) => {
                setSimModule(e.target.value)
                setSimResult(null)
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="leaves">Leave Management (Annual Request Count)</option>
              <option value="attendance">Field Duty / Visits (Hours)</option>
              <option value="expenses">Expense Claims (PKR)</option>
              <option value="payroll">Salary Revision (Proposals)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Applicant Account</label>
            <select
              value={simApplicantId}
              onChange={(e) => {
                setSimApplicantId(e.target.value)
                setSimResult(null)
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              {allEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id} - {emp.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {simModule === 'expenses'
                ? 'Requested Amount (PKR)'
                : simModule === 'attendance'
                ? 'Requested Duration (Hours)'
                : 'Requested Duration (Days)'}
            </label>
            <input
              type="number"
              step={simModule === 'expenses' ? '100' : '0.5'}
              value={simQuantity}
              onChange={(e) => {
                setSimQuantity(e.target.value)
                setSimResult(null)
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {simModule === 'expenses'
                ? 'Prior Monthly Claims (PKR)'
                : simModule === 'attendance'
                ? 'Prior Visits (Hours)'
                : 'Prior Approved Requests This Year'}
            </label>
            <input
              type="number"
              step={simModule === 'leaves' ? '1' : simModule === 'expenses' ? '100' : '0.5'}
              value={simCumulative}
              onChange={(e) => {
                setSimCumulative(e.target.value)
                setSimResult(null)
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
            />
          </div>

          <div className="sm:col-span-2 md:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm flex items-center gap-1.5"
            >
              <i className="fa-solid fa-bolt text-amber-400"></i>
              Evaluate Routing &amp; Hierarchy
            </button>
          </div>
        </form>

        {/* Simulator Result Output */}
        {simResult && (
          <div className="mt-3 p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 text-xs space-y-3">
            {simResult.error ? (
              <div className="text-rose-700 font-semibold flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                {simResult.error}
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                  <span className="font-bold text-slate-900">
                    Routing Resolved for {simResult.applicantName} ({simResult.applicantId})
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        simResult.isEscalated
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {simResult.isEscalated ? 'ESCALATED ROUTE' : 'STANDARD TIER 1 ROUTE'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Required Approver Tier</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">{simResult.currentApproverTier}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Assigned Reviewer</span>
                    <span className="font-semibold text-slate-800">
                      {simResult.currentApproverName || 'Governance Arrangement'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Escalation Status</span>
                    <span className="font-semibold text-slate-800">
                      {simResult.isEscalated ? 'Yes (Beyond standard authority)' : 'Direct approval allowed'}
                    </span>
                  </div>
                </div>

                {simResult.escalationReason && (
                  <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                    <i className="fa-solid fa-circle-info text-amber-600 mt-0.5"></i>
                    <span>{simResult.escalationReason}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Standard Rules Cards */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-900">Configured Standard Approval Rules</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="font-bold text-slate-900 text-xs block">{rule.requestType}</span>
                  <span className="text-[10px] font-mono text-slate-400">{rule.id}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold uppercase">
                  {rule.module}
                </span>
              </div>

              <p className="text-xs text-slate-600">{rule.description}</p>

              <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-mono">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Tier 1</span>
                  <span className="font-bold text-slate-800">{rule.initialApprover}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Escalation</span>
                  <span className="font-bold text-slate-800">{rule.escalationApprover}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Final Authority</span>
                  <span className="font-bold text-slate-800">{rule.finalAuthority}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ApprovalAuthorityMatrixTab
