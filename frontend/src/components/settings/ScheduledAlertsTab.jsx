import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { scheduledAlertService } from '@/services/scheduledAlertService'
import { useAuth } from '@/context/useAuth'

export function ScheduledAlertsTab() {
  const { user } = useAuth()
  const roleLower = String(user?.role || '').toLowerCase()
  const backendRoleLower = String(user?.backendRole || '').toLowerCase()
  const isHrOrSuper =
    ['super_admin', 'superadmin', 'hr_admin', 'hradmin'].includes(roleLower) ||
    ['super_admin', 'superadmin', 'hr_admin', 'hradmin'].includes(backendRoleLower)

  const [rules, setRules] = useState(() => scheduledAlertService.getAlertRules())
  const [notifications, setNotifications] = useState(() => scheduledAlertService.getNotificationsForUser(user))
  const [activeSubTab, setActiveSubTab] = useState('rules') // 'rules', 'notifications'
  const [previewRule, setPreviewRule] = useState(null)
  const [previewEntities, setPreviewEntities] = useState([])
  const [previewRecipients, setPreviewRecipients] = useState([])
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    return scheduledAlertService.subscribe(() => {
      setRules(scheduledAlertService.getAlertRules())
      setNotifications(scheduledAlertService.getNotificationsForUser(user))
    })
  }, [user])

  const handleToggleRule = (ruleId, currentEnabled) => {
    if (!isHrOrSuper) return
    try {
      scheduledAlertService.toggleAlertRule(ruleId, !currentEnabled, {
        name: user?.name || 'Tariq Mehmood',
        role: user?.role || 'super_admin',
        id: user?.id || 'EMP-001'
      })
      setFeedback({ type: 'success', text: `Rule ${ruleId} status updated.` })
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleOpenPreview = (rule) => {
    setPreviewRule(rule)
    const results = scheduledAlertService.previewTriggerResults(rule.id)
    const recips = scheduledAlertService.previewRecipients(rule.id)
    setPreviewEntities(Array.isArray(results) ? results : [])
    setPreviewRecipients(Array.isArray(recips) ? recips : [])
  }

  const handleMarkAsRead = (id) => {
    scheduledAlertService.markAsRead(id)
  }

  const handleMarkAllAsRead = () => {
    scheduledAlertService.markAllAsRead(user)
  }

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header & Aligned Switcher — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Scheduled Alerts &amp; Notification Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-cutting trigger monitor for birthdays, probation due, contract expiries, SLA breaches, and approval reminders.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('rules')}
            className={`px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'rules' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Alert Rules ({(rules || []).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('notifications')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeSubTab === 'notifications'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>In-App Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Critical Frontend Architecture Notice */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs flex items-start gap-3">
        <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 text-sm"></i>
        <div>
          <span className="font-bold text-amber-900 block">Frontend Demonstration Architecture Notice</span>
          <p className="text-amber-800 text-[11px] mt-0.5">
            This module evaluates alert triggers deterministically in client-side memory for pair-programming and UI evaluation.
            It does not claim background execution when the browser tab is closed. The persistent cron scheduler, retry queues,
            and SMTP / Twilio SMS delivery engines will be implemented on the Namecheap production backend.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <i
            className={`fa-solid ${
              feedback.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-rose-600'
            }`}
          ></i>
          {feedback.text}
        </div>
      )}

      {/* TAB 1: Alert Rules Registry */}
      {activeSubTab === 'rules' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Alert Name &amp; Code</th>
                  <th className="py-3 px-3">Trigger Event</th>
                  <th className="py-3 px-3">Schedule &amp; Lead Time</th>
                  <th className="py-3 px-3">Target Scope</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => {
                  const isUrgent = rule.priority === 'Urgent'
                  const isHigh = rule.priority === 'High'

                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{rule.id}</span>
                          <span className="font-semibold text-slate-800">{rule.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{rule.description}</p>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {rule.triggerEvent}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">{rule.schedule}</span>
                        <span className="text-[10px] text-slate-400">
                          {rule.daysBefore > 0 ? `${rule.daysBefore} days prior` : 'Same day'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {rule.recipientRole}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isUrgent
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isHigh
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {rule.priority}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          disabled={!isHrOrSuper}
                          onClick={() => handleToggleRule(rule.id, rule.enabled)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                            rule.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                          } ${!isHrOrSuper ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              rule.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenPreview(rule)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <i className="fa-solid fa-magnifying-glass-chart text-[10px] mr-1"></i>
                          Preview
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Live In-App Notifications Feed */}
      {activeSubTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Notifications Scoped to Your Session</h3>
              <p className="text-[11px] text-slate-400">
                Viewing alerts for {user?.name} ({user?.roleLabel || user?.role})
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Mark All as Read
              </button>
            )}
          </div>

          {(!notifications || notifications.length === 0) ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <i className="fa-solid fa-bell-slash text-2xl mb-2 block"></i>
              No pending notifications for this portal account.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`py-3.5 flex items-start justify-between gap-4 transition ${
                    !notif.isRead ? 'bg-blue-50/30 px-3 rounded-xl' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                        notif.priority === 'Urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : notif.priority === 'High'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <i className="fa-solid fa-bell"></i>
                    </div>

                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{notif.title}</span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 block"></span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">{notif.createdAt}</span>
                      </div>
                      <p className="text-slate-600 mt-1">{notif.message}</p>

                      {notif.actionUrl && (
                        <Link
                          to={notif.actionUrl}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 mt-2"
                        >
                          <span>Open Workflow</span>
                          <i className="fa-solid fa-arrow-right text-[10px]"></i>
                        </Link>
                      )}
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Alert Rule Simulation: {previewRule.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Deterministic evaluation against live workforce dataset</p>
              </div>
              <button
                onClick={() => setPreviewRule(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="font-semibold text-slate-700 block">Notification Template Preview:</span>
              <p className="font-mono text-slate-900 bg-white p-2 rounded border border-slate-200 text-[11px]">
                {previewRule.notificationTemplate}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Trigger Met Candidates</span>
              <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {(previewEntities || []).map((ent, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">{ent.targetName}</span>
                      <span className="text-[11px] text-slate-500">{ent.metric}</span>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {ent.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 block">
                Target Recipients ({(previewRecipients || []).length} Accounts Scoped)
              </span>
              <p className="text-[11px] text-slate-500">
                Delivers to role: <strong className="uppercase font-mono">{previewRule.recipientRole}</strong>
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewRule(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                Close Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScheduledAlertsTab
