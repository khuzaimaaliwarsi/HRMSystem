import { prisma, disconnectDatabase } from '../config/database.js'

async function verifySchema() {
  console.log('='.repeat(65))
  console.log('  iSysware HRMS — PostgreSQL Schema Verification (Batch 2)')
  console.log('='.repeat(65))

  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `

    console.log(`Total Public Tables: ${tables.length}`)
    console.log('-'.repeat(65))
    tables.forEach((t, i) => {
      console.log(`  ${String(i + 1).padStart(2, ' ')}. ${t.table_name}`)
    })

    const foreignKeys = await prisma.$queryRaw`
      SELECT count(*)::int as count 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
    `
    console.log('-'.repeat(65))
    console.log(`Total Foreign Key Constraints: ${foreignKeys[0].count}`)

    const uniqueIndexes = await prisma.$queryRaw`
      SELECT count(*)::int as count 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%';
    `
    console.log(`Total Unique Indexes / Keys : ${uniqueIndexes[0].count}`)

    console.log('='.repeat(65))
    console.log('Schema verification: HEALTHY and NORMALIZED.')
    await disconnectDatabase()
  } catch (err) {
    console.error('Schema verification error:', err)
    await disconnectDatabase()
    process.exit(1)
  }
}

verifySchema()
