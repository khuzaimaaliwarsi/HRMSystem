import assert from 'node:assert/strict'

/**
 * Ensures NODE_ENV=test BEFORE env.js or PrismaClient initializes.
 * Import this helper as the FIRST import in any backend integration test.
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

export function assertIsolatedTestDatabase(prisma, detailsProvider) {
  const details = typeof detailsProvider === 'function' ? detailsProvider() : null
  const dbName = details?.database || ''
  assert.notEqual(
    dbName,
    'aliyan_hrms_dev',
    'Refusing to run test mutations against development database aliyan_hrms_dev'
  )
}

/**
 * Removes all test-created records by exact CUID sets in foreign-key-safe order.
 */
export async function cleanupTestFixtures(
  prisma,
  {
    userIds = [],
    employeeIds = [],
    departmentIds = [],
    designationIds = [],
    taskIds = [],
    cycleIds = [],
    reviewIds = [],
    kpiIds = []
  } = {}
) {
  const cleanUsers = userIds.filter(Boolean)
  const cleanEmps = employeeIds.filter(Boolean)
  const cleanDepts = departmentIds.filter(Boolean)
  const cleanDesigs = designationIds.filter(Boolean)
  const cleanTasks = taskIds.filter(Boolean)
  const cleanCycles = cycleIds.filter(Boolean)
  const cleanReviews = reviewIds.filter(Boolean)
  const cleanKpis = kpiIds.filter(Boolean)

  if (cleanUsers.length > 0 || cleanEmps.length > 0 || cleanTasks.length > 0) {
    const auditOr = []
    if (cleanUsers.length > 0) auditOr.push({ actorUserId: { in: cleanUsers } })
    if (cleanTasks.length > 0) auditOr.push({ entityId: { in: cleanTasks } })
    if (cleanReviews.length > 0) auditOr.push({ entityId: { in: cleanReviews } })
    if (auditOr.length > 0) {
      await prisma.auditLog.deleteMany({ where: { OR: auditOr } }).catch(() => {})
    }
  }

  if (cleanTasks.length > 0) {
    await prisma.taskAssignment.deleteMany({ where: { id: { in: cleanTasks } } }).catch(() => {})
  }
  if (cleanEmps.length > 0) {
    await prisma.taskAssignment.deleteMany({
      where: { OR: [{ assigneeId: { in: cleanEmps } }, { assignedById: { in: cleanEmps } }] }
    }).catch(() => {})
  }
  if (cleanEmps.length > 0) {
    await prisma.employeeFeedback.deleteMany({
      where: { OR: [{ employeeId: { in: cleanEmps } }, { authorEmployeeId: { in: cleanEmps } }] }
    }).catch(() => {})
    await prisma.developmentPlan.deleteMany({
      where: { OR: [{ employeeId: { in: cleanEmps } }, { mentorId: { in: cleanEmps } }] }
    }).catch(() => {})
  }
  if (cleanReviews.length > 0) {
    await prisma.performanceReview.deleteMany({ where: { id: { in: cleanReviews } } }).catch(() => {})
  }
  if (cleanEmps.length > 0) {
    await prisma.performanceReview.deleteMany({
      where: { OR: [{ employeeId: { in: cleanEmps } }, { reviewerId: { in: cleanEmps } }] }
    }).catch(() => {})
  }
  if (cleanCycles.length > 0) {
    await prisma.performanceReview.deleteMany({ where: { cycleId: { in: cleanCycles } } }).catch(() => {})
    await prisma.performanceGoal.deleteMany({ where: { cycleId: { in: cleanCycles } } }).catch(() => {})
    await prisma.performanceCycle.deleteMany({ where: { id: { in: cleanCycles } } }).catch(() => {})
  }
  if (cleanKpis.length > 0) {
    await prisma.departmentKpi.deleteMany({ where: { id: { in: cleanKpis } } }).catch(() => {})
  }
  if (cleanDepts.length > 0) {
    await prisma.departmentKpi.deleteMany({ where: { departmentId: { in: cleanDepts } } }).catch(() => {})
  }
  if (cleanUsers.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: cleanUsers } } }).catch(() => {})
  }
  if (cleanEmps.length > 0) {
    await prisma.employee.deleteMany({ where: { id: { in: cleanEmps } } }).catch(() => {})
  }
  if (cleanDesigs.length > 0) {
    await prisma.designation.deleteMany({ where: { id: { in: cleanDesigs } } }).catch(() => {})
  }
  if (cleanDepts.length > 0) {
    await prisma.department.deleteMany({ where: { id: { in: cleanDepts } } }).catch(() => {})
  }
}

