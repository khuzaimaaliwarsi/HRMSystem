/**
 * iSysware HRMS — Batch F10: Travel & Pick-and-Drop Management Mock Data
 * Authoritative initial data structures for:
 * - Transport Vehicles & Drivers Master
 * - Corporate Pick-and-Drop Transport Routes & Roster
 * - Official Travel Requests & Multi-tier Approvals
 * - Confirmed Travel Plans & Itineraries
 * - Travel Advances & Expense Reconciliation Records
 */

export const INITIAL_VEHICLES = [
  {
    vehicleId: 'VEH-001',
    registrationNumber: 'LEA-2024-8891',
    vehicleName: 'Toyota HiAce Grand Cabin (Van 1)',
    vehicleType: '14-Seater Van',
    capacity: 14,
    ownershipType: 'Company Owned',
    vendorReference: null,
    fuelType: 'Diesel',
    status: 'Active',
    assignedRouteId: 'ROUTE-01',
    assignedDriverId: 'DRV-001'
  },
  {
    vehicleId: 'VEH-002',
    registrationNumber: 'LEC-2023-4512',
    vehicleName: 'Toyota Coaster Executive (Coaster 1)',
    vehicleType: '28-Seater Coaster',
    capacity: 28,
    ownershipType: 'Vendor Contract',
    vendorReference: 'Daewoo Corporate Fleet Logistics',
    fuelType: 'Diesel',
    status: 'Active',
    assignedRouteId: 'ROUTE-02',
    assignedDriverId: 'DRV-002'
  },
  {
    vehicleId: 'VEH-003',
    registrationNumber: 'LEE-2025-1029',
    vehicleName: 'Toyota HiAce Standard (Van 2)',
    vehicleType: '14-Seater Van',
    capacity: 14,
    ownershipType: 'Company Owned',
    vendorReference: null,
    fuelType: 'Diesel',
    status: 'Active',
    assignedRouteId: 'ROUTE-03',
    assignedDriverId: 'DRV-003'
  },
  {
    vehicleId: 'VEH-004',
    registrationNumber: 'LEG-2024-9901',
    vehicleName: 'Toyota Corolla Altis (Pool Car)',
    vehicleType: 'Executive Sedan',
    capacity: 4,
    ownershipType: 'Company Owned',
    vendorReference: null,
    fuelType: 'Petrol / Hybrid',
    status: 'Active',
    assignedRouteId: null, // Official Field Travel Pool
    assignedDriverId: 'DRV-004'
  }
]

export const INITIAL_DRIVERS = [
  {
    driverId: 'DRV-001',
    driverName: 'Muhammad Ramzan',
    contactNumber: '+92 300 4567890',
    cnic: '35202-1234567-1',
    licenseNumber: 'LHR-HTV-98712',
    assignedVehicleId: 'VEH-001',
    employmentType: 'Permanent Staff',
    vendorReference: null,
    status: 'Active'
  },
  {
    driverId: 'DRV-002',
    driverName: 'Abdul Ghafoor',
    contactNumber: '+92 321 8765432',
    cnic: '35201-9876543-3',
    licenseNumber: 'LHR-PSV-45109',
    assignedVehicleId: 'VEH-002',
    employmentType: 'Vendor Contractor',
    vendorReference: 'Daewoo Corporate Fleet Logistics',
    status: 'Active'
  },
  {
    driverId: 'DRV-003',
    driverName: 'Sajid Mehmood',
    contactNumber: '+92 333 5551234',
    cnic: '35202-7771234-5',
    licenseNumber: 'LHR-HTV-22108',
    assignedVehicleId: 'VEH-003',
    employmentType: 'Permanent Staff',
    vendorReference: null,
    status: 'Active'
  },
  {
    driverId: 'DRV-004',
    driverName: 'Rashid Minhas',
    contactNumber: '+92 345 9998877',
    cnic: '35202-3334455-7',
    licenseNumber: 'LHR-LTV-66541',
    assignedVehicleId: 'VEH-004',
    employmentType: 'Permanent Staff',
    vendorReference: null,
    status: 'Active'
  }
]

