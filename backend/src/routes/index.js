/**
 * iSysware HRMS — Master API v1 Router
 * Modular router aggregating all v1 domain endpoints.
 */

import { Router } from 'express'
import healthRoutes from './healthRoutes.js'
import authRoutes from './authRoutes.js'
import organizationRoutes from './organizationRoutes.js'
import employeeRoutes from './employeeRoutes.js'
import shiftRoutes from './shiftRoutes.js'
import attendanceRoutes from './attendanceRoutes.js'
import leaveRoutes from './leaveRoutes.js'
import payrollRoutes from './payrollRoutes.js'
import recruitmentRoutes from './recruitmentRoutes.js'
import taskRoutes from './taskRoutes.js'
import performanceRoutes from './performanceRoutes.js'
import trainingRoutes from './trainingRoutes.js'
import helpDeskRoutes from './helpDeskRoutes.js'
import travelExpenseRoutes from './travelExpenseRoutes.js'
import reportRoutes from './reportRoutes.js'
import adminSettingsRoutes from './adminSettingsRoutes.js'
import hrLettersRoutes from './hrLettersRoutes.js'

const apiRouter = Router()

// Health and System Diagnostics
apiRouter.use('/health', healthRoutes)

// Authentication & Session Management (Batch 3)
apiRouter.use('/auth', authRoutes)

// Organization & Employee Management (Batch 4)
apiRouter.use('/organization', organizationRoutes)
apiRouter.use('/employees', employeeRoutes)

// Attendance, Shifts & Leave Management (Batch 5)
apiRouter.use('/shifts', shiftRoutes)
apiRouter.use('/attendance', attendanceRoutes)
apiRouter.use('/leaves', leaveRoutes)

// Payroll, Compensation & Payslips (Batch 6A & 6B)
apiRouter.use('/payroll', payrollRoutes)

// Recruitment, Tasks, Performance, Training, Expenses, Reports & Admin (Batch 6C)
apiRouter.use('/recruitment', recruitmentRoutes)
apiRouter.use('/tasks', taskRoutes)
apiRouter.use('/performance', performanceRoutes)
apiRouter.use('/training', trainingRoutes)
apiRouter.use('/helpdesk', helpDeskRoutes)
apiRouter.use('/expenses', travelExpenseRoutes)
apiRouter.use('/reports', reportRoutes)
apiRouter.use('/admin', adminSettingsRoutes)
apiRouter.use('/letters', hrLettersRoutes)

export default apiRouter
