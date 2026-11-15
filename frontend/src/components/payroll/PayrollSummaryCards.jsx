import React from 'react'
import KPICard from '@/components/common/KPICard'

export function PayrollSummaryCards({
  grossPayroll,
  netPayable,
  taxWithheld,
  loanDeductions,
  periodName,
  payrollRuns = []
}) {
  const activeRuns = Array.isArray(payrollRuns)
    ? payrollRuns.filter((r) => String(r?.status || '').toUpperCase() !== 'VOID')
    : []
  const latestRun = activeRuns.length > 0 ? activeRuns[0] : null
  const effectiveGross = grossPayroll !== undefined ? grossPayroll : (latestRun?.grossPayroll ?? 0)
  const effectiveNet = netPayable !== undefined ? netPayable : (latestRun?.netPayable ?? 0)
  const effectiveTax = taxWithheld !== undefined ? taxWithheld : (latestRun?.totalTaxWithheld ?? 0)
  const effectiveLoan = loanDeductions !== undefined ? loanDeductions : (latestRun?.totalLoanDeductions ?? 0)
  const effectivePeriod = periodName || latestRun?.periodName || latestRun?.period || (activeRuns.length === 0 ? 'No Active Run' : 'Current Run')

  const cards = [
    {
      title: 'Gross Payroll',
      value: `PKR ${(Number(effectiveGross) || 0).toLocaleString()}`,
      subtitle: `Basic + Allowances (${effectivePeriod})`,
      icon: 'payroll',
      color: 'blue'
    },
    {
      title: 'Net Payable',
      value: `PKR ${(Number(effectiveNet) || 0).toLocaleString()}`,
      subtitle: 'Disbursable to employee accounts',
      icon: 'banking',
      color: 'emerald'
    },
    {
      title: 'Tax Withheld',
      value: `PKR ${(Number(effectiveTax) || 0).toLocaleString()}`,
      subtitle: 'FBR Section 149 Tax Liability',
      icon: 'tax',
      color: 'amber'
    },
    {
      title: 'Loan Recoveries',
      value: `PKR ${(Number(effectiveLoan) || 0).toLocaleString()}`,
      subtitle: 'Company loan installments collected',
      icon: 'tasks',
      color: 'indigo'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-left">
      {cards.map((card, i) => (
        <KPICard
          key={i}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          color={card.color}
        />
      ))}
    </div>
  )
}

export default PayrollSummaryCards