export const INITIAL_ROUTES = [
  {
    routeId: 'ROUTE-01',
    routeName: 'Route 1 — Johar Town & Wapda Town to HQ',
    pickupPoints: ['G1 Market Johar Town', 'Wapda Town Roundabout', 'Faisal Town Roundabout', 'Model Town Link Road', 'iSysware HQ Tech Park'],
    dropPoints: ['iSysware HQ Tech Park', 'Model Town Link Road', 'Wapda Town Roundabout', 'G1 Market Johar Town'],
    morningDepartureTime: '07:45 AM',
    morningArrivalTime: '08:45 AM',
    eveningDepartureTime: '06:15 PM',
    assignedVehicleId: 'VEH-001',
    assignedVehicleName: 'Toyota HiAce Grand Cabin (Van 1)',
    assignedDriverId: 'DRV-001',
    assignedDriverName: 'Muhammad Ramzan',
    capacity: 14,
    assignedCount: 11,
    status: 'Active'
  },
  {
    routeId: 'ROUTE-02',
    routeName: 'Route 2 — DHA Phase 1 to Phase 6 & Gulberg to HQ',
    pickupPoints: ['DHA Phase 5 Commercial', 'DHA Phase 3 Y-Block', 'Main Boulevard Gulberg', 'Kalma Chowk', 'iSysware HQ Tech Park'],
    dropPoints: ['iSysware HQ Tech Park', 'Kalma Chowk', 'Main Boulevard Gulberg', 'DHA Phase 3 Y-Block', 'DHA Phase 5 Commercial'],
    morningDepartureTime: '07:30 AM',
    morningArrivalTime: '08:40 AM',
    eveningDepartureTime: '06:15 PM',
    assignedVehicleId: 'VEH-002',
    assignedVehicleName: 'Toyota Coaster Executive (Coaster 1)',
    assignedDriverId: 'DRV-002',
    assignedDriverName: 'Abdul Ghafoor',
    capacity: 28,
    assignedCount: 22,
    status: 'Active'
  },
  {
    routeId: 'ROUTE-03',
    routeName: 'Route 3 — Allama Iqbal Town & Gulshan Ravi to HQ',
    pickupPoints: ['Moon Market Iqbal Town', 'Bhekewal Mor', 'Wahdat Road', 'Muslim Town Mor', 'iSysware HQ Tech Park'],
    dropPoints: ['iSysware HQ Tech Park', 'Muslim Town Mor', 'Wahdat Road', 'Moon Market Iqbal Town'],
    morningDepartureTime: '07:40 AM',
    morningArrivalTime: '08:45 AM',
    eveningDepartureTime: '06:15 PM',
    assignedVehicleId: 'VEH-003',
    assignedVehicleName: 'Toyota HiAce Standard (Van 2)',
    assignedDriverId: 'DRV-003',
    assignedDriverName: 'Sajid Mehmood',
    capacity: 14,
    assignedCount: 12,
    status: 'Active'
  }
]

export const INITIAL_TRANSPORT_ASSIGNMENTS = [
  {
    assignmentId: 'TRANS-ASN-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Engineering',
    routeId: 'ROUTE-01',
    routeName: 'Route 1 — Johar Town & Wapda Town to HQ',
    pickupPoint: 'G1 Market Johar Town',
    dropPoint: 'iSysware HQ Tech Park',
    pickupTime: '07:50 AM',
    dropTime: '06:45 PM',
    applicableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    facilityType: 'Company Subsidized',
    monthlyContribution: 3000,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Ayesha Khan',
    approvedDate: '2025-12-28'
  },
  {
    assignmentId: 'TRANS-ASN-002',
    employeeId: 'EMP-005',
    employeeName: 'Sana Malik',
    department: 'Finance',
    routeId: 'ROUTE-02',
    routeName: 'Route 2 — DHA Phase 1 to Phase 6 & Gulberg to HQ',
    pickupPoint: 'DHA Phase 3 Y-Block',
    dropPoint: 'iSysware HQ Tech Park',
    pickupTime: '07:45 AM',
    dropTime: '06:50 PM',
    applicableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    facilityType: 'Company Subsidized',
    monthlyContribution: 3000,
    effectiveFrom: '2026-02-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Ayesha Khan',
    approvedDate: '2026-01-25'
  },
  {
    assignmentId: 'TRANS-ASN-003',
    employeeId: 'EMP-008',
    employeeName: 'Usman Ghani',
    department: 'Engineering',
    routeId: 'ROUTE-03',
    routeName: 'Route 3 — Allama Iqbal Town & Gulshan Ravi to HQ',
    pickupPoint: 'Moon Market Iqbal Town',
    dropPoint: 'iSysware HQ Tech Park',
    pickupTime: '07:40 AM',
    dropTime: '06:55 PM',
    applicableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    facilityType: 'Free / Executive Entitlement',
    monthlyContribution: 0,
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    status: 'Active',
    approvedBy: 'Tariq Mehmood',
    approvedDate: '2026-02-28'
  }
]

