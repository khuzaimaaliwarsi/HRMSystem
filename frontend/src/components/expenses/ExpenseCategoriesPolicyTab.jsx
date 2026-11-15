import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/useAuth'
import { expenseService } from '@/services/expenseService'

export function ExpenseCategoriesPolicyTab() {
  const { user: authUser } = useAuth()
  const roleNormalized = String(authUser?.role || '').trim().toLowerCase()
  const isHrOrSuper = roleNormalized === 'super_admin' || roleNormalized === 'hr_admin'

  const [categories, setCategories] = useState(() => expenseService.getExpenseCategories())
  const [limits, setLimits] = useState(() => expenseService.getFinancialAuthorityLimits())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [newCat, setNewCat] = useState({
    categoryName: '',
    code: '',
    description: '',
    perClaimLimit: 15000,
    monthlyLimit: 50000,
    dailyLimit: 15000,
    receiptRequiredThreshold: 1000,
    requiresTravelRequestRef: false
  })

  useEffect(() => {
    const unsub = expenseService.subscribe(() => {
      setCategories(expenseService.getExpenseCategories())
      setLimits(expenseService.getFinancialAuthorityLimits())
    })
    return () => unsub()
  }, [])

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      await expenseService.addExpenseCategoryAsync({
        ...newCat,
        perClaimLimit: Number(newCat.perClaimLimit),
        monthlyLimit: Number(newCat.monthlyLimit),
        dailyLimit: Number(newCat.dailyLimit),
        receiptRequiredThreshold: Number(newCat.receiptRequiredThreshold)
      })
      setIsModalOpen(false)
      setNewCat({
        categoryName: '',
        code: '',
        description: '',
        perClaimLimit: 15000,
        monthlyLimit: 50000,
        dailyLimit: 15000,
        receiptRequiredThreshold: 1000,
        requiresTravelRequestRef: false
      })
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add custom expense category.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Financial Authority Matrix Snapshot */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Configured Financial Authority Matrix</h3>
        <p className="text-xs text-slate-500 mt-0.5">Hierarchical approval threshold boundaries governing corporate claims</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              TIER 1: MANAGER AUTHORITY
            </span>
            <span className="text-xl font-black text-slate-900 mt-1 block font-mono">
              {Number(limits?.managerMaxLimit || 0) > 0 ? `≤ PKR ${Number(limits.managerMaxLimit).toLocaleString()}` : 'PKR 0'}
            </span>
            <p className="text-[11px] text-slate-600 mt-1">
              Direct reports operational expenses within approved departmental allocation. Cannot approve own claims.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
              TIER 2: HR / ADMIN AUTHORITY
            </span>
            <span className="text-xl font-black text-slate-900 mt-1 block font-mono">
              {Number(limits?.hrAdminMaxLimit || 0) > 0 ? `≤ PKR ${Number(limits.hrAdminMaxLimit).toLocaleString()}` : 'PKR 0'}
            </span>
            <p className="text-[11px] text-slate-600 mt-1">
              Company-wide employee claims, Manager personal claims, and intercity travel reimbursements.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
              TIER 3: SUPER ADMIN / MD
            </span>
            <span className="text-xl font-black text-slate-900 mt-1 block font-mono">
              {Number(limits?.superAdminThreshold || 0) > 0 ? `> PKR ${Number(limits.superAdminThreshold).toLocaleString()}` : 'PKR 0'}
            </span>
            <p className="text-[11px] text-slate-600 mt-1">
              High-value capital expenditures, executive summits, policy exceptions, and protected administrative claims.
            </p>
          </div>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Standard Expense Categories &amp; Policy Ceilings</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authoritative limits enforced at client-side validation and service layer</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {categories.length} Categories Active
            </span>
            {isHrOrSuper && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                + Add Custom Category
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-4 py-3">Category Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Per-Claim Cap</th>
                <th className="px-4 py-3 text-right">Monthly Cap</th>
                <th className="px-4 py-3 text-right">Daily Split Cap</th>
                <th className="px-4 py-3 text-right">Receipt Required</th>
                <th className="px-4 py-3 text-center">F10 Travel Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                    No expense categories configured yet.
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.categoryId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-slate-900">
                    {c.categoryName}
                    <span className="block text-[11px] text-slate-400 font-normal mt-0.5 max-w-sm">
                      {c.description}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-500 font-semibold">
                    {c.code}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-700">
                    PKR {Number(c.perClaimLimit ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                    PKR {Number(c.monthlyLimit ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                    PKR {Number(c.dailyLimit ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                    {c.receiptRequiredThreshold !== undefined && c.receiptRequiredThreshold !== null
                      ? `≥ PKR ${Number(c.receiptRequiredThreshold).toLocaleString()}`
                      : (c.receiptRequired ? 'Always' : 'Optional')}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.requiresTravelRequestRef ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Required
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create Custom Expense Category</h3>
                <p className="text-[11px] text-slate-500">Configure corporate ceilings, caps, and verification parameters</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddCategory} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newCat.categoryName}
                    onChange={(e) => setNewCat({ ...newCat, categoryName: e.target.value })}
                    placeholder="e.g. Software Subscriptions"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={newCat.code}
                    onChange={(e) => setNewCat({ ...newCat, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SOFT"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newCat.description}
                  onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                  placeholder="Policy scope & eligible items"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Per-Claim Cap (PKR)</label>
                  <input
                    type="number"
                    min="100"
                    value={newCat.perClaimLimit}
                    onChange={(e) => setNewCat({ ...newCat, perClaimLimit: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Monthly Cap (PKR)</label>
                  <input
                    type="number"
                    min="100"
                    value={newCat.monthlyLimit}
                    onChange={(e) => setNewCat({ ...newCat, monthlyLimit: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Receipt Req. Above</label>
                  <input
                    type="number"
                    min="0"
                    value={newCat.receiptRequiredThreshold}
                    onChange={(e) => setNewCat({ ...newCat, receiptRequiredThreshold: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="travelLink"
                  checked={newCat.requiresTravelRequestRef}
                  onChange={(e) => setNewCat({ ...newCat, requiresTravelRequestRef: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="travelLink" className="text-xs text-slate-700 font-medium">
                  Requires Approved Travel Request Reference (F10)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpenseCategoriesPolicyTab
