import React, { useState } from 'react'
import { useAuth } from '@/context/useAuth'
import { dataPurgeService } from '@/services/dataPurgeService'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Alert from '@/components/common/Alert'
import notify from '@/lib/notify'

const OPERATIONAL_MODULES = [
  {
    id: 'employees',
    name: 'Employee Management & Organization Master',
    icon: 'users',
    badge: 'Workforce',
    description: 'Employees, career history, documents, bank records, departments, sub-departments, teams, designations & team assignments'
  },
  {
    id: 'recruitment',
    name: 'Recruitment & Onboarding',
    icon: 'user-plus',
    badge: 'Talent Acquisition',
    description: 'Job requisitions, vacancies, candidate applications, interview schedules, evaluations, job offers & probation records'
  },
  {
    id: 'attendance',
    name: 'Attendance & Shifts',
    icon: 'clock',
    badge: 'Time Tracking',
    description: 'Attendance registers, biometric punches, regularizations, overtime requests, WFH & field duty, shifts & rosters'
  },
  {
    id: 'leaves',
    name: 'Leave Management & Balances',
    icon: 'calendar',
    badge: 'Time Off',
    description: 'Leave applications, review approvals, leave balance entitlements, balance adjustments & ledger journals'
  },
  {
    id: 'payroll',
    name: 'Payroll, Compensation & Loans',
    icon: 'credit-card',
    badge: 'Financial',
    description: 'Monthly payroll runs, employee payslips, salary structures, loan applications, repayments & salary revisions'
  },
  {
    id: 'tasks_performance',
    name: 'Tasks & Performance Appraisals',
    icon: 'award',
    badge: 'Talent Review',
    description: 'Task assignments, appraisal review cycles, employee review scorecards, performance goals & development plans'
  },
  {
    id: 'training',
    name: 'Training & Development',
    icon: 'graduation-cap',
    badge: 'Learning',
    description: 'Training course programs, cohort sessions, employee enrollments, assessment outcomes & issued certificates'
  },
  {
    id: 'helpdesk',
    name: 'Help Desk Management',
    icon: 'headset',
    badge: 'Support',
    description: 'Support service tickets, internal resolution logs, SLA breach logs & employee feedback ratings'
  },
  {
    id: 'travel_transport',
    name: 'Travel & Transport Logistics',
    icon: 'plane',
    badge: 'Operations',
    description: 'Official travel requests, advance settlements, pick-and-drop transport passes & vehicle route allocations'
  },
  {
    id: 'letters',
    name: 'HR Letters Management',
    icon: 'envelope',
    badge: 'Documentation',
    description: 'Issued corporate HR letters, employee letter requests & historical letter verification records'
  },
  {
    id: 'expenses',
    name: 'Expense Management & Claims',
    icon: 'file-text',
    badge: 'Finance',
    description: 'Employee expense claims, uploaded item receipts, approval decisions & reimbursement registers'
  }
]