export const INITIAL_TRAVEL_REQUESTS = [
  {
    requestId: 'TRV-2026-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Engineering',
    travelPurpose: 'Client Enterprise Microservices Deployment & UAT Sign-off',
    clientReference: 'Habib Bank Limited (HBL) Core Infrastructure',
    destination: 'Islamabad / Rawalpindi',
    departureDate: '2026-11-05',
    departureTime: '08:00',
    returnDate: '2026-11-08',
    returnTime: '20:00',
    travelMode: 'Flight',
    accommodationRequired: true,
    estimatedBudget: 85000,
    requestedAdvance: 40000,
    supportingNotes: 'On-site technical support required for production deployment at HBL Data Center Blue Area Islamabad.',
    status: 'Approved',
    submittedAt: '2026-10-20T10:00:00Z',
    managerReviewerId: 'EMP-003',
    managerReviewerName: 'Bilal Ahmed',
    managerRemarks: 'Critical project milestone. Recommended for full approval.',
    managerReviewedAt: '2026-10-21T11:30:00Z',
    finalApproverId: 'EMP-002',
    finalApproverName: 'Ayesha Khan',
    finalApprovalRemarks: 'Approved as per Tier-2 corporate travel policy.',
    finalApprovedAt: '2026-10-22T09:15:00Z',
    attendanceF04Ref: 'DUTY-FLD-2026-1105'
  },
  {
    requestId: 'TRV-2026-002',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Ahmed',
    department: 'Engineering',
    travelPurpose: 'Annual FinTech Summit & Strategic Architecture Conference',
    clientReference: 'Pakistan Banking Association FinTech 2026',
    destination: 'Karachi',
    departureDate: '2026-11-18',
    departureTime: '07:30',
    returnDate: '2026-11-20',
    returnTime: '22:00',
    travelMode: 'Flight',
    accommodationRequired: true,
    estimatedBudget: 125000,
    requestedAdvance: 60000,
    supportingNotes: 'Representing iSysware HRMS Architecture at the national banking summit.',
    status: 'Approved',
    submittedAt: '2026-10-23T14:00:00Z',
    managerReviewerId: null, // Manager requests escalate directly to HR & Super Admin
    managerReviewerName: null,
    managerRemarks: null,
    managerReviewedAt: null,
    finalApproverId: 'EMP-001',
    finalApproverName: 'Tariq Mehmood',
    finalApprovalRemarks: 'Approved for strategic executive representation.',
    finalApprovedAt: '2026-10-24T16:00:00Z',
    attendanceF04Ref: 'DUTY-FLD-2026-1118'
  },
  {
    requestId: 'TRV-2026-003',
    employeeId: 'EMP-005',
    employeeName: 'Sana Malik',
    department: 'Finance',
    travelPurpose: 'Regional Branch Financial Audit & Fixed Assets Physical Verification',
    clientReference: 'iSysware Faisalabad Regional Technology Centre',
    destination: 'Faisalabad',
    departureDate: '2026-11-12',
    departureTime: '09:00',
    returnDate: '2026-11-13',
    returnTime: '18:00',
    travelMode: 'Company Pool Vehicle',
    accommodationRequired: true,
    estimatedBudget: 35000,
    requestedAdvance: 15000,
    supportingNotes: 'Q3 physical inventory and audit verification.',
    status: 'Under Review',
    submittedAt: '2026-10-25T11:00:00Z',
    managerReviewerId: 'EMP-002',
    managerReviewerName: 'Ayesha Khan',
    managerRemarks: 'Verified schedule with regional office. Recommended.',
    managerReviewedAt: '2026-10-26T10:00:00Z',
    finalApproverId: null,
    finalApproverName: null,
    finalApprovalRemarks: null,
    finalApprovedAt: null,
    attendanceF04Ref: null
  },
  {
    requestId: 'TRV-2026-004',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    department: 'Engineering',
    travelPurpose: 'Pre-sales technical scoping at client premises',
    clientReference: 'Standard Chartered Bank Regional Operations',
    destination: 'Karachi',
    departureDate: '2026-12-01',
    departureTime: '08:30',
    returnDate: '2026-12-03',
    returnTime: '19:00',
    travelMode: 'Flight',
    accommodationRequired: true,
    estimatedBudget: 75000,
    requestedAdvance: 35000,
    supportingNotes: 'Requirement gathering for banking API gateway connector.',
    status: 'Submitted',
    submittedAt: '2026-10-27T04:00:00Z',
    managerReviewerId: null,
    managerReviewerName: null,
    managerRemarks: null,
    managerReviewedAt: null,
    finalApproverId: null,
    finalApproverName: null,
    finalApprovalRemarks: null,
    finalApprovedAt: null,
    attendanceF04Ref: null
  }
]

