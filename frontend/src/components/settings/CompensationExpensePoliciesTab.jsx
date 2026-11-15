import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { taxService } from '@/services/taxService'
import { useAuth } from '@/context/AuthContext'
import { apiClient } from '@/services/apiClient'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'

export function CompensationExpensePoliciesTab() {
  const { currentUser, user } = useAuth()
  const activeUser = currentUser || user || {}
  const roleUpper = String(activeUser?.role || activeUser?.backendRole || '').toUpperCase().replace(/[^A-Z]/g, '')
  const isSuperAdmin = roleUpper === 'SUPERADMIN'

  // =========================================================================
  // 1. MANUAL PAYROLL TAX CONFIGURATION STATE
  // =========================================================================
  const [taxConfig, setTaxConfig] = useState({
    enabled: true,
    mode: 'FBR_STATUTORY',
    ratePercentage: 0,
    fixedAmount: 0,
    description: '',
    history: [],
    updatedAt: null,
    updatedBy: ''
  })
  const [taxLoading, setTaxLoading] = useState(true)
  const [taxSaving, setTaxSaving] = useState(false)
  const [taxFeedback, setTaxFeedback] = useState(null)
  const [taxReason, setTaxReason] = useState('')
  const [showTaxHistory, setShowTaxHistory] = useState(false)

  // =========================================================================
  // 2. COMPANY POLICIES STATE (POL-PAY-001, POL-EXP-001, POL-TRV-001)
  // =========================================================================
  const [policies, setPolicies] = useState([])
  const [policiesLoading, setPoliciesLoading] = useState(true)
  const [policyFeedback, setPolicyFeedback] = useState(null)

  // Policy Editing State
  const [editingPolicyId, setEditingPolicyId] = useState(null)
  const [policyFormData, setPolicyFormData] = useState({})
  const [policySaving, setPolicySaving] = useState(false)
  const [policyFormError, setPolicyFormError] = useState('')

  // Policy History Modal State
  const [historyPolicy, setHistoryPolicy] = useState(null)
  const [policyHistoryLogs, setPolicyHistoryLogs] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Load Tax Config
  const loadTaxConfig = useCallback(async () => {
    setTaxLoading(true)
    try {
      const config = await taxService.getPayrollTaxConfig()
      if (config) {
        setTaxConfig({
          enabled: config.enabled !== false,
          mode: config.mode || (config.enabled === false ? 'OFF' : 'FBR_STATUTORY'),
          ratePercentage: Number(config.ratePercentage || 0),
          fixedAmount: Number(config.fixedAmount || 0),
          description: config.description || '',
          history: Array.isArray(config.history) ? config.history : [],
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy
        })
      }
    } catch (err) {
      console.warn('Failed to load tax config:', err)
    } finally {
      setTaxLoading(false)
    }
  }, [])

  // Load PostgreSQL-backed Company Policies
  const loadPolicies = useCallback(async () => {
    setPoliciesLoading(true)
    try {
      const res = await apiClient.get('/admin/company-policies')
      const data = res?.data || res
      if (Array.isArray(data)) {
        setPolicies(data)
      }
    } catch (err) {
      console.warn('Failed to load company policies:', err)
    } finally {
      setPoliciesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTaxConfig()
    loadPolicies()
  }, [loadTaxConfig, loadPolicies])

  // Find policies by ID
  const payPolicy = policies.find((p) => p.id === 'POL-PAY-001') || {
    id: 'POL-PAY-001',
    name: 'Salary Revision Governance',
    version: '1.5',
    status: 'Active',
    rules: {
      salaryRevisionApprovalAuthority: 'SUPER_ADMIN',
      maxAnnualIncrementPercentage: 25.0,
      requireBoardApprovalAboveCap: true,
      loanMaxAmountMultiplier: 3.0,
      loanMaxDeductionPercent: 30.0
    }
  }

  const expPolicy = policies.find((p) => p.id === 'POL-EXP-001') || {
    id: 'POL-EXP-001',
    name: 'Expense Tiers & Receipts',
    version: '2.0',
    status: 'Active',
    rules: {
      requiredReceiptThreshold: 1000,
      dailyFuelLimit: 6000,
      dailyMealLimit: 4000,
      restrictDuplicateFuelAllowance: true,
      applicableExceptionPolicy: 'Emergency client dispatch with departmental pre-authorization'
    }
  }

  const trvPolicy = policies.find((p) => p.id === 'POL-TRV-001') || {
    id: 'POL-TRV-001',
    name: 'Travel & Transport Policy',
    version: '1.2',
    status: 'Active',
    rules: {
      maxAdvancePercentage: 80,
      perDiemDailyCap: 5000,
      pickAndDropMonthlyChargeRate: 3500,
      advanceSettlementDeadlineDays: 7
    }
  }

  // Handle Save Manual Tax Configuration
  const handleSaveTaxConfig = async (e) => {
    e?.preventDefault()
    setTaxFeedback(null)

    if (!isSuperAdmin) {
      setTaxFeedback({
        type: 'error',
        message: 'Access Denied: Only Super Admin holds legal authority to alter company payroll tax policy.'
      })
      return
    }

    if (!taxReason.trim()) {
      setTaxFeedback({
        type: 'error',
        message: 'Mandatory Policy Modification Reason is required before saving to PostgreSQL.'
      })
      return
    }

    setTaxSaving(true)
    try {
      const payload = {
        enabled: taxConfig.enabled && taxConfig.mode !== 'OFF',
        mode: taxConfig.mode,
        ratePercentage: Number(taxConfig.ratePercentage || 0),
        fixedAmount: Number(taxConfig.fixedAmount || 0),
        description: taxConfig.description || '',
        reason: taxReason.trim()
      }

      const result = await taxService.updatePayrollTaxConfig(payload)
      setTaxConfig((prev) => ({
        ...prev,
        ...result,
        history: result.history || prev.history
      }))
      setTaxReason('')
      setTaxFeedback({
        type: 'success',
        message: 'Payroll Tax Configuration successfully updated in PostgreSQL and recorded in Audit Log.'
      })
    } catch (err) {
      setTaxFeedback({
        type: 'error',
        message: err?.message || 'Failed to persist tax configuration to database.'
      })
    } finally {
      setTaxSaving(false)
    }
  }

  // Open Edit Policy Modal
  const handleOpenEditPolicy = (policy) => {
    setPolicyFormError('')
    setEditingPolicyId(policy.id)
    setPolicyFormData({
      name: policy.name || '',
      effectiveFrom: policy.effectiveFrom ? policy.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10),
      changeReason: '',
      rules: { ...(policy.rules || {}) }
    })
  }

  // Save Company Policy
  const handleSavePolicy = async (e) => {
    e?.preventDefault()
    setPolicyFormError('')

    if (!isSuperAdmin) {
      setPolicyFormError('Only Super Admin holds authority to modify company policies.')
      return
    }

    if (!policyFormData.changeReason?.trim()) {
      setPolicyFormError('Mandatory Policy Modification Reason is required before saving.')
      return
    }

    setPolicySaving(true)
    try {
      const payload = {
        effectiveFrom: policyFormData.effectiveFrom,
        changeReason: policyFormData.changeReason.trim(),
        rules: policyFormData.rules
      }

      await apiClient.put(`/admin/company-policies/${editingPolicyId}`, payload)
      await loadPolicies()
      setEditingPolicyId(null)
      setPolicyFeedback({
        type: 'success',
        message: `Policy ${editingPolicyId} successfully versioned and updated in PostgreSQL.`
      })
    } catch (err) {
      setPolicyFormError(err?.message || 'Failed to update company policy in PostgreSQL.')
    } finally {
      setPolicySaving(false)
    }
  }

  // Open Policy History Modal
  const handleOpenHistoryModal = async (policy) => {
    setHistoryPolicy(policy)
    setPolicyHistoryLogs([])
    setHistoryLoading(true)
    try {
      const res = await apiClient.get(`/admin/company-policies/${policy.id}/history`)
      const list = res?.data || res
      setPolicyHistoryLogs(Array.isArray(list) ? list : [])
    } catch (err) {
      console.warn('Failed to load policy audit logs:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Payroll &amp; Expense Policies
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized monetary governance for salary revision authority, loan limits, expense caps, and manual payroll tax configuration.
          </p>
        </div>
      </div>

      {policyFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold border ${
            policyFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {policyFeedback.message}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: SUPER ADMIN MANUAL PAYROLL TAX CONFIGURATION CARD             */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
        {/* Card Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-navy-900 to-navy-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AppIcon name="calculator" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Manual Payroll Tax Configuration &amp; Governance
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  Super Admin Authority
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Directly configure withholding tax deductions applied in payroll calculations across all active employees.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                !taxConfig.enabled || taxConfig.mode === 'OFF'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !taxConfig.enabled || taxConfig.mode === 'OFF' ? 'bg-rose-400' : 'bg-emerald-400'
                }`}
              />
              {!taxConfig.enabled || taxConfig.mode === 'OFF' ? 'Tax Disabled (OFF)' : 'Tax Engine Active'}
            </span>
          </div>
        </div>

        {/* Feedback Message */}
        {taxFeedback && (
          <div
            className={`px-6 py-3 text-xs font-medium border-b ${
              taxFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {taxFeedback.message}
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSaveTaxConfig} className="p-6 space-y-6">
          {/* Global Deduction Mode Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Global Tax Deduction Engine Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Statutory FBR */}
              <label
                className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  taxConfig.mode === 'FBR_STATUTORY' && taxConfig.enabled
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">Pakistan Statutory (FBR)</span>
                  <input
                    type="radio"
                    name="taxMode"
                    value="FBR_STATUTORY"
                    disabled={!isSuperAdmin}
                    checked={taxConfig.mode === 'FBR_STATUTORY' && taxConfig.enabled}
                    onChange={() =>
                      setTaxConfig((prev) => ({
                        ...prev,
                        mode: 'FBR_STATUTORY',
                        enabled: true
                      }))
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  Automatic monthly withholding slabs per Income Tax Ordinance Section 149.
                </span>
                <span className="mt-3 text-[10px] font-mono font-bold text-blue-700 bg-blue-100/60 self-start px-1.5 py-0.5 rounded">
                  Legal Standard
                </span>
              </label>

              {/* Option 2: Percentage */}
              <label
                className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  taxConfig.mode === 'PERCENTAGE' && taxConfig.enabled
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">Flat Percentage (%)</span>
                  <input
                    type="radio"
                    name="taxMode"
                    value="PERCENTAGE"
                    disabled={!isSuperAdmin}
                    checked={taxConfig.mode === 'PERCENTAGE' && taxConfig.enabled}
                    onChange={() =>
                      setTaxConfig((prev) => ({
                        ...prev,
                        mode: 'PERCENTAGE',
                        enabled: true
                      }))
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  Deducts fixed percentage across all employees based on monthly gross pay.
                </span>
                <span className="mt-3 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100/60 self-start px-1.5 py-0.5 rounded">
                  Manual Custom Rate
                </span>
              </label>

              {/* Option 3: Fixed Amount */}
              <label
                className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  taxConfig.mode === 'FIXED_AMOUNT' && taxConfig.enabled
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">Fixed Amount (PKR)</span>
                  <input
                    type="radio"
                    name="taxMode"
                    value="FIXED_AMOUNT"
                    disabled={!isSuperAdmin}
                    checked={taxConfig.mode === 'FIXED_AMOUNT' && taxConfig.enabled}
                    onChange={() =>
                      setTaxConfig((prev) => ({
                        ...prev,
                        mode: 'FIXED_AMOUNT',
                        enabled: true
                      }))
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  Uniform fixed rupee amount deducted from every eligible employee.
                </span>
                <span className="mt-3 text-[10px] font-mono font-bold text-amber-700 bg-amber-100/60 self-start px-1.5 py-0.5 rounded">
                  Flat Rupee Deduct
                </span>
              </label>

              {/* Option 4: Disabled / OFF */}
              <label
                className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  taxConfig.mode === 'OFF' || !taxConfig.enabled
                    ? 'border-rose-600 bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">Tax Disabled (OFF)</span>
                  <input
                    type="radio"
                    name="taxMode"
                    value="OFF"
                    disabled={!isSuperAdmin}
                    checked={taxConfig.mode === 'OFF' || !taxConfig.enabled}
                    onChange={() =>
                      setTaxConfig((prev) => ({
                        ...prev,
                        mode: 'OFF',
                        enabled: false
                      }))
                    }
                    className="text-rose-600 focus:ring-rose-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  Zero (PKR 0) tax withheld in payroll calculations.
                </span>
                <span className="mt-3 text-[10px] font-mono font-bold text-rose-700 bg-rose-100/60 self-start px-1.5 py-0.5 rounded">
                  Withholding Paused
                </span>
              </label>
            </div>
          </div>

          {/* Conditional Mode Inputs & Live Preview */}
          <div className="space-y-4">
            {taxConfig.mode === 'PERCENTAGE' && (
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-blue-950 block">
                    Fixed Tax Deduction Rate (%)
                  </label>
                  <span className="text-[11px] text-blue-700">
                    Applied uniformly to monthly gross earnings for eligible employees.
                  </span>
                  <div className="mt-1 text-[11px] text-slate-600 font-mono">
                    Live Calculation Preview: On PKR 100,000 Gross Pay → <strong>PKR {((100000 * (Number(taxConfig.ratePercentage) || 0)) / 100).toLocaleString()}</strong> Withheld
                  </div>
                </div>
                <div className="w-full sm:w-48 shrink-0">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={!isSuperAdmin}
                      value={taxConfig.ratePercentage}
                      onChange={(e) =>
                        setTaxConfig((prev) => ({
                          ...prev,
                          ratePercentage: Math.max(0, Math.min(100, Number(e.target.value || 0)))
                        }))
                      }
                      className="w-full text-right font-mono font-bold text-sm border border-blue-300 rounded-lg py-2 pl-3 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>
              </div>
            )}

            {taxConfig.mode === 'FIXED_AMOUNT' && (
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-indigo-950 block">
                    Fixed Monthly Tax Deduction Amount (PKR)
                  </label>
                  <span className="text-[11px] text-indigo-700">
                    Exact deduction applied uniformly across all eligible employees each month.
                  </span>
                  <div className="mt-1 text-[11px] text-slate-600 font-mono">
                    Live Calculation Preview: Each employee will have exactly <strong>PKR {Number(taxConfig.fixedAmount || 0).toLocaleString()}</strong> deducted.
                  </div>
                </div>
                <div className="w-full sm:w-48 shrink-0">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      PKR
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      disabled={!isSuperAdmin}
                      value={taxConfig.fixedAmount}
                      onChange={(e) =>
                        setTaxConfig((prev) => ({
                          ...prev,
                          fixedAmount: Math.max(0, Number(e.target.value || 0))
                        }))
                      }
                      className="w-full text-right font-mono font-bold text-sm border border-indigo-300 rounded-lg py-2 pl-12 pr-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mandatory Regulatory Notice on Statutory Tracking */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 flex items-start gap-3 text-xs text-amber-900">
              <AppIcon name="shield" className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-950">Statutory FBR Section 149 Compliance Assurance</span>
                <span className="text-[11.5px] text-amber-800 leading-relaxed block mt-0.5">
                  Regardless of manual mode, the engine continuously calculates statutory FBR Section 149 liability in parallel. Statutory obligations and variances are recorded in PostgreSQL audit logs, payslips, and compliance reports to guarantee tax transparency without silent legal waivers.
                </span>
              </div>
            </div>
          </div>

          {/* Policy Remarks / Audit Justification Input */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <label className="text-xs font-bold text-slate-900 block">
              Policy Modification Reason &amp; Audit Remarks (Mandatory for PostgreSQL Audit Trail)
            </label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={taxReason}
              onChange={(e) => setTaxReason(e.target.value)}
              placeholder="e.g. Approved board resolution for flat 5% withholding policy, or annual tax revision"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Audit History / Metadata */}
          {taxConfig.updatedAt && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              <div>
                Last persistent update by <strong>{taxConfig.updatedBy || 'Super Admin'}</strong> on{' '}
                {new Date(taxConfig.updatedAt).toLocaleString()}
              </div>
              {taxConfig.history?.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTaxHistory(!showTaxHistory)}
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  {showTaxHistory ? 'Hide Change History' : `View Change History (${taxConfig.history.length})`}
                </button>
              )}
            </div>
          )}

          {/* History Collapsible */}
          {showTaxHistory && taxConfig.history?.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-48 overflow-y-auto text-xs">
              <span className="font-bold text-slate-700 block text-[11px] uppercase">
                PostgreSQL Change Log Trail
              </span>
              {taxConfig.history.map((h, i) => (
                <div key={i} className="p-2 bg-white rounded border border-slate-200 text-[11px] space-y-0.5">
                  <div className="flex justify-between font-mono text-slate-500">
                    <span>{h.actorLabel || 'Super Admin'}</span>
                    <span>{new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="font-semibold text-slate-800">
                    Mode changed from {h.previousMode} → {h.newMode}
                  </div>
                  {h.reason && <div className="text-slate-500 italic">&ldquo;{h.reason}&rdquo;</div>}
                </div>
              ))}
            </div>
          )}

          {/* Footer Save Action */}
          {isSuperAdmin && (
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={taxSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 cursor-pointer"
              >
                Save Tax Configuration to PostgreSQL
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: FULLY CONFIGURABLE POSTGRESQL-BACKED COMPANY POLICIES CARDS    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Salary Revision Governance (POL-PAY-001) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  POL-PAY-001
                </span>
                <h3 className="text-xs font-bold text-slate-900">{payPolicy.name}</h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                v{payPolicy.version || '1.5'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Approval Authority:</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  {payPolicy.rules?.salaryRevisionApprovalAuthority || 'SUPER_ADMIN'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Annual Increment Cap:</span>
                <span className="font-mono font-bold text-slate-900">
                  {payPolicy.rules?.maxAnnualIncrementPercentage ?? 25}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Board Approval Above Cap:</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    payPolicy.rules?.requireBoardApprovalAboveCap !== false
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {payPolicy.rules?.requireBoardApprovalAboveCap !== false ? 'Required' : 'Waived'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Employee Loan Maximum:</span>
                <span className="font-mono font-bold text-slate-900">
                  {payPolicy.rules?.loanMaxAmountMultiplier ?? 3}x Basic Salary
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Monthly Loan Deduction Cap:</span>
                <span className="font-mono font-bold text-slate-900">
                  {payPolicy.rules?.loanMaxDeductionPercent ?? 30}% of Basic
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 text-[10px] text-slate-500">
                <span className="font-bold text-slate-700 block">Divisor Invariant:</span>
                Protected 31-day divisor for proration and daily wage calculations.
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleOpenHistoryModal(payPolicy)}
              className="text-[11px] text-slate-500 hover:text-blue-600 font-semibold cursor-pointer"
            >
              History
            </button>
            {isSuperAdmin && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleOpenEditPolicy(payPolicy)}
                className="text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
              >
                Edit Policy
              </Button>
            )}
          </div>
        </div>

        {/* Card 2: Expense Tiers & Receipts (POL-EXP-001) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  POL-EXP-001
                </span>
                <h3 className="text-xs font-bold text-slate-900">{expPolicy.name}</h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                v{expPolicy.version || '2.0'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Mandatory Receipt Threshold:</span>
                <span className="font-mono font-bold text-slate-900">
                  PKR {Number(expPolicy.rules?.requiredReceiptThreshold ?? 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Daily Fuel Limit:</span>
                <span className="font-mono font-bold text-slate-900">
                  PKR {Number(expPolicy.rules?.dailyFuelLimit ?? 6000).toLocaleString()} / day
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Daily Meals Limit:</span>
                <span className="font-mono font-bold text-slate-900">
                  PKR {Number(expPolicy.rules?.dailyMealLimit ?? 4000).toLocaleString()} / day
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Duplicate Fuel Check:</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    expPolicy.rules?.restrictDuplicateFuelAllowance !== false
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {expPolicy.rules?.restrictDuplicateFuelAllowance !== false ? 'Restricted' : 'Allowed'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 text-[10px] text-slate-500">
                <span className="font-bold text-slate-700 block">Exception Policy:</span>
                {expPolicy.rules?.applicableExceptionPolicy || 'Departmental pre-authorization required for exceptions.'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleOpenHistoryModal(expPolicy)}
              className="text-[11px] text-slate-500 hover:text-blue-600 font-semibold cursor-pointer"
            >
              History
            </button>
            {isSuperAdmin && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleOpenEditPolicy(expPolicy)}
                className="text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
              >
                Edit Policy
              </Button>
            )}
          </div>
        </div>

        {/* Card 3: Travel & Transport Policy (POL-TRV-001) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                  POL-TRV-001
                </span>
                <h3 className="text-xs font-bold text-slate-900">{trvPolicy.name}</h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                v{trvPolicy.version || '1.2'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Max Travel Advance:</span>
                <span className="font-mono font-bold text-slate-900">
                  {trvPolicy.rules?.maxAdvancePercentage ?? 80}% of budget
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Domestic Daily Per-Diem:</span>
                <span className="font-mono font-bold text-slate-900">
                  PKR {Number(trvPolicy.rules?.perDiemDailyCap ?? 5000).toLocaleString()} / day
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Pick-and-Drop Rate:</span>
                <span className="font-mono font-bold text-slate-900">
                  PKR {Number(trvPolicy.rules?.pickAndDropMonthlyChargeRate ?? 3500).toLocaleString()} / month
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Settlement Deadline:</span>
                <span className="font-mono font-bold text-slate-900">
                  {trvPolicy.rules?.advanceSettlementDeadlineDays ?? 7} days post-trip
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 text-[10px] text-slate-500">
                <span className="font-bold text-slate-700 block">Facility Scope:</span>
                Attendance bridging applies on authorized multi-day travel requests.
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleOpenHistoryModal(trvPolicy)}
              className="text-[11px] text-slate-500 hover:text-blue-600 font-semibold cursor-pointer"
            >
              History
            </button>
            {isSuperAdmin && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleOpenEditPolicy(trvPolicy)}
                className="text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
              >
                Edit Policy
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDIT COMPANY POLICY (PORTALED TO BODY)                             */}
      {/* ========================================================================= */}
      {editingPolicyId &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setEditingPolicyId(null)}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen min-w-full z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg text-left overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Edit {editingPolicyId} — {editingPolicyId === 'POL-PAY-001' ? 'Salary Revision Governance' : editingPolicyId === 'POL-EXP-001' ? 'Expense Tiers & Receipts' : 'Travel & Transport Policy'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Super Admin Authorized Monetary Policy Modification</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPolicyId(null)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {policyFormError && (
                <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 shrink-0">
                  {policyFormError}
                </div>
              )}

              <form onSubmit={handleSavePolicy} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Specific Fields for POL-PAY-001 */}
                {editingPolicyId === 'POL-PAY-001' && (
                  <div className="space-y-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Salary Revision Approval Authority
                      </label>
                      <select
                        value={policyFormData.rules?.salaryRevisionApprovalAuthority || 'SUPER_ADMIN'}
                        onChange={(e) =>
                          setPolicyFormData((prev) => ({
                            ...prev,
                            rules: { ...prev.rules, salaryRevisionApprovalAuthority: e.target.value }
                          }))
                        }
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="SUPER_ADMIN">Super Admin Only (Recommended)</option>
                        <option value="HR_ADMIN">HR Admin / Super Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Annual Salary Increment Cap (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="0.5"
                        value={policyFormData.rules?.maxAnnualIncrementPercentage ?? 25}
                        onChange={(e) =>
                          setPolicyFormData((prev) => ({
                            ...prev,
                            rules: { ...prev.rules, maxAnnualIncrementPercentage: Number(e.target.value) }
                          }))
                        }
                        className="w-full font-mono text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="boardApprovalCheck"
                        checked={policyFormData.rules?.requireBoardApprovalAboveCap !== false}
                        onChange={(e) =>
                          setPolicyFormData((prev) => ({
                            ...prev,
                            rules: { ...prev.rules, requireBoardApprovalAboveCap: e.target.checked }
                          }))
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="boardApprovalCheck" className="text-slate-700 font-semibold cursor-pointer">
                        Require Board Approval for increments above cap
                      </label>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Employee Loan Maximum (Multiplier of Basic Salary)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          value={policyFormData.rules?.loanMaxAmountMultiplier ?? 3}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, loanMaxAmountMultiplier: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          x
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Monthly Loan Deduction Cap (% of Basic Salary)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="5"
                          max="80"
                          step="1"
                          value={policyFormData.rules?.loanMaxDeductionPercent ?? 30}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, loanMaxDeductionPercent: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific Fields for POL-EXP-001 */}
                {editingPolicyId === 'POL-EXP-001' && (
                  <div className="space-y-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Mandatory Receipt Threshold (PKR)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          PKR
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={policyFormData.rules?.requiredReceiptThreshold ?? 1000}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, requiredReceiptThreshold: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg pl-12 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Maximum Daily Fuel Reimbursement (PKR / day)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          PKR
                        </span>
                        <input
                          type="number"
                          min="500"
                          step="500"
                          value={policyFormData.rules?.dailyFuelLimit ?? 6000}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, dailyFuelLimit: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg pl-12 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Maximum Daily Meals &amp; Refreshment Claim (PKR / day)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          PKR
                        </span>
                        <input
                          type="number"
                          min="500"
                          step="500"
                          value={policyFormData.rules?.dailyMealLimit ?? 4000}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, dailyMealLimit: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg pl-12 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="fuelDupCheck"
                        checked={policyFormData.rules?.restrictDuplicateFuelAllowance !== false}
                        onChange={(e) =>
                          setPolicyFormData((prev) => ({
                            ...prev,
                            rules: { ...prev.rules, restrictDuplicateFuelAllowance: e.target.checked }
                          }))
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="fuelDupCheck" className="text-slate-700 font-semibold cursor-pointer">
                        Restrict fuel reimbursement when employee has active fuel allowance
                      </label>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Applicable Exception Policy
                      </label>
                      <input
                        type="text"
                        value={policyFormData.rules?.applicableExceptionPolicy || ''}
                        onChange={(e) =>
                          setPolicyFormData((prev) => ({
                            ...prev,
                            rules: { ...prev.rules, applicableExceptionPolicy: e.target.value }
                          }))
                        }
                        placeholder="e.g. Emergency client dispatch with departmental pre-authorization"
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Specific Fields for POL-TRV-001 */}
                {editingPolicyId === 'POL-TRV-001' && (
                  <div className="space-y-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Maximum Travel Advance (% of approved budget)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="10"
                          max="100"
                          step="5"
                          value={policyFormData.rules?.maxAdvancePercentage ?? 80}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, maxAdvancePercentage: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Domestic Daily Per-Diem (PKR / day)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          PKR
                        </span>
                        <input
                          type="number"
                          min="500"
                          step="500"
                          value={policyFormData.rules?.perDiemDailyCap ?? 5000}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, perDiemDailyCap: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg pl-12 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Monthly Company Pick-and-Drop Rate (PKR / month)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          PKR
                        </span>
                        <input
                          type="number"
                          min="500"
                          step="250"
                          value={policyFormData.rules?.pickAndDropMonthlyChargeRate ?? 3500}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, pickAndDropMonthlyChargeRate: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg pl-12 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Travel Advance Settlement Deadline (Days after return)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          step="1"
                          value={policyFormData.rules?.advanceSettlementDeadlineDays ?? 7}
                          onChange={(e) =>
                            setPolicyFormData((prev) => ({
                              ...prev,
                              rules: { ...prev.rules, advanceSettlementDeadlineDays: Number(e.target.value) }
                            }))
                          }
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg px-3 py-2 pr-14 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          days
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Common Fields */}
                <div className="border-t border-slate-200 pt-3 space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Effective Date
                    </label>
                    <input
                      type="date"
                      value={policyFormData.effectiveFrom}
                      onChange={(e) =>
                        setPolicyFormData((prev) => ({ ...prev, effectiveFrom: e.target.value }))
                      }
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Policy Modification Reason (Mandatory for PostgreSQL Audit Trail)
                    </label>
                    <input
                      type="text"
                      value={policyFormData.changeReason}
                      onChange={(e) =>
                        setPolicyFormData((prev) => ({ ...prev, changeReason: e.target.value }))
                      }
                      placeholder="e.g. Annual compensation policy review, fuel allowance revision"
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPolicyId(null)}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={policySaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                  >
                    Save Policy Changes to PostgreSQL
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW POLICY CHANGE HISTORY (PORTALED TO BODY)                      */}
      {/* ========================================================================= */}
      {historyPolicy &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setHistoryPolicy(null)}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen min-w-full z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg text-left overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
            >
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {historyPolicy.id} Audit History
                  </h3>
                  <p className="text-[11px] text-slate-400">PostgreSQL AuditLog Records for {historyPolicy.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPolicy(null)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
                {historyLoading ? (
                  <div className="py-8 text-center text-slate-400">Loading audit history...</div>
                ) : policyHistoryLogs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    No historical modifications recorded yet for {historyPolicy.id}. Current version is active baseline.
                  </div>
                ) : (
                  policyHistoryLogs.map((log) => {
                    const snap = log.recordSnapshotAfter || {}
                    return (
                      <div key={log.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                          <span className="font-bold text-slate-800">
                            {log.actorUser?.displayName || log.actorUser?.username || log.actorRole || 'Super Admin'}
                          </span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-700 font-medium">
                          Action: <span className="font-mono font-bold text-blue-700">{log.actionType}</span>
                          {snap.version && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-200 font-mono">
                              v{snap.version}
                            </span>
                          )}
                        </div>
                        {snap.changeReason && (
                          <div className="text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                            &ldquo;{snap.changeReason}&rdquo;
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryPolicy(null)}
                  className="cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default CompensationExpensePoliciesTab
