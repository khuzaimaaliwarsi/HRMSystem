import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function FleetMasterModal({
  isOpen,
  onClose,
  mode = 'vehicle', // 'vehicle' | 'driver'
  vehicles = [],
  onSave
}) {
  const [formData, setFormData] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setErrorMsg('')
    setSaving(false)
    if (mode === 'vehicle') {
      setFormData({
        vehicleName: '',
        registrationNumber: '',
        vehicleType: 'Van / HiAce',
        ownershipType: 'Company Owned',
        capacity: 14,
        status: 'Active'
      })
    } else {
      setFormData({
        driverName: '',
        contactNumber: '',
        licenseNumber: '',
        assignedVehicleId: vehicles[0]?.vehicleId || '',
        status: 'Active'
      })
    }
  }, [isOpen, mode, vehicles])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save fleet record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="bus" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {mode === 'vehicle' ? 'Add Fleet Vehicle' : 'Add Authorized Driver'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'vehicle'
                  ? 'Register company or vendor shuttle vehicle'
                  : 'Register licensed driver for shuttle routes'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <AppIcon name="close" className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {mode === 'vehicle' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vehicle Name / Model *
                  </label>
                  <input
                    type="text"
                    name="vehicleName"
                    value={formData.vehicleName || ''}
                    onChange={handleChange}
                    placeholder="e.g. Toyota HiAce Commuter 01"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registration Number *
                    </label>
                    <input
                      type="text"
                      name="registrationNumber"
                      value={formData.registrationNumber || ''}
                      onChange={handleChange}
                      placeholder="e.g. KHI-2026-441"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Passenger Capacity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      name="capacity"
                      value={formData.capacity || 14}
                      onChange={handleChange}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      name="vehicleType"
                      value={formData.vehicleType || 'Van / HiAce'}
                      onChange={handleChange}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800"
                    >
                      <option value="Van / HiAce">Van / HiAce</option>
                      <option value="Coaster Bus">Coaster Bus</option>
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ownership Type
                    </label>
                    <select
                      name="ownershipType"
                      value={formData.ownershipType || 'Company Owned'}
                      onChange={handleChange}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800"
                    >
                      <option value="Company Owned">Company Owned</option>
                      <option value="Vendor Contracted">Vendor Contracted</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Driver Full Name *
                  </label>
                  <input
                    type="text"
                    name="driverName"
                    value={formData.driverName || ''}
                    onChange={handleChange}
                    placeholder="e.g. Muhammad Tariq"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Number *
                    </label>
                    <input
                      type="text"
                      name="contactNumber"
                      value={formData.contactNumber || ''}
                      onChange={handleChange}
                      placeholder="e.g. +92-300-1234567"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      License Number
                    </label>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber || ''}
                      onChange={handleChange}
                      placeholder="e.g. LTV-99210"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Assigned Vehicle
                  </label>
                  <select
                    name="assignedVehicleId"
                    value={formData.assignedVehicleId || ''}
                    onChange={handleChange}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicleId} value={v.vehicleId}>
                        {v.vehicleName} ({v.registrationNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs"
            >
              {saving ? 'Saving...' : mode === 'vehicle' ? 'Save Vehicle' : 'Save Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

