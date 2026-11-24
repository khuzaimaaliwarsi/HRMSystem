import React, { useState, useEffect } from 'react'
import { policyService } from '@/services/policyService'
import { useAuth } from '@/context/useAuth'
import AppIcon from '@/components/common/AppIcon'
import notify from '@/lib/notify'

const CATEGORIES = [
  { key: 'all', label: 'All Categories' },
  { key: 'attendance', label: 'Attendance & Punctuality' },
  { key: 'leaves', label: 'Leaves & Time-Off' },
  { key: 'payroll', label: 'Compensation & Payroll' },
  { key: 'expenses', label: 'Expenses & Reimbursement' },
  { key: 'travel', label: 'Travel & Transport' },
  { key: 'recruitment', label: 'Talent & Probation' },
  { key: 'performance', label: 'Performance & Appraisals' },
  { key: 'training', label: 'Training & Development' },
  { key: 'helpdesk', label: 'Help Desk SLA' },
  { key: 'letters', label: 'Corporate HR Letters' }
]

export function CentralPolicyBuilderTab() {
  const { user } = useAuth()
  const isSuperAdmin =
    ['super_admin', 'superadmin'].includes(String(user?.role || '').toLowerCase()) ||
    ['super_admin', 'superadmin'].includes(String(user?.backendRole || '').toLowerCase())

  const [policies, setPolicies] = useState(() => policyService.getAllPolicies())
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeModal, setActiveModal] = useState(null) // 'create', 'edit', 'preview'
  const [targetPolicy, setTargetPolicy] = useState(null)
  const [deleteConfirmPolicy, setDeleteConfirmPolicy] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [affectedEmployees, setAffectedEmployees] = useState([])
  const [feedback, setFeedback] = useState(null)

  // Custom Policy Categories
  const [customPolicyCategories, setCustomPolicyCategories] = useState([])
  const [isAddingCustomPolicyCat, setIsAddingCustomPolicyCat] = useState(false)
  const [newPolicyCatName, setNewPolicyCatName] = useState('')

  const handleAddCustomPolicyCategory = () => {
    const trimmed = (newPolicyCatName || '').trim()
    if (!trimmed) return
    if (!customPolicyCategories.includes(trimmed)) {
      const updated = [trimmed, ...customPolicyCategories]
      setCustomPolicyCategories(updated)
    }
    setFormData((prev) => ({ ...prev, category: trimmed }))
    setIsAddingCustomPolicyCat(false)
    setNewPolicyCatName('')
  }

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'attendance',
    description: '',
    appliesTo: 'Company-Wide',
    scopeValue: 'all',
    ruleType: 'threshold',
    allowedLimit: 4,
    calculationMethod: 'fixed',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '2026-12-31',
    status: 'Active',
    changeReason: ''
  })

  useEffect(() => {
    policyService.fetchPoliciesFromBackend().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setPolicies(list)
      }
    })

    return policyService.subscribe(() => {
      const all = policyService.getAllPolicies()
      setPolicies(Array.isArray(all) ? all : [])
    })
  }, [])

  const safePolicies = Array.isArray(policies) ? policies : []
  const filteredPolicies = safePolicies.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      category: 'attendance',
      description: '',
      appliesTo: 'Company-Wide',
      scopeValue: 'all',
      ruleType: 'threshold',
      allowedLimit: 4,
      calculationMethod: 'fixed',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '2026-12-31',
      status: 'Active',
      changeReason: 'New corporate policy configuration'
    })
    setActiveModal('create')
  }

  const handleOpenEdit = (policy) => {
    setTargetPolicy(policy)
    setFormData({
      ...policy,
      changeReason: `Revision to ${policy.name}`
    })
    setActiveModal('edit')
  }

  const handleOpenView = (policy) => {
    setTargetPolicy(policy)
    setActiveModal('view')
  }

  const handleOpenPreview = (policy) => {
    setTargetPolicy(policy)
    const affected = policyService.previewAffectedEmployees(policy.id)
    setAffectedEmployees(affected)
    setActiveModal('preview')
  }

  const handleSavePolicy = async (e) => {
    e.preventDefault()
    try {
      if (activeModal === 'create') {
        const created = await policyService.createPolicy(formData, user)
        notify.success(`Policy '${created.name}' created successfully (${created.id}).`)
        setFeedback({ type: 'success', text: `Policy '${created.name}' created successfully (${created.id}).` })
      } else if (activeModal === 'edit' && targetPolicy) {
        const updated = await policyService.versionPolicy(
          targetPolicy.id,
          formData,
          user,
          formData.changeReason
        )
        notify.success(`Policy '${updated.id}' updated to v${updated.version} successfully.`)
        setFeedback({ type: 'success', text: `Policy '${updated.id}' bumped to v${updated.version} successfully.` })
      }
      setActiveModal(null)
      setPolicies(policyService.getAllPolicies())
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      notify.error(err.message || 'Operation failed')
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleToggleStatus = async (policy) => {
    if (!isSuperAdmin) return
    const nextStatus = policy.status === 'Active' ? 'Archived' : 'Active'
    try {
      await policyService.togglePolicyStatus(policy.id, nextStatus, user)
      notify.success(`Policy ${policy.id} transitioned to ${nextStatus}.`)
      setFeedback({ type: 'success', text: `Policy ${policy.id} transitioned to ${nextStatus}.` })
      setPolicies(policyService.getAllPolicies())
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      notify.error(err.message || 'Failed to update policy status')
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleDeletePolicy = async () => {
    if (!deleteConfirmPolicy || !isSuperAdmin) return
    try {
      setIsDeleting(true)
      await policyService.deletePolicy(deleteConfirmPolicy.id, user)
      notify.success(`Policy ${deleteConfirmPolicy.id} has been safely deleted.`)
      setFeedback({ type: 'success', text: `Policy ${deleteConfirmPolicy.id} deleted successfully.` })
      setDeleteConfirmPolicy(null)
      setPolicies(policyService.getAllPolicies())
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      notify.error(err.message || 'Failed to delete policy')
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header & Aligned Action Button — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Company Policies &amp; Rule Builder
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single authoritative configuration source governing attendance, leave caps, compensation rules, and expenditure thresholds.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm self-start sm:self-auto shrink-0"
          >
            <AppIcon name="plus" className="w-3 h-3" />
            <span>Create New Policy</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <AppIcon
            name={feedback.type === 'success' ? 'success' : 'warning'}
            className={`w-4 h-4 ${feedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
          />
          {feedback.text}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-500 text-[11px]">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search policies by name, code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <AppIcon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Policies Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Policy Code &amp; Name</th>
                <th className="py-3 px-3">Scope &amp; Precedence</th>
                <th className="py-3 px-3">Rule Type &amp; Limit</th>
                <th className="py-3 px-3">Effective Window</th>
                <th className="py-3 px-3">Version</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPolicies.map((p) => {
                const isEmployeeScope = p.precedence === 1
                const isDeptScope = p.precedence === 2
                const isProtected = policyService.isPolicyProtected(p.id)

                return (
                  <tr key={p.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{p.id}</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {p.category}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-800 block mt-0.5">{p.name}</span>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isEmployeeScope
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : isDeptScope
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          P{p.precedence || 4}: {p.appliesTo}
                        </span>
                      </div>
                      {p.scopeValue !== 'all' && (
                        <span className="text-[10px] font-mono text-slate-500 block mt-1">
                          Scope: {p.scopeValue}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block capitalize">
                        {p.ruleType}
                      </span>
                      <span className="text-[11px] font-mono text-slate-600">
                        {p.allowedLimit ? `Limit: ${p.allowedLimit}` : 'Configured Rules'}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      <div>{p.effectiveFrom || '2026-01-01'}</div>
                      <div className="text-slate-400">to {p.effectiveTo || '2026-12-31'}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-800 text-[11px]">
                        v{p.version}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* View Policy Configuration */}
                        <button
                          type="button"
                          onClick={() => handleOpenView(p)}
                          title="View Policy Configuration"
                          className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200"
                        >
                          <AppIcon name="eye" className="w-3.5 h-3.5 text-slate-600" />
                        </button>

                        {/* Preview Affected Workforce */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(p)}
                          title="Preview Affected Workforce"
                          className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200"
                        >
                          <AppIcon name="users" className="w-3.5 h-3.5 text-slate-600" />
                        </button>

                        {isSuperAdmin && (
                          <>
                            {/* Edit / Version Policy */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              title="Edit / Version Policy"
                              className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200"
                            >
                              <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                            </button>

                            {/* Toggle Status */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p)}
                              title={p.status === 'Active' ? 'Deactivate Policy (Archive)' : 'Activate Policy'}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent ${
                                p.status === 'Active'
                                  ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200'
                                  : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200'
                              }`}
                            >
                              <AppIcon
                                name={p.status === 'Active' ? 'pause' : 'play'}
                                className={`w-3.5 h-3.5 ${p.status === 'Active' ? 'text-amber-600' : 'text-emerald-600'}`}
                              />
                            </button>

                            {/* Delete Policy (Always active button with smart safe protection) */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isProtected) {
                                  notify.info(`Policy '${p.id}' is a canonical system policy and protected from hard deletion. You can toggle its status to Inactive instead.`)
                                } else {
                                  setDeleteConfirmPolicy(p)
                                }
                              }}
                              title={isProtected ? "Canonical System Policy (Protected from hard deletion - Use Deactivate)" : "Delete Custom Policy"}
                              className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {activeModal === 'create' ? 'Create Central Company Policy' : `Version Policy: ${targetPolicy?.id}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Super Admin centralized rule definitions with automated conflict checking
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Policy Title</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sales Field Commute & Per-Diem Policy"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Category</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomPolicyCat(!isAddingCustomPolicyCat)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition"
                    >
                      {isAddingCustomPolicyCat ? '✕ Cancel' : '+ Add Custom'}
                    </button>
                  </div>

                  {isAddingCustomPolicyCat ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newPolicyCatName}
                        onChange={(e) => setNewPolicyCatName(e.target.value)}
                        placeholder="e.g. Remote Work, IT Security..."
                        className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPolicyCategory}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shrink-0 transition"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__custom_new__') {
                          setIsAddingCustomPolicyCat(true)
                        } else {
                          setFormData({ ...formData, category: e.target.value })
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                    >
                      {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                      {customPolicyCategories.map((c) => (
                        <option key={c} value={c.toLowerCase()}>
                          {c} (Custom)
                        </option>
                      ))}
                      <option value="__custom_new__">+ Add Custom Category...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Applies To (Precedence)</label>
                  <select
                    value={formData.appliesTo}
                    onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="Company-Wide">Company-Wide (Precedence 4)</option>
                    <option value="Department">Department (Precedence 2)</option>
                    <option value="Role">Role / Designation (Precedence 3)</option>
                    <option value="Employee-Specific">Employee-Specific (Precedence 1)</option>
                  </select>
                </div>
              </div>

              {formData.appliesTo !== 'Company-Wide' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Scope Target Identifier (e.g. DEP-01, EMP-004, manager)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.scopeValue || ''}
                    onChange={(e) => setFormData({ ...formData, scopeValue: e.target.value })}
                    placeholder="Enter Department ID, Employee ID or Role"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description &amp; Intent</label>
                <textarea
                  rows="2"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed regulatory or business rationale for this policy rule..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Allowed Limit / Threshold</label>
                  <input
                    type="number"
                    value={formData.allowedLimit || 0}
                    onChange={(e) => setFormData({ ...formData, allowedLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Calculation Method</label>
                  <select
                    value={formData.calculationMethod}
                    onChange={(e) => setFormData({ ...formData, calculationMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="fixed">Fixed Quantity</option>
                    <option value="cumulative_monthly">Cumulative Monthly</option>
                    <option value="formula">Formula / Slab</option>
                    <option value="tiered">Tiered Hierarchy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom || ''}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={formData.effectiveTo || ''}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Change Reason (Audit Trail)</label>
                <input
                  type="text"
                  required
                  value={formData.changeReason || ''}
                  onChange={(e) => setFormData({ ...formData, changeReason: e.target.value })}
                  placeholder="Mandatory reason for audit preservation..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
                >
                  {activeModal === 'create' ? 'Create Policy' : 'Save Version & Update Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Policy Details Modal */}
      {activeModal === 'view' && targetPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <AppIcon name="eye" className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{targetPolicy.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{targetPolicy.id} • Version {targetPolicy.version}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Policy Category:</span>
                  <span className="font-bold text-slate-900 uppercase font-mono">{targetPolicy.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Precedence & Scope:</span>
                  <span className="font-semibold text-slate-800">
                    P{targetPolicy.precedence || 4}: {targetPolicy.appliesTo || 'Company-Wide'}
                    {targetPolicy.scopeValue !== 'all' ? ` (${targetPolicy.scopeValue})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Rule Type & Limit:</span>
                  <span className="font-mono font-bold text-slate-900 capitalize">
                    {targetPolicy.ruleType} • Limit: {targetPolicy.allowedLimit ?? 'Custom Rules'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Effective Dates:</span>
                  <span className="font-mono text-slate-700">
                    {targetPolicy.effectiveFrom || '2026-01-01'} to {targetPolicy.effectiveTo || '2026-12-31'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Governance Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    targetPolicy.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {targetPolicy.status}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-medium block mb-1">Policy Description:</span>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                  {targetPolicy.description || 'Enterprise governance rule enforced across all workflows.'}
                </div>
              </div>

              {targetPolicy.rules && (
                <div>
                  <span className="text-slate-500 font-medium block mb-1">Configured Rule Specifications:</span>
                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                    {typeof targetPolicy.rules === 'string'
                      ? targetPolicy.rules
                      : JSON.stringify(targetPolicy.rules, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workforce Impact Preview Modal */}
      {activeModal === 'preview' && targetPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Workforce Impact Preview</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Employees directly governed by {targetPolicy.id} ({targetPolicy.name})
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <AppIcon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">Total Governed Workforce:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{(affectedEmployees || []).length} Members</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {(affectedEmployees || []).map((emp) => (
                <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{emp.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {emp.id} • {emp.department}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {emp.designation}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                <AppIcon name="trash" className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Policy Deletion</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action permanently deletes this policy rule.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-semibold text-slate-800">{deleteConfirmPolicy.name}</p>
              <p className="font-mono text-[11px] text-slate-500">
                {deleteConfirmPolicy.id} • {deleteConfirmPolicy.category} • Precedence: P{deleteConfirmPolicy.precedence || 4}
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Are you sure you want to delete this custom policy? Historical logs referencing this rule will be preserved in the audit trail.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmPolicy(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeletePolicy}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
              >
                {isDeleting ? <AppIcon name="spinner" spin className="w-3.5 h-3.5" /> : <AppIcon name="trash" className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Policy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CentralPolicyBuilderTab
