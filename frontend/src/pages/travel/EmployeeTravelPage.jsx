import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import travelService from '@/services/travelService'
import AppIcon from '@/components/common/AppIcon'

import TravelRequestsTable from '@/components/travel/TravelRequestsTable'
import TravelRequestModal from '@/components/travel/TravelRequestModal'
import TravelPlansTable from '@/components/travel/TravelPlansTable'
import TravelExpenseReconModal from '@/components/travel/TravelExpenseReconModal'
import PickAndDropRosterTable from '@/components/travel/PickAndDropRosterTable'
import PickAndDropRequestModal from '@/components/travel/PickAndDropRequestModal'

export default function EmployeeTravelPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'my-trips')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Scoped Data States
  const [requests, setRequests] = useState([])
  const [plans, setPlans] = useState([])
  const [expenses, setExpenses] = useState([])
  const [assignments, setAssignments] = useState([])

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [requestModalEditMode, setRequestModalEditMode] = useState(false)

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)

  const [isPickDropModalOpen, setIsPickDropModalOpen] = useState(false)
  const [assignmentToEdit, setAssignmentToEdit] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)

  const loadData = () => {
    try {
      setRequests(travelService.getTravelRequests({}, user) || [])
    } catch {
      setRequests([])
    }
    try {
      setPlans(travelService.getTravelPlans({}, user) || [])
    } catch {
      setPlans([])
    }
    try {
      setExpenses(travelService.getTravelExpenses({}, user) || [])
    } catch {
      setExpenses([])
    }
    try {
      setAssignments(travelService.getTransportAssignments({}, user) || [])
    } catch {
      setAssignments([])
    }
  }

  useEffect(() => {
    loadData()
    travelService.loadTravelDataAsync().catch((err) => {
      console.error('Failed to hydrate employee travel view from database:', err)
    })
    const unsubscribe = travelService.subscribe(() => {
      loadData()
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const triggerNotice = (msg, type = 'success') => {
    setActionNotice({ msg, type })
    setTimeout(() => setActionNotice(null), 4000)
  }

  const handleCreateRequest = async (reqData) => {
    try {
      const isEdit = Boolean(reqData.existingRequestId)
      const saved = isEdit
        ? await travelService.updateTravelRequestAsync(reqData.existingRequestId, reqData)
        : await travelService.createTravelRequestAsync(reqData, user)
      triggerNotice(
        saved.status === 'Draft'
          ? `Travel draft #${saved.requestId} saved.`
          : `Official travel request #${saved.requestId} submitted for departmental authorization.`
      )
      setIsRequestModalOpen(false)
      setSelectedRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleCancelRequest = async (req) => {
    try {
      await travelService.cancelTravelRequestAsync(req.requestId, user)
      triggerNotice(`Travel request #${req.requestId} cancelled.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleOpenExpenseModal = (req) => {
    const exp = expenses.find((e) => e.requestId === req.requestId)
    if (exp) {
      setSelectedExpense(exp)
      setIsExpenseModalOpen(true)
    }
  }

  const handleSubmitReceipts = async (requestId, data) => {
    try {
      const updated = await travelService.submitExpenseReceiptsAsync(requestId, data, user)
      setSelectedExpense(updated)
      triggerNotice(`Expense claims of Rs. ${data.submittedExpenses} submitted with receipt proofs.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handlePickDropSubmit = async (asnData) => {
    try {
      const created = await travelService.requestPickAndDropAsync(asnData, user)
      triggerNotice(`Shuttle facility application #${created.assignmentId} submitted for HR review.`)
      setIsPickDropModalOpen(false)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="plane" className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'itineraries'
                ? 'Confirmed Itineraries & Tickets'
                : activeTab === 'expenses'
                ? 'Advances & Expense Claims'
                : activeTab === 'transport'
                ? 'My Pick-and-Drop Shuttle Pass'
                : 'My Travel Requests'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'itineraries'
              ? 'View issued tickets, flight/train reservations, hotel accommodation details, and emergency contacts.'
              : activeTab === 'expenses'
              ? 'Track disbursed travel advances, upload trip receipts, and review reconciliation settlements.'
              : activeTab === 'transport'
              ? 'Active commute bus pass, assigned vehicle number, driver contact, and stop timings.'
              : 'Submit business trip requests, manage draft itineraries, and monitor manager authorizations.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedRequest(null)
              setIsRequestModalOpen(true)
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            Request Official Travel
          </button>
          <button
            onClick={() => setIsPickDropModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="bus" className="w-3.5 h-3.5" />
            Apply Pick-and-Drop
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AppIcon
              name={actionNotice.type === 'error' ? 'alertCircle' : 'check'}
              className="w-4 h-4 shrink-0"
            />
            <span>{actionNotice.msg}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-60 hover:opacity-100">
            <AppIcon name="close" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {(activeTab === 'my-trips' || !activeTab) && (
        <TravelRequestsTable
          requests={requests}
          currentUser={user}
          onViewDetails={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(false)
            setIsRequestModalOpen(true)
          }}
          onEditRequest={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(true)
            setIsRequestModalOpen(true)
          }}
          onCancel={handleCancelRequest}
          onManageExpenses={handleOpenExpenseModal}
        />
      )}

      {activeTab === 'itineraries' && (
        <TravelPlansTable
          plans={plans}
          currentUser={user}
          onViewPlan={(plan) => {
            const req = requests.find((r) => r.requestId === plan.requestId)
            if (req) {
              setSelectedRequest(req)
              setRequestModalEditMode(false)
              setIsRequestModalOpen(true)
            }
          }}
        />
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              My Travel Advances & Expense Reimbursements
            </h3>
            <span className="text-xs text-slate-500">{(expenses || []).length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Expense ID</th>
                  <th className="py-3 px-4">Request Ref</th>
                  <th className="py-3 px-4">Approved Budget</th>
                  <th className="py-3 px-4">Advance Paid</th>
                  <th className="py-3 px-4">Submitted Claims</th>
                  <th className="py-3 px-4">Approved Expenses</th>
                  <th className="py-3 px-4">Settlement Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(expenses || []).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      No travel expenses recorded.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.expenseId || exp.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{exp.expenseId}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{exp.requestId}</td>
                      <td className="py-3 px-4">Rs. {(exp.approvedBudget || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-purple-700 font-medium">
                        <div>Rs. {(exp.disbursedAdvance || 0).toLocaleString()}</div>
                        {exp.advanceDisbursedReference && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {exp.advanceDisbursedReference}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        Rs. {(exp.employeeSubmittedExpenses || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        Rs. {(exp.approvedExpenses || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">
                        {exp.settlementBalance > 0
                          ? `+Rs. ${exp.settlementBalance.toLocaleString()} (Due)`
                          : exp.settlementBalance < 0
                          ? `-Rs. ${Math.abs(exp.settlementBalance).toLocaleString()} (Unused)`
                          : 'Rs. 0'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            exp.settlementStatus === 'Settled'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : exp.settlementStatus === 'Pending Final Settlement'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {exp.settlementStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedExpense(exp)
                            setIsExpenseModalOpen(true)
                          }}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded ${
                            exp.settlementStatus === 'Settled'
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {exp.settlementStatus === 'Settled' ? 'View Settled' : 'Submit Claims'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'transport' && (
        <PickAndDropRosterTable
          assignments={assignments}
          currentUser={user}
          onEditAssignment={(asn) => {
            setAssignmentToEdit(asn)
            setIsPickDropModalOpen(true)
          }}
        />
      )}

      {/* Modals */}
      <TravelRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false)
          setSelectedRequest(null)
          setRequestModalEditMode(false)
        }}
        request={selectedRequest}
        initialEditMode={requestModalEditMode}
        currentUser={user}
        onSubmitRequest={handleCreateRequest}
      />

      <TravelExpenseReconModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false)
          setSelectedExpense(null)
        }}
        expenseRecord={selectedExpense}
        currentUser={user}
        onSubmitReceipts={handleSubmitReceipts}
      />

      <PickAndDropRequestModal
        isOpen={isPickDropModalOpen}
        onClose={() => {
          setIsPickDropModalOpen(false)
          setAssignmentToEdit(null)
        }}
        currentUser={user}
        assignment={assignmentToEdit}
        onRequestSubmit={async (asnData) => {
          try {
            await travelService.requestPickAndDropAsync(asnData, user)
            triggerNotice('Pick-and-drop request submitted for approval.')
            setIsPickDropModalOpen(false)
            setAssignmentToEdit(null)
          } catch (err) {
            triggerNotice(err.message, 'error')
            throw err
          }
        }}
        onUpdateAssignment={async (asnId, asnData) => {
          try {
            const updated = await travelService.updateTransportAssignmentAsync(asnId, asnData)
            triggerNotice(`Transport request #${updated.assignmentId} updated successfully.`)
            setIsPickDropModalOpen(false)
            setAssignmentToEdit(null)
          } catch (err) {
            triggerNotice(err.message, 'error')
            throw err
          }
        }}
      />
    </div>
  )
}
