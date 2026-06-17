"use client";
import { BudgetVersionSummary } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface Props {
  version: BudgetVersionSummary;
  baseline: BudgetVersionSummary | null;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export default function VersionCard({
  version,
  baseline,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onRename,
}: Props) {
  const delta = baseline && !version.is_baseline ? version.total - baseline.total : null;

  function handleRename() {
    const name = window.prompt("Rename version:", version.name);
    if (name && name.trim() && name !== version.name) onRename(name.trim());
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl p-4 min-w-[160px] cursor-pointer transition-all ${
        isSelected
          ? "border-2 border-indigo-500 bg-indigo-50"
          : "border border-gray-200 bg-white hover:border-indigo-300"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
          isSelected ? "text-indigo-600" : "text-gray-500"
        }`}
      >
        {version.name}
        {version.is_baseline && (
          <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            baseline
          </span>
        )}
      </p>
      <p className="text-xl font-bold text-gray-900">{fmt$$(version.total)}</p>
      {delta !== null && (
        <p className={`text-xs mt-1 font-medium ${delta > 0 ? "text-red-500" : delta < 0 ? "text-green-600" : "text-gray-400"}`}>
          {delta > 0 ? `↑ ${fmt$$(delta)}` : delta < 0 ? `↓ ${fmt$$(Math.abs(delta))}` : "same as baseline"}
        </p>
      )}
      <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleRename}
          className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50"
        >
          Rename
        </button>
        <button
          onClick={onDuplicate}
          className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
