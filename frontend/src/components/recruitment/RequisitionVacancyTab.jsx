import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Alert from '@/components/common/Alert'
import { cn } from '@/lib/utils'
import { employeeService } from '@/services/employeeService'

export function RequisitionVacancyTab({
  requisitions = [],
  vacancies = [],
  departments = [],
  teams = [],
  designations = [],
  currentUser = null,
  onCreateRequisition,
  onUpdateRequisition,
  onDeleteRequisition,
  onApproveRequisition,
  onRejectRequisition,
  onUpdateVacancy,
  onDeleteVacancy,
  onUpdateVacancyStatus,
  onSelectVacancyForFilter
}) {
  const [activeSubTab, setActiveSubTab] = useState('vacancies') // 'vacancies' | 'requisitions'
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [isCreateReqModalOpen, setIsCreateReqModalOpen] = useState(false)
  const [editingReq, setEditingReq] = useState(null)
  const [editingVacancy, setEditingVacancy] = useState(null)
  const [selectedReqForApproval, setSelectedReqForApproval] = useState(null)
  const [rejectionModalReq, setRejectionModalReq] = useState(null)
  const [rejectionReasonText, setRejectionReasonText] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  const [vacForm, setVacForm] = useState({
    title: '',
    departmentId: '',
    openPositions: 1,
    status: 'Open',
    targetDate: '',
    salaryMin: 150000,
    salaryMax: 220000
  })

  // Custom Employment Categories
  const [customEmploymentCategories, setCustomEmploymentCategories] = useState([])
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false)
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('')

  // Dynamic Departments, Teams, Designations from employeeService
  const [localDepartments, setLocalDepartments] = useState(() => employeeService.getDepartments())
  const [localTeams, setLocalTeams] = useState(() => employeeService.getTeams())
  const [localDesignations, setLocalDesignations] = useState(() => employeeService.getDesignations())

  useEffect(() => {
    const unsub = employeeService.subscribe(() => {
      setLocalDepartments(employeeService.getDepartments())
      setLocalTeams(employeeService.getTeams())
      setLocalDesignations(employeeService.getDesignations())
    })
    return () => unsub()
  }, [])

  // Custom Department and Team creation
  const [isAddingCustomDept, setIsAddingCustomDept] = useState(false)
  const [newCustomDeptName, setNewCustomDeptName] = useState('')
  const [isAddingCustomTeam, setIsAddingCustomTeam] = useState(false)
  const [newCustomTeamName, setNewCustomTeamName] = useState('')

  const handleAddCustomCategory = () => {
    const trimmed = (newCustomCategoryName || '').trim()
    if (!trimmed) return
    if (!customEmploymentCategories.includes(trimmed)) {
      const updated = [trimmed, ...customEmploymentCategories]
      setCustomEmploymentCategories(updated)
    }
    setReqForm((prev) => ({ ...prev, employmentCategory: trimmed }))
    setIsAddingCustomCategory(false)
    setNewCustomCategoryName('')
  }

  const handleAddCustomDepartment = () => {
    const trimmed = (newCustomDeptName || '').trim()
    if (!trimmed) return
    try {
      const code = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'DEPT'
      const newId = employeeService.saveDepartment({
        name: trimmed,
        code,
        status: 'Active',
        description: `${trimmed} Department`
      }, currentUser?.name || 'HR Administrator')
      setLocalDepartments(employeeService.getDepartments())
      setReqForm((prev) => ({
        ...prev,
        departmentId: newId,
        teamId: ''
      }))
      setIsAddingCustomDept(false)
      setNewCustomDeptName('')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add department')
    }
  }

  const handleAddCustomTeam = () => {
    const trimmed = (newCustomTeamName || '').trim()
    if (!trimmed) return
    if (!reqForm.departmentId) {
      setErrorMsg('Please select a department first before adding a team.')
      return
    }
    try {
      const code = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'TEAM'
      const newTeamId = employeeService.saveTeam({
        name: trimmed,
        code,
        departmentId: reqForm.departmentId,
        status: 'Active',
        description: `${trimmed} Team`
      }, currentUser?.name || 'HR Administrator')
      setLocalTeams(employeeService.getTeams())
      setReqForm((prev) => ({
        ...prev,
        teamId: newTeamId
      }))
      setIsAddingCustomTeam(false)
      setNewCustomTeamName('')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add team')
    }
  }

  // New Requisition Form State
  const [reqForm, setReqForm] = useState({
    jobTitle: '',
    departmentId: '',
    teamId: '',
    designationId: '',
    openPositions: 1,
    employmentCategory: 'Permanent',
    workingHoursBasis: 'Full-Time',
    workArrangement: 'Office',
    compensationBasis: 'Monthly',
    experienceLevel: '3 - 5 Years',
    skillsRequired: '',
    expectedJoiningDate: '2026-12-01',
    minSalary: 150000,
    maxSalary: 220000,
    priority: 'High',
    hiringReason: 'Project Expansion & New Feature Roadmap',
    jobDescription: ''
  })

  const userRole = (currentUser?.role || 'super_admin').toLowerCase()
  const canApprove = userRole === 'super_admin' || userRole === 'hr_admin'

  // Filtered Vacancies (Latest First descending)
  const filteredVacancies = vacancies
    .filter((v) => {
      if (statusFilter !== 'all' && (v.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        (v.title || '').toLowerCase().includes(q) ||
        (v.id || '').toLowerCase().includes(q) ||
        (v.departmentName || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dateA = a.createdDate || a.createdAt || a.id || ''
      const dateB = b.createdDate || b.createdAt || b.id || ''
      return dateB.localeCompare(dateA)
    })

  // Filtered Requisitions (Latest First descending)
  const filteredRequisitions = requisitions
    .filter((r) => {
      if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        (r.jobTitle || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.departmentName || '').toLowerCase().includes(q) ||
        (r.hiringManagerName || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dateA = a.createdDate || a.createdAt || a.id || ''
      const dateB = b.createdDate || b.createdAt || b.id || ''
      return dateB.localeCompare(dateA)
    })

  const handleOpenEdit = (req) => {
    setEditingReq(req)
    const allDesigs = (localDesignations.length > 0 ? localDesignations : designations) || []
    const matchingDesig = allDesigs.find(
      (d) => d.id === req.designationId || d.code === req.designationId ||
             (req.jobTitle && (d.title || d.name)?.toLowerCase() === req.jobTitle.toLowerCase())
    )
    const allDepts = (localDepartments.length > 0 ? localDepartments : departments) || []
    const matchingDept = allDepts.find(
      (d) => d.id === req.departmentId || d.code === req.departmentId ||
             (req.departmentName && d.name?.toLowerCase() === req.departmentName.toLowerCase())
    )

    setReqForm({
      jobTitle: req.jobTitle || matchingDesig?.title || matchingDesig?.name || '',
      departmentId: matchingDept?.id || req.departmentId || '',
      teamId: req.teamId || '',
      designationId: matchingDesig?.id || req.designationId || '',
      openPositions: req.openPositions || 1,
      employmentCategory: req.employmentCategory || 'Permanent',
      workingHoursBasis: req.workingHoursBasis || 'Full-Time',
      workArrangement: req.workArrangement || 'Office',
      compensationBasis: req.compensationBasis || req.salaryRange?.period || 'Monthly',
      experienceLevel: req.experienceLevel || '3 - 5 Years',
      skillsRequired: req.skillsRequired || '',
      expectedJoiningDate: req.expectedJoiningDate || '2026-12-01',
      minSalary: req.salaryRange?.min || 150000,
      maxSalary: req.salaryRange?.max || 220000,
      priority: req.priority || 'High',
      hiringReason: req.hiringReason || '',
      jobDescription: req.jobDescription || ''
    })
    setErrorMsg(null)
    setIsCreateReqModalOpen(true)
  }

  const handleOpenEditVacancy = (vac) => {
    setEditingVacancy(vac)
    setVacForm({
      title: vac.title || '',
      departmentId: vac.departmentId || '',
      openPositions: vac.openPositions || 1,
      status: vac.status || 'Open',
      targetDate: vac.targetDate || '',
      salaryMin: vac.salaryRange?.min || 150000,
      salaryMax: vac.salaryRange?.max || 220000
    })
    setErrorMsg(null)
  }

  const handleUpdateVacancySubmit = async (e) => {
    e.preventDefault()
    if (!editingVacancy) return
    try {
      setErrorMsg(null)
      if (onUpdateVacancy) {
        await onUpdateVacancy(editingVacancy.id || editingVacancy.cuid, {
          title: vacForm.title,
          departmentId: vacForm.departmentId,
          openPositions: Number(vacForm.openPositions) || 1,
          status: vacForm.status,
          targetDate: vacForm.targetDate,
          salaryMin: Number(vacForm.salaryMin) || 0,
          salaryMax: Number(vacForm.salaryMax) || 0
        })
      }
      setEditingVacancy(null)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update vacancy.')
    }
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    try {
      setErrorMsg(null)
      if (!reqForm.departmentId) {
        setErrorMsg('Please select a Department before submitting.')
        return
      }
      if (!reqForm.designationId) {
        setErrorMsg('Please select a Designation before submitting.')
        return
      }
      const payload = {
        ...reqForm,
        salaryRange: {
          min: Number(reqForm.minSalary),
          max: Number(reqForm.maxSalary),
          currency: 'PKR',
          period: reqForm.compensationBasis
        }
      }
      if (editingReq && onUpdateRequisition) {
        await onUpdateRequisition(editingReq.id, payload)
      } else if (editingReq) {
        const { apiClient } = await import('@/services/apiClient')
        const { syncRecruitment } = await import('@/services/backendSync')
        const targetId = editingReq.cuid || editingReq.id
        await apiClient.patch(`/recruitment/requisitions/${targetId}`, {
          departmentId: payload.departmentId,
          designationId: payload.designationId,
          openingsCount: Number(payload.openPositions) || 1,
          justification: payload.hiringReason || payload.jobTitle || 'Hiring Request',
          compensationBasis: payload.compensationBasis || 'Monthly',
          budgetRange: payload.salaryRange ? `PKR ${payload.salaryRange.min} - ${payload.salaryRange.max}` : null
        })
        await syncRecruitment()
      } else if (onCreateRequisition) {
        await onCreateRequisition(payload)
      }
      setIsCreateReqModalOpen(false)
      setEditingReq(null)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save requisition. Please try again.')
    }
  }

  const handleApproveConfirm = async () => {
    if (!selectedReqForApproval) return
    try {
      setErrorMsg(null)
      await onApproveRequisition(selectedReqForApproval.id)
      setSelectedReqForApproval(null)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to approve requisition.')
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectionModalReq) return
    if (!rejectionReasonText.trim()) {
      setErrorMsg('Rejection justification is required.')
      return
    }
    try {
      setErrorMsg(null)
      await onRejectRequisition(rejectionModalReq.id, rejectionReasonText)
      setRejectionModalReq(null)
      setRejectionReasonText('')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Submodule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            Job Requisitions & Vacancies
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Headcount requisitions, job vacancy listings, hiring approvals, and requisition workflows.
          </p>
        </div>
      </div>

      {/* Sub-Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveSubTab('vacancies'); setStatusFilter('all'); }}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
              activeSubTab === 'vacancies'
                ? "bg-white text-hrms-primary shadow-xs"
                : "text-slate-600 hover:text-hrms-primary hover:bg-white/50"
            )}
          >
            <AppIcon name="recruitment" className="w-3.5 h-3.5" />
            <span>Active Vacancies</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-blue-100 text-blue-800">
              {vacancies.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('requisitions'); setStatusFilter('all'); }}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
              activeSubTab === 'requisitions'
                ? "bg-white text-hrms-primary shadow-xs"
                : "text-slate-600 hover:text-hrms-primary hover:bg-white/50"
            )}
          >
            <AppIcon name="tasks" className="w-3.5 h-3.5" />
            <span>Hiring Requisitions</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-indigo-100 text-indigo-800">
              {requisitions.length}
            </span>
          </button>
        </div>

        {activeSubTab === 'requisitions' && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setEditingReq(null)
                setReqForm({
                  jobTitle: '',
                  departmentId: '',
                  teamId: '',
                  designationId: '',
                  openPositions: 1,
                  employmentCategory: 'Permanent',
                  workingHoursBasis: 'Full-Time',
                  workArrangement: 'Office',
                  compensationBasis: 'Monthly',
                  experienceLevel: '3 - 5 Years',
                  skillsRequired: '',
                  expectedJoiningDate: '2026-12-01',
                  minSalary: 150000,
                  maxSalary: 220000,
                  priority: 'High',
                  hiringReason: 'Project Expansion & New Feature Roadmap',
                  jobDescription: ''
                })
                setErrorMsg(null)
                setIsCreateReqModalOpen(true)
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-md bg-hrms-accent text-white hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <AppIcon name="plus" className="w-3.5 h-3.5" />
              <span>Create Requisition</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <Alert variant="danger" dismissible onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-hrms-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder={activeSubTab === 'vacancies' ? "Search vacancies..." : "Search requisitions..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-hrms-accent"
          />
          <AppIcon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs rounded-md border border-slate-300 bg-white font-medium"
          >
            <option value="all">All Statuses</option>
            {activeSubTab === 'vacancies' ? (
              <>
                <option value="open">Open</option>
                <option value="filled">Filled</option>
                <option value="on hold">On Hold</option>
                <option value="closed">Closed</option>
              </>
            ) : (
              <>
                <option value="approved">Approved</option>
                <option value="pending approval">Pending Approval</option>
                <option value="rejected">Rejected</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. VACANCIES VIEW TABLE */}
      {/* ============================================================== */}
      {activeSubTab === 'vacancies' && (
        <div className="bg-white rounded-lg border border-hrms-border overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Vacancy ID</th>
                  <th className="py-2.5 px-3">Job Title & Org</th>
                  <th className="py-2.5 px-3">Category & Arrangement</th>
                  <th className="py-2.5 px-3">Headcount (Filled / Open)</th>
                  <th className="py-2.5 px-3">Target Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredVacancies.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      No matching vacancies found.
                    </td>
                  </tr>
                ) : (
                  filteredVacancies.map((vac) => {
                    const isFullyFilled = vac.filledPositions >= vac.openPositions
                    return (
                      <tr key={vac.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-hrms-primary">{vac.id}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{vac.title}</div>
                          <div className="text-[11px] text-slate-500">{vac.departmentName} • {vac.teamName}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 mr-1">
                            {vac.employmentCategory}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                            {vac.workArrangement}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "font-bold font-mono px-2 py-0.5 rounded text-xs",
                              isFullyFilled ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                            )}>
                              {vac.filledPositions} / {vac.openPositions}
                            </span>
                            {isFullyFilled && (
                              <span className="text-[10px] font-semibold text-emerald-700">Filled</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {vac.targetDate}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={vac.status} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {onSelectVacancyForFilter && (
                              <button
                                type="button"
                                onClick={() => onSelectVacancyForFilter(vac.id)}
                                className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded"
                                title="Filter Candidates for this Vacancy"
                              >
                                View Candidates ({vac.applicantsCount || 0})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditVacancy(vac)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded transition-colors"
                              title="Edit Vacancy Details & Headcount"
                            >
                              Edit
                            </button>
                            {onUpdateVacancyStatus && (
                              <select
                                value={vac.status}
                                onChange={(e) => onUpdateVacancyStatus(vac.id, e.target.value)}
                                className="text-[11px] py-1 px-1.5 border border-slate-300 rounded bg-white text-slate-700 font-medium"
                              >
                                <option value="Open">Open</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Filled">Filled</option>
                                <option value="Closed">Closed</option>
                              </select>
                            )}
                            {onDeleteVacancy && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to delete vacancy ${vac.id}?`)) {
                                    await onDeleteVacancy(vac.id)
                                  }
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                                title="Delete Vacancy from PostgreSQL"
                              >
                                Delete
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
      )}

      {/* ============================================================== */}
      {/* 2. REQUISITIONS VIEW TABLE */}
      {/* ============================================================== */}
      {activeSubTab === 'requisitions' && (
        <div className="bg-white rounded-lg border border-hrms-border overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 whitespace-nowrap">Req ID</th>
                  <th className="py-2.5 px-3">Job Title & Department</th>
                  <th className="py-2.5 px-3">Hiring Manager</th>
                  <th className="py-2.5 px-3">Headcount</th>
                  <th className="py-2.5 px-3">Compensation Basis</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Approval Status</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-400">
                      No matching requisitions found.
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map((req) => (
                    <tr key={req.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-hrms-primary whitespace-nowrap">{req.id}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{req.jobTitle}</div>
                        <div className="text-[11px] text-slate-500">{req.departmentName} • {req.teamName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {req.hiringManagerName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {req.openPositions} Pos
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {(req.compensationBasis && String(req.compensationBasis).trim()) || (req.salaryRange?.period && String(req.salaryRange.period).trim()) || 'Monthly'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          req.priority === 'Urgent' ? "bg-rose-100 text-rose-800" :
                          req.priority === 'High' ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                        )}>
                          {req.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {req.status === 'Pending Approval' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 leading-tight whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Pending</span>
                          </span>
                        ) : req.status === 'Approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 leading-tight whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Approved</span>
                          </span>
                        ) : req.status === 'Rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 leading-tight whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <StatusBadge status={req.status} size="sm" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {(req.status === 'Pending Approval' || canApprove) && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(req)}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 whitespace-nowrap leading-tight transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {canApprove && req.status === 'Pending Approval' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedReqForApproval(req)}
                                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs whitespace-nowrap leading-tight transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectionModalReq(req)}
                                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 whitespace-nowrap leading-tight transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {req.status === 'Approved' && (
                            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 whitespace-nowrap">
                              <AppIcon name="check" className="w-3 h-3" />
                              Approved
                            </span>
                          )}
                          {onDeleteRequisition && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete requisition ${req.id}?`)) {
                                  await onDeleteRequisition(req.id)
                                }
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 whitespace-nowrap leading-tight transition-colors"
                              title="Delete Requisition from PostgreSQL"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CREATE REQUISITION MODAL */}
      {/* ============================================================== */}
      {isCreateReqModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-hrms-primary">
                  {editingReq ? 'Edit Hiring Requisition' : 'Submit Internal Hiring Requisition'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingReq ? 'Update requisition details, department or headcount targets' : 'Request authorized headcount for your team'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateReqModalOpen(false)
                  setEditingReq(null)
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Backend Engineer"
                    value={reqForm.jobTitle}
                    onChange={(e) => setReqForm({ ...reqForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-hrms-accent"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Department *</label>
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
                        className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0 transition"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={reqForm.departmentId}
                      onChange={(e) => {
                        const newDeptId = e.target.value
                        const matching = (localTeams.length > 0 ? localTeams : teams).filter(
                          (t) => (t.status || 'Active').toLowerCase() === 'active' && t.departmentId === newDeptId
                        )
                        setReqForm({
                          ...reqForm,
                          departmentId: newDeptId,
                          teamId: matching.length > 0 ? matching[0].id : '',
                          designationId: ''
                        })
                      }}
                      required
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                    >
                      <option value="">Select Department *</option>
                      {(localDepartments.length > 0 ? localDepartments : departments)
                        .filter((d) => (d.status || 'Active').toLowerCase() === 'active')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      {reqForm.departmentId && !((localDepartments.length > 0 ? localDepartments : departments).some((d) => d.id === reqForm.departmentId)) && (
                        <option value={reqForm.departmentId}>
                          {editingReq?.departmentName || 'Software Development'}
                        </option>
                      )}
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Assigned Team</label>
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
                        placeholder="e.g. Core Platform, QA Automation..."
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
                      value={reqForm.teamId}
                      onChange={(e) => setReqForm({ ...reqForm, teamId: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                    >
                      <option value="">General / Direct Department Team (Default)</option>
                      {(() => {
                        const allActiveTeams = (localTeams.length > 0 ? localTeams : teams).filter(
                          (t) => (t.status || 'Active').toLowerCase() === 'active'
                        )
                        const deptMatchingTeams = allActiveTeams.filter(
                          (t) => t.departmentId === reqForm.departmentId
                        )
                        const otherActiveTeams = allActiveTeams.filter(
                          (t) => t.departmentId !== reqForm.departmentId
                        )

                        if (deptMatchingTeams.length > 0) {
                          return (
                            <>
                              <optgroup label="Department Specific Teams">
                                {deptMatchingTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.code})
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Other Active Company Teams">
                                {otherActiveTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} — {t.departmentName || t.departmentId} ({t.code})
                                  </option>
                                ))}
                              </optgroup>
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

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation Master *</label>
                  <select
                    value={reqForm.designationId}
                    onChange={(e) => setReqForm({ ...reqForm, designationId: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="">Select Designation *</option>
                    {(localDesignations.length > 0 ? localDesignations : designations)
                      .filter((d) => (d.status || 'Active').toLowerCase() === 'active')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.title} {d.level ? `(${d.level})` : ''}
                        </option>
                      ))}
                    {reqForm.designationId && !((localDesignations.length > 0 ? localDesignations : designations).some((d) => d.id === reqForm.designationId)) && (
                      <option value={reqForm.designationId}>
                        {reqForm.jobTitle || editingReq?.jobTitle || 'Frontend Developer'}
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Open Positions *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={reqForm.openPositions}
                    onChange={(e) => setReqForm({ ...reqForm, openPositions: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Joining Date</label>
                  <input
                    type="date"
                    value={reqForm.expectedJoiningDate}
                    onChange={(e) => setReqForm({ ...reqForm, expectedJoiningDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Employment Category</label>
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
                        value={newCustomCategoryName}
                        onChange={(e) => setNewCustomCategoryName(e.target.value)}
                        placeholder="e.g. Consultant, Visiting Specialist..."
                        className="flex-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomCategory}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0 transition"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={reqForm.employmentCategory}
                      onChange={(e) => {
                        if (e.target.value === '__custom_new__') {
                          setIsAddingCustomCategory(true)
                        } else {
                          setReqForm({ ...reqForm, employmentCategory: e.target.value })
                        }
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Contract">Contract</option>
                      <option value="Intern">Intern</option>
                      <option value="Freelancer">Freelancer</option>
                      {customEmploymentCategories.map((c) => (
                        <option key={c} value={c}>
                          {c} (Custom)
                        </option>
                      ))}
                      {reqForm.employmentCategory &&
                        !['Permanent', 'Contract', 'Intern', 'Freelancer'].includes(reqForm.employmentCategory) &&
                        !customEmploymentCategories.includes(reqForm.employmentCategory) && (
                          <option value={reqForm.employmentCategory}>{reqForm.employmentCategory} (Custom)</option>
                        )}
                      <option value="__custom_new__">+ Add Custom Category...</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Arrangement</label>
                  <select
                    value={reqForm.workArrangement}
                    onChange={(e) => setReqForm({ ...reqForm, workArrangement: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Office">Office</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Field">Field Duty</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Compensation Basis</label>
                  <select
                    value={reqForm.compensationBasis}
                    onChange={(e) => setReqForm({ ...reqForm, compensationBasis: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Monthly + Commission">Monthly + Commission</option>
                    <option value="Hourly">Hourly</option>
                    <option value="Project">Project / Milestone</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={reqForm.priority}
                    onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Budget Minimum (PKR)</label>
                  <input
                    type="number"
                    step="5000"
                    value={reqForm.minSalary}
                    onChange={(e) => setReqForm({ ...reqForm, minSalary: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Budget Maximum (PKR)</label>
                  <input
                    type="number"
                    step="5000"
                    value={reqForm.maxSalary}
                    onChange={(e) => setReqForm({ ...reqForm, maxSalary: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Required Skills (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. React.js, Tailwind, Vite, TypeScript"
                  value={reqForm.skillsRequired}
                  onChange={(e) => setReqForm({ ...reqForm, skillsRequired: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hiring Reason & Business Need</label>
                <textarea
                  rows="2"
                  value={reqForm.hiringReason}
                  onChange={(e) => setReqForm({ ...reqForm, hiringReason: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateReqModalOpen(false)
                    setEditingReq(null)
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-hrms-accent text-white font-bold rounded-md hover:bg-blue-700 shadow-xs"
                >
                  {editingReq ? 'Save Changes' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT VACANCY MODAL */}
      {/* ============================================================== */}
      {editingVacancy && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Job Vacancy ({editingVacancy.id || editingVacancy.openingCode})
                </h3>
                <p className="text-xs text-slate-500">
                  Update vacancy title, department, target date or headcount positions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVacancy(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateVacancySubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={vacForm.title}
                  onChange={(e) => setVacForm({ ...vacForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={vacForm.departmentId}
                    onChange={(e) => setVacForm({ ...vacForm, departmentId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Headcount (Positions) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={vacForm.openPositions}
                    onChange={(e) => setVacForm({ ...vacForm, openPositions: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={vacForm.status}
                    onChange={(e) => setVacForm({ ...vacForm, status: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="Open">Open</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Filled">Filled</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={vacForm.targetDate}
                    onChange={(e) => setVacForm({ ...vacForm, targetDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Salary Min (PKR)</label>
                  <input
                    type="number"
                    value={vacForm.salaryMin}
                    onChange={(e) => setVacForm({ ...vacForm, salaryMin: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Salary Max (PKR)</label>
                  <input
                    type="number"
                    value={vacForm.salaryMax}
                    onChange={(e) => setVacForm({ ...vacForm, salaryMax: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingVacancy(null)}
                  className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPROVAL CONFIRMATION MODAL */}
      {selectedReqForApproval && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-slate-900 mb-2">Approve Hiring Requisition</h3>
            <p className="text-xs text-slate-600 mb-4">
              Authorize <strong>{selectedReqForApproval.openPositions} position(s)</strong> for{' '}
              <strong>{selectedReqForApproval.jobTitle}</strong> ({selectedReqForApproval.departmentName}).
              Approving this requisition will immediately create and open the public job vacancy.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedReqForApproval(null)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                className="px-4 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Confirm Approval & Open Vacancy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectionModalReq && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-rose-700 mb-1">Reject Hiring Requisition</h3>
            <p className="text-xs text-slate-500 mb-3">
              Provide justification for declining headcount for <strong>{rejectionModalReq.jobTitle}</strong>.
            </p>
            <textarea
              rows="3"
              required
              placeholder="e.g. Budget deferral until next fiscal quarter or headcount freeze."
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md mb-4 focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRejectionModalReq(null)}
                className="px-3.5 py-1.5 font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                className="px-4 py-1.5 font-bold rounded-md bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
              >
                Reject Requisition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RequisitionVacancyTab
