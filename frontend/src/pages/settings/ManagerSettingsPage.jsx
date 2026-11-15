import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ApprovalAuthorityMatrixTab from '@/components/settings/ApprovalAuthorityMatrixTab'
import AttendanceLeavePoliciesTab from '@/components/settings/AttendanceLeavePoliciesTab'
import WorkingCalendarTab from '@/components/settings/WorkingCalendarTab'
import ScheduledAlertsTab from '@/components/settings/ScheduledAlertsTab'

export function ManagerSettingsPage({ defaultTab = 'matrix' }) {
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
      {activeTab === 'matrix' && <ApprovalAuthorityMatrixTab />}
      {activeTab === 'team_policies' && <AttendanceLeavePoliciesTab />}
      {activeTab === 'calendar' && <WorkingCalendarTab />}
      {activeTab === 'notifications' && <ScheduledAlertsTab />}
    </div>
  )
}

export default ManagerSettingsPage
