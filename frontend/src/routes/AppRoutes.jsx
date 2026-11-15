import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import { PORTAL_CONFIG } from '@/config/navigation'
import ProtectedRoute from './ProtectedRoute'
import RoleGuard from './RoleGuard'
import PortalShell from '@/layouts/PortalShell'
import LoginPage from '@/pages/auth/LoginPage'

// Batch F01 Dashboards
import SuperAdminDashboard from '@/pages/dashboard/SuperAdminDashboard'
import HrAdminDashboard from '@/pages/dashboard/HrAdminDashboard'
import ManagerDashboard from '@/pages/dashboard/ManagerDashboard'
import EmployeeDashboard from '@/pages/dashboard/EmployeeDashboard'

// Batch F02 Employee Management
import SuperAdminEmployeePage from '@/pages/employee/SuperAdminEmployeePage'
import HrAdminEmployeePage from '@/pages/employee/HrAdminEmployeePage'
import ManagerTeamPage from '@/pages/employee/ManagerTeamPage'
import EmployeeProfilePage from '@/pages/employee/EmployeeProfilePage'
import MyProfilePage from '@/pages/profile/MyProfilePage'

// Batch F03 Recruitment & Onboarding
import SuperAdminRecruitmentPage from '@/pages/recruitment/SuperAdminRecruitmentPage'
import HrAdminRecruitmentPage from '@/pages/recruitment/HrAdminRecruitmentPage'
import ManagerRecruitmentPage from '@/pages/recruitment/ManagerRecruitmentPage'
import EmployeeOnboardingPage from '@/pages/recruitment/EmployeeOnboardingPage'

// Batch F04 Attendance & Shifts Management
import SuperAdminAttendancePage from '@/pages/attendance/SuperAdminAttendancePage'
import HrAdminAttendancePage from '@/pages/attendance/HrAdminAttendancePage'
import ManagerAttendancePage from '@/pages/attendance/ManagerAttendancePage'
import ManagerMyAttendancePage from '@/pages/attendance/ManagerMyAttendancePage'
import EmployeeAttendancePage from '@/pages/attendance/EmployeeAttendancePage'

// Batch F05 Leave Management
import SuperAdminLeavePage from '@/pages/leaves/SuperAdminLeavePage'
import HrAdminLeavePage from '@/pages/leaves/HrAdminLeavePage'
import ManagerLeavePage from '@/pages/leaves/ManagerLeavePage'
import EmployeeLeavePage from '@/pages/leaves/EmployeeLeavePage'

// Batch F06 Payroll, Compensation & Benefits
import SuperAdminPayrollPage from '@/pages/payroll/SuperAdminPayrollPage'
import HrAdminPayrollPage from '@/pages/payroll/HrAdminPayrollPage'
import ManagerMyPayrollPage from '@/pages/payroll/ManagerMyPayrollPage'
import EmployeePayrollPage from '@/pages/payroll/EmployeePayrollPage'

// Batch F07 Tasks & Performance Management
import SuperAdminPerformancePage from '@/pages/performance/SuperAdminPerformancePage'
import HrAdminPerformancePage from '@/pages/performance/HrAdminPerformancePage'
import ManagerPerformancePage from '@/pages/performance/ManagerPerformancePage'
import EmployeePerformancePage from '@/pages/performance/EmployeePerformancePage'

// Batch F08 Training & Development
import SuperAdminTrainingPage from '@/pages/training/SuperAdminTrainingPage'
import HrAdminTrainingPage from '@/pages/training/HrAdminTrainingPage'
import ManagerTrainingPage from '@/pages/training/ManagerTrainingPage'
import EmployeeTrainingPage from '@/pages/training/EmployeeTrainingPage'

// Batch F09 Help Desk Management
import SuperAdminHelpDeskPage from '@/pages/helpdesk/SuperAdminHelpDeskPage'
import HrAdminHelpDeskPage from '@/pages/helpdesk/HrAdminHelpDeskPage'
import ManagerHelpDeskPage from '@/pages/helpdesk/ManagerHelpDeskPage'
import EmployeeHelpDeskPage from '@/pages/helpdesk/EmployeeHelpDeskPage'

