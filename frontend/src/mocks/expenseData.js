/**
 * iSysware HRMS — Batch F12: Expense Management Initial Mock Dataset
 * Authoritative initial state for:
 * - Expense Categories & Configurable Limits
 * - Company-wide Expense Claims & Multi-tier Approvals
 * - Reimbursement & Payment Tracking
 * - Travel Expense Reconciliation Links (Bridged with F10 Travel)
 * - Audit Trail & Policy Version References
 */

export const INITIAL_EXPENSE_CATEGORIES = [
  {
    categoryId: 'CAT-TRV',
    categoryName: 'Official Travel',
    code: 'TRV',
    description: 'Intercity official travel, flights, railway and local transit for business purposes.',
    perClaimLimit: 150000,
    monthlyLimit: 300000,
    dailyLimit: 40000,
    receiptRequiredThreshold: 1000,
    requiresTravelRequestRef: true,
    requiresPreApproval: true,
    isActive: true,
    allowAllowanceOverlap: false
  },
  {
    categoryId: 'CAT-FUEL',
    categoryName: 'Fuel',
    code: 'FUEL',
    description: 'Actual vehicle fuel expenditure incurred for company errands and client visits.',
    perClaimLimit: 25000,
    monthlyLimit: 60000,
    dailyLimit: 12000,
    receiptRequiredThreshold: 500,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: false // If receiving monthly fuel allowance in F06, requires special exception
  },
  {
    categoryId: 'CAT-MEAL',
    categoryName: 'Food / Meals',
    code: 'MEAL',
    description: 'Authorized business meal expenses and official client entertainment.',
    perClaimLimit: 15000,
    monthlyLimit: 40000,
    dailyLimit: 8000,
    receiptRequiredThreshold: 500,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: true
  },
  {
    categoryId: 'CAT-CLNT',
    categoryName: 'Client Meetings',
    code: 'CLNT',
    description: 'Client presentations, official business dining and boardroom hospitality.',
    perClaimLimit: 35000,
    monthlyLimit: 80000,
    dailyLimit: 25000,
    receiptRequiredThreshold: 1000,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: true
  },
  {
    categoryId: 'CAT-MED',
    categoryName: 'Medical Reimbursement',
    code: 'MED',
    description: 'Outpatient medical consultations, prescription medications and emergency clinic fees.',
    perClaimLimit: 50000,
    monthlyLimit: 100000,
    dailyLimit: 30000,
    receiptRequiredThreshold: 1000,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: true
  },
  {
    categoryId: 'CAT-ACCM',
    categoryName: 'Accommodation',
    code: 'ACCM',
    description: 'Hotel room stays and official lodging during approved business tours.',
    perClaimLimit: 60000,
    monthlyLimit: 150000,
    dailyLimit: 20000,
    receiptRequiredThreshold: 2000,
    requiresTravelRequestRef: true,
    requiresPreApproval: true,
    isActive: true,
    allowAllowanceOverlap: false
  },
  {
    categoryId: 'CAT-SUPP',
    categoryName: 'Office Supplies',
    code: 'SUPP',
    description: 'Emergency project stationery, cables, adapters and minor office hardware.',
    perClaimLimit: 20000,
    monthlyLimit: 50000,
    dailyLimit: 10000,
    receiptRequiredThreshold: 500,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: true
  },
  {
    categoryId: 'CAT-COMM',
    categoryName: 'Communication / Internet',
    code: 'COMM',
    description: 'Field mobile data packages, emergency project Wi-Fi and conference call bridge fees.',
    perClaimLimit: 10000,
    monthlyLimit: 25000,
    dailyLimit: 5000,
    receiptRequiredThreshold: 500,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: false
  },
  {
    categoryId: 'CAT-OTHR',
    categoryName: 'Other Approved Business Expenses',
    code: 'OTHR',
    description: 'Miscellaneous operational expenses with prior departmental management concurrence.',
    perClaimLimit: 30000,
    monthlyLimit: 75000,
    dailyLimit: 15000,
    receiptRequiredThreshold: 1000,
    requiresTravelRequestRef: false,
    requiresPreApproval: false,
    isActive: true,
    allowAllowanceOverlap: true
  }
]

export const INITIAL_FINANCIAL_AUTHORITY_LIMITS = {
  managerMaxLimit: 25000,    // Manager can approve up to PKR 25,000
  hrAdminMaxLimit: 75000,    // HR/Admin can approve up to PKR 75,000
  superAdminThreshold: 75000 // Claims > 75,000 require Super Admin approval
}

