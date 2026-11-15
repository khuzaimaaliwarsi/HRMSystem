import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'
import { reportExcelExporter } from '@/services/reportExcelExporter'
import { reportPdfExporter } from '@/services/reportPdfExporter'

export default function ReportExportActions({ reportResult }) {
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const handleExcelDownload = async () => {
    if (!reportResult) return
    try {
      setExportingExcel(true)
      await reportExcelExporter.downloadExcel(reportResult)
    } catch (err) {
      console.error('Failed to export Excel:', err)
      alert('Error generating Excel file: ' + err.message)
    } finally {
      setExportingExcel(false)
    }
  }

  const handlePdfDownload = async () => {
    if (!reportResult) return
    try {
      setExportingPdf(true)
      await reportPdfExporter.downloadPdf(reportResult)
    } catch (err) {
      console.error('Failed to export PDF:', err)
      alert('Error generating PDF file: ' + err.message)
    } finally {
      setExportingPdf(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex items-center gap-2">
      {/* PDF Download Button */}
      <button
        type="button"
        onClick={handlePdfDownload}
        disabled={exportingPdf || !reportResult}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors disabled:opacity-50"
        title="Download official audit-ready PDF document"
      >
        <AppIcon icon={exportingPdf ? 'spinner' : 'file-pdf'} className={`text-xs ${exportingPdf ? 'animate-spin' : ''}`} />
        <span>{exportingPdf ? 'Generating...' : 'PDF Download'}</span>
      </button>

      {/* Excel Download Button */}
      <button
        type="button"
        onClick={handleExcelDownload}
        disabled={exportingExcel || !reportResult}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors disabled:opacity-50"
        title="Download professional .xlsx workbook with formulas and styles"
      >
        <AppIcon icon={exportingExcel ? 'spinner' : 'file-excel'} className={`text-xs ${exportingExcel ? 'animate-spin' : ''}`} />
        <span>{exportingExcel ? 'Building...' : 'Excel Download'}</span>
      </button>

      {/* Print Button */}
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
        title="Print statement using browser print dialog"
      >
        <AppIcon icon="print" className="text-xs" />
        <span>Print</span>
      </button>
    </div>
  )
}
