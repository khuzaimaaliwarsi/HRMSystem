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

export default function HrAdminLettersPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'register')

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

  const handleCreateDraft = async (data) => {
    try {
      const created = await hrLettersService.createLetterDraftAsync(data)
      if (data.submitNow) {
        triggerNotice(`Letter #${created.letterId} drafted and submitted for authorization.`)
      } else {
        triggerNotice(`Letter draft #${created.letterId} saved in register.`)
      }
      setIsCreateModalOpen(false)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const handleSubmitApproval = async (letterId) => {
    try {
      await hrLettersService.submitForApprovalAsync(letterId)
      triggerNotice(`Letter #${letterId} submitted for authorization.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleApprove = async (letterId) => {
    try {
      await hrLettersService.approveLetterAsync(letterId, 'HR Administrative Approval')
      triggerNotice(`Letter #${letterId} approved.`)
    } catch (err) {
      triggerNotice(err.message, 'error')
    }
  }

  const handleReject = async (letterId) => {
    try {
      await hrLettersService.rejectLetterAsync(letterId, 'Returned by HR Administration')
      triggerNotice(`Letter #${letterId} rejected.`, 'error')
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

  const getSubmoduleHeader = () => {
    switch (activeTab) {
      case 'templates':
        return {
          title: 'Standard Letter Templates',
          desc: 'Manage pre-approved corporate letter templates, placeholders, and standard employment formats.',
          icon: 'fileText'
        }
      case 'approvals':
        return {
          title: 'Letter Approval & Issuance',
          desc: 'Review, authorize, and issue pending employment letters and certificates awaiting HR signoff.',
          icon: 'clock'
        }
      case 'audit':
        return {
          title: 'Letters Audit & History',
          desc: 'Complete immutable audit trail and historical logs of all issued and revoked official letters.',
          icon: 'shield'
        }
      case 'register':
      default:
        return {
          title: 'Issued Letters Register',
          desc: 'Corporate repository of generated, signed, and issued employee correspondence and certificates.',
          icon: 'award'
        }
    }
  }

  const subHeader = getSubmoduleHeader()

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name={subHeader.icon} className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {subHeader.title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {subHeader.desc}
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

      <LettersSummaryCards kpis={kpis} />

      {(activeTab === 'register' || !['templates', 'approvals', 'audit'].includes(activeTab)) && (
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

      {activeTab === 'templates' && (
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
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Governance & Issuance Audit Log
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400">No governance audit events recorded yet.</p>
              ) : (
                auditLogs.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 font-mono mr-2">[{item.entityId}]</span>
                      <span className="font-semibold text-blue-700">{item.actionType}</span> by{' '}
                      <span className="font-medium text-slate-700">{item.actorRole}</span>
                      {item.notes && <span className="text-slate-500 ml-2 italic">"{item.notes}"</span>}
                    </div>
                    <div className="text-slate-400 text-[11px]">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <IssuedLettersTable
            letters={letters}
            currentUser={user}
            onViewPrint={(ltr) => {
              setSelectedLetterForPrint(ltr)
              setIsPrintModalOpen(true)
            }}
            readOnly={true}
          />
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
