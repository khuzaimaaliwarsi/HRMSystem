import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import StatusBadge from '@/components/common/StatusBadge'
import Alert from '@/components/common/Alert'
import { recruitmentService, normalizeDateString } from '@/services/recruitmentService'

export function OffersJoiningTab({
  offers = [],
  candidates = [],
  vacancies = [],
  departments = [],
  teams = [],
  designations = [],
  employees = [],
  currentUser = null,
  onCreateOffer,
  onUpdateOffer,
  onSubmitOfferForApproval,
  onApproveOffer,
  onRejectOffer,
  onIssueOffer,
  onRecordResponse,
  onConfirmJoining
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
  const [editingOfferId, setEditingOfferId] = useState(null)

  const [rejectingOffer, setRejectingOffer] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const [joiningModalOffer, setJoiningModalOffer] = useState(null)
  const [responseModalOffer, setResponseModalOffer] = useState(null)
  const [responseType, setResponseType] = useState('Accepted')
  const [declinedReason, setDeclinedReason] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Offer Form State
  const [offerForm, setOfferForm] = useState({
    candidateId: '',
    vacancyId: '',
    appliedRole: '',
    offeredDesignation: '',
    designationId: '',
    departmentId: '',
    teamId: '',
    reportingManagerId: 'EMP-003',
    employmentCategory: 'Permanent',
    workingHoursBasis: 'Full-Time',
    workArrangement: 'Hybrid',
    compensationBasis: 'Monthly',
    offeredSalary: 200000,
    proposedJoiningDate: '2026-11-20',
    probationDurationMonths: 3,
    benefitsSummary: 'Comprehensive Hospitalization & OPD Health Insurance, Mobile Device Subsidy',
    termsRemarks: 'Subject to clean reference checks and degree verification.',
    roleDeviationJustification: ''
  })

  // Joining Confirmation Form State
  const [joiningForm, setJoiningForm] = useState(() => ({
    actualJoiningDate: new Date().toISOString().slice(0, 10),
    allowFutureJoiningDate: false,
    departmentId: '',
    teamId: '',
    designationId: '',
    managerId: '',
    workArrangement: 'Office',
    employmentCategory: 'Permanent',
    compensationBasis: 'Monthly'
  }))

  const isManager = currentUser?.role === 'manager'
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const isHrAdmin = currentUser?.role === 'hr_admin'
  const canApprove = isSuperAdmin || isHrAdmin

  const filteredOffers = offers
    .filter((o) => {
      if (statusFilter !== 'all') {
        const s = (o.status || '').toLowerCase()
        const f = statusFilter.toLowerCase()
        if (f === 'pending approval' && (s === 'pending approval' || (o.approvalStatus || '').toLowerCase() === 'pending approval')) {
          // match
        } else if (f === 'draft' && (s === 'draft' || (o.approvalStatus || '').toLowerCase() === 'draft')) {
          // match
        } else if (s !== f) {
          return false
        }
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        (o.candidateName || '').toLowerCase().includes(q) ||
        (o.jobTitle || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.departmentName || '').toLowerCase().includes(q) ||
        (o.offeredDesignation || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dateA = a.proposedJoiningDate || a.createdDate || a.createdAt || a.id || ''
      const dateB = b.proposedJoiningDate || b.createdDate || b.createdAt || b.id || ''
      return dateB.localeCompare(dateA)
    })

  // Open Create Offer Modal
  const handleOpenCreateModal = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setModalMode('create')
    setEditingOfferId(null)

    // Select first eligible candidate
    const eligibleCand = candidates.find(c => c.stage === 'Final Evaluation' || c.stage === 'Offer Stage') || candidates[0]
    const candId = eligibleCand?.id || ''
    const candVac = vacancies.find(v => v.id === eligibleCand?.vacancyId) || vacancies[0]

    let matchedDesig = null
    if (candVac?.designationId) {
      matchedDesig = designations.find(d => d.id === candVac.designationId)
    }
    if (!matchedDesig && (candVac?.designationName || eligibleCand?.vacancyTitle)) {
      const targetTitle = (candVac?.designationName || eligibleCand?.vacancyTitle || '').toLowerCase()
      matchedDesig = designations.find(
        d => d.name.toLowerCase() === targetTitle || d.name.toLowerCase().includes(targetTitle)
      )
    }
    if (!matchedDesig && designations.length > 0) {
      matchedDesig = designations[0]
    }

    const deptId = candVac?.departmentId || eligibleCand?.departmentId || matchedDesig?.departmentId || departments[0]?.id || 'DEP-01'
    const teamList = (teams || []).filter(t => t?.departmentId === deptId)
    const teamId = candVac?.teamId || ((teamList || []).length > 0 ? teamList[0].id : (teams?.[0]?.id || 'TEAM-01'))
    const salary = eligibleCand?.expectedSalary || (candVac?.salaryRange ? Math.round((candVac.salaryRange.min + candVac.salaryRange.max) / 2) : 200000)
    const joiningDate = normalizeDateString(eligibleCand?.availableFrom || candVac?.expectedJoiningDate || '2026-11-20')

    setOfferForm({
      candidateId: candId,
      vacancyId: candVac?.id || '',
      appliedRole: candVac?.designationName || candVac?.title || eligibleCand?.vacancyTitle || 'Software Engineer',
      offeredDesignation: matchedDesig ? matchedDesig.name : (candVac?.designationName || eligibleCand?.vacancyTitle || 'Software Engineer'),
      designationId: matchedDesig ? matchedDesig.id : (candVac?.designationId || 'DESIG-02'),
      departmentId: deptId,
      teamId: teamId,
      reportingManagerId: candVac?.hiringManagerId || 'EMP-003',
      employmentCategory: candVac?.employmentCategory || 'Permanent',
      workingHoursBasis: 'Full-Time',
      workArrangement: 'Hybrid',
      compensationBasis: 'Monthly',
      offeredSalary: salary,
      proposedJoiningDate: joiningDate,
      probationDurationMonths: 3,
      benefitsSummary: 'Comprehensive Hospitalization & OPD Health Insurance, Mobile Device Subsidy',
      termsRemarks: 'Subject to clean reference checks and degree verification.',
      roleDeviationJustification: ''
    })

    setIsOfferModalOpen(true)
  }

  // Open Edit Offer Modal
  const handleOpenEditModal = (offer) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setModalMode('edit')
    setEditingOfferId(offer.id)

    setOfferForm({
      candidateId: offer.candidateId,
      vacancyId: offer.vacancyId,
      appliedRole: offer.appliedRole || offer.jobTitle || '',
      offeredDesignation: offer.offeredDesignation || '',
      designationId: offer.designationId || '',
      departmentId: offer.departmentId || 'DEP-01',
      teamId: offer.teamId || 'TEAM-01',
      reportingManagerId: offer.reportingManagerId || 'EMP-003',
      employmentCategory: offer.employmentCategory || 'Permanent',
      workingHoursBasis: offer.workingHoursBasis || 'Full-Time',
      workArrangement: offer.workArrangement || 'Hybrid',
      compensationBasis: offer.compensationBasis || 'Monthly',
      offeredSalary: offer.offeredSalary || 200000,
      proposedJoiningDate: normalizeDateString(offer.proposedJoiningDate) || '2026-11-20',
      probationDurationMonths: offer.probationDurationMonths || 3,
      benefitsSummary: offer.benefitsSummary || '',
      termsRemarks: offer.termsRemarks || '',
      roleDeviationJustification: offer.roleDeviationJustification || ''
    })

    setIsOfferModalOpen(true)
  }

  // Candidate selection change in modal
  const handleCandidateChange = (candId) => {
    const cand = candidates.find(c => c.id === candId)
    if (!cand) {
      setOfferForm(prev => ({ ...prev, candidateId: '' }))
      return
    }
    const vac = vacancies.find(v => v.id === cand.vacancyId)

    let matchedDesig = null
    if (vac?.designationId) {
      matchedDesig = designations.find(d => d.id === vac.designationId)
    }
    if (!matchedDesig && (vac?.designationName || cand.vacancyTitle)) {
      const targetTitle = (vac?.designationName || cand.vacancyTitle || '').toLowerCase()
      matchedDesig = designations.find(
        d => d.name.toLowerCase() === targetTitle || d.name.toLowerCase().includes(targetTitle)
      )
    }
    if (!matchedDesig && designations.length > 0) {
      matchedDesig = designations[0]
    }

    const deptId = vac?.departmentId || cand.departmentId || matchedDesig?.departmentId || departments[0]?.id || 'DEP-01'
    const teamList = (teams || []).filter(t => t?.departmentId === deptId)
    const teamId = vac?.teamId || ((teamList || []).length > 0 ? teamList[0].id : (teams?.[0]?.id || 'TEAM-01'))
    const salary = cand.expectedSalary || (vac?.salaryRange ? Math.round((vac.salaryRange.min + vac.salaryRange.max) / 2) : 200000)
    const joiningDate = normalizeDateString(cand.availableFrom || vac?.expectedJoiningDate || '2026-11-20')

    setOfferForm(prev => ({
      ...prev,
      candidateId: candId,
      vacancyId: cand.vacancyId || vac?.id || '',
      appliedRole: vac?.designationName || vac?.title || cand.vacancyTitle || 'Software Engineer',
      offeredDesignation: matchedDesig ? matchedDesig.name : (vac?.designationName || cand.vacancyTitle || 'Software Engineer'),
      designationId: matchedDesig ? matchedDesig.id : (vac?.designationId || 'DESIG-02'),
      departmentId: deptId,
      teamId: teamId,
      reportingManagerId: vac?.hiringManagerId || prev.reportingManagerId || 'EMP-003',
      offeredSalary: salary,
      proposedJoiningDate: joiningDate,
      roleDeviationJustification: ''
    }))
  }

  // Designation selection change in modal
  const handleDesignationChange = (desigId) => {
    const des = designations.find(d => d.id === desigId)
    setOfferForm(prev => ({
      ...prev,
      designationId: desigId,
      offeredDesignation: des ? des.name : prev.offeredDesignation
    }))
  }

  // Calculate role deviation
  const selectedCandidate = candidates.find(c => c.id === offerForm.candidateId)
  const selectedVacancy = vacancies.find(v => v.id === (selectedCandidate?.vacancyId || offerForm.vacancyId))
  const appliedRole = selectedVacancy?.designationName || selectedVacancy?.title || selectedCandidate?.vacancyTitle || offerForm.appliedRole || ''
  const isRoleDeviated = Boolean(
    appliedRole &&
    offerForm.offeredDesignation &&
    offerForm.offeredDesignation.trim().toLowerCase() !== appliedRole.trim().toLowerCase()
  )

  // Save as Draft or Submit for Approval
  const handleSaveOffer = (asDraft) => {
    try {
      setErrorMsg(null)
      if (!offerForm.candidateId) {
        throw new Error('Please select a candidate.')
      }
      if (!offerForm.offeredSalary || Number(offerForm.offeredSalary) <= 0) {
        throw new Error('Please enter a valid salary amount.')
      }
      const normJoiningDate = normalizeDateString(offerForm.proposedJoiningDate)
      if (!normJoiningDate || !/^\d{4}-\d{2}-\d{2}$/.test(normJoiningDate)) {
        throw new Error('Please enter a valid proposed joining date (YYYY-MM-DD).')
      }

      if (isRoleDeviated && !asDraft && (!offerForm.roleDeviationJustification || !offerForm.roleDeviationJustification.trim())) {
        throw new Error(`Role deviation detected (Applied: '${appliedRole}', Offered: '${offerForm.offeredDesignation}'). Documented justification is required.`)
      }

      const payload = {
        ...offerForm,
        appliedRole,
        proposedJoiningDate: normJoiningDate,
        status: asDraft ? 'Draft' : 'Pending Approval',
        submitForApproval: !asDraft
      }

      if (modalMode === 'edit') {
        if (onUpdateOffer) {
          onUpdateOffer(editingOfferId, payload)
        } else {
          recruitmentService.updateOffer(editingOfferId, payload, currentUser?.name)
        }
        setSuccessMsg(asDraft ? `Offer ${editingOfferId} successfully updated and saved as Draft.` : `Offer ${editingOfferId} successfully submitted for approval.`)
      } else {
        if (onCreateOffer) {
          onCreateOffer(payload)
        } else {
          recruitmentService.createOffer(payload, currentUser?.name)
        }
        setSuccessMsg(asDraft ? 'Job offer successfully drafted and saved.' : 'Job offer created and submitted for executive approval.')
      }

      setIsOfferModalOpen(false)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  // Row actions
  const handleSubmitOfferRow = (offerId) => {
    try {
      setErrorMsg(null)
      if (onSubmitOfferForApproval) {
        onSubmitOfferForApproval(offerId)
      } else {
        recruitmentService.submitOfferForApproval(offerId, currentUser?.name)
      }
      setSuccessMsg(`Offer ${offerId} submitted for executive approval.`)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleApproveOfferRow = (offerId) => {
    try {
      setErrorMsg(null)
      if (onApproveOffer) {
        onApproveOffer(offerId)
      } else {
        recruitmentService.approveOffer(offerId, currentUser?.name)
      }
      setSuccessMsg(`Offer ${offerId} successfully approved.`)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleRejectOfferSubmit = (e) => {
    e.preventDefault()
    if (!rejectingOffer) return
    try {
      setErrorMsg(null)
      if (onRejectOffer) {
        onRejectOffer(rejectingOffer.id, rejectionReason)
      } else {
        recruitmentService.rejectOffer(rejectingOffer.id, rejectionReason, currentUser?.name)
      }
      setSuccessMsg(`Offer ${rejectingOffer.id} rejected.`)
      setRejectingOffer(null)
      setRejectionReason('')
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleIssueOfferRow = (offerId) => {
    try {
      setErrorMsg(null)
      if (onIssueOffer) {
        onIssueOffer(offerId)
      } else {
        recruitmentService.issueOffer(offerId, currentUser?.name)
      }
      setSuccessMsg(`Offer ${offerId} formally issued and dispatched to candidate.`)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleResponseSubmit = (e) => {
    e.preventDefault()
    if (!responseModalOffer) return
    try {
      setErrorMsg(null)
      if (onRecordResponse) {
        onRecordResponse(responseModalOffer.id, responseType, declinedReason)
      } else {
        recruitmentService.recordCandidateOfferResponse(responseModalOffer.id, responseType, declinedReason, currentUser?.name)
      }
      setResponseModalOffer(null)
      setDeclinedReason('')
      setSuccessMsg(`Offer response '${responseType}' recorded successfully.`)
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  const handleOpenJoiningModal = (offer) => {
    setErrorMsg(null)
    setJoiningModalOffer(offer)

    let matchedDesigId = offer.designationId
    if (!matchedDesigId && offer.offeredDesignation) {
      const match = designations.find(
        (d) => d.name.trim().toLowerCase() === offer.offeredDesignation.trim().toLowerCase()
      )
      if (match) matchedDesigId = match.id
    }
    if (!matchedDesigId && designations.length > 0) {
      matchedDesigId = designations[0].id
    }

    setJoiningForm({
      actualJoiningDate: new Date().toISOString().slice(0, 10),
      allowFutureJoiningDate: false,
      departmentId: offer.departmentId || 'DEP-01',
      teamId: offer.teamId || 'TEAM-01',
      designationId: matchedDesigId || 'DESIG-02',
      managerId: offer.reportingManagerId || 'EMP-003',
      workArrangement: offer.workArrangement || 'Office',
      employmentCategory: offer.employmentCategory || 'Permanent',
      compensationBasis: offer.compensationBasis || 'Monthly'
    })
  }

  const handleJoiningSubmit = (e) => {
    e.preventDefault()
    if (!joiningModalOffer) return
    try {
      setErrorMsg(null)
      const payload = {
        candidateId: joiningModalOffer.candidateId,
        offerId: joiningModalOffer.id,
        offeredDesignation: joiningModalOffer.offeredDesignation,
        ...joiningForm
      }
      let res
      if (onConfirmJoining) {
        res = onConfirmJoining(payload)
      } else {
        res = recruitmentService.convertCandidateToEmployee(payload, currentUser?.name)
      }
      setJoiningModalOffer(null)
      setSuccessMsg(
        `Candidate successfully onboarded! Canonical employee record ${res?.employee?.id || ''} created with active probation tracking.`
      )
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Submodule Header & Aligned Action Button — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            Offers & Joining
          </h1>
          <p className="text-xs text-hrms-muted mt-0.5">
            Employment offer packages, executive authorizations, signed agreements, and joining status.
          </p>
        </div>
        {!isManager && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-hrms-accent text-white hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            <span>Prepare Job Offer</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="danger" dismissible onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" dismissible onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-hrms-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search candidate, job, offer ID..."
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
            <option value="all">All Offers</option>
            <option value="draft">Draft</option>
            <option value="pending approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="issued">Issued</option>
            <option value="accepted">Accepted (Ready to Join)</option>
            <option value="joined">Joined</option>
            <option value="declined">Declined</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white rounded-lg border border-hrms-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Offer ID</th>
                <th className="py-2.5 px-3">Candidate & Vacancy</th>
                <th className="py-2.5 px-3">Offered Role & Dept</th>
                <th className="py-2.5 px-3">Proposed Joining</th>
                <th className="py-2.5 px-3">Offered Compensation</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">
                    No matching job offers found.
                  </td>
                </tr>
              ) : (
                filteredOffers.map((item) => {
                  const isDraft = item.status === 'Draft' || item.approvalStatus === 'Draft'
                  const isPending = item.status === 'Pending Approval' || item.approvalStatus === 'Pending Approval'
                  const isApproved = item.status === 'Approved' || (item.approvalStatus === 'Approved' && item.status !== 'Issued' && item.status !== 'Accepted' && item.status !== 'Joined' && item.status !== 'Declined')
                  const isIssued = item.status === 'Issued'
                  const isAccepted = item.status === 'Accepted' && !item.linkedEmployeeId
                  const isJoined = item.status === 'Joined' || Boolean(item.linkedEmployeeId)

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Offer ID */}
                      <td className="py-3 px-3 font-mono font-bold text-hrms-primary">{item.id}</td>

                      {/* Candidate */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.candidateName}</div>
                        <div className="text-[11px] text-slate-500">{item.jobTitle}</div>
                      </td>

                      {/* Offered Designation & Dept */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{item.offeredDesignation}</div>
                        <div className="text-[11px] text-slate-500">{item.departmentName} • {item.employmentCategory}</div>
                        {item.roleDeviationJustification && (
                          <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 border border-amber-200 inline-block max-w-xs truncate" title={`Role Justification: ${item.roleDeviationJustification}`}>
                            Justified: {item.roleDeviationJustification}
                          </div>
                        )}
                      </td>

                      {/* Proposed Joining */}
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {item.proposedJoiningDate}
                      </td>

                      {/* Offered Compensation */}
                      <td className="py-3 px-3 font-mono">
                        {isManager ? (
                          <span className="text-slate-400 italic text-[11px] flex items-center gap-1">
                            <AppIcon name="lock" className="w-2.5 h-2.5 text-slate-400" />
                            Confidential
                          </span>
                        ) : (
                          <span className="font-bold text-slate-900">
                            {Number(item.offeredSalary).toLocaleString()} PKR
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3">
                        <StatusBadge status={item.status || item.approvalStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1. DRAFT ACTIONS: Edit Offer & Submit for Approval */}
                          {isDraft && !isManager && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="px-2 py-1 text-[11px] font-bold rounded border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-2xs transition-colors"
                                title="Edit draft offer parameters"
                              >
                                <AppIcon name="edit" className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSubmitOfferRow(item.id)}
                                className="px-2 py-1 text-[11px] font-bold rounded bg-blue-600 text-white hover:bg-blue-700 shadow-2xs flex items-center gap-1 transition-colors"
                                title="Submit offer for executive management authorization"
                              >
                                <AppIcon name="check" className="w-3 h-3" />
                                <span>Submit for Approval</span>
                              </button>
                            </>
                          )}

                          {/* 2. PENDING APPROVAL ACTIONS: Approve / Reject (Authorized approvers) */}
                          {isPending && canApprove && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveOfferRow(item.id)}
                                className="px-2 py-1 text-[11px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs flex items-center gap-1 transition-colors"
                              >
                                <AppIcon name="check" className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingOffer(item)
                                  setRejectionReason('')
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded border border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center gap-1 transition-colors"
                              >
                                <AppIcon name="close" className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {/* 3. APPROVED ACTIONS: Issue Offer */}
                          {isApproved && !isManager && (
                            <button
                              type="button"
                              onClick={() => handleIssueOfferRow(item.id)}
                              className="px-2 py-1 text-[11px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs flex items-center gap-1 transition-colors"
                            >
                              <AppIcon name="mail" className="w-3 h-3" />
                              <span>Issue Offer</span>
                            </button>
                          )}

                          {/* 4. ISSUED ACTIONS: Record Candidate Response (Accepted / Declined) */}
                          {isIssued && !isManager && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null)
                                setResponseModalOffer(item)
                              }}
                              className="px-2 py-1 text-[11px] font-bold rounded border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                            >
                              <AppIcon name="document" className="w-3 h-3" />
                              <span>Record Response</span>
                            </button>
                          )}

                          {/* 5. ACCEPTED ACTIONS: Confirm Joining & Create Employee */}
                          {isAccepted && !isManager && (
                            <button
                              type="button"
                              onClick={() => handleOpenJoiningModal(item)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs flex items-center gap-1 transition-colors"
                            >
                              <AppIcon name="user" className="w-3 h-3" />
                              <span>Confirm Joining</span>
                            </button>
                          )}

                          {/* 6. JOINED: Read-only Employee Record */}
                          {isJoined && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <AppIcon name="check" className="w-3 h-3 text-emerald-600" />
                              <span>Joined ({item.linkedEmployeeId})</span>
                            </span>
                          )}

                          {/* Declined / Rejected status readouts if no actions applicable */}
                          {item.status === 'Declined' && (
                            <span className="text-[11px] text-slate-500 italic">Candidate Declined</span>
                          )}
                          {item.status === 'Rejected' && (
                            <span className="text-[11px] text-rose-600 italic">Offer Rejected</span>
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

      {/* ============================================================== */}
      {/* PREPARE / EDIT JOB OFFER MODAL */}
      {/* ============================================================== */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-xl w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-hrms-primary">
                  {modalMode === 'edit' ? `Edit Job Offer (${editingOfferId})` : 'Prepare Formal Job Offer'}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalMode === 'edit'
                    ? 'Update offer terms and either save as draft or submit for executive approval'
                    : 'Draft compensation and contractual terms for Super Admin authorization'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Candidate *</label>
                <select
                  required
                  disabled={modalMode === 'edit'}
                  value={offerForm.candidateId}
                  onChange={(e) => handleCandidateChange(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">-- Choose Candidate --</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — {c.vacancyTitle} (Stage: {c.stage})
                    </option>
                  ))}
                </select>
                {appliedRole && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Applied Position: <strong className="text-slate-700">{appliedRole}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department *</label>
                  <select
                    value={offerForm.departmentId}
                    onChange={(e) => {
                      const newDeptId = e.target.value
                      const deptTeams = (teams || []).filter(t => t?.departmentId === newDeptId)
                      setOfferForm({
                        ...offerForm,
                        departmentId: newDeptId,
                        teamId: (deptTeams || []).length > 0 ? deptTeams[0].id : ''
                      })
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    {departments.filter(d => (d.status || 'Active').toLowerCase() === 'active').map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Offered Designation Master *</label>
                  <select
                    value={offerForm.designationId}
                    onChange={(e) => handleDesignationChange(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    {designations.filter(d => (d.status || 'Active').toLowerCase() === 'active').map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role Deviation Justification Alert & Input */}
              {isRoleDeviated && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                    <AppIcon name="alert" className="w-3.5 h-3.5 text-amber-600" />
                    <span>Role Deviation Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Candidate applied for <strong>{appliedRole}</strong>, but the offered designation is <strong>{offerForm.offeredDesignation}</strong>. An explicit justification is required for management authorization.
                  </p>
                  <div>
                    <label className="block font-bold text-amber-900 mb-1">Role Deviation Justification *</label>
                    <textarea
                      rows="2"
                      required
                      placeholder="Explain business justification for offering a different role than originally applied..."
                      value={offerForm.roleDeviationJustification}
                      onChange={(e) => setOfferForm({ ...offerForm, roleDeviationJustification: e.target.value })}
                      className="w-full p-2 border border-amber-300 rounded-md bg-white text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Proposed Salary (PKR Monthly) *</label>
                  <input
                    type="number"
                    step="5000"
                    required
                    value={offerForm.offeredSalary}
                    onChange={(e) => setOfferForm({ ...offerForm, offeredSalary: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Proposed Joining Date (YYYY-MM-DD) *</label>
                  <input
                    type="date"
                    required
                    value={offerForm.proposedJoiningDate}
                    onChange={(e) => setOfferForm({ ...offerForm, proposedJoiningDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employment Category</label>
                  <select
                    value={offerForm.employmentCategory}
                    onChange={(e) => setOfferForm({ ...offerForm, employmentCategory: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Probation">Probation</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                    <option value="Freelancer">Freelancer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Compensation Basis</label>
                  <select
                    value={offerForm.compensationBasis}
                    onChange={(e) => setOfferForm({ ...offerForm, compensationBasis: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Monthly + Commission">Monthly + Commission</option>
                    <option value="Hourly">Hourly</option>
                    <option value="Project">Project / Milestone</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Arrangement</label>
                  <select
                    value={offerForm.workArrangement}
                    onChange={(e) => setOfferForm({ ...offerForm, workArrangement: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Office">Office</option>
                    <option value="Remote">Remote</option>
                    <option value="Field">Field Duty</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Probation Duration (Months)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={offerForm.probationDurationMonths}
                    onChange={(e) => setOfferForm({ ...offerForm, probationDurationMonths: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Benefits Package Summary</label>
                <input
                  type="text"
                  value={offerForm.benefitsSummary}
                  onChange={(e) => setOfferForm({ ...offerForm, benefitsSummary: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Terms & Conditions Remarks</label>
                <textarea
                  rows="2"
                  value={offerForm.termsRemarks}
                  onChange={(e) => setOfferForm({ ...offerForm, termsRemarks: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOfferModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOffer(true)}
                  className="px-4 py-2 bg-slate-700 text-white font-bold rounded-md hover:bg-slate-800 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <AppIcon name="edit" className="w-3.5 h-3.5" />
                  <span>Save as Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOffer(false)}
                  className="px-4 py-2 bg-hrms-accent text-white font-bold rounded-md hover:bg-blue-700 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <AppIcon name="check" className="w-3.5 h-3.5" />
                  <span>Submit for Approval</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REJECT OFFER MODAL */}
      {/* ============================================================== */}
      {rejectingOffer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-rose-900 mb-1">Reject Job Offer</h3>
            <p className="text-xs text-slate-500 mb-4">
              Rejecting offer <strong>{rejectingOffer.id}</strong> for candidate <strong>{rejectingOffer.candidateName}</strong> ({rejectingOffer.offeredDesignation}).
            </p>

            <form onSubmit={handleRejectOfferSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-rose-700 mb-1">Documented Rejection Reason *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Specify governance reasons for offer disapproval (e.g., budget exceeded, vacancy cancelled)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2 border border-rose-300 rounded-md text-xs focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingOffer(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 text-white font-bold rounded-md hover:bg-rose-700 shadow-xs"
                >
                  Confirm Disapproval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* RECORD CANDIDATE RESPONSE MODAL */}
      {/* ============================================================== */}
      {responseModalOffer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-md w-full p-5 border border-hrms-border text-left">
            <h3 className="text-base font-bold text-slate-900 mb-1">Record Candidate Decision</h3>
            <p className="text-xs text-slate-500 mb-4">
              Offer for <strong>{responseModalOffer.candidateName}</strong> ({responseModalOffer.jobTitle})
            </p>

            <form onSubmit={handleResponseSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Response Status *</label>
                <select
                  value={responseType}
                  onChange={(e) => setResponseType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-bold"
                >
                  <option value="Accepted">Accepted (Candidate Accepted Offer)</option>
                  <option value="Declined">Declined (Candidate Rejected Offer)</option>
                </select>
              </div>

              {responseType === 'Declined' && (
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Reason for Declining</label>
                  <textarea
                    rows="2"
                    required
                    placeholder="e.g. Candidate received higher counter-offer or relocated."
                    value={declinedReason}
                    onChange={(e) => setDeclinedReason(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResponseModalOffer(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-hrms-accent text-white font-bold rounded-md hover:bg-blue-700 shadow-xs"
                >
                  Save Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CONFIRM JOINING & CREATE EMPLOYEE MODAL */}
      {/* ============================================================== */}
      {joiningModalOffer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-hrms-modal max-w-lg w-full max-h-[90vh] overflow-y-auto border border-hrms-border text-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50/50">
              <div>
                <h3 className="text-base font-bold text-emerald-900">Confirm Candidate Joining & Onboard Staff</h3>
                <p className="text-xs text-slate-500">
                  Creates canonical employee record in `employeeService` and initializes probation tracking
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJoiningModalOffer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <AppIcon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleJoiningSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{joiningModalOffer.candidateName}</div>
                <div className="text-slate-600 text-[11px] font-mono">{joiningModalOffer.candidateEmail}</div>
                <div className="text-slate-500 text-[11px] mt-1">
                  Offered Role: <strong>{joiningModalOffer.offeredDesignation}</strong> ({joiningModalOffer.departmentName})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Actual Verified Joining Date (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  required
                  max={joiningForm.allowFutureJoiningDate ? undefined : new Date().toISOString().slice(0, 10)}
                  value={joiningForm.actualJoiningDate}
                  onChange={(e) => setJoiningForm({ ...joiningForm, actualJoiningDate: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono font-bold"
                />
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(joiningForm.allowFutureJoiningDate)}
                    onChange={(e) => setJoiningForm({ ...joiningForm, allowFutureJoiningDate: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-600 font-medium">
                    Approved Future Joining Exception (Allows actual joining date after today)
                  </span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Designation Master *</label>
                <select
                  value={joiningForm.designationId}
                  onChange={(e) => setJoiningForm({ ...joiningForm, designationId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                >
                  {designations.filter(d => (d.status || 'Active').toLowerCase() === 'active').map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Offered role: <strong className="text-slate-700">{joiningModalOffer.offeredDesignation}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department Assignment *</label>
                  <select
                    value={joiningForm.departmentId}
                    onChange={(e) => setJoiningForm({ ...joiningForm, departmentId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    {departments.filter(d => (d.status || 'Active').toLowerCase() === 'active').map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reporting Manager</label>
                  <select
                    value={joiningForm.managerId}
                    onChange={(e) => setJoiningForm({ ...joiningForm, managerId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="">Unassigned</option>
                    {employees.filter(e => e.status !== 'Separated' && e.status !== 'Inactive').map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.designation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Arrangement</label>
                  <select
                    value={joiningForm.workArrangement}
                    onChange={(e) => setJoiningForm({ ...joiningForm, workArrangement: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Office">Office</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="Field">Field Duty</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Compensation Basis</label>
                  <select
                    value={joiningForm.compensationBasis}
                    onChange={(e) => setJoiningForm({ ...joiningForm, compensationBasis: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Monthly + Commission">Monthly + Commission</option>
                    <option value="Hourly">Hourly</option>
                    <option value="Project">Project / Milestone</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-blue-900 flex items-start gap-2">
                <AppIcon name="info" className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Confirming this joining will link candidate <strong>{joiningModalOffer.candidateId}</strong> to a newly created Employee Master ID, increment the vacancy filled headcount, and automatically activate a 90-day probation review track.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJoiningModalOffer(null)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-700 shadow-xs"
                >
                  Confirm Joining & Create Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default OffersJoiningTab