export function DataManagementTab() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [selectedModules, setSelectedModules] = useState(OPERATIONAL_MODULES.map((m) => m.id))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deletionResult, setDeletionResult] = useState(null)

  // Super Admin RBAC Guard
  if (!isSuperAdmin) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mb-4">
          <AppIcon name="lock" className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied — Super Admin Only</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Data Management and operational reset operations are strictly restricted to the Super Admin under iSysware HRMS security policies.
        </p>
      </div>
    )
  }

  const isAllSelected = selectedModules.length === OPERATIONAL_MODULES.length
  const requiredPhrase = isAllSelected ? 'DELETE ALL DATA' : 'DELETE SELECTED DATA'

  const handleToggleModule = (id) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedModules(OPERATIONAL_MODULES.map((m) => m.id))
  }

  const handleDeselectAll = () => {
    setSelectedModules([])
  }

  const handleOpenModal = () => {
    if (selectedModules.length === 0) {
      notify.error('Please select at least one module to delete.')
      return
    }
    setConfirmationInput('')
    setError(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (!loading) {
      setIsModalOpen(false)
      setConfirmationInput('')
      setError(null)
    }
  }

  const handleExecuteDeletion = async () => {
    if (confirmationInput !== requiredPhrase) {
      setError(`Confirmation phrase does not match. Please type "${requiredPhrase}" exactly.`)
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (isAllSelected) {
        await dataPurgeService.purgeAllOperationalData(user)
      } else {
        await dataPurgeService.purgeSelectiveModules(selectedModules, user)
      }

      setDeletionResult({
        message: `Operational data for ${selectedModules.length} module(s) permanently deleted from PostgreSQL and runtime storage.`,
        deletedCount: selectedModules.length,
        selectedNames: OPERATIONAL_MODULES.filter((m) => selectedModules.includes(m.id)).map((m) => m.name),
        preservedUsersCount: 2
      })

      setIsModalOpen(false)
      notify.success(`${selectedModules.length} module(s) successfully emptied to 0!`)
    } catch (err) {
      const msg = err.message || 'Failed to delete operational data'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 text-left max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Data Management & Module-wise Reset</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tick the modules you want to empty to 0. Whatever you delete is permanently purged from PostgreSQL and cannot come back on page reload.
          </p>
        </div>

        {/* Global Select Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isAllSelected}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={selectedModules.length === 0}
          >
            Deselect All
          </Button>
        </div>
      </div>

      {/* Result Notification Banner if just deleted */}
      {deletionResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
            <AppIcon name="check" className="w-5 h-5 text-emerald-600" />
            <span>Modules Successfully Emptied to 0</span>
          </div>
          <p className="text-emerald-700">
            {deletionResult.message}
          </p>
          <div className="bg-white/80 p-3 rounded-lg border border-emerald-200 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <span className="font-semibold text-slate-600">Emptied Modules:</span>{' '}
              <span className="font-bold text-rose-700">{deletionResult.deletedCount} Module(s)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">Preserved Portal Accounts:</span>{' '}
              <span className="font-bold text-purple-700">2 (superadmin & hradmin)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">Settings & Invariants:</span>{' '}
              <span className="font-bold text-emerald-700">100% Preserved</span>
            </div>
          </div>
        </div>
      )}

      {/* Preserved Notice Bar */}
      <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-start sm:items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-700">
          <AppIcon name="shield" className="w-4 h-4" />
        </div>
        <div className="text-[11px] leading-relaxed">
          <strong className="text-blue-950 font-bold">Settings Always Protected:</strong> Your Company Profile, Super Admin & HR Admin portal login accounts, 5 Canonical Policies, and 2026 Pakistan Gazette Holidays are never deleted.
        </div>
      </div>

      {/* Module Selection Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>Select Operational Modules to Empty:</span>
          <span className="text-slate-500 font-mono text-[11px]">
            {selectedModules.length} of {OPERATIONAL_MODULES.length} selected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {OPERATIONAL_MODULES.map((mod) => {
            const isChecked = selectedModules.includes(mod.id)
            return (
              <div
                key={mod.id}
                onClick={() => handleToggleModule(mod.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3.5 select-none ${
                  isChecked
                    ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                {/* Custom Checkbox */}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // Handled by parent div
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs font-bold truncate ${isChecked ? 'text-rose-950' : 'text-slate-800'}`}>
                      {mod.name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      isChecked ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {mod.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                    {mod.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sticky / Prominent Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-slate-800">
            {selectedModules.length === 0
              ? 'No modules selected'
              : `Ready to permanently delete data from ${selectedModules.length} selected module(s)?`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Requires typing <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700 font-mono font-bold">{requiredPhrase}</code>.
          </div>
        </div>

        <Button
          type="button"
          variant="danger"
          size="md"
          icon="trash"
          disabled={selectedModules.length === 0}
          onClick={handleOpenModal}
        >
          {isAllSelected ? 'Delete All Operational Data' : `Delete Selected (${selectedModules.length}) Modules`}
        </Button>
      </div>

      {/* Confirmation Dialog Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={isAllSelected ? 'Confirm Complete Operational Data Deletion' : `Confirm Deletion of ${selectedModules.length} Modules`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-left">
          {error && (
            <Alert variant="danger" title="Error">
              {error}
            </Alert>
          )}

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
            <div className="font-bold text-rose-800 flex items-center gap-1.5">
              <AppIcon name="danger" className="w-4 h-4 text-rose-600" />
              <span>Permanent Deletion Warning</span>
            </div>
            <p className="leading-relaxed">
              This will permanently delete data for <strong>{selectedModules.length} selected module(s)</strong> from PostgreSQL and local storage. On page reload, these modules will remain <strong>0 (empty)</strong>.
            </p>
            <div className="text-[11px] text-rose-700 bg-rose-100/60 p-2 rounded-lg font-mono">
              Selected: {selectedModules.join(', ')}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              To proceed, please type <span className="font-mono font-bold text-rose-700">{requiredPhrase}</span> below:
            </label>
            <input
              type="text"
              autoFocus
              className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              placeholder={requiredPhrase}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={confirmationInput !== requiredPhrase || loading}
              loading={loading}
              icon="trash"
              onClick={handleExecuteDeletion}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default DataManagementTab
