import React from 'react'
import { Link } from 'react-router-dom'
import { employeeService } from '@/services/employeeService'

export function RecruitmentProgressTableCard() {
  // Base initial candidates matching reference screenshot
  const initialDemoItems = [
    {
      id: 'REC-01',
      name: 'Dom Sibley',
      department: 'Devops',
      type: 'Tech interview',
      typeColor: 'text-indigo-600',
      dotColor: 'bg-indigo-600',
      avatarBg: 'bg-indigo-100 text-indigo-700'
    },
    {
      id: 'REC-02',
      name: 'Joe Root',
      department: 'UX/UI Designer',
      type: 'Resume review',
      typeColor: 'text-rose-600',
      dotColor: 'bg-rose-500',
      avatarBg: 'bg-rose-100 text-rose-700'
    },
    {
      id: 'REC-03',
      name: 'Zak Crawley',
      department: '.net developer',
      type: 'Final interview',
      typeColor: 'text-amber-600',
      dotColor: 'bg-amber-500',
      avatarBg: 'bg-amber-100 text-amber-700'
    }
  ]

  // Fetch live employees so that any newly added staff or candidate appears at the top!
  const liveEmployees = employeeService?.getEmployees?.() || []
  const newStaffAdditions = liveEmployees.slice(0, 3).map((emp) => {
    let type = 'Active Roster'
    let dotColor = 'bg-blue-600'
    let typeColor = 'text-blue-600'
    let avatarBg = 'bg-blue-100 text-blue-800'

    if (emp.employmentType === 'Probation') {
      type = 'Probation Review'
      dotColor = 'bg-amber-500'
      typeColor = 'text-amber-600'
      avatarBg = 'bg-amber-100 text-amber-800'
    } else if (emp.status === 'Active') {
      type = 'Onboarding Complete'
      dotColor = 'bg-emerald-600'
      typeColor = 'text-emerald-600'
      avatarBg = 'bg-emerald-100 text-emerald-800'
    }

    return {
      id: emp.id,
      name: emp.name,
      department: emp.department,
      type,
      typeColor,
      dotColor,
      avatarBg,
      initials: emp.initials || emp.name.slice(0, 2).toUpperCase()
    }
  })

  // Combine so newly added / updated employees appear right at the TOP!
  const displayItems = [...newStaffAdditions, ...initialDemoItems].slice(0, 4)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-[0_2px_12px_-3px_rgba(0,43,73,0.06)] hover:shadow-md transition-shadow flex flex-col justify-between text-left h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-slate-800 font-bold text-sm md:text-base tracking-tight">
            Recruitment progress
          </span>
          <Link
            to="/super-admin/recruitment"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            View All
          </Link>
        </div>

        {/* Clean Table matching reference screenshot */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-medium border-b border-slate-100 pb-2">
                <th className="pb-3 font-semibold text-slate-500">Full Name</th>
                <th className="pb-3 font-semibold text-slate-500">Department</th>
                <th className="pb-3 font-semibold text-slate-500">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Avatar + Full Name */}
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${item.avatarBg}`}
                      >
                        {item.initials || item.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-bold text-slate-800 truncate max-w-[120px] sm:max-w-[160px]">
                        {item.name}
                      </span>
                    </div>
                  </td>

                  {/* Department */}
                  <td className="py-3 px-2 text-slate-500 font-medium truncate max-w-[100px] sm:max-w-[140px]">
                    {item.department}
                  </td>

                  {/* Type / Stage with Colored Dot */}
                  <td className="py-3 pl-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0`} />
                      <span className={`font-semibold text-xs ${item.typeColor}`}>
                        {item.type}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-50 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Latest updates shown at top</span>
        <span className="text-blue-600 font-medium">Real-time sync</span>
      </div>
    </div>
  )
}

export default RecruitmentProgressTableCard