export const INITIAL_EXPENSE_CLAIMS = [
  {
    claimId: 'EXP-2026-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Development',
    departmentId: 'DEP-01',
    expenseDate: '2026-10-18',
    submissionDate: '2026-10-19',
    category: 'Client Meetings',
    categoryId: 'CAT-CLNT',
    amount: 14500,
    currency: 'PKR',
    description: 'Client architecture presentation dinner and boardroom refreshments.',
    receiptReference: 'REC-MEET-2026-8812.pdf',
    receiptFileName: 'client_meeting_receipt_oct18.pdf',
    projectClient: 'HBL Core Gateway Project',
    relatedTravelRequestId: null,
    paymentMethodUsed: 'Personal Credit Card',
    requestedReimbursementAccount: 'Meezan Bank - PK36MEZN0001002938475829',
    applicablePolicy: 'Standard Business Expense Policy 2026 (v1.2)',
    approvalStatus: 'Approved', // Draft, Submitted, Under Review, Approved, Rejected, Returned
    paymentStatus: 'Paid',     // Unapproved, Payment Pending, Partially Paid, Paid, Closed
    paidAmount: 14500,
    remainingPayable: 0,
    managerReviewerId: 'EMP-003',
    managerReviewerName: 'Bilal Siddiqui',
    managerRemarks: 'Verified against project deliverable milestone. Approved.',
    managerReviewedAt: '2026-10-20T10:15:00Z',
    finalApproverId: 'EMP-003',
    finalApproverName: 'Bilal Siddiqui',
    finalApprovalRemarks: 'Within manager authority limit (<= 25k).',
    finalApprovedAt: '2026-10-20T10:15:00Z',
    reimbursements: [
      {
        reimbursementId: 'REIMB-2026-001',
        paymentDate: '2026-10-24',
        amount: 14500,
        paymentMethod: 'Bank Transfer',
        bankAccountReference: 'Meezan Bank - PK36MEZN0001002938475829',
        transactionReference: 'FT-MEZN-99102-EXP',
        paidBy: 'Ayesha Khan (Finance/HR)',
        notes: 'Full reimbursement disbursed via direct bank advice.'
      }
    ],
    auditHistory: [
      {
        action: 'Claim Submitted',
        actor: 'Zeeshan Ali',
        timestamp: '2026-10-19T09:00:00Z',
        remarks: 'Claim submitted with attached verified invoice.'
      },
      {
        action: 'Approved by Manager',
        actor: 'Bilal Siddiqui',
        timestamp: '2026-10-20T10:15:00Z',
        remarks: 'Approved within departmental budget limit.'
      },
      {
        action: 'Reimbursement Paid',
        actor: 'Ayesha Khan',
        timestamp: '2026-10-24T14:30:00Z',
        remarks: 'Disbursed PKR 14,500 via Bank Advice FT-MEZN-99102-EXP.'
      }
    ]
  },
  {
    claimId: 'EXP-2026-002',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Development',
    departmentId: 'DEP-01',
    expenseDate: '2026-10-22',
    submissionDate: '2026-10-23',
    category: 'Official Travel',
    categoryId: 'CAT-TRV',
    amount: 42500,
    currency: 'PKR',
    description: 'Excess intercity cab and lodging incurred during Islamabad client integration.',
    receiptReference: 'REC-TRV-ISB-9921.pdf',
    receiptFileName: 'islamabad_transit_invoices.pdf',
    projectClient: 'Federal Treasury Portal Deployment',
    relatedTravelRequestId: 'TRV-2026-001',
    paymentMethodUsed: 'Cash / Corporate Advance',
    requestedReimbursementAccount: 'Meezan Bank - PK36MEZN0001002938475829',
    applicablePolicy: 'Travel & Mobility Expense Policy (v2.0)',
    approvalStatus: 'Approved',
    paymentStatus: 'Payment Pending',
    paidAmount: 40000,
    remainingPayable: 2500, // PKR 40k settled against advance, PKR 2.5k pending additional reimbursement
    managerReviewerId: 'EMP-003',
    managerReviewerName: 'Bilal Siddiqui',
    managerRemarks: 'Verified travel reconciliation against TRV-2026-001. Recommended for HR authorization.',
    managerReviewedAt: '2026-10-24T11:00:00Z',
    finalApproverId: 'EMP-002',
    finalApproverName: 'Ayesha Khan',
    finalApprovalRemarks: 'Authorized under travel policy. Reconciled with F10 advance voucher #7781.',
    finalApprovedAt: '2026-10-25T15:30:00Z',
    reimbursements: [],
    auditHistory: [
      {
        action: 'Claim Submitted',
        actor: 'Zeeshan Ali',
        timestamp: '2026-10-23T11:00:00Z',
        remarks: 'Linked to authorized travel request TRV-2026-001.'
      },
      {
        action: 'Manager Reviewed & Escalated',
        actor: 'Bilal Siddiqui',
        timestamp: '2026-10-24T11:00:00Z',
        remarks: 'Amount > 25k, escalated to HR/Admin authority.'
      },
      {
        action: 'Final Approval by HR/Admin',
        actor: 'Ayesha Khan',
        timestamp: '2026-10-25T15:30:00Z',
        remarks: 'Approved. Disbursed advance PKR 40,000 adjusted; net payable PKR 2,500.'
      }
    ]
  },
  {
    claimId: 'EXP-2026-003',
    employeeId: 'EMP-005',
    employeeName: 'Fatima Noor',
    department: 'Quality Assurance',
    departmentId: 'DEP-02',
    expenseDate: '2026-10-25',
    submissionDate: '2026-10-26',
    category: 'Fuel',
    categoryId: 'CAT-FUEL',
    amount: 18000,
    currency: 'PKR',
    description: 'On-site user acceptance testing commute for telecommunication billing engine.',
    receiptReference: 'REC-FUEL-UAT-4412.pdf',
    receiptFileName: 'fuel_slips_shell_lahore.pdf',
    projectClient: 'Jazz Digital Ops UAT',
    relatedTravelRequestId: null,
    paymentMethodUsed: 'Cash',
    requestedReimbursementAccount: 'Standard Chartered Bank - PK19SCBL0002819283748291',
    applicablePolicy: 'Standard Business Expense Policy 2026 (v1.2)',
    approvalStatus: 'Submitted',
    paymentStatus: 'Unapproved',
    paidAmount: 0,
    remainingPayable: 18000,
    managerReviewerId: null,
    managerReviewerName: null,
    managerRemarks: null,
    managerReviewedAt: null,
    finalApproverId: null,
    finalApproverName: null,
    finalApprovalRemarks: null,
    finalApprovedAt: null,
    reimbursements: [],
    auditHistory: [
      {
        action: 'Claim Submitted',
        actor: 'Fatima Noor',
        timestamp: '2026-10-26T08:30:00Z',
        remarks: 'Claim placed in Manager approval queue.'
      }
    ]
  },
  {
    claimId: 'EXP-2026-004',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Siddiqui',
    department: 'Development',
    departmentId: 'DEP-01',
    expenseDate: '2026-10-24',
    submissionDate: '2026-10-25',
    category: 'Office Supplies',
    categoryId: 'CAT-SUPP',
    amount: 19500,
    currency: 'PKR',
    description: 'High-speed test bench USB Hubs, DisplayPort cables and surge protectors.',
    receiptReference: 'REC-SUPP-HAFEEZ-7821.pdf',
    receiptFileName: 'hafeez_centre_invoice_oct24.pdf',
    projectClient: 'Dev Lab Infrastructure Refresh',
    relatedTravelRequestId: null,
    paymentMethodUsed: 'Personal Credit Card',
    requestedReimbursementAccount: 'Habib Bank Limited - PK88HABB0003928172839485',
    applicablePolicy: 'Office Equipment & Consumables Rule (v1.0)',
    approvalStatus: 'Submitted', // Manager cannot self-approve; routed to HR/Admin
    paymentStatus: 'Unapproved',
    paidAmount: 0,
    remainingPayable: 19500,
    managerReviewerId: null,
    managerReviewerName: null,
    managerRemarks: null,
    managerReviewedAt: null,
    finalApproverId: null,
    finalApproverName: null,
    finalApprovalRemarks: null,
    finalApprovedAt: null,
    reimbursements: [],
    auditHistory: [
      {
        action: 'Claim Submitted by Manager',
        actor: 'Bilal Siddiqui',
        timestamp: '2026-10-25T14:00:00Z',
        remarks: 'Manager personal claim routed to HR/Admin to strictly prevent anti-self-approval.'
      }
    ]
  },
  {
    claimId: 'EXP-2026-005',
    employeeId: 'EMP-002',
    employeeName: 'Ayesha Khan',
    department: 'Human Resources',
    departmentId: 'DEP-04',
    expenseDate: '2026-10-21',
    submissionDate: '2026-10-22',
    category: 'Client Meetings',
    categoryId: 'CAT-CLNT',
    amount: 88000,
    currency: 'PKR',
    description: 'Annual HR Leadership Summit executive catering and delegate collateral.',
    receiptReference: 'REC-SUMMIT-PC-1029.pdf',
    receiptFileName: 'pearl_continental_invoice_summit.pdf',
    projectClient: 'Corporate HR Leadership Forum',
    relatedTravelRequestId: null,
    paymentMethodUsed: 'Personal Corporate Card',
    requestedReimbursementAccount: 'Bank Alfalah - PK44ALFH0004928172839401',
    applicablePolicy: 'Executive Entertainment & Events Policy (v1.5)',
    approvalStatus: 'Submitted', // > 75k and submitted by HR Lead -> must route to Super Admin
    paymentStatus: 'Unapproved',
    paidAmount: 0,
    remainingPayable: 88000,
    managerReviewerId: null,
    managerReviewerName: null,
    managerRemarks: null,
    managerReviewedAt: null,
    finalApproverId: null,
    finalApproverName: null,
    finalApprovalRemarks: null,
    finalApprovedAt: null,
    reimbursements: [],
    auditHistory: [
      {
        action: 'Executive Claim Submitted',
        actor: 'Ayesha Khan',
        timestamp: '2026-10-22T16:00:00Z',
        remarks: 'High-value claim (> 75,000 PKR) routed directly to Super Admin authority.'
      }
    ]
  }
]