// Batch F10 Travel & Pick-and-Drop Management
import SuperAdminTravelPage from '@/pages/travel/SuperAdminTravelPage'
import HrAdminTravelPage from '@/pages/travel/HrAdminTravelPage'
import ManagerTravelPage from '@/pages/travel/ManagerTravelPage'
import EmployeeTravelPage from '@/pages/travel/EmployeeTravelPage'

// Batch F11 Corporate HR Letters Management
import SuperAdminLettersPage from '@/pages/letters/SuperAdminLettersPage'
import HrAdminLettersPage from '@/pages/letters/HrAdminLettersPage'
import ManagerLettersPage from '@/pages/letters/ManagerLettersPage'
import EmployeeLettersPage from '@/pages/letters/EmployeeLettersPage'

// Batch F12 Expense Management
import SuperAdminExpensesPage from '@/pages/expenses/SuperAdminExpensesPage'
import HrAdminExpensesPage from '@/pages/expenses/HrAdminExpensesPage'
import ManagerExpensesPage from '@/pages/expenses/ManagerExpensesPage'
import EmployeeExpensesPage from '@/pages/expenses/EmployeeExpensesPage'

// Batch F13 Administration, Settings, Policy Engine & Alerts
import SuperAdminSettingsPage from '@/pages/settings/SuperAdminSettingsPage'
import HrAdminSettingsPage from '@/pages/settings/HrAdminSettingsPage'
import ManagerSettingsPage from '@/pages/settings/ManagerSettingsPage'
import EmployeeSettingsPage from '@/pages/settings/EmployeeSettingsPage'

// Batch F14 Complete Reports & Analytics (75 Reports across 12 Families)
import SuperAdminReportsPage from '@/pages/reports/SuperAdminReportsPage'
import HrAdminReportsPage from '@/pages/reports/HrAdminReportsPage'
import ManagerReportsPage from '@/pages/reports/ManagerReportsPage'
import EmployeeReportsPage from '@/pages/reports/EmployeeReportsPage'

function ProfileRedirect() {
  const { user } = useAuth()
  const role = String(user?.role || user?.backendRole || 'super_admin').toLowerCase().replace('-', '_')
  const basePath = PORTAL_CONFIG[role]?.basePath || '/super-admin'
  return <Navigate to={`${basePath}/profile`} replace />
}

