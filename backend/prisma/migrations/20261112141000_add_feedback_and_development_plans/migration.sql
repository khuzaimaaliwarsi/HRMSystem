-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_feedbacks" (
    "id" TEXT NOT NULL,
    "feedbackCode" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "authorEmployeeId" TEXT,
    "authorUserId" TEXT,
    "authorName" TEXT,
    "authorRole" TEXT,
    "feedbackType" TEXT NOT NULL DEFAULT 'CONSTRUCTIVE',
    "title" TEXT NOT NULL,
    "strengths" TEXT,
    "improvementAreas" TEXT,
    "managerComments" TEXT,
    "employeeResponse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SHARED',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_feedbacks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_feedbacks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employee_feedbacks_authorEmployeeId_fkey" FOREIGN KEY ("authorEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employee_feedbacks_feedbackCode_key" ON "employee_feedbacks"("feedbackCode");
CREATE INDEX IF NOT EXISTS "employee_feedbacks_employeeId_status_idx" ON "employee_feedbacks"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "employee_feedbacks_authorEmployeeId_idx" ON "employee_feedbacks"("authorEmployeeId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "development_plans" (
    "id" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "planCategory" TEXT NOT NULL DEFAULT 'IDP',
    "employeeId" TEXT NOT NULL,
    "mentorId" TEXT,
    "createdByEmployeeId" TEXT,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdByRole" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goalsSummary" TEXT,
    "recommendedTraining" TEXT,
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "checkpoints" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "documentedConcerns" TEXT,
    "improvementTargets" JSONB,
    "reviewFrequency" TEXT,
    "reviewSchedule" JSONB,
    "managerEvaluations" JSONB,
    "employeeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "employeeStatement" TEXT,
    "closureOutcome" TEXT,
    "closureNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closedByEmployeeCode" TEXT,
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "development_plans_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "development_plans_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "development_plans_planCode_key" ON "development_plans"("planCode");
CREATE INDEX IF NOT EXISTS "development_plans_employeeId_planCategory_status_idx" ON "development_plans"("employeeId", "planCategory", "status");
CREATE INDEX IF NOT EXISTS "development_plans_mentorId_idx" ON "development_plans"("mentorId");

