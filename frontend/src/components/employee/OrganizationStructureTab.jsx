import React, { useState } from 'react'
import StatusBadge from '@/components/common/StatusBadge'
import Alert from '@/components/common/Alert'
import AppIcon from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'
import { employeeService } from '@/services/employeeService'

export function OrganizationStructureTab({
  departments = [],
  subDepartments = [],
  teams = [],
  designations = [],
  employees = [],
  teamAssignments = [],
  onSaveDepartment,
  onToggleDepartmentStatus,
  onDeleteDepartment,
  onSaveSubDepartment,
  onToggleSubDepartmentStatus,
  onDeleteSubDepartment,
  onSaveTeam,
  onToggleTeamStatus,
  onDeleteTeam,
  onSaveDesignation,
  onToggleDesignationStatus,
  onDeleteDesignation,
  onAssignTeamLeadOrManager,
  onToggleTeamAssignment,
  onDeleteTeamAssignment,
  onRemoveTeamAssignment,
  actor = 'Super Admin'
}) {
  const [subTab, setSubTab] = useState('departments') // 'departments' | 'subdepartments' | 'teams' | 'designations' | 'assignments'
  const [notification, setNotification] = useState(null)
  const [modalType, setModalType] = useState(null) // 'dept' | 'subdept' | 'team' | 'desig' | 'assignment'
  const [editingItem, setEditingItem] = useState(null)
  const [viewingItem, setViewingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)

  // Form states for modals
  const [deptForm, setDeptForm] = useState({ code: '', name: '', description: '', headId: '', status: 'Active' })
  const [subdeptForm, setSubdeptForm] = useState({ code: '', name: '', departmentId: '', managerId: '', description: '', status: 'Active' })
  const [teamForm, setTeamForm] = useState({ code: '', name: '', departmentId: '', subDepartmentId: '', managerId: '', teamLeadId: '', description: '', status: 'Active' })
  const [desigForm, setDesigForm] = useState({ code: '', name: '', departmentId: '', level: 'L2 - Mid Contributor', description: '', status: 'Active' })
  const [assignmentForm, setAssignmentForm] = useState({
    employeeId: '',
    role: 'team_lead',
    teamIds: [],
    effectiveDate: new Date().toISOString().slice(0, 10),
    notes: ''
  })

  const safeDepartments = Array.isArray(departments) ? departments : []
  const safeSubDepartments = Array.isArray(subDepartments) ? subDepartments : []
  const safeTeams = Array.isArray(teams) ? teams : []
  const safeDesignations = Array.isArray(designations) ? designations : []
  const safeEmployees = Array.isArray(employees) ? employees : []
  const safeTeamAssignments = Array.isArray(teamAssignments) ? teamAssignments : []

  // Helpers to count active staff in each entity
  const getStaffCountByDept = (deptId) => {
    return safeEmployees.filter((e) => e.departmentId === deptId && e.status !== 'Separated' && e.status !== 'Inactive').length
  }

  const getStaffCountByTeam = (teamId) => {
    return safeEmployees.filter((e) => e.teamId === teamId && e.status !== 'Separated' && e.status !== 'Inactive').length
  }

  const getStaffCountByDesig = (desigId) => {
    return safeEmployees.filter((e) => e.designationId === desigId && e.status !== 'Separated' && e.status !== 'Inactive').length
  }

  // Open Add/Edit Modals
  const openDeptModal = (dept = null) => {
    setEditingItem(dept)
    if (dept) {
      setDeptForm({ code: dept.code, name: dept.name, description: dept.description || '', headId: dept.headId || '', status: dept.status })
    } else {
      setDeptForm({ code: '', name: '', description: '', headId: '', status: 'Active' })
    }
    setModalType('dept')
  }

  const openSubDeptModal = (subdept = null) => {
    setEditingItem(subdept)
    if (subdept) {
      setSubdeptForm({
        code: subdept.code,
        name: subdept.name,
        departmentId: subdept.departmentId,
        managerId: subdept.managerId || '',
        description: subdept.description || '',
        status: subdept.status
      })
    } else {
      setSubdeptForm({
        code: '',
        name: '',
        departmentId: departments[0]?.id || '',
        managerId: '',
        description: '',
        status: 'Active'
      })
    }
    setModalType('subdept')
  }

  const openTeamModal = (team = null) => {
    setEditingItem(team)
    if (team) {
      setTeamForm({
        code: team.code,
        name: team.name,
        departmentId: team.departmentId,
        subDepartmentId: team.subDepartmentId || '',
        managerId: team.managerId || '',
        teamLeadId: team.teamLeadId || '',
        description: team.description || '',
        status: team.status
      })
    } else {
      setTeamForm({
        code: '',
        name: '',
        departmentId: departments[0]?.id || '',
        subDepartmentId: '',
        managerId: '',
        teamLeadId: '',
        description: '',
        status: 'Active'
      })
    }
    setModalType('team')
  }

  const openDesigModal = (desig = null) => {
    setEditingItem(desig)
    if (desig) {
      setDesigForm({
        code: desig.code,
        name: desig.name,
        departmentId: desig.departmentId || '',
        level: desig.level || 'L2 - Mid Contributor',
        description: desig.description || '',
        status: desig.status
      })
    } else {
      setDesigForm({
        code: '',
        name: '',
        departmentId: '',
        level: 'L2 - Mid Contributor',
        description: '',
        status: 'Active'
      })
    }
    setModalType('desig')
  }

  const openAssignmentModal = () => {
    setEditingItem(null)
    setAssignmentForm({
      employeeId: employees[0]?.id || '',
      role: 'team_lead',
      teamIds: teams[0] ? [teams[0].id] : [],
      effectiveDate: new Date().toISOString().slice(0, 10),
      notes: ''
    })
    setModalType('assignment')
  }

  const closeModal = () => {
    setModalType(null)
    setEditingItem(null)
  }

  const handleSaveAssignment = (e) => {
    e.preventDefault()
    try {
      if (!assignmentForm.employeeId) {
        throw new Error('Please select an employee.')
      }
      if (!assignmentForm.teamIds || assignmentForm.teamIds.length === 0) {
        throw new Error('Please select at least one team.')
      }
      if (assignmentForm.role === 'team_lead') {
        for (const tid of assignmentForm.teamIds) {
          const existingLead = teamAssignments.find(
            (a) => a.teamId === tid && a.role === 'team_lead' && a.status === 'Active' && a.employeeId !== assignmentForm.employeeId
          )
          if (existingLead) {
            const t = teams.find((team) => team.id === tid)
            throw new Error(
              `Conflict: Team '${t ? t.name : tid}' already has an active Team Lead '${existingLead.employeeName}' (${existingLead.employeeId}, ${existingLead.id}). A team cannot have multiple active Team Leads. Reassign or resolve the existing assignment first.`
            )
          }
        }
      }
      onAssignTeamLeadOrManager(assignmentForm, actor)
      setNotification({ type: 'success', message: 'Team assignment recorded successfully.' })
      closeModal()
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleRemoveAssignment = (assignment) => {
    const confirmed = window.confirm?.(
      `Are you sure you want to deassign ${assignment.employeeName} from ${assignment.teamName}?`
    ) ?? true
    if (!confirmed) return

    try {
      onRemoveTeamAssignment(assignment.id, 'Administrative deassignment', actor)
      setNotification({ type: 'success', message: `Deassigned ${assignment.employeeName} from ${assignment.teamName}.` })
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  // Handlers for saves (Instant optimistic UI updates)
  const handleSaveDept = async (e) => {
    e.preventDefault()
    try {
      const isEdit = Boolean(editingItem)
      const headEmp = safeEmployees.find((emp) => emp.id === deptForm.headId)
      const payload = {
        id: editingItem ? editingItem.id : undefined,
        ...deptForm,
        headName: headEmp ? headEmp.name : 'Unassigned'
      }
      closeModal()
      setNotification({ type: 'success', message: `Department ${isEdit ? 'updated' : 'created'} successfully.` })
      await onSaveDepartment(payload, actor)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleSaveSubDept = async (e) => {
    e.preventDefault()
    try {
      const isEdit = Boolean(editingItem)
      const mgrEmp = safeEmployees.find((emp) => emp.id === subdeptForm.managerId)
      const parentDept = safeDepartments.find((d) => d.id === subdeptForm.departmentId || d.code === subdeptForm.departmentId)
      const payload = {
        id: editingItem ? editingItem.id : undefined,
        ...subdeptForm,
        departmentName: parentDept ? parentDept.name : '',
        managerName: mgrEmp ? mgrEmp.name : 'Unassigned'
      }
      closeModal()
      setNotification({ type: 'success', message: `Sub-department ${isEdit ? 'updated' : 'created'} successfully.` })
      await onSaveSubDepartment(payload, actor)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleSaveTeam = async (e) => {
    e.preventDefault()
    try {
      const isEdit = Boolean(editingItem)
      const mgrEmp = safeEmployees.find((emp) => emp.id === teamForm.managerId)
      const leadEmp = safeEmployees.find((emp) => emp.id === teamForm.teamLeadId)
      const parentDept = safeDepartments.find((d) => d.id === teamForm.departmentId || d.code === teamForm.departmentId)
      const payload = {
        id: editingItem ? editingItem.id : undefined,
        ...teamForm,
        departmentName: parentDept ? parentDept.name : '',
        subDepartmentId: teamForm.subDepartmentId || null,
        managerName: mgrEmp ? mgrEmp.name : 'Unassigned',
        teamLeadId: teamForm.teamLeadId || null,
        teamLeadName: leadEmp ? leadEmp.name : 'Unassigned'
      }
      closeModal()
      setNotification({ type: 'success', message: `Team ${isEdit ? 'updated' : 'created'} successfully.` })
      await onSaveTeam(payload, actor)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleSaveDesig = async (e) => {
    e.preventDefault()
    try {
      const isEdit = Boolean(editingItem)
      const payload = {
        id: editingItem ? editingItem.id : undefined,
        ...desigForm
      }
      closeModal()
      setNotification({ type: 'success', message: `Designation ${isEdit ? 'updated' : 'created'} successfully.` })
      await onSaveDesignation(payload, actor)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleToggleDept = async (dept) => {
    try {
      await onToggleDepartmentStatus(dept.id, actor)
      setNotification({ type: 'success', message: `Department ${dept.name} status updated.` })
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleToggleSubDept = async (subdept) => {
    try {
      await onToggleSubDepartmentStatus(subdept.id, actor)
      setNotification({ type: 'success', message: `Sub-department ${subdept.name} status updated.` })
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleToggleTeam = async (team) => {
    try {
      await onToggleTeamStatus(team.id, actor)
      setNotification({ type: 'success', message: `Team ${team.name} status updated.` })
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleToggleDesig = async (desig) => {
    try {
      await onToggleDesignationStatus(desig.id, actor)
      setNotification({ type: 'success', message: `Designation ${desig.name} status updated.` })
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleToggleAssignment = async (assignment) => {
    try {
      if (onToggleTeamAssignment) {
        await onToggleTeamAssignment(assignment.id, actor)
      } else {
        await employeeService.toggleTeamAssignmentStatus(assignment.id, actor)
      }
      setNotification({ type: 'success', message: `Assignment ${assignment.id} status updated.` })
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingItem) return
    const { type, item } = deletingItem
    try {
      if (type === 'dept') {
        onDeleteDepartment ? await onDeleteDepartment(item.id, actor) : await employeeService.deleteDepartmentAsync(item.id, actor)
        setNotification({ type: 'success', message: `Department '${item.name}' deleted successfully.` })
      } else if (type === 'subdept') {
        onDeleteSubDepartment ? await onDeleteSubDepartment(item.id, actor) : await employeeService.deleteSubDepartmentAsync(item.id, actor)
        setNotification({ type: 'success', message: `Sub-department '${item.name}' deleted successfully.` })
      } else if (type === 'team') {
        onDeleteTeam ? await onDeleteTeam(item.id, actor) : await employeeService.deleteTeamAsync(item.id, actor)
        setNotification({ type: 'success', message: `Team '${item.name}' deleted successfully.` })
      } else if (type === 'desig') {
        onDeleteDesignation ? await onDeleteDesignation(item.id, actor) : await employeeService.deleteDesignationAsync(item.id, actor)
        setNotification({ type: 'success', message: `Designation '${item.name}' deleted successfully.` })
      } else if (type === 'assignment') {
        onDeleteTeamAssignment ? await onDeleteTeamAssignment(item.id, actor) : await employeeService.deleteTeamAssignment(item.id, actor)
        setNotification({ type: 'success', message: `Assignment '${item.id}' deleted successfully.` })
      }
      setDeletingItem(null)
    } catch (err) {
      setNotification({ type: 'danger', message: err.message })
    }
  }

  return (
    <div className="space-y-4 text-left">
      {notification && (
        <Alert variant={notification.type} onClose={() => setNotification(null)}>
          {notification.message}
        </Alert>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="bg-white rounded-lg border border-hrms-border p-3 shadow-hrms-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg flex-wrap">
          <button
            type="button"
            onClick={() => setSubTab('departments')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all",
              subTab === 'departments'
                ? "bg-white text-hrms-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Departments ({safeDepartments.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('subdepartments')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all",
              subTab === 'subdepartments'
                ? "bg-white text-hrms-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Sub-Departments ({safeSubDepartments.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('teams')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all",
              subTab === 'teams'
                ? "bg-white text-hrms-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Teams ({safeTeams.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('designations')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all",
              subTab === 'designations'
                ? "bg-white text-hrms-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Designations ({safeDesignations.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('assignments')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all",
              subTab === 'assignments'
                ? "bg-white text-hrms-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Multi-Team Assignments ({safeTeamAssignments.length})
          </button>
        </div>

        <div>
          {subTab === 'departments' && (
            <button
              type="button"
              onClick={() => openDeptModal()}
              className="px-3 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Department</span>
            </button>
          )}
          {subTab === 'subdepartments' && (
            <button
              type="button"
              onClick={() => openSubDeptModal()}
              className="px-3 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Sub-Department</span>
            </button>
          )}
          {subTab === 'teams' && (
            <button
              type="button"
              onClick={() => openTeamModal()}
              className="px-3 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Team</span>
            </button>
          )}
          {subTab === 'designations' && (
            <button
              type="button"
              onClick={() => openDesigModal()}
              className="px-3 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Designation</span>
            </button>
          )}
          {subTab === 'assignments' && (
            <button
              type="button"
              onClick={openAssignmentModal}
              className="px-3 py-1.5 rounded-md bg-hrms-primary hover:bg-hrms-primary-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Assign Lead / Manager</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: DEPARTMENTS */}
      {subTab === 'departments' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-hrms-canvas border-b border-hrms-border text-[10px] uppercase font-bold text-hrms-muted tracking-wider">
                  <th className="px-4 py-3">Code & ID</th>
                  <th className="px-4 py-3">Department Name</th>
                  <th className="px-4 py-3">Department Head</th>
                  <th className="px-3 py-3 text-center">Active Staff</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hrms-border/60">
                {departments.map((dept, idx) => {
                  const staffCount = getStaffCountByDept(dept.id)
                  return (
                    <tr key={dept.id} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                      <td className="px-4 py-3 font-mono font-bold text-hrms-primary whitespace-nowrap">
                        {dept.code} <span className="text-[10px] font-normal text-slate-400">({dept.id})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-hrms-text block">{dept.name}</span>
                        <span className="text-[11px] text-hrms-muted truncate max-w-sm block">{dept.description}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {dept.headName || 'Unassigned'}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-hrms-primary">
                        {staffCount}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={dept.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* 1. VIEW */}
                          <button
                            type="button"
                            onClick={() => setViewingItem({ type: 'dept', item: dept })}
                            title="View Department Details"
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200 cursor-pointer"
                          >
                            <AppIcon name="eye" className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. EDIT */}
                          <button
                            type="button"
                            onClick={() => openDeptModal(dept)}
                            title="Edit Department"
                            className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200 cursor-pointer"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* 3. STATUS TOGGLE (ACTIVE / INACTIVE) */}
                          <button
                            type="button"
                            onClick={() => handleToggleDept(dept)}
                            title={dept.status === 'Active' ? 'Deactivate Department' : 'Activate Department'}
                            className={cn(
                              "w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent cursor-pointer",
                              dept.status === 'Active'
                                ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
                                : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200"
                            )}
                          >
                            <AppIcon name={dept.status === 'Active' ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                          </button>

                          {/* 4. DELETE */}
                          <button
                            type="button"
                            onClick={() => setDeletingItem({ type: 'dept', item: dept })}
                            title="Delete Department"
                            className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200 cursor-pointer"
                          >
                            <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SUB-DEPARTMENTS */}
      {subTab === 'subdepartments' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-hrms-canvas border-b border-hrms-border text-[10px] uppercase font-bold text-hrms-muted tracking-wider">
                  <th className="px-4 py-3">Code & ID</th>
                  <th className="px-4 py-3">Sub-Department Name</th>
                  <th className="px-4 py-3">Parent Department</th>
                  <th className="px-4 py-3">Sub-Dept Manager</th>
                  <th className="px-3 py-3 text-center">Assigned Teams</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hrms-border/60">
                {safeSubDepartments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-400 italic">
                      No sub-departments configured yet. Sub-departments are optional intermediate units under departments.
                    </td>
                  </tr>
                ) : (
                  safeSubDepartments.map((sd, idx) => {
                    const assignedTeamsCount = safeTeams.filter((t) => t.subDepartmentId === sd.id).length
                    return (
                      <tr key={sd.id} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                        <td className="px-4 py-3 font-mono font-bold text-hrms-primary whitespace-nowrap">
                          {sd.code} <span className="text-[10px] font-normal text-slate-400">({sd.id})</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-hrms-text block">{sd.name}</span>
                          <span className="text-[11px] text-hrms-muted truncate max-w-sm block">{sd.description}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {(() => {
                            const parentDept = safeDepartments.find((d) => d.id === sd.departmentId || d.code === sd.departmentId)
                            const displayDept = parentDept ? `${parentDept.name} (${parentDept.code})` : (sd.departmentName || sd.departmentId || 'Unassigned')
                            return (
                              <span className="text-slate-800 font-medium text-xs">
                                {displayDept}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                          {sd.managerName || 'Unassigned'}
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-hrms-primary">
                          {assignedTeamsCount}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <StatusBadge status={sd.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {/* 1. VIEW */}
                            <button
                              type="button"
                              onClick={() => setViewingItem({ type: 'subdept', item: sd })}
                              title="View Sub-Department Details"
                              className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200 cursor-pointer"
                            >
                              <AppIcon name="eye" className="w-3.5 h-3.5" />
                            </button>

                            {/* 2. EDIT */}
                            <button
                              type="button"
                              onClick={() => openSubDeptModal(sd)}
                              title="Edit Sub-Department"
                              className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200 cursor-pointer"
                            >
                              <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                            </button>

                            {/* 3. STATUS TOGGLE */}
                            <button
                              type="button"
                              onClick={() => handleToggleSubDept(sd)}
                              title={sd.status === 'Active' ? 'Deactivate Sub-Department' : 'Activate Sub-Department'}
                              className={cn(
                                "w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent cursor-pointer",
                                sd.status === 'Active'
                                  ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
                                  : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200"
                              )}
                            >
                              <AppIcon name={sd.status === 'Active' ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. DELETE */}
                            <button
                              type="button"
                              onClick={() => setDeletingItem({ type: 'subdept', item: sd })}
                              title="Delete Sub-Department"
                              className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: TEAMS */}
      {subTab === 'teams' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-hrms-canvas border-b border-hrms-border text-[10px] uppercase font-bold text-hrms-muted tracking-wider">
                  <th className="px-4 py-3">Code & ID</th>
                  <th className="px-4 py-3">Team Name</th>
                  <th className="px-4 py-3">Department & Sub-Dept</th>
                  <th className="px-4 py-3">Department Manager</th>
                  <th className="px-4 py-3">Assigned Team Lead</th>
                  <th className="px-3 py-3 text-center">Active Staff</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hrms-border/60">
                {teams.map((team, idx) => {
                  const staffCount = getStaffCountByTeam(team.id)
                  return (
                    <tr key={team.id} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                      <td className="px-4 py-3 font-mono font-bold text-hrms-primary whitespace-nowrap">
                        {team.code} <span className="text-[10px] font-normal text-slate-400">({team.id})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-hrms-text block">{team.name}</span>
                        <span className="text-[11px] text-hrms-muted truncate max-w-sm block">{team.description}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 block">{team.departmentName || team.departmentId}</span>
                        {team.subDepartmentName ? (
                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono inline-block mt-0.5">
                            {team.subDepartmentName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono inline-block mt-0.5">Direct Team</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {team.managerName || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {team.teamLeadName && team.teamLeadName !== 'Unassigned' ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[11px]">
                            {team.teamLeadName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-hrms-primary">
                        {staffCount}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={team.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* 1. VIEW */}
                          <button
                            type="button"
                            onClick={() => setViewingItem({ type: 'team', item: team })}
                            title="View Team Details"
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200 cursor-pointer"
                          >
                            <AppIcon name="eye" className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. EDIT */}
                          <button
                            type="button"
                            onClick={() => openTeamModal(team)}
                            title="Edit Team"
                            className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200 cursor-pointer"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* 3. STATUS TOGGLE */}
                          <button
                            type="button"
                            onClick={() => handleToggleTeam(team)}
                            title={team.status === 'Active' ? 'Deactivate Team' : 'Activate Team'}
                            className={cn(
                              "w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent cursor-pointer",
                              team.status === 'Active'
                                ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
                                : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200"
                            )}
                          >
                            <AppIcon name={team.status === 'Active' ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                          </button>

                          {/* 4. DELETE */}
                          <button
                            type="button"
                            onClick={() => setDeletingItem({ type: 'team', item: team })}
                            title="Delete Team"
                            className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200 cursor-pointer"
                          >
                            <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DESIGNATIONS */}
      {subTab === 'designations' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-hrms-canvas border-b border-hrms-border text-[10px] uppercase font-bold text-hrms-muted tracking-wider">
                  <th className="px-4 py-3">Code & ID</th>
                  <th className="px-4 py-3">Designation Title</th>
                  <th className="px-4 py-3">Career Level</th>
                  <th className="px-3 py-3 text-center">Active Staff</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hrms-border/60">
                {designations.map((desig, idx) => {
                  const staffCount = getStaffCountByDesig(desig.id)
                  return (
                    <tr key={desig.id} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                      <td className="px-4 py-3 font-mono font-bold text-hrms-primary whitespace-nowrap">
                        {desig.code} <span className="text-[10px] font-normal text-slate-400">({desig.id})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-hrms-text block">{desig.name}</span>
                        <span className="text-[11px] text-hrms-muted truncate max-w-sm block">{desig.description}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {desig.level}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold text-hrms-primary">
                        {staffCount}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={desig.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* 1. VIEW */}
                          <button
                            type="button"
                            onClick={() => setViewingItem({ type: 'desig', item: desig })}
                            title="View Designation Details"
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200 cursor-pointer"
                          >
                            <AppIcon name="eye" className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. EDIT */}
                          <button
                            type="button"
                            onClick={() => openDesigModal(desig)}
                            title="Edit Designation"
                            className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200 cursor-pointer"
                          >
                            <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* 3. STATUS TOGGLE */}
                          <button
                            type="button"
                            onClick={() => handleToggleDesig(desig)}
                            title={desig.status === 'Active' ? 'Deactivate Designation' : 'Activate Designation'}
                            className={cn(
                              "w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent cursor-pointer",
                              desig.status === 'Active'
                                ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
                                : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200"
                            )}
                          >
                            <AppIcon name={desig.status === 'Active' ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                          </button>

                          {/* 4. DELETE */}
                          <button
                            type="button"
                            onClick={() => setDeletingItem({ type: 'desig', item: desig })}
                            title="Delete Designation"
                            className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200 cursor-pointer"
                          >
                            <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: MULTI-TEAM ASSIGNMENTS */}
      {subTab === 'assignments' && (
        <div className="bg-white rounded-lg border border-hrms-border shadow-hrms-card overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-hrms-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Assigned Team Leads & Managers</h4>
              <p className="text-[11px] text-slate-500">
                Authorized multi-team coverage matrix. Allows Leads and Managers to oversee multiple pods with synchronized approval scopes.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-hrms-canvas border-b border-hrms-border text-[10px] uppercase font-bold text-hrms-muted tracking-wider">
                  <th className="px-4 py-3">Assignment ID & Role</th>
                  <th className="px-4 py-3">Assigned Lead / Manager</th>
                  <th className="px-4 py-3">Assigned Team</th>
                  <th className="px-4 py-3">Department & Sub-Dept</th>
                  <th className="px-4 py-3">Effective Date</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hrms-border/60">
                {safeTeamAssignments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-400 italic">
                      No team assignments configured yet.
                    </td>
                  </tr>
                ) : (
                  safeTeamAssignments.map((ta, idx) => {
                    const emp = safeEmployees.find((e) => e.id === ta.employeeId)
                    const team = safeTeams.find((t) => t.id === ta.teamId)
                    const dept = safeDepartments.find((d) => d.id === ta.departmentId || d.id === team?.departmentId)
                    const subDept = safeSubDepartments.find((s) => s.id === ta.subDepartmentId || s.id === team?.subDepartmentId)
                    return (
                      <tr key={ta.id} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-hrms-primary block">{ta.id}</span>
                          <span className={cn(
                            "inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5",
                            ta.role === 'team_lead'
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          )}>
                            {ta.role === 'team_lead' ? 'Team Lead' : 'Department Manager'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-hrms-text block">{ta.employeeName || emp?.name || ta.employeeId}</span>
                          <span className="text-[11px] text-slate-400 block font-mono">{ta.employeeId} • {emp?.designation || 'Staff'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 block">{ta.teamName || team?.name || ta.teamId}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">{ta.teamId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-700 block">{dept?.name || ta.departmentId}</span>
                          {subDept ? (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-mono inline-block mt-0.5">
                              {subDept.name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono inline-block mt-0.5">Direct Team</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          <div>{ta.effectiveDate || '2026-01-01'}</div>
                          <span className="text-[10px] text-slate-400">By {ta.assignedBy || 'Super Admin'}</span>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <StatusBadge status={ta.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {/* 1. VIEW */}
                            <button
                              type="button"
                              onClick={() => setViewingItem({ type: 'assignment', item: ta })}
                              title="View Assignment Details"
                              className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center transition border border-transparent hover:border-slate-200 cursor-pointer"
                            >
                              <AppIcon name="eye" className="w-3.5 h-3.5" />
                            </button>

                            {/* 2. EDIT */}
                            <button
                              type="button"
                              onClick={() => {
                                setAssignmentForm({
                                  employeeId: ta.employeeId,
                                  role: ta.role,
                                  teamIds: [ta.teamId],
                                  effectiveDate: ta.effectiveDate || new Date().toISOString().slice(0, 10),
                                  notes: ta.notes || ''
                                })
                                setModalType('assignment')
                                setEditingItem(ta)
                              }}
                              title="Edit Team Assignment"
                              className="w-7 h-7 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 inline-flex items-center justify-center transition border border-transparent hover:border-blue-200 cursor-pointer"
                            >
                              <AppIcon name="edit" className="w-3.5 h-3.5 text-blue-600" />
                            </button>

                            {/* 3. STATUS TOGGLE (ACTIVATE / DEACTIVATE) */}
                            <button
                              type="button"
                              onClick={() => handleToggleAssignment(ta)}
                              title={ta.status === 'Active' ? 'Deassign / Deactivate' : 'Reactivate Assignment'}
                              className={cn(
                                "w-7 h-7 rounded-lg inline-flex items-center justify-center transition border border-transparent cursor-pointer",
                                ta.status === 'Active'
                                  ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
                                  : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-200"
                              )}
                            >
                              <AppIcon name={ta.status === 'Active' ? 'pause' : 'play'} className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. DELETE */}
                            <button
                              type="button"
                              onClick={() => setDeletingItem({ type: 'assignment', item: ta })}
                              title="Delete Team Assignment"
                              className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center transition border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <AppIcon name="trash" className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {modalType === 'dept' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-hrms-primary">
                {editingItem ? `Edit Department: ${editingItem.name}` : 'Create New Department'}
              </h4>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveDept} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Code *</label>
                  <input
                    type="text"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ENG"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border uppercase font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select
                    value={deptForm.status}
                    onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Department Name *</label>
                <input
                  type="text"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Engineering & IT"
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Department Head</label>
                <select
                  value={deptForm.headId}
                  onChange={(e) => setDeptForm({ ...deptForm, headId: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                >
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Brief functional scope of this department..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-hrms-border">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded border text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-hrms-primary text-white text-xs font-bold cursor-pointer">Save Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'subdept' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-hrms-primary">
                {editingItem ? `Edit Sub-Department: ${editingItem.name}` : 'Create New Sub-Department'}
              </h4>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveSubDept} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Sub-Dept Code *</label>
                  <input
                    type="text"
                    value={subdeptForm.code}
                    onChange={(e) => setSubdeptForm({ ...subdeptForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. DEV-FE"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border uppercase font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select
                    value={subdeptForm.status}
                    onChange={(e) => setSubdeptForm({ ...subdeptForm, status: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Parent Department *</label>
                <select
                  value={subdeptForm.departmentId}
                  onChange={(e) => setSubdeptForm({ ...subdeptForm, departmentId: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                >
                  <option value="">Select Parent Department</option>
                  {safeDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Sub-Department Name *</label>
                <input
                  type="text"
                  value={subdeptForm.name}
                  onChange={(e) => setSubdeptForm({ ...subdeptForm, name: e.target.value })}
                  placeholder="e.g. Frontend Engineering Suite"
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Sub-Department Manager</label>
                <select
                  value={subdeptForm.managerId}
                  onChange={(e) => setSubdeptForm({ ...subdeptForm, managerId: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                >
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Assigns scoped manager oversight for this sub-department within the Manager Portal.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={subdeptForm.description}
                  onChange={(e) => setSubdeptForm({ ...subdeptForm, description: e.target.value })}
                  placeholder="Functional responsibilities and charter..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-hrms-border">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded border text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-hrms-primary text-white text-xs font-bold cursor-pointer">Save Sub-Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'team' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-hrms-primary">
                {editingItem ? `Edit Team: ${editingItem.name}` : 'Create New Team'}
              </h4>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveTeam} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Team Code *</label>
                  <input
                    type="text"
                    value={teamForm.code}
                    onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. DEV-MOB"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border uppercase font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select
                    value={teamForm.status}
                    onChange={(e) => setTeamForm({ ...teamForm, status: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Parent Department *</label>
                <select
                  value={teamForm.departmentId}
                  onChange={(e) => {
                    const newDeptId = e.target.value
                    const validSubDept = subDepartments.find(
                      (sd) => sd.id === teamForm.subDepartmentId && sd.departmentId === newDeptId
                    )
                    setTeamForm({
                      ...teamForm,
                      departmentId: newDeptId,
                      subDepartmentId: validSubDept ? validSubDept.id : ''
                    })
                  }}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Parent Sub-Department (Optional)</label>
                <select
                  value={teamForm.subDepartmentId || ''}
                  onChange={(e) => setTeamForm({ ...teamForm, subDepartmentId: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                >
                  <option value="">None (Direct Department Team)</option>
                  {subDepartments
                    .filter((sd) => sd.departmentId === teamForm.departmentId)
                    .map((sd) => (
                      <option key={sd.id} value={sd.id}>
                        {sd.name} ({sd.code})
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Link team to an intermediate sub-department, or leave blank for direct department assignment.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Team Name *</label>
                <input
                  type="text"
                  name="teamName"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="e.g. Frontend Development or Core Engineering"
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Department Manager</label>
                  <select
                    value={teamForm.managerId}
                    onChange={(e) => setTeamForm({ ...teamForm, managerId: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Assigned Team Lead</label>
                  <select
                    value={teamForm.teamLeadId}
                    onChange={(e) => setTeamForm({ ...teamForm, teamLeadId: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.designation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  placeholder="Technical or operational charter of this team..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-hrms-border">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded border text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-hrms-primary text-white text-xs font-bold cursor-pointer">Save Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'desig' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-hrms-primary">
                {editingItem ? `Edit Designation: ${editingItem.name}` : 'Create New Designation'}
              </h4>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveDesig} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Code *</label>
                  <input
                    type="text"
                    value={desigForm.code}
                    onChange={(e) => setDesigForm({ ...desigForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. QA-ENG"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border uppercase font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select
                    value={desigForm.status}
                    onChange={(e) => setDesigForm({ ...desigForm, status: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Designation Title *</label>
                <input
                  type="text"
                  value={desigForm.name}
                  onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
                  placeholder="e.g. Senior QA Engineer"
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Level / Grade</label>
                <select
                  value={desigForm.level}
                  onChange={(e) => setDesigForm({ ...desigForm, level: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                >
                  <option value="L1 - Junior Associate">L1 - Junior Associate</option>
                  <option value="L2 - Mid Contributor">L2 - Mid Contributor</option>
                  <option value="L3 - Senior Professional">L3 - Senior Professional</option>
                  <option value="L4 - Lead / Specialist">L4 - Lead / Specialist</option>
                  <option value="L5 - Manager / Director">L5 - Manager / Director</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={desigForm.description}
                  onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })}
                  placeholder="Key responsibilities and qualifications..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-hrms-border">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded border text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-hrms-primary text-white text-xs font-bold cursor-pointer">Save Designation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM ASSIGNMENT MODAL */}
      {modalType === 'assignment' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-hrms-border w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-hrms-border bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-hrms-primary">
                Assign Team Lead or Manager to Teams
              </h4>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveAssignment} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Select Employee *</label>
                <select
                  value={assignmentForm.employeeId}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, employeeId: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees
                    .filter((e) => e.status === 'Active' || e.status === 'Probation')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.id} • {e.department} • {e.designation})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Leadership Role *</label>
                  <select
                    value={assignmentForm.role}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, role: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                    required
                  >
                    <option value="team_lead">Team Lead</option>
                    <option value="manager">Department / Sub-dept Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Effective Date *</label>
                  <input
                    type="date"
                    value={assignmentForm.effectiveDate}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, effectiveDate: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Assign to Teams * (Select one or multiple)
                </label>
                <div className="max-h-44 overflow-y-auto border border-hrms-border rounded p-2.5 space-y-1.5 bg-slate-50/50">
                  {safeTeams.map((t) => {
                    const isChecked = (assignmentForm.teamIds || []).includes(t.id);
                    const selEmp = safeEmployees.find((e) => e.id === assignmentForm.employeeId);
                    const isCrossDept = selEmp && selEmp.departmentId && t.departmentId !== selEmp.departmentId;
                    const activeExistingLead = assignmentForm.role === 'team_lead'
                      ? safeTeamAssignments.find((a) => a.teamId === t.id && a.role === 'team_lead' && a.status === 'Active' && a.employeeId !== assignmentForm.employeeId)
                      : null;
                    return (
                      <label key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentIds = assignmentForm.teamIds || [];
                            const newIds = e.target.checked
                              ? [...currentIds, t.id]
                              : currentIds.filter((id) => id !== t.id);
                            setAssignmentForm({ ...assignmentForm, teamIds: newIds });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-slate-800">{t.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">({t.code})</span>
                          {activeExistingLead && (
                            <span className="ml-2 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1 py-0.5 rounded font-medium">
                              Active Lead: {activeExistingLead.employeeName} ({activeExistingLead.employeeId})
                            </span>
                          )}
                          {isCrossDept && (
                            <span className="ml-2 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded font-medium">
                              Cross-Dept ({t.departmentName || t.departmentId})
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Assignment Notes / Justification</label>
                <textarea
                  rows="2"
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                  placeholder="e.g. Managing QA across Web and Mobile pods during restructuring..."
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-hrms-border"
                />
              </div>

              {(() => {
                const selEmp = safeEmployees.find((e) => e.id === assignmentForm.employeeId);
                const hasCrossDept = (assignmentForm.teamIds || []).some((tid) => {
                  const t = safeTeams.find((team) => team.id === tid);
                  return selEmp && selEmp.departmentId && t && t.departmentId !== selEmp.departmentId;
                });
                if (hasCrossDept) {
                  return (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight">
                      <strong>Cross-Department Policy Note:</strong> This assignment covers teams outside the employee department. Authorized for Super Admin / HR Admin governance.
                    </div>
                  );
                }
                return null;
              })()}

              <div className="pt-2 flex justify-end gap-2 border-t border-hrms-border">
                <button type="button" onClick={closeModal} className="px-3 py-1.5 rounded border text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-hrms-primary text-white text-xs font-bold cursor-pointer">Save Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <AppIcon name="eye" className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {viewingItem.type === 'dept' && `Department: ${viewingItem.item.name}`}
                    {viewingItem.type === 'subdept' && `Sub-Department: ${viewingItem.item.name}`}
                    {viewingItem.type === 'team' && `Team: ${viewingItem.item.name}`}
                    {viewingItem.type === 'desig' && `Designation: ${viewingItem.item.name}`}
                    {viewingItem.type === 'assignment' && `Team Assignment: ${viewingItem.item.id}`}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: {viewingItem.item.id} • Code: {viewingItem.item.code || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                  <div className="mt-0.5">
                    <StatusBadge status={viewingItem.item.status} size="sm" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Created / Effective Date</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {viewingItem.item.effectiveDate || viewingItem.item.createdDate || '2026-01-01'}
                  </span>
                </div>
              </div>

              {viewingItem.type === 'dept' && (
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Department Head:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.headName || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Description:</span>
                    <span className="text-slate-700">{viewingItem.item.description || 'No description provided.'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Active Workforce:</span>
                    <span className="font-bold text-blue-600 font-mono">{getStaffCountByDept(viewingItem.item.id)} Members</span>
                  </div>
                </div>
              )}

              {viewingItem.type === 'subdept' && (
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Parent Department:</span>
                    {(() => {
                      const parentDept = safeDepartments.find((d) => d.id === viewingItem.item.departmentId || d.code === viewingItem.item.departmentId)
                      const displayDept = parentDept ? `${parentDept.name} (${parentDept.code})` : (viewingItem.item.departmentName || viewingItem.item.departmentId || 'Unassigned')
                      return <span className="font-bold text-slate-800 text-xs">{displayDept}</span>
                    })()}
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Sub-Department Manager:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.managerName || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Description:</span>
                    <span className="text-slate-700">{viewingItem.item.description || 'No description provided.'}</span>
                  </div>
                </div>
              )}

              {viewingItem.type === 'team' && (
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Department:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.departmentName || viewingItem.item.departmentId}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Assigned Team Lead:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.teamLeadName || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Department Manager:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.managerName || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Active Team Members:</span>
                    <span className="font-bold text-blue-600 font-mono">{getStaffCountByTeam(viewingItem.item.id)} Members</span>
                  </div>
                </div>
              )}

              {viewingItem.type === 'desig' && (
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Career Level:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.level}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Department Scope:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.departmentName || 'Company-Wide'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Employees with this Title:</span>
                    <span className="font-bold text-blue-600 font-mono">{getStaffCountByDesig(viewingItem.item.id)} Staff</span>
                  </div>
                </div>
              )}

              {viewingItem.type === 'assignment' && (
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Assigned Leader:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.employeeName || viewingItem.item.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Role:</span>
                    <span className="font-bold text-blue-700 text-xs uppercase">{viewingItem.item.role === 'team_lead' ? 'Team Lead' : 'Department Manager'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Assigned Team:</span>
                    <span className="font-bold text-slate-800 text-xs">{viewingItem.item.teamName || viewingItem.item.teamId}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block">Assigned By:</span>
                    <span className="text-slate-700">{viewingItem.item.assignedBy || 'Super Admin'}</span>
                  </div>
                  {viewingItem.item.deassignReason && (
                    <div className="p-2 bg-rose-50 rounded border border-rose-100 text-rose-800">
                      <span className="font-semibold block">Deassignment Reason:</span>
                      {viewingItem.item.deassignReason}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingItem(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                  <AppIcon name="trash" className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Confirm Deletion</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This action will permanently delete this organization item.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="font-semibold text-slate-800">
                  {deletingItem.item.name || deletingItem.item.id}
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  ID: {deletingItem.item.id} {deletingItem.item.code ? `• Code: ${deletingItem.item.code}` : ''}
                </p>
              </div>

              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete this {deletingItem.type}? If there are active dependents, the operation will be safely blocked.
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <AppIcon name="trash" className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrganizationStructureTab;
