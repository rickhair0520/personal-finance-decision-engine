"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/ui/Nav";
import MetricCard from "@/components/ui/MetricCard";
import NetWorthChart from "@/components/charts/NetWorthChart";
import { api, DashboardData, isLoggedIn } from "@/lib/api";
import { fmt$$, fmtPct, healthLabel } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/auth/login"); return; }
    api.dashboard.get().then(setData).catch(() => router.push("/auth/login")).finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>;
  if (!data) return null;

  const hl = healthLabel(data.health_score);
  const cashFlowColor = data.monthly_cash_flow >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {data.is_example && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Showing example data.{" "}
            <Link href="/profile" className="font-medium underline">
              Complete your profile
            </Link>{" "}
            to see your real numbers.
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <Link
            href="/scenarios/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Model a Scenario →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Monthly Cash Flow"
            value={fmt$$(data.monthly_cash_flow)}
            color={cashFlowColor}
          />
          <MetricCard
            label="Savings Rate"
            value={fmtPct(data.savings_rate)}
            color={data.savings_rate >= 0.15 ? "text-green-600" : data.savings_rate >= 0.05 ? "text-yellow-600" : "text-red-600"}
          />
          <MetricCard
            label="Health Score"
            value={`${data.health_score}/100`}
            sub={hl.label}
            color={hl.color}
          />
          <MetricCard
            label="Net Worth"
            value={fmt$$(data.net_worth)}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Net Worth Projection</h2>
            <NetWorthChart data={data.net_worth_chart} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Retirement Outlook</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                  Projected at Retirement
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {fmt$$(data.retirement_projection.baseline_fv)}
                </p>
                <p className="text-sm text-gray-500">
                  ≈ {fmt$$(data.retirement_projection.monthly_income_estimate)}/mo income (4% rule)
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                  Target Balance
                </p>
                <p className="text-lg font-semibold text-gray-700">
                  {fmt$$(data.retirement_projection.target_balance)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                    data.retirement_projection.on_track
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {data.retirement_projection.on_track ? "On Track" : "Behind Target"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Assumptions: 7% annual return, 4% home appreciation. Not financial advice.
        </p>
      </main>
    </div>
  );
}
