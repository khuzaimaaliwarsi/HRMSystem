import React, { useState } from 'react'
import AppIcon from '@/components/common/AppIcon'

export default function TransportRoutesTable({
  routes = [],
  currentUser = null,
  onEditRoute
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const isHRorSuper =
    currentUser?.role === 'super_admin' || currentUser?.role === 'hr_admin'

  const filteredRoutes = routes.filter((r) => {
    return (
      r.routeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.routeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.assignedVehicleName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.assignedDriverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.pickupPoints?.some((pt) => pt.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative">
          <AppIcon
            name="search"
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder="Search route name, stop, driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-72 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredRoutes.length} of {routes.length} active routes
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Route ID & Name</th>
              <th className="py-3 px-4">Designated Stops / Landmarks</th>
              <th className="py-3 px-4">Departure Schedules</th>
              <th className="py-3 px-4">Assigned Vehicle</th>
              <th className="py-3 px-4">Driver & Contact</th>
              <th className="py-3 px-4">Capacity Utilization</th>
              <th className="py-3 px-4">Status</th>
              {isHRorSuper && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRoutes.length === 0 ? (
              <tr>
                <td colSpan={isHRorSuper ? 8 : 7} className="py-8 text-center text-slate-400">
                  <AppIcon name="bus" className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No transport routes matching criteria.
                </td>
              </tr>
            ) : (
              filteredRoutes.map((route) => {
                const assigned = route.assignedCount || 0
                const capacity = route.capacity || 14
                const pct = Math.min(Math.round((assigned / capacity) * 100), 100)
                const isFull = assigned >= capacity

                return (
                  <tr key={route.routeId || route.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{route.routeName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{route.routeId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {route.pickupPoints?.slice(0, 3).map((pt, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded"
                          >
                            {pt}
                          </span>
                        ))}
                        {route.pickupPoints?.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            +{(route.pickupPoints || []).length - 3} more
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Terminus: {route.dropPoint || 'iSysware HQ Tech Park'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        Morning: {route.morningDepartureTime || '07:30 AM'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Evening: {route.eveningDepartureTime || '06:15 PM'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{route.assignedVehicleName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {route.assignedVehicleId}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{route.assignedDriverName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {route.assignedDriverId}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                        <span className={isFull ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                          {assigned} / {capacity} seats
                        </span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                      <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isFull
                              ? 'bg-rose-500'
                              : pct > 75
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          route.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {route.status}
                      </span>
                    </td>
                    {isHRorSuper && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onEditRoute && onEditRoute(route)}
                          title="Edit Route & Vehicles"
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <AppIcon name="edit" className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
