-- AlterTable
ALTER TABLE "candidates" ADD COLUMN "linkedEmployeeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "candidates_linkedEmployeeId_key" ON "candidates"("linkedEmployeeId");

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN "linkedEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "task_assignments" ADD COLUMN "comments" JSONB,
ADD COLUMN "attachments" JSONB;

-- AlterTable
ALTER TABLE "expense_claims" ADD COLUMN "disbursedById" TEXT,
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "transactionReference" TEXT;

