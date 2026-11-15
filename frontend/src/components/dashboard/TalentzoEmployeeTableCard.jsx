import React from 'react'
import { useNavigate } from 'react-router-dom'

export function TalentzoEmployeeTableCard() {
  const navigate = useNavigate()

  const employees = [
    {
      id: '000083',
      name: 'Laa Siemo',
      avatarBg: 'bg-amber-100 text-amber-800',
      initials: 'LS',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
      department: 'Product',
      deptBadge: 'bg-pink-50 text-pink-500 border border-pink-100',
      role: 'UI/UX Designer',
      joiningDate: 'Mar 23, 2025',
      level: 'Full-Time'
    },
    {
      id: '17216657',
      name: 'Bessie Cooper',
      avatarBg: 'bg-blue-100 text-blue-800',
      initials: 'BC',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      department: 'Developer',
      deptBadge: 'bg-cyan-50 text-cyan-600 border border-cyan-100',
      role: 'Front End Dev',
      joiningDate: 'Feb 12, 2025',
      level: 'Full-Time'
    },
    {
      id: '7184181',
      name: 'Floyd Miles',
      avatarBg: 'bg-purple-100 text-purple-800',
      initials: 'FM',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      department: 'Ops',
      deptBadge: 'bg-purple-50 text-purple-600 border border-purple-100',
      role: 'Human Resource',
      joiningDate: 'Feb 28, 2025',
      level: 'Freelance'
    },
    {
      id: '8128175',
      name: 'Jacob Jones',
      avatarBg: 'bg-emerald-100 text-emerald-800',
      initials: 'JJ',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      department: 'Developer',
      deptBadge: 'bg-cyan-50 text-cyan-600 border border-cyan-100',
      role: 'Back End Dev',
      joiningDate: 'Jan 4, 2025',
      level: 'Internship'
    }
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs text-left">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-900 tracking-tight">Employee</h2>
        <button
          type="button"
          onClick={() => navigate('/super-admin/employees')}
          className="px-2.5 py-0.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition-colors"
        >
          See details
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Department</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Joining Date</th>
              <th className="pb-2 font-medium">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                {/* Name with Avatar & ID */}
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={emp.avatarUrl}
                      alt={emp.name}
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <div className={`w-7 h-7 rounded-full ${emp.avatarBg} hidden items-center justify-center text-[10px] font-bold shrink-0`}>
                      {emp.initials}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block text-xs leading-none">{emp.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{emp.id}</span>
                    </div>
                  </div>
                </td>

                {/* Department */}
                <td className="py-2.5 pr-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${emp.deptBadge}`}>
                    {emp.department}
                  </span>
                </td>

                {/* Role */}
                <td className="py-2.5 pr-3 text-slate-700 font-medium text-xs">
                  {emp.role}
                </td>

                {/* Joining Date */}
                <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{emp.joiningDate}</span>
                  </div>
                </td>

                {/* Level */}
                <td className="py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {emp.level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TalentzoEmployeeTableCard

