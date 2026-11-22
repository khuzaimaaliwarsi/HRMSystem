/**
 * iSysware HRMS — Batch F06: Canonical Payroll, Compensation & Benefits Mock Dataset
 * Authoritative financial data source for:
 * - Employee Salary Structures & Compensation Plans
 * - Official FBR Pakistan Salary Tax (Section 149) Withholding Slabs (Tax Year 2026-2027)
 * - Configurable Allowances & Benefits
 * - Sales Commission Rules & Verified Qualifying Deal Sources
 * - Employee Loans & Salary Advances with Amortization Schedules
 * - Monthly Payroll Runs (Historical Finalized & Current Active Drafts)
 * - Audited Salary Revision Proposals (Increment / Decrement)
 */

// 1. Initial Salary Structures for Canonical Workforce (14 Staff)
export const INITIAL_SALARY_STRUCTURES = [
  {
    id: 'SAL-001',
    employeeId: 'EMP-001',
    employeeName: 'Tariq Mehmood',
    department: 'Executive Management',
    designation: 'Managing Director & Policy Owner',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 450000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2021-01-15',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Board of Directors',
    approvedAt: '2021-01-15'
  },
  {
    id: 'SAL-002',
    employeeId: 'EMP-002',
    employeeName: 'Ayesha Khan',
    department: 'Human Resources',
    designation: 'Lead People Operations Specialist',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 220000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2022-03-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2022-03-01'
  },
  {
    id: 'SAL-003',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Siddiqui',
    department: 'Development',
    designation: 'Software Engineering Manager',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 320000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2022-06-15',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2022-06-15'
  },
  {
    id: 'SAL-004',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Development',
    designation: 'Senior Full-Stack Developer',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 185000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2023-02-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2023-02-01'
  },
  {
    id: 'SAL-005',
    employeeId: 'EMP-005',
    employeeName: 'Hina Farooq',
    department: 'Development',
    designation: 'Lead QA Automation Engineer',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 175000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2023-08-10',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2023-08-10'
  },
  {
    id: 'SAL-006',
    employeeId: 'EMP-006',
    employeeName: 'Usman Ghani',
    department: 'Development',
    designation: 'Junior Frontend Developer',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 95000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2024-01-15',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2024-01-15'
  },
  {
    id: 'SAL-007',
    employeeId: 'EMP-007',
    employeeName: 'Kamran Raza',
    department: 'Sales & Business',
    designation: 'Regional Sales Lead',
    compensationBasis: 'Monthly + Commission',
    currency: 'PKR',
    basicSalary: 210000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2022-05-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2022-05-01'
  },
  {
    id: 'SAL-008',
    employeeId: 'EMP-008',
    employeeName: 'Nida Yasir',
    department: 'Sales & Business',
    designation: 'Enterprise Account Executive',
    compensationBasis: 'Monthly + Commission',
    currency: 'PKR',
    basicSalary: 140000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2023-04-12',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2023-04-12'
  },
  {
    id: 'SAL-009',
    employeeId: 'EMP-009',
    employeeName: 'Babar Azam',
    department: 'Sales & Business',
    designation: 'Inside Sales Specialist',
    compensationBasis: 'Monthly + Commission',
    currency: 'PKR',
    basicSalary: 85000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2024-03-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2024-03-01'
  },
  {
    id: 'SAL-010',
    employeeId: 'EMP-010',
    employeeName: 'Faizan Ahmed',
    department: 'Media & Creative',
    designation: 'Creative Media Director',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 240000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2022-09-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2022-09-01'
  },
  {
    id: 'SAL-011',
    employeeId: 'EMP-011',
    employeeName: 'Sara Ali',
    department: 'Media & Creative',
    designation: 'Senior Visual & UI Designer',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 155000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2023-06-20',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2023-06-20'
  },
  {
    id: 'SAL-012',
    employeeId: 'EMP-012',
    employeeName: 'Hamza Tariq',
    department: 'Media & Creative',
    designation: 'Motion & Video Animator',
    compensationBasis: 'Hourly',
    currency: 'PKR',
    basicSalary: 0,
    hourlyRate: 1200,
    projectRate: null,
    contractedHoursPerWeek: 30,
    effectiveFrom: '2024-05-15',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2024-05-15'
  },
  {
    id: 'SAL-013',
    employeeId: 'EMP-013',
    employeeName: 'Maria Qureshi',
    department: 'Human Resources',
    designation: 'HR Operations Associate',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 90000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2024-02-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2024-02-01'
  },
  {
    id: 'SAL-014',
    employeeId: 'EMP-014',
    employeeName: 'Zubair Shah',
    department: 'Finance & Accounts',
    designation: 'Senior Financial Controller',
    compensationBasis: 'Monthly',
    currency: 'PKR',
    basicSalary: 230000,
    hourlyRate: null,
    projectRate: null,
    contractedHoursPerWeek: 40,
    effectiveFrom: '2022-04-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2022-04-01'
  }
]

