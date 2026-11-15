import React, { useState } from 'react';
import taxService from '../../services/taxService';

export default function TaxSlabTable() {
  const [calculatorMonthly, setCalculatorMonthly] = useState('');
  const taxConfig = taxService.getTaxConfig();
  const slabs = taxConfig.slabs || [];

  const calculated = taxService.calculateMonthlyTax({
    projectedMonthlyTaxable: Number(calculatorMonthly) || 0,
    monthIndexInYear: 1,
  });

  return (
    <div className="space-y-6">
      {/* Policy Header */}
      <div className="bg-gradient-to-r from-navy-950 to-navy-900 text-white p-5 rounded-xl border border-navy-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                Tax Configuration — Verification Pending
              </span>
              <span className="text-xs text-slate-300">Section 149 Withholding Tax</span>
            </div>
            <h3 className="text-lg font-bold mt-1">Pakistan Salary Income Tax (Tax Year {taxConfig.taxYear})</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Salaried individuals withholding tax rates under Division I, Part I, First Schedule of the Income Tax Ordinance 2001.
              Effective: {taxConfig.effectiveFrom} to {taxConfig.effectiveTo}. Tax exemptions must be verified against applicable FBR rules.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://fbr.gov.pk/withholding-taxes-rate-card/174298/174301"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
              FBR Rate Card
            </a>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Slabs Table & Live Tax Estimator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Slabs Table */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h4 className="text-sm font-bold text-navy-950">Active Tax Slabs Master</h4>
              <p className="text-xs text-slate-500">Progressive bracket taxation on annualized taxable salary</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {slabs.length} Progressive Brackets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-4">Bracket</th>
                  <th className="py-2.5 px-4">Annual Income Range (PKR)</th>
                  <th className="py-2.5 px-4">Base Tax</th>
                  <th className="py-2.5 px-4">Excess Rate</th>
                  <th className="py-2.5 px-4">Monthly Equivalent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slabs.map((slab) => {
                  const minMonthly = Math.round(slab.min / 12);
                  const maxMonthly = slab.max ? Math.round(slab.max / 12) : null;
                  return (
                    <tr key={slab.slabNumber} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-navy-900">
                        Slab {slab.slabNumber}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {slab.min.toLocaleString()} — {slab.max ? slab.max.toLocaleString() : 'Above'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {slab.baseTax > 0 ? `PKR ${slab.baseTax.toLocaleString()}` : '0'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded font-bold ${slab.ratePercent === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : slab.ratePercent >= 25
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}>
                          {slab.ratePercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        PKR {minMonthly.toLocaleString()} {maxMonthly ? `to ${maxMonthly.toLocaleString()}` : '+'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Tax Estimator Card */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-navy-950 text-white flex items-center justify-center text-sm">
              <i className="fa-solid fa-calculator"></i>
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy-950">Live Salary Tax Calculator</h4>
              <p className="text-xs text-slate-500">Section 149 Withholding Simulation</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monthly Taxable Salary (PKR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">PKR</span>
              <input
                type="number"
                step="5000"
                min="0"
                value={calculatorMonthly}
                onChange={(e) => {
                  const value = e.target.value;
                  setCalculatorMonthly(value === '' ? '' : Math.max(0, Number(value)));
                }}
                className="w-full text-sm font-semibold border border-slate-300 rounded-lg pl-12 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-600 font-mono"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[50000, 100000, 150000, 250000, 400000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCalculatorMonthly(preset)}
                  className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors font-mono"
                >
                  {(preset / 1000)}k
                </button>
              ))}
            </div>
          </div>

          {/* Breakdown cards */}

          {calculatorMonthly !== '' && Number(calculatorMonthly) > 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Annualized Taxable Salary:</span>
                <span className="font-mono font-bold text-slate-900">
                  PKR {calculated.annualTaxableIncome.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Applicable Tax Bracket:</span>
                <span className="font-bold text-navy-900">
                  Slab {calculated.slabNumber} ({calculated.slabRate}%)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Annual Estimated Liability:</span>
                <span className="font-mono font-bold text-rose-700">
                  PKR {calculated.annualTaxLiability.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Effective Tax Rate:</span>
                <span className="font-bold text-slate-800">
                  {calculated.effectiveTaxRate}%
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-navy-950">Monthly Tax Withholding:</span>
                <span className="text-base font-extrabold text-rose-600 font-mono">
                  PKR {calculated.monthlyTaxWithheld.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-500 text-center">
              Enter monthly taxable salary to calculate estimated tax.
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-amber-600 mt-0.5"></i>
            <div>
              <strong>Audit Note:</strong> This calculator is an estimate based on the current configured slabs. Confirm the applicable tax-year rates and actual payroll deductions before processing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
