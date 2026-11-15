import React from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function CertificatePreviewModal({
  isOpen,
  onClose,
  certificate = null
}) {
  if (!isOpen || !certificate) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl text-left overflow-hidden my-6 print:m-0 print:border-none print:shadow-none animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls (Hidden in Print) */}
        <div className="px-6 py-3 bg-navy-950 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-award text-amber-400"></i>
            <span className="text-xs font-bold uppercase tracking-wider">
              Verified Digital Credential
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-print"></i>
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1"
            >
              <AppIcon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Canvas */}
        <div className="p-8 sm:p-12 relative bg-linear-to-b from-amber-50/40 via-white to-slate-50 border-8 border-double border-navy-950 m-4 rounded-xl text-center">
          {/* Subtle Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none text-9xl font-black text-navy-950">
            iSysware
          </div>

          {/* Org Header */}
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-md">
              iS
            </div>
            <div className="text-left">
              <div className="font-extrabold text-base tracking-tight text-navy-950 leading-none">
                iSysware <span className="text-blue-600">HRMS</span>
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Academy &amp; Learning Directorate
              </div>
            </div>
          </div>

          <div className="my-6">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-navy-950 tracking-wide uppercase">
              Certificate of Completion
            </h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1 font-semibold">
              This is to officially certify that
            </p>
          </div>

          {/* Recipient */}
          <div className="my-6 py-2 border-b-2 border-slate-300 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-navy-950 tracking-tight">
              {certificate.employeeName}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              ID: {certificate.employeeId} • {certificate.department}
            </p>
          </div>

          {/* Course & Grade */}
          <div className="my-5 max-w-lg mx-auto text-xs text-slate-700 leading-relaxed">
            <p>
              has successfully completed all required syllabus benchmarks, practical lab projects, and assessment examinations for
            </p>
            <div className="my-3 text-base sm:text-lg font-bold text-blue-900 font-serif">
              "{certificate.programTitle}"
            </div>
            <p>
              with the distinguished outcome of <strong className="text-emerald-700 font-mono">{certificate.grade}</strong>.
            </p>
          </div>

          {/* Skills Badges */}
          {certificate.skillsCertified && certificate.skillsCertified.length > 0 && (
            <div className="my-6 flex flex-wrap items-center justify-center gap-1.5 max-w-md mx-auto">
              {certificate.skillsCertified.map((sk, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                  {sk}
                </span>
              ))}
            </div>
          )}

          {/* Signatures & Verification Details */}
          <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end text-xs">
            <div className="text-left font-mono text-[11px] text-slate-500">
              <div>Certificate #: <strong className="text-slate-800">{certificate.certificateNumber}</strong></div>
              <div>Issued: <strong className="text-slate-800">{certificate.issueDate}</strong></div>
              <div>Valid Thru: <strong className="text-slate-800">{certificate.expiryDate || 'Lifetime'}</strong></div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full border-2 border-amber-600/40 bg-amber-50 flex items-center justify-center shadow-inner mb-1">
                <i className="fa-solid fa-certificate text-2xl text-amber-600"></i>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {certificate.verificationStatus || 'VERIFIED'}
              </span>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                Code: {certificate.verificationCode}
              </span>
            </div>

            <div className="text-right sm:text-right font-sans text-xs">
              <div className="font-serif font-bold italic text-slate-900 border-b border-slate-400 pb-1 inline-block min-w-[140px]">
                {certificate.authorizedIssuer}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1 font-semibold">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden in Print) */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>Official Corporate Credential • Verification Code: {certificate.verificationCode}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
