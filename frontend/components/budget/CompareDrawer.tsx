"use client";
import { useState, useEffect } from "react";
import { BudgetVersionSummary, BudgetLineItem, api } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface Props {
  versions: BudgetVersionSummary[];
  onClose: () => void;
}

export default function CompareDrawer({ versions, onClose }: Props) {
  const [idA, setIdA] = useState(versions[0]?.id ?? "");
  const [idB, setIdB] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [linesA, setLinesA] = useState<BudgetLineItem[]>([]);
  const [linesB, setLinesB] = useState<BudgetLineItem[]>([]);

  useEffect(() => {
    if (idA) api.budget.getLines(idA).then(setLinesA);
  }, [idA]);

  useEffect(() => {
    if (idB) api.budget.getLines(idB).then(setLinesB);
  }, [idB]);

  const categories = Array.from(
    new Set([...linesA.map((l) => l.category), ...linesB.map((l) => l.category)])
  );

  const amtA = (cat: string) => linesA.find((l) => l.category === cat)?.amount ?? 0;
  const amtB = (cat: string) => linesB.find((l) => l.category === cat)?.amount ?? 0;

  const totalA = linesA.reduce((s, l) => s + l.amount, 0);
  const totalB = linesB.reduce((s, l) => s + l.amount, 0);
  const netDiff = totalB - totalA;

  const versionName = (id: string) => versions.find((v) => v.id === id)?.name ?? id;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[75vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm font-bold text-gray-900">Compare Versions</span>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">A:</span>
              <select
                value={idA}
                onChange={(e) => setIdA(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">B:</span>
              <select
                value={idB}
                onChange={(e) => setIdB(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg ml-2">✕</button>
          </div>
        </div>

        <div className="px-6 py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">{versionName(idA)}</th>
                <th className="px-4 py-2 text-right font-medium">{versionName(idB)}</th>
                <th className="px-4 py-2 text-right font-medium">Difference</th>
                <th className="px-4 py-2 text-right font-medium">% Change</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const a = amtA(cat);
                const b = amtB(cat);
                const diff = b - a;
                const pct = a > 0 ? ((diff / a) * 100).toFixed(1) : null;
                const changed = diff !== 0;
                return (
                  <tr
                    key={cat}
                    className={`border-b border-gray-50 ${
                      changed
                        ? diff > 0
                          ? "bg-red-50/40"
                          : "bg-green-50/40"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-medium text-gray-700">{cat}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmt$$(a)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${changed ? "text-gray-900" : "text-gray-600"}`}>
                      {fmt$$(b)}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                      {diff === 0 ? "—" : (diff > 0 ? "+" : "") + fmt$$(diff)}
                    </td>
                    <td className={`px-4 py-2 text-right text-xs ${diff > 0 ? "text-red-500" : diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                      {pct !== null && diff !== 0 ? (diff > 0 ? "+" : "") + pct + "%" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals footer */}
          <div className="mt-4 grid grid-cols-3 gap-0 border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-r border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{versionName(idA)}</p>
              <p className="text-lg font-bold text-gray-900">{fmt$$(totalA)}</p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-r border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{versionName(idB)}</p>
              <p className="text-lg font-bold text-gray-900">{fmt$$(totalB)}</p>
            </div>
            <div className={`px-5 py-3 ${netDiff !== 0 ? (netDiff > 0 ? "bg-red-50" : "bg-green-50") : "bg-gray-50"}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Net Difference</p>
              <p className={`text-lg font-bold ${netDiff > 0 ? "text-red-600" : netDiff < 0 ? "text-green-600" : "text-gray-600"}`}>
                {netDiff === 0 ? "No change" : (netDiff > 0 ? "+" : "") + fmt$$(netDiff)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
