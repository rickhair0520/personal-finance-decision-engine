"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import RetirementChart from "@/components/charts/RetirementChart";
import { api, RetirementData, isLoggedIn } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

export default function RetirementPage() {
  const router = useRouter();
  const [data, setData] = useState<RetirementData | null>(null);
  const [retirementAge, setRetirementAge] = useState(65);
  const [contribution, setContribution] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchData = useCallback(
    async (age: number, contrib: number | null) => {
      const params: { retirement_age?: number; monthly_contribution?: number } = {
        retirement_age: age,
      };
      if (contrib !== null) params.monthly_contribution = contrib;
      const d = await api.retirement.get(params);
      setData(d);
    },
    []
  );

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/auth/login"); return; }
    api.retirement.get().then((d) => {
      setData(d);
      setRetirementAge(d.retirement_age);
      setContribution(d.default_contribution);
    }).finally(() => setLoading(false));
  }, [router]);

  function onAgeChange(age: number) {
    setRetirementAge(age);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(age, contribution), 200);
  }

  function onContribChange(val: number) {
    setContribution(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(retirementAge, val), 400);
  }

  if (loading || !data) return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    </div>
  );

  const displayContrib = contribution ?? data.default_contribution;

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {data.is_example && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Showing example data. Complete your profile to see your real numbers.
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-8">Retirement Planner</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retirement Age: <span className="text-indigo-600 font-bold text-lg">{retirementAge}</span>
                </label>
                <input
                  type="range"
                  min={55}
                  max={75}
                  value={retirementAge}
                  onChange={(e) => onAgeChange(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Age 55</span><span>Age 75</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={displayContrib}
                      onChange={(e) => onContribChange(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Age</label>
                  <input
                    type="number"
                    value={data.current_age}
                    disabled
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
                  />
                </div>
              </div>
            </div>

            <RetirementChart
              data={data.chart}
              targetBalance={data.target_balance}
              retirementAge={retirementAge}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                Projected Balance
              </p>
              <p className="text-2xl font-bold text-gray-900">{fmt$$(data.projected_balance)}</p>
              <p className="text-sm text-gray-500">at age {retirementAge}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                Monthly Income (4% Rule)
              </p>
              <p className="text-2xl font-bold text-gray-900">{fmt$$(data.estimated_monthly_income)}</p>
              <p className="text-xs text-gray-400">4% withdrawal / 12</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                25× Expense Target
              </p>
              <p className="text-lg font-semibold text-gray-700">{fmt$$(data.target_balance)}</p>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                    data.on_track
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {data.on_track ? "On Track" : `Behind by ${fmt$$(data.shortfall)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          7% annual return assumed. Target = 25× annual expenses. Not financial advice.
        </p>
      </main>
    </div>
  );
}
