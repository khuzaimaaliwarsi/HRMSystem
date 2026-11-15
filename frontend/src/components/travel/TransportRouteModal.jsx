import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import travelService from '@/services/travelService'

export default function TransportRouteModal({
  isOpen,
  onClose,
  routeToEdit = null,
  onSaveRoute
}) {
  const isEdit = Boolean(routeToEdit)

  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [formData, setFormData] = useState({
    routeName: '',
    pickupPoints: 'Gulshan Chowrangi, Nipa Chowrangi, Hassan Square, Baloch Colony',
    dropPoint: 'iSysware HQ Tech Park',
    morningDepartureTime: '07:30 AM',
    eveningDepartureTime: '06:15 PM',
    assignedVehicleId: '',
    assignedDriverId: '',
    capacity: 14,
    status: 'Active'
  })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      try {
        const vList = travelService.getVehicles() || []
        const dList = travelService.getDrivers() || []
        setVehicles(vList.filter((v) => v.status === 'Active'))
        setDrivers(dList.filter((d) => d.status === 'Active'))

        if (routeToEdit) {
          setFormData({
            routeName: routeToEdit.routeName || '',
            pickupPoints: Array.isArray(routeToEdit.pickupPoints)
              ? routeToEdit.pickupPoints.join(', ')
              : routeToEdit.pickupPoints || '',
            dropPoint: routeToEdit.dropPoint || 'iSysware HQ Tech Park',
            morningDepartureTime: routeToEdit.morningDepartureTime || '07:30 AM',
            eveningDepartureTime: routeToEdit.eveningDepartureTime || '06:15 PM',
            assignedVehicleId: routeToEdit.assignedVehicleId || (vList[0]?.vehicleId || ''),
            assignedDriverId: routeToEdit.assignedDriverId || (dList[0]?.driverId || ''),
            capacity: routeToEdit.capacity || 14,
            status: routeToEdit.status || 'Active'
          })
        } else {
          setFormData({
            routeName: '',
            pickupPoints: 'Gulshan Chowrangi, Nipa Chowrangi, Hassan Square',
            dropPoint: 'iSysware HQ Tech Park',
            morningDepartureTime: '07:30 AM',
            eveningDepartureTime: '06:15 PM',
            assignedVehicleId: vList[0]?.vehicleId || '',
            assignedDriverId: dList[0]?.driverId || '',
            capacity: vList[0]?.capacity || 14,
            status: 'Active'
          })
        }
      } catch {
        setVehicles([])
        setDrivers([])
      }
      setErrorMsg('')
    }
  }, [isOpen, routeToEdit])

  if (!isOpen) return null

  const handleVehicleChange = (e) => {
    const vId = e.target.value
    const veh = vehicles.find((v) => v.vehicleId === vId)
    setFormData((prev) => ({
      ...prev,
      assignedVehicleId: vId,
      capacity: veh ? veh.capacity : prev.capacity
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
      if (!formData.routeName.trim()) {
        throw new Error('Route name is required.')
      }
      if (!formData.assignedVehicleId) {
        throw new Error('Assigned vehicle is required.')
      }
      if (!formData.assignedDriverId) {
        throw new Error('Assigned driver is required.')
      }

      const points = formData.pickupPoints
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)

      if (points.length === 0) {
        throw new Error('At least one pickup point is required.')
      }

      await onSaveRoute({
        ...(routeToEdit ? { routeId: routeToEdit.routeId } : {}),
        ...formData,
        pickupPoints: points,
        capacity: Number(formData.capacity)
      })
      onClose()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="bus" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEdit ? `Edit Transport Route — ${routeToEdit.routeId}` : 'Create Transport Route'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure stops, schedule, assigned vehicle and primary driver
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

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Route Name *
              </label>
              <input
                type="text"
                name="routeName"
                placeholder="e.g. Route 04 — Malir Cantt to Tech Park Express"
                value={formData.routeName}
                onChange={handleChange}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pickup Stops & Landmarks * (comma-separated)
              </label>
              <textarea
                rows={2}
                name="pickupPoints"
                value={formData.pickupPoints}
                onChange={handleChange}
                placeholder="Checkpost 5, Cantt Bazaar, Airport Road, Shahrah-e-Faisal"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Morning Departure Time *
                </label>
                <input
                  type="text"
                  name="morningDepartureTime"
                  value={formData.morningDepartureTime}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evening Departure Time *
                </label>
                <input
                  type="text"
                  name="eveningDepartureTime"
                  value={formData.eveningDepartureTime}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Vehicle *
                </label>
                <select
                  name="assignedVehicleId"
                  value={formData.assignedVehicleId}
                  onChange={handleVehicleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.vehicleName} ({v.registrationNumber}) — {v.capacity} Seats
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Driver *
                </label>
                <select
                  name="assignedDriverId"
                  value={formData.assignedDriverId}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                >
                  {drivers.map((d) => (
                    <option key={d.driverId} value={d.driverId}>
                      {d.driverName} ({d.contactNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Passenger Seat Capacity
                </label>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
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
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              {isEdit ? 'Update Route' : 'Create Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
