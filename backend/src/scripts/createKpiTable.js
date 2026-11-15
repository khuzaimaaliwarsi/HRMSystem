import prisma from '../config/database.js';

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "department_kpis" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "metricType" TEXT NOT NULL DEFAULT 'Percentage',
        "targetValue" DOUBLE PRECISION NOT NULL,hello
        "weightPercent" DOUBLE PRECISION NOT NULL,
        "reviewCycle" TEXT NOT NULL DEFAULT 'Quarterly',
        "description" TEXT,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "department_kpis_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "department_kpis_departmentId_code_key" ON "department_kpis"("departmentId", "code");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "department_kpis_departmentId_idx" ON "department_kpis"("departmentId");
  `);

  console.log('department_kpis table and indexes created successfully');
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