// 2. Official FBR Pakistan Salary Tax Slabs (First Schedule, Part I, Division I - Section 149)
// Applicable for Tax Year 2026-2027
export const PAKISTAN_TAX_SLABS_TY2027 = [
  {
    slabNumber: 1,
    minIncome: 0,
    maxIncome: 600000,
    fixedTax: 0,
    ratePercent: 0,
    description: 'Up to PKR 600,000 / year: Tax Exempt (0%)'
  },
  {
    slabNumber: 2,
    minIncome: 600000,
    maxIncome: 1200000,
    fixedTax: 0,
    ratePercent: 5,
    description: 'PKR 600,001 to 1,200,000 / year: 5% of amount exceeding 600,000'
  },
  {
    slabNumber: 3,
    minIncome: 1200000,
    maxIncome: 2200000,
    fixedTax: 30000,
    ratePercent: 15,
    description: 'PKR 1,200,001 to 2,200,000 / year: PKR 30,000 + 15% of amount exceeding 1,200,000'
  },
  {
    slabNumber: 4,
    minIncome: 2200000,
    maxIncome: 3200000,
    fixedTax: 180000,
    ratePercent: 25,
    description: 'PKR 2,200,001 to 3,200,000 / year: PKR 180,000 + 25% of amount exceeding 2,200,000'
  },
  {
    slabNumber: 5,
    minIncome: 3200000,
    maxIncome: 4100000,
    fixedTax: 430000,
    ratePercent: 30,
    description: 'PKR 3,200,001 to 4,100,000 / year: PKR 430,000 + 30% of amount exceeding 3,200,000'
  },
  {
    slabNumber: 6,
    minIncome: 4100000,
    maxIncome: Infinity,
    fixedTax: 700000,
    ratePercent: 35,
    description: 'Exceeding PKR 4,100,000 / year: PKR 700,000 + 35% of amount exceeding 4,100,000'
  }
]

// 3. Configurable Allowances Master & Allocations
export const INITIAL_ALLOWANCES = [
  {
    id: 'ALW-001',
    code: 'FUEL',
    name: 'Fuel & Mobility Allowance',
    category: 'Transport',
    isTaxable: true,
    amountType: 'Fixed',
    defaultAmount: 25000,
    description: 'Executive vehicle fuel reimbursement allowance (distinct from F12 travel claims)',
    status: 'Active'
  },
  {
    id: 'ALW-002',
    code: 'MED',
    name: 'Medical Care Allowance',
    category: 'Medical',
    isTaxable: false, // Up to 10% of basic is statutory exempt in PK tax law
    amountType: 'Fixed',
    defaultAmount: 15000,
    description: 'Outpatient medical coverage allowance',
    status: 'Active'
  },
  {
    id: 'ALW-003',
    code: 'COMM',
    name: 'Mobile & Internet Connectivity',
    category: 'Utilities',
    isTaxable: true,
    amountType: 'Fixed',
    defaultAmount: 8000,
    description: 'Official communication, 4G, and broadband allowance',
    status: 'Active'
  },
  {
    id: 'ALW-004',
    code: 'MEAL',
    name: 'Subsistence & Meal Stipend',
    category: 'Subsistence',
    isTaxable: true,
    amountType: 'Fixed',
    defaultAmount: 10000,
    description: 'On-duty daily meal stipend',
    status: 'Active'
  }
]

