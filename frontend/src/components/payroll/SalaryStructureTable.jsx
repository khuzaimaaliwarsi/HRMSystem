import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../services/apiClient'

const unwrapList = (value) => {
  if (Array.isArray(value)) return value
  for (const key of ['employees', 'structures', 'items', 'results', 'data']) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}
const money = (value) => Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
import { fmtDate } from '../../lib/dateUtils'
export { fmtDate }
const emptyForm = () => ({
  employeeId: '', baseSalary: '', houseRentAllowance: '', medicalAllowance: '',
  conveyanceAllowance: '', specialAllowance: '', effectiveFrom: '', remarks: ''
})

export function SalaryStructureTable({
  structures: _parentStructures = [],
  onProposeRevision,
  onInitiateRevision,
  onStructureCreated,
  canPropose = true
}) {
  const { currentUser } = useAuth()
  const normalizedRole = String(currentUser?.backendRole || currentUser?.role || '')
    .toUpperCase().replace(/[^A-Z]/g, '')
  const canManage = ['SUPERADMIN', 'HRADMIN'].includes(normalizedRole)
  const handlePropose = onProposeRevision || onInitiateRevision
  const [searchTerm, setSearchTerm] = useState('')
  const [structures, setStructures] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [salaryResult, employeeResult] = await Promise.all([
        apiClient.get('/payroll/structures'),
        canManage ? apiClient.get('/employees?limit=200') : Promise.resolve([])
      ])
      setStructures(unwrapList(salaryResult))
      setEmployees(unwrapList(employeeResult))
    } catch (err) {
      setLoadError(err?.message || 'Unable to load salary structures from the database.')
      setStructures([])
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => { load() }, [load])

  const normalized = structures.map((s) => {
    const e = s.employee || {}
    const basicSalary = Number(s.baseSalary ?? s.basicSalary ?? 0)
    const totalAllowances = Number(s.totalAllowances ?? (
      Number(s.houseRentAllowance || 0) +
      Number(s.medicalAllowance || 0) +
      Number(s.conveyanceAllowance || 0) +
      Number(s.specialAllowance || 0)
    ))
    const grossSalary = Number(s.grossSalary ?? (basicSalary + totalAllowances))

    return {
      ...s,
      employeeName: [e.firstName, e.lastName].filter(Boolean).join(' ') || s.employeeName || 'Unknown employee',
      employeeCode: e.employeeCode || s.employeeCode || s.employeeId,
      departmentName: e.department?.name || s.department || '—',
      designationName: e.designation?.title || s.designation || '—',
      compensationBasis: s.compensationBasis || 'Monthly',
      basicSalary,
      totalAllowances,
      grossSalary,
      statusLabel: s.isCurrent === false ? 'Historical' : 'Active'
    }
  })

  const filtered = normalized.filter((s) => {
    const q = searchTerm.trim().toLowerCase()
    return !q || [s.employeeName, s.employeeCode, s.departmentName, s.designationName]
      .some((part) => String(part || '').toLowerCase().includes(q))
  })

  const currentEmployeeIds = new Set(
    structures.filter(s => s.isCurrent === true).map(s => s.employeeId)
  )
  const eligibleEmployees = employees.filter(e => e.id && !currentEmployeeIds.has(e.id))
  const selectedEmployee = employees.find(e => e.id === form.employeeId)
  const setField = (key, value) => setForm(old => ({ ...old, [key]: value }))

  const handleCreate = async (event) => {
    event.preventDefault()
    if (saving) return
    setFormError('')
    setMessage('')
    if (!canManage) return setFormError('Not authorized.')
    if (!selectedEmployee) return setFormError('Select a valid database employee.')
    if (currentEmployeeIds.has(selectedEmployee.id)) {
      return setFormError('This employee already has a current salary structure. Use the revision workflow.')
    }
    const base = Number(form.baseSalary)
    if (!form.baseSalary || !Number.isFinite(base) || base <= 0) {
      return setFormError('Enter a valid basic salary greater than zero.')
    }
    if (!form.effectiveFrom) return setFormError('Effective date is required.')
    const allowances = ['houseRentAllowance', 'medicalAllowance', 'conveyanceAllowance', 'specialAllowance']
    if (allowances.some(key => !Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
      return setFormError('Allowances must be zero or positive amounts.')
    }

    setSaving(true)
    try {
      // Refresh before writing, avoiding accidental supersession based on stale UI state.
      const latest = unwrapList(await apiClient.get('/payroll/structures?isCurrent=true'))
      if (latest.some(s => s.employeeId === form.employeeId && s.isCurrent === true)) {
        throw new Error('A current salary structure already exists. Refresh and use Salary Revision.')
      }
      await apiClient.post('/payroll/structures', {
        employeeId: form.employeeId,
        currency: 'PKR',
        baseSalary: base,
        houseRentAllowance: Number(form.houseRentAllowance || 0),
        medicalAllowance: Number(form.medicalAllowance || 0),
        conveyanceAllowance: Number(form.conveyanceAllowance || 0),
        specialAllowance: Number(form.specialAllowance || 0),
        effectiveFrom: form.effectiveFrom,
        remarks: form.remarks.trim()
      })
      setShowForm(false)
      setForm(emptyForm())
      setMessage('Salary structure saved in PostgreSQL.')
      await load()
      onStructureCreated?.()
    } catch (err) {
      setFormError(err?.message || 'Unable to save salary structure.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
            <AppIcon name="banking" className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Salary Structures &amp; Compensation Records</h3>
            <p className="text-xs text-slate-500">Database-backed salary structures and effective dates</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" placeholder="Search employee / role..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-56 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button type="button" onClick={load} disabled={loading}
            className="px-3 py-2 text-xs font-semibold border rounded-lg hover:bg-slate-100 disabled:opacity-50">Refresh</button>
          {canManage && <button type="button" onClick={() => { setFormError(''); setShowForm(true) }}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-navy-950 text-white hover:bg-navy-900">
            + Assign Initial Salary
          </button>}
        </div>
      </div>

      {message && <div className="m-4 p-3 text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">{message}</div>}
      {loadError && <div className="m-4 p-3 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg">{loadError}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3 text-right">Basic Salary</th>
              <th className="px-4 py-3 text-right">Total Allowances</th>
              <th className="px-4 py-3 text-right">Gross Salary</th>
              <th className="px-4 py-3">Effective Date</th>
              <th className="px-4 py-3">Status</th>
              {canPropose && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && !loadError && filtered.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 p-8">No salary structures found in PostgreSQL.</td></tr>}
            {loading && <tr><td colSpan={7} className="text-center text-slate-500 p-8">Loading salary structures...</td></tr>}
            {!loading && !loadError && filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3"><div className="font-bold text-slate-900">{s.employeeName}</div>
                  <div className="text-[10px] text-slate-400">{s.employeeCode} • {s.departmentName}</div></td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">PKR {money(s.basicSalary)}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-700">PKR {money(s.totalAllowances)}</td>
                <td className="px-4 py-3 text-right font-extrabold text-emerald-700">PKR {money(s.grossSalary)}</td>
                <td className="px-4 py-3">{fmtDate(s.effectiveFrom)}</td>
                <td className="px-4 py-3"><StatusBadge status={s.statusLabel} /></td>
                {canPropose && <td className="px-4 py-3 text-right">
                  {handlePropose && s.isCurrent === true && <button type="button"
                    onClick={() => handlePropose(s)}
                    className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border border-indigo-200">
                    Propose Revision
                  </button>}
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && canManage && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-label="Assign initial salary">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="bg-navy-950 text-white px-5 py-4 flex justify-between items-center">
              <div><h3 className="font-bold">Assign Initial Salary Structure</h3>
                <p className="text-xs text-slate-300">Creates an official PostgreSQL compensation record</p></div>
              <button type="button" disabled={saving} onClick={() => setShowForm(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{formError}</div>}
              <div><label className="block text-xs font-semibold mb-1">Employee *</label>
                <select value={form.employeeId} onChange={e => setField('employeeId', e.target.value)} className={inputClass} required>
                  <option value="">Select employee</option>
                  {eligibleEmployees.map(e => <option key={e.id} value={e.id}>
                    {[e.firstName, e.lastName].filter(Boolean).join(' ') || e.name} ({e.employeeCode || e.id})
                  </option>)}
                </select>
                {eligibleEmployees.length === 0 && <p className="text-xs text-amber-700 mt-1">No eligible employees found. Refresh or check existing active salary structures.</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold mb-1">Basic Salary (PKR) *</label>
                  <input type="number" min="0.01" step="0.01" required value={form.baseSalary} onChange={e => setField('baseSalary', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-semibold mb-1">Effective From *</label>
                  <input type="date" required value={form.effectiveFrom} onChange={e => setField('effectiveFrom', e.target.value)} className={inputClass} /></div>
                {[
                  ['houseRentAllowance', 'House Rent Allowance'],
                  ['medicalAllowance', 'Medical Allowance'],
                  ['conveyanceAllowance', 'Conveyance Allowance'],
                  ['specialAllowance', 'Special Allowance']
                ].map(([key, title]) => <div key={key}>
                  <label className="block text-xs font-semibold mb-1">{title} (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form[key]} onChange={e => setField(key, e.target.value)} className={inputClass} placeholder="0" />
                </div>)}
              </div>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm flex justify-between">
                <span>Gross Monthly Salary</span>
                <strong>PKR {money(Number(form.baseSalary || 0) + ['houseRentAllowance', 'medicalAllowance', 'conveyanceAllowance', 'specialAllowance'].reduce((total, key) => total + Number(form[key] || 0), 0))}</strong>
              </div>
              <p className="text-xs text-amber-700">Use this form only for initial salary setup. Existing salaries must be changed through the approved Salary Revision workflow. Do not duplicate allowances maintained separately.</p>
              <div><label className="block text-xs font-semibold mb-1">Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={e => setField('remarks', e.target.value)} className={inputClass} /></div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" disabled={saving} onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
                <button type="submit" disabled={saving || !eligibleEmployees.length} className="px-4 py-2 text-sm font-bold bg-navy-950 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Saving...' : 'Assign Initial Salary'}
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
export default SalaryStructureTable
