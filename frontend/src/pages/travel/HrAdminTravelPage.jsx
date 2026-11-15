import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import travelService from '@/services/travelService'
import AppIcon from '@/components/common/AppIcon'

import TravelSummaryCards from '@/components/travel/TravelSummaryCards'
import TravelRequestsTable from '@/components/travel/TravelRequestsTable'
import TravelRequestModal from '@/components/travel/TravelRequestModal'
import TravelPlansTable from '@/components/travel/TravelPlansTable'
import TravelPlanModal from '@/components/travel/TravelPlanModal'
import TravelExpenseReconModal from '@/components/travel/TravelExpenseReconModal'
import PickAndDropRosterTable from '@/components/travel/PickAndDropRosterTable'
import PickAndDropRequestModal from '@/components/travel/PickAndDropRequestModal'
import TransportRoutesTable from '@/components/travel/TransportRoutesTable'
import TransportRouteModal from '@/components/travel/TransportRouteModal'
import FleetMasterModal from '@/components/travel/FleetMasterModal'

export default function HrAdminTravelPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'requests')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Data States
  const [kpis, setKpis] = useState({})
  const [requests, setRequests] = useState([])
  const [plans, setPlans] = useState([])
  const [expenses, setExpenses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [routes, setRoutes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])

  // Modal States
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [requestModalEditMode, setRequestModalEditMode] = useState(false)

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [planTargetRequest, setPlanTargetRequest] = useState(null)
  const [planToEdit, setPlanToEdit] = useState(null)

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)

  const [isPickDropModalOpen, setIsPickDropModalOpen] = useState(false)
  const [assignmentToEdit, setAssignmentToEdit] = useState(null)
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false)
  const [routeToEdit, setRouteToEdit] = useState(null)
  const [fleetModalMode, setFleetModalMode] = useState(null)

  const [actionNotice, setActionNotice] = useState(null)

  const loadData = () => {
    try {
      setKpis(travelService.getTravelKPIs(user) || {})
    } catch {
      setKpis({})
    }
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
    try {
      setRoutes(travelService.getRoutes() || [])
      setVehicles(travelService.getVehicles() || [])
      setDrivers(travelService.getDrivers() || [])
    } catch {
      setRoutes([])
    }
  }

  useEffect(() => {
    loadData()
    travelService.loadTravelDataAsync().catch((err) => {
      console.error('Failed to hydrate HR travel view from database:', err)
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

  // Request & Plan handlers
  const handleCreateRequest = async (reqData) => {
    try {
      const isEdit = Boolean(reqData.existingRequestId)
      const saved = isEdit
        ? await travelService.updateTravelRequestAsync(reqData.existingRequestId, reqData)
        : await travelService.createTravelRequestAsync(reqData, user)
      triggerNotice(
        saved.status === 'Draft'
          ? `Travel draft #${saved.requestId} saved.`
          : `Travel request #${saved.requestId} logged successfully.`
      )
      setIsRequestModalOpen(false)
      setSelectedRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleApproveRequest = async (req) => {
    try {
      await travelService.approveTravelRequestAsync(req.requestId, user, 'HR / Administrative Review & Approval')
      triggerNotice(`Travel request #${req.requestId} approved. Field duty ref generated for F04.`)
      setIsRequestModalOpen(false)
      setSelectedRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleRejectRequest = async (req, reason) => {
    try {
      await travelService.rejectTravelRequestAsync(req.requestId, user, reason)
      triggerNotice(`Travel request #${req.requestId} rejected.`, 'error')
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

  const handleCreatePlan = async (planData) => {
    try {
      const plan = await travelService.createTravelPlanAsync(planData, user)
      triggerNotice(`Official travel plan #${plan.planId} logged with PNR ${plan.bookingReference}.`)
      setIsPlanModalOpen(false)
      setPlanTargetRequest(null)
      setPlanToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleUpdatePlan = async (planId, planData) => {
    try {
      const updated = await travelService.updateTravelPlanAsync(planId, planData)
      triggerNotice(`Travel plan #${updated.planId} updated successfully.`)
      setIsPlanModalOpen(false)
      setPlanToEdit(null)
      setPlanTargetRequest(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleUpdatePlanStatus = async (planId, status) => {
    try {
      await travelService.updateTravelPlanStatusAsync(planId, status, user)
      triggerNotice(`Travel plan #${planId} updated to '${status}'.`)
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

  const handleDisburseAdvance = async (requestId, data) => {
    try {
      const updated = await travelService.disburseAdvanceAsync(requestId, data, user)
      setSelectedExpense(updated)
      triggerNotice(`Advance of Rs. ${data.disbursedAmount} recorded under voucher ${data.voucherReference}.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleSubmitReceipts = async (requestId, data) => {
    try {
      const updated = await travelService.submitExpenseReceiptsAsync(requestId, data, user)
      setSelectedExpense(updated)
      triggerNotice(`Expense claims of Rs. ${data.submittedExpenses} recorded.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleReconcileExpenses = async (requestId, data) => {
    try {
      const updated = await travelService.reconcileTravelExpenseAsync(requestId, data, user)
      setSelectedExpense(updated)
      triggerNotice(`Travel expense reconciled. Settlement status: ${updated.settlementStatus}.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handlePickDropSubmit = async (asnData) => {
    try {
      const created = await travelService.requestPickAndDropAsync(asnData, user)
      triggerNotice(`Transport assignment #${created.assignmentId} created on ${created.routeName}.`)
      setIsPickDropModalOpen(false)
      setAssignmentToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleUpdateAssignment = async (asnId, asnData) => {
    try {
      const updated = await travelService.updateTransportAssignmentAsync(asnId, asnData)
      triggerNotice(`Transport assignment #${updated.assignmentId} updated successfully.`)
      setIsPickDropModalOpen(false)
      setAssignmentToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleAssignmentStatus = async (asnId, status) => {
    try {
      await travelService.updateTransportAssignmentStatusAsync(asnId, status, user)
      triggerNotice(`Transport facility #${asnId} updated to '${status}'.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleSaveRoute = async (routeData) => {
    try {
      const saved = await travelService.saveRouteAsync(routeData, user)
      triggerNotice(`Transport route '${saved.routeName}' updated.`)
      setIsRouteModalOpen(false)
      setRouteToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleSaveFleetMaster = async (fleetData) => {
    if (fleetModalMode === 'vehicle') {
      const saved = await travelService.saveVehicleAsync(fleetData, user)
      triggerNotice(`Fleet vehicle '${saved.vehicleName}' (${saved.vehicleId}) saved.`)
    } else {
      const saved = await travelService.saveDriverAsync(fleetData, user)
      triggerNotice(`Driver '${saved.driverName}' (${saved.driverId}) saved.`)
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
              {activeTab === 'plans'
                ? 'Confirmed Travel Plans'
                : activeTab === 'expenses'
                ? 'Advances & Incurred Claims'
                : activeTab === 'transport'
                ? 'Pick-and-Drop Roster'
                : activeTab === 'routes'
                ? 'Routes & Fleet Capacity'
                : 'Travel Requests & Processing'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'plans'
              ? 'Confirmed itineraries, ticketing, hotel reservations, and travel scheduling.'
              : activeTab === 'expenses'
              ? 'Disburse approved travel advances, collect receipts, and reconcile expenses.'
              : activeTab === 'transport'
              ? 'Assign employees to pick-and-drop shuttles, maintain stops, and supervise commutes.'
              : activeTab === 'routes'
              ? 'Monitor route allocations, van drivers, and seating capacity.'
              : 'HR Operational Desk: Official Travel Logistics, Itineraries, Advances, Shuttle Roster & Routes.'}
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
            New Travel Request
          </button>
          <button
            onClick={() => setIsPickDropModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="bus" className="w-3.5 h-3.5" />
            Assign Transport
          </button>
          <button
            onClick={() => {
              setRouteToEdit(null)
              setIsRouteModalOpen(true)
            }}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <AppIcon name="route" className="w-3.5 h-3.5" />
            Add Route
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

      <TravelSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {(activeTab === 'requests' || activeTab === 'overview' || !activeTab) && (
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
          onApprove={handleApproveRequest}
          onReject={(req) => {
            setSelectedRequest(req)
            setRequestModalEditMode(false)
            setIsRequestModalOpen(true)
          }}
          onCancel={handleCancelRequest}
          onCreatePlan={(req) => {
            setPlanToEdit(null)
            setPlanTargetRequest(req)
            setIsPlanModalOpen(true)
          }}
          onManageExpenses={handleOpenExpenseModal}
        />
      )}

      {activeTab === 'plans' && (
        <TravelPlansTable
          plans={plans}
          currentUser={user}
          onUpdateStatus={handleUpdatePlanStatus}
          onViewPlan={(plan) => {
            const req = requests.find((r) => r.requestId === plan.requestId)
            if (req) {
              setSelectedRequest(req)
              setRequestModalEditMode(false)
              setIsRequestModalOpen(true)
            }
          }}
          onEditPlan={(plan) => {
            setPlanToEdit(plan)
            setPlanTargetRequest(null)
            setIsPlanModalOpen(true)
          }}
        />
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Travel Advances & Incurred Claims Ledger
            </h3>
            <span className="text-xs text-slate-500">{expenses.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Expense ID</th>
                  <th className="py-3 px-4">Request Ref</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Approved Budget</th>
                  <th className="py-3 px-4">Disbursed Advance</th>
                  <th className="py-3 px-4">Claimed Receipts</th>
                  <th className="py-3 px-4">Approved Expenses</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
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
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{exp.employeeName}</div>
                        <div className="text-[11px] text-slate-500">{exp.department}</div>
                      </td>
                      <td className="py-3 px-4 font-medium">Rs. {(exp.approvedBudget || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-purple-700 font-medium">
                        <div>Rs. {(exp.disbursedAdvance || 0).toLocaleString()}</div>
                        {exp.advanceDisbursedReference && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {exp.advanceDisbursedReference}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">Rs. {(exp.employeeSubmittedExpenses || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        Rs. {(exp.approvedExpenses || 0).toLocaleString()}
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
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          }`}
                        >
                          {exp.settlementStatus === 'Settled' ? 'View Settled' : 'Reconcile'}
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
          onApprove={(id) => handleAssignmentStatus(id, 'Active')}
          onSuspend={(id) => handleAssignmentStatus(id, 'Suspended')}
          onActivate={(id) => handleAssignmentStatus(id, 'Active')}
          onCancel={(id) => handleAssignmentStatus(id, 'Cancelled')}
        />
      )}

      {activeTab === 'routes' && (
        <div className="space-y-6">
          <TransportRoutesTable
            routes={routes}
            currentUser={user}
            onEditRoute={(r) => {
              setRouteToEdit(r)
              setIsRouteModalOpen(true)
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase mb-3 flex items-center justify-between">
                <span>Fleet Vehicles Master ({vehicles.length})</span>
                <button
                  type="button"
                  onClick={() => setFleetModalMode('vehicle')}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-semibold normal-case flex items-center gap-1"
                >
                  <AppIcon name="plus" className="w-3 h-3" />
                  Add Vehicle
                </button>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {vehicles.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No vehicles registered yet.</p>
                ) : (
                  vehicles.map((v) => (
                    <div
                      key={v.vehicleId}
                      className="p-2.5 bg-slate-50 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{v.vehicleName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {v.vehicleId} • {v.registrationNumber} • {v.vehicleType}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-700">{v.capacity} Seats</span>
                        <div className="text-[10px] text-emerald-600 font-medium">{v.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase mb-3 flex items-center justify-between">
                <span>Authorized Fleet Drivers ({drivers.length})</span>
                <button
                  type="button"
                  onClick={() => setFleetModalMode('driver')}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[11px] font-semibold normal-case flex items-center gap-1"
                >
                  <AppIcon name="plus" className="w-3 h-3" />
                  Add Driver
                </button>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {drivers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No drivers registered yet.</p>
                ) : (
                  drivers.map((d) => (
                    <div
                      key={d.driverId}
                      className="p-2.5 bg-slate-50 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{d.driverName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {d.driverId} • {d.contactNumber}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-600">{d.assignedVehicleName}</span>
                        <div className="text-[10px] text-emerald-600 font-medium">{d.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
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
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />

      <TravelPlanModal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false)
          setPlanTargetRequest(null)
          setPlanToEdit(null)
        }}
        travelRequest={planTargetRequest}
        plan={planToEdit}
        onCreatePlan={handleCreatePlan}
        onUpdatePlan={handleUpdatePlan}
      />

      <TravelExpenseReconModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false)
          setSelectedExpense(null)
        }}
        expenseRecord={selectedExpense}
        currentUser={user}
        onDisburseAdvance={handleDisburseAdvance}
        onSubmitReceipts={handleSubmitReceipts}
        onReconcile={handleReconcileExpenses}
      />

      <PickAndDropRequestModal
        isOpen={isPickDropModalOpen}
        onClose={() => {
          setIsPickDropModalOpen(false)
          setAssignmentToEdit(null)
        }}
        currentUser={user}
        assignment={assignmentToEdit}
        onRequestSubmit={handlePickDropSubmit}
        onUpdateAssignment={handleUpdateAssignment}
      />

      <TransportRouteModal
        isOpen={isRouteModalOpen}
        onClose={() => {
          setIsRouteModalOpen(false)
          setRouteToEdit(null)
        }}
        routeToEdit={routeToEdit}
        onSaveRoute={handleSaveRoute}
      />

      <FleetMasterModal
        isOpen={Boolean(fleetModalMode)}
        onClose={() => setFleetModalMode(null)}
        mode={fleetModalMode || 'vehicle'}
        vehicles={vehicles}
        onSave={handleSaveFleetMaster}
      />
    </div>
  )
}
