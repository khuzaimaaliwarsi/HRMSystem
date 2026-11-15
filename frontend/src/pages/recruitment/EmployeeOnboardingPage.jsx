import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/useAuth'
import { employeeService } from '@/services/employeeService'
import { recruitmentService } from '@/services/recruitmentService'
import EmployeeOnboardingView from '@/components/recruitment/EmployeeOnboardingView'
import AppIcon from '@/components/common/AppIcon'

export function EmployeeOnboardingPage() {
  const { user } = useAuth()
  const employeeId = user?.employeeId || 'EMP-006' // Usman Tariq (currently on active probation)

  const [employee, setEmployee] = useState(() => employeeService.getEmployeeById(employeeId))
  const [probationRecord, setProbationRecord] = useState(() => {
    const list = recruitmentService.getProbationRecords({}, { role: 'employee', employeeId })
    return list.find((p) => p.employeeId === employeeId) || null
  })

  useEffect(() => {
    const load = () => {
      const emp = employeeService.getEmployeeById(employeeId)
      setEmployee(emp)
      const list = recruitmentService.getProbationRecords({}, { role: 'employee', employeeId })
      setProbationRecord(list.find((p) => p.employeeId === employeeId) || null)
    }

    const unsubEmp = employeeService.subscribe(load)
    const unsubRec = recruitmentService.subscribe(load)
    return () => {
      unsubEmp()
      unsubRec()
    }
  }, [employeeId])

  if (!employee) {
    return (
      <div className="bg-white rounded-lg border border-hrms-border p-8 text-center">
        <AppIcon name="user" className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800">No Employee Profile Found</h3>
        <p className="text-xs text-slate-500 mt-1">Unable to locate your canonical employee record.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-left">
      <EmployeeOnboardingView
        employee={employee}
        probationRecord={probationRecord}
      />
    </div>
  )
}

export default EmployeeOnboardingPage
