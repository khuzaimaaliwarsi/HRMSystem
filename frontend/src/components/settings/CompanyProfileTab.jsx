import React, { useState, useEffect } from 'react'
import { companySettingsService } from '@/services/companySettingsService'
import { useAuth } from '@/context/useAuth'
import apiClient from '@/services/apiClient'

export function CompanyProfileTab() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [profile, setProfile] = useState(() => companySettingsService.getCompanyProfile())
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ ...profile })
  const [feedback, setFeedback] = useState(null)
  const [adminContacts, setAdminContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactsError, setContactsError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadContacts = async () => {
      setContactsLoading(true)
      setContactsError('')
      try {
        // Existing protected Portal User Management endpoint.
        const response = await apiClient.get('/admin/users')
        const accounts = Array.isArray(response)
          ? response
          : Array.isArray(response?.users) ? response.users : null
        if (!accounts) throw new Error('Unexpected portal user API response.')
        if (!cancelled) {
          setAdminContacts(accounts.filter((account) =>
            account?.isActive === true &&
            ['SUPER_ADMIN', 'HR_ADMIN'].includes(String(account.role || '').toUpperCase()) &&
            (!account.employee || String(account.employee.employmentStatus || 'ACTIVE').toUpperCase() === 'ACTIVE')
          ).sort((a, b) => {
            const priority = { SUPER_ADMIN: 0, HR_ADMIN: 1 }
            return (priority[String(a.role || '').toUpperCase()] ?? 99) -
              (priority[String(b.role || '').toUpperCase()] ?? 99)
          }))
        }
      } catch (error) {
        if (!cancelled) {
          setAdminContacts([])
          setContactsError(error?.message || 'Unable to load administrative contacts.')
        }
      } finally {
        if (!cancelled) setContactsLoading(false)
      }
    }

    if (isSuperAdmin) loadContacts()
    else {
      setContactsLoading(false)
      setContactsError('Contact directory requires authorized access.')
    }
    return () => { cancelled = true }
  }, [isSuperAdmin])

  useEffect(() => {
    return companySettingsService.subscribe(() => {
      const p = companySettingsService.getCompanyProfile()
      setProfile(p)
      setFormData({ ...p })
    })
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    try {
      const updated = companySettingsService.updateCompanyProfile(
        formData,
        { name: user?.name || user?.username || 'Unknown User', role: user?.role, id: user?.id },
        'Corporate profile and working schedule revised'
      )
      setFeedback({ type: 'success', text: `Company Profile updated successfully (Version ${updated.version}).` })
      setIsEditing(false)
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Submodule Header & Aligned Action Button — One Clean Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Company Profile &amp; General Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Corporate identity, legal entity details, branch addresses, logo, and system-wide default preferences.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => {
              setFormData({ ...profile })
              setIsEditing(true)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm self-start sm:self-auto shrink-0"
          >
            <i className="fa-solid fa-pen-to-square text-[11px]"></i>
            <span>Edit Profile &amp; Rules</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
        >
          <i
            className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-rose-600'
              }`}
          ></i>
          {feedback.text}
        </div>
      )}

      {/* Profile Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Legal & Identity */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-sm">
              <i className="fa-solid fa-building"></i>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Legal Registration &amp; Tax</h3>
              <p className="text-[11px] text-slate-400">SECP &amp; FBR Credentials</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Registration Number</span>
              <span className="font-semibold text-slate-800 font-mono">{profile.registrationNumber}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">National Tax Number (NTN)</span>
              <span className="font-semibold text-slate-800 font-mono">{profile.ntn}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Trading Title</span>
              <span className="font-semibold text-slate-800">{profile.tradingName}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Head Office Address</span>
              <span className="font-medium text-slate-700">{profile.address}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Operating Schedule & Timezone */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Working Week &amp; Shift</h3>
              <p className="text-[11px] text-slate-400">Baseline calendar metrics</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Company Timezone</span>
              <span className="font-semibold text-slate-800 font-mono flex items-center gap-1.5">
                <i className="fa-solid fa-globe text-[11px] text-indigo-500"></i>
                {profile.timezone}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Standard Shift Hours</span>
              <span className="font-semibold text-slate-800 font-mono">
                {profile.defaultShiftStart} – {profile.defaultShiftEnd} ({profile.workingHoursPerDay} hrs)
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Standard Working Days</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.workingWeekDays?.map((d) => (
                  <span key={d} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Configured Weekly Offs</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.weeklyOffDays?.map((d) => (
                  <span key={d} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Fiscal Year & Payroll Settings */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm">
              <i className="fa-solid fa-money-bill-transfer"></i>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Fiscal &amp; Payroll Schedule</h3>
              <p className="text-[11px] text-slate-400">Financial cadence</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Reporting Currency</span>
              <span className="font-semibold text-slate-800 font-mono">
                {profile.defaultCurrency} ({profile.currencySymbol})
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Corporate Fiscal Cycle</span>
              <span className="font-semibold text-slate-800 font-mono">
                July 01 – June 30 (FBR Pakistan Tax Year)
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Monthly Payroll Cutoff</span>
              <span className="font-semibold text-slate-800 font-mono">
                {profile.payrollCutoffDay}th of each calendar month
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Disbursement Scheduled</span>
              <span className="font-semibold text-slate-800 font-mono">
                {profile.payrollDisbursementDay}st of following month
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Authorized portal administrators — live PostgreSQL records, never demo profile contacts */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-900 mb-1">Authorized Administrative Contacts</h3>
        <p className="text-[11px] text-slate-400 mb-4">Active Super Admin and HR/Admin portal accounts</p>

        {contactsLoading ? (
          <p className="text-xs text-slate-500">Loading administrative contacts...</p>
        ) : contactsError ? (
          <p role="alert" className="text-xs text-rose-700">{contactsError}</p>
        ) : adminContacts.length === 0 ? (
          <p className="text-xs text-slate-500">No active administrative portal accounts found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminContacts.map((account) => {
              const employee = account.employee
              const employeeName = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim()
              const name = employeeName || account.displayName || account.username || 'Unnamed account'
              const designation = typeof employee?.designation === 'object'
                ? employee.designation?.title
                : employee?.designation
              const role = String(account.role).toUpperCase() === 'SUPER_ADMIN' ? 'Super Admin' : 'HR / Admin'
              const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
              const phone = employee?.phone || employee?.phoneNumber || account.phone || null
              return (
                <div key={account.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                    {initials || 'AD'}
                  </div>
                  <div className="text-xs min-w-0">
                    <span className="font-bold text-slate-900 block">{name}</span>
                    <span className="text-slate-500 text-[11px] block">{role}{designation ? ` / ${designation}` : ''}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-600 font-mono break-all">
                      {account.email && <span>{account.email}</span>}
                      {phone && <span>{phone}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Company Profile &amp; Operating Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">Super Admin centralized configuration update</p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={formData.registrationNumber || ''}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">National Tax Number (NTN)</label>
                  <input
                    type="text"
                    value={formData.ntn || ''}
                    onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Head Office Address</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payroll Cutoff Day</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.payrollCutoffDay || 25}
                    onChange={(e) => setFormData({ ...formData, payrollCutoffDay: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Shift Start</label>
                  <input
                    type="time"
                    value={formData.defaultShiftStart || '09:00'}
                    onChange={(e) => setFormData({ ...formData, defaultShiftStart: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Shift End</label>
                  <input
                    type="time"
                    value={formData.defaultShiftEnd || '18:00'}
                    onChange={(e) => setFormData({ ...formData, defaultShiftEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company Timezone</label>
                <select
                  value={formData.timezone || 'Asia/Karachi'}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                >
                  <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
                >
                  Save Settings &amp; Log Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyProfileTab
