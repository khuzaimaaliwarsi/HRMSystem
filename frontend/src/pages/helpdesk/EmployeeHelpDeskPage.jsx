import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/useAuth'
import helpDeskService from '@/services/helpDeskService'

import HelpDeskSummaryCards from '@/components/helpdesk/HelpDeskSummaryCards'
import TicketListTable from '@/components/helpdesk/TicketListTable'
import CreateTicketModal from '@/components/helpdesk/CreateTicketModal'
import TicketDetailModal from '@/components/helpdesk/TicketDetailModal'

export default function EmployeeHelpDeskPage() {
  const { user } = useAuth()

  // Data States
  const [kpis, setKpis] = useState({})
  const [tickets, setTickets] = useState([])
  const [categories, setCategories] = useState([])

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
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
    } catch (e) {
      console.error('Error loading categories:', e)
      setCategories([])
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

  const handleCreateTicket = async (ticketData) => {
    try {
      const created = await helpDeskService.createTicketAsync(ticketData, user)
      triggerNotice(`Your support ticket #${created.ticketId} has been saved and assigned to ${created.assignedTeamName}.`)
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
      triggerNotice('Your reply has been saved and sent to the support team.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to send reply', 'error')
    }
  }

  const handleCloseTicket = async (ticketId, feedbackData) => {
    try {
      const updated = await helpDeskService.closeTicketAsync(ticketId, feedbackData, user)
      setSelectedTicket(updated)
      triggerNotice('Thank you! Your ticket is confirmed closed and feedback was saved.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to close ticket', 'error')
    }
  }

  const handleReopenTicket = async (ticketId, reason) => {
    try {
      const updated = await helpDeskService.reopenTicketAsync(ticketId, reason, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket reopened and support team notified.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to reopen ticket', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            Employee Help Desk &amp; Support
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Submit IT support requests, HR queries, facilities tickets, and track resolution progress.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
        >
          <i className="fa-solid fa-plus"></i>
          Submit Support Ticket
        </button>
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

      {/* KPI Summary Cards */}
      <HelpDeskSummaryCards kpis={kpis} />

      {/* Tickets List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-800">My Support Tickets</h2>
            <p className="text-xs text-slate-500">Track the status of your inquiries and converse directly with support resolvers</p>
          </div>
        </div>

        <TicketListTable
          tickets={tickets}
          categories={categories}
          onViewTicket={(t) => setSelectedTicket(t)}
        />
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
          canManageSupport={false}
          onClose={() => setSelectedTicket(null)}
          onAddReply={handleAddReply}
          onCloseTicket={handleCloseTicket}
          onReopen={handleReopenTicket}
        />
      )}
    </div>
  )
}
