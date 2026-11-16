import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'
import { employeeService } from '@/services/employeeService'
import { shiftService } from '@/services/shiftService'
import { syncOrganization } from '@/services/backendSync'

const TODAY_STR = '2026-10-26'

function getInitialFormData(employee) {
  if (employee) {
    const existingBank = employeeService.getBankDetails(employee.id, 'super_admin', employee.id)
    return {
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      alternatePhone: employee.alternatePhone || '',
      gender: employee.gender || 'Male',
      dob: employee.dob || '1995-01-01',
      address: employee.address || '',
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
      cnic: employee.cnic || '',
      departmentId: employee.departmentId || '',
      subDepartmentId: employee.subDepartmentId || '',
      teamId: employee.teamId || '',
      designationId: employee.designationId || '',
      managerId: employee.managerId || '',
      employmentType: employee.employmentType || 'Permanent',
      workingHoursBasis: employee.workingHoursBasis || 'Full-Time',
      workArrangement: employee.workArrangement || 'Office',
      compensationBasis: employee.compensationBasis || 'Monthly',
      status: employee.status || 'Active',
      joinDate: employee.joinDate || TODAY_STR,
      shift: employee.shift || 'General Day (09:00 - 18:00)',
      bankName: employee.bankName || existingBank?.bankName || 'Meezan Bank Limited',
      branchName: employee.branchName || existingBank?.branchName || 'Main Branch, Islamabad',
      accountTitle: employee.accountTitle || existingBank?.accountTitle || employee.name || '',
      accountNumber: employee.accountNumber || existingBank?.fullAccountNumber || existingBank?.accountNumber || '',
      iban: employee.iban || existingBank?.fullIban || existingBank?.iban || '',
      preferredSalaryAccount: true,
      preferredCommissionAccount: true,
      effectiveDate: TODAY_STR,
      changeReason: ''
    }
  }
  return {
    name: '',
    email: '',
    phone: '',
    alternatePhone: '',
    gender: 'Male',
    dob: '1995-01-01',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    cnic: '',
    departmentId: '',
    subDepartmentId: '',
    teamId: '',
    designationId: '',
    managerId: '',
    employmentType: 'Permanent',
    workingHoursBasis: 'Full-Time',
    workArrangement: 'Office',
    compensationBasis: 'Monthly',
    status: 'Active',
    joinDate: TODAY_STR,
    shift: 'General Day (09:00 - 18:00)',
    bankName: 'Meezan Bank Limited',
    branchName: 'Main Branch, Islamabad',
    accountTitle: '',
    accountNumber: '',
    iban: '',
    preferredSalaryAccount: true,
    preferredCommissionAccount: true,
    effectiveDate: TODAY_STR,
    changeReason: ''
  }
}

