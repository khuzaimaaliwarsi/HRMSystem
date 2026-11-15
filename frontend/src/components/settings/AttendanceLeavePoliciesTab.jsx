import React, { useState, useEffect } from 'react'
import { policyService } from '@/services/policyService'
import { attendancePolicyService } from '@/services/attendancePolicyService'
import { leavePolicyService } from '@/services/leavePolicyService'
import { useAuth } from '@/context/useAuth'

export function AttendanceLeavePoliciesTab() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [attPolicy, setAttPolicy] = useState(() => policyService.resolveEffectivePolicy('attendance') || {})
  const [levPolicy, setLevPolicy] = useState(() => policyService.resolveEffectivePolicy('leaves') || {})
  const [activeAttPolicy, setActiveAttPolicy] = useState(() => attendancePolicyService.getActivePolicy() || {})
  const [isEditingAtt, setIsEditingAtt] = useState(false)
  const [isEditingLev, setIsEditingLev] = useState(false)

  const initialFLimits = activeAttPolicy?.fieldDutyApprovalLimits || {}
  const [attForm, setAttForm] = useState({
    ...(attPolicy?.rules || {}),
    fieldDutyApprovalMode: initialFLimits.mode || 'no_limit',
    fieldDutyTeamLeadMaxHours: initialFLimits.teamLeadMaxHours !== undefined ? initialFLimits.teamLeadMaxHours : 4.0,
    fieldDutyManagerMaxHours: initialFLimits.managerMaxHours !== undefined ? initialFLimits.managerMaxHours : 9.0
  })
  const [levForm, setLevForm] = useState({
    ...(levPolicy?.rules || {}),
    annualLeaveApproverThreshold: levPolicy?.rules?.annualLeaveApproverThreshold ?? leavePolicyService.getAnnualLeaveApproverThreshold?.() ?? 2
  })
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    const unsubPolicy = policyService.subscribe(() => {
      const ap = policyService.resolveEffectivePolicy('attendance') || {}
      const lp = policyService.resolveEffectivePolicy('leaves') || {}
      const currentActiveAtt = attendancePolicyService.getActivePolicy() || {}
      const curFLimits = currentActiveAtt?.fieldDutyApprovalLimits || {}
      setAttPolicy(ap)
      setLevPolicy(lp)
      setActiveAttPolicy(currentActiveAtt)
      setAttForm((prev) => ({
        ...(ap.rules || {}),
        fieldDutyApprovalMode: curFLimits.mode || prev.fieldDutyApprovalMode || 'no_limit',
        fieldDutyTeamLeadMaxHours: curFLimits.teamLeadMaxHours !== undefined ? curFLimits.teamLeadMaxHours : (prev.fieldDutyTeamLeadMaxHours ?? 4.0),
        fieldDutyManagerMaxHours: curFLimits.managerMaxHours !== undefined ? curFLimits.managerMaxHours : (prev.fieldDutyManagerMaxHours ?? 9.0)
      }))
      setLevForm({ ...(lp.rules || {}) })
    })

    const unsubAtt = attendancePolicyService.subscribe(() => {
      const currentActiveAtt = attendancePolicyService.getActivePolicy() || {}
      const curFLimits = currentActiveAtt?.fieldDutyApprovalLimits || {}
      setActiveAttPolicy(currentActiveAtt)
      setAttForm((prev) => ({
        ...prev,
        fieldDutyApprovalMode: curFLimits.mode || 'no_limit',
        fieldDutyTeamLeadMaxHours: curFLimits.teamLeadMaxHours !== undefined ? curFLimits.teamLeadMaxHours : 4.0,
        fieldDutyManagerMaxHours: curFLimits.managerMaxHours !== undefined ? curFLimits.managerMaxHours : 9.0
      }))
    })

    return () => {
      unsubPolicy()
      unsubAtt()
    }
  }, [])

  const handleSaveAttendance = (e) => {
    e.preventDefault()
    try {
      const updated = policyService.versionPolicy(
        attPolicy.id,
        {
          allowedLimit: attForm.allowedLatesPerMonth,
          rules: { ...attPolicy.rules, ...attForm }
        },
        { name: user?.name || 'Tariq Mehmood', role: user?.role || 'super_admin', id: user?.id || 'EMP-001' },
        'Attendance parameters updated via Central Settings'
      )

      attendancePolicyService.setFieldDutyApprovalMode(
        attForm.fieldDutyApprovalMode || 'no_limit',
        {
          teamLeadMaxHours: Number(attForm.fieldDutyTeamLeadMaxHours !== undefined ? attForm.fieldDutyTeamLeadMaxHours : 4.0),
          managerMaxHours: Number(attForm.fieldDutyManagerMaxHours !== undefined ? attForm.fieldDutyManagerMaxHours : 9.0),
          escalateToHRThresholdHours: Number(attForm.fieldDutyManagerMaxHours !== undefined ? attForm.fieldDutyManagerMaxHours : 9.0)
        },
        user?.name || 'Tariq Mehmood (Super Admin)'
      )

      setFeedback({ type: 'success', text: `Attendance policy updated to v${updated.version}. Field Duty mode: ${attForm.fieldDutyApprovalMode}.` })
      setIsEditingAtt(false)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleSaveLeaves = (e) => {
    e.preventDefault()
    try {
      const updated = policyService.versionPolicy(
        levPolicy.id,
        {
          allowedLimit: levForm.managerMonthlyApprovalCap,
          rules: { ...levPolicy.rules, ...levForm }
        },
        { name: user?.name || 'Tariq Mehmood', role: user?.role || 'super_admin', id: user?.id || 'EMP-001' },
        'Leave entitlement & manager caps updated via Central Settings'
      )
      if (levForm.annualLeaveApproverThreshold !== undefined) {
        leavePolicyService.setAnnualLeaveApproverThreshold(levForm.annualLeaveApproverThreshold, user?.name || 'Super Admin')
      }
      setFeedback({ type: 'success', text: `Leave policy updated to v${updated.version}.` })
      setIsEditingLev(false)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Attendance &amp; Leave Policies
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controls punctuality grace windows, monthly permitted lates, leave quotas, and manager approval ceilings.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              feedback.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-rose-600'
            }`}
          ></i>
          {feedback.text}
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Rules Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Attendance &amp; Biometric Rules</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  v{attPolicy.version}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{attPolicy.id} • {attPolicy.name}</p>
            </div>

            {isSuperAdmin && !isEditingAtt && (
              <button
                onClick={() => setIsEditingAtt(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <i className="fa-solid fa-pen-to-square text-[11px] mr-1"></i>
                Edit Rules
              </button>
            )}
          </div>

          {!isEditingAtt ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block">Allowed Lates / Month</span>
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {attPolicy.rules?.allowedLatesPerMonth || 4} Days
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">5th late triggers policy exception</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block">Grace Period</span>
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {attPolicy.rules?.graceMinutes || 15} Minutes
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Applies after shift start</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block">Half-Day Threshold</span>
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {attPolicy.rules?.halfDayHourThreshold || 4.0} Hours
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">&lt; 4 hours considered absent</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block">Monthly Missing Punch Cap</span>
                  <span className="font-bold text-slate-900 font-mono text-base">
                    {attPolicy.rules?.maxMissingPunchCorrectionsPerMonth || 3} Times
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Requires manager approval</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Monthly WFH Allowance</span>
                  <span className="font-semibold text-slate-800">
                    {attPolicy.rules?.wfhMonthlyAllowanceDays || 2} Days / Month
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                  Engineering: 4 Days
                </span>
              </div>

              {/* Field Duty Authority Rules */}
              <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                    <i className="fa-solid fa-briefcase text-indigo-600"></i>
                    Field Duty Approval Authority Limits
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold uppercase">
                    {(activeAttPolicy.fieldDutyApprovalLimits?.mode === 'no_limit')
                      ? 'No Duration Limit'
                      : (activeAttPolicy.fieldDutyApprovalLimits?.mode === 'manager_only')
                      ? 'Manager Approval Only'
                      : 'Duration-Based Limits'}
                  </span>
                </div>

                {activeAttPolicy.fieldDutyApprovalLimits?.mode === 'no_limit' ? (
                  <div className="p-2.5 rounded bg-white border border-indigo-100 text-xs text-slate-700">
                    <span className="font-bold text-slate-800 block mb-0.5">Team Lead Full Approval Authority</span>
                    <span>Team Lead can directly authorize field duty client visits for direct reports for any duration without hours cap. Self-approvals route to Department Manager.</span>
                  </div>
                ) : activeAttPolicy.fieldDutyApprovalLimits?.mode === 'manager_only' ? (
                  <div className="p-2.5 rounded bg-white border border-indigo-100 text-xs text-slate-700">
                    <span className="font-bold text-slate-800 block mb-0.5">Manager Approval Required</span>
                    <span>All field duty client visits require Department Manager authorization (≤ {activeAttPolicy.fieldDutyApprovalLimits?.managerMaxHours || 9.0}h). Visits exceeding {activeAttPolicy.fieldDutyApprovalLimits?.managerMaxHours || 9.0} hours escalate to HR Admin.</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Team Lead Direct Authority:</span>
                        <span className="font-bold text-slate-800 font-mono">≤ {activeAttPolicy.fieldDutyApprovalLimits?.teamLeadMaxHours || 4.0} Hours</span>
                        <span className="text-[10px] text-slate-400 block">Half-day / local visit</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Department Manager Authority:</span>
                        <span className="font-bold text-slate-800 font-mono">{(Number(activeAttPolicy.fieldDutyApprovalLimits?.teamLeadMaxHours || 4.0) + 0.1).toFixed(1)} – {activeAttPolicy.fieldDutyApprovalLimits?.managerMaxHours || 9.0} Hours</span>
                        <span className="text-[10px] text-slate-400 block">Full-shift coverage sign-off</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-indigo-700/90 pt-1 border-t border-indigo-100">
                      Visits exceeding {activeAttPolicy.fieldDutyApprovalLimits?.teamLeadMaxHours || 4.0} hours (e.g. 9-hour FLD-002) require Department Manager authorization (Hamza Ahmed) to ensure on-site project shift coverage. Visits &gt; {activeAttPolicy.fieldDutyApprovalLimits?.managerMaxHours || 9.0} hours escalate to HR Admin.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveAttendance} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Allowed Monthly Lates</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={attForm.allowedLatesPerMonth || 4}
                    onChange={(e) => setAttForm({ ...attForm, allowedLatesPerMonth: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={attForm.graceMinutes || 15}
                    onChange={(e) => setAttForm({ ...attForm, graceMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Half-Day Threshold (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={attForm.halfDayHourThreshold || 4.0}
                    onChange={(e) => setAttForm({ ...attForm, halfDayHourThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Max Missing Punches</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={attForm.maxMissingPunchCorrectionsPerMonth || 3}
                    onChange={(e) => setAttForm({ ...attForm, maxMissingPunchCorrectionsPerMonth: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Field Duty Approval Mode Config */}
              <div className="p-3 rounded-lg bg-indigo-50/40 border border-indigo-200/80 space-y-2.5">
                <span className="text-[11px] font-bold text-indigo-900 block flex items-center gap-1.5">
                  <i className="fa-solid fa-briefcase text-indigo-600"></i>
                  Field Duty Approval Authority Mode
                </span>
                <div>
                  <select
                    value={attForm.fieldDutyApprovalMode || 'no_limit'}
                    onChange={(e) => setAttForm({ ...attForm, fieldDutyApprovalMode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                  >
                    <option value="duration_based">Duration-Based Limits (Team Lead → Department Manager → HR/Admin)</option>
                    <option value="no_limit">No Duration Limit (Team Lead can approve direct reports)</option>
                    <option value="manager_only">Manager Approval Only</option>
                  </select>
                </div>

                {attForm.fieldDutyApprovalMode === 'duration_based' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Team Lead Max Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        value={attForm.fieldDutyTeamLeadMaxHours !== undefined ? attForm.fieldDutyTeamLeadMaxHours : 4.0}
                        onChange={(e) => setAttForm({ ...attForm, fieldDutyTeamLeadMaxHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Manager Max Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        value={attForm.fieldDutyManagerMaxHours !== undefined ? attForm.fieldDutyManagerMaxHours : 9.0}
                        onChange={(e) => setAttForm({ ...attForm, fieldDutyManagerMaxHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingAtt(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Save &amp; Version Policy
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Leave Rules Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Leave Entitlements &amp; Authority Caps</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  v{levPolicy.version}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{levPolicy.id} • {levPolicy.name}</p>
            </div>

            {isSuperAdmin && !isEditingLev && (
              <button
                onClick={() => setIsEditingLev(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <i className="fa-solid fa-pen-to-square text-[11px] mr-1"></i>
                Edit Rules
              </button>
            )}
          </div>

          {!isEditingLev ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block">Annual</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {levPolicy.rules?.annualLeaveEntitlement || 14}d
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block">Casual</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {levPolicy.rules?.casualLeaveEntitlement || 10}d
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block">Sick</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {levPolicy.rules?.sickLeaveEntitlement || 8}d
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Annual Leave Routing Threshold:</span>
                  <span className="font-mono font-bold text-amber-900 text-sm">
                    {levPolicy.rules?.annualLeaveApproverThreshold || leavePolicyService.getAnnualLeaveApproverThreshold() || 2} Approved Requests / Year
                  </span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Normal Staff: 1st &amp; 2nd annual leave request approved by Team Lead; 3rd+ escalates to Dept Manager. Team Lead: 1st &amp; 2nd to Dept Manager; 3rd+ to HR Admin.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Annual Leave Routing Threshold:</span>
                  <span className="font-mono font-bold text-indigo-900 text-sm">
                    {levPolicy.rules?.annualLeaveApproverThreshold || leavePolicyService.getAnnualLeaveApproverThreshold() || 2} Requests / Year
                  </span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Normal Staff: 1st &amp; 2nd request to Team Lead; 3rd+ to Dept Manager. Team Lead: 1st &amp; 2nd request to Dept Manager; 3rd+ to HR Admin.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Carry Forward Limit</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    Up to {levPolicy.rules?.maxCarryForwardDays || 5} unused annual days
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Expires Dec 31
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveLeaves} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">Annual Days</label>
                  <input
                    type="number"
                    value={levForm.annualLeaveEntitlement || 14}
                    onChange={(e) => setLevForm({ ...levForm, annualLeaveEntitlement: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">Casual Days</label>
                  <input
                    type="number"
                    value={levForm.casualLeaveEntitlement || 10}
                    onChange={(e) => setLevForm({ ...levForm, casualLeaveEntitlement: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-1">Sick Days</label>
                  <input
                    type="number"
                    value={levForm.sickLeaveEntitlement || 8}
                    onChange={(e) => setLevForm({ ...levForm, sickLeaveEntitlement: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Annual Approver Quota (Approved Requests / Year)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={levForm.annualLeaveApproverThreshold !== undefined ? levForm.annualLeaveApproverThreshold : 2}
                    onChange={(e) => setLevForm({ ...levForm, annualLeaveApproverThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Normal Staff: 1st–2nd request → Team Lead; 3rd+ → Dept Manager. Team Lead: 1st–2nd → Dept Manager; 3rd+ → HR Admin.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingLev(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  Save &amp; Version Policy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default AttendanceLeavePoliciesTab
