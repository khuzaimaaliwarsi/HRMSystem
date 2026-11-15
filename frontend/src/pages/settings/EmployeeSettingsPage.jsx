import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import AttendanceLeavePoliciesTab from '@/components/settings/AttendanceLeavePoliciesTab'
import WorkingCalendarTab from '@/components/settings/WorkingCalendarTab'
import ScheduledAlertsTab from '@/components/settings/ScheduledAlertsTab'

export function EmployeeSettingsPage({ defaultTab = 'notifications' }) {
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
      {activeTab === 'notifications' && <ScheduledAlertsTab />}
      {activeTab === 'entitlements' && <AttendanceLeavePoliciesTab />}
      {activeTab === 'calendar' && <WorkingCalendarTab />}
    </div>
  )
}

export default EmployeeSettingsPage