export const INITIAL_EMPLOYEE_ALLOWANCES = [
  { id: 'EALW-001', employeeId: 'EMP-001', allowanceId: 'ALW-001', amount: 35000, status: 'Active', approvedBy: 'Board' },
  { id: 'EALW-002', employeeId: 'EMP-001', allowanceId: 'ALW-002', amount: 20000, status: 'Active', approvedBy: 'Board' },
  { id: 'EALW-003', employeeId: 'EMP-001', allowanceId: 'ALW-003', amount: 10000, status: 'Active', approvedBy: 'Board' },
  { id: 'EALW-004', employeeId: 'EMP-002', allowanceId: 'ALW-002', amount: 15000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-005', employeeId: 'EMP-002', allowanceId: 'ALW-003', amount: 8000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-006', employeeId: 'EMP-003', allowanceId: 'ALW-001', amount: 25000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-007', employeeId: 'EMP-003', allowanceId: 'ALW-002', amount: 15000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-008', employeeId: 'EMP-003', allowanceId: 'ALW-003', amount: 8000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-009', employeeId: 'EMP-004', allowanceId: 'ALW-002', amount: 15000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-010', employeeId: 'EMP-004', allowanceId: 'ALW-003', amount: 6000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-011', employeeId: 'EMP-007', allowanceId: 'ALW-001', amount: 30000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-012', employeeId: 'EMP-007', allowanceId: 'ALW-003', amount: 10000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-013', employeeId: 'EMP-014', allowanceId: 'ALW-002', amount: 15000, status: 'Active', approvedBy: 'Super Admin' },
  { id: 'EALW-014', employeeId: 'EMP-014', allowanceId: 'ALW-003', amount: 8000, status: 'Active', approvedBy: 'Super Admin' }
]

// 4. Sales Commission Plans & Verified Source Transactions
export const INITIAL_COMMISSION_PLANS = [
  {
    id: 'CMP-001',
    name: 'Enterprise Software Sales Commission Plan',
    departmentId: 'DEP-02',
    qualifyingSource: 'Collected Payment', // 'Qualified Deal' | 'Issued Invoice' | 'Collected Payment'
    model: 'Percentage', // 'Fixed' | 'Percentage' | 'Slab'
    ratePercent: 5.0, // 5% of verified collected revenue
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)'
  },
  {
    id: 'CMP-002',
    name: 'Inside Sales Deal Closing Commission',
    departmentId: 'DEP-02',
    qualifyingSource: 'Issued Invoice',
    model: 'Percentage',
    ratePercent: 2.5,
    status: 'Active',
    approvedBy: 'Tariq Mehmood (Super Admin)'
  }
]

export const INITIAL_COMMISSION_TRANSACTIONS = [
  {
    id: 'COM-202610-001',
    employeeId: 'EMP-007',
    employeeName: 'Kamran Raza',
    planId: 'CMP-001',
    sourceRef: 'INV-2026-8812',
    clientName: 'Al-Baraka Logistics Group',
    dealAmount: 850000,
    qualifyingAmount: 850000,
    ratePercent: 5.0,
    commissionAmount: 42500,
    eventDate: '2026-10-05',
    status: 'Approved',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    period: '2026-10',
    payrollIncluded: true
  },
  {
    id: 'COM-202610-002',
    employeeId: 'EMP-008',
    employeeName: 'Nida Yasir',
    planId: 'CMP-001',
    sourceRef: 'INV-2026-8815',
    clientName: 'Pak-Telecom MicroServices',
    dealAmount: 600000,
    qualifyingAmount: 600000,
    ratePercent: 5.0,
    commissionAmount: 30000,
    eventDate: '2026-10-14',
    status: 'Approved',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    period: '2026-10',
    payrollIncluded: true
  }
]