export function AppRoutes() {

  const { user, isAuthenticated } = useAuth()

  // Default redirect to active user portal or /login
  const getDefaultHome = () => {
    if (!isAuthenticated || !user?.role) return '/login'
    return PORTAL_CONFIG[user.role]?.defaultRoute || '/login'
  }

  return (
    <Routes>
      {/* Public Auth Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={getDefaultHome()} replace />} />

      {/* Global Profile Shortcuts to prevent 404 across any role */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-profile"
        element={
          <ProtectedRoute>
            <ProfileRedirect />
          </ProtectedRoute>
        }
      />

      {/* PORTAL 1 — SUPER ADMIN */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['super_admin']}>
              <PortalShell />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
        {/* F01 Implemented Dashboard */}
        <Route path="dashboard" element={<SuperAdminDashboard />} />

        {/* F02 Implemented Employee Management */}
        <Route path="employees" element={<SuperAdminEmployeePage />} />
        {/* F03 Implemented Recruitment & Onboarding */}
        <Route path="recruitment" element={<SuperAdminRecruitmentPage />} />
        {/* F04 Implemented Attendance & Shifts Governance */}
        <Route path="attendance" element={<SuperAdminAttendancePage />} />
        {/* F05 Implemented Leave Policy & Approvals */}
        <Route path="leaves" element={<SuperAdminLeavePage />} />
        <Route path="payroll" element={<SuperAdminPayrollPage />} />
        <Route path="performance" element={<SuperAdminPerformancePage />} />
        <Route path="tasks" element={<SuperAdminPerformancePage />} />
        <Route path="training" element={<SuperAdminTrainingPage />} />
        <Route path="helpdesk" element={<SuperAdminHelpDeskPage />} />
        <Route path="travel" element={<SuperAdminTravelPage />} />
        <Route path="letters" element={<SuperAdminLettersPage />} />
        <Route path="expenses" element={<SuperAdminExpensesPage />} />
        <Route path="settings" element={<SuperAdminSettingsPage />} />
        <Route path="alerts" element={<SuperAdminSettingsPage defaultTab="alerts" />} />
        <Route path="reports" element={<SuperAdminReportsPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Route>

      {/* PORTAL 2 — HR / ADMIN */}
      <Route
        path="/hr-admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['hr_admin', 'super_admin']}>
              <PortalShell />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/hr-admin/dashboard" replace />} />
        {/* F01 Implemented Dashboard */}
        <Route path="dashboard" element={<HrAdminDashboard />} />

        {/* F02 Implemented Employee Administration */}
        <Route path="employees" element={<HrAdminEmployeePage />} />
        {/* F03 Implemented Recruitment Operations */}
        <Route path="recruitment" element={<HrAdminRecruitmentPage />} />
        {/* F04 Implemented Attendance & Corrections */}
        <Route path="attendance" element={<HrAdminAttendancePage />} />
        {/* F05 Implemented Leave Operations */}
        <Route path="leaves" element={<HrAdminLeavePage />} />
        <Route path="payroll" element={<HrAdminPayrollPage />} />
        <Route path="performance" element={<HrAdminPerformancePage />} />
        <Route path="tasks" element={<HrAdminPerformancePage />} />
        <Route path="training" element={<HrAdminTrainingPage />} />
        <Route path="helpdesk" element={<HrAdminHelpDeskPage />} />
        <Route path="travel" element={<HrAdminTravelPage />} />
        <Route path="letters" element={<HrAdminLettersPage />} />
        <Route path="expenses" element={<HrAdminExpensesPage />} />
        <Route path="settings" element={<HrAdminSettingsPage />} />
        <Route path="alerts" element={<HrAdminSettingsPage defaultTab="alerts" />} />
        <Route path="reports" element={<HrAdminReportsPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Route>

      {/* PORTAL 3 — MANAGER */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['manager', 'super_admin']}>
              <PortalShell />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/manager/dashboard" replace />} />
        {/* F01 Implemented Dashboard */}
        <Route path="dashboard" element={<ManagerDashboard />} />

        {/* F02 Implemented My Team & Manager Profile */}
        <Route path="team" element={<ManagerTeamPage />} />
        {/* F03 Implemented Team Hiring & Interviews */}
        <Route path="recruitment" element={<ManagerRecruitmentPage />} />
        {/* F04 Implemented Team Attendance & Client Field Visits */}
        <Route path="attendance" element={<ManagerAttendancePage />} />
        {/* F05 Implemented Team Leave Approvals */}
        <Route path="leaves" element={<ManagerLeavePage />} />
        <Route path="field-duty" element={<ManagerAttendancePage defaultTab="teamWfh" />} />
        <Route path="tasks" element={<ManagerPerformancePage />} />
        <Route path="performance" element={<ManagerPerformancePage />} />
        <Route path="training" element={<ManagerTrainingPage />} />
        <Route path="helpdesk" element={<ManagerHelpDeskPage />} />
        <Route path="travel" element={<ManagerTravelPage />} />
        <Route path="travel-expenses" element={<ManagerTravelPage />} />
        <Route path="letters" element={<ManagerLettersPage />} />
        <Route path="expenses" element={<ManagerExpensesPage />} />
        <Route path="settings" element={<ManagerSettingsPage />} />
        <Route path="alerts" element={<ManagerSettingsPage defaultTab="notifications" />} />
        <Route path="reports" element={<ManagerReportsPage />} />
        <Route path="my-attendance" element={<ManagerMyAttendancePage />} />
        <Route path="my-payroll" element={<ManagerMyPayrollPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Route>

      {/* PORTAL 4 — EMPLOYEE */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['employee', 'team_lead', 'manager', 'hr_admin', 'super_admin']}>
              <PortalShell />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/employee/dashboard" replace />} />
        {/* F01 Implemented Dashboard */}
        <Route path="dashboard" element={<EmployeeDashboard />} />

        {/* F02 Implemented My Profile */}
        <Route path="profile" element={<MyProfilePage />} />
        {/* F03 Implemented Personal Onboarding & Probation */}
        <Route path="onboarding" element={<EmployeeOnboardingPage />} />
        {/* F04 Implemented My Attendance & Punches */}
        <Route path="attendance" element={<EmployeeAttendancePage />} />
        {/* F05 Implemented My Leaves & Holidays */}
        <Route path="leaves" element={<EmployeeLeavePage />} />
        <Route path="tasks" element={<EmployeePerformancePage />} />
        <Route path="payroll" element={<EmployeePayrollPage />} />
        <Route path="benefits" element={<EmployeePayrollPage />} />
        <Route path="performance" element={<EmployeePerformancePage />} />
        <Route path="training" element={<EmployeeTrainingPage />} />
        <Route path="helpdesk" element={<EmployeeHelpDeskPage />} />
        <Route path="travel" element={<EmployeeTravelPage />} />
        <Route path="travel-expenses" element={<EmployeeTravelPage />} />
        <Route path="letters" element={<EmployeeLettersPage />} />
        <Route path="expenses" element={<EmployeeExpensesPage />} />
        <Route path="reports" element={<EmployeeReportsPage />} />
        <Route path="notifications" element={<EmployeeSettingsPage defaultTab="notifications" />} />
        <Route path="settings" element={<EmployeeSettingsPage defaultTab="entitlements" />} />
      </Route>

      {/* PORTAL 5 — TEAM LEAD */}
      <Route
        path="/team-lead"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['team_lead', 'manager', 'super_admin']}>
              <PortalShell />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/team-lead/dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard isTeamLead={true} />} />
        <Route path="team" element={<ManagerTeamPage isTeamLead={true} />} />
        <Route path="recruitment" element={<ManagerRecruitmentPage isTeamLead={true} />} />
        <Route path="attendance" element={<ManagerAttendancePage isTeamLead={true} />} />
        <Route path="leaves" element={<ManagerLeavePage isTeamLead={true} />} />
        <Route path="field-duty" element={<ManagerAttendancePage defaultTab="teamWfh" isTeamLead={true} />} />
        <Route path="tasks" element={<ManagerPerformancePage isTeamLead={true} />} />
        <Route path="performance" element={<ManagerPerformancePage isTeamLead={true} />} />
        <Route path="training" element={<ManagerTrainingPage isTeamLead={true} />} />
        <Route path="helpdesk" element={<ManagerHelpDeskPage isTeamLead={true} />} />
        <Route path="travel" element={<ManagerTravelPage isTeamLead={true} />} />
        <Route path="travel-expenses" element={<ManagerTravelPage isTeamLead={true} />} />
        <Route path="letters" element={<ManagerLettersPage isTeamLead={true} />} />
        <Route path="expenses" element={<ManagerExpensesPage isTeamLead={true} />} />
        <Route path="settings" element={<ManagerSettingsPage isTeamLead={true} />} />
        <Route path="alerts" element={<ManagerSettingsPage defaultTab="notifications" isTeamLead={true} />} />
        <Route path="reports" element={<ManagerReportsPage isTeamLead={true} />} />
        <Route path="my-attendance" element={<ManagerMyAttendancePage />} />
        <Route path="my-payroll" element={<ManagerMyPayrollPage />} />
        <Route path="payroll" element={<ManagerMyPayrollPage />} />
        <Route path="onboarding" element={<EmployeeOnboardingPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Route>

      {/* Fallback 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen bg-hrms-canvas flex flex-col items-center justify-center p-6 text-center">
            <h2 className="text-3xl font-extrabold text-hrms-primary mb-2">404 — Page Not Found</h2>
            <p className="text-sm text-hrms-muted mb-6">The requested path does not exist in iSysware HRMS.</p>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-md bg-hrms-primary text-white text-sm font-semibold hover:bg-hrms-primary-hover"
            >
              Return to Portal Home
            </a>
          </div>
        }
      />
    </Routes>
  )
}

export default AppRoutes
