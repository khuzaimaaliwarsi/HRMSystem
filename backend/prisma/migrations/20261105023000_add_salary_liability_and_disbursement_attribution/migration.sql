-- CreateEnum
CREATE TYPE "LiabilityStatus" AS ENUM ('OUTSTANDING', 'PARTIALLY_RECOVERED', 'RECOVERED', 'WRITTEN_OFF');

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN "disbursedById" TEXT,
ADD COLUMN "disbursedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payroll_entries" ADD COLUMN "unrecoveredLiability" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "salary_liabilities" (
    "id" TEXT NOT NULL,
    "liabilityNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "payrollEntryId" TEXT,
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "outstandingBalance" DECIMAL(12,2) NOT NULL,
    "recoveredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" "LiabilityStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_liabilities_liabilityNumber_key" ON "salary_liabilities"("liabilityNumber");

-- CreateIndex
CREATE INDEX "salary_liabilities_employeeId_status_idx" ON "salary_liabilities"("employeeId", "status");

-- CreateIndex
CREATE INDEX "salary_liabilities_payrollPeriodId_idx" ON "salary_liabilities"("payrollPeriodId");

-- AddForeignKey
ALTER TABLE "salary_liabilities" ADD CONSTRAINT "salary_liabilities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_liabilities" ADD CONSTRAINT "salary_liabilities_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_liabilities" ADD CONSTRAINT "salary_liabilities_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "payroll_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

