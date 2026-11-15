import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import { compensationService } from '@/services/compensationService'
import apiClient from '@/services/apiClient'
import { employeeService } from '@/services/employeeService'
import { useAuth } from '@/context/AuthContext'

// Fail closed if employment status is missing: portal account status is not employment status.
const isActiveEmployee = (employee) =>
  String(employee?.employmentStatus ?? employee?.employment_status ?? employee?.status ?? '')
    .trim().toUpperCase() === 'ACTIVE'

const formatRevokedBy = (val) => {
  if (!val) return 'Super Admin (superadmin)'
  let s = String(val).trim()
  if (s.includes('|')) s = s.split('|')[0].trim()
  if (s.includes('Khuzaima Senior Developer')) return 'Super Admin (superadmin)'
  return s || 'Super Admin (superadmin)'
}

const formatAssignedBy = (val) => {
  if (!val) return 'Super Admin'
  let s = String(val).trim()
  if (s.includes('Khuzaima Senior Developer (SUPER_ADMIN)')) return 'Super Admin (SUPER_ADMIN)'
  return s
}

export function AllowanceManagementTable({ canManage: propCanManage = false }) {
  const { currentUser } = useAuth()
  const canManage = propCanManage || ['SUPER_ADMIN', 'HR_ADMIN'].includes(currentUser?.role)

  const [employees, setEmployees] = useState(() => employeeService.getEmployees() || [])
  const activeEmployees = useMemo(
    () => employees.filter(isActiveEmployee),
    [employees]
  )
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [salaryEligibleIds, setSalaryEligibleIds] = useState(new Set())
  const [salaryCheckLoading, setSalaryCheckLoading] = useState(true)
  const [salaryCheckError, setSalaryCheckError] = useState('')

  const [masters, setMasters] = useState(() => compensationService.getAllowancesMaster() || [])
  const [employeeAllowances, setEmployeeAllowances] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Status Filter State: ALL / ACTIVE / REVOKED / EXPIRED
  const [statusFilter, setStatusFilter] = useState('ALL')

  // View Details Modal State
  const [detailTarget, setDetailTarget] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Revocation Confirmation Modal State
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false)

  // Modal States
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false)
  const [categoriesList, setCategoriesList] = useState([
    { value: 'GENERAL', label: 'General' },
    { value: 'TRAVEL', label: 'Travel / Fuel' },
    { value: 'UTILITIES', label: 'Utilities / Mobile' },
    { value: 'MEDICAL', label: 'Medical' },
    { value: 'SPECIAL', label: 'Special / Hardship' },
    { value: 'HOUSING', label: 'Housing' }
  ])
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState('')

  const [masterForm, setMasterForm] = useState({
    code: '',
    name: '',
    category: 'GENERAL',
    defaultAmount: '',
    isTaxable: true,
    description: ''
  })

  const handleAddCustomCategory = () => {
    if (!customCategoryName.trim()) return
    const raw = customCategoryName.trim()
    const val = raw.toUpperCase().replace(/\s+/g, '_')
    if (!categoriesList.some((c) => c.value === val)) {
      setCategoriesList((prev) => [...prev, { value: val, label: raw }])
    }
    setMasterForm((prev) => ({ ...prev, category: val }))
    setCustomCategoryName('')
    setIsAddingCustomCategory(false)
  }

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({
    allowanceId: '',
    amount: '',
    remarks: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Keep employee directory synchronized with PostgreSQL-backed state
  useEffect(() => {
    const refreshEmployees = () => {
      const records = employeeService.getEmployees()
      setEmployees(Array.isArray(records) ? records : [])
    }

    refreshEmployees()
    const unsubscribe = employeeService.subscribe?.(refreshEmployees)
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  // Match PostgreSQL CUIDs AND frontend employee codes. The employee directory may
  // expose EMP-002 as `id`, while salary structures store the employee CUID.
  const salaryLookupKeys = (record) => [
    record?.id, record?.cuid, record?.employeeId, record?.employeeCode,
    record?.employee?.id, record?.employee?.cuid, record?.employee?.employeeCode
  ].filter(Boolean).map(value => String(value).trim().toUpperCase())

  const hasVerifiedSalary = (employee) =>
    Boolean(employee && salaryLookupKeys(employee).some(key => salaryEligibleIds.has(key)))

  // PostgreSQL-backed salary prerequisite; errors fail closed, never use mock salaries.
  useEffect(() => {
    let mounted = true
    const check = async () => {
      setSalaryCheckLoading(true)
      setSalaryCheckError('')
      try {
        const result = await apiClient.get('/payroll/structures')
        // Handle supported API response wrappers without assuming one frontend adapter.
        const rows = [result, result?.data, result?.structures,
          result?.data?.data, result?.data?.structures]
          .find(Array.isArray)
        if (!rows) throw new Error('Unexpected salary structures response')
        const ids = new Set()
        const now = Date.now()
        for (const structure of rows) {
          const current = structure.isCurrent === true || structure.isCurrent === 'true'
          const start = structure.effectiveFrom ? new Date(structure.effectiveFrom).getTime() : -Infinity
          const until = structure.effectiveUntil ? new Date(structure.effectiveUntil).getTime() : Infinity
          if (!current || !Number.isFinite(start) && start !== -Infinity || !Number.isFinite(until) && until !== Infinity || start > now || until <= now) continue
          salaryLookupKeys(structure).forEach(key => ids.add(key))
        }
        if (mounted) setSalaryEligibleIds(ids)
      } catch (err) {
        if (mounted) {
          setSalaryEligibleIds(new Set())
          setSalaryCheckError('Salary structures could not be verified from PostgreSQL. Retry after server is available.')
        }
      } finally {
        if (mounted) setSalaryCheckLoading(false)
      }
    }
    check()
    return () => { mounted = false }
  }, [isAssignModalOpen])

  // Auto-select valid employee
  useEffect(() => {
    if (activeEmployees.length === 0) {
      setSelectedEmpId('')
      return
    }

    const selectedExists = activeEmployees.some((emp) => String(emp.id) === String(selectedEmpId))
    if (!selectedExists) {
      setSelectedEmpId(String(activeEmployees[0].id))
    }
  }, [activeEmployees, selectedEmpId])

  // Initial fetch from PostgreSQL backend
  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    Promise.allSettled([
      compensationService.fetchAllowancesMaster(),
      compensationService.fetchEmployeeAllowances()
    ]).finally(() => {
      if (isMounted) setIsLoading(false)
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Refresh allowance records whenever selection changes or service updates
  useEffect(() => {
    const refreshAllowances = () => {
      setMasters(compensationService.getAllowancesMaster() || [])

      if (!selectedEmpId) {
        setEmployeeAllowances([])
        return
      }

      const selectedEmployee = activeEmployees.find((emp) => String(emp.id) === String(selectedEmpId))
      if (!selectedEmployee) {
        setEmployeeAllowances([])
        return
      }

      const records = compensationService.getEmployeeAllowances(selectedEmployee.id, { includeHistorical: true })
      setEmployeeAllowances(Array.isArray(records) ? records : [])
    }

    refreshAllowances()
    const unsubscribe = compensationService.subscribe?.(refreshAllowances)
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [selectedEmpId, activeEmployees])

  const selectedEmployee = useMemo(() => {
    return activeEmployees.find((emp) => String(emp.id) === String(selectedEmpId)) || null
  }, [activeEmployees, selectedEmpId])

  // Active allocations calculate toward monthly totals; Revoked and Expired records are excluded
  const activeAllocations = useMemo(() => {
    return employeeAllowances.filter(
      (a) => a.computedStatus === 'Active' || (a.isActive !== false && a.status === 'Active')
    )
  }, [employeeAllowances])

  const totalAllocated = useMemo(() => {
    return activeAllocations.reduce((total, allowance) => total + (Number(allowance.amount) || 0), 0)
  }, [activeAllocations])

  // Filtered allocations based on status tab: ALL / ACTIVE / REVOKED / EXPIRED
  const filteredAllowances = useMemo(() => {
    if (statusFilter === 'ALL') return employeeAllowances
    return employeeAllowances.filter((a) => (a.computedStatus || a.status || '').toUpperCase() === statusFilter)
  }, [employeeAllowances, statusFilter])

  // Dynamic counts for each status filter badge
  const statusCounts = useMemo(() => {
    const counts = { ALL: employeeAllowances.length, ACTIVE: 0, REVOKED: 0, EXPIRED: 0 }
    for (const a of employeeAllowances) {
      const st = (a.computedStatus || a.status || 'ACTIVE').toUpperCase()
      if (counts[st] !== undefined) {
        counts[st]++
      }
    }
    return counts
  }, [employeeAllowances])

  const formatMoney = (value) => Number(value || 0).toLocaleString('en-PK')

  const formatDate = (val) => {
    if (!val) return '—'
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return String(val).slice(0, 10)
      return d.toISOString().slice(0, 10)
    } catch {
      return String(val)
    }
  }

  const formatDateTime = (val) => {
    if (!val) return '—'
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return String(val)
      return `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } catch {
      return String(val)
    }
  }

  // Handle Create Allowance Master
  const handleCreateMaster = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!masterForm.code.trim() || !masterForm.name.trim()) {
      setFeedback({ type: 'error', message: 'Allowance code and name are required.' })
      return
    }

    setIsSubmitting(true)
    try {
      await compensationService.createAllowanceMaster({
        code: masterForm.code.trim().toUpperCase(),
        name: masterForm.name.trim(),
        category: masterForm.category,
        defaultAmount: Number(masterForm.defaultAmount) || 0,
        isTaxable: masterForm.isTaxable,
        description: masterForm.description.trim()
      })
      setFeedback({ type: 'success', message: `Allowance '${masterForm.name}' created successfully in PostgreSQL.` })
      setIsMasterModalOpen(false)
      setMasterForm({ code: '', name: '', category: 'GENERAL', defaultAmount: '', isTaxable: true, description: '' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || err.message || 'Failed to create allowance.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Assign Allowance to Employee
  const handleAssignAllowance = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!selectedEmployee || !isActiveEmployee(selectedEmployee)) {
      setFeedback({ type: 'error', message: 'Only ACTIVE employees are eligible for new allowance allocations.' })
      return
    }
    if (salaryCheckLoading || salaryCheckError || !hasVerifiedSalary(selectedEmployee)) {
      setFeedback({ type: 'error', message: 'Assign an active Initial Salary Structure before allocating an allowance to this employee.' })
      return
    }
    if (!assignForm.allowanceId) {
      setFeedback({ type: 'error', message: 'Please select an allowance category.' })
      return
    }
    const parsedAmount = Number(assignForm.amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive monthly amount.' })
      return
    }

    setIsSubmitting(true)
    try {
      await compensationService.assignAllowanceToEmployee(
        selectedEmployee.id,
        assignForm.allowanceId,
        parsedAmount,
        currentUser?.name || 'Super Admin',
        assignForm.remarks
      )
      setFeedback({
        type: 'success',
        message: `Allowance allocated to ${selectedEmployee.name || selectedEmployee.employeeCode} successfully.`
      })
      setIsAssignModalOpen(false)
      setAssignForm({ allowanceId: '', amount: '', remarks: '' })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to assign allowance.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Opening Confirmation Dialog for Revocation
  const handleOpenRevokeModal = (allocation) => {
    setRevokeTarget(allocation)
    setRevokeReason('')
    setIsRevokeModalOpen(true)
  }

  // Handle Confirming Revocation with Mandatory Reason
  const handleConfirmRevoke = async (e) => {
    e?.preventDefault()
    if (!revokeTarget) return
    if (!revokeReason.trim()) {
      setFeedback({ type: 'error', message: 'A revocation justification/reason is strictly required.' })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    try {
      await compensationService.revokeEmployeeAllowance(revokeTarget.id, revokeReason.trim())
      setFeedback({
        type: 'success',
        message: `Allowance allocation for '${revokeTarget.name}' revoked successfully and preserved in PostgreSQL audit history.`
      })
      setIsRevokeModalOpen(false)
      setRevokeTarget(null)
      setRevokeReason('')
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to revoke allowance allocation.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Opening View Details Modal
  const handleOpenDetailModal = (allocation) => {
    setDetailTarget(allocation)
    setIsDetailModalOpen(true)
  }

  return (
    <div className="space-y-6 text-left">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
        >
          <div className="flex items-center gap-2">
            <i
              className={`fa-solid ${feedback.type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'
                }`}
            ></i>
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 ml-4">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Corporate Allowance Master */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200">
              <AppIcon name="banking" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Corporate Allowance Master &amp; Tax Treatment</h3>
              <p className="text-xs text-slate-500">
                Authoritative PostgreSQL benefit catalog • Double-counting protected
              </p>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
            >
              <i className="fa-solid fa-plus text-[11px]"></i>
              <span>Add Allowance Category</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Allowance Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Tax Treatment</th>
                <th className="px-4 py-3 text-right">Standard Amount</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                    Loading allowance categories from database...
                  </td>
                </tr>
              ) : masters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No allowance categories recorded in PostgreSQL database.
                  </td>
                </tr>
              ) : (
                masters.map((m) => (
                  <tr key={m.id || m.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{m.code}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
                    <td className="px-4 py-3">{m.category}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.isTaxable
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                      >
                        {m.isTaxable ? 'Taxable' : 'Exempt'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      PKR {formatMoney(m.defaultAmount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.description || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Allowance Allocations */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Employee Allowance Allocations</h3>
            <p className="text-xs text-slate-500">
              Dynamic individual allocations reconciled to canonical PostgreSQL records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="allowance-employee" className="text-xs text-slate-500 font-medium">
                Select Personnel:
              </label>
              <select
                id="allowance-employee"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                disabled={activeEmployees.length === 0}
                className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold min-w-[230px] max-w-[360px] focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
              >
                {activeEmployees.length === 0 && <option value="">No ACTIVE employees available</option>}
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.name || emp.employeeCode || emp.id}
                    {' ('}
                    {emp.employeeCode || emp.id}
                    {')'}
                    {emp.designation ? ` — ${emp.designation}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {canManage && (
              <button
                onClick={() => {
                  setAssignForm({
                    allowanceId: masters[0]?.id || '',
                    amount: masters[0]?.defaultAmount || '',
                    remarks: ''
                  })
                  setIsAssignModalOpen(true)
                }}
                disabled={activeEmployees.length === 0 || masters.length === 0 || salaryCheckLoading || Boolean(salaryCheckError) || !hasVerifiedSalary(selectedEmployee)}
                title={salaryCheckLoading ? 'Checking salary structures...' : salaryCheckError || (!hasVerifiedSalary(selectedEmployee) ? 'Assign Initial Salary Structure first' : 'Assign Allowance')}
                className="px-3 py-1.5 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <i className="fa-solid fa-plus text-[11px]"></i>
                <span>Assign Allowance</span>
              </button>
            )}
          </div>
        </div>

        {selectedEmployee && !salaryCheckLoading && (salaryCheckError || !hasVerifiedSalary(selectedEmployee)) && (
          <div className="px-5 py-2 bg-amber-50 text-amber-900 border-b border-amber-200 text-xs" role="alert">
            {salaryCheckError || 'Initial Salary Structure missing. Assign salary in Salary Structures & Compensation before adding allowances. Existing historical allowances remain visible.'}
          </div>
        )}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">
            Total Monthly Dynamic Allowances for Selected Personnel:{' '}
            <strong className="text-slate-900">{selectedEmployee?.name || selectedEmployee?.employeeCode || '—'}</strong>
          </span>
          <span className="text-sm font-black text-emerald-800 font-mono">
            PKR {formatMoney(totalAllocated)} / month
          </span>
        </div>

        {/* Status Filters: All / Active / Revoked / Expired */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-lg">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE', label: 'Active' },
              { id: 'REVOKED', label: 'Revoked' },
              { id: 'EXPIRED', label: 'Expired' }
            ].map((tab) => {
              const isCurrent = statusFilter === tab.id
              const count = statusCounts[tab.id] || 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${isCurrent
                      ? 'bg-navy-950 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isCurrent ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredAllowances.length}</strong> of{' '}
            <strong className="text-slate-800">{employeeAllowances.length}</strong> historical records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Personnel</th>
                <th className="px-4 py-3">Allowance Type</th>
                <th className="px-4 py-3 text-right">Monthly Amount</th>
                <th className="px-4 py-3">Effective Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned By</th>
                <th className="px-4 py-3">Revoked By</th>
                <th className="px-4 py-3">Audit Remarks</th>
                <th className="px-4 py-3 text-right whitespace-nowrap min-w-[200px] w-[200px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                    Loading allocations from PostgreSQL...
                  </td>
                </tr>
              ) : filteredAllowances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    {selectedEmpId
                      ? `No ${statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} allowance allocations recorded for this personnel in PostgreSQL.`
                      : 'Select personnel to view allocations.'}
                  </td>
                </tr>
              ) : (
                filteredAllowances.map((a) => {
                  const currentStatus = a.computedStatus || a.status || 'Active'
                  const isActive = currentStatus === 'Active'
                  const isRevoked = currentStatus === 'Revoked'
                  const isExpired = currentStatus === 'Expired'

                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {selectedEmployee?.name || a.employeeName || selectedEmployee?.employeeCode || a.employeeCode}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {selectedEmployee?.employeeCode || a.employeeCode || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {a.name} ({a.code})
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                            {a.category}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${a.isTaxable ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                          >
                            {a.isTaxable ? 'Taxable' : 'Exempt'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-slate-900 font-mono">PKR {formatMoney(a.amount)}</div>
                        <div className="text-[10px] text-slate-400">/ month</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[11px] text-slate-700 whitespace-nowrap">
                          <span className="text-slate-400">From:</span> {formatDate(a.effectiveFrom)}
                        </div>
                        <div className="text-[11px] text-slate-700 whitespace-nowrap">
                          <span className="text-slate-400">To:</span>{' '}
                          {a.effectiveUntil ? formatDate(a.effectiveUntil) : 'Ongoing (Active)'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isRevoked
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                        >
                          {isActive && <i className="fa-solid fa-circle-check text-[9px]"></i>}
                          {isRevoked && <i className="fa-solid fa-ban text-[9px]"></i>}
                          {isExpired && <i className="fa-solid fa-clock-rotate-left text-[9px]"></i>}
                          <span>{currentStatus}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="text-[11px] font-medium text-slate-800">
                          {formatAssignedBy(a.assignedBy || a.approvedBy)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatDateTime(a.assignedAt || a.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {isRevoked || a.revokedBy ? (
                          <>
                            <div className="text-[11px] font-medium text-rose-700">
                              {formatRevokedBy(a.revokedBy)}
                            </div>
                            <div className="text-[10px] text-rose-500 font-mono">
                              {formatDateTime(a.revokedAt || a.updatedAt)}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <div className="max-w-[180px] truncate text-slate-600" title={a.remarks || 'Standard assignment'}>
                          {a.remarks || 'Standard assignment'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap min-w-[200px] w-[200px]">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap shrink-0 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(a)}
                            title="View complete allocation history & audit trail"
                            className="h-7 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap flex-nowrap shrink-0 cursor-pointer leading-none"
                          >
                            <i className="fa-solid fa-eye text-[10px]"></i>
                            <span className="whitespace-nowrap inline-block">View Details</span>
                          </button>
                          {canManage && isActive && (
                            <button
                              type="button"
                              onClick={() => handleOpenRevokeModal(a)}
                              title="Revoke allocation with required reason"
                              className="h-7 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap flex-nowrap shrink-0 cursor-pointer leading-none"
                            >
                              <i className="fa-solid fa-ban text-[10px]"></i>
                              <span className="whitespace-nowrap inline-block">Revoke</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notice on Double-Counting Prevention */}
      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
        <i className="fa-solid fa-shield-halved mt-0.5 text-blue-600"></i>
        <div>
          <span className="font-bold">Double-Counting Protection Active:</span> Base salary structure allowances (House
          Rent, Medical, Conveyance, Special) remain isolated in core payroll snapshots. The dynamic benefit allowances
          managed on this register are audited separately in PostgreSQL to prevent duplicate earnings calculations.
        </div>
      </div>

      {/* Modal: Add Allowance Category */}
      {isMasterModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold">Add Corporate Allowance Category</h4>
                <p className="text-xs text-slate-300">Creates new master allowance definition in PostgreSQL</p>
              </div>
              <button onClick={() => setIsMasterModalOpen(false)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCreateMaster} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FUEL or MOBILE"
                    value={masterForm.code}
                    onChange={(e) => setMasterForm({ ...masterForm, code: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomCategory(!isAddingCustomCategory)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                    >
                      {isAddingCustomCategory ? '✕ Cancel' : '+ Add Custom Category'}
                    </button>
                  </div>

                  {isAddingCustomCategory ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        placeholder="e.g. Wellness, Education..."
                        className="flex-1 px-3 py-2 border border-blue-400 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomCategory}
                        className="px-2.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shrink-0 transition"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={masterForm.category}
                      onChange={(e) => setMasterForm({ ...masterForm, category: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Allowance Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fuel &amp; Transport Allowance"
                  value={masterForm.name}
                  onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Standard (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={masterForm.defaultAmount}
                    onChange={(e) => setMasterForm({ ...masterForm, defaultAmount: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax Treatment</label>
                  <select
                    value={masterForm.isTaxable ? 'true' : 'false'}
                    onChange={(e) => setMasterForm({ ...masterForm, isTaxable: e.target.value === 'true' })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                  >
                    <option value="true">Taxable (Normal)</option>
                    <option value="false">Exempt from Tax</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Corporate policy terms, applicability..."
                  value={masterForm.description}
                  onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMasterModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  <span>Save Allowance Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Assign Allowance to Employee */}
      {isAssignModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold">Assign Allowance Allocation</h4>
                <p className="text-xs text-slate-300">Audited allocation linked to PostgreSQL</p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleAssignAllowance} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Personnel:</span>
                  <span className="font-bold text-navy-950 text-left">
                    {selectedEmployee?.name || selectedEmployee?.employeeCode}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Designation:</span>
                  <span className="text-slate-700 text-left">
                    {selectedEmployee?.designation || selectedEmployee?.designationTitle || 'Staff'}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="text-slate-700 text-left">
                    {selectedEmployee?.department || selectedEmployee?.departmentName || 'Operations'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Allowance Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignForm.allowanceId}
                  onChange={(e) => {
                    const selId = e.target.value
                    const found = masters.find((m) => m.id === selId || m.code === selId)
                    setAssignForm({
                      ...assignForm,
                      allowanceId: selId,
                      amount: found?.defaultAmount ? String(found.defaultAmount) : assignForm.amount
                    })
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                >
                  <option value="">Select allowance...</option>
                  {masters.map((m) => (
                    <option key={m.id || m.code} value={m.id || m.code}>
                      {m.name} ({m.code}) — PKR {formatMoney(m.defaultAmount)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monthly Allocated Amount (PKR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 15000"
                  value={assignForm.amount}
                  onChange={(e) => setAssignForm({ ...assignForm, amount: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Remarks / Justification</label>
                <input
                  type="text"
                  placeholder="e.g. Field assignment transport subsidy"
                  value={assignForm.remarks}
                  onChange={(e) => setAssignForm({ ...assignForm, remarks: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || salaryCheckLoading || !hasVerifiedSalary(selectedEmployee)}
                  className="px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  <span>Confirm Allocation</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: View Allocation Details & Complete Audit Trail */}
      {isDetailModalOpen && detailTarget && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => {
            setIsDetailModalOpen(false)
            setDetailTarget(null)
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 bg-navy-950 text-white flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-file-invoice text-blue-400"></i>
                  Allowance Allocation Audit Trail
                </h4>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  PostgreSQL Record ID: {detailTarget.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false)
                  setDetailTarget(null)
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Personnel Details */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Personnel Details</div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Personnel:</span>
                  <span className="font-bold text-navy-950">
                    {detailTarget.employeeName || selectedEmployee?.name || selectedEmployee?.employeeCode}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Employee Code:</span>
                  <span className="font-mono text-slate-700">
                    {detailTarget.employeeCode || selectedEmployee?.employeeCode || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Designation:</span>
                  <span className="text-slate-700">
                    {selectedEmployee?.designation || selectedEmployee?.designationTitle || 'Staff'}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="text-slate-700">
                    {selectedEmployee?.department || selectedEmployee?.departmentName || 'Operations'}
                  </span>
                </div>
              </div>

              {/* Allowance & Financial Terms */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Allowance & Financial Terms
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Allowance:</span>
                  <span className="font-bold text-slate-900">
                    {detailTarget.name} ({detailTarget.code})
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Category:</span>
                  <span className="text-slate-700">{detailTarget.category}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Taxability:</span>
                  <span
                    className={
                      detailTarget.isTaxable ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'
                    }
                  >
                    {detailTarget.isTaxable ? 'Taxable (Subject to regular payroll tax)' : 'Tax Exempt'}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Monthly Amount:</span>
                  <span className="font-bold text-emerald-800 font-mono text-sm">
                    PKR {formatMoney(detailTarget.amount)} / month
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Lifecycle Status:</span>
                  <span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${(detailTarget.computedStatus || detailTarget.status) === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : (detailTarget.computedStatus || detailTarget.status) === 'Revoked'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                    >
                      {(detailTarget.computedStatus || detailTarget.status) === 'Active' && (
                        <i className="fa-solid fa-circle-check text-[9px]"></i>
                      )}
                      {(detailTarget.computedStatus || detailTarget.status) === 'Revoked' && (
                        <i className="fa-solid fa-ban text-[9px]"></i>
                      )}
                      {(detailTarget.computedStatus || detailTarget.status) === 'Expired' && (
                        <i className="fa-solid fa-clock-rotate-left text-[9px]"></i>
                      )}
                      <span>{detailTarget.computedStatus || detailTarget.status || 'Active'}</span>
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Effective Period:</span>
                  <span className="text-slate-700">
                    {formatDate(detailTarget.effectiveFrom)} →{' '}
                    {detailTarget.effectiveUntil ? formatDate(detailTarget.effectiveUntil) : 'Ongoing (Active)'}
                  </span>
                </div>
              </div>

              {/* Audit Attribution Trail */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Audit Attribution Trail
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Assigned By:</span>
                  <span className="font-semibold text-slate-800">
                    {formatAssignedBy(detailTarget.assignedBy || detailTarget.approvedBy)}
                  </span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Assigned Date:</span>
                  <span className="font-mono text-slate-600">
                    {formatDateTime(detailTarget.assignedAt || detailTarget.createdAt)}
                  </span>
                </div>
                {(detailTarget.revokedBy || (detailTarget.computedStatus || detailTarget.status) === 'Revoked') && (
                  <>
                    <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                      <span className="text-slate-500 font-medium text-rose-600">Revoked By:</span>
                      <span className="font-semibold text-rose-700">
                        {formatRevokedBy(detailTarget.revokedBy)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
                      <span className="text-slate-500 font-medium text-rose-600">Revoked Date:</span>
                      <span className="font-mono text-rose-600">
                        {formatDateTime(detailTarget.revokedAt || detailTarget.updatedAt)}
                      </span>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-slate-500 font-medium mb-1">Audit Remarks / Justification:</div>
                  <div className="p-2.5 bg-white rounded border border-slate-200 text-slate-700 whitespace-pre-wrap font-mono text-[11px]">
                    {detailTarget.remarks || 'Standard assignment recorded without extra remarks.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false)
                  setDetailTarget(null)
                }}
                className="px-4 py-1.5 font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Confirm Allowance Revocation */}
      {isRevokeModalOpen && revokeTarget && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => {
            setIsRevokeModalOpen(false)
            setRevokeTarget(null)
            setRevokeReason('')
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 bg-rose-950 text-white flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-rose-400"></i>
                  Confirm Allowance Revocation
                </h4>
                <p className="text-xs text-rose-200">Deactivates allocation and preserves PostgreSQL audit history</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRevokeModalOpen(false)
                  setRevokeTarget(null)
                  setRevokeReason('')
                }}
                className="text-rose-300 hover:text-white"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleConfirmRevoke} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-rose-600"></i>
                  Audit Invariant: Historical Retention
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  This allocation will be marked <strong>Revoked</strong> with immediate effect and excluded from all future
                  monthly payroll totals. The historical allocation record and reasons will remain permanently retained in
                  PostgreSQL.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Personnel:</span>
                  <span className="font-bold text-slate-900">
                    {revokeTarget.employeeName || selectedEmployee?.name || selectedEmployee?.employeeCode}
                  </span>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Allowance:</span>
                  <span className="font-bold text-slate-900">
                    {revokeTarget.name} ({revokeTarget.code})
                  </span>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-baseline gap-2">
                  <span className="text-slate-500 font-medium">Monthly Amount:</span>
                  <span className="font-bold text-rose-700 font-mono">
                    PKR {formatMoney(revokeTarget.amount)} / month
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Revocation Reason / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Project transport phase finished; reassigned to standard tier; corporate policy revision..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  A specific reason is required for corporate governance and audit trail.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsRevokeModalOpen(false)
                    setRevokeTarget(null)
                    setRevokeReason('')
                  }}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!revokeReason.trim() || isSubmitting}
                  className="px-4 py-1.5 font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  <span>Confirm Revoke</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default AllowanceManagementTable
