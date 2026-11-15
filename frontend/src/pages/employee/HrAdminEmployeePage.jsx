import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { employeeService } from '@/services/employeeService'
import { syncOrganization } from '@/services/backendSync'
import EmployeeDirectoryTable from '@/components/employee/EmployeeDirectoryTable'
import EmployeeFormModal from '@/components/employee/EmployeeFormModal'
import EmployeeProfileView from '@/components/employee/EmployeeProfileView'
import OrganizationStructureTab from '@/components/employee/OrganizationStructureTab'
import PromotionTransferModal from '@/components/employee/PromotionTransferModal'
import SuccessionDeactivationModal from '@/components/employee/SuccessionDeactivationModal'
import Alert from '@/components/common/Alert'
import AppIcon from '@/components/common/AppIcon'

export function HrAdminEmployeePage() {
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'directory'
  const [employees, setEmployees] = useState(() => employeeService.getEmployees())
  const [departments, setDepartments] = useState(() => employeeService.getDepartments())
  const [subDepartments, setSubDepartments] = useState(() => employeeService.getSubDepartments())
  const [teams, setTeams] = useState(() => employeeService.getTeams())
  const [designations, setDesignations] = useState(() => employeeService.getDesignations())
  const [teamAssignments, setTeamAssignments] = useState(() => employeeService.getTeamAssignments())
  const [notification, setNotification] = useState(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [viewingEmployee, setViewingEmployee] = useState(null)
  const [selectedProfileEmployeeId, setSelectedProfileEmployeeId] = useState(() => {
    const emps = employeeService.getEmployees()
    return emps[0]?.id || ''
  })
  const [deactivatingEmployee, setDeactivatingEmployee] = useState(null)
  const [isSuccessionModalOpen, setIsSuccessionModalOpen] = useState(false)
  const [promotingEmployee, setPromotingEmployee] = useState(null)
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false)

  const loadData = useCallback(() => {
    setEmployees(employeeService.getEmployees())
    setDepartments(employeeService.getDepartments())
    setSubDepartments(employeeService.getSubDepartments())
    setTeams(employeeService.getTeams())
    setDesignations(employeeService.getDesignations())
    setTeamAssignments(employeeService.getTeamAssignments())
  }, [])

  useEffect(() => {
    const unsubscribe = employeeService.subscribe(() => {
      loadData()
    })
    syncOrganization().then(() => {
      loadData()
    }).catch(() => {})
    return () => unsubscribe()
  }, [loadData])

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 4000)
    return () => clearTimeout(timer)
  }, [notification])

  const handleCreateEmployee = () => {
    setEditingEmployee(null)
    setIsFormOpen(true)
  }

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp)
    setIsFormOpen(true)
  }

  const handleViewProfile = (emp) => {
    setViewingEmployee(emp)
  }

  const handleFormSubmit = async (formData, actor) => {
    try {
      if (editingEmployee) {
        await employeeService.updateEmployeeAsync(
          editingEmployee.id,
          formData,
          actor,
          formData.changeReason || 'HR Administrative Update',
          formData.effectiveDate
        )
        setNotification({
          type: 'success',
          message: `Staff record for ${formData.name} (${editingEmployee.id}) updated.`
        })
      } else {
        const created = await employeeService.createEmployeeAsync(formData, actor)
        setNotification({
          type: 'success',
          message: `Employee ${created.name} (${created.id}) successfully added to directory.`
        })
      }
      setIsFormOpen(false)
      await syncOrganization()
      loadData()
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
      throw err
    }
  }

  const handleToggleEmployeeStatus = async (emp) => {
    try {
      const isCurrentlyInactive = (emp.status || '').toLowerCase() === 'inactive' || (emp.status || '').toLowerCase() === 'separated' || (emp.status || '').toLowerCase() === 'suspended'
      if (isCurrentlyInactive) {
        await employeeService.activateEmployeeAsync(emp.id, 'Re-activated via Directory Action', 'Ayesha Khan (HR Admin)')
        setNotification({
          type: 'success',
          message: `Employee ${emp.name} (${emp.id}) has been set to Active.`
        })
        await syncOrganization()
        loadData()
      } else {
        setDeactivatingEmployee(emp)
        setIsSuccessionModalOpen(true)
      }
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  return (
    <div className="space-y-3 text-left">
      {/* Dynamic Submodule Header (Rendered for Org, Profiles, and Banking) */}
      {activeTab && activeTab !== 'directory' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'org'
                  ? 'Organization Master'
                  : activeTab === 'profiles'
                  ? 'Employee Profiles & Career History'
                  : 'Bank & Payment Details'}
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                People Operations
              </span>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Alert variant={notification.type} onClose={() => setNotification(null)}>
          {notification.message}
        </Alert>
      )}

      {/* ONE SUBMODULE = ONE FUNCTIONAL SCREEN */}
      {activeTab === 'org' ? (
        <OrganizationStructureTab
          departments={departments}
          subDepartments={subDepartments}
          teams={teams}
          designations={designations}
          employees={employees}
          teamAssignments={teamAssignments}
          onSaveDepartment={async (data, actor) => {
            const res = await employeeService.saveDepartmentAsync(data, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onToggleDepartmentStatus={async (id, actor) => {
            const res = await employeeService.toggleDepartmentStatusAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onDeleteDepartment={async (id, actor) => {
            const res = await employeeService.deleteDepartmentAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onSaveSubDepartment={async (data, actor) => {
            const res = await employeeService.saveSubDepartmentAsync(data, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onToggleSubDepartmentStatus={async (id, actor) => {
            const res = await employeeService.toggleSubDepartmentStatusAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onDeleteSubDepartment={async (id, actor) => {
            const res = await employeeService.deleteSubDepartmentAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onSaveTeam={async (data, actor) => {
            const res = await employeeService.saveTeamAsync(data, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onToggleTeamStatus={async (id, actor) => {
            const res = await employeeService.toggleTeamStatusAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onDeleteTeam={async (id, actor) => {
            const res = await employeeService.deleteTeamAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onSaveDesignation={async (data, actor) => {
            const res = await employeeService.saveDesignationAsync(data, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onToggleDesignationStatus={async (id, actor) => {
            const res = await employeeService.toggleDesignationStatusAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onDeleteDesignation={async (id, actor) => {
            const res = await employeeService.deleteDesignationAsync(id, actor)
            await syncOrganization()
            loadData()
            return res
          }}
          onAssignTeamLeadOrManager={(data, actor) => employeeService.assignTeamLeadOrManager(data, actor)}
          onToggleTeamAssignment={(assignmentId, actor) => employeeService.toggleTeamAssignmentStatus(assignmentId, actor)}
          onDeleteTeamAssignment={(assignmentId, actor) => employeeService.deleteTeamAssignment(assignmentId, actor)}
          onRemoveTeamAssignment={(assignmentId, reason, actor) => employeeService.removeTeamAssignment(assignmentId, reason, actor)}
          actor="Ayesha Khan (Lead People Operations)"
        />
      ) : activeTab === 'profiles' ? (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-lg border border-hrms-border flex items-center justify-between gap-4">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <AppIcon name="employees" className="w-4 h-4 text-hrms-accent" />
              <span>Select Employee Dossier:</span>
            </label>
            <select
              value={selectedProfileEmployeeId}
              onChange={(e) => setSelectedProfileEmployeeId(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-md px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 max-w-xs"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id}) — {emp.designation}
                </option>
              ))}
            </select>
          </div>
          {(() => {
            const currentProfileEmp = employees.find((e) => e.id === selectedProfileEmployeeId) || employees[0]
            return currentProfileEmp ? (
              <EmployeeProfileView
                employee={currentProfileEmp}
                bankDetails={employeeService.getBankDetails(currentProfileEmp.id, 'hr_admin', 'EMP-002')}
                careerHistory={employeeService.getCareerHistory(currentProfileEmp.id)}
                reportingChain={employeeService.getReportingChain(currentProfileEmp.id)}
                onEdit={() => handleEditEmployee(currentProfileEmp)}
                canEdit={true}
                userRole="hr_admin"
                currentUserId="EMP-002"
              />
            ) : null
          })()}
        </div>
      ) : activeTab === 'banking' ? (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-lg border border-hrms-border flex items-center justify-between gap-4">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <AppIcon name="payroll" className="w-4 h-4 text-emerald-600" />
              <span>Select Staff for Bank Verification:</span>
            </label>
            <select
              value={selectedProfileEmployeeId}
              onChange={(e) => setSelectedProfileEmployeeId(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-md px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 max-w-xs"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id}) — {emp.department}
                </option>
              ))}
            </select>
          </div>
          {(() => {
            const currentProfileEmp = employees.find((e) => e.id === selectedProfileEmployeeId) || employees[0]
            return currentProfileEmp ? (
              <EmployeeProfileView
                employee={currentProfileEmp}
                bankDetails={employeeService.getBankDetails(currentProfileEmp.id, 'hr_admin', 'EMP-002')}
                careerHistory={employeeService.getCareerHistory(currentProfileEmp.id)}
                reportingChain={employeeService.getReportingChain(currentProfileEmp.id)}
                onEdit={() => handleEditEmployee(currentProfileEmp)}
                canEdit={true}
                userRole="hr_admin"
                currentUserId="EMP-002"
                initialTab="bank"
              />
            ) : null
          })()}
        </div>
      ) : viewingEmployee ? (
        <EmployeeProfileView
          employee={employees.find((e) => e.id === viewingEmployee.id) || viewingEmployee}
          bankDetails={employeeService.getBankDetails(viewingEmployee.id, 'hr_admin', 'EMP-002')}
          careerHistory={employeeService.getCareerHistory(viewingEmployee.id)}
          reportingChain={employeeService.getReportingChain(viewingEmployee.id)}
          onEdit={() => handleEditEmployee(employees.find((e) => e.id === viewingEmployee.id) || viewingEmployee)}
          onClose={() => setViewingEmployee(null)}
          canEdit={true}
          userRole="hr_admin"
          currentUserId="EMP-002"
        />
      ) : (
        <EmployeeDirectoryTable
          employees={employees}
          departments={departments}
          designations={designations}
          onViewProfile={handleViewProfile}
          onEditEmployee={handleEditEmployee}
          onPromoteTransfer={(emp) => {
            setPromotingEmployee(emp)
            setIsPromoteModalOpen(true)
          }}
          onToggleStatus={handleToggleEmployeeStatus}
          onAddEmployee={handleCreateEmployee}
          canEdit={true}
          canToggleStatus={true}
          canPromoteTransfer={true}
          title="Employee Directory"
          subtitle="Centralized staff directory, organization hierarchy, profiles, and employment lifecycles."
        />
      )}

      {/* Employee Add/Edit Modal */}
      <EmployeeFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        employee={editingEmployee}
        departments={departments}
        subDepartments={subDepartments}
        teams={teams}
        designations={designations}
        allEmployees={employees}
        actor="Ayesha Khan (Lead People Operations)"
      />

      {/* Promotion / Transfer Modal */}
      {isPromoteModalOpen && promotingEmployee && (
        <PromotionTransferModal
          isOpen={isPromoteModalOpen}
          onClose={() => {
            setIsPromoteModalOpen(false)
            setPromotingEmployee(null)
          }}
          employee={promotingEmployee}
          departments={departments}
          subDepartments={subDepartments}
          teams={teams}
          designations={designations}
          allEmployees={employees}
          currentActor="Ayesha Khan (HR Admin)"
          onSuccess={(res) => {
            setNotification({
              type: 'success',
              message: `Promotion / transfer for ${promotingEmployee.name} recorded successfully (${(res?.changes || []).length} change(s)).`
            })
            loadData()
          }}
        />
      )}

      {/* Succession & Separation Modal */}
      {isSuccessionModalOpen && deactivatingEmployee && (
        <SuccessionDeactivationModal
          isOpen={isSuccessionModalOpen}
          onClose={() => {
            setIsSuccessionModalOpen(false)
            setDeactivatingEmployee(null)
          }}
          employee={deactivatingEmployee}
          allEmployees={employees}
          currentActor="Ayesha Khan (HR Admin)"
          onSuccess={async ({ employeeId, successorId }) => {
            setNotification({
              type: 'success',
              message: successorId
                ? `Succession completed and employee separated successfully.`
                : `Employee separated successfully.`
            })
            await syncOrganization()
            loadData()
          }}
        />
      )}
    </div>
  )
}

export default HrAdminEmployeePage
