"use client";
import { useState } from "react";
import { ImportRow } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

const DEFAULT_CATEGORIES = [
  "Foundation","Framing","Roofing","Exterior","Electrical","Plumbing","HVAC",
  "Insulation","Drywall","Flooring","Kitchen","Bathrooms","Interior Finishes",
  "Landscaping","General Contractor Fee","Contingency","Other",
];

interface Props {
  rows: ImportRow[];
  onConfirm: (rows: ImportRow[]) => void;
  loading: boolean;
}

export default function ImportMapper({ rows, onConfirm, loading }: Props) {
  const [mapped, setMapped] = useState<ImportRow[]>(rows);

  function setCategory(idx: number, cat: string) {
    setMapped((prev) => prev.map((r, i) => i === idx ? { ...r, detected_category: cat } : r));
  }

  const unresolved = mapped.filter((r) => !r.detected_category).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length} rows parsed · {unresolved} need review
        </p>
        <button
          onClick={() => onConfirm(mapped)}
          disabled={loading || unresolved > 0}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import Version →"}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 text-left font-medium"></th>
              <th className="px-4 py-2 text-left font-medium">Your Excel Column</th>
              <th className="px-4 py-2 text-left font-medium">Budget Category</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {mapped.map((row, i) => (
              <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                <td className="px-4 py-2 w-6">
                  {row.confidence === "high" ? (
                    <span className="text-green-500 text-xs font-bold">✓</span>
                  ) : (
                    <span className="text-amber-400 text-xs font-bold">?</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-700">{row.raw_label}</td>
                <td className="px-4 py-2">
                  <select
                    value={row.detected_category ?? ""}
                    onChange={(e) => setCategory(i, e.target.value || "")}
                    className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                      !row.detected_category ? "border-amber-300 bg-amber-50" : "border-gray-200"
                    }`}
                  >
                    <option value="">-- select --</option>
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-right font-medium text-gray-800">
                  {fmt$$(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
