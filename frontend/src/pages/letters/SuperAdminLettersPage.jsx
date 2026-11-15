import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import hrLettersService from '@/services/hrLettersService'
import AppIcon from '@/components/common/AppIcon'

import LettersSummaryCards from '@/components/letters/LettersSummaryCards'
import LetterTemplatesTable from '@/components/letters/LetterTemplatesTable'
import LetterTemplateModal from '@/components/letters/LetterTemplateModal'
import CreateLetterModal from '@/components/letters/CreateLetterModal'
import IssuedLettersTable from '@/components/letters/IssuedLettersTable'
import LetterPrintModal from '@/components/letters/LetterPrintModal'

export default function SuperAdminLettersPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'templates')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // States
  const [kpis, setKpis] = useState({})
  const [templates, setTemplates] = useState([])
  const [letters, setLetters] = useState([])

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateToEdit, setTemplateToEdit] = useState(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedInitialTemplate, setSelectedInitialTemplate] = useState(null)

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [selectedLetterForPrint, setSelectedLetterForPrint] = useState(null)

  const [actionNotice, setActionNotice] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [syncState, setSyncState] = useState(() => hrLettersService.getSyncState())

  const loadData = useCallback(() => {
    setSyncState(hrLettersService.getSyncState())
    try {
      setKpis(hrLettersService.getLettersKPIs(user) || {})
    } catch {
      setKpis({})
    }
    try {
      setTemplates(hrLettersService.getTemplates() || [])
    } catch {
      setTemplates([])
    }
    try {
      setLetters(hrLettersService.getLetters({}, user) || [])
    } catch {
      setLetters([])
    }
    try {
      setAuditLogs(hrLettersService.getAuditLogs() || [])
    } catch {
      setAuditLogs([])
    }
  }, [user])

  useEffect(() => {
    loadData()
    const unsubscribe = hrLettersService.subscribe(() => {
      loadData()
    })
    if (!authLoading && user) {
      hrLettersService.loadLettersDataAsync().catch(() => {})
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [loadData, authLoading, user])

  const handleRetryLoad = () => {
    hrLettersService.loadLettersDataAsync({ force: true }).catch(() => {})
  }

  const triggerNotice = (msg, type = 'success') => {
    setActionNotice({ msg, type })
    setTimeout(() => setActionNotice(null), 4000)
  }

  // Template Handlers
  const handleSaveTemplate = async (tmplData) => {
    try {
      const saved = await hrLettersService.saveTemplateAsync(tmplData)
      triggerNotice(`Letter template '${saved.templateName}' (v${saved.version}) saved to PostgreSQL.`)
      setIsTemplateModalOpen(false)
      setTemplateToEdit(null)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  // Letter Generation Handlers
  const handleCreateDraft = async (data) => {
    try {
      const created = await hrLettersService.createLetterDraftAsync(data)
      if (data.submitNow) {
        triggerNotice(`Letter #${created.letterId} drafted and submitted for executive approval.`)
      } else {
        triggerNotice(`Letter draft #${created.letterId} saved in register.`)
      }
      setIsCreateModalOpen(false)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleDirectIssue = async (data) => {
    try {
      const issued = await hrLettersService.createLetterDraftAsync({ ...data, directIssue: true })
      triggerNotice(`Letter officially issued with reference '${issued.referenceNumber}'.`)
      setIsCreateModalOpen(false)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleSubmitApproval = async (letterId) => {
    try {
      await hrLettersService.submitForApprovalAsync(letterId)
      triggerNotice(`Letter #${letterId} submitted for executive approval.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleApprove = async (letterId) => {
    try {
      await hrLettersService.approveLetterAsync(letterId, 'Executive Super Admin Signoff')
      triggerNotice(`Letter #${letterId} authorized by Super Admin. Ready for issuance.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleReject = async (letterId) => {
    try {
      await hrLettersService.rejectLetterAsync(letterId, 'Returned for revision')
      triggerNotice(`Letter #${letterId} rejected and returned to draft.`, 'error')
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleIssueLetter = async (letterId) => {
    try {
      const issued = await hrLettersService.issueLetterAsync(letterId)
      triggerNotice(`Letter published with immutable reference '${issued.referenceNumber}'.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="award" className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'register'
                ? 'Issued Letters Register'
                : activeTab === 'approvals'
                ? 'Multi-Tier Approval Queue'
                : activeTab === 'audit'
                ? 'Generation Logs & Verification'
                : 'Template Master & Dynamic Variables'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'register'
              ? 'Comprehensive chronological archive of all generated and issued HR letters with printable watermarks.'
              : activeTab === 'approvals'
              ? 'Multi-tier executive approval queue for confidential remuneration, increment, and termination letters.'
              : activeTab === 'audit'
              ? 'Tamper-evident verification logs, cryptographic signatures, and letter issuance audit history.'
              : 'Corporate letter templates, variable token tags, authorized signatures, and formal formatting.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedInitialTemplate(null)
              setIsCreateModalOpen(true)
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            Generate Letter
          </button>
          <button
            onClick={() => {
              setTemplateToEdit(null)
              setIsTemplateModalOpen(true)
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="fileText" className="w-3.5 h-3.5" />
            New Template
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AppIcon
              name={actionNotice.type === 'error' ? 'alertCircle' : 'check'}
              className="w-4 h-4 shrink-0"
            />
            <span>{actionNotice.msg}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-60 hover:opacity-100">
            <AppIcon name="xmark" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <LettersSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      {(activeTab === 'templates' || !activeTab) && (
        <LetterTemplatesTable
          templates={templates}
          currentUser={user}
          onEditTemplate={(t) => {
            setTemplateToEdit(t)
            setIsTemplateModalOpen(true)
          }}
          onUseTemplate={(t) => {
            setSelectedInitialTemplate(t)
            setIsCreateModalOpen(true)
          }}
          onPreviewTemplate={(t) => {
            setTemplateToEdit(t)
            setIsTemplateModalOpen(true)
          }}
        />
      )}

      {activeTab === 'register' && (
        <IssuedLettersTable
          letters={letters}
          currentUser={user}
          isLoading={authLoading || syncState.isLoading}
          loadError={syncState.error}
          hasLoaded={syncState.hasLoadedOnce}
          onRetry={handleRetryLoad}
          onViewPrint={(ltr) => {
            setSelectedLetterForPrint(ltr)
            setIsPrintModalOpen(true)
          }}
          onSubmitApproval={handleSubmitApproval}
          onApprove={handleApprove}
          onReject={handleReject}
          onIssueLetter={handleIssueLetter}
        />
      )}

      {activeTab === 'approvals' && (
        <IssuedLettersTable
          letters={letters.filter((l) => l.status === 'Pending Approval')}
          currentUser={user}
          isLoading={authLoading || syncState.isLoading}
          loadError={syncState.error}
          hasLoaded={syncState.hasLoadedOnce}
          onRetry={handleRetryLoad}
          onViewPrint={(ltr) => {
            setSelectedLetterForPrint(ltr)
            setIsPrintModalOpen(true)
          }}
          onApprove={handleApprove}
          onReject={handleReject}
          onIssueLetter={handleIssueLetter}
        />
      )}

      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">
            Corporate Document Governance & Issuance Audit Register
          </h3>
          <div className="space-y-3">
            {(() => {
              const combinedItems = [
                ...auditLogs.map((log) => ({
                  ref: log.entityId,
                  action: log.actionType,
                  by: log.actorEmployeeCode ? `${log.actorRole} (${log.actorEmployeeCode})` : log.actorRole,
                  remarks: log.notes,
                  at: log.createdAt
                })),
                ...letters.flatMap((l) =>
                  (l.auditTrail || []).map((a) => ({
                    ...a,
                    letterId: l.letterId,
                    ref: l.referenceNumber,
                    subject: l.subject
                  }))
                )
              ].sort((a, b) => new Date(b.at) - new Date(a.at))

              if (combinedItems.length === 0) {
                return (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No document governance or issuance audit records found.
                  </div>
                )
              }

              return combinedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 font-mono mr-2">
                      [{item.ref || item.letterId}]
                    </span>
                    <span className="font-semibold text-blue-700">{item.action}</span> by{' '}
                    <span className="font-medium text-slate-700">{item.by}</span>
                    {item.remarks && (
                      <span className="text-slate-500 ml-2 italic">"{item.remarks}"</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {new Date(item.at).toLocaleString()}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      <LetterTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false)
          setTemplateToEdit(null)
        }}
        templateToEdit={templateToEdit}
        onSaveTemplate={handleSaveTemplate}
      />

      <CreateLetterModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setSelectedInitialTemplate(null)
        }}
        initialTemplate={selectedInitialTemplate}
        currentUser={user}
        onCreateDraft={handleCreateDraft}
        onIssueDirect={handleDirectIssue}
      />

      <LetterPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false)
          setSelectedLetterForPrint(null)
        }}
        letter={selectedLetterForPrint}
      />
    </div>
  )
}
