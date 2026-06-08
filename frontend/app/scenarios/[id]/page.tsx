"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/ui/Nav";
import RiskBadge from "@/components/ui/RiskBadge";
import BreakEvenChart from "@/components/charts/BreakEvenChart";
import { api, ScenarioDetail, isLoggedIn } from "@/lib/api";
import { fmt$$, fmtPct, addMonths } from "@/lib/utils";

function Row({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">
        {value}
        {delta && <span className="ml-2 text-xs text-gray-500">{delta}</span>}
      </span>
    </div>
  );
}

function ScopeChangeTool({ scenarioId, originalResult }: {
  scenarioId: string;
  originalResult: ScenarioDetail["result"];
}) {
  const [increase, setIncrease] = useState(50000);
  const [months, setMonths] = useState(Math.floor((originalResult.phase1.duration_months) / 2));
  const [result, setResult] = useState<ScenarioDetail["scope_changes"][0] | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    try {
      const r = await api.scenarios.addScopeChange(scenarioId, {
        scope_increase: increase,
        months_remaining: months,
      });
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Cost</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={increase}
              onChange={(e) => setIncrease(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Months Remaining: <span className="text-indigo-600">{months}</span>
          </label>
          <input
            type="range"
            min={1}
            max={originalResult.phase1.duration_months}
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="w-full accent-indigo-600 mt-2"
          />
        </div>
      </div>
      <button
        onClick={calculate}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Calculating…" : "Calculate Impact"}
      </button>

      {result && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium"></th>
                <th className="text-right py-2 text-gray-700 font-semibold">Original Plan</th>
                <th className="text-right py-2 text-indigo-700 font-semibold">With +{fmt$$(increase)}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">Permanent Loan</td>
                <td className="py-2 text-right font-medium">{fmt$$(originalResult.loan_amount)}</td>
                <td className="py-2 text-right font-medium text-indigo-700">{fmt$$(result.result.new_loan_amount)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">Monthly Payment</td>
                <td className="py-2 text-right font-medium">{fmt$$(originalResult.phase2.monthly_payment)}</td>
                <td className="py-2 text-right font-medium text-indigo-700">{fmt$$(result.result.new_monthly_payment)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">Payment Increase</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right font-semibold text-red-600">+{fmt$$(result.result.monthly_payment_increase)}/mo</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Extra Construction Interest</td>
                <td className="py-2 text-right text-gray-400">—</td>
                <td className="py-2 text-right font-medium text-red-600">{fmt$$(result.result.additional_construction_interest)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ScenarioResultsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScopeChange, setShowScopeChange] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/auth/login"); return; }
    if (!id) return;
    api.scenarios.get(id).then(setScenario).catch(() => router.push("/scenarios/new")).finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    </div>
  );
  if (!scenario) return null;

  const r = scenario.result;
  const inputs = scenario.inputs as Record<string, number>;
  const monthlyBenefit =
    r.total_project_cost * ((inputs.home_appreciation_rate || 0.04) / 12) +
    Math.max(0, (inputs.existing_monthly_mortgage || 0) - r.phase2.monthly_payment);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{scenario.name}</h1>
            <p className="text-sm text-gray-500">{new Date(scenario.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <RiskBadge flag={r.risk_flag} />
            <Link href="/scenarios/new" className="text-sm text-indigo-600 hover:underline">
              Try Different Numbers
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">Phase 1 — Build</span>
              <span className="text-sm text-gray-500">{r.phase1.duration_months} months</span>
            </div>
            <Row label="Monthly Construction Interest" value={fmt$$(r.phase1.monthly_construction_interest)} />
            <Row label="Total Monthly Carry" value={fmt$$(r.phase1.monthly_carry_total)} delta="(incl. existing mortgage)" />
            <Row label="Extra Cost vs. Today" value={`+${fmt$$(r.phase1.monthly_cashflow_delta)}/mo`} />
            <Row label="Savings Rate During Build" value={fmtPct(r.phase1.savings_rate)} />
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total Cash Out</span>
                <span className="text-lg font-bold text-red-600">{fmt$$(r.phase1.total_cash_out)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Down payment + carry costs over build period</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">Phase 2 — Permanent</span>
            </div>
            <Row label="Monthly Payment" value={fmt$$(r.phase2.monthly_payment)} />
            <Row
              label="Net Change vs. Today"
              value={(r.phase2.net_delta_vs_today >= 0 ? "+" : "") + fmt$$(r.phase2.net_delta_vs_today) + "/mo"}
            />
            <Row label="New Monthly Cash Flow" value={fmt$$(r.phase2.monthly_cashflow)} />
            <Row label="New Savings Rate" value={fmtPct(r.phase2.savings_rate)} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Retirement Impact</h2>
            <Row label="Without Build" value={fmt$$(r.retirement.baseline_fv)} />
            <Row label="With This Build" value={fmt$$(r.retirement.scenario_fv)} />
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Retirement Balance Impact</span>
                <span className="text-lg font-bold text-red-600">-{fmt$$(r.retirement.dollar_impact)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {r.retirement.shift_years < 0.5
                  ? "No material timeline impact"
                  : `≈ ${r.retirement.shift_years.toFixed(1)} year${r.retirement.shift_years !== 1 ? "s" : ""} later retirement`}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Break-Even Timeline</h2>
            {r.break_even_months ? (
              <>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  Month {r.break_even_months} — {addMonths(r.phase1.duration_months + r.break_even_months)}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  You come out ahead after {r.break_even_months} months post-occupancy
                </p>
                <BreakEvenChart
                  totalCashOut={r.phase1.total_cash_out}
                  monthlyBenefit={monthlyBenefit}
                  breakEvenMonths={r.break_even_months}
                />
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Break-even could not be calculated. Monthly benefit may not exceed cost basis — review your scenario inputs.
              </p>
            )}
          </div>
        </div>

        {/* Scope change */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <button
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-indigo-600"
            onClick={() => setShowScopeChange(!showScopeChange)}
          >
            <span>What if costs increase? — Scope Change Tool</span>
            <span>{showScopeChange ? "▲" : "▼"}</span>
          </button>
          {showScopeChange && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <ScopeChangeTool scenarioId={scenario.id} originalResult={r} />
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Construction draw modeled as linear. Does not include property taxes, HOA, or insurance. Not financial advice.
        </p>
      </main>
    </div>
  );
}