export function EmployeeFormModal({
  isOpen,
  onClose,
  onSubmit,
  employee = null, // null for create, object for edit
  departments = [],
  subDepartments = [],
  teams = [],
  designations = [],
  allEmployees = [],
  actor = 'HR Administrator'
}) {
  const isEdit = Boolean(employee)

  const [activeTab, setActiveTab] = useState('basic')
  const [error, setError] = useState(null)

  // Custom Employment Categories
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const stored = localStorage.getItem('isysware_hrms_custom_employment_categories_v1')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Custom Department & Team additions
  const [isAddingCustomDept, setIsAddingCustomDept] = useState(false)
  const [newCustomDeptName, setNewCustomDeptName] = useState('')
  const [isAddingCustomTeam, setIsAddingCustomTeam] = useState(false)
  const [newCustomTeamName, setNewCustomTeamName] = useState('')
  const [isSavingCustomDept, setIsSavingCustomDept] = useState(false)

  // Form state initialized lazily
  const [formData, setFormData] = useState(() => getInitialFormData(employee))
  const [prevEmployee, setPrevEmployee] = useState(employee)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)

  // Reset or initialize state when modal opens or target employee changes
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setFormData(getInitialFormData(employee))
      setPrevEmployee(employee)
      setError(null)
      setActiveTab('basic')
    }
  } else if (employee !== prevEmployee) {
    setPrevEmployee(employee)
    setFormData(getInitialFormData(employee))
    setError(null)
    setActiveTab('basic')
  }

  if (!isOpen) return null

  const safeDepartments = (departments && departments.length > 0)
    ? departments
    : employeeService.getDepartments()
  const safeSubDepartments = (subDepartments && subDepartments.length > 0)
    ? subDepartments
    : employeeService.getSubDepartments()
  const safeTeams = (teams && teams.length > 0)
    ? teams
    : employeeService.getTeams()
  const safeDesignations = (designations && designations.length > 0)
    ? designations
    : employeeService.getDesignations()

  // Filter managers dynamically according to organizational hierarchy, assigned team leads, and managers
  const eligibleManagers = employeeService.getEligibleReportingManagers(
    formData.departmentId,
    formData.subDepartmentId,
    formData.teamId,
    employee?.id
  )

  const handleAddCustomCategory = () => {
    const trimmed = (newCategoryName || '').trim()
    if (!trimmed) return
    if (!customCategories.includes(trimmed)) {
      const updated = [trimmed, ...customCategories]
      setCustomCategories(updated)
      try {
        localStorage.setItem('isysware_hrms_custom_employment_categories_v1', JSON.stringify(updated))
      } catch {}
    }
    setFormData((prev) => ({ ...prev, employmentType: trimmed }))
    setIsAddingCustomCategory(false)
    setNewCategoryName('')
  }

  const handleAddCustomDepartment = async () => {
    const trimmed = (newCustomDeptName || '').trim()
    if (!trimmed) return
    setIsSavingCustomDept(true)
    try {
      const code = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'DEPT'
      // Save to PostgreSQL via API (not memory-only)
      const newId = await employeeService.saveDepartmentAsync({
        name: trimmed,
        code,
        status: 'Active',
        description: `${trimmed} Department`
      }, actor)
      // Sync from DB so local memory reflects real CUID
      await syncOrganization()
      setFormData((prev) => ({
        ...prev,
        departmentId: newId,
        teamId: ''
      }))
      setIsAddingCustomDept(false)
      setNewCustomDeptName('')
    } catch (err) {
      setError(err.message || 'Failed to add department. Please use the Organization Master to create departments first.')
    } finally {
      setIsSavingCustomDept(false)
    }
  }

  const handleAddCustomTeam = () => {
    const trimmed = (newCustomTeamName || '').trim()
    if (!trimmed) return
    if (!formData.departmentId) {
      setError('Please select a department first before adding a team.')
      return
    }
    try {
      const code = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'TEAM'
      const newTeamId = employeeService.saveTeam({
        name: trimmed,
        code,
        departmentId: formData.departmentId,
        status: 'Active',
        description: `${trimmed} Team`
      }, actor)
      setFormData((prev) => ({
        ...prev,
        teamId: newTeamId
      }))
      setIsAddingCustomTeam(false)
      setNewCustomTeamName('')
    } catch (err) {
      setError(err.message || 'Failed to add team')
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    let finalVal = type === 'checkbox' ? checked : value

    // 11-digit restriction for phone and numeric fields
    if (['phone', 'alternatePhone', 'emergencyContactPhone'].includes(name)) {
      if (typeof finalVal === 'string' && finalVal.length > 11) {
        finalVal = finalVal.slice(0, 11)
      }
    } else if (type === 'number' && typeof finalVal === 'string' && finalVal.length > 11) {
      finalVal = finalVal.slice(0, 11)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: finalVal
    }))
  }

  const handleDepartmentChange = (e) => {
    const newDeptId = e.target.value
    setError(null)
    setFormData((prev) => ({
      ...prev,
      departmentId: newDeptId,
      subDepartmentId: '',
      teamId: '',
      managerId: ''
    }))
  }

  const handleSubDepartmentChange = (e) => {
    const newSubDeptId = e.target.value
    setError(null)
    const chosenSubDept = safeSubDepartments.find(
      (sd) => sd.id === newSubDeptId || sd.code === newSubDeptId
    )
    setFormData((prev) => {
      let nextDeptId = prev.departmentId
      if (chosenSubDept && chosenSubDept.departmentId) {
        const matchingDept = safeDepartments.find(
          (d) => d.id === chosenSubDept.departmentId || d.code === chosenSubDept.departmentId
        )
        if (matchingDept) {
          nextDeptId = matchingDept.id
        } else {
          nextDeptId = chosenSubDept.departmentId
        }
      }
      return {
        ...prev,
        departmentId: nextDeptId,
        subDepartmentId: newSubDeptId,
        teamId: '',
        managerId: ''
      }
    })
  }

  const handleTeamChange = (e) => {
    const newTeamId = e.target.value
    setError(null)
    const newEligible = employeeService.getEligibleReportingManagers(formData.departmentId, formData.subDepartmentId, newTeamId, employee?.id)
    const recommended = newEligible.find((m) => m.recommended)
    setFormData((prev) => ({
      ...prev,
      teamId: newTeamId,
      managerId: recommended ? recommended.id : (prev.managerId && newEligible.some((m) => m.id === prev.managerId) ? prev.managerId : (newEligible[0]?.id || ''))
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Basic validation
    if (!formData.name.trim()) {
      setError('Employee full name is required.')
      setActiveTab('basic')
      return
    }
    if (!formData.email.trim()) {
      setError('Employee email is required.')
      setActiveTab('basic')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Please provide a valid email address.')
      setActiveTab('basic')
      return
    }
    if (!formData.departmentId) {
      // If user is in custom-dept add mode and typed a name but didn't click Add,
      // cancel the custom mode and show the dropdown so they can pick a valid dept
      if (isAddingCustomDept && newCustomDeptName.trim()) {
        setIsAddingCustomDept(false)
        setNewCustomDeptName('')
        setError('Please click the "Add" button to save your custom department first, then select it, or choose an existing department from the dropdown.')
      } else {
        setError('Please select a Department from Step 2 (Official & Org).')
      }
      setActiveTab('official')
      return
    }
    if (!formData.designationId) {
      setError('Please select a Designation from Step 2 (Official & Org).')
      setActiveTab('official')
      return
    }

    try {
      const submissionData = {
        ...formData,
        accountTitle: formData.accountTitle?.trim() || formData.name?.trim() || 'Account Holder'
      }
      if (submissionData.accountNumber && !submissionData.iban) {
        const cleanAcc = submissionData.accountNumber.replace(/\s+/g, '')
        submissionData.iban = `PK60MEZN000${cleanAcc.slice(-8)}`
      } else if (submissionData.iban && !submissionData.accountNumber) {
        submissionData.accountNumber = submissionData.iban.slice(-14)
      }
      await onSubmit(submissionData, actor)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save employee record.')
    }
  }

  const tabs = [
    { key: 'basic', label: '1. Basic & Contact' },
    { key: 'official', label: '2. Official & Org' },
    { key: 'classifications', label: '3. Classifications' },
    { key: 'bank', label: '4. Bank & Payment' },
    ...(isEdit ? [{ key: 'transfer', label: '5. Transfer & Reason' }] : [])
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-left">
      <div className="relative bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-hrms-primary tracking-tight">
              {isEdit ? `Edit Staff Profile: ${employee.name} (${employee.id})` : 'Onboard New Workforce Member'}
            </h3>
            <p className="text-xs text-hrms-muted mt-0.5">
              {isEdit
                ? 'Update organizational assignments, contact information, and bank details with effective dates.'
                : 'Enter canonical personnel details, reporting line, classifications, and initial terms.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-hrms-border bg-white flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-2 text-xs font-semibold rounded-t-md transition-all whitespace-nowrap border-b-2",
                activeTab === tab.key
                  ? "border-hrms-primary text-hrms-primary bg-slate-50 font-bold"
                  : "border-transparent text-hrms-muted hover:text-hrms-primary hover:bg-slate-50/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
            {error && (
              <Alert variant="danger" title="Validation Notice" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* TAB 1: BASIC INFORMATION */}
            {activeTab === 'basic' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name || ''}
                      onChange={handleChange}
                      placeholder="e.g. Tariq Mehmood"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Official Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleChange}
                      placeholder="e.g. tariq@isysware.com"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Mobile Phone <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                    </label>
                    <input
                      type="text"
                      name="phone"
                      maxLength={11}
                      value={formData.phone || ''}
                      onChange={handleChange}
                      placeholder="03001234567"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Alternate Phone <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                    </label>
                    <input
                      type="text"
                      name="alternatePhone"
                      maxLength={11}
                      value={formData.alternatePhone || ''}
                      onChange={handleChange}
                      placeholder="03219876543"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">CNIC (Optional)</label>
                    <input
                      type="text"
                      name="cnic"
                      value={formData.cnic || ''}
                      onChange={handleChange}
                      placeholder="37405-*******-1"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender || 'Male'}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other / Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob || '1995-01-01'}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-hrms-text mb-1">Residential Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                    placeholder="House, Street, Sector, City, Country"
                    className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Emergency Contact Person</label>
                    <input
                      type="text"
                      name="emergencyContactName"
                      value={formData.emergencyContactName || ''}
                      onChange={handleChange}
                      placeholder="e.g. Saima Siddiqui (Spouse)"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Emergency Contact Number <span className="text-[10px] text-slate-400 font-normal">(Max 11 digits)</span>
                    </label>
                    <input
                      type="text"
                      name="emergencyContactPhone"
                      maxLength={11}
                      value={formData.emergencyContactPhone || ''}
                      onChange={handleChange}
                      placeholder="03009999999"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: OFFICIAL & ORG ASSIGNMENTS */}
            {activeTab === 'official' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-hrms-text">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomDept(!isAddingCustomDept)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                      >
                        {isAddingCustomDept ? '✕ Cancel' : '+ Add Custom Dept'}
                      </button>
                    </div>

                    {isAddingCustomDept ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newCustomDeptName}
                          onChange={(e) => setNewCustomDeptName(e.target.value)}
                          placeholder="e.g. IT, Cloud & DevOps..."
                          className="flex-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomDepartment}
                          disabled={isSavingCustomDept}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md shrink-0 transition"
                        >
                          {isSavingCustomDept ? 'Saving...' : 'Add'}
                        </button>
                      </div>
                    ) : (
                      <select
                        name="departmentId"
                        value={formData.departmentId || ''}
                        onChange={handleDepartmentChange}
                        className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                        required
                      >
                        <option value="">Select Department</option>
                        {safeDepartments
                          .filter((d) => (d.status || 'Active').toLowerCase() === 'active')
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  {/* Sub-Department Selector (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Sub-Department <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      name="subDepartmentId"
                      value={formData.subDepartmentId || ''}
                      onChange={handleSubDepartmentChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="">No Sub-Department (Direct Dept)</option>
                      {(() => {
                        const selectedDept = safeDepartments.find(
                          (d) => d.id === formData.departmentId || d.code === formData.departmentId
                        )
                        const activeSubDepts = safeSubDepartments.filter(
                          (sd) => (sd.status || 'Active').toLowerCase() === 'active'
                        )
                        const deptMatchingSubDepts = formData.departmentId
                          ? activeSubDepts.filter((sd) => {
                              const matchesId = sd.departmentId === formData.departmentId
                              const matchesSelectedId = selectedDept && (sd.departmentId === selectedDept.id || sd.departmentId === selectedDept.code)
                              const matchesDeptName = selectedDept && sd.departmentName && sd.departmentName.toLowerCase() === selectedDept.name.toLowerCase()
                              return matchesId || matchesSelectedId || matchesDeptName
                            })
                          : activeSubDepts

                        const otherActiveSubDepts = activeSubDepts.filter(
                          (sd) => !deptMatchingSubDepts.includes(sd)
                        )

                        if (deptMatchingSubDepts.length > 0) {
                          return (
                            <>
                              <optgroup label={formData.departmentId ? "Department Specific Sub-Departments" : "Available Sub-Departments"}>
                                {deptMatchingSubDepts.map((sd) => (
                                  <option key={sd.id} value={sd.id}>
                                    {sd.name} ({sd.code})
                                  </option>
                                ))}
                              </optgroup>
                              {otherActiveSubDepts.length > 0 && (
                                <optgroup label="Other Active Company Sub-Departments">
                                  {otherActiveSubDepts.map((sd) => {
                                    const pDept = safeDepartments.find((d) => d.id === sd.departmentId || d.code === sd.departmentId)
                                    const deptLabel = pDept ? pDept.name : (sd.departmentName || '')
                                    return (
                                      <option key={sd.id} value={sd.id}>
                                        {sd.name} ({sd.code}) {deptLabel ? `— ${deptLabel}` : ''}
                                      </option>
                                    )
                                  })}
                                </optgroup>
                              )}
                            </>
                          )
                        }

                        return (
                          <optgroup label="All Active Company Sub-Departments">
                            {activeSubDepts.map((sd) => {
                              const pDept = safeDepartments.find((d) => d.id === sd.departmentId || d.code === sd.departmentId)
                              const deptLabel = pDept ? pDept.name : (sd.departmentName || '')
                              return (
                                <option key={sd.id} value={sd.id}>
                                  {sd.name} ({sd.code}) {deptLabel ? `— ${deptLabel}` : ''}
                                </option>
                              )
                            })}
                          </optgroup>
                        )
                      })()}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-hrms-text">Assigned Team</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomTeam(!isAddingCustomTeam)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                      >
                        {isAddingCustomTeam ? '✕ Cancel' : '+ Add Custom Team'}
                      </button>
                    </div>

                    {isAddingCustomTeam ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newCustomTeamName}
                          onChange={(e) => setNewCustomTeamName(e.target.value)}
                          placeholder="e.g. Core Engineering, QA..."
                          className="flex-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomTeam}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0 transition"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <select
                        name="teamId"
                        value={formData.teamId}
                        onChange={handleTeamChange}
                        className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                      >
                        <option value="">Direct Department Staff (General Team)</option>
                        {(() => {
                          const selectedDept = safeDepartments.find(
                            (d) => d.id === formData.departmentId || d.code === formData.departmentId
                          )
                          const allActiveTeams = safeTeams.filter(
                            (t) => (t.status || 'Active').toLowerCase() === 'active'
                          )
                          // Filter teams matching department and optional subDepartmentId
                          const deptMatchingTeams = allActiveTeams.filter((t) => {
                            const matchesDept = !formData.departmentId || 
                              t.departmentId === formData.departmentId || 
                              (selectedDept && (t.departmentId === selectedDept.id || t.departmentId === selectedDept.code))
                            if (!matchesDept) return false
                            if (formData.subDepartmentId) {
                              return t.subDepartmentId === formData.subDepartmentId
                            }
                            return true
                          })
                          const otherActiveTeams = allActiveTeams.filter(
                            (t) => !deptMatchingTeams.includes(t)
                          )

                          if (deptMatchingTeams.length > 0) {
                            return (
                              <>
                                <optgroup label={formData.subDepartmentId ? "Sub-Department Specific Teams" : (formData.departmentId ? "Department Specific Teams" : "Matching Teams")}>
                                  {deptMatchingTeams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name} ({t.code})
                                    </option>
                                  ))}
                                </optgroup>
                                {otherActiveTeams.length > 0 && (
                                  <optgroup label="Other Active Company Teams">
                                    {otherActiveTeams.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name} — {t.departmentName || t.departmentId} ({t.code})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </>
                            )
                          }

                          return (
                            <optgroup label="All Active Company Teams">
                              {allActiveTeams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} — {t.departmentName || t.departmentId} ({t.code})
                                </option>
                              ))}
                            </optgroup>
                          )
                        })()}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Designation <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="designationId"
                      value={formData.designationId || ''}
                      onChange={(e) => { setError(null); handleChange(e) }}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                      required
                    >
                      <option value="">Select Designation</option>
                      {safeDesignations
                        .filter((des) => (des.status || 'Active').toLowerCase() === 'active')
                        .map((des) => (
                          <option key={des.id} value={des.id}>
                            {des.title || des.name} {des.level ? `(${des.level})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-hrms-text">
                        Reporting Manager <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-blue-600 font-semibold">Hierarchy Aware</span>
                    </div>
                    <select
                      name="managerId"
                      value={formData.managerId}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="">No Direct Manager (Reports to Board / CEO)</option>
                      {eligibleManagers.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.recommended ? '⭐ ' : ''}{mgr.name} — {mgr.role} ({mgr.designation})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Official Joining Date</label>
                    <input
                      type="date"
                      name="joinDate"
                      value={formData.joinDate}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Assigned Shift Schedule</label>
                    <select
                      name="shift"
                      value={formData.shift}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      {(() => {
                        const shiftList = shiftService.getShifts().filter(s => (s.status || 'Active').toLowerCase() === 'active')
                        const renderedOptions = shiftList.map(s => {
                          const val = `${s.name} (${s.startTime} - ${s.endTime})`
                          return (
                            <option key={s.id} value={val}>
                              {s.name} ({s.startTime} – {s.endTime}) [{s.type || 'Fixed'}]
                            </option>
                          )
                        })
                        const hasCurrent = shiftList.some(s => `${s.name} (${s.startTime} - ${s.endTime})` === formData.shift || s.name === formData.shift)
                        return (
                          <>
                            {renderedOptions}
                            {formData.shift && !hasCurrent && (
                              <option value={formData.shift}>{formData.shift}</option>
                            )}
                          </>
                        )
                      })()}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: EMPLOYMENT CLASSIFICATIONS */}
            {activeTab === 'classifications' && (
              <div className="space-y-4">
                <p className="text-xs text-hrms-muted leading-relaxed bg-slate-50 p-2.5 rounded border border-hrms-border">
                  These operational dimensions are independent: an employee may be full-time while working remotely, or have an assigned team under a milestone agreement.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-hrms-text">Employment Category</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingCustomCategory(!isAddingCustomCategory)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-0.5"
                      >
                        {isAddingCustomCategory ? '✕ Cancel' : '+ Add Custom Category'}
                      </button>
                    </div>

                    {isAddingCustomCategory ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="e.g. Consultant, Daily Wage, Visiting..."
                            className="flex-1 text-xs px-3 py-2 rounded-md border border-blue-400 bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomCategory}
                            className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0 transition"
                          >
                            Add
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Custom categories are automatically remembered across the system.
                        </p>
                      </div>
                    ) : (
                      <select
                        name="employmentType"
                        value={formData.employmentType}
                        onChange={(e) => {
                          if (e.target.value === '__custom_new__') {
                            setIsAddingCustomCategory(true)
                          } else {
                            handleChange(e)
                          }
                        }}
                        className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                      >
                        <option value="Permanent">Permanent</option>
                        <option value="Probation">Probation (90 Days)</option>
                        <option value="Contract">Contract (Fixed Term)</option>
                        <option value="Intern">Intern</option>
                        <option value="Freelancer">Freelancer</option>
                        {customCategories.map((c) => (
                          <option key={c} value={c}>
                            {c} (Custom)
                          </option>
                        ))}
                        {formData.employmentType &&
                          !['Permanent', 'Probation', 'Contract', 'Intern', 'Freelancer'].includes(formData.employmentType) &&
                          !customCategories.includes(formData.employmentType) && (
                            <option value={formData.employmentType}>{formData.employmentType} (Custom)</option>
                          )}
                        <option value="__custom_new__">+ Add Custom Category...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Working Hours Basis</label>
                    <select
                      name="workingHoursBasis"
                      value={formData.workingHoursBasis}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="Full-Time">Full-Time (40 hrs/wk)</option>
                      <option value="Part-Time">Part-Time (20 hrs/wk)</option>
                      <option value="Hourly">Hourly Timesheet Based</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Work Arrangement</label>
                    <select
                      name="workArrangement"
                      value={formData.workArrangement}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="Office">Office Based</option>
                      <option value="Hybrid">Hybrid (Office + Remote)</option>
                      <option value="WFH">Work From Home (Full Remote)</option>
                      <option value="Field Duty">Field Duty (Client Visits)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Compensation Basis (Metadata Only)</label>
                    <select
                      name="compensationBasis"
                      value={formData.compensationBasis}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="Monthly">Monthly Salary</option>
                      <option value="Monthly + Commission">Monthly Salary + Commission</option>
                      <option value="Hourly">Hourly Rate</option>
                      <option value="Project">Project Based</option>
                      <option value="Milestone">Milestone Deliverable</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-hrms-text mb-1">Lifecycle Employment Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                  >
                    <option value="Active">Active</option>
                    <option value="Probation">On Probation</option>
                    <option value="On Leave">On Approved Leave</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Separated">Separated / Exited</option>
                  </select>
                  <span className="text-[10px] text-hrms-muted mt-1 block">
                    Note: Taking approved annual/casual leave is an attendance condition, not deactivation.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 4: BANK & PAYMENT DETAILS */}
            {activeTab === 'bank' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Financial Institution / Bank</label>
                    <select
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    >
                      <option value="Meezan Bank Limited">Meezan Bank Limited</option>
                      <option value="Habib Bank Limited (HBL)">Habib Bank Limited (HBL)</option>
                      <option value="Standard Chartered Bank">Standard Chartered Bank</option>
                      <option value="Bank Alfalah">Bank Alfalah</option>
                      <option value="Faysal Bank Limited">Faysal Bank Limited</option>
                      <option value="United Bank Limited (UBL)">United Bank Limited (UBL)</option>
                      <option value="MCB Bank Limited">MCB Bank Limited</option>
                      <option value="Allied Bank Limited (ABL)">Allied Bank Limited (ABL)</option>
                      <option value="Askari Bank Limited">Askari Bank Limited</option>
                      <option value="Dubai Islamic Bank">Dubai Islamic Bank</option>
                      <option value="Alternative / Direct Cheque">Alternative / Direct Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Branch Name & City</label>
                    <input
                      type="text"
                      name="branchName"
                      value={formData.branchName}
                      onChange={handleChange}
                      placeholder="e.g. F-7 Markaz Branch, Islamabad"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Account Title (Beneficiary Name)</label>
                    <input
                      type="text"
                      name="accountTitle"
                      value={formData.accountTitle}
                      onChange={handleChange}
                      placeholder="e.g. Tariq Mehmood"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Account Number</label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      placeholder="e.g. 01010102001001"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-hrms-text mb-1">International Bank Account Number (IBAN)</label>
                  <input
                    type="text"
                    name="iban"
                    value={formData.iban}
                    onChange={handleChange}
                    placeholder="PK60MEZN0001010102001001"
                    className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent font-mono uppercase"
                  />
                  <span className="text-[10px] text-hrms-muted mt-1 block">
                    Privacy Rule: Bank account numbers and IBAN are masked for regular employee display and strictly forbidden for manager view.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 5: TRANSFER & REASON (EDIT MODE ONLY) */}
            {activeTab === 'transfer' && isEdit && (
              <div className="space-y-3.5">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AppIcon name="security" className="w-4 h-4 text-amber-600" />
                    <span>Effective-Dated Governance Guard</span>
                  </div>
                  <p>
                    If the effective date is set in the future, the transfer is scheduled and recorded in career history, but the employee's current assignment is not altered until that date.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">
                      Effective Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="effectiveDate"
                      value={formData.effectiveDate}
                      onChange={handleChange}
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-hrms-text mb-1">Change Reason / Justification</label>
                    <input
                      type="text"
                      name="changeReason"
                      value={formData.changeReason}
                      onChange={handleChange}
                      placeholder="e.g. Promotion, Department Transfer, Re-alignment"
                      className="w-full text-xs px-3 py-2 rounded-md border border-hrms-border bg-white text-hrms-text focus:outline-none focus:ring-1 focus:ring-hrms-accent"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3.5 border-t border-hrms-border bg-slate-50 flex items-center justify-between">
            <div className="text-[11px] text-hrms-muted">
              Actor: <strong className="text-hrms-primary">{actor}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md border border-hrms-border text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-bold shadow-xs transition-colors"
              >
                {isEdit ? 'Save Changes' : 'Confirm Onboarding'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmployeeFormModal
