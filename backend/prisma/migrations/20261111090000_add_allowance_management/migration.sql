-- CreateTable
CREATE TABLE "allowances" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "defaultAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_allowances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "allowanceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowances_code_key" ON "allowances"("code");

-- CreateIndex
CREATE INDEX "employee_allowances_employeeId_isActive_idx" ON "employee_allowances"("employeeId", "isActive");

-- CreateIndex
CREATE INDEX "employee_allowances_allowanceId_idx" ON "employee_allowances"("allowanceId");

-- CreateIndex
CREATE INDEX "employee_allowances_employeeId_effectiveFrom_idx" ON "employee_allowances"("employeeId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "employee_allowances" ADD CONSTRAINT "employee_allowances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_allowances" ADD CONSTRAINT "employee_allowances_allowanceId_fkey" FOREIGN KEY ("allowanceId") REFERENCES "allowances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

