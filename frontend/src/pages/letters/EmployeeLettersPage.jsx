import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/useAuth'
import hrLettersService from '@/services/hrLettersService'
import AppIcon from '@/components/common/AppIcon'

import IssuedLettersTable from '@/components/letters/IssuedLettersTable'
import CreateLetterModal from '@/components/letters/CreateLetterModal'
import LetterPrintModal from '@/components/letters/LetterPrintModal'

export default function EmployeeLettersPage() {
  const { user, loading: authLoading } = useAuth()

  // Scoped Data States
  const [letters, setLetters] = useState([])
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
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

  const handleRequestDocument = async (data) => {
    try {
      const created = await hrLettersService.createLetterDraftAsync({ ...data, submitNow: true })
      triggerNotice(`Official letter request #${created.letterId} submitted to HR.`)
      setIsRequestModalOpen(false)
    } catch (err) {
      triggerNotice(err.message, 'error')
      throw err
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
              My Official HR Letters
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Access, view and print your verified appointment, confirmation, salary certificates & experience letters
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            Request HR Certificate
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

      {/* Letters Register Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Your Verified Documents & Records ({(letters || []).length})
          </span>
          <span className="text-xs text-slate-400">
            Click Print / PDF to download authenticated letters
          </span>
        </div>

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
        />
      </div>

      {/* Modals */}
      <CreateLetterModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        currentUser={user}
        onCreateDraft={handleRequestDocument}
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
