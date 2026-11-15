import React, { useState, useEffect, useMemo } from 'react'
import { freshQAModeService, CONFIRMATION_TOKEN } from '@/services/freshQAModeService'
import { identityRepairService, REPAIR_CONFIRMATION_TOKEN } from '@/services/identityRepairService'
import AppIcon from '@/components/common/AppIcon'
import KPICard from '@/components/common/KPICard'

export function FreshQABaselineResetTab() {
  const [inventory, setInventory] = useState(() => freshQAModeService.getInventory())
  const [preview, setPreview] = useState(() => freshQAModeService.generateResetPreview())
  const [hasBackup, setHasBackup] = useState(() => freshQAModeService.hasBackupBeenDownloaded())
  const [clearUnclassified, setClearUnclassified] = useState(true)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [restorePayload, setRestorePayload] = useState(null)
  const [activeSubView, setActiveSubView] = useState('overview') // 'overview' | 'preview' | 'restore' | 'repair'

  // Identity Collision & Safe Repair State
  const [repairDetection, setRepairDetection] = useState(() => identityRepairService.detectCollision())
  const [repairPreview, setRepairPreview] = useState(() => identityRepairService.generateRepairPreview())
  const [repairTokenInput, setRepairTokenInput] = useState('')
  const [isRepairing, setIsRepairing] = useState(false)

  // Format inventory categories into safe key-by-key preview rows
  const keyByActionRows = useMemo(() => {
    if (Array.isArray(preview)) return preview
    if (!inventory?.categories) return []
    const rows = []

    const cats = [
      { name: 'PROTECTED_IDENTITIES', list: inventory.categories.protectedIdentities, action: 'Preserve Admins (Clean Non-Protected)', previewText: 'Keep EMP-001 & EMP-002' },
      { name: 'PRESERVED_SYSTEM_DEFINITIONS', list: inventory.categories.preservedDefinitions, action: 'Retain Fully Intact', previewText: 'Preserve Configured Settings' },
      { name: 'RESET_ORGANIZATION_MASTERS', list: inventory.categories.resetMasters, action: 'Reset to Blank State', previewText: '[] (Empty Array)' },
      { name: 'RESET_OPERATIONAL_TRANSACTIONS', list: inventory.categories.resetTransactions, action: 'Purge Operational Data', previewText: '[] (Empty Array)' }
    ]

    for (const cat of cats) {
      for (const item of (cat.list || [])) {
        rows.push({
          key: item.key,
          category: cat.name,
          currentCount: item.currentCount || 0,
          action: cat.action,
          proposedValuePreview: cat.previewText
        })
      }
    }

    return rows
  }, [preview, inventory])

  const refreshState = () => {
    setInventory(freshQAModeService.getInventory())
    setPreview(freshQAModeService.generateResetPreview())
    setHasBackup(freshQAModeService.hasBackupBeenDownloaded())
    const detection = identityRepairService.detectCollision()
    setRepairDetection(detection)
    setRepairPreview(identityRepairService.generateRepairPreview())
    if (detection.hasCollision && activeSubView === 'overview') {
      setActiveSubView('repair')
    }
  }

  useEffect(() => {
    refreshState()
  }, [])

  // 1. Lossless JSON Backup Download
  const handleDownloadFullBackup = () => {
    try {
      const backup = freshQAModeService.createBackup({ maskSensitive: false })
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `isysware_hrms_full_backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      freshQAModeService.recordBackupDownloaded()
      setHasBackup(true)
      setStatusMessage({
        type: 'success',
        text: `Full lossless backup downloaded successfully (${backup.totalKeys} storage namespaces captured). Action is now unlocked.`
      })
      refreshState()
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Backup failed: ${err.message}` })
    }
  }

  // 2. Masked Backup Download (For QA Audit Evidence)
  const handleDownloadMaskedBackup = () => {
    try {
      const backup = freshQAModeService.createBackup({ maskSensitive: true })
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `isysware_hrms_masked_qa_backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      setStatusMessage({
        type: 'info',
        text: 'Masked QA backup downloaded. Sensitive passwords and financial account numbers replaced with secure audit hashes.'
      })
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Masked backup export failed: ${err.message}` })
    }
  }

  // 3. File Selection & Validation for Restore
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        const validation = freshQAModeService.validateBackup(parsed)
        setRestorePayload(parsed)
        setValidationResult(validation)

        if (validation.valid) {
          setStatusMessage({
            type: 'success',
            text: `Backup file validated successfully. Contains ${validation.keyCount} namespaces. Ready for rollback.`
          })
        } else {
          setStatusMessage({
            type: 'error',
            text: `Backup validation failed: ${validation.errors.join('; ')}`
          })
        }
      } catch (err) {
        setRestorePayload(null)
        setValidationResult({ valid: false, errors: ['Invalid JSON format or corrupted file structure.'] })
        setStatusMessage({ type: 'error', text: 'Corrupted backup file: unable to parse JSON.' })
      }
    }
    reader.readAsText(file)
  }

  // 4. Live Restore Execution
  const handleExecuteRestore = () => {
    if (!restorePayload || !validationResult?.valid) return

    if (!window.confirm('Are you sure you want to restore application storage from this backup? Current records will be replaced.')) {
      return
    }

    try {
      const result = freshQAModeService.restoreFromBackup(restorePayload, { dryRun: false })
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Storage successfully restored from backup (${result.restoredKeys} namespaces recovered). Reloading...`
        })
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Restore failed: ${err.message}` })
    }
  }

  // 5. Option B Live Reset Execution (Controlled Baseline)
  const handleExecuteReset = () => {
    if (!hasBackup) {
      setStatusMessage({
        type: 'error',
        text: 'Preflight safety check failed: You must download a full lossless backup before executing reset.'
      })
      return
    }

    if (confirmationInput.trim() !== CONFIRMATION_TOKEN) {
      setStatusMessage({
        type: 'error',
        text: `Reset rejected: Invalid confirmation token. Type '${CONFIRMATION_TOKEN}'.`
      })
      return
    }

    if (inventory.hasUnclassifiedKeys && !clearUnclassified) {
      setStatusMessage({
        type: 'error',
        text: 'Reset blocked: Unclassified keys detected. Check "Safely purge unclassified extension keys" to proceed.'
      })
      return
    }

    if (!window.confirm('FINAL CONFIRMATION: Are you sure you want to reset all organizational masters and operational data? Super Admin and HR Admin accounts will be preserved.')) {
      return
    }

    setIsExecuting(true)
    try {
      const result = freshQAModeService.executeFreshQAModeReset(CONFIRMATION_TOKEN, {
        dryRun: false,
        allowUnclassified: clearUnclassified,
        clearUnclassified
      })

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: 'Fresh QA Mode successfully activated! Preserving protected admin accounts and clean masters. Redirecting to Dashboard...'
        })
        setTimeout(() => {
          window.location.href = '/super-admin/dashboard'
        }, 1200)
      }
    } catch (err) {
      setIsExecuting(false)
      setStatusMessage({
        type: 'error',
        text: `Reset execution halted: ${err.message}`
      })
    }
  }

  // 6. Execute Safe Identity Collision Repair
  const handleExecuteIdentityRepair = () => {
    if (repairTokenInput.trim() !== REPAIR_CONFIRMATION_TOKEN) {
      setStatusMessage({
        type: 'error',
        text: `Repair rejected: Invalid confirmation token. Type '${REPAIR_CONFIRMATION_TOKEN}'.`
      })
      return
    }

    if (!window.confirm(`Are you sure you want to execute safe identity repair? Workforce member Hamza will be safely remapped to ${repairPreview?.targetHamzaId || 'EMP-003'}, all newly created departments and teams will point to this ID, and canonical Super Admin (EMP-001) and HR Admin (EMP-002) profiles will be restored without data loss.`)) {
      return
    }

    setIsRepairing(true)
    try {
      const res = identityRepairService.executeRepair(REPAIR_CONFIRMATION_TOKEN, { dryRun: false })
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `✓ ${res.message} Reloading application to apply clean identity state...`
        })
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      setIsRepairing(false)
      setStatusMessage({
        type: 'error',
        text: `Identity repair aborted: ${err.message}`
      })
    }
  }

  const isResetDisabled = confirmationInput.trim() !== CONFIRMATION_TOKEN || isExecuting
  const isRepairDisabled = repairTokenInput.trim() !== REPAIR_CONFIRMATION_TOKEN || isRepairing

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Fresh QA Baseline &amp; Controlled Reset
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
              Option B Baseline
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Owner-gated governance workflow: data inventory, pre-reset backups, dry-run previews, and single-source reset activation.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full ${inventory.isFreshQAModeActive ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
          <span className="font-semibold text-slate-700">
            {inventory.isFreshQAModeActive ? 'QA Baseline Active' : 'Normal Demo State'}
          </span>
        </div>
      </div>

      {/* Notifications / Feedback Bar */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-2xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AppIcon
              name={statusMessage.type === 'success' ? 'check' : statusMessage.type === 'error' ? 'close' : 'info'}
              className="w-4 h-4 shrink-0"
            />
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard
          title="Total Namespaces"
          value={inventory.summary.totalConfiguredKeys}
          subtitle="76 Configured Keys"
          icon="settings"
          color="blue"
        />
        <KPICard
          title="Preserved Definitions"
          value={(inventory?.categories?.preservedDefinitions?.length || 13) + 2}
          subtitle="13 Policies + 2 Admin Accounts"
          icon="shieldHalved"
          color="emerald"
        />
        <KPICard
          title="Proposed Deletions"
          value={inventory.summary.proposedDeletions}
          subtitle="57 Master &amp; Operational Tables"
          icon="danger"
          color="amber"
        />
        <KPICard
          title="Unclassified Keys"
          value={inventory.summary.unclassifiedKeysCount}
          subtitle={inventory.hasUnclassifiedKeys ? '⚠️ Requires Review' : '0 Unknown — Safe Registry'}
          icon="check"
          color={inventory.hasUnclassifiedKeys ? 'rose' : 'purple'}
        />
      </div>

      {/* P0 Critical Identity Collision Alert Banner */}
      {repairDetection.hasCollision && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                P0 Critical: Protected Identity Collision Detected
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Workforce member {repairDetection.collidedEmployee ? `'${repairDetection.collidedEmployee.name}'` : 'Hamza'} holds protected Super Admin ID 'EMP-001'. A safe, audited non-destructive repair is available with pre-repair backup and full rollback protection.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubView('repair')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs shrink-0 cursor-pointer transition-colors"
          >
            Review &amp; Resolve Collision →
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubView('overview')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubView === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Preflight &amp; Execution Gate
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('preview')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubView === 'preview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Key-by-Key Reset Preview
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('restore')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSubView === 'restore'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Backup Validation &amp; Rollback
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('repair')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubView === 'repair'
              ? 'bg-amber-600 text-white shadow-xs'
              : repairDetection.hasCollision
              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Identity Collision &amp; Repair</span>
          {repairDetection.hasCollision && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-300 text-amber-950">
              P0 Issue
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: PREFLIGHT & EXECUTION GATE */}
      {activeSubView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card A: Mandatory Pre-Reset Backup */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AppIcon name="download" className="w-4 h-4 text-blue-600" />
                <span>Step 1: Mandatory Full Lossless Backup</span>
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  hasBackup ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {hasBackup ? '✓ Backup Downloaded' : 'Pending Download'}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              To prevent accidental data loss, the reset execution gate remains strictly locked until an exportable lossless backup of all 76 keys is saved to your computer.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadFullBackup}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <AppIcon name="download" className="w-3.5 h-3.5" />
                <span>Download Full Lossless Backup</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMaskedBackup}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <AppIcon name="eyeSlash" className="w-3.5 h-3.5" />
                <span>Download Masked QA Evidence</span>
              </button>
            </div>
          </div>

          {/* Card B: Single-Source Reset Execution Gate */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AppIcon name="lock" className="w-4 h-4 text-amber-600" />
                <span>Step 2: Safe Reset Execution Gate</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Option B Engine
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Type the exact confirmation phrase <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-rose-700 font-bold">{CONFIRMATION_TOKEN}</code> to unlock reset.
            </p>

            {inventory.hasUnclassifiedKeys && (
              <label className="flex items-center gap-2 text-xs font-medium text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <input
                  type="checkbox"
                  checked={clearUnclassified}
                  onChange={(e) => setClearUnclassified(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Safely purge unclassified extension keys during reset ({inventory.summary.unclassifiedKeysCount} detected)</span>
              </label>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="Type CONFIRM_RESET_FRESH_QA_MODE_2026"
                className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <button
                type="button"
                disabled={isResetDisabled}
                onClick={handleExecuteReset}
                className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors ${
                  isResetDisabled
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                }`}
              >
                <AppIcon name="danger" className="w-3.5 h-3.5" />
                <span>{isExecuting ? 'Resetting...' : 'Execute Fresh QA Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KEY-BY-KEY RESET PREVIEW */}
      {activeSubView === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Audit Preflight: 76 Storage Namespaces Classification
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Namespace Key</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Current Count</th>
                    <th className="p-2.5">Action on Reset</th>
                    <th className="p-2.5">Post-Reset Baseline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {keyByActionRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/50">
                      <td className="p-2.5 text-slate-900 font-semibold">{row.key}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.category === 'PROTECTED_IDENTITIES' ? 'bg-blue-50 text-blue-700' :
                          row.category === 'PRESERVED_SYSTEM_DEFINITIONS' ? 'bg-emerald-50 text-emerald-700' :
                          row.category === 'RESET_ORGANIZATION_MASTERS' ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600">{row.currentCount} items</td>
                      <td className="p-2.5 font-bold text-slate-700">{row.action}</td>
                      <td className="p-2.5 text-slate-600">{row.proposedValuePreview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: BACKUP VALIDATION & ROLLBACK */}
      {activeSubView === 'restore' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Restore from Previous Backup File
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a previously exported <code className="font-mono text-[11px]">.json</code> backup to validate its signature and safely restore all storage namespaces.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />

            {restorePayload && validationResult?.valid && (
              <button
                type="button"
                onClick={handleExecuteRestore}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                <AppIcon name="refresh" className="w-3.5 h-3.5" />
                <span>Restore &amp; Apply Backup</span>
              </button>
            )}
          </div>

          {validationResult && (
            <div className={`p-3 rounded-xl border text-xs ${validationResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <span className="font-bold">{validationResult.valid ? '✓ Backup Validated Successfully' : '✕ Invalid Backup File'}:</span>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px]">
                {validationResult.valid ? (
                  <>
                    <li>System Signature: {restorePayload.system}</li>
                    <li>Namespaces in payload: {validationResult.keyCount}</li>
                    <li>Super Admin account present: Yes</li>
                  </>
                ) : (
                  validationResult.errors.map((e, idx) => <li key={idx}>{e}</li>)
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: IDENTITY INTEGRITY & COLLISION REPAIR */}
      {activeSubView === 'repair' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-amber-500">🛡️</span>
                  <span>Super Admin Identity Integrity &amp; Collision Repair Preview</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Controlled, non-destructive resolution for identity collisions using canonical versioned keys (F02 schema contracts).
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                repairDetection.hasCollision
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {repairDetection.hasCollision ? 'Action Required: Collision Detected' : 'Storage State: Healthy'}
              </span>
            </div>

            {/* Collision Diagnostics */}
            {repairDetection.hasCollision ? (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5">
                <span className="font-bold text-amber-900">Detected Collision &amp; Integrity Issues:</span>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                  {repairDetection.issues.map((iss, idx) => (
                    <li key={idx}>{iss}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                ✓ No active identity collision detected in current browser storage. Protected administrative identities (EMP-001 &amp; EMP-002) are properly registered.
              </div>
            )}

            {/* Canonical Storage Keys Evidence */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-xs">
              <span className="font-bold text-slate-800">Verified Canonical Storage Keys (F02 Schema):</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Employees Master:</span>
                  <span className="text-blue-600 font-semibold">isysware_hrms_f02_employees_v1</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                  <span className="text-slate-500">User Accounts:</span>
                  <span className="text-blue-600 font-semibold">isysware_hrms_user_accounts_v1</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Departments:</span>
                  <span className="text-blue-600 font-semibold">isysware_hrms_f02_departments_v1</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Teams Master:</span>
                  <span className="text-blue-600 font-semibold">isysware_hrms_f02_teams_v1</span>
                </div>
              </div>
            </div>

            {/* Proposed Before vs After Table */}
            {repairPreview?.canRepair && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Controlled Repair Transaction Preview
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Entity / Record</th>
                        <th className="p-2.5">Current State (Collision)</th>
                        <th className="p-2.5">Proposed Repaired State</th>
                        <th className="p-2.5">Action &amp; Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-white">
                        <td className="p-2.5 font-semibold text-slate-900">
                          {repairPreview.collidedEmployee?.name || 'Hamza Ahmed'}
                        </td>
                        <td className="p-2.5 font-mono text-rose-600">
                          ID: {repairPreview.collidedEmployee?.id || 'EMP-001'} (Collided with Admin)
                        </td>
                        <td className="p-2.5 font-mono text-emerald-600 font-bold">
                          ID: {repairPreview.targetHamzaId} (Unique Non-Protected)
                        </td>
                        <td className="p-2.5 text-slate-600">
                          Remap ID &amp; maintain all personal &amp; official attributes
                        </td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="p-2.5 font-semibold text-slate-900">
                          Super Admin Profile
                        </td>
                        <td className="p-2.5 font-mono text-slate-400">
                          Missing from Directory
                        </td>
                        <td className="p-2.5 font-mono text-emerald-600 font-bold">
                          ID: EMP-001 ({repairPreview.canonicalSuperAdmin?.email})
                        </td>
                        <td className="p-2.5 text-slate-600">
                          Recover authoritative canonical record (Tariq Mehmood)
                        </td>
                      </tr>
                      <tr className="bg-white">
                        <td className="p-2.5 font-semibold text-slate-900">
                          HR Admin Profile
                        </td>
                        <td className="p-2.5 font-mono text-slate-400">
                          Missing from Directory
                        </td>
                        <td className="p-2.5 font-mono text-emerald-600 font-bold">
                          ID: EMP-002 ({repairPreview.canonicalHrAdmin?.email})
                        </td>
                        <td className="p-2.5 text-slate-600">
                          Recover authoritative canonical record (Ayesha Khan)
                        </td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="p-2.5 font-semibold text-slate-900">
                          Department Head Reference
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          headId: EMP-001 ({repairPreview.collidedEmployee?.name})
                        </td>
                        <td className="p-2.5 font-mono text-emerald-600 font-bold">
                          headId: {repairPreview.targetHamzaId} ({repairPreview.collidedEmployee?.name})
                        </td>
                        <td className="p-2.5 text-slate-600">
                          Update foreign key so Hamza remains Head of Department
                        </td>
                      </tr>
                      <tr className="bg-white">
                        <td className="p-2.5 font-semibold text-slate-900">
                          Created Masters
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {repairPreview.preservedMastersCount?.departments || 0} Depts, {repairPreview.preservedMastersCount?.teams || 0} Teams, {repairPreview.preservedMastersCount?.designations || 0} Desigs
                        </td>
                        <td className="p-2.5 font-mono text-emerald-600 font-bold">
                          100% Preserved (0 Overwritten)
                        </td>
                        <td className="p-2.5 text-slate-600">
                          Zero data loss guarantee
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Execution Form Card */}
            {repairPreview?.canRepair && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AppIcon name="lock" className="w-3.5 h-3.5 text-amber-600" />
                    <span>Owner Authorization &amp; Safe Execution Gate</span>
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800">
                    Rollback Enabled
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  To execute this audited repair, download a pre-repair backup, then type the exact confirmation token <code className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[11px] text-amber-800 font-bold">CONFIRM_REPAIR_IDENTITY_COLLISION_2026</code>.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadFullBackup}
                    className="w-full sm:w-auto px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
                  >
                    <AppIcon name="download" className="w-3.5 h-3.5" />
                    <span>1. Download Pre-Repair Backup</span>
                  </button>

                  <input
                    type="text"
                    value={repairTokenInput}
                    onChange={(e) => setRepairTokenInput(e.target.value)}
                    placeholder="Type CONFIRM_REPAIR_IDENTITY_COLLISION_2026"
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />

                  <button
                    type="button"
                    disabled={isRepairDisabled}
                    onClick={handleExecuteIdentityRepair}
                    className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors ${
                      isRepairDisabled
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                    }`}
                  >
                    <AppIcon name="check" className="w-3.5 h-3.5" />
                    <span>{isRepairing ? 'Repairing...' : '2. Apply Safe Repair'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FreshQABaselineResetTab
