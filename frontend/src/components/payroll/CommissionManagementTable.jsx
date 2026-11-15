import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import { commissionService } from '@/services/commissionService'
import { employeeService } from '@/services/employeeService'

export function CommissionManagementTable({
  canRecord = false,
  currentUser = null
}) {
  const plans = commissionService.getPlans()
  const transactions = commissionService.getTransactions({}, currentUser)
  const salesEmployees = employeeService.getEmployees().filter((e) => e.department === 'Sales & Business')

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState(salesEmployees[0]?.id || 'EMP-007')
  const [sourceRef, setSourceRef] = useState('')
  const [clientName, setClientName] = useState('')
  const [dealAmount, setDealAmount] = useState('500000')
  const [planId, setPlanId] = useState(plans[0]?.id || 'CMP-001')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleRecord = (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const emp = salesEmployees.find((e) => e.id === employeeId)
      commissionService.recordCommission({
        employeeId,
        employeeName: emp ? emp.name : employeeId,
        planId,
        sourceRef,
        clientName,
        dealAmount: Number(dealAmount),
        period: '2026-10'
      })
      setSuccess(`Commission for deal '${sourceRef}' successfully recorded and scheduled for payroll!`)
      setIsRecordModalOpen(false)
      setSourceRef('')
      setClientName('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleReverse = (txId) => {
    if (window.confirm('Are you sure you want to reverse this commission due to customer refund or cancellation?')) {
      try {
        commissionService.reverseCommission(txId, 'Customer refund / deal cancellation')
      } catch (err) {
        alert(err.message)
      }
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Commission Plans */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
              <AppIcon name="award" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Sales Commission Structures &amp; Policy Plans
              </h3>
              <p className="text-xs text-slate-500">
                Qualifying source event definitions (Collected Payment, Issued Invoice) with duplicate prevention
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Plan Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Qualifying Source Basis</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3 text-right">Commission Rate</th>
                <th className="px-4 py-3">Approved Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-sans font-bold text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 font-sans">Sales &amp; Business</td>
                  <td className="px-4 py-3 font-sans">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {p.qualifyingSource}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-sans">{p.model}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">{p.ratePercent}% of revenue</td>
                  <td className="px-4 py-3 font-sans text-slate-500">{p.approvedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Verified Commission Subledger</h3>
            <p className="text-xs text-slate-500">Qualifying source transactions verified and posted to monthly payroll runs</p>
          </div>

          {canRecord && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => setIsRecordModalOpen(true)}
              className="text-xs bg-navy-800 hover:bg-navy-900 text-white font-bold cursor-pointer"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5 mr-1" />
              <span>Record Verified Deal</span>
            </Button>
          )}
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold border-b border-emerald-100">
            {success}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Sales Personnel</th>
                <th className="px-4 py-3">Source Ref / Invoice</th>
                <th className="px-4 py-3">Client Deal</th>
                <th className="px-4 py-3 text-right">Deal Amount</th>
                <th className="px-4 py-3 text-right">Commission Rate</th>
                <th className="px-4 py-3 text-right text-emerald-800">Commission Earned</th>
                <th className="px-4 py-3">Payroll Period</th>
                <th className="px-4 py-3">Status</th>
                {canRecord && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-sans">
                    <div className="font-bold text-slate-900">{tx.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{tx.employeeId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {tx.sourceRef}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-sans text-slate-800 font-medium">{tx.clientName}</td>
                  <td className="px-4 py-3 text-right text-slate-700 font-bold">
                    PKR {(tx.dealAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{tx.ratePercent}%</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-800 bg-emerald-50/50">
                    PKR {(tx.commissionAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-sans text-slate-600">{tx.period}</td>
                  <td className="px-4 py-3 font-sans">
                    <StatusBadge status={tx.status} />
                  </td>
                  {canRecord && (
                    <td className="px-4 py-3 text-right font-sans">
                      {tx.status === 'Approved' && (
                        <button
                          type="button"
                          onClick={() => handleReverse(tx.id)}
                          className="px-2 py-0.5 rounded text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-[10px] cursor-pointer"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan={canRecord ? 9 : 8} className="px-4 py-8 text-center text-slate-400 font-sans text-xs">
                    No sales commission transactions recorded for this scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Deal Modal */}
      {isRecordModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 text-left">
            <h3 className="text-base font-bold text-slate-900">Record Verified Commission Deal</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Enter verified client collection invoice. Duplicate references are rejected by policy.
            </p>

            {error && (
              <div className="p-3 mb-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleRecord} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Sales Specialist</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  {salesEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id}) — {emp.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Qualifying Source Reference (Invoice #) *</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-9042"
                  value={sourceRef}
                  onChange={(e) => setSourceRef(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Client Entity Name</label>
                <input
                  type="text"
                  placeholder="e.g. Faysal Bank Tech Group"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Verified Realized Deal Value (PKR) *</label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={dealAmount}
                  onChange={(e) => setDealAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Commission Rate Plan</label>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.ratePercent}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-navy-800 text-white font-bold cursor-pointer">
                  Save &amp; Post Commission
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default CommissionManagementTable
