import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import helpDeskService from '@/services/helpDeskService'
import employeeService from '@/services/employeeService'

import HelpDeskSummaryCards from '@/components/helpdesk/HelpDeskSummaryCards'
import TicketListTable from '@/components/helpdesk/TicketListTable'
import CreateTicketModal from '@/components/helpdesk/CreateTicketModal'
import TicketDetailModal from '@/components/helpdesk/TicketDetailModal'
import TicketCategoriesModal from '@/components/helpdesk/TicketCategoriesModal'
import HelpDeskAnalyticsView from '@/components/helpdesk/HelpDeskAnalyticsView'

export default function SuperAdminHelpDeskPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'all-tickets')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Master Data States
  const [kpis, setKpis] = useState({})
  const [tickets, setTickets] = useState([])
  const [categories, setCategories] = useState([])
  const [teams, setTeams] = useState([])
  const [slaTargets, setSlaTargets] = useState({})
  const [employees, setEmployees] = useState([])

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [actionNotice, setActionNotice] = useState(null)

  const loadData = useCallback(() => {
    try {
      setKpis(helpDeskService.getHelpDeskKPIs(user) || {})
    } catch (e) {
      console.error('Error loading help desk KPIs:', e)
      setKpis({})
    }
    try {
      const freshTickets = helpDeskService.getTickets({}, user) || []
      setTickets(freshTickets)
      setSelectedTicket((prev) =>
        prev ? freshTickets.find((t) => t.id === prev.id || t.ticketId === prev.ticketId) || prev : null
      )
    } catch (e) {
      console.error('Error loading tickets:', e)
      setTickets([])
    }
    try {
      setCategories(helpDeskService.getCategories() || [])
      setTeams(helpDeskService.getSupportTeams() || [])
      setSlaTargets(helpDeskService.getSLATargets() || {})
      setEmployees(
        (employeeService.getAllEmployees() || []).filter(
          (emp) => String(emp.status || emp.employmentStatus || '').toUpperCase() === 'ACTIVE'
        )
      )
    } catch (e) {
      console.error('Error loading help desk metadata:', e)
    }
  }, [user])

  useEffect(() => {
    let mounted = true
    loadData()

    helpDeskService
      .loadHelpDeskDataAsync()
      .then(() => {
        if (mounted) loadData()
      })
      .catch((err) => {
        if (mounted) {
          setActionNotice({ msg: err.message || 'Failed to load help desk tickets.', type: 'error' })
        }
      })

    const unsubscribe = helpDeskService.subscribe(() => {
      if (mounted) loadData()
    })

    return () => {
      mounted = false
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [loadData])

  const triggerNotice = (msg, type = 'success') => {
    setActionNotice({ msg, type })
    setTimeout(() => setActionNotice(null), 4000)
  }

  // Action Handlers (PostgreSQL-backed)
  const handleCreateTicket = async (ticketData) => {
    try {
      const created = await helpDeskService.createTicketAsync(ticketData, user)
      triggerNotice(`Support ticket #${created.ticketId} saved to database and routed to ${created.assignedTeamName}.`)
      setIsCreateModalOpen(false)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to submit ticket', 'error')
      throw err
    }
  }

  const handleAddReply = async (ticketId, replyData) => {
    try {
      const updated = await helpDeskService.addReplyAsync(ticketId, replyData, user)
      setSelectedTicket(updated)
      triggerNotice(replyData.isInternalNote ? 'Internal support note saved.' : 'Reply sent and saved.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to send reply', 'error')
    }
  }

  const handleAssignTicket = async (ticketId, assignmentData) => {
    try {
      const updated = await helpDeskService.assignTicketAsync(ticketId, assignmentData, user)
      setSelectedTicket(updated)
      triggerNotice(`Ticket assigned to ${updated.assignedResolverName}.`)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to assign ticket', 'error')
    }
  }

  const handleEscalateTicket = async (ticketId, reason) => {
    try {
      const updated = await helpDeskService.escalateTicketAsync(ticketId, reason, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket escalated to High/Critical SLA queue.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to escalate ticket', 'error')
    }
  }

  const handleUpdateStatus = async (ticketId, status) => {
    try {
      const updated = await helpDeskService.updateStatusAsync(ticketId, status)
      setSelectedTicket(updated)
      triggerNotice(`Ticket status updated to ${updated.status}.`)
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to update ticket status', 'error')
    }
  }

  const handleResolveTicket = async (ticketId, resolutionData) => {
    try {
      const updated = await helpDeskService.resolveTicketAsync(ticketId, resolutionData, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket marked as Resolved and persisted.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to resolve ticket', 'error')
    }
  }

  const handleCloseTicket = async (ticketId, feedbackData) => {
    try {
      const updated = await helpDeskService.closeTicketAsync(ticketId, feedbackData, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket confirmed closed and feedback recorded.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to close ticket', 'error')
    }
  }

  const handleReopenTicket = async (ticketId, reason) => {
    try {
      const updated = await helpDeskService.reopenTicketAsync(ticketId, reason, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket reopened and returned to active support queue.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to reopen ticket', 'error')
    }
  }

  const myTickets = tickets.filter((t) => helpDeskService.isTicketOwner(t, user))
  const escalatedTickets = tickets.filter((t) => t.isEscalated || t.priority === 'Critical')
  const breachedTickets = tickets.filter((t) => t.isSlaBreached)

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'escalations'
              ? 'Ticket Assignment & Escalations'
              : activeTab === 'sla-breaches'
              ? 'SLA & Resolution Management'
              : activeTab === 'my-tickets'
              ? 'My Submitted Tickets'
              : activeTab === 'analytics'
              ? 'Ticket History, Feedback & Analytics'
              : 'Help Desk Overview & Company-Wide Tickets'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'escalations'
              ? 'Assign support resolvers, route queues, and oversee critical escalations requiring senior attention.'
              : activeTab === 'sla-breaches'
              ? 'Monitoring service level agreement breaches, overdue tickets, and resolution compliance.'
              : activeTab === 'my-tickets'
              ? 'Personal inquiries, issue tracking, and internal technical requests submitted by you.'
              : activeTab === 'analytics'
              ? 'High-level support performance metrics, CSAT satisfaction feedback, and resolved ticket history.'
              : 'Enterprise help desk ticketing queue, assignment controls, and issue resolution lifecycle.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition flex items-center gap-2"
          >
            <i className="fa-solid fa-sitemap"></i>
            Teams &amp; SLA Policy
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-plus"></i>
            Create Ticket
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center justify-between transition-all ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i className={`fa-solid ${actionNotice.type === 'error' ? 'fa-circle-exclamation text-rose-600' : 'fa-circle-check text-emerald-600'}`}></i>
            <span>{actionNotice.msg}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Operational KPI Summary Cards */}
      <HelpDeskSummaryCards kpis={kpis} />

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        {activeTab === 'all-tickets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">All Company Service Inquiries</h2>
                <p className="text-xs text-slate-500">Comprehensive overview of IT, HR, Payroll, and Administrative tickets</p>
              </div>
            </div>
            <TicketListTable
              tickets={tickets}
              categories={categories}
              onViewTicket={(t) => setSelectedTicket(t)}
            />
          </div>
        )}

        {activeTab === 'escalations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Unassigned Queue &amp; Escalated Cases</h2>
                <p className="text-xs text-slate-500">High-priority, unassigned, and executive-escalated support cases</p>
              </div>
            </div>
            <TicketListTable
              tickets={tickets.filter((t) => !t.assignedResolverName || escalatedTickets.some((e) => e.id === t.id))}
              categories={categories}
              onViewTicket={(t) => setSelectedTicket(t)}
            />
          </div>
        )}

        {activeTab === 'sla-breaches' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">SLA Breaches &amp; Active Resolution Queue</h2>
                <p className="text-xs text-slate-500">
                  {breachedTickets.length > 0
                    ? `${breachedTickets.length} breached ticket(s) highlighted alongside active SLA targets`
                    : 'No breached tickets right now — showing active tickets requiring SLA resolution'}
                </p>
              </div>
            </div>
            <TicketListTable
              tickets={breachedTickets.length > 0 ? breachedTickets : tickets.filter((t) => t.status !== 'Closed')}
              categories={categories}
              onViewTicket={(t) => setSelectedTicket(t)}
            />
          </div>
        )}

        {activeTab === 'my-tickets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">My Personal Service Requests</h2>
                <p className="text-xs text-slate-500">Inquiries submitted by your account</p>
              </div>
            </div>
            <TicketListTable
              tickets={myTickets}
              categories={categories}
              onViewTicket={(t) => setSelectedTicket(t)}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <HelpDeskAnalyticsView kpis={kpis} tickets={tickets} />
        )}
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateTicketModal
          categories={categories}
          currentUser={user}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateTicket}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          currentUser={user}
          canManageSupport={true}
          employees={employees}
          teams={teams}
          onClose={() => setSelectedTicket(null)}
          onAddReply={handleAddReply}
          onAssign={handleAssignTicket}
          onEscalate={handleEscalateTicket}
          onUpdateStatus={handleUpdateStatus}
          onResolve={handleResolveTicket}
          onCloseTicket={handleCloseTicket}
          onReopen={handleReopenTicket}
        />
      )}

      {isCategoriesModalOpen && (
        <TicketCategoriesModal
          categories={categories}
          teams={teams}
          slaTargets={slaTargets}
          onClose={() => setIsCategoriesModalOpen(false)}
        />
      )}
    </div>
  )
}
