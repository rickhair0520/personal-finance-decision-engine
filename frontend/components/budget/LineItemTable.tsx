"use client";
import { useState, useEffect, useRef } from "react";
import { BudgetLineItem, api } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface Props {
  versionId: string;
  versionName: string;
  onTotalChange: (total: number) => void;
}

export default function LineItemTable({ versionId, versionName, onTotalChange }: Props) {
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLoading(true);
    api.budget.getLines(versionId).then((l) => {
      setLines(l);
      setLoading(false);
    });
  }, [versionId]);

  function handleAmountChange(id: string, raw: string) {
    const val = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, amount: val } : l)));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(lines.map((l) => (l.id === id ? { ...l, amount: val } : l))), 800);
  }

  function handleCategoryChange(id: string, val: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, category: val } : l)));
  }

  function addLine() {
    const newLine: BudgetLineItem = { id: `new-${Date.now()}`, category: "New Item", amount: 0, sort_order: lines.length };
    setLines((prev) => [...prev, newLine]);
  }

  function removeLine(id: string) {
    const updated = lines.filter((l) => l.id !== id);
    setLines(updated);
    save(updated);
  }

  async function save(current: BudgetLineItem[]) {
    setSaveState("saving");
    try {
      const result = await api.budget.updateLines(versionId, current);
      onTotalChange(result.total);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{versionName} — Line Items</span>
        {saveState !== "idle" && (
          <span className={`text-xs font-medium ${saveState === "saved" ? "text-green-600" : "text-gray-400"}`}>
            {saveState === "saving" ? "Saving…" : "Saved ✓"}
          </span>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-5 py-2 text-left font-medium">Category</th>
            <th className="px-5 py-2 text-right font-medium">Amount</th>
            <th className="px-5 py-2 text-right font-medium">% of Total</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={line.id} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
              <td className="px-5 py-2">
                <input
                  className="w-full text-sm text-gray-800 font-medium bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 outline-none"
                  value={line.category}
                  onChange={(e) => handleCategoryChange(line.id, e.target.value)}
                  onBlur={() => save(lines)}
                />
              </td>
              <td className="px-5 py-2">
                <div className="relative flex items-center justify-end">
                  <span className="absolute left-0 text-gray-400 text-xs">$</span>
                  <input
                    type="number"
                    min={0}
                    value={line.amount || ""}
                    onChange={(e) => handleAmountChange(line.id, e.target.value)}
                    className="w-32 text-right text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder="0"
                  />
                </div>
              </td>
              <td className="px-5 py-2 text-right text-gray-500 text-xs">
                {total > 0 ? ((line.amount / total) * 100).toFixed(1) + "%" : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => removeLine(line.id)}
                  className="text-gray-300 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-gray-100">
        <button
          onClick={addLine}
          className="text-xs text-indigo-600 hover:underline"
        >
          + Add line item
        </button>
      </div>
    </div>
  );
}
