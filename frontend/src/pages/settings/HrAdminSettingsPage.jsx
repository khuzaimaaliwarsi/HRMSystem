import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import CompanyProfileTab from '@/components/settings/CompanyProfileTab'
import CentralPolicyBuilderTab from '@/components/settings/CentralPolicyBuilderTab'
import ApprovalAuthorityMatrixTab from '@/components/settings/ApprovalAuthorityMatrixTab'
import AttendanceLeavePoliciesTab from '@/components/settings/AttendanceLeavePoliciesTab'
import WorkingCalendarTab from '@/components/settings/WorkingCalendarTab'
import ScheduledAlertsTab from '@/components/settings/ScheduledAlertsTab'
import SecurityAuditLogsTab from '@/components/settings/SecurityAuditLogsTab'

export function HrAdminSettingsPage({ defaultTab = 'profile' }) {
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || defaultTab)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  return (
    <div className="space-y-4 text-left">
      {activeTab === 'profile' && <CompanyProfileTab />}
      {activeTab === 'policies' && <CentralPolicyBuilderTab />}
      {activeTab === 'matrix' && <ApprovalAuthorityMatrixTab />}
      {activeTab === 'attendance_leaves' && <AttendanceLeavePoliciesTab />}
      {activeTab === 'calendar' && <WorkingCalendarTab />}
      {activeTab === 'alerts' && <ScheduledAlertsTab />}
      {activeTab === 'audit' && <SecurityAuditLogsTab />}
    </div>
  )
}

export default HrAdminSettingsPage
