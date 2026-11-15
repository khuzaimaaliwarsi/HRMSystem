import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { generateAccessToken } from '../src/utils/jwt.js'

describe('Travel & Transport Management — Complete PostgreSQL Persistence, Reload & RBAC QA Suite', () => {
  let dept = null
  let otherDept = null
  let desig = null
  let saUser = null
  let hrUser = null
  let mgrUser = null
  let empUser = null
  let otherEmpUser = null

  let saToken = null
  let hrToken = null
  let mgrToken = null
  let empToken = null
  let otherEmpToken = null

  let saEmp = null
  let hrEmp = null
  let mgrEmp = null
  let emp = null
  let otherEmp = null

  let createdRequest = null
  let createdPlan = null
  let createdVehicle = null
  let createdDriver = null
  let createdRoute = null
  let createdAssignment = null

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { sourceModule: 'TRAVEL', entityId: { in: ['TRV-QA-001', createdRequest?.requestCode, createdPlan?.planCode, createdVehicle?.vehicleCode, createdDriver?.driverCode, createdRoute?.routeCode, createdAssignment?.assignmentCode].filter(Boolean) } }
    }).catch(() => {})
    await prisma.transportAssignment.deleteMany({
      where: { employeeId: { in: [saEmp?.id, hrEmp?.id, mgrEmp?.id, emp?.id, otherEmp?.id].filter(Boolean) } }
    }).catch(() => {})
    await prisma.travelPlan.deleteMany({
      where: { employeeId: { in: [saEmp?.id, hrEmp?.id, mgrEmp?.id, emp?.id, otherEmp?.id].filter(Boolean) } }
    }).catch(() => {})
    await prisma.travelRequest.deleteMany({
      where: { employeeId: { in: [saEmp?.id, hrEmp?.id, mgrEmp?.id, emp?.id, otherEmp?.id].filter(Boolean) } }
    }).catch(() => {})
    if (createdRoute?.id) {
      await prisma.transportRoute.deleteMany({ where: { id: createdRoute.id } }).catch(() => {})
    }
    if (createdDriver?.id) {
      await prisma.transportDriver.deleteMany({ where: { id: createdDriver.id } }).catch(() => {})
    }
    if (createdVehicle?.id) {
      await prisma.transportVehicle.deleteMany({ where: { id: createdVehicle.id } }).catch(() => {})
    }
    await prisma.transportRoute.deleteMany({ where: { routeName: { startsWith: 'QA-Route' } } }).catch(() => {})
    await prisma.transportDriver.deleteMany({ where: { driverName: { startsWith: 'QA Driver' } } }).catch(() => {})
    await prisma.transportVehicle.deleteMany({ where: { registrationNumber: { startsWith: 'QA-REG-' } } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'qa_trv_' } }
    }).catch(() => {})
    await prisma.employee.deleteMany({
      where: { employeeCode: { startsWith: 'QA-TRV-' } }
    }).catch(() => {})
    await prisma.designation.deleteMany({ where: { code: 'QA-TRV-DES' } }).catch(() => {})
    await prisma.department.deleteMany({ where: { code: { in: ['QA-TRV-ENG', 'QA-TRV-OPS'] } } }).catch(() => {})
  }

  before(async () => {
    await cleanup()

    dept = await prisma.department.create({
      data: { code: 'QA-TRV-ENG', name: 'QA Travel Engineering' }
    })
    otherDept = await prisma.department.create({
      data: { code: 'QA-TRV-OPS', name: 'QA Travel Operations' }
    })
    desig = await prisma.designation.create({
      data: { code: 'QA-TRV-DES', title: 'QA Software Engineer', level: 'MID' }
    })

    saEmp = await prisma.employee.create({
      data: {
        employeeCode: 'QA-TRV-SA',
        firstName: 'Tariq',
        lastName: 'Admin',
        email: 'qa.trv.sa@example.com',
        joiningDate: new Date('2024-01-01'),
        departmentId: dept.id,
        designationId: desig.id
      }
    })
    hrEmp = await prisma.employee.create({
      data: {
        employeeCode: 'QA-TRV-HR',
        firstName: 'Ayesha',
        lastName: 'HR',
        email: 'qa.trv.hr@example.com',
        joiningDate: new Date('2024-01-01'),
        departmentId: otherDept.id,
        designationId: desig.id
      }
    })
    mgrEmp = await prisma.employee.create({
      data: {
        employeeCode: 'QA-TRV-MGR',
        firstName: 'Bilal',
        lastName: 'Manager',
        email: 'qa.trv.mgr@example.com',
        joiningDate: new Date('2024-01-01'),
        departmentId: dept.id,
        designationId: desig.id
      }
    })
    emp = await prisma.employee.create({
      data: {
        employeeCode: 'QA-TRV-EMP1',
        firstName: 'Zeeshan',
        lastName: 'Dev',
        email: 'qa.trv.emp1@example.com',
        joiningDate: new Date('2024-01-01'),
        departmentId: dept.id,
        designationId: desig.id
      }
    })
    otherEmp = await prisma.employee.create({
      data: {
        employeeCode: 'QA-TRV-EMP2',
        firstName: 'Usman',
        lastName: 'Ops',
        email: 'qa.trv.emp2@example.com',
        joiningDate: new Date('2024-01-01'),
        departmentId: otherDept.id,
        designationId: desig.id
      }
    })

    saUser = await prisma.user.create({
      data: { username: 'qa_trv_sa', email: 'qa.trv.sa@example.com', passwordHash: 'x', role: 'SUPER_ADMIN', employeeId: saEmp.id }
    })
    hrUser = await prisma.user.create({
      data: { username: 'qa_trv_hr', email: 'qa.trv.hr@example.com', passwordHash: 'x', role: 'HR_ADMIN', employeeId: hrEmp.id }
    })
    mgrUser = await prisma.user.create({
      data: { username: 'qa_trv_mgr', email: 'qa.trv.mgr@example.com', passwordHash: 'x', role: 'DEPT_MANAGER', employeeId: mgrEmp.id }
    })
    empUser = await prisma.user.create({
      data: { username: 'qa_trv_emp1', email: 'qa.trv.emp1@example.com', passwordHash: 'x', role: 'EMPLOYEE', employeeId: emp.id }
    })
    otherEmpUser = await prisma.user.create({
      data: { username: 'qa_trv_emp2', email: 'qa.trv.emp2@example.com', passwordHash: 'x', role: 'EMPLOYEE', employeeId: otherEmp.id }
    })

    saToken = generateAccessToken({ id: saUser.id, role: saUser.role })
    hrToken = generateAccessToken({ id: hrUser.id, role: hrUser.role })
    mgrToken = generateAccessToken({ id: mgrUser.id, role: mgrUser.role })
    empToken = generateAccessToken({ id: empUser.id, role: empUser.role })
    otherEmpToken = generateAccessToken({ id: otherEmpUser.id, role: otherEmpUser.role })
  })

  after(async () => {
    await cleanup()
  })

  it('1. Submodule 1 (Travel Requests & Approvals): creates, blocks overlap & self-approval, approves, persists across reload', async () => {
    const createRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        employeeId: emp.employeeCode, // Verify code resolution like UI
        travelPurpose: 'Client Enterprise Deployment & Security Audit',
        clientProjectRef: 'PRJ-QA-99',
        destination: 'Islamabad, Pakistan',
        departureDate: '2026-12-10',
        departureTime: '08:00 AM',
        returnDate: '2026-12-13',
        returnTime: '08:00 PM',
        travelMode: 'Commercial Airline',
        accommodationRequired: true,
        estimatedBudget: 95000,
        requestedAdvance: 40000,
        supportingNotes: 'Priority deployment'
      })
    assert.equal(createRes.status, 201)
    createdRequest = createRes.body.data
    assert.equal(createdRequest.status, 'PENDING')
    assert.equal(Number(createdRequest.estimatedBudget), 95000)

    // Overlapping trip conflict guard
    const overlapRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        travelPurpose: 'Duplicate Trip On Same Dates',
        destination: 'Lahore',
        departureDate: '2026-12-11',
        returnDate: '2026-12-12',
        estimatedBudget: 25000
      })
    assert.equal(overlapRes.status, 409)

    // Anti-self-approval if employee hits review or HR tries self
    const empReviewRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/review`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ action: 'APPROVE' })
    assert.equal(empReviewRes.status, 403)

    // Unrelated employee cannot see emp's travel request on reload GET
    const otherGetRes = await request(app)
      .get('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${otherEmpToken}`)
    assert.equal(otherGetRes.status, 200)
    assert.ok(!otherGetRes.body.data.some((r) => r.id === createdRequest.id))

    // Department manager in same dept recommends, then HR Admin approves
    const mgrRecRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/review`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ action: 'RECOMMEND', decisionRemarks: 'Recommended by line manager' })
    assert.equal(mgrRecRes.status, 200)
    assert.equal(mgrRecRes.body.data.status, 'UNDER_REVIEW')

    const hrAppRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/review`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ action: 'APPROVE', decisionRemarks: 'Approved for official travel' })
    assert.equal(hrAppRes.status, 200)
    assert.equal(hrAppRes.body.data.status, 'APPROVED')
    assert.ok(hrAppRes.body.data.attendanceF04Ref?.startsWith('DUTY-FLD-'))

    // Simulated reload GET for employee
    const reloadRes = await request(app)
      .get('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(reloadRes.status, 200)
    const found = reloadRes.body.data.find((r) => r.id === createdRequest.id)
    assert.ok(found)
    assert.equal(found.status, 'APPROVED')
    assert.equal(found.clientProjectRef, 'PRJ-QA-99')
  })

  it('2. Submodule 2 (Travel Plans & Bookings): creates PNR itinerary, persists across reload, updates status', async () => {
    // Employee cannot create travel plans
    const empPlanDeny = await request(app)
      .post('/api/v1/expenses/travel/plans')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ requestId: createdRequest.requestCode, bookingReference: 'PNR-DENIED' })
    assert.equal(empPlanDeny.status, 403)

    // HR creates travel plan
    const planRes = await request(app)
      .post('/api/v1/expenses/travel/plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        requestId: createdRequest.requestCode,
        transportationType: 'Commercial Airline',
        vendorReference: 'PIA Corporate Desk',
        bookingReference: 'PIA-QA-88412',
        hotelReference: 'Serena Islamabad #554',
        confirmedCost: 92000,
        notes: 'Window seat reserved'
      })
    assert.equal(planRes.status, 201)
    createdPlan = planRes.body.data
    assert.ok(createdPlan.planCode.startsWith('TRV-PLAN-'))
    assert.equal(createdPlan.bookingReference, 'PIA-QA-88412')

    // Premature transition blocked for future-dated plan (departure 2026-12-10)
    const prematureStartRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${createdPlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'In Progress' })
    assert.equal(prematureStartRes.status, 400)
    assert.equal(prematureStartRes.body.error.code, 'PREMATURE_START_BLOCKED')

    const skipCompleteRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${createdPlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Completed' })
    assert.equal(skipCompleteRes.status, 400)
    assert.equal(skipCompleteRes.body.error.code, 'INVALID_STATUS_TRANSITION')

    // Employee & Manager blocked from updating plan status (403)
    const empStatusDeny = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${createdPlan.planCode}/status`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ status: 'Cancelled' })
    assert.equal(empStatusDeny.status, 403)

    // Create active (departed, return in future) and elapsed (past return) approved trips to test full lifecycle
    const localYmd = (offsetDays) => {
      const dt = new Date()
      dt.setDate(dt.getDate() + offsetDays)
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    }

    const activeReq = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: otherEmp.employeeCode,
        travelPurpose: 'QA Active Trip Lifecycle Verification',
        destination: 'Karachi',
        departureDate: localYmd(-1),
        returnDate: localYmd(2),
        estimatedBudget: 30000,
        directApprove: true
      })
    assert.equal(activeReq.status, 201)

    const activePlanRes = await request(app)
      .post('/api/v1/expenses/travel/plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        requestId: activeReq.body.data.requestCode,
        bookingReference: 'PK-ACTIVE-101',
        confirmedCost: 28000
      })
    assert.equal(activePlanRes.status, 201)
    const activePlan = activePlanRes.body.data

    // Valid transition Planned -> In Progress once departure date reached
    const statusRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${activePlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'In Progress' })
    assert.equal(statusRes.status, 200)
    assert.equal(statusRes.body.data.status, 'In Progress')

    // Repeated transition In Progress -> In Progress blocked
    const repeatRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${activePlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'In Progress' })
    assert.equal(repeatRes.status, 400)

    // Premature completion In Progress -> Completed before returnDate blocked
    const prematureCompleteRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${activePlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Completed' })
    assert.equal(prematureCompleteRes.status, 400)
    assert.equal(prematureCompleteRes.body.error.code, 'PREMATURE_COMPLETION_BLOCKED')

    // Completed-date trip (departure & return <= today)
    const pastReq = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: otherEmp.employeeCode,
        travelPurpose: 'QA Past Trip Completion Verification',
        destination: 'Multan',
        departureDate: localYmd(-5),
        returnDate: localYmd(-3),
        estimatedBudget: 20000,
        directApprove: true
      })
    assert.equal(pastReq.status, 201)

    const pastPlanRes = await request(app)
      .post('/api/v1/expenses/travel/plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        requestId: pastReq.body.data.requestCode,
        bookingReference: 'PK-DONE-202',
        confirmedCost: 19000
      })
    assert.equal(pastPlanRes.status, 201)
    const pastPlan = pastPlanRes.body.data

    // Must move Planned -> In Progress before Completed
    const skipPastComplete = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${pastPlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Completed' })
    assert.equal(skipPastComplete.status, 400)

    const startPastRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${pastPlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'In Progress' })
    assert.equal(startPastRes.status, 200)

    const finishPastRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${pastPlan.planCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Completed' })
    assert.equal(finishPastRes.status, 200)
    assert.equal(finishPastRes.body.data.status, 'Completed')

    // Terminal state Completed cannot transition back to Planned or Cancelled
    const reopenRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${pastPlan.planCode}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ status: 'Planned' })
    assert.equal(reopenRes.status, 400)

    // Simulated reload GET confirms persisted states across future/active/completed plans
    const reloadPlans = await request(app)
      .get('/api/v1/expenses/travel/plans')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(reloadPlans.status, 200)
    const fetchedCreated = reloadPlans.body.data.find((p) => p.id === createdPlan.id)
    const fetchedActive = reloadPlans.body.data.find((p) => p.id === activePlan.id)
    const fetchedPast = reloadPlans.body.data.find((p) => p.id === pastPlan.id)
    assert.equal(fetchedCreated?.status, 'Planned')
    assert.equal(fetchedCreated?.bookingReference, 'PIA-QA-88412')
    assert.equal(fetchedActive?.status, 'In Progress')
    assert.equal(fetchedPast?.status, 'Completed')
  })

  it('3. Submodule 3 (Travel Advances & Expenses): disburses advance, submits employee receipts, reconciles settlement & persists', async () => {
    // Disburse advance
    const advRes = await request(app)
      .post(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/disburse-advance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        disbursedAmount: 40000,
        voucherReference: 'PCV-QA-1001',
        notes: 'Cash advance handed over'
      })
    assert.equal(advRes.status, 200)
    assert.equal(Number(advRes.body.data.disbursedAdvance), 40000)
    assert.equal(advRes.body.data.settlementStatus, 'Advance Disbursed')

    // Employee submits receipts
    const recRes = await request(app)
      .post(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/receipts`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        submittedExpenses: 55000,
        receiptReferences: ['RCP-QA-01', 'RCP-QA-02'],
        notes: 'Hotel and airfare receipts'
      })
    assert.equal(recRes.status, 200)
    assert.equal(Number(recRes.body.data.employeeSubmittedExp), 55000)

    // Other employee cannot submit receipts for this trip
    const otherRecDeny = await request(app)
      .post(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/receipts`)
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .send({ submittedExpenses: 100, receiptReferences: ['FAKE'] })
    assert.equal(otherRecDeny.status, 403)

    // HR reconciles expenses -> 53000 - 40000 = +13000 Pending Final Settlement
    const reconcileRes = await request(app)
      .post(`/api/v1/expenses/travel/requests/${createdRequest.requestCode}/reconcile`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        approvedExpenses: 53000,
        notes: 'Audited receipts, Rs. 2000 personal dinner excluded'
      })
    assert.equal(reconcileRes.status, 200)
    assert.equal(Number(reconcileRes.body.data.approvedExpenses), 53000)
    assert.equal(Number(reconcileRes.body.data.settlementBalance), 13000)
    assert.equal(reconcileRes.body.data.settlementStatus, 'Pending Final Settlement')

    // Simulated reload GET
    const reloadAdv = await request(app)
      .get('/api/v1/expenses/travel/advances')
      .set('Authorization', `Bearer ${empToken}`)
    assert.equal(reloadAdv.status, 200)
    const expRow = reloadAdv.body.data.find((e) => e.id === createdRequest.id)
    assert.ok(expRow)
    assert.equal(Number(expRow.settlementBalance), 13000)
    assert.equal(expRow.advanceDisbursedRef, 'PCV-QA-1001')
  })

  it('4. Submodule 5 (Vehicles, Drivers & Transport Routes): saves master fleet records, detects schedule conflicts, persists across reload', async () => {
    // RBAC: employee cannot create vehicles
    const empVehDeny = await request(app)
      .post('/api/v1/expenses/transport/vehicles')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ vehicleName: 'Illegal', registrationNumber: 'QA-REG-0', capacity: 10 })
    assert.equal(empVehDeny.status, 403)

    // Create Vehicle
    const vehRes = await request(app)
      .post('/api/v1/expenses/transport/vehicles')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        vehicleName: 'QA HiAce Shuttle 01',
        registrationNumber: 'QA-REG-2026',
        vehicleType: 'Van / HiAce',
        ownershipType: 'Company Owned',
        capacity: 1
      })
    assert.equal(vehRes.status, 201)
    createdVehicle = vehRes.body.data

    // Create Driver
    const drvRes = await request(app)
      .post('/api/v1/expenses/transport/drivers')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        driverName: 'QA Driver Tariq',
        contactNumber: '+92-300-5550101',
        licenseNumber: 'LTV-QA-11',
        assignedVehicleId: createdVehicle.vehicleCode
      })
    assert.equal(drvRes.status, 201)
    createdDriver = drvRes.body.data

    // Create Route (capacity 1)
    const routeRes = await request(app)
      .post('/api/v1/expenses/transport/routes')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        routeName: 'QA-Route North Express',
        pickupPoints: ['Stop A', 'Stop B'],
        dropPoint: 'iSysware HQ Tech Park',
        morningDepartureTime: '07:40 AM',
        eveningDepartureTime: '06:15 PM',
        assignedVehicleId: createdVehicle.vehicleCode,
        assignedDriverId: createdDriver.driverCode,
        capacity: 1
      })
    assert.equal(routeRes.status, 201)
    createdRoute = routeRes.body.data

    // Schedule conflict check on same vehicle & departure time
    const conflictRes = await request(app)
      .post('/api/v1/expenses/transport/routes')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        routeName: 'QA-Route Conflicting',
        pickupPoints: ['Stop X'],
        morningDepartureTime: '07:40 AM',
        assignedVehicleId: createdVehicle.vehicleCode,
        assignedDriverId: createdDriver.driverCode,
        capacity: 1
      })
    assert.equal(conflictRes.status, 409)

    // Reload GET checks
    const [vGet, dGet, rGet] = await Promise.all([
      request(app).get('/api/v1/expenses/transport/vehicles').set('Authorization', `Bearer ${empToken}`),
      request(app).get('/api/v1/expenses/transport/drivers').set('Authorization', `Bearer ${empToken}`),
      request(app).get('/api/v1/expenses/transport/routes').set('Authorization', `Bearer ${empToken}`)
    ])
    assert.ok(vGet.body.data.some((v) => v.id === createdVehicle.id))
    assert.ok(dGet.body.data.some((d) => d.id === createdDriver.id))
    assert.ok(rGet.body.data.some((r) => r.id === createdRoute.id))
  })

  it('5. Submodule 4 (Pick-and-Drop Management): employee applies (Pending Approval), HR approves (Active), enforces duplicate & capacity, persists across reload', async () => {
    // Employee applies -> Pending Approval
    const applyRes = await request(app)
      .post('/api/v1/expenses/transport/assignments')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        routeId: createdRoute.routeCode,
        pickupPoint: 'Stop A',
        facilityType: 'Company Subsidized',
        monthlyContribution: 3000
      })
    assert.equal(applyRes.status, 201)
    createdAssignment = applyRes.body.data
    assert.equal(createdAssignment.status, 'Pending Approval')

    // Employee cannot approve own pick-and-drop request
    const empAppDeny = await request(app)
      .patch(`/api/v1/expenses/transport/assignments/${createdAssignment.assignmentCode}/status`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ status: 'Active' })
    assert.equal(empAppDeny.status, 403)

    // HR approves -> Active (takes the 1/1 seat on QA-Route)
    const hrAppRes = await request(app)
      .patch(`/api/v1/expenses/transport/assignments/${createdAssignment.assignmentCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Active' })
    assert.equal(hrAppRes.status, 200)
    assert.equal(hrAppRes.body.data.status, 'Active')

    // Duplicate assignment guard for same employee
    const dupRes = await request(app)
      .post('/api/v1/expenses/transport/assignments')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ routeId: createdRoute.routeCode, pickupPoint: 'Stop B' })
    assert.equal(dupRes.status, 409)

    // Capacity guard for another employee when route is full (1/1)
    const capRes = await request(app)
      .post('/api/v1/expenses/transport/assignments')
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .send({ routeId: createdRoute.routeCode, pickupPoint: 'Stop B' })
    assert.equal(capRes.status, 400)

    // Simulated reload GET shows assignedCount === 1 and employee assignment Active
    const [asnReload, routeReload] = await Promise.all([
      request(app).get('/api/v1/expenses/transport/assignments').set('Authorization', `Bearer ${empToken}`),
      request(app).get('/api/v1/expenses/transport/routes').set('Authorization', `Bearer ${empToken}`)
    ])
    const foundAsn = asnReload.body.data.find((a) => a.id === createdAssignment.id)
    assert.equal(foundAsn?.status, 'Active')
    const foundRoute = routeReload.body.data.find((r) => r.id === createdRoute.id)
    assert.equal(foundRoute?.assignedCount, 1)
  })

  it('6. Submodule 6 (Travel & Transport History / Audit Trail): verifies PostgreSQL AuditLog persistence across all submodules', async () => {
    const auditRes = await request(app)
      .get('/api/v1/expenses/travel/audit-logs')
      .set('Authorization', `Bearer ${saToken}`)
    assert.equal(auditRes.status, 200)
    const logs = auditRes.body.data
    assert.ok(Array.isArray(logs))
    assert.ok(logs.some((l) => l.entityName === 'TravelRequest' && l.entityId === createdRequest.requestCode))
    assert.ok(logs.some((l) => l.entityName === 'TravelPlan' && l.entityId === createdPlan.planCode))
    assert.ok(logs.some((l) => l.entityName === 'TravelAdvance' && l.entityId === createdRequest.requestCode))
    assert.ok(logs.some((l) => l.entityName === 'TransportVehicle' && l.entityId === createdVehicle.vehicleCode))
    assert.ok(logs.some((l) => l.entityName === 'TransportRoute' && l.entityId === createdRoute.routeCode))
    assert.ok(logs.some((l) => l.entityName === 'TransportAssignment' && l.entityId === createdAssignment.assignmentCode))
  })

  it('7. Super Admin Executive Authority: self-approval, rejection, direct authorization & downstream Plan/Expense flow', async () => {
    const prevSaEmp = await prisma.employee.findFirst({ where: { employeeCode: 'QA-TRV-SA01' } })
    if (prevSaEmp) {
      await prisma.travelPlan.deleteMany({ where: { employeeId: prevSaEmp.id } })
      await prisma.travelRequest.deleteMany({ where: { employeeId: prevSaEmp.id } })
      await prisma.user.deleteMany({ where: { employeeId: prevSaEmp.id } })
      await prisma.employee.deleteMany({ where: { id: prevSaEmp.id } })
    }
    const saEmp = await prisma.employee.create({
      data: {
        employeeCode: 'QA-TRV-SA01',
        firstName: 'Tariq',
        lastName: 'SuperAdmin',
        email: 'qa.trv.saemp@example.com',
        joiningDate: new Date('2024-01-01'),
        department: { connect: { id: emp.departmentId } },
        designation: { connect: { id: emp.designationId } }
      }
    })
    const saSelfUser = await prisma.user.create({
      data: {
        username: 'qa_trv_sa_self',
        email: 'qa.trv.saself@example.com',
        passwordHash: 'x',
        role: 'SUPER_ADMIN',
        employeeId: saEmp.id
      }
    })
    const saSelfToken = generateAccessToken({ id: saSelfUser.id, role: saSelfUser.role })

    try {
      // 1) Super Admin creates a pending own travel request & approves it directly without Manager/HR
      const pendingRes = await request(app)
        .post('/api/v1/expenses/travel/requests')
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({
          employeeId: saEmp.employeeCode,
          travelPurpose: 'Executive Summit Attendance',
          destination: 'Dubai, UAE',
          departureDate: '2026-12-20',
          returnDate: '2026-12-22',
          estimatedBudget: 45000,
          requestedAdvance: 20000
        })
      assert.equal(pendingRes.status, 201)
      const saPending = pendingRes.body.data
      assert.equal(saPending.status, 'PENDING')

      const selfApproveRes = await request(app)
        .patch(`/api/v1/expenses/travel/requests/${saPending.requestCode}/review`)
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({ action: 'APPROVE', decisionRemarks: 'Executive direct signoff' })
      assert.equal(selfApproveRes.status, 200)
      assert.equal(selfApproveRes.body.data.status, 'APPROVED')
      assert.ok(selfApproveRes.body.data.attendanceF04Ref?.startsWith('DUTY-FLD-'))
      assert.ok(selfApproveRes.body.data.expenseCode?.startsWith('TRV-EXP-'))

      // 2) Super Admin creates & directly rejects another own pending request
      const rejectCreateRes = await request(app)
        .post('/api/v1/expenses/travel/requests')
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({
          employeeId: saEmp.employeeCode,
          travelPurpose: 'Cancelled Executive Conference',
          destination: 'Lahore',
          departureDate: '2026-12-25',
          returnDate: '2026-12-26',
          estimatedBudget: 15000
        })
      assert.equal(rejectCreateRes.status, 201)
      const saRejectRes = await request(app)
        .patch(`/api/v1/expenses/travel/requests/${rejectCreateRes.body.data.requestCode}/review`)
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({ action: 'REJECT', decisionRemarks: 'Rescheduled online' })
      assert.equal(saRejectRes.status, 200)
      assert.equal(saRejectRes.body.data.status, 'REJECTED')

      // 3) Super Admin creates a directly authorized request (directApprove: true) -> APPROVED immediately
      const directRes = await request(app)
        .post('/api/v1/expenses/travel/requests')
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({
          employeeId: saEmp.employeeCode,
          travelPurpose: 'Board Governance Visit',
          destination: 'Karachi',
          departureDate: '2026-12-28',
          returnDate: '2026-12-29',
          estimatedBudget: 60000,
          requestedAdvance: 25000,
          directApprove: true
        })
      assert.equal(directRes.status, 201)
      const directReq = directRes.body.data
      assert.equal(directReq.status, 'APPROVED')
      assert.ok(directReq.attendanceF04Ref?.startsWith('DUTY-FLD-'))
      assert.ok(directReq.expenseCode?.startsWith('TRV-EXP-'))

      // 4) Non-Super Admin (Manager) is still blocked from self-approving own request
      const mgrOwnRes = await request(app)
        .post('/api/v1/expenses/travel/requests')
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({
          employeeId: mgrEmp.employeeCode,
          travelPurpose: 'Manager Self Block Verification',
          destination: 'Multan',
          departureDate: '2027-01-08',
          returnDate: '2027-01-09',
          estimatedBudget: 12000
        })
      assert.equal(mgrOwnRes.status, 201)
      const mgrSelfDeny = await request(app)
        .patch(`/api/v1/expenses/travel/requests/${mgrOwnRes.body.data.requestCode}/review`)
        .set('Authorization', `Bearer ${mgrToken}`)
        .send({ action: 'APPROVE' })
      assert.equal(mgrSelfDeny.status, 403)
      assert.equal(mgrSelfDeny.body.error.code, 'SELF_APPROVAL_PROHIBITED')

      // 5) Approved Super Admin request flows into Plans & Bookings + Advances & Expenses (disburse, receipts, reconcile)
      const planRes = await request(app)
        .post('/api/v1/expenses/travel/plans')
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({
          requestId: directReq.requestCode,
          bookingReference: 'PK-EXEC-7701',
          confirmedCost: 58000
        })
      assert.equal(planRes.status, 201)
      assert.equal(planRes.body.data.bookingReference, 'PK-EXEC-7701')

      const advRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${directReq.requestCode}/disburse-advance`)
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({ disbursedAmount: 25000, voucherReference: 'PCV-SA-7701' })
      assert.equal(advRes.status, 200)
      assert.equal(advRes.body.data.settlementStatus, 'Advance Disbursed')

      const recRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${directReq.requestCode}/receipts`)
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({ submittedExpenses: 30000, receiptReferences: ['SA-RCP-01'] })
      assert.equal(recRes.status, 200)

      const reconcileRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${directReq.requestCode}/reconcile`)
        .set('Authorization', `Bearer ${saSelfToken}`)
        .send({ approvedExpenses: 30000, notes: 'Executive reconciliation' })
      assert.equal(reconcileRes.status, 200)
      assert.equal(Number(reconcileRes.body.data.settlementBalance), 5000)

      await prisma.travelRequest.deleteMany({ where: { id: mgrOwnRes.body.data.id } })
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorUserId: saSelfUser.id } })
      await prisma.travelPlan.deleteMany({ where: { employeeId: saEmp.id } })
      await prisma.travelRequest.deleteMany({ where: { employeeId: saEmp.id } })
      await prisma.user.deleteMany({ where: { id: saSelfUser.id } })
      await prisma.employee.deleteMany({ where: { id: saEmp.id } })
    }
  })

  it('8. Incomplete Draft Saving, Legacy Overlap Flagging & Server-Side Overlap Prevention (Create, Edit, Submit, Approve)', async () => {
    // Clean up any leftover requests from test scope for fresh deterministic dates
    const baseDep = '2027-03-10'
    const baseRet = '2027-03-12'

    // 1) Incomplete Draft WITHOUT dates, budget, destination or purpose succeeds cleanly
    const incompleteDraftRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        status: 'Draft',
        destination: 'Karachi',
        departureDate: null,
        returnDate: null,
        estimatedBudget: null
      })
    assert.equal(incompleteDraftRes.status, 201)
    assert.equal(incompleteDraftRes.body.data.status, 'DRAFT')
    assert.equal(incompleteDraftRes.body.data.departureDate, null)
    assert.equal(incompleteDraftRes.body.data.estimatedBudget, null)

    // Submitting incomplete draft without dates/budget/purpose is blocked (400)
    const badSubmitRes = await request(app)
      .post(`/api/v1/expenses/travel/requests/${incompleteDraftRes.body.data.requestCode}/submit`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({})
    assert.equal(badSubmitRes.status, 400)

    // 2) Active Submitted request occupies 2027-03-10 to 2027-03-12
    const activeRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        travelPurpose: 'Enterprise Rollout Lahore',
        destination: 'Lahore, Pakistan',
        departureDate: baseDep,
        returnDate: baseRet,
        estimatedBudget: 40000,
        status: 'Submitted'
      })
    assert.equal(activeRes.status, 201)
    const activeCode = activeRes.body.data.requestCode

    // 3) Duplicate creation with overlapping dates (even Draft with dates or Direct Authorize) -> 409
    const dupCreateRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        travelPurpose: 'Conflicting Lahore Trip',
        destination: 'Lahore',
        departureDate: '2027-03-11',
        returnDate: '2027-03-13',
        estimatedBudget: 25000,
        status: 'Submitted'
      })
    assert.equal(dupCreateRes.status, 409)
    assert.equal(dupCreateRes.body.error.code, 'OVERLAPPING_TRAVEL_REQUEST')

    const dupDirectSaRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: emp.employeeCode,
        travelPurpose: 'Conflicting SA Direct Authorize',
        destination: 'Lahore',
        departureDate: baseDep,
        returnDate: baseRet,
        estimatedBudget: 25000,
        directApprove: true
      })
    assert.equal(dupDirectSaRes.status, 409)
    assert.equal(dupDirectSaRes.body.error.code, 'OVERLAPPING_TRAVEL_REQUEST')

    // 4) Date edit on incompleteDraftRes -> overlapping dates blocked (409)
    const conflictDateEditRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${incompleteDraftRes.body.data.requestCode}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        travelPurpose: 'Completed Draft Details',
        destination: 'Islamabad, Pakistan',
        departureDate: '2027-03-10',
        returnDate: '2027-03-11',
        estimatedBudget: 30000,
        status: 'Draft'
      })
    assert.equal(conflictDateEditRes.status, 409)

    // Non-overlapping dates on Draft -> allowed, then Submit -> allowed
    const cleanEditRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${incompleteDraftRes.body.data.requestCode}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        travelPurpose: 'Islamabad Partner Sync',
        destination: 'Islamabad, Pakistan',
        departureDate: '2027-03-18',
        returnDate: '2027-03-19',
        estimatedBudget: 30000,
        status: 'Submitted'
      })
    assert.equal(cleanEditRes.status, 200)
    assert.equal(cleanEditRes.body.data.status, 'PENDING')

    // 5) Legacy overlapping Draft + Submitted pair: both preserved, Draft submission & approval blocked (409), GET flags conflict
    const legacyDraft = await prisma.travelRequest.create({
      data: {
        requestCode: 'QA-TRV-CONF-DRF',
        employeeId: emp.id,
        origin: 'iSysware HQ',
        destination: 'Karachi',
        departureDate: new Date(`${baseDep}T00:00:00.000Z`),
        returnDate: new Date(`${baseRet}T00:00:00.000Z`),
        purpose: 'Legacy Draft Overlapping Active',
        estimatedBudget: 5000,
        status: 'DRAFT',
        approvalHistory: []
      }
    })
    try {
      const listRes = await request(app)
        .get('/api/v1/expenses/travel/requests')
        .set('Authorization', `Bearer ${empToken}`)
      assert.equal(listRes.status, 200)
      const flaggedDraft = listRes.body.data.find((r) => r.requestCode === legacyDraft.requestCode)
      const flaggedActive = listRes.body.data.find((r) => r.requestCode === activeCode)
      assert.ok(flaggedDraft, 'Existing conflicting draft preserved in GET')
      assert.ok(flaggedActive, 'Existing active request preserved in GET')
      assert.equal(flaggedDraft.hasConflict, true)
      assert.ok(flaggedDraft.conflictWithCodes.includes(activeCode))
      assert.ok(flaggedActive.overlappingDraftCodes.includes(legacyDraft.requestCode))

      // Submit & Approve of overlapping legacy draft must both fail with 409
      const legacySubmitRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${legacyDraft.requestCode}/submit`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({})
      assert.equal(legacySubmitRes.status, 409)

      const legacyApproveRes = await request(app)
        .patch(`/api/v1/expenses/travel/requests/${legacyDraft.requestCode}/review`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ action: 'APPROVE' })
      assert.equal(legacyApproveRes.status, 409)
    } finally {
      await prisma.travelRequest.deleteMany({
        where: { requestCode: { in: [incompleteDraftRes.body.data.requestCode, activeCode, legacyDraft.requestCode] } }
      })
    }
  })

  it('9. Duplicate Advance, Voucher Uniqueness & Post-Settlement Financial Lock on Settled Expense Records', async () => {
    const req1Res = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: emp.employeeCode,
        travelPurpose: 'Settlement Financial Lock QA 1',
        destination: 'Karachi, Pakistan',
        departureDate: '2027-04-01',
        returnDate: '2027-04-02',
        estimatedBudget: 45000,
        requestedAdvance: 20000,
        directApprove: true
      })
    assert.equal(req1Res.status, 201)
    const code1 = req1Res.body.data.requestCode

    const req2Res = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        employeeId: emp.employeeCode,
        travelPurpose: 'Settlement Financial Lock QA 2',
        destination: 'Islamabad, Pakistan',
        departureDate: '2027-04-10',
        returnDate: '2027-04-11',
        estimatedBudget: 30000,
        requestedAdvance: 10000,
        directApprove: true
      })
    assert.equal(req2Res.status, 201)
    const code2 = req2Res.body.data.requestCode

    try {
      // 1) Concurrent double-disbursement attempt on req1 -> strictly ONE 200 and ONE 409 (zero double posting)
      const [rA, rB] = await Promise.all([
        request(app)
          .post(`/api/v1/expenses/travel/requests/${code1}/disburse-advance`)
          .set('Authorization', `Bearer ${hrToken}`)
          .send({ disbursedAmount: 20000, voucherReference: 'PCV-QA-LOCK-01', notes: 'Primary disbursement' }),
        request(app)
          .post(`/api/v1/expenses/travel/requests/${code1}/disburse-advance`)
          .set('Authorization', `Bearer ${saToken}`)
          .send({ disbursedAmount: 15000, voucherReference: 'PCV-QA-LOCK-02', notes: 'Duplicate disbursement attempt' })
      ])
      const statuses = [rA.status, rB.status].sort((a, b) => a - b)
      assert.deepEqual(statuses, [200, 409])
      const winnerVoucher = rA.status === 200 ? 'PCV-QA-LOCK-01' : 'PCV-QA-LOCK-02'
      const winnerAmount = rA.status === 200 ? 20000 : 15000

      // 2) Duplicate sequential advance on req1 -> 409 ADVANCE_ALREADY_DISBURSED
      const dupSeqRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/disburse-advance`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ disbursedAmount: 5000, voucherReference: 'PCV-QA-LOCK-99' })
      assert.equal(dupSeqRes.status, 409)
      assert.equal(dupSeqRes.body.error.code, 'ADVANCE_ALREADY_DISBURSED')

      // 3) Reusing the same voucher reference on req2 -> 409 DUPLICATE_VOUCHER_REFERENCE
      const dupVoucherRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code2}/disburse-advance`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ disbursedAmount: 10000, voucherReference: winnerVoucher })
      assert.equal(dupVoucherRes.status, 409)
      assert.equal(dupVoucherRes.body.error.code, 'DUPLICATE_VOUCHER_REFERENCE')

      // 4) Submit receipts & finalize exact settlement -> Settled (balance 0)
      const recRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/receipts`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ submittedExpenses: winnerAmount, receiptReferences: ['RCP-QA-LOCK-1'], notes: 'Receipts match advance' })
      assert.equal(recRes.status, 200)

      // Exact duplicate identical receipt claim -> 409 DUPLICATE_EXPENSE_CLAIM
      const dupRecRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/receipts`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ submittedExpenses: winnerAmount, receiptReferences: ['RCP-QA-LOCK-1'], notes: 'Duplicate submit' })
      assert.equal(dupRecRes.status, 409)
      assert.equal(dupRecRes.body.error.code, 'DUPLICATE_EXPENSE_CLAIM')

      const settleRes = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/reconcile`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ approvedExpenses: winnerAmount, notes: 'Exact settlement reached' })
      assert.equal(settleRes.status, 200)
      assert.equal(settleRes.body.data.settlementStatus, 'Settled')
      assert.equal(Number(settleRes.body.data.settlementBalance), 0)

      // 5) Once Settled: ALL three actions (Disburse Advance, Expense Claims, Reconciliation) are permanently LOCKED (409)
      const postSettledAdv = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/disburse-advance`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ disbursedAmount: 1000, voucherReference: 'PCV-AFTER-SETTLED' })
      assert.equal(postSettledAdv.status, 409)
      assert.equal(postSettledAdv.body.error.code, 'EXPENSE_ALREADY_SETTLED')

      const postSettledClaims = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/receipts`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ submittedExpenses: winnerAmount + 1000, receiptReferences: ['RCP-AFTER-SETTLED'] })
      assert.equal(postSettledClaims.status, 409)
      assert.equal(postSettledClaims.body.error.code, 'EXPENSE_ALREADY_SETTLED')

      const postSettledRecon = await request(app)
        .post(`/api/v1/expenses/travel/requests/${code1}/reconcile`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ approvedExpenses: winnerAmount + 500, notes: 'Re-reconcile attempt after settlement' })
      assert.equal(postSettledRecon.status, 409)
      assert.equal(postSettledRecon.body.error.code, 'EXPENSE_ALREADY_SETTLED')

      // 6) Verify persisted financial ledger & historical voucher untouched
      const ledgerRes = await request(app)
        .get('/api/v1/expenses/travel/advances')
        .set('Authorization', `Bearer ${saToken}`)
      const saved = ledgerRes.body.data.find((r) => r.requestCode === code1)
      assert.equal(Number(saved.disbursedAdvance), winnerAmount)
      assert.equal(saved.advanceDisbursedRef, winnerVoucher)
      assert.equal(saved.settlementStatus, 'Settled')
      assert.equal(Number(saved.settlementBalance), 0)
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [code1, code2] } } })
      await prisma.travelRequest.deleteMany({ where: { requestCode: { in: [code1, code2] } } })
    }
  })

  it('10. Full Edit Support (Travel Requests Draft/Submitted/Approved Corrections, Travel Plans, Transport Routes, Pick-and-Drop Assignments) & Settled Record Protection', async () => {
    const depDate = '2027-06-15'
    const retDate = '2027-06-17'

    // 1) Employee creates Draft -> edits Draft -> submits -> edits own Submitted request
    const draftRes = await request(app)
      .post('/api/v1/expenses/travel/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ status: 'Draft', destination: 'Multan', travelPurpose: 'Initial draft trip' })
    assert.equal(draftRes.status, 201)
    const reqCode = draftRes.body.data.requestCode

    const editSubmittedRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        travelPurpose: 'Multan Infrastructure Assessment',
        destination: 'Multan, Pakistan',
        departureDate: depDate,
        returnDate: retDate,
        estimatedBudget: 35000,
        requestedAdvance: 10000,
        status: 'Submitted'
      })
    assert.equal(editSubmittedRes.status, 200)
    assert.equal(editSubmittedRes.body.data.status, 'PENDING')

    const ownerEditPending = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ travelPurpose: 'Multan Data Center Upgrade', estimatedBudget: 38000 })
    assert.equal(ownerEditPending.status, 200)
    assert.equal(ownerEditPending.body.data.purpose, 'Multan Data Center Upgrade')

    // Other employee cannot edit another employee's request
    const forbiddenEdit = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .send({ travelPurpose: 'Hijack attempt' })
    assert.equal(forbiddenEdit.status, 403)

    // 2) Super Admin approves directly -> authorized correction on Approved request (non-settled)
    const approveRes = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}/review`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ action: 'APPROVE', decisionRemarks: 'Original SA approval' })
    assert.equal(approveRes.status, 200)
    const originalApproverName = approveRes.body.data.finalApproverName
    const originalApprovedAt = approveRes.body.data.finalApprovedAt

    // HR Admin cannot edit already Approved request without Super Admin authorization
    const hrEditApprovedDeny = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ destination: 'Quetta' })
    assert.equal(hrEditApprovedDeny.status, 400)

    // Super Admin applies authorized correction before advance disbursement -> original approval attribution preserved
    const saEditApproved = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        destination: 'Bahawalpur, Pakistan',
        supportingNotes: 'Venue updated by client coordinator',
        correctionReason: 'Client shifted site to Bahawalpur'
      })
    assert.equal(saEditApproved.status, 200)
    assert.equal(saEditApproved.body.data.destination, 'Bahawalpur, Pakistan')
    assert.equal(saEditApproved.body.data.finalApproverName, originalApproverName)
    assert.equal(saEditApproved.body.data.finalApprovedAt, originalApprovedAt)
    assert.ok(saEditApproved.body.data.approvalHistory.some((h) => h.action === 'Authorized Correction'))

    // 3) Create Travel Plan -> edit Travel Plan -> verify PNR synced + AuditLog recorded
    const planRes = await request(app)
      .post('/api/v1/expenses/travel/plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        requestId: reqCode,
        bookingReference: 'PNR-EDIT-100',
        hotelReference: 'Serena Hotel',
        confirmedCost: 36000
      })
    assert.equal(planRes.status, 201)
    const planCode = planRes.body.data.planCode

    const editPlanRes = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${planCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        bookingReference: 'PNR-EDIT-200',
        hotelReference: 'Pearl Continental',
        confirmedCost: 39000,
        notes: 'Upgraded airline flex fare'
      })
    assert.equal(editPlanRes.status, 200)
    assert.equal(editPlanRes.body.data.bookingReference, 'PNR-EDIT-200')
    assert.equal(Number(editPlanRes.body.data.confirmedCost), 39000)

    // Employee forbidden from editing Travel Plan
    const empEditPlanDeny = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${planCode}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ bookingReference: 'PNR-HACK' })
    assert.equal(empEditPlanDeny.status, 403)

    // 4) Financial snapshot lock after advance disbursement, and full lock after Settlement
    const advRes = await request(app)
      .post(`/api/v1/expenses/travel/requests/${reqCode}/disburse-advance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ disbursedAmount: 10000, voucherReference: 'PCV-EDIT-LOCK-01' })
    assert.equal(advRes.status, 200)

    // After advance disbursement, even Super Admin cannot alter approved budget/advance
    const lockedBudgetEdit = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ estimatedBudget: 99000 })
    assert.equal(lockedBudgetEdit.status, 409)
    assert.equal(lockedBudgetEdit.body.error.code, 'FINANCIAL_SNAPSHOT_LOCKED')

    // Reconcile to Settled (10000 approved vs 10000 disbursed = balance 0)
    await request(app)
      .post(`/api/v1/expenses/travel/requests/${reqCode}/receipts`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ submittedExpenses: 10000, receiptReferences: ['RCP-EDIT-1'] })
    const settleRes = await request(app)
      .post(`/api/v1/expenses/travel/requests/${reqCode}/reconcile`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ approvedExpenses: 10000, notes: 'Exact settlement' })
    assert.equal(settleRes.status, 200)
    assert.equal(settleRes.body.data.settlementStatus, 'Settled')

    // Once Settled, Travel Request edit and Plan confirmedCost alteration are both blocked (409 EXPENSE_ALREADY_SETTLED)
    const postSettleReqEdit = await request(app)
      .patch(`/api/v1/expenses/travel/requests/${reqCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ destination: 'Rewrite Settled' })
    assert.equal(postSettleReqEdit.status, 409)
    assert.equal(postSettleReqEdit.body.error.code, 'EXPENSE_ALREADY_SETTLED')

    const postSettlePlanCostEdit = await request(app)
      .patch(`/api/v1/expenses/travel/plans/${planCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ bookingReference: 'PNR-EDIT-200', confirmedCost: 42000 })
    assert.equal(postSettlePlanCostEdit.status, 409)
    assert.equal(postSettlePlanCostEdit.body.error.code, 'EXPENSE_ALREADY_SETTLED')

    // 5) Transport Route + Pick-and-Drop Assignment Edit (employee Pending + HR/Super Active) & route capacity guard
    const vehRes = await request(app)
      .post('/api/v1/expenses/transport/vehicles')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ vehicleName: 'QA-Edit Van', registrationNumber: 'QA-REG-EDIT1', vehicleType: 'Van', capacity: 12 })
    assert.equal(vehRes.status, 201)
    const vehId = vehRes.body.data.vehicleCode

    const routeRes = await request(app)
      .post('/api/v1/expenses/transport/routes')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        routeName: 'QA-Route Edit Corridor',
        pickupPoints: ['Stop A', 'Stop B'],
        assignedVehicleId: vehId,
        morningDepartureTime: '07:40 AM',
        eveningDepartureTime: '06:10 PM',
        capacity: 10
      })
    assert.equal(routeRes.status, 201)
    const routeCode = routeRes.body.data.routeCode

    const editRouteRes = await request(app)
      .post('/api/v1/expenses/transport/routes')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        routeId: routeCode,
        routeName: 'QA-Route Edit Corridor v2',
        pickupPoints: ['Stop A', 'Stop B', 'Stop C'],
        assignedVehicleId: vehId,
        morningDepartureTime: '07:40 AM',
        capacity: 8
      })
    assert.equal(editRouteRes.status, 200)
    assert.equal(editRouteRes.body.data.routeName, 'QA-Route Edit Corridor v2')
    assert.equal(editRouteRes.body.data.capacity, 8)

    const asnCreateRes = await request(app)
      .post('/api/v1/expenses/transport/assignments')
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .send({ routeId: routeCode, pickupPoint: 'Stop A', facilityType: 'Company Subsidized', monthlyContribution: 3000 })
    assert.equal(asnCreateRes.status, 201)
    const asnCode = asnCreateRes.body.data.assignmentCode
    assert.equal(asnCreateRes.body.data.status, 'Pending Approval')

    // Employee edits own Pending Approval pickup stop
    const ownerEditAsn = await request(app)
      .patch(`/api/v1/expenses/transport/assignments/${asnCode}`)
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .send({ pickupPoint: 'Stop B' })
    assert.equal(ownerEditAsn.status, 200)
    assert.equal(ownerEditAsn.body.data.pickupPoint, 'Stop B')

    // HR approves -> Active -> employee blocked from self-editing Active; HR/Super Admin CAN edit
    await request(app)
      .patch(`/api/v1/expenses/transport/assignments/${asnCode}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Active' })

    const empEditActiveDeny = await request(app)
      .patch(`/api/v1/expenses/transport/assignments/${asnCode}`)
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .send({ pickupPoint: 'Stop C' })
    assert.equal(empEditActiveDeny.status, 403)

    const saEditActiveAsn = await request(app)
      .patch(`/api/v1/expenses/transport/assignments/${asnCode}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ pickupPoint: 'Stop C', monthlyContribution: 2500 })
    assert.equal(saEditActiveAsn.status, 200)
    assert.equal(saEditActiveAsn.body.data.pickupPoint, 'Stop C')
    assert.equal(Number(saEditActiveAsn.body.data.monthlyContribution), 2500)

    try {
      const audits = await prisma.auditLog.findMany({
        where: { sourceModule: 'TRAVEL', entityId: { in: [reqCode, planCode, routeCode, asnCode] }, actionType: 'UPDATE' }
      })
      assert.ok(audits.length >= 4, 'AuditLog UPDATE entries must exist for edited Request, Plan, Route, Assignment')
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [reqCode, planCode, routeCode, vehId, asnCode] } } })
      await prisma.transportAssignment.deleteMany({ where: { assignmentCode: asnCode } })
      await prisma.transportRoute.deleteMany({ where: { routeCode } })
      await prisma.transportVehicle.deleteMany({ where: { vehicleCode: vehId } })
      await prisma.travelPlan.deleteMany({ where: { planCode } })
      await prisma.travelRequest.deleteMany({ where: { requestCode: reqCode } })
    }
  })
})
