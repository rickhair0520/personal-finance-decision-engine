"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import { api, isLoggedIn } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface BuildInputs {
  build_estimate: number;
  contingency_pct: number;
  down_payment_pct: number;
  construction_loan_rate: number;
  build_timeline_months: number;
  permanent_loan_rate: number;
  permanent_loan_term_years: number;
  name: string;
}

const defaults: BuildInputs = {
  build_estimate: 800000,
  contingency_pct: 15,
  down_payment_pct: 20,
  construction_loan_rate: 8.5,
  build_timeline_months: 14,
  permanent_loan_rate: 6.75,
  permanent_loan_term_years: 30,
  name: "",
};

function pmt(principal: number, annualRate: number, termYears: number) {
  if (!principal || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function NewScenarioPage() {
  const router = useRouter();
  const [inputs, setInputs] = useState<BuildInputs>(defaults);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) router.push("/auth/login");
  }, [router]);

  function set(name: keyof BuildInputs, val: string) {
    setInputs((prev) => ({ ...prev, [name]: name === "name" ? val : parseFloat(val) || 0 }));
  }

  const totalCost = inputs.build_estimate * (1 + inputs.contingency_pct / 100);
  const downPayment = totalCost * (inputs.down_payment_pct / 100);
  const loanAmount = totalCost - downPayment;
  const constructionInterest = (loanAmount / 2) * (inputs.construction_loan_rate / 100 / 12);
  const phase2Payment = pmt(loanAmount, inputs.permanent_loan_rate, inputs.permanent_loan_term_years);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const scenario = await api.scenarios.create({
        type: "custom_build",
        name: inputs.name || undefined,
        inputs: {
          build_estimate: inputs.build_estimate,
          contingency_pct: inputs.contingency_pct / 100,
          down_payment_pct: inputs.down_payment_pct / 100,
          construction_loan_rate: inputs.construction_loan_rate / 100,
          build_timeline_months: inputs.build_timeline_months,
          permanent_loan_rate: inputs.permanent_loan_rate / 100,
          permanent_loan_term_years: inputs.permanent_loan_term_years,
        },
      });
      router.push("/scenarios/" + scenario.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create scenario");
    } finally {
      setLoading(false);
    }
  }

  function inp(
    label: string,
    name: keyof BuildInputs,
    opts: { prefix?: string; suffix?: string; step?: string; min?: number; max?: number; hint?: string }
  ) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {opts.hint && <p className="text-xs text-gray-500 mb-1">{opts.hint}</p>}
        <div className="relative flex items-center">
          {opts.prefix && <span className="absolute left-3 text-sm text-gray-500">{opts.prefix}</span>}
          <input
            type="number"
            step={opts.step || "1"}
            min={opts.min}
            max={opts.max}
            value={inputs[name]}
            onChange={(e) => set(name, e.target.value)}
            className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              opts.prefix ? "pl-7 pr-3" : opts.suffix ? "pl-3 pr-7" : "px-3"
            }`}
          />
          {opts.suffix && <span className="absolute right-3 text-sm text-gray-500">{opts.suffix}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Custom Build Scenario</h1>
        <p className="text-sm text-gray-500 mb-8">Model the two-phase financial impact of your home build.</p>

        <div className="grid md:grid-cols-3 gap-8">
          <form onSubmit={submit} className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Scenario Name</h2>
              <input
                type="text"
                placeholder="e.g. Main Street Build"
                value={inputs.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Build Cost</h2>
              <div className="grid grid-cols-2 gap-4">
                {inp("Base Build Estimate", "build_estimate", { prefix: "$", hint: "Land excluded — you own it" })}
                {inp("Contingency Buffer", "contingency_pct", { suffix: "%", step: "1", min: 0, max: 50, hint: "Typically 10–20%" })}
                {inp("Down Payment", "down_payment_pct", { suffix: "%", step: "1", min: 5, max: 50 })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Construction Loan</h2>
              <div className="grid grid-cols-2 gap-4">
                {inp("Construction Loan Rate", "construction_loan_rate", { suffix: "%", step: "0.125", min: 1, max: 25 })}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Build Timeline: <span className="text-indigo-600">{inputs.build_timeline_months} months</span>
                  </label>
                  <input
                    type="range"
                    min={6}
                    max={24}
                    value={inputs.build_timeline_months}
                    onChange={(e) => set("build_timeline_months", e.target.value)}
                    className="w-full accent-indigo-600 mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>6 mo</span><span>24 mo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Permanent Loan</h2>
              <div className="grid grid-cols-2 gap-4">
                {inp("Permanent Loan Rate", "permanent_loan_rate", { suffix: "%", step: "0.125", min: 1, max: 20 })}
                {inp("Loan Term", "permanent_loan_term_years", { suffix: "yrs", min: 10, max: 30 })}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !inputs.build_estimate || !inputs.construction_loan_rate || !inputs.permanent_loan_rate}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Analyze Full Impact →"}
            </button>
          </form>

          {/* Live preview */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
              <h2 className="font-semibold text-gray-700 mb-4 text-sm">Live Preview</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Project Cost</p>
                  <p className="text-xl font-bold text-gray-900">{fmt$$(totalCost)}</p>
                  <p className="text-xs text-gray-400">incl. {inputs.contingency_pct}% contingency</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Down Payment Required</p>
                  <p className="text-xl font-bold text-gray-900">{fmt$$(downPayment)}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phase 1 Monthly Carry</p>
                  <p className="text-xl font-bold text-gray-900">{fmt$$(constructionInterest)}</p>
                  <p className="text-xs text-gray-400">construction interest only</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phase 2 Monthly Payment</p>
                  <p className="text-xl font-bold text-gray-900">{fmt$$(phase2Payment)}</p>
                  <p className="text-xs text-gray-400">permanent mortgage</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
