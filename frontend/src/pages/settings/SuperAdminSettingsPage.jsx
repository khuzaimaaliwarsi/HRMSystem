import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import AppIcon from '@/components/common/AppIcon'
import CompanyProfileTab from '@/components/settings/CompanyProfileTab'
import RolesPermissionsTab from '@/components/settings/RolesPermissionsTab'
import CentralPolicyBuilderTab from '@/components/settings/CentralPolicyBuilderTab'
import ApprovalAuthorityMatrixTab from '@/components/settings/ApprovalAuthorityMatrixTab'
import AttendanceLeavePoliciesTab from '@/components/settings/AttendanceLeavePoliciesTab'
import CompensationExpensePoliciesTab from '@/components/settings/CompensationExpensePoliciesTab'
import WorkingCalendarTab from '@/components/settings/WorkingCalendarTab'
import ScheduledAlertsTab from '@/components/settings/ScheduledAlertsTab'
import SecurityAuditLogsTab from '@/components/settings/SecurityAuditLogsTab'
import PortalUserManagementTab from '@/components/settings/PortalUserManagementTab'
import DataManagementTab from '@/components/settings/DataManagementTab'

export function SuperAdminSettingsPage({ defaultTab = 'profile' }) {
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || defaultTab)
  const [resetStatus, setResetStatus] = useState(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    } else {
      setActiveTab(defaultTab)
    }
  }, [searchParams, defaultTab])

  return (
    <div className="space-y-4 text-left">
      {/* Reset Notification Banner */}
      {resetStatus && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <AppIcon name="check" className="w-4 h-4 text-emerald-600" />
          <span>{resetStatus}</span>
        </div>
      )}

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div>
        {activeTab === 'profile' && <CompanyProfileTab />}
        {activeTab === 'policies' && <CentralPolicyBuilderTab />}
        {activeTab === 'permissions' && <RolesPermissionsTab />}
        {activeTab === 'matrix' && <ApprovalAuthorityMatrixTab />}
        {activeTab === 'attendance_leaves' && <AttendanceLeavePoliciesTab />}
        {activeTab === 'finance_expenses' && <CompensationExpensePoliciesTab />}
        {activeTab === 'calendar' && <WorkingCalendarTab />}
        {activeTab === 'alerts' && <ScheduledAlertsTab />}
        {activeTab === 'users' && <PortalUserManagementTab />}
        {activeTab === 'audit' && <SecurityAuditLogsTab />}
        {(activeTab === 'data_management' || activeTab === 'qa_reset') && <DataManagementTab />}
      </div>
    </div>
  )
}

export default SuperAdminSettingsPage
