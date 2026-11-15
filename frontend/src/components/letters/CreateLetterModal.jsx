import React, { useState, useEffect } from 'react'
import AppIcon from '@/components/common/AppIcon'
import hrLettersService from '@/services/hrLettersService'
import employeeService from '@/services/employeeService'

export default function CreateLetterModal({
  isOpen,
  onClose,
  initialTemplate = null,
  currentUser = null,
  onCreateDraft,
  onIssueDirect
}) {
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [step, setStep] = useState(1) // 1: Template, 2: Employee, 3: Custom Values, 4: Preview
  const [templates, setTemplates] = useState([])
  const [employees, setEmployees] = useState([])

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const [customValues, setCustomValues] = useState({
    effectiveDate: new Date().toISOString().slice(0, 10),
    revisedSalary: '',
    incrementAmount: '',
    newDesignation: '',
    relievingDate: new Date().toISOString().slice(0, 10),
    probationExtensionDays: '60',
    trainingCourse: 'Enterprise Architecture & Cloud Security',
    customSubject: '',
    customContent: ''
  })

  const [renderedSubject, setRenderedSubject] = useState('')
  const [renderedBody, setRenderedBody] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    const initModal = async () => {
      try {
        let tList = hrLettersService.getTemplates({ status: 'Active' }) || []
        if (tList.length === 0 && typeof hrLettersService.loadLettersDataAsync === 'function') {
          await hrLettersService.loadLettersDataAsync()
          if (!active) return
          tList = hrLettersService.getTemplates({ status: 'Active' }) || []
        }
        setTemplates(tList)

        const rawEmps = employeeService.getAllEmployees() || []
        const activeEmps = rawEmps.filter((e) => (e.status || e.employmentStatus || 'Active').toUpperCase() === 'ACTIVE')
        const eList = activeEmps.length > 0
          ? activeEmps
          : currentUser
            ? [{
                employeeId: currentUser.employeeId || currentUser.employeeCode || currentUser.id,
                id: currentUser.employeeId || currentUser.id,
                name: currentUser.name || currentUser.username || 'Employee',
                department: currentUser.department || 'Operations',
                designation: currentUser.designation || 'Staff Member',
                status: 'Active'
              }]
            : []
        setEmployees(eList)

        if (initialTemplate) {
          setSelectedTemplate(initialTemplate)
          setStep(2)
        } else if (tList.length > 0) {
          setSelectedTemplate(tList[0])
          setStep(1)
        }

        if (eList.length > 0) {
          setSelectedEmployee(eList[0])
        }
      } catch {
        if (!active) return
        setTemplates([])
        setEmployees([])
      }
      setErrorMsg('')
    }
    initModal()
    return () => { active = false }
  }, [isOpen, initialTemplate])

  // Recalculate rendered preview whenever template, employee or customValues change
  useEffect(() => {
    if (selectedTemplate && selectedEmployee) {
      const subj =
        customValues.customSubject ||
        hrLettersService.interpolatePlaceholders(
          selectedTemplate.subject,
          selectedEmployee,
          customValues,
          currentUser
        )

      const bodyText = customValues.customContent || selectedTemplate.body
      const mergedBody = hrLettersService.interpolatePlaceholders(
        bodyText,
        selectedEmployee,
        customValues,
        currentUser
      )

      setRenderedSubject(subj)
      setRenderedBody(mergedBody)
    }
  }, [selectedTemplate, selectedEmployee, customValues, currentUser])

  if (!isOpen) return null

  const handleCustomChange = (e) => {
    const { name, value } = e.target
    setCustomValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleNextStep = () => {
    setErrorMsg('')
    if (step === 1 && !selectedTemplate) {
      setErrorMsg('Please select a template.')
      return
    }
    if (step === 2 && !selectedEmployee) {
      setErrorMsg('Please select an employee.')
      return
    }
    setStep((prev) => Math.min(prev + 1, 4))
  }

  const handlePrevStep = () => {
    setErrorMsg('')
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const _buildLetterPayload = (extra = {}) => ({
    templateId: selectedTemplate.templateId,
    employeeId: selectedEmployee.employeeId || selectedEmployee.id,
    letterType: selectedTemplate.letterType,
    customSubject: renderedSubject,
    customContent: customValues.customContent || renderedBody,
    customValues,
    effectiveDate: customValues.effectiveDate,
    isProtectedSalary: selectedTemplate.isProtectedSalary,
    ...extra
  })

  const handleSaveAsDraft = async () => {
    if (isSubmitting) return
    setErrorMsg('')
    setIsSubmitting(true)
    try {
      await onCreateDraft(_buildLetterPayload({ submitNow: false }))
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save draft.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitApproval = async () => {
    if (isSubmitting) return
    setErrorMsg('')
    setIsSubmitting(true)
    try {
      await onCreateDraft(_buildLetterPayload({ submitNow: true }))
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to submit letter for approval.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDirectIssue = async () => {
    if (isSubmitting) return
    setErrorMsg('')
    setIsSubmitting(true)
    try {
      await onIssueDirect(_buildLetterPayload())
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to directly issue letter.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="award" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Generate Official HR Letter
              </h3>
              <p className="text-xs text-slate-500">
                Step {step} of 4: {step === 1 ? 'Select Template' : step === 2 ? 'Select Recipient' : step === 3 ? 'Customize Fields' : 'Document Preview & Issuance'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <AppIcon name="xmark" className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 border-b border-slate-100 text-center text-xs font-semibold">
          {[
            { num: 1, label: '1. Template' },
            { num: 2, label: '2. Recipient' },
            { num: 3, label: '3. Parameters' },
            { num: 4, label: '4. Preview' }
          ].map((st) => (
            <div
              key={st.num}
              className={`py-2.5 border-b-2 transition-colors ${
                step === st.num
                  ? 'border-blue-600 text-blue-700 bg-blue-50/30'
                  : step > st.num
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-slate-400'
              }`}
            >
              {st.label}
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AppIcon name="alertCircle" className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Select Template */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Choose Letter Template
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.templateId}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`p-3.5 rounded-xl border cursor-pointer text-left transition-all ${
                      selectedTemplate?.templateId === tmpl.templateId
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {tmpl.letterType}
                      </span>
                      {tmpl.isProtectedSalary && (
                        <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-0.5">
                          <AppIcon name="lock" className="w-2.5 h-2.5" />
                          Protected
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-2">
                      {tmpl.templateName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {tmpl.subject}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2">
                      Signatory: {tmpl.authorizedSignatory} (v{tmpl.version})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Select Recipient Employee */}
          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Select Recipient Employee
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
                {employees.map((emp) => (
                  <div
                    key={emp.employeeId || emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`p-3.5 rounded-xl border cursor-pointer text-left transition-all ${
                      (selectedEmployee?.employeeId || selectedEmployee?.id) === (emp.employeeId || emp.id)
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{emp.name}</div>
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      {emp.employeeId || emp.id} • {emp.department}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Designation: <span className="font-medium text-slate-700">{emp.designation}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Joined: {emp.joiningDate || '2024-01-15'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Customize Parameters */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{selectedEmployee?.name}</span> ({selectedEmployee?.designation})
                  <div className="text-slate-500">{selectedTemplate?.templateName}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                  {selectedTemplate?.letterType}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    name="effectiveDate"
                    value={customValues.effectiveDate}
                    onChange={handleCustomChange}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                {selectedTemplate?.isProtectedSalary && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Approved Revised Salary (PKR)
                      </label>
                      <input
                        type="number"
                        name="revisedSalary"
                        placeholder="e.g. 195000"
                        value={customValues.revisedSalary}
                        onChange={handleCustomChange}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Approved Increment Amount (PKR)
                      </label>
                      <input
                        type="number"
                        name="incrementAmount"
                        placeholder="e.g. 35000"
                        value={customValues.incrementAmount}
                        onChange={handleCustomChange}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </>
                )}

                {selectedTemplate?.letterType === 'Promotion Letter' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Promoted Designation *
                    </label>
                    <input
                      type="text"
                      name="newDesignation"
                      placeholder="e.g. Lead Solutions Architect"
                      value={customValues.newDesignation}
                      onChange={handleCustomChange}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                )}

                {(selectedTemplate?.letterType === 'Experience Letter' ||
                  selectedTemplate?.letterType === 'Relieving Letter' ||
                  selectedTemplate?.letterType === 'Resignation Acceptance Letter') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Last Working / Relieving Date *
                    </label>
                    <input
                      type="date"
                      name="relievingDate"
                      value={customValues.relievingDate}
                      onChange={handleCustomChange}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject Override (Optional)
                  </label>
                  <input
                    type="text"
                    name="customSubject"
                    placeholder={selectedTemplate?.subject}
                    value={customValues.customSubject}
                    onChange={handleCustomChange}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Rendered Live Preview */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-950">Official Document Preview</span>
                  <div className="text-blue-700 text-[11px]">
                    Recipient: {selectedEmployee?.name} ({selectedEmployee?.employeeId || selectedEmployee?.id})
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-white rounded border border-blue-200 text-blue-800">
                  DRAFT STATE
                </span>
              </div>

              {/* A4 Letterhead Preview Box */}
              <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-xs font-serif text-slate-800 text-xs leading-relaxed space-y-4">
                {/* Header */}
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                  <span className="font-bold text-slate-800 tracking-wide">
                    {selectedTemplate?.headerText}
                  </span>
                  <span>Date: {new Date().toISOString().slice(0, 10)}</span>
                </div>

                {/* Recipient Details */}
                <div className="font-sans space-y-0.5">
                  <div className="font-bold text-slate-900 text-sm">{selectedEmployee?.name}</div>
                  <div className="text-slate-600">{selectedEmployee?.designation}</div>
                  <div className="text-slate-500 text-[11px]">
                    Department: {selectedEmployee?.department} • ID: {selectedEmployee?.employeeId || selectedEmployee?.id}
                  </div>
                </div>

                {/* Subject */}
                <div className="font-bold font-sans text-xs text-slate-900 border-l-2 border-blue-600 pl-2">
                  SUBJECT: {renderedSubject}
                </div>

                {/* Body Content */}
                <div className="whitespace-pre-wrap leading-relaxed text-slate-800 text-[12px] pt-2">
                  {renderedBody}
                </div>

                {/* Signatory Section */}
                <div className="pt-8 border-t border-slate-100 font-sans">
                  <div className="text-xs font-bold text-slate-900">
                    {selectedTemplate?.authorizedSignatory}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {selectedTemplate?.signatoryTitle}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    iSysware Software Solutions (Pvt) Ltd
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 text-center font-sans">
                  {selectedTemplate?.footerText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                Continue to Step {step + 1}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveAsDraft}
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitApproval}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 rounded-lg shadow-xs transition-colors"
                >
                  Submit for Approval
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleDirectIssue}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 rounded-lg shadow-xs transition-colors"
                  >
                    Directly Issue Letter
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
