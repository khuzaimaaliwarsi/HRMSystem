import test from 'node:test'
import assert from 'node:assert/strict'
import { REPORT_FAMILIES, REPORT_REGISTRY } from '../services/reportRegistry.js'
import { reportService } from '../services/reportService.js'
import { reportExcelExporter } from '../services/reportExcelExporter.js'
import { reportPdfExporter } from '../services/reportPdfExporter.js'

test('Batch F14: Complete Reports & Analytics Test Suite', async (t) => {
  const superAdmin = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001' }
  const hrAdmin = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002' }
  const manager = { name: 'Bilal Siddiqui', role: 'manager', employeeId: 'EMP-003' }
  const employee = { name: 'Zainab Fatima', role: 'employee', employeeId: 'EMP-004' }

  await t.test('1. Exact 75 Reports Catalog and 12 Families Registered', () => {
    assert.strictEqual(REPORT_FAMILIES.length, 12, 'Must have exactly 12 report families')
    assert.strictEqual(REPORT_REGISTRY.length, 75, 'Must have exactly 75 canonical reports registered')

    // Verify all IDs are unique and follow naming conventions
    const ids = new Set()
    REPORT_REGISTRY.forEach((r) => {
      assert.ok(r.id, 'Report must have an ID')
      assert.ok(!ids.has(r.id), `Report ID ${r.id} must be unique`)
      ids.add(r.id)
      assert.ok(r.columns && r.columns.length > 0, `Report ${r.id} must have column definitions`)
      assert.ok(r.allowedRoles && r.allowedRoles.length > 0, `Report ${r.id} must have allowedRoles`)
      assert.ok(r.reconciliationRule, `Report ${r.id} must have an explicit reconciliation rule`)
    })
  })

  await t.test('2. Family Distribution Matches PRD Section 8 Exactly', () => {
    const familyCounts = {}
    REPORT_REGISTRY.forEach((r) => {
      familyCounts[r.familyId] = (familyCounts[r.familyId] || 0) + 1
    })

    assert.strictEqual(familyCounts['fam_org'], 6, 'Family 01 Workforce & Organization must have 6 reports')
    assert.strictEqual(familyCounts['fam_rec'], 5, 'Family 02 Recruitment & Onboarding must have 5 reports')
    assert.strictEqual(familyCounts['fam_att'], 10, 'Family 03 Attendance & Shifts must have 10 reports')
    assert.strictEqual(familyCounts['fam_lev'], 7, 'Family 04 Leave Governance must have 7 reports')
    assert.strictEqual(familyCounts['fam_pay'], 8, 'Family 05 Payroll & Banking must have 8 reports')
    assert.strictEqual(familyCounts['fam_tax'], 5, 'Family 06 Tax Controls must have 5 reports')
    assert.strictEqual(familyCounts['fam_ben'], 7, 'Family 07 Commissions & Benefits must have 7 reports')
    assert.strictEqual(familyCounts['fam_per'], 8, 'Family 08 Tasks & Performance must have 8 reports')
    assert.strictEqual(familyCounts['fam_pol'], 5, 'Family 09 Policy Governance must have 5 reports')
    assert.strictEqual(familyCounts['fam_hlp'], 3, 'Family 10 Help Desk must have 3 reports')
    assert.strictEqual(familyCounts['fam_trv'], 7, 'Family 11 Travel & Expenses must have 7 reports')
    assert.strictEqual(familyCounts['fam_sec'], 4, 'Family 12 HR Letters & Security must have 4 reports')
  })

  await t.test('3. Super Admin Role Access: Can Generate All 75 Reports', () => {
    REPORT_REGISTRY.forEach((report) => {
      const result = reportService.generateReport(report.id, { datePreset: 'thisMonth' }, superAdmin)
      assert.ok(result, `Super Admin must be able to generate ${report.id}`)
      assert.strictEqual(result.report.id, report.id)
      assert.ok(Array.isArray(result.rows), `Result rows must be an array for ${report.id}`)
      assert.ok(result.columns.length > 0, `Result columns must exist for ${report.id}`)
      assert.ok(result.reconciliation.reconciled !== false, `Reconciliation must pass for ${report.id}`)
    })
  })

  await t.test('4. Role-Based Scoping & Security: Manager Blocked from Confidential Payroll', () => {
    // Manager attempting to generate protected Payroll Summary Register RPT-PAY-001
    assert.throws(
      () => {
        reportService.generateReport('RPT-PAY-001', {}, manager)
      },
      /Access Denied/i,
      'Manager must be denied access to RPT-PAY-001'
    )

    // Manager attempting to generate Salary Increment Register RPT-PAY-006
    assert.throws(
      () => {
        reportService.generateReport('RPT-PAY-006', {}, manager)
      },
      /Access Denied/i,
      'Manager must be denied access to RPT-PAY-006'
    )

    // Manager can access team attendance report RPT-ATT-001
    const mgrAtt = reportService.generateReport('RPT-ATT-001', {}, manager)
    assert.ok(mgrAtt.rows.length > 0, 'Manager can access team attendance')
  })

  await t.test('5. Employee Scoping: Self-Service Personal Statements Only', () => {
    // Employee accessing own payslip statement RPT-PAY-002
    const empPayslip = reportService.generateReport('RPT-PAY-002', {}, employee)
    assert.ok(empPayslip, 'Employee can access own payslip statement')
    // All rows must belong to this employee
    empPayslip.rows.forEach((r) => {
      assert.strictEqual(r.employeeId, employee.employeeId, 'Employee must see only their own payslip records')
    })

    // Employee blocked from company-wide payroll master register RPT-PAY-001
    assert.throws(
      () => {
        reportService.generateReport('RPT-PAY-001', {}, employee)
      },
      /Access Denied/i,
      'Employee must be denied access to company-wide payroll register'
    )
  })

  await t.test('6. Financial Reconciliations: Payroll Summary Register RPT-PAY-001', () => {
    const payResult = reportService.generateReport('RPT-PAY-001', {}, superAdmin)
    assert.ok(payResult.rows.length > 0, 'Must have payroll rows')

    payResult.rows.forEach((row) => {
      const calculatedGross = row.basicSalary + row.allowances + row.commissions + row.overtime
      assert.strictEqual(row.grossPay, calculatedGross, `Row Gross must equal Basic + Allowances + Commissions + Overtime for ${row.employeeName}`)

      const calculatedNet = row.grossPay - row.taxWithheld - row.otherDeductions
      assert.strictEqual(row.netPayable, calculatedNet, `Row Net must equal Gross - Tax - Other Deductions for ${row.employeeName}`)
    })

    // Grand totals check
    const calculatedGrossTotal = payResult.totals.basicSalary + payResult.totals.allowances + payResult.totals.commissions + payResult.totals.overtime
    assert.strictEqual(payResult.totals.grossPay, calculatedGrossTotal, 'Grand Total Gross must equal sum of components')

    const calculatedNetTotal = payResult.totals.grossPay - payResult.totals.taxWithheld - payResult.totals.otherDeductions
    assert.strictEqual(payResult.totals.netPayable, calculatedNetTotal, 'Grand Total Net must equal Gross - Tax - Deductions')
  })

  await t.test('7. Financial Reconciliations: Loan Ledger RPT-BEN-005', () => {
    const loanResult = reportService.generateReport('RPT-BEN-005', {}, superAdmin)
    loanResult.rows.forEach((row) => {
      assert.strictEqual(
        row.outstandingBalance,
        row.principalAmount - row.totalRecovered,
        'Loan balance must equal Principal minus Recovered'
      )
    })
  })

  await t.test('8. Leave Ledger Reconciliation: RPT-LEV-001', () => {
    const leaveResult = reportService.generateReport('RPT-LEV-001', {}, superAdmin)
    leaveResult.rows.forEach((row) => {
      const closing = row.opening + row.earned - row.consumed + row.adjusted
      assert.strictEqual(row.closing, closing, 'Leave Closing Balance must equal Opening + Earned - Consumed + Adjusted')
    })
  })

  await t.test('9. Travel Advance Settlement Reconciliation: RPT-TRV-002', () => {
    const trvResult = reportService.generateReport('RPT-TRV-002', {}, superAdmin)
    trvResult.rows.forEach((row) => {
      const balance = row.advanceIssued - row.incurredExpenses - row.refundedAmount
      assert.strictEqual(row.outstandingBalance, balance, 'Travel advance outstanding must equal Advance - Incurred - Refunded')
    })
  })

  await t.test('10. Headcount & Attendance Count Invariants', () => {
    const orgResult = reportService.generateReport('RPT-ORG-001', {}, superAdmin)
    const { totalEmployees, activeCount, probationCount, separatedCount } = orgResult.summary
    assert.ok(totalEmployees >= (activeCount + probationCount + separatedCount), 'Total staff must account for all statuses')

    const attSummary = reportService.generateReport('RPT-ATT-002', {}, superAdmin)
    attSummary.rows.forEach((row) => {
      const daysSum = row.presentDays + row.paidLeave + row.unpaidLeave + row.absentDays + (row.halfDays * 0.5)
      assert.strictEqual(row.scheduledDays, daysSum, 'Attendance Scheduled Days must equal sum of day breakdown')
    })
  })

  await t.test('11. Professional Excel Export Engine (ExcelJS Validation)', async () => {
    const reportResult = reportService.generateReport('RPT-PAY-001', {}, superAdmin)
    const workbook = await reportExcelExporter.buildWorkbook(reportResult)

    assert.ok(workbook, 'Workbook must be generated')
    const sheet = workbook.worksheets[0]
    assert.ok(sheet, 'Workbook must have at least one worksheet')

    // Verify Row 1 Company Branding (Navy background #FF102746 and bold white text)
    const cellA1 = sheet.getCell('A1')
    assert.ok(cellA1.value.includes('iSysware Software Solutions'), 'Cell A1 must contain company name')
    assert.strictEqual(cellA1.fill?.fgColor?.argb, 'FF102746', 'Header row must use deep navy #102746')
    assert.strictEqual(cellA1.font?.color?.argb, 'FFFFFFFF', 'Header font must be white')

    // Verify Column Header Row 8
    const headerCell = sheet.getRow(8).getCell(1)
    assert.strictEqual(headerCell.fill?.fgColor?.argb, 'FF102746', 'Table headers must be navy fill')
    assert.strictEqual(headerCell.font?.bold, true, 'Table headers must be bold')

    // Verify Freeze Pane is configured on header row
    assert.ok(sheet.views && sheet.views.length > 0, 'Worksheet must have freeze panes enabled')
    assert.strictEqual(sheet.views[0].ySplit, 8, 'Freeze pane must split below header row 8')

    // Verify buffer generation
    const buffer = await workbook.xlsx.writeBuffer()
    assert.ok(buffer && buffer.byteLength > 1000, 'Excel buffer must be a valid non-empty byte buffer')
  })

  await t.test('12. Professional PDF Export Engine (jsPDF + autoTable Validation)', () => {
    const reportResult = reportService.generateReport('RPT-PAY-001', {}, superAdmin)
    const doc = reportPdfExporter.buildPdfDocument(reportResult)

    assert.ok(doc, 'PDF Document must be created')
    assert.strictEqual(typeof doc.output, 'function', 'Doc must have output function')

    const pdfData = doc.output('datauristring')
    assert.ok(pdfData.startsWith('data:application/pdf;filename=generated.pdf;base64,'), 'PDF must be valid data URI with PDF signature')
  })

  await t.test('13. Empty Report Handling: Produces Valid Formatted Workbook and PDF', async () => {
    const emptyResult = reportService.generateReport(
      'RPT-ORG-001',
      { search: 'NON_EXISTENT_SEARCH_STRING_XYZ_99999' },
      superAdmin
    )
    assert.strictEqual(emptyResult.rows.length, 0, 'Rows must be empty')

    // Excel workbook with empty data
    const wb = await reportExcelExporter.buildWorkbook(emptyResult)
    const buffer = await wb.xlsx.writeBuffer()
    assert.ok(buffer.byteLength > 500, 'Empty Excel workbook must generate valid binary')

    // PDF document with empty data
    const doc = reportPdfExporter.buildPdfDocument(emptyResult)
    const pdfData = doc.output('datauristring')
    assert.ok(pdfData.length > 500, 'Empty PDF document must generate valid binary')
  })

  await t.test('14. Verification: Zero Graphs or Charts inside F14', () => {
    // Ensure no chart libraries, canvas graphs, or graphic placeholders were created in report modules
    REPORT_REGISTRY.forEach((r) => {
      // Column types must be tabular only
      r.columns.forEach((col) => {
        assert.ok(
          ['text', 'number', 'currency', 'date', 'badge'].includes(col.type || 'text'),
          `Column ${col.key} type must be tabular, got ${col.type}`
        )
      })
    })
  })
})
