-- Additive non-destructive migration for Travel & Transport Management full PostgreSQL persistence
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

ALTER TABLE "travel_requests"
  ADD COLUMN IF NOT EXISTS "departureTime" TEXT NOT NULL DEFAULT '08:00 AM',
  ADD COLUMN IF NOT EXISTS "returnTime" TEXT NOT NULL DEFAULT '08:00 PM',
  ADD COLUMN IF NOT EXISTS "clientProjectRef" TEXT,
  ADD COLUMN IF NOT EXISTS "travelMode" TEXT NOT NULL DEFAULT 'Commercial Airline',
  ADD COLUMN IF NOT EXISTS "accommodationRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "supportingNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "attendanceF04Ref" TEXT,
  ADD COLUMN IF NOT EXISTS "managerReviewerId" TEXT,
  ADD COLUMN IF NOT EXISTS "managerReviewerName" TEXT,
  ADD COLUMN IF NOT EXISTS "managerRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "managerReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalApproverId" TEXT,
  ADD COLUMN IF NOT EXISTS "finalApproverName" TEXT,
  ADD COLUMN IF NOT EXISTS "finalApprovalRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "finalApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalHistory" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "expenseCode" TEXT,
  ADD COLUMN IF NOT EXISTS "disbursedAdvance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "advanceDisbursedDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "advanceDisbursedRef" TEXT,
  ADD COLUMN IF NOT EXISTS "advanceDisbursedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeSubmittedExp" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "expenseReceiptRefs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "claimSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimSubmittedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedExpenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "settlementBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "settlementStatus" TEXT NOT NULL DEFAULT 'Not Initialized',
  ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reconciledBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reconciliationNotes" TEXT;

CREATE TABLE IF NOT EXISTS "travel_plans" (
  "id" TEXT NOT NULL,
  "planCode" TEXT NOT NULL,
  "travelRequestId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "departureSchedule" TEXT NOT NULL,
  "returnSchedule" TEXT NOT NULL,
  "transportationType" TEXT NOT NULL DEFAULT 'Commercial Airline',
  "vendorReference" TEXT,
  "bookingReference" TEXT NOT NULL,
  "hotelReference" TEXT,
  "confirmedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "responsibleCoordinator" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Planned',
  "notes" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "travel_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "travel_plans_planCode_key" UNIQUE ("planCode"),
  CONSTRAINT "travel_plans_travelRequestId_fkey" FOREIGN KEY ("travelRequestId") REFERENCES "travel_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "travel_plans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "travel_plans_travelRequestId_status_idx" ON "travel_plans"("travelRequestId", "status");

CREATE TABLE IF NOT EXISTS "transport_vehicles" (
  "id" TEXT NOT NULL,
  "vehicleCode" TEXT NOT NULL,
  "vehicleName" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL DEFAULT 'Van / HiAce',
  "ownershipType" TEXT NOT NULL DEFAULT 'Company Owned',
  "capacity" INTEGER NOT NULL DEFAULT 14,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_vehicles_vehicleCode_key" UNIQUE ("vehicleCode"),
  CONSTRAINT "transport_vehicles_registrationNumber_key" UNIQUE ("registrationNumber")
);

CREATE TABLE IF NOT EXISTS "transport_drivers" (
  "id" TEXT NOT NULL,
  "driverCode" TEXT NOT NULL,
  "driverName" TEXT NOT NULL,
  "licenseNumber" TEXT,
  "contactNumber" TEXT NOT NULL,
  "assignedVehicleId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_drivers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_drivers_driverCode_key" UNIQUE ("driverCode"),
  CONSTRAINT "transport_drivers_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" TEXT NOT NULL,
  "routeCode" TEXT NOT NULL,
  "routeName" TEXT NOT NULL,
  "pickupPoints" JSONB NOT NULL DEFAULT '[]',
  "dropPoint" TEXT NOT NULL DEFAULT 'iSysware HQ Tech Park',
  "morningDepartureTime" TEXT NOT NULL DEFAULT '07:30 AM',
  "eveningDepartureTime" TEXT NOT NULL DEFAULT '06:15 PM',
  "assignedVehicleId" TEXT,
  "assignedDriverId" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 14,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_routes_routeCode_key" UNIQUE ("routeCode"),
  CONSTRAINT "transport_routes_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "transport_routes_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "transport_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "transport_assignments" (
  "id" TEXT NOT NULL,
  "assignmentCode" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "pickupPoint" TEXT NOT NULL,
  "dropPoint" TEXT NOT NULL DEFAULT 'iSysware HQ Tech Park',
  "pickupTime" TEXT NOT NULL DEFAULT '07:45 AM',
  "dropTime" TEXT NOT NULL DEFAULT '06:15 PM',
  "applicableDays" JSONB NOT NULL DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
  "facilityType" TEXT NOT NULL DEFAULT 'Company Subsidized',
  "monthlyContribution" DECIMAL(10,2) NOT NULL DEFAULT 3000,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Pending Approval',
  "approvedBy" TEXT,
  "approvedDate" TIMESTAMP(3),
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transport_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_assignments_assignmentCode_key" UNIQUE ("assignmentCode"),
  CONSTRAINT "transport_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "transport_assignments_employeeId_status_idx" ON "transport_assignments"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "transport_assignments_routeId_status_idx" ON "transport_assignments"("routeId", "status");

