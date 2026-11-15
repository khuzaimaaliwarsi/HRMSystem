-- Additive migration for complete Training & Development PostgreSQL persistence
-- Preserves all existing training_programs and training_enrollments rows cleanly.

ALTER TABLE "training_programs"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Technical',
  ADD COLUMN IF NOT EXISTS "skills" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "eligibleDepartments" JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "eligibleDesignations" JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "trainingType" TEXT NOT NULL DEFAULT 'Internal',
  ADD COLUMN IF NOT EXISTS "prerequisites" TEXT NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS "materials" TEXT NOT NULL DEFAULT 'Standard Training Guide & Slides',
  ADD COLUMN IF NOT EXISTS "costPerParticipant" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT;

CREATE TABLE IF NOT EXISTS "training_plans" (
  "id" TEXT NOT NULL,
  "planCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "planType" TEXT NOT NULL DEFAULT 'Individual',
  "programId" TEXT NOT NULL,
  "targetDepartmentId" TEXT,
  "targetEmployeeId" TEXT,
  "isMandatory" BOOLEAN NOT NULL DEFAULT false,
  "skillsGapSource" TEXT NOT NULL DEFAULT 'Manager Recommendation',
  "justification" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'Medium',
  "targetQuarter" TEXT NOT NULL DEFAULT 'Q4 2026',
  "status" TEXT NOT NULL DEFAULT 'Recommended',
  "recommendedById" TEXT,
  "recommendedByName" TEXT,
  "approvedById" TEXT,
  "approvedByName" TEXT,
  "decisionRemarks" TEXT,
  "approvedAt" TIMESTAMP(3),
  "enrolledCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "training_plans_planCode_key" ON "training_plans"("planCode");
CREATE INDEX IF NOT EXISTS "training_plans_programId_idx" ON "training_plans"("programId");
CREATE INDEX IF NOT EXISTS "training_plans_targetDepartmentId_idx" ON "training_plans"("targetDepartmentId");
CREATE INDEX IF NOT EXISTS "training_plans_targetEmployeeId_idx" ON "training_plans"("targetEmployeeId");

DO $$ BEGIN
  ALTER TABLE "training_plans"
    ADD CONSTRAINT "training_plans_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "training_plans"
    ADD CONSTRAINT "training_plans_targetDepartmentId_fkey"
    FOREIGN KEY ("targetDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "training_plans"
    ADD CONSTRAINT "training_plans_targetEmployeeId_fkey"
    FOREIGN KEY ("targetEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "training_sessions" (
  "id" TEXT NOT NULL,
  "sessionCode" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "sessionName" TEXT NOT NULL,
  "trainerName" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL DEFAULT '14:00',
  "endTime" TEXT NOT NULL DEFAULT '17:00',
  "locationType" TEXT NOT NULL DEFAULT 'Online',
  "locationOrLink" TEXT NOT NULL DEFAULT 'https://meet.isysware.internal/training',
  "capacity" INTEGER NOT NULL DEFAULT 20,
  "status" TEXT NOT NULL DEFAULT 'Scheduled',
  "notes" TEXT,
  "attendanceRecords" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "attendanceRecorded" BOOLEAN NOT NULL DEFAULT false,
  "attendanceRecordedBy" TEXT,
  "attendanceRecordedAt" TIMESTAMP(3),
  "scheduledByName" TEXT,
  "completedByName" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledByName" TEXT,
  "cancelReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "training_sessions_sessionCode_key" ON "training_sessions"("sessionCode");
CREATE INDEX IF NOT EXISTS "training_sessions_programId_idx" ON "training_sessions"("programId");
CREATE INDEX IF NOT EXISTS "training_sessions_status_idx" ON "training_sessions"("status");

DO $$ BEGIN
  ALTER TABLE "training_sessions"
    ADD CONSTRAINT "training_sessions_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "training_enrollments"
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "progressPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "evaluatorFeedback" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "certificateExpiryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "skillsCertified" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "training_enrollments_verificationCode_key" ON "training_enrollments"("verificationCode");
CREATE INDEX IF NOT EXISTS "training_enrollments_sessionId_idx" ON "training_enrollments"("sessionId");

DO $$ BEGIN
  ALTER TABLE "training_enrollments"
    ADD CONSTRAINT "training_enrollments_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

