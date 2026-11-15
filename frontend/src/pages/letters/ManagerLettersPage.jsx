import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import hrLettersService from '@/services/hrLettersService'
import AppIcon from '@/components/common/AppIcon'

import IssuedLettersTable from '@/components/letters/IssuedLettersTable'
import CreateLetterModal from '@/components/letters/CreateLetterModal'
import LetterPrintModal from '@/components/letters/LetterPrintModal'

export default function ManagerLettersPage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'team-letters')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // States
  const [letters, setLetters] = useState([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [selectedLetterForPrint, setSelectedLetterForPrint] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)
  const [syncState, setSyncState] = useState(() => hrLettersService.getSyncState())

  const loadData = useCallback(() => {
    setSyncState(hrLettersService.getSyncState())
    try {
      setLetters(hrLettersService.getLetters({}, user) || [])
    } catch {
      setLetters([])
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

  const handleCreateDraft = async (data) => {
    try {
      const created = await hrLettersService.createLetterDraftAsync({ ...data, submitNow: true })
      triggerNotice(`Letter request #${created.letterId} submitted to HR for review.`)
      setIsCreateModalOpen(false)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
    }
  }

  const myEmpId = user?.employeeId || user?.id
  const myPersonalLetters = letters.filter((l) => l.employeeId === myEmpId)
  const teamLetters = letters.filter((l) => l.employeeId !== myEmpId)

  const isTeam = activeTab === 'team-letters' || !activeTab
  const title = isTeam ? 'Permitted Team Requests' : 'My Issued Letters'
  const desc = isTeam
    ? `Department ${user?.department || 'Engineering'} team member letter requests, issuance status, and authorized verification records.`
    : 'View, verify, and download your personal authorized HR letters and service documentation.'

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <AppIcon name={isTeam ? 'award' : 'user'} className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {desc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            Request Team Letter
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

      {(activeTab === 'team-letters' || !activeTab) && (
        <IssuedLettersTable
          letters={teamLetters}
          currentUser={user}
          isLoading={authLoading || syncState.isLoading}
          loadError={syncState.error}
          hasLoaded={syncState.hasLoadedOnce}
          onRetry={handleRetryLoad}
          onViewPrint={(ltr) => {
            setSelectedLetterForPrint(ltr)
            setIsPrintModalOpen(true)
          }}
        />
      )}

      {activeTab === 'my-letters' && (
        <IssuedLettersTable
          letters={myPersonalLetters}
          currentUser={user}
          isLoading={authLoading || syncState.isLoading}
          loadError={syncState.error}
          hasLoaded={syncState.hasLoadedOnce}
          onRetry={handleRetryLoad}
          onViewPrint={(ltr) => {
            setSelectedLetterForPrint(ltr)
            setIsPrintModalOpen(true)
          }}
        />
      )}

      {/* Modals */}
      <CreateLetterModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
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
