"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import PlaidLink from "@/components/ui/PlaidLink";
import { api, ProfileResponse, isLoggedIn } from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

function Field({
  label,
  name,
  value,
  type = "number",
  step,
  min,
  max,
  prefix,
  suffix,
  hint,
  onChange,
  onBlur,
}: {
  label: string;
  name: string;
  value: number | string;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  onChange: (name: string, val: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 text-sm">{prefix}</span>
        )}
        <input
          type={type}
          step={step || "1"}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={onBlur}
          className={`w-full border border-gray-300 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-7" : "px-3"
          }`}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-500 text-sm">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<Record<string, number>>({});
  const [assumptions, setAssumptions] = useState<Record<string, number>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showAssumptions, setShowAssumptions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/auth/login"); return; }
    api.profile.get().then((d) => {
      setProfileData(d);
      setForm(d.profile as unknown as Record<string, number>);
      setAssumptions(d.assumptions as unknown as Record<string, number>);
    });
  }, [router]);

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      await api.profile.update(form as Parameters<typeof api.profile.update>[0]);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [form]);

  function handleChange(name: string, val: string) {
    setForm((prev) => ({ ...prev, [name]: parseFloat(val) || 0 }));
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 800);
  }

  async function saveAssumptions() {
    try {
      await api.profile.updateAssumptions(assumptions as Parameters<typeof api.profile.updateAssumptions>[0]);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  function handleAssumptionChange(name: string, val: string) {
    setAssumptions((prev) => ({ ...prev, [name]: parseFloat(val) || 0 }));
  }

  if (!profileData) return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    </div>
  );

  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Error saving" : "";
  const saveColor = saveState === "saved" ? "text-green-600" : saveState === "error" ? "text-red-600" : "text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Financial Profile</h1>
          {saveLabel && <span className={`text-sm font-medium ${saveColor}`}>{saveLabel}</span>}
        </div>

        {profileData.is_example && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Fill in your real numbers below. Fields auto-save when you leave them.
          </div>
        )}

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-1">Connect Bank Account</h2>
            <p className="text-xs text-gray-500 mb-4">
              Auto-fill your checking balance and monthly expenses from Wells Fargo.
            </p>
            <PlaidLink
              onApply={(balance, monthlyExpenses) => {
                setForm((prev) => ({
                  ...prev,
                  current_savings: balance,
                  monthly_expenses: monthlyExpenses,
                }));
                save();
              }}
            />
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Income</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Annual Salary" name="annual_income" value={form.annual_income ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} hint="Pre-tax gross" />
              <Field label="Annual Bonus" name="annual_bonus" value={form.annual_bonus ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Monthly Expenses & Debt</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Monthly Living Expenses" name="monthly_expenses" value={form.monthly_expenses ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} hint="Exclude mortgage & debt" />
              <Field label="Existing Monthly Mortgage" name="existing_monthly_mortgage" value={form.existing_monthly_mortgage ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} />
              <Field label="Other Monthly Debt" name="other_monthly_debt" value={form.other_monthly_debt ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} hint="Car loans, student loans, etc." />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Savings & Investments</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Liquid Savings" name="current_savings" value={form.current_savings ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} />
              <Field label="Retirement & Investment Accounts" name="investments" value={form.investments ?? 0} prefix="$" onChange={handleChange} onBlur={handleBlur} />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Personal</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Your Age" name="age" value={form.age ?? 35} min={18} max={80} onChange={handleChange} onBlur={handleBlur} />
              <Field label="Target Retirement Age" name="retirement_age" value={form.retirement_age ?? 65} min={40} max={80} onChange={handleChange} onBlur={handleBlur} />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200">
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setShowAssumptions(!showAssumptions)}
            >
              <span>Assumptions</span>
              <span>{showAssumptions ? "▲" : "▼"}</span>
            </button>
            {showAssumptions && (
              <div className="px-5 pb-5 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <Field
                    label="Annual Investment Return"
                    name="annual_investment_return"
                    value={((assumptions.annual_investment_return ?? 0.07) * 100).toFixed(1)}
                    step="0.1"
                    suffix="%"
                    onChange={(name, val) => handleAssumptionChange(name, String(parseFloat(val) / 100))}
                    onBlur={saveAssumptions}
                  />
                  <Field
                    label="Inflation Rate"
                    name="inflation_rate"
                    value={((assumptions.inflation_rate ?? 0.03) * 100).toFixed(1)}
                    step="0.1"
                    suffix="%"
                    onChange={(name, val) => handleAssumptionChange(name, String(parseFloat(val) / 100))}
                    onBlur={saveAssumptions}
                  />
                  <Field
                    label="Home Appreciation"
                    name="home_appreciation_rate"
                    value={((assumptions.home_appreciation_rate ?? 0.04) * 100).toFixed(1)}
                    step="0.1"
                    suffix="%"
                    onChange={(name, val) => handleAssumptionChange(name, String(parseFloat(val) / 100))}
                    onBlur={saveAssumptions}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Estimated take-home: ~{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((form.annual_income || 0) / 12)}/mo (pre-tax estimate, no tax model applied)
        </p>
      </main>
    </div>
  );
}
