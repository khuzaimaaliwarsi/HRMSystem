
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import Button from '@/components/common/Button'
import { employeeService } from '@/services/employeeService'
import { salaryRevisionService } from '@/services/salaryRevisionService'
import { apiClient } from '@/services/apiClient'

const getToday = () => new Date().toISOString().slice(0, 10)

const getValidSalary = (structure) => {
  if (!structure) return null

  const raw = structure.basicSalary ?? structure.baseSalary

  if (raw == null || raw === '') return null

  const amount = Number(raw)

  return Number.isFinite(amount) && amount > 0
    ? amount
    : null
}

const formatMoney = (amount) =>
  Number(amount).toLocaleString('en-PK', {
    maximumFractionDigits: 2
  })

const getEmployeeKeys = (employee) =>
  [
    employee?.id,
    employee?.cuid,
    employee?.employeeId,
    employee?.employeeCode
  ]
    .filter(Boolean)
    .map(String)

export function SalaryRevisionModal({
  isOpen,
  onClose,
  onSubmitProposal,
  onRevisionCreated,
  preselectedEmployee = null,
  employee = null,
  employees: propEmployees = null
}) {

  const employees = (
    propEmployees && propEmployees.length > 0
      ? propEmployees
      : employeeService.getEmployees() || []
  ).filter((emp) =>
    String(emp.employmentStatus || emp.status || '')
      .toUpperCase() === 'ACTIVE'
  )


  const initialEmp = preselectedEmployee || employee


  const [employeeId, setEmployeeId] = useState(() => {
    const initialId = initialEmp?.employeeId || initialEmp?.id

    const validInitial = employees.find(emp =>
      getEmployeeKeys(emp).includes(String(initialId))
    )

    return validInitial?.id || employees[0]?.id || ''
  })


  const [structures, setStructures] = useState([])
  const [loadingStructures, setLoadingStructures] = useState(false)
  const [structureError, setStructureError] = useState('')

  const [proposedSalary, setProposedSalary] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(getToday)
  const [performanceRating, setPerformanceRating] = useState('4.5')
  const [justification, setJustification] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedEmp = useMemo(
    () =>
      employees.find((emp) =>
        getEmployeeKeys(emp).includes(String(employeeId))
      ) || null,
    [employees, employeeId]
  )

  // Load authoritative salary structures from PostgreSQL.
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const loadStructures = async () => {
      setLoadingStructures(true)
      setStructureError('')
      setStructures([])
      setProposedSalary('')

      try {
        const response = await apiClient.get('/payroll/structures')

        const records = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : []

        if (!cancelled) {
          setStructures(records)
        }
      } catch (err) {
        if (!cancelled) {
          setStructureError(
            err?.message ||
            'Unable to load salary structures from PostgreSQL.'
          )
          setStructures([])
        }
      } finally {
        if (!cancelled) {
          setLoadingStructures(false)
        }
      }
    }

    loadStructures()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  // Resolve employee salary from actual backend records only.
  const currentStructure = useMemo(() => {
    if (!selectedEmp) return null

    const employeeKeys = getEmployeeKeys(selectedEmp)
    const today = getToday()

    const matching = structures.filter((structure) => {
      const structureKeys = [
        structure.employeeId,
        structure.employee?.id,
        structure.employee?.employeeCode,
        structure.employeeCode
      ]
        .filter(Boolean)
        .map(String)

      const isEmployeeMatch = structureKeys.some((key) =>
        employeeKeys.includes(key)
      )

      const status = String(structure.status || '').toUpperCase()

      const isInactive = [
        'INACTIVE',
        'CANCELLED',
        'REJECTED',
        'SUPERSEDED',
        'DRAFT',
        'PENDING'
      ].includes(status)

      const effectiveFrom =
        structure.effectiveFrom ||
        structure.effectiveDate ||
        structure.startDate ||
        null

      const effectiveUntil =
        structure.effectiveUntil ||
        structure.endDate ||
        null

      const isEffective =
        (!effectiveFrom ||
          String(effectiveFrom).slice(0, 10) <= today) &&
        (!effectiveUntil ||
          String(effectiveUntil).slice(0, 10) >= today)

      return (
        isEmployeeMatch &&
        !isInactive &&
        isEffective &&
        getValidSalary(structure) !== null
      )
    })

    matching.sort((a, b) => {
      const dateA = String(
        a.effectiveFrom || a.effectiveDate || a.startDate || ''
      )

      const dateB = String(
        b.effectiveFrom || b.effectiveDate || b.startDate || ''
      )

      return dateB.localeCompare(dateA)
    })

    return matching[0] || null
  }, [structures, selectedEmp])

  const currentSalary = getValidSalary(currentStructure)
  const hasSalaryStructure = currentSalary !== null

  // Recalculate the proposed salary when employee/structure changes.
  useEffect(() => {
    if (!isOpen) return

    setProposedSalary(
      hasSalaryStructure
        ? String(Math.round(currentSalary * 1.15))
        : ''
    )
  }, [isOpen, employeeId, currentSalary, hasSalaryStructure])

  if (!isOpen) return null

  const propNum = Number(proposedSalary) || 0

  const delta = hasSalaryStructure
    ? propNum - currentSalary
    : 0

  const pct = hasSalaryStructure
    ? Math.round((delta / currentSalary) * 10000) / 100
    : 0

  const isIncrement = delta >= 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (loadingStructures) {
      setError('Salary structures are still loading.')
      return
    }

    if (structureError) {
      setError(structureError)
      return
    }

    if (
      !selectedEmp ||
      String(selectedEmp.employmentStatus || selectedEmp.status || '')
        .toUpperCase() !== 'ACTIVE'
    ) {
      setError('Salary revision is allowed only for active employees.')
      return
    }


    if (!selectedEmp) {
      setError('Please select a valid employee.')
      return
    }

    if (!hasSalaryStructure) {
      setError(
        'This employee has no configured active salary structure. ' +
        'Please configure an approved salary structure before submitting a revision.'
      )
      return
    }

    if (!Number.isFinite(propNum) || propNum <= 0) {
      setError('Proposed salary must be greater than zero.')
      return
    }

    if (propNum === currentSalary) {
      setError('Proposed salary must differ from current salary.')
      return
    }

    if (!effectiveDate) {
      setError('Effective date is required.')
      return
    }

    const rating = performanceRating.trim()
      ? Number(performanceRating)
      : null

    if (
      rating !== null &&
      (!Number.isFinite(rating) || rating < 1 || rating > 5)
    ) {
      setError('Performance rating must be between 1.0 and 5.0.')
      return
    }

    if (justification.trim().length < 5) {
      setError(
        'Audit justification (minimum 5 characters) is mandatory.'
      )
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        employeeId: selectedEmp.cuid || selectedEmp.id,
        employeeCode: selectedEmp.employeeCode || selectedEmp.id,
        employeeName: selectedEmp.name,
        department: selectedEmp.department,
        designation: selectedEmp.designation,
        currentSalary,
        proposedSalary: propNum,
        proposedBaseSalary: propNum,
        proposedGrossSalary: currentStructure?.grossSalary
          ? Number(currentStructure.grossSalary) + (propNum - currentSalary)
          : propNum,
        effectiveDate,
        justification: justification.trim(),
        performanceRating: rating
      }

      if (onSubmitProposal) {
        await onSubmitProposal(payload)
      } else {
        await salaryRevisionService.createProposal(payload)
      }

      onRevisionCreated?.()
      onClose()
    } catch (err) {
      setError(
        err?.message ||
        'Failed to submit salary revision proposal.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl text-left overflow-hidden my-6 animate-in zoom-in-95 duration-150"
      >

        <div className="px-6 py-4 bg-gradient-to-r from-navy-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <AppIcon name="payroll" className="w-4 h-4" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Draft Salary Revision Proposal
              </h3>
              <p className="text-xs text-slate-300">
                Requires executive Super Admin sign-off before becoming effective
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          {structureError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              {structureError}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Target Personnel
            </label>

            <select
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value)
                setError(null)
              }}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id}) — {emp.designation} [{emp.department}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 font-mono">
            <div>
              <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">
                Current Basic
              </span>

              <span className="text-base font-black text-slate-700">
                {loadingStructures
                  ? 'Loading...'
                  : hasSalaryStructure
                    ? `PKR ${formatMoney(currentSalary)}`
                    : 'Not Configured'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">
                Proposed Delta
              </span>

              <span
                className={`text-base font-black ${isIncrement
                  ? 'text-emerald-700'
                  : 'text-rose-700'
                  }`}
              >
                {hasSalaryStructure && propNum > 0
                  ? `${delta >= 0 ? '+' : ''}${formatMoney(delta)} (${pct}%)`
                  : 'N/A'}
              </span>
            </div>
          </div>

          {!loadingStructures && !hasSalaryStructure && !structureError && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium">
              No active salary structure found for this employee.
              Salary revision cannot be proposed until an authorized
              salary structure is configured.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Proposed Basic Salary (PKR) *
              </label>

              <input
                type="number"
                min="1"
                step="any"
                value={proposedSalary}
                onChange={(e) => setProposedSalary(e.target.value)}
                disabled={!hasSalaryStructure || loadingStructures}
                className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 font-bold focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Effective Date *
              </label>

              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Performance Evaluation Rating (1.0 to 5.0)
            </label>

            <input
              type="number"
              step="0.1"
              min="1.0"
              max="5.0"
              value={performanceRating}
              onChange={(e) => setPerformanceRating(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Audit Justification &amp; Performance Review Evidence *
            </label>

            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="State the objective performance achievements, role evolution, or market benchmark backing this revision..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={
                submitting ||
                loadingStructures ||
                Boolean(structureError) ||
                !hasSalaryStructure
              }
              className="bg-navy-800 hover:bg-navy-900 text-white font-bold cursor-pointer"
            >
              Submit Proposal for Super Admin Review
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

export default SalaryRevisionModal
