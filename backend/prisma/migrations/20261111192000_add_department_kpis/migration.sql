-- CreateTable
CREATE TABLE IF NOT EXISTS "department_kpis" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "metricType" TEXT NOT NULL DEFAULT 'Percentage',
    "targetValue" DOUBLE PRECISION NOT NULL,
    "weightPercent" DOUBLE PRECISION NOT NULL,
    "reviewCycle" TEXT NOT NULL DEFAULT 'Quarterly',
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "department_kpis_departmentId_code_key" ON "department_kpis"("departmentId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "department_kpis_departmentId_idx" ON "department_kpis"("departmentId");

