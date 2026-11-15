import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TravelPlanModal({
  isOpen,
  onClose,
  travelRequest = null,
  plan = null,
  onCreatePlan,
  onUpdatePlan
}) {
  const isEditMode = Boolean(plan)
  const [formData, setFormData] = useState({
    transportationType: 'Commercial Airline',
    vendorReference: 'Pakistan International Airlines (PIA)',
    bookingReference: '',
    hotelReference: 'Marriott Executive Corporate Booking',
    departureSchedule: '',
    returnSchedule: '',
    confirmedCost: '',
    notes: ''
  })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (plan) {
      setFormData({
        transportationType: plan.transportationType || 'Commercial Airline',
        vendorReference: plan.vendorReference || 'Corporate Logistics Desk',
        bookingReference: plan.bookingReference || '',
        hotelReference: plan.hotelReference || 'Corporate Accommodation Booking',
        departureSchedule: plan.departureSchedule || '',
        returnSchedule: plan.returnSchedule || '',
        confirmedCost: plan.confirmedCost !== undefined && plan.confirmedCost !== null ? String(plan.confirmedCost) : '',
        notes: plan.notes || ''
      })
    } else if (travelRequest) {
      setFormData({
        transportationType: travelRequest.travelMode || 'Commercial Airline',
        vendorReference:
          travelRequest.travelMode === 'Commercial Airline'
            ? 'Pakistan International Airlines (PIA)'
            : 'Corporate Logistics Desk',
        bookingReference: '',
        hotelReference: travelRequest.accommodationRequired
          ? 'Corporate Guest House / Partner Hotel'
          : 'None',
        departureSchedule: `${travelRequest.departureDate} ${travelRequest.departureTime}`,
        returnSchedule: `${travelRequest.returnDate} ${travelRequest.returnTime}`,
        confirmedCost: travelRequest.estimatedBudget || '',
        notes: `Itinerary prepared for ${travelRequest.employeeName} (${travelRequest.employeeId})`
      })
    }
    setErrorMsg('')
  }, [travelRequest, plan, isOpen])

  if (!isOpen || (!travelRequest && !plan)) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!formData.bookingReference.trim()) {
      setErrorMsg('PNR or confirmed booking reference is required.')
      return
    }
    if (formData.confirmedCost !== '' && (Number.isNaN(Number(formData.confirmedCost)) || Number(formData.confirmedCost) < 0)) {
      setErrorMsg('Confirmed booking cost must be a non-negative number.')
      return
    }

    try {
      if (isEditMode && onUpdatePlan) {
        await onUpdatePlan(plan.planId, formData)
      } else {
        await onCreatePlan({
          requestId: travelRequest.requestId,
          ...formData
        })
      }
      onClose()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <AppIcon name="calendar" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditMode ? `Edit Travel Plan — ${plan.planId}` : 'Generate Official Travel Plan'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditMode
                  ? `Update booking PNR, schedules, and vendor references for #${plan.requestId}`
                  : `Log booking PNR, schedules, and vendor references for #${travelRequest.requestId}`}
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

            {/* Travel Summary Banner */}
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-blue-900">
                {(plan || travelRequest).employeeName} ({(plan || travelRequest).department})
              </div>
              <div className="text-blue-700">
                Destination: <span className="font-medium">{(plan || travelRequest).destination}</span> •{' '}
                {isEditMode ? 'Current Cost:' : 'Approved Budget:'}{' '}
                <span className="font-medium">
                  Rs. {Number(isEditMode ? plan.confirmedCost : travelRequest.estimatedBudget).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transportation Type *
                </label>
                <input
                  type="text"
                  name="transportationType"
                  value={formData.transportationType}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Vendor / Carrier Reference *
                </label>
                <input
                  type="text"
                  name="vendorReference"
                  value={formData.vendorReference}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Booking Reference / PNR / Ticket No *
                </label>
                <input
                  type="text"
                  name="bookingReference"
                  placeholder="e.g. PNR-78921-PIA"
                  value={formData.bookingReference}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hotel / Accommodation Reference
                </label>
                <input
                  type="text"
                  name="hotelReference"
                  placeholder="e.g. Booking #HOTEL-HYD-5501"
                  value={formData.hotelReference}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departure Schedule *
                </label>
                <input
                  type="text"
                  name="departureSchedule"
                  value={formData.departureSchedule}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Schedule *
                </label>
                <input
                  type="text"
                  name="returnSchedule"
                  value={formData.returnSchedule}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirmed Booking Cost (PKR)
                </label>
                <input
                  type="number"
                  name="confirmedCost"
                  value={formData.confirmedCost}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Coordinator Instructions & Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
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
              {isEditMode ? 'Save Plan Changes' : 'Confirm & Issue Travel Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
