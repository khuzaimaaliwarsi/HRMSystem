import React from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function LetterPrintModal({ isOpen, onClose, letter = null }) {
  if (!isOpen || !letter) return null

  const handlePrint = () => {
    window.print()
  }

  const isIssued = letter.status === 'Issued'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        {/* Top Control Bar (Hidden on physical print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <AppIcon name="print" className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Official Letterhead View — {letter.letterType}
              </h3>
              <p className="text-xs text-slate-500">
                {isIssued
                  ? `Immutable Reference: ${letter.referenceNumber}`
                  : `Draft / Unissued Letter Preview (#${letter.letterId})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <AppIcon name="print" className="w-3.5 h-3.5" />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <AppIcon name="xmark" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Document Sheet */}
        <div className="p-8 sm:p-12 max-h-[78vh] overflow-y-auto print:max-h-none print:p-0 bg-white">
          <div
            id="letterhead-document"
            className="w-full max-w-2xl mx-auto space-y-6 text-slate-900 font-sans leading-relaxed"
          >
            {/* Header / Company Crest */}
            <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  iSysware Software Solutions (Pvt) Ltd
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Corporate Enterprise HR & Governance Directorate
                </p>
                <p className="text-[10px] text-slate-400">
                  Tech Park, Shahrah-e-Faisal, Karachi, Pakistan • www.isysware.com
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                {letter.referenceNumber ? (
                  <div className="font-bold text-blue-900">
                    Ref: {letter.referenceNumber}
                  </div>
                ) : (
                  <div className="text-amber-700 font-semibold text-[11px]">
                    DRAFT (Unissued)
                  </div>
                )}
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Date: {letter.issuedAt ? letter.issuedAt.slice(0, 10) : letter.effectiveDate}
                </div>
              </div>
            </div>

            {/* Recipient Information */}
            <div className="space-y-1 text-xs">
              <div className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                To:
              </div>
              <div className="font-bold text-sm text-slate-900">{letter.employeeName}</div>
              <div className="text-slate-700 font-medium">{letter.designation}</div>
              <div className="text-slate-600">
                Department: {letter.department} • Employee ID: {letter.employeeId}
              </div>
            </div>

            {/* Subject Line */}
            <div className="py-2 border-y border-slate-100">
              <div className="font-bold text-xs uppercase text-slate-900 tracking-wide">
                Subject: {letter.subject}
              </div>
            </div>

            {/* Letter Body Content */}
            <div className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-serif pt-2 min-h-[220px]">
              {letter.contentSnapshot}
            </div>

            {/* Signatory Block */}
            <div className="pt-10 space-y-1 text-xs">
              <div className="text-slate-500 text-[11px]">Yours sincerely,</div>
              <div className="font-bold text-slate-900 pt-6">
                {letter.signatoryName || 'Authorized Signatory'}
              </div>
              <div className="text-slate-600 text-[11px]">
                {letter.signatoryTitle || 'Head of Human Resources'}
              </div>
              <div className="text-slate-500 text-[10px]">
                iSysware Software Solutions (Pvt) Ltd
              </div>
            </div>

            {/* Official Footer */}
            <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
              {letter.footerText || 'Tech Park, Shahrah-e-Faisal, Karachi | www.isysware.com'}
              {letter.referenceNumber && (
                <div className="font-mono text-[9px] mt-0.5 text-slate-400">
                  Authentication Reference Code: {letter.referenceNumber} • Official Corporate Record
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between print:hidden">
          <span className="text-[11px] text-slate-500">
            Standard ISO 216 A4 Page Layout • Inter & Serif Typography
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
