import React, { useState, useEffect } from 'react'
import { expenseService } from '@/services/expenseService'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'

export function ExpenseClaimModal({ isOpen, onClose, currentUser, onSuccess }) {
  const [categories, setCategories] = useState(() => expenseService.getExpenseCategories(true))
  const [travelRequests, setTravelRequests] = useState(() => expenseService.getAvailableTravelRequests(currentUser))

  const roleLower = String(currentUser?.role || '').toLowerCase()
  const isHrOrSuper = roleLower === 'super_admin' || roleLower === 'hr_admin'

  const [formData, setFormData] = useState({
    categoryId: categories[0]?.categoryId || categories[0]?.code || 'MEALS',
    expenseDate: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
    receiptReference: '',
    receiptFileName: '',
    projectClient: '',
    relatedTravelRequestId: '',
    paymentMethodUsed: 'Cash'
  })

  const [errorMessage, setErrorMessage] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingCustomCat, setIsAddingCustomCat] = useState(false)
  const [customCatName, setCustomCatName] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const syncLists = () => {
      const activeCats = expenseService.getExpenseCategories(true)
      setCategories(activeCats)
      setTravelRequests(expenseService.getAvailableTravelRequests(currentUser))
      setFormData((prev) => {
        const hasMatch = activeCats.some((c) => (c.categoryId || c.code) === prev.categoryId)
        if (hasMatch || activeCats.length === 0) return prev
        return { ...prev, categoryId: activeCats[0].categoryId || activeCats[0].code }
      })
    }
    syncLists()
    if (expenseService.getExpenseCategories().length === 0) {
      expenseService.loadExpensesDataAsync().catch(() => {})
    }
    const unsub = expenseService.subscribe(syncLists)
    return () => unsub()
  }, [isOpen, currentUser])

  if (!isOpen) return null

  const selectedCategory =
    categories.find((c) => (c.categoryId || c.code) === formData.categoryId) || categories[0]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrorMessage(null)
  }

  const handleCreateCustomCategory = async () => {
    const trimmed = (customCatName || '').trim()
    if (!trimmed) return
    try {
      const created = await expenseService.addExpenseCategoryAsync(
        { categoryName: trimmed },
        currentUser?.name || 'Administrator'
      )
      setFormData((prev) => ({ ...prev, categoryId: created.categoryId || created.code }))
      setIsAddingCustomCat(false)
      setCustomCatName('')
    } catch (err) {
      setErrorMessage(err.message)
    }
  }

  const handleFakeFileAttach = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({
        ...prev,
        receiptFileName: file.name,
        receiptReference: `REC-${Date.now().toString().slice(-6)}-${file.name}`
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await expenseService.createExpenseClaimAsync(
        {
          ...formData,
          categoryId: selectedCategory?.code || selectedCategory?.categoryId || formData.categoryId,
          category: selectedCategory?.categoryName || selectedCategory?.name || formData.categoryId,
          employeeId: currentUser?.employeeId || currentUser?.id,
          employeeName: currentUser?.name || 'Staff Member',
          department: currentUser?.department?.name || currentUser?.department || 'Operations'
        },
        currentUser
      )

      setFormData((prev) => ({
        ...prev,
        amount: '',
        description: '',
        receiptReference: '',
        receiptFileName: '',
        projectClient: '',
        relatedTravelRequestId: ''
      }))
      setIsSubmitting(false)
      onSuccess?.()
      onClose()
    } catch (err) {
      setIsSubmitting(false)
      setErrorMessage(err.message || 'Failed to submit expense claim.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
              <AppIcon name="payroll" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Submit New Expense Claim</h3>
              <p className="text-xs text-slate-500">Corporate expense reimbursement request with policy validation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <Alert variant="danger" title="Validation Error">
              {errorMessage}
            </Alert>
          )}

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Expense Category <span className="text-rose-500">*</span>
                </label>
                {isHrOrSuper && (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCat(!isAddingCustomCat)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    {isAddingCustomCat ? '✕ Cancel' : '+ Add Custom'}
                  </button>
                )}
              </div>

              {isAddingCustomCat && isHrOrSuper ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customCatName}
                    onChange={(e) => setCustomCatName(e.target.value)}
                    placeholder="e.g. Software Licenses, Client Dinner..."
                    className="flex-1 text-xs px-2.5 py-1.5 border border-blue-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomCategory}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={(e) => {
                    if (e.target.value === '__custom_new__') {
                      setIsAddingCustomCat(true)
                    } else {
                      handleChange(e)
                    }
                  }}
                  required
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.categoryId || c.code} value={c.categoryId || c.code}>
                      {c.categoryName || c.name} (Cap: PKR {Number(c.perClaimLimit ?? c.maxLimit ?? 0).toLocaleString()})
                    </option>
                  ))}
                  {isHrOrSuper && <option value="__custom_new__">+ Add Custom Category...</option>}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="expenseDate"
                value={formData.expenseDate}
                onChange={handleChange}
                required
                max={new Date().toISOString().slice(0, 10)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Amount (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="1"
                placeholder="e.g. 14500"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              {selectedCategory && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Policy Limit: PKR {Number(selectedCategory.perClaimLimit ?? selectedCategory.maxLimit ?? 0).toLocaleString()} |{' '}
                  {selectedCategory.receiptRequiredThreshold !== undefined
                    ? `Receipt Required >= PKR ${Number(selectedCategory.receiptRequiredThreshold).toLocaleString()}`
                    : selectedCategory.receiptRequired
                      ? 'Receipt Required'
                      : 'Receipt Optional'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method Used <span className="text-rose-500">*</span>
              </label>
              <select
                name="paymentMethodUsed"
                value={formData.paymentMethodUsed}
                onChange={handleChange}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Cash">Cash</option>
                <option value="Personal Credit Card">Personal Credit Card</option>
                <option value="Personal Debit Card">Personal Debit Card</option>
                <option value="Corporate Advance">Drawn from Corporate Travel Advance</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Business Purpose & Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={2}
              placeholder="State the explicit official reason and commercial justification..."
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Receipt Reference & File Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receipt / Invoice Reference
              </label>
              <input
                type="text"
                name="receiptReference"
                value={formData.receiptReference}
                onChange={handleChange}
                placeholder="e.g. REC-SHELL-7821.pdf"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Attach Demo Receipt
              </label>
              <input
                type="file"
                onChange={handleFakeFileAttach}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-slate-500"
              />
              {formData.receiptFileName && (
                <span className="text-[10px] text-emerald-600 block mt-1 font-medium">
                  ✓ Attached: {formData.receiptFileName}
                </span>
              )}
            </div>
          </div>

          {/* Project / Client & Travel Request Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project / Client Reference (Optional)
              </label>
              <input
                type="text"
                name="projectClient"
                value={formData.projectClient}
                onChange={handleChange}
                placeholder="e.g. HBL Core Banking Portal"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Related Travel Request (F10 Bridge)
              </label>
              <select
                name="relatedTravelRequestId"
                value={formData.relatedTravelRequestId}
                onChange={handleChange}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None (Independent Local Expense)</option>
                {travelRequests.map((t) => (
                  <option key={t.requestId} value={t.requestId}>
                    {t.requestId} — {t.destination} ({t.departureDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <AppIcon name="check" className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Validating...' : 'Submit Claim'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ExpenseClaimModal
