import React, { useState, useEffect } from 'react';
import { employeeService } from '../../services/employeeService';
import kpiService from '../../services/kpiService';

export default function KpiListTable({ kpis = [], onAddKpi, canManage = true }) {
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedCycle, setSelectedCycle] = useState('ALL');

  const [departments, setDepartments] = useState(
    () => employeeService.getDepartments() || []
  );

  const selectedDeptObj = departments.find(
    (d) => d.id === selectedDept || d.code === selectedDept
  );

  const filteredKpis = kpis.filter((k) => {
    if (selectedDept !== 'ALL') {
      const deptMatch =
        k.departmentId === selectedDept ||
        (selectedDeptObj &&
          (k.departmentId === selectedDeptObj.id ||
            k.departmentId === selectedDeptObj.code ||
            k.department === selectedDeptObj.name));
      if (!deptMatch) return false;
    }
    if (
      selectedCycle !== 'ALL' &&
      String(k.reviewCycle || '').toLowerCase() !== selectedCycle.toLowerCase()
    ) {
      return false;
    }
    return true;
  });


  useEffect(() => {
    const refreshDepartments = () => {
      setDepartments([...(employeeService.getDepartments() || [])]);
    };

    refreshDepartments();

    return employeeService.subscribe(refreshDepartments);
  }, []);

  useEffect(() => {
    kpiService.loadKpis().catch((err) => {
      console.error('KPI database load failed:', err);
    });
  }, []);

  return (

    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Department</label>


            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Departments</option>

              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                  {String(dept.status || '').toUpperCase() === 'INACTIVE'
                    ? ' (Inactive)'
                    : ''}
                </option>
              ))}
            </select>


          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Review Cycle</label>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Cycles</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
            </select>
          </div>
        </div>

        {canManage && (
          <button
            onClick={onAddKpi}
            className="px-3.5 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-lg shadow-sm flex items-center gap-2 self-start sm:self-center"
          >
            <i className="fa-solid fa-plus"></i>
            Configure New KPI
          </button>
        )}
      </div>

      {/* KPI Cards / Table Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">KPI Metric Name & Description</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Measurement Type</th>
                <th className="py-2.5 px-4">Target Benchmark</th>
                <th className="py-2.5 px-4 text-center">Weight</th>
                <th className="py-2.5 px-4">Cycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKpis.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No KPIs found for the selected department.
                  </td>
                </tr>
              ) : (
                filteredKpis.map((kpi) => (
                  <tr key={kpi.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy-950">
                      {kpi.code}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-bold text-slate-900">{kpi.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{kpi.description}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{kpi.department}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                        {kpi.metricType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-navy-900">
                      {kpi.metricType === 'Percentage'
                        ? `${kpi.targetValue}%`
                        : kpi.metricType === 'Numeric (PKR)'
                          ? `PKR ${kpi.targetValue.toLocaleString()}`
                          : kpi.metricType === 'Rating (1-5)'
                            ? `${kpi.targetValue} / 5.0`
                            : kpi.targetValue}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                        {kpi.weightPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {kpi.reviewCycle}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
