-- Additive migration for Help Desk Management full PostgreSQL persistence
ALTER TYPE "HelpDeskPriority" ADD VALUE IF NOT EXISTS 'CRITICAL';
ALTER TYPE "HelpDeskStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';

ALTER TABLE "help_desk_tickets"
  ALTER COLUMN "employeeId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterName" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterDepartment" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedResolverName" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedTeamId" TEXT NOT NULL DEFAULT 'TEAM-IT',
  ADD COLUMN IF NOT EXISTS "assignedTeamName" TEXT NOT NULL DEFAULT 'IT Operations & Infrastructure',
  ADD COLUMN IF NOT EXISTS "categoryCode" TEXT NOT NULL DEFAULT 'CAT-IT',
  ADD COLUMN IF NOT EXISTS "categoryLabel" TEXT NOT NULL DEFAULT 'Information Technology (IT)',
  ADD COLUMN IF NOT EXISTS "subcategory" TEXT,
  ADD COLUMN IF NOT EXISTS "firstResponseDue" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isEscalated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "escalationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escalatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedModule" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentRef" TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "satisfactionRating" INTEGER,
  ADD COLUMN IF NOT EXISTS "satisfactionFeedback" TEXT,
  ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reopenReason" TEXT,
  ADD COLUMN IF NOT EXISTS "timeline" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "help_desk_tickets_assignedToId_status_idx" ON "help_desk_tickets"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "help_desk_tickets_status_priority_idx" ON "help_desk_tickets"("status", "priority");

CREATE TABLE IF NOT EXISTS "help_desk_comments" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderEmployeeId" TEXT,
  "senderUserId" TEXT,
  "senderName" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "help_desk_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "help_desk_comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "help_desk_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "help_desk_comments_senderEmployeeId_fkey" FOREIGN KEY ("senderEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "help_desk_comments_ticketId_createdAt_idx" ON "help_desk_comments"("ticketId", "createdAt");

