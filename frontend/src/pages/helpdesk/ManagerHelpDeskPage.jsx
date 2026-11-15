import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'
import helpDeskService from '@/services/helpDeskService'

import HelpDeskSummaryCards from '@/components/helpdesk/HelpDeskSummaryCards'
import TicketListTable from '@/components/helpdesk/TicketListTable'
import CreateTicketModal from '@/components/helpdesk/CreateTicketModal'
import TicketDetailModal from '@/components/helpdesk/TicketDetailModal'

export default function ManagerHelpDeskPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => tabFromUrl || 'my-tickets')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

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
      triggerNotice(`Support ticket #${created.ticketId} saved to database successfully.`)
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
      triggerNotice('Reply posted and saved.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to send reply', 'error')
    }
  }

  const handleCloseTicket = async (ticketId, feedbackData) => {
    try {
      const updated = await helpDeskService.closeTicketAsync(ticketId, feedbackData, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket closed and feedback saved.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to close ticket', 'error')
    }
  }

  const handleReopenTicket = async (ticketId, reason) => {
    try {
      const updated = await helpDeskService.reopenTicketAsync(ticketId, reason, user)
      setSelectedTicket(updated)
      triggerNotice('Ticket reopened.')
      loadData()
    } catch (err) {
      triggerNotice(err.message || 'Failed to reopen ticket', 'error')
    }
  }

  const myTickets = tickets.filter((t) => helpDeskService.isTicketOwner(t, user))
  const departmentTickets = tickets.filter((t) => !helpDeskService.isTicketOwner(t, user))

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-hrms-primary tracking-tight">
            {activeTab === 'dept-tickets'
              ? 'Department Operational Tickets'
              : 'My Support Requests & Tickets'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'dept-tickets'
              ? 'Department operational tickets, facility requests, and team technical blockers.'
              : 'Personal support tickets, asset inquiries, and administrative requests.'}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
        >
          <i className="fa-solid fa-plus"></i>
          Submit Ticket
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

      {/* Submodule Screen (One Submodule = One Functional Screen) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        {activeTab === 'my-tickets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">My Support Requests</h2>
                <p className="text-xs text-slate-500">Tickets you have submitted for technical or administrative assistance</p>
              </div>
            </div>
            <TicketListTable
              tickets={myTickets}
              categories={categories}
              onViewTicket={(t) => setSelectedTicket(t)}
            />
          </div>
        )}

        {activeTab === 'dept-tickets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Department Operational Inquiries</h2>
                <p className="text-xs text-slate-500">Non-confidential team requests (Hardware, Software, Administrative)</p>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-blue-600"></i>
              <span>Privacy Protection Active: Direct reports' confidential HR complaints and payroll inquiries are shielded from line managers.</span>
            </div>
            <TicketListTable
              tickets={departmentTickets}
              categories={categories}
              onViewTicket={(t) => setSelectedTicket(t)}
            />
          </div>
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