// 5. Employee Loans & Salary Advances (with Amortization Schedules)
export const INITIAL_LOANS = [
  {
    id: 'LN-2026-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    loanType: 'Company Personal Loan',
    principalAmount: 9000,
    disbursedDate: '2026-11-01',
    disbursementDate: '2026-11-01',
    repaymentStartMonth: '2026-11',
    totalInstallments: 3,
    installmentAmount: 3000,
    installmentsPaid: 0,
    repaidAmount: 0,
    outstandingBalance: 9000,
    status: 'Active',
    reason: 'Short term advance',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedDate: '2026-10-28',
    nextDeductionPeriod: '2026-11'
  }
]

// 6. Salary Revision Proposals (Increment / Decrement Governance)
// Cleaned: Mock-only proposals for non-canonical employees (EMP-004 Zeeshan Ali, EMP-006 Usman Ghani)
// removed so runtime canonical PostgreSQL revisions are authoritative without fake data override.
export const INITIAL_SALARY_REVISIONS = []

// 7. Initial Payroll Runs
export const INITIAL_PAYROLL_RUNS = [
  {
    id: 'PAY-2026-09',
    period: '2026-09',
    periodName: 'September 2026',
    fiscalYear: '2026-2027',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'Posted', // 'Draft' | 'Submitted' | 'Approved' | 'Posted'
    totalEmployees: 14,
    grossSalaries: 2985000,
    totalAllowances: 236000,
    totalCommissions: 65000,
    totalBonuses: 0,
    totalOvertime: 32000,
    grossPayroll: 3318000,
    totalDeductions: 324500, // Includes tax, loans, unpaid leave
    totalTaxWithheld: 279500,
    totalLoanDeductions: 20000,
    totalUnpaidDeductions: 25000,
    netPayable: 2993500,
    disbursedTotal: 2993500,
    paymentStatus: 'Disbursed',
    preparedBy: 'Ayesha Khan (HR Admin)',
    preparedAt: '2026-09-28 15:30:00',
    reviewedBy: 'Zubair Shah (Finance Controller)',
    reviewedAt: '2026-09-29 11:00:00',
    approvedBy: 'Tariq Mehmood (Super Admin)',
    approvedAt: '2026-09-30 09:45:00',
    postedAt: '2026-09-30 14:00:00',
    isLocked: true
  },
  {
    id: 'PAY-2026-10',
    period: '2026-10',
    periodName: 'October 2026',
    fiscalYear: '2026-2027',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    status: 'Draft',
    totalEmployees: 14,
    grossSalaries: 2985000,
    totalAllowances: 236000,
    totalCommissions: 72500,
    totalBonuses: 50000,
    totalOvertime: 28500,
    grossPayroll: 3372000,
    totalDeductions: 341200,
    totalTaxWithheld: 291200,
    totalLoanDeductions: 20000,
    totalUnpaidDeductions: 30000,
    netPayable: 3030800,
    disbursedTotal: 0,
    paymentStatus: 'Pending',
    preparedBy: 'Ayesha Khan (HR Admin)',
    preparedAt: '2026-10-25 10:00:00',
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    postedAt: null,
    isLocked: false
  },
  {
    id: 'PAY-2026-11-02',
    runNumber: 'RUN-202611-02',
    period: '2026-11',
    periodName: 'November 2026',
    fiscalYear: '2026-2027',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    status: 'Draft',
    totalEmployees: 5,
    grossSalaries: 180000,
    totalAllowances: 0,
    totalCommissions: 0,
    totalBonuses: 0,
    totalOvertime: 0,
    grossPayroll: 180000,
    totalDeductions: 500,
    totalTaxWithheld: 500,
    totalLoanDeductions: 0,
    totalUnpaidDeductions: 0,
    netPayable: 179500,
    disbursedTotal: 0,
    paymentStatus: 'Pending',
    preparedBy: 'Tariq Mehmood (Super Admin)',
    preparedAt: '2026-11-19 12:00:00',
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    postedAt: null,
    isLocked: false,
    employeeBreakdown: [
      {
        entryId: 'ENT-202611-001',
        employeeId: 'EMP-001',
        employeeCode: 'EMP-001',
        employeeName: 'Tariq Mehmood',
        department: 'Executive Management',
        designation: 'Chief Executive Officer',
        employmentStatus: 'Active',
        basicSalary: 30000,
        allowancesTotal: 0,
        commission: 0,
        overtimePay: 0,
        grossSalary: 30000,
        salaryTaxWithheld: 0,
        loanDeduction: 0,
        unpaidLeaveDeduction: 0,
        totalDeductions: 0,
        netPayable: 30000,
        paymentStatus: 'UNPAID'
      },
      {
        entryId: 'ENT-202611-002',
        employeeId: 'EMP-002',
        employeeCode: 'EMP-002',
        employeeName: 'Ayesha Khan',
        department: 'Human Resources',
        designation: 'Head of Human Resources',
        employmentStatus: 'Active',
        basicSalary: 30000,
        allowancesTotal: 0,
        commission: 0,
        overtimePay: 0,
        grossSalary: 30000,
        salaryTaxWithheld: 0,
        loanDeduction: 0,
        unpaidLeaveDeduction: 0,
        totalDeductions: 0,
        netPayable: 30000,
        paymentStatus: 'UNPAID'
      },
      {
        entryId: 'ENT-202611-003',
        employeeId: 'EMP-003',
        employeeCode: 'EMP-003',
        employeeName: 'Bilal Siddiqui',
        department: 'Development',
        designation: 'Software Engineering Manager',
        employmentStatus: 'Active',
        basicSalary: 30000,
        allowancesTotal: 0,
        commission: 0,
        overtimePay: 0,
        grossSalary: 30000,
        salaryTaxWithheld: 0,
        loanDeduction: 0,
        unpaidLeaveDeduction: 0,
        totalDeductions: 0,
        netPayable: 30000,
        paymentStatus: 'UNPAID'
      },
      {
        entryId: 'ENT-202611-004',
        employeeId: 'EMP-004',
        employeeCode: 'EMP-004',
        employeeName: 'Ali Raza',
        department: 'Development',
        designation: 'Technical Team Lead',
        employmentStatus: 'Active',
        basicSalary: 30000,
        allowancesTotal: 0,
        commission: 0,
        overtimePay: 0,
        grossSalary: 30000,
        salaryTaxWithheld: 0,
        loanDeduction: 0,
        unpaidLeaveDeduction: 0,
        totalDeductions: 0,
        netPayable: 30000,
        paymentStatus: 'UNPAID'
      },
      {
        entryId: 'ENT-202611-005',
        employeeId: 'EMP-005',
        employeeCode: 'EMP-005',
        employeeName: 'Ahmed Khan',
        department: 'Development',
        designation: 'Frontend Developer',
        employmentStatus: 'Active',
        basicSalary: 60000,
        allowancesTotal: 0,
        commission: 0,
        overtimePay: 0,
        grossSalary: 60000,
        salaryTaxWithheld: 500,
        loanDeduction: 0,
        unpaidLeaveDeduction: 0,
        totalDeductions: 500,
        netPayable: 59500,
        paymentStatus: 'UNPAID'
      }
    ]
  }
]
