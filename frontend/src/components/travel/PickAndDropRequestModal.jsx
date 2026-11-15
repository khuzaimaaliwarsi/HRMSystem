import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import travelService from '@/services/travelService'
import employeeService from '@/services/employeeService'

export default function PickAndDropRequestModal({
  isOpen,
  onClose,
  currentUser = null,
  assignment = null,
  onRequestSubmit,
  onUpdateAssignment
}) {
  const isEditMode = Boolean(assignment)
  const isHRorSuper =
    currentUser?.role === 'super_admin' || currentUser?.role === 'hr_admin'

  const [employees, setEmployees] = useState([])
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)

  const [formData, setFormData] = useState({
    employeeId: currentUser?.employeeId || currentUser?.id || 'EMP-001',
    routeId: '',
    pickupPoint: '',
    dropPoint: 'iSysware HQ Tech Park',
    pickupTime: '07:45 AM',
    facilityType: 'Company Subsidized',
    monthlyContribution: 3000,
    effectiveFrom: new Date().toISOString().slice(0, 10)
  })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      try {
        const rList = (travelService.getRoutes() || []).filter((r) => r.status === 'Active')
        setRoutes(rList)
        if (assignment) {
          const matchedRoute = rList.find((r) => r.routeId === assignment.routeId) || rList[0] || null
          setSelectedRoute(matchedRoute)
          setFormData({
            employeeId: assignment.employeeId || currentUser?.employeeId || currentUser?.id || 'EMP-001',
            routeId: assignment.routeId || matchedRoute?.routeId || '',
            pickupPoint: assignment.pickupPoint || '',
            dropPoint: assignment.dropPoint || 'iSysware HQ Tech Park',
            pickupTime: assignment.pickupTime || matchedRoute?.morningDepartureTime || '07:45 AM',
            facilityType: assignment.facilityType || 'Company Subsidized',
            monthlyContribution: assignment.monthlyContribution ?? 3000,
            effectiveFrom: assignment.effectiveFrom || new Date().toISOString().slice(0, 10)
          })
        } else if (rList.length > 0) {
          const first = rList[0]
          setSelectedRoute(first)
          setFormData({
            employeeId: currentUser?.employeeId || currentUser?.id || 'EMP-001',
            routeId: first.routeId,
            pickupPoint: first.pickupPoints?.[0] || 'Gulshan Chowrangi',
            dropPoint: first.dropPoint || 'iSysware HQ Tech Park',
            pickupTime: first.morningDepartureTime || '07:45 AM',
            facilityType: 'Company Subsidized',
            monthlyContribution: 3000,
            effectiveFrom: new Date().toISOString().slice(0, 10)
          })
        }
      } catch {
        setRoutes([])
      }

      if (isHRorSuper) {
        const syncEmps = () => {
          try {
            const emps = employeeService.getAllEmployees() || []
            setEmployees(emps.filter((e) => e.status === 'Active'))
          } catch {
            setEmployees([])
          }
        }
        syncEmps()
        if (typeof employeeService.loadEmployeesAsync === 'function') {
          employeeService.loadEmployeesAsync().then(syncEmps).catch(() => {})
        }
      }
      setErrorMsg('')
    }
  }, [isOpen, isHRorSuper, currentUser, assignment])

  if (!isOpen) return null

  const handleRouteChange = (e) => {
    const rId = e.target.value
    const found = routes.find((r) => r.routeId === rId)
    setSelectedRoute(found || null)
    setFormData((prev) => ({
      ...prev,
      routeId: rId,
      pickupPoint: found?.pickupPoints?.[0] || '',
      pickupTime: found?.morningDepartureTime || '07:45 AM'
    }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    try {
      if (!formData.routeId) {
        throw new Error('Please select an active transport route.')
      }
      if (!formData.pickupPoint.trim()) {
        throw new Error('Pickup location or stop name is required.')
      }

      const isSwitchingToAnotherRoute = isEditMode ? formData.routeId !== assignment.routeId : true
      const needsCapacityCheck = isSwitchingToAnotherRoute && (!isEditMode || assignment.status === 'Active')
      if (needsCapacityCheck && selectedRoute && selectedRoute.assignedCount >= selectedRoute.capacity) {
        throw new Error(
          `Route '${selectedRoute.routeName}' is at full capacity (${selectedRoute.capacity}/${selectedRoute.capacity} passengers). Please choose another route or contact Transport Admin.`
        )
      }

      if (isEditMode && onUpdateAssignment) {
        await onUpdateAssignment(assignment.assignmentId, formData)
      } else {
        await onRequestSubmit(formData)
      }
      onClose()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const isSwitchingRoute = isEditMode ? formData.routeId !== assignment.routeId : true
  const isFull =
    isSwitchingRoute &&
    (!isEditMode || assignment?.status === 'Active') &&
    selectedRoute &&
    selectedRoute.assignedCount >= selectedRoute.capacity

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <AppIcon name="bus" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditMode ? `Edit Pick-and-Drop — ${assignment.assignmentId}` : 'Request Pick-and-Drop Facility'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditMode
                  ? `Update route assignment or boarding stop for ${assignment.employeeName}`
                  : 'Enroll in company shuttle routes with scheduled stops'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Employee Selection */}
            {isHRorSuper && !isEditMode ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enrolling Employee *
                </label>
                <select
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  {employees.map((e) => (
                    <option key={e.employeeId || e.id} value={e.employeeId || e.id}>
                      {e.name} ({e.employeeId || e.id}) • {e.department}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="font-semibold text-slate-800">
                  {isEditMode ? 'Assigned Employee: ' : 'Requesting For: '}
                </span>
                <span className="text-slate-600">
                  {isEditMode
                    ? `${assignment.employeeName} (${assignment.employeeId}) • ${assignment.department}`
                    : `${currentUser?.name} (${currentUser?.employeeId || currentUser?.id}) • ${currentUser?.department}`}
                </span>
              </div>
            )}

            {/* Route Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Transport Route *
              </label>
              <select
                name="routeId"
                value={formData.routeId}
                onChange={handleRouteChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                required
              >
                {routes.map((r) => (
                  <option key={r.routeId} value={r.routeId}>
                    {r.routeName} ({r.assignedCount}/{r.capacity} seats taken) — Driver: {r.assignedDriverName}
                  </option>
                ))}
              </select>
            </div>

            {/* Route Capacity Status Card */}
            {selectedRoute && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  isFull
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex justify-between font-semibold">
                  <span>Capacity Status: {selectedRoute.assignedCount} / {selectedRoute.capacity} Seats Filled</span>
                  <span>{isFull ? 'FULL' : 'SEATS AVAILABLE'}</span>
                </div>
                <div className="text-[11px] opacity-90">
                  Vehicle: {selectedRoute.assignedVehicleName} • Morning Departure: {selectedRoute.morningDepartureTime}
                </div>
              </div>
            )}

            {/* Pickup Point Selection / Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pickup Point / Stop *
              </label>
              {selectedRoute?.pickupPoints && selectedRoute.pickupPoints.length > 0 ? (
                <select
                  name="pickupPoint"
                  value={formData.pickupPoint}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white mb-2"
                >
                  {selectedRoute.pickupPoints.map((pt, i) => (
                    <option key={i} value={pt}>
                      {pt}
                    </option>
                  ))}
                  {formData.pickupPoint &&
                    formData.pickupPoint !== 'custom' &&
                    !selectedRoute.pickupPoints.includes(formData.pickupPoint) && (
                      <option value={formData.pickupPoint}>{formData.pickupPoint}</option>
                    )}
                  <option value="custom">Other / Custom Street Point</option>
                </select>
              ) : null}

              {formData.pickupPoint === 'custom' && (
                <input
                  type="text"
                  placeholder="Specify custom pickup landmark..."
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pickupPoint: e.target.value }))
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              )}
            </div>

            {/* Drop Point & Pickup Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Morning Pickup Time
                </label>
                <input
                  type="text"
                  name="pickupTime"
                  value={formData.pickupTime}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Drop Point
                </label>
                <input
                  type="text"
                  name="dropPoint"
                  value={formData.dropPoint}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Facility Type & Contribution */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Facility Model
                </label>
                <select
                  name="facilityType"
                  value={formData.facilityType}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="Company Subsidized">Company Subsidized</option>
                  <option value="Free Benefit">Free Executive Benefit</option>
                  <option value="Employee Contribution">Standard Employee Shared</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Contribution (PKR)
                </label>
                <input
                  type="number"
                  name="monthlyContribution"
                  value={formData.monthlyContribution}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Effective Start Date *
              </label>
              <input
                type="date"
                name="effectiveFrom"
                value={formData.effectiveFrom}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isFull}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
            >
              {isEditMode
                ? 'Save Assignment Changes'
                : isHRorSuper
                  ? 'Assign Transport Route'
                  : 'Submit Facility Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