export const INITIAL_TRAVEL_PLANS = [
  {
    planId: 'TRV-PLAN-001',
    requestId: 'TRV-2026-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    destination: 'Islamabad / Rawalpindi',
    departureSchedule: '2026-11-05 08:30 PK-382 PIA',
    returnSchedule: '2026-11-08 19:45 PK-387 PIA',
    transportationType: 'Commercial Airline',
    vendorReference: 'Pakistan International Airlines (PIA)',
    bookingReference: 'PIA-PNR-77812A',
    hotelReference: 'Islamabad Serena Hotel (Booking #SRN-89102)',
    confirmedCost: 78500,
    responsibleCoordinator: 'Ayesha Khan (HR Logistics)',
    status: 'Planned',
    notes: 'Ticket and hotel vouchers issued and handed over.'
  },
  {
    planId: 'TRV-PLAN-002',
    requestId: 'TRV-2026-002',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Ahmed',
    destination: 'Karachi',
    departureSchedule: '2026-11-18 07:30 Airblue PA-401',
    returnSchedule: '2026-11-20 20:30 Airblue PA-406',
    transportationType: 'Commercial Airline',
    vendorReference: 'Airblue Corporate Desk',
    bookingReference: 'AB-PNR-44129B',
    hotelReference: 'Movenpick Hotel Karachi (Conf #MP-66512)',
    confirmedCost: 118000,
    responsibleCoordinator: 'Ayesha Khan (HR Logistics)',
    status: 'Planned',
    notes: 'VIP executive airport transfer pre-booked.'
  }
]

export const INITIAL_TRAVEL_EXPENSES = [
  {
    expenseId: 'TRV-EXP-001',
    requestId: 'TRV-2026-001',
    planId: 'TRV-PLAN-001',
    employeeId: 'EMP-004',
    employeeName: 'Zeeshan Ali',
    approvedBudget: 85000,
    requestedAdvance: 40000,
    disbursedAdvance: 40000,
    advanceDisbursedDate: '2026-10-23',
    advanceDisbursedReference: 'PETTY-CASH-VOUCHER #7781',
    employeeSubmittedExpenses: 42500,
    expenseReceiptReferences: ['boarding_passes_pnr77812.pdf', 'hotel_invoice_serena.pdf', 'client_commute_uber.pdf'],
    approvedExpenses: 42500,
    settlementBalance: 2500, // Positive means additional reimbursement due to employee
    settlementStatus: 'Pending Final Settlement', // 'Advance Disbursed', 'Pending Final Settlement', 'Settled'
    notes: 'Employee spent PKR 2,500 above disbursed advance for emergency client transport.'
  },
  {
    expenseId: 'TRV-EXP-002',
    requestId: 'TRV-2026-002',
    planId: 'TRV-PLAN-002',
    employeeId: 'EMP-003',
    employeeName: 'Bilal Ahmed',
    approvedBudget: 125000,
    requestedAdvance: 60000,
    disbursedAdvance: 60000,
    advanceDisbursedDate: '2026-10-25',
    advanceDisbursedReference: 'PETTY-CASH-VOUCHER #7789',
    employeeSubmittedExpenses: 0,
    expenseReceiptReferences: [],
    approvedExpenses: 0,
    settlementBalance: -60000, // Negative means unused advance currently held by employee
    settlementStatus: 'Advance Disbursed',
    notes: 'Advance disbursed prior to trip departure.'
  }
]
