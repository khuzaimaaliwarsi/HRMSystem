import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { employeeService } from '@/services/employeeService'
import EmployeeProfileView from '@/components/employee/EmployeeProfileView'
import Alert from '@/components/common/Alert'
import AppIcon from '@/components/common/AppIcon'

export function EmployeeProfilePage() {
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const profileTab = tabFromUrl === 'career' ? 'career' : (tabFromUrl === 'bank' || tabFromUrl === 'banking') ? 'bank' : 'overview'

  const { user } = useAuth()
  // Resolve authentic logged-in employee ID (emp-005 for Hina Farooq, emp-003 for Bilal Siddiqui, etc.)
  const employeeId = user?.employeeId || user?.id || 'EMP-004'
  const actorRole = user?.role || 'employee'

  const [employee, setEmployee] = useState(() => employeeService.getEmployeeById(employeeId))
  const [bankDetails, setBankDetails] = useState(() => employeeService.getBankDetails(employeeId, actorRole, employeeId))
  const [careerHistory, setCareerHistory] = useState(() => employeeService.getCareerHistory(employeeId))
  const [reportingChain, setReportingChain] = useState(() => employeeService.getReportingChain(employeeId))
  const [isEditContactOpen, setIsEditContactOpen] = useState(false)
  const [notification, setNotification] = useState(null)

  // Permitted self-service edit fields
  const [contactForm, setContactForm] = useState(() => {
    const emp = employeeService.getEmployeeById(employeeId)
    return {
      phone: emp?.phone || '',
      alternatePhone: emp?.alternatePhone || '',
      address: emp?.address || '',
      emergencyContactName: emp?.emergencyContactName || '',
      emergencyContactPhone: emp?.emergencyContactPhone || ''
    }
  })

  const loadProfile = useCallback(() => {
    const emp = employeeService.getEmployeeById(employeeId)
    setEmployee(emp)
    if (emp) {
      setBankDetails(employeeService.getBankDetails(employeeId, actorRole, employeeId))
      setCareerHistory(employeeService.getCareerHistory(employeeId))
      setReportingChain(employeeService.getReportingChain(employeeId))
      setContactForm({
        phone: emp.phone || '',
        alternatePhone: emp.alternatePhone || '',
        address: emp.address || '',
        emergencyContactName: emp.emergencyContactName || '',
        emergencyContactPhone: emp.emergencyContactPhone || ''
      })
    }
  }, [employeeId, actorRole])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    const unsubscribe = employeeService.subscribe(() => {
      loadProfile()
    })
    return () => unsubscribe()
  }, [loadProfile])

  const handleUpdateContact = (e) => {
    e.preventDefault()
    try {
      employeeService.updateEmployee(
        employeeId,
        {
          phone: contactForm.phone,
          alternatePhone: contactForm.alternatePhone,
          address: contactForm.address,
          emergencyContactName: contactForm.emergencyContactName,
          emergencyContactPhone: contactForm.emergencyContactPhone
        },
        `${employee.name} (Self-Service)`,
        'Employee Self-Service Contact Details Update'
      )
      setNotification({
        type: 'success',
        message: 'Your personal contact details were updated successfully.'
      })
      setIsEditContactOpen(false)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  if (!employee) {
    return (
      <div className="p-8 text-center text-xs text-hrms-muted">
        Loading employee profile record...
      </div>
    )
  }

  return (
    <div className="space-y-5 text-left">
      {/* Top Banner */}
      <div className="rounded-lg border border-hrms-border p-4 sm:p-5 shadow-hrms-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
              My Profile & Self-Service Portal
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Personal Record
            </span>
          </div>
          <p className="text-xs text-hrms-muted mt-1">
            View your official organizational assignment, career timeline, reporting line, and masked payment details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditContactOpen(true)}
          className="px-3.5 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          <AppIcon name="settings" className="w-3.5 h-3.5" />
          <span>Update Contact Info</span>
        </button>
      </div>

      {notification && (
        <Alert variant={notification.type} onClose={() => setNotification(null)}>
          {notification.message}
        </Alert>
      )}

      {/* Main Profile View */}
      <EmployeeProfileView
        employee={employee}
        bankDetails={bankDetails}
        careerHistory={careerHistory}
        reportingChain={reportingChain}
        onEdit={() => setIsEditContactOpen(true)}
        canEdit={true}
        userRole="employee"
        currentUserId={employeeId}
        initialTab={profileTab}
      />

      {/* Self-Service Contact Details Modal */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
          <div className="bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-hrms-primary">Update Contact Information</h4>
                <p className="text-[11px] text-hrms-muted">Self-service allows updating personal phone and emergency details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateContact} className="p-5 space-y-3.5">
              <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs text-blue-800">
                <strong>Governance Rule:</strong> Official assignments (Designation, Department, Reporting Manager, Salary) cannot be self-modified.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Mobile Phone <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value.slice(0, 11) })}
                    placeholder="03001234567"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alternate Phone <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={contactForm.alternatePhone}
                    onChange={(e) => setContactForm({ ...contactForm, alternatePhone: e.target.value.slice(0, 11) })}
                    placeholder="03219876543"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  required
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  placeholder="Street address, city"
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Person</label>
                  <input
                    type="text"
                    value={contactForm.emergencyContactName}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyContactName: e.target.value })}
                    placeholder="e.g. Saima Siddiqui (Spouse)"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Phone <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={contactForm.emergencyContactPhone}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyContactPhone: e.target.value.slice(0, 11) })}
                    placeholder="03009999999"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-hrms-border">
                <button
                  type="button"
                  onClick={() => setIsEditContactOpen(false)}
                  className="px-3 py-1.5 rounded border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-bold"
                >
                  Save Contact Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeProfilePage
